"""Operator commands.

  python -m app.cli create-owner --email you@example.org --name "Your name"   (prompts for the password; run once)
      add --password-stdin to read it from standard input instead
  python -m app.cli seed                                                      (catalog + default program)
  python -m app.cli prune                                                     (old rate-limit events and dead sessions)
  python -m app.cli gen-key                                                   (prints a new SALAM_MFA_ENCRYPTION_KEY)
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


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(prog="python -m app.cli")
    sub = ap.add_subparsers(dest="cmd", required=True)
    o = sub.add_parser("create-owner")
    o.add_argument("--email", required=True)
    o.add_argument("--name", required=True)
    o.add_argument("--password-stdin", action="store_true", help="read the password from standard input (for automation)")
    sub.add_parser("seed")
    sub.add_parser("prune")
    sub.add_parser("gen-key")
    a = ap.parse_args(argv)
    if a.cmd == "gen-key":
        print(Fernet.generate_key().decode())
        return
    if a.cmd == "create-owner":
        create_owner(a.email, a.name, from_stdin=a.password_stdin)
    elif a.cmd == "seed":
        from .seed.seed import run
        db = session_scope()
        try:
            run(db)
            print("Catalog and default program loaded.")
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
