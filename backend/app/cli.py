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


def bootstrap() -> None:
    """Creates the first owner from the environment, once. Idempotent: does nothing when an owner already exists."""
    from .config import get_settings
    s = get_settings()
    db = session_scope()
    try:
        if db.scalar(select(User).where(User.role == "owner", User.status != "deleted")):
            print("Owner exists; bootstrap skipped.")
            return
        email, name, pw = s.owner_email.lower().strip(), s.owner_name.strip() or "Owner", s.owner_password
        if not email or not pw:
            print("No owner yet. Set SALAM_OWNER_EMAIL and SALAM_OWNER_PASSWORD to create one.")
            return
        errs = policy_errors(pw, email, name)
        if errs:
            print("SALAM_OWNER_PASSWORD rejected by the password policy: " + ", ".join(errs))
            return
        u = db.scalar(select(User).where(User.email == email))
        if u is None:
            u = User(email=email, name=name)
            db.add(u)
        u.role, u.status, u.password_hash = "owner", "active", hash_password(pw)
        u.password_changed_at = u.email_verified_at = utcnow()
        u.must_change_password = True  # the bootstrap password lives in the host's settings; replace it on first sign-in
        db.flush()
        audit.log(db, "owner_bootstrapped", u, None, "user", u.id)
        db.commit()
        print(f"Owner {email} created.")
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
