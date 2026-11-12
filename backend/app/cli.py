"""Operator commands.

  python -m app.cli create-owner --email you@example.org --name "Your name"   (prompts for the password; run once)
      add --password-stdin to read it from standard input instead
  python -m app.cli seed                                                      (catalog + default program)
  python -m app.cli prune                                                     (old rate-limit events and dead sessions)
  python -m app.cli gen-key                                                   (prints a new SALAM_MFA_ENCRYPTION_KEY)
  python -m app.cli dump-public --out overview.json                           (public overview snapshot for the static preview)
"""
import argparse
import getpass
import sys
from datetime import timedelta

from cryptography.fernet import Fernet
from sqlalchemy import delete, select

from . import audit
from .db import session_scope, utcnow
from .models import Session, User
from .security.passwords import hash_password, policy_errors
from .security.ratelimit import prune as prune_rates


def create_owner(email: str, name: str, password: str | None = None, from_stdin: bool = False) -> None:
    db = session_scope()
    try:
        if db.scalar(select(User).where(User.role == "owner", User.status != "deleted")):
            sys.exit("An owner already exists. Ownership transfer is a deliberate, manual operation.")
        email = email.lower().strip()
        if db.scalar(select(User).where(User.email == email)):
            sys.exit("That e-mail already has an account.")
        if from_stdin:
            password = sys.stdin.readline().rstrip("\n")
        pw = password or getpass.getpass("Owner password: ")
        if not password and pw != getpass.getpass("Repeat password: "):
            sys.exit("Passwords do not match.")
        errs = policy_errors(pw, email, name)
        if errs:
            sys.exit("Password rejected: " + ", ".join(errs))
        u = User(email=email, name=name, role="owner", status="active", password_hash=hash_password(pw), password_changed_at=utcnow(), email_verified_at=utcnow())
        db.add(u)
        db.flush()
        audit.log(db, "owner_created", u, None, "user", u.id)
        db.commit()
        print(f"Owner {email} created. Sign in and set up two-step verification.")
    finally:
        db.close()


def trial_users() -> None:
    """Creates SALAM_TRIAL_USERS accounts that do not exist yet. Existing accounts are never changed."""
    from .config import get_settings
    spec = get_settings().trial_users.strip()
    if not spec:
        return
    db = session_scope()
    try:
        for item in filter(None, (x.strip() for x in spec.split(";"))):
            parts = [p.strip() for p in item.split("|")]
            if len(parts) != 4 or parts[2] not in ("owner", "admin", "developer", "trainer", "trainee"):
                print(f"SALAM_TRIAL_USERS entry ignored (expected email|name|role|password): {parts[0] if parts else ''}")
                continue
            email, name, role, pw = parts[0].lower(), parts[1], parts[2], parts[3]
            existing = db.scalar(select(User).where(User.email == email))
            if existing and existing.status != "invited":
                continue  # never touch an account that is already in use
            if role == "owner" and not (existing and existing.role == "owner") and db.scalar(select(User).where(User.role == "owner", User.status != "deleted")):
                print(f"{email}: an owner already exists; skipped.")
                continue
            errs = policy_errors(pw, email, name)
            if errs:
                print(f"{email}: password rejected ({', '.join(errs)}); skipped.")
                continue
            u = existing or User(email=email)
            u.name, u.role, u.status, u.password_hash = name, role, "active", hash_password(pw)
            u.password_changed_at = u.email_verified_at = utcnow()
            if not existing:
                db.add(u)
            db.flush()
            audit.log(db, "trial_user_created", u, None, "user", u.id, role=role)
            print(f"Trial account ready: {email} ({role})")
        db.commit()
    finally:
        db.close()


def bootstrap() -> None:
    """Creates the first owner from the environment, once; does nothing when an owner already exists.

    With SALAM_OWNER_PASSWORD: an active owner who must change that password on first sign-in.
    Without it: an invited owner, and a single-use invite link is printed to the log so the owner sets
    their own password (no secret ever has to be typed into the host's settings).
    """
    from datetime import timedelta

    from .config import get_settings
    from .routers.auth import issue_token
    s = get_settings()
    db = session_scope()
    try:
        if db.scalar(select(User).where(User.role == "owner", User.status.in_(("active", "suspended")))):
            print("Owner exists; bootstrap skipped.")
            return
        email, name, pw = s.owner_email.lower().strip(), s.owner_name.strip() or "Owner", s.owner_password
        if not email:
            print("No owner yet. Set SALAM_OWNER_EMAIL (and optionally SALAM_OWNER_PASSWORD) to create one.")
            return
        if pw:
            errs = policy_errors(pw, email, name)
            if errs:
                print("SALAM_OWNER_PASSWORD rejected by the password policy: " + ", ".join(errs))
                return
        u = db.scalar(select(User).where(User.email == email))
        if u is None:
            u = User(email=email, name=name)
            db.add(u)
        u.role, u.name = "owner", name
        if pw:
            u.status, u.password_hash = "active", hash_password(pw)
            u.password_changed_at = u.email_verified_at = utcnow()
            u.must_change_password = True  # the bootstrap password lives in the host's settings; replace it on first sign-in
            db.flush()
            audit.log(db, "owner_bootstrapped", u, None, "user", u.id)
            db.commit()
            print(f"Owner {email} created.")
            return
        u.status = "invited"
        db.flush()
        from .models import Token
        pending = db.scalar(select(Token).where(Token.user_id == u.id, Token.kind == "invite", Token.used_at.is_(None), Token.expires_at > utcnow()))
        if pending:
            # Restarts (e.g. a free host waking up) must not invalidate a link that was already handed out.
            db.commit()
            print(f"Owner invite for {email} is still pending (expires {pending.expires_at:%Y-%m-%d %H:%M} UTC); the earlier link stays valid.")
            return
        raw = issue_token(db, u, "invite", timedelta(hours=s.invite_token_hours))  # replaces any earlier link
        audit.log(db, "owner_invited_by_bootstrap", u, None, "user", u.id)
        db.commit()
        print(f"OWNER INVITE ({email}, valid {s.invite_token_hours} h, single use): {s.app_url}/accept-invite?token={raw}")
    finally:
        db.close()


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(prog="python -m app.cli")
    sub = ap.add_subparsers(dest="cmd", required=True)
    o = sub.add_parser("create-owner")
    o.add_argument("--email", required=True)
    o.add_argument("--name", required=True)
    o.add_argument("--password-stdin", action="store_true", help="read the password from standard input (for automation)")
    sd = sub.add_parser("seed")
    sd.add_argument("--if-empty", action="store_true", help="skip when the catalog is already loaded (safe on every start)")
    sub.add_parser("bootstrap", help="create the first owner from SALAM_OWNER_* if no owner exists")
    sub.add_parser("prune")
    sub.add_parser("gen-key")
    d = sub.add_parser("dump-public")
    d.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    if a.cmd == "gen-key":
        print(Fernet.generate_key().decode())
        return
    if a.cmd == "create-owner":
        create_owner(a.email, a.name, from_stdin=a.password_stdin)
    elif a.cmd == "seed":
        from .models import CatGroup
        from .seed.seed import run
        db = session_scope()
        try:
            if a.if_empty and db.scalar(select(CatGroup).limit(1)):
                print("Catalog already loaded; skipping seed.")
            else:
                run(db)
                print("Catalog and default program loaded.")
        finally:
            db.close()
    elif a.cmd == "bootstrap":
        trial_users()
        bootstrap()
    elif a.cmd == "dump-public":
        import json
        from pathlib import Path

        from starlette.responses import Response

        from .routers.public import overview
        db = session_scope()
        try:
            Path(a.out).parent.mkdir(parents=True, exist_ok=True)
            Path(a.out).write_text(json.dumps(overview(Response(), db), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            print(f"Wrote {a.out}")
        finally:
            db.close()
    elif a.cmd == "prune":
        db = session_scope()
        try:
            prune_rates(db)
            db.execute(delete(Session).where((Session.expires_at < utcnow()) | (Session.revoked_at < utcnow() - timedelta(days=30))))
            db.commit()
            print("Pruned.")
        finally:
            db.close()


if __name__ == "__main__":
    main()
