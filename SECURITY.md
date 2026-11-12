# Security model (mapped to OWASP ASVS 4.0 L2)

| Area | Control | Where |
|---|---|---|
| V2.1 Password security | Min 12 chars, max 128, no composition rules; block-list of common/weak bases; rejects name/e-mail fragments and 4+ repeated characters; optional HIBP k-anonymity check (`SALAM_HIBP_CHECK`) | `app/security/passwords.py` |
| V2.4 Credential storage | Argon2id m=64 MiB t=3 p=2, salted; transparent rehash on login when parameters change; dummy verification for unknown accounts (timing) | `passwords.py`, `routers/auth.py` |
| V2.2 Authenticator lifecycle | Invitation and reset tokens: 256-bit random, stored as SHA-256, single use, short expiry (72 h / 30 min); previous tokens of the same kind invalidated; a rejected password does not burn the link | `routers/auth.py`, `security/tokens.py` |
| V2.5 Recovery | Forgot-password answers identically for existing/unknown e-mails; reset revokes all sessions and notifies the owner of the account | `routers/auth.py`, `mailer.py` |
| V2.8 Second factor | RFC 6238 TOTP, ±1 step, replay of an accepted step refused; secrets encrypted at rest (Fernet); 10 single-use recovery codes (hashed); mandatory for every staff role (`SALAM_REQUIRE_STAFF_MFA`); staff cannot switch it off; admin MFA reset is audited and e-mailed | `security/mfa.py`, `routers/account.py` |
| V2.2.1 Anti-automation | Lockout after 5 consecutive failures (15 min); DB-backed sliding-window limits per IP and per e-mail on login, forgot, reset, invite, MFA, quiz and project submission | `security/ratelimit.py` |
| V3 Session management | Opaque 256-bit token in `HttpOnly; Secure; SameSite=Lax` cookie, stored hashed; idle 30 min, absolute 12 h; identifier rotation after MFA and password change; revoke one / all others; suspended users lose sessions immediately; role changes revoke sessions | `security/sessions.py`, `deps.py` |
| V4 Access control | Deny by default: every endpoint declares a permission; object-level checks (trainer ↔ assigned trainee, trainee ↔ own enrollment); 404 for objects outside scope; nobody can change their own role; only the owner grants admin; owner immutable via API | `permissions.py`, `deps.py`, routers |
| V4.2.2 CSRF | Session-bound token required in `X-CSRF-Token` for all state-changing requests + strict `Origin`/`Referer` check against `SALAM_APP_URL` | `deps.py`, `main.py` |
| V5 Validation | Pydantic schemas with length limits on every field; https-only URLs for videos and project links; quiz answers scored on the server and correct options never sent to clients; 1 MB body limit | routers, `main.py` |
| V7 Logging | Append-only audit log of security and training events with actor, role, IP; no secrets or tokens logged; generic 500 responses | `audit.py`, `main.py` |
| V8 Data protection | Reflections and growth plan visible to the trainer only when the trainee opts in; personal data export; account erasure (content deleted, identity anonymised); `Cache-Control: no-store` on API | `routers/account.py`, `routers/training.py` |
| V14 Configuration | All secrets from environment; API docs disabled outside development; strict headers: CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP; containers run as non-root | `main.py`, `frontend/next.config.js`, Dockerfiles |

## Reporting

Report suspected vulnerabilities privately to the platform owner. Do not open public issues for security problems.

## Operator checklist

- [ ] Serve only over HTTPS; keep `SALAM_COOKIE_SECURE=true`.
- [ ] Generate a unique `SALAM_MFA_ENCRYPTION_KEY` and store it in a secrets manager; back it up separately from database backups.
- [ ] Use a strong, unique `POSTGRES_PASSWORD`; do not publish the database port.
- [ ] Configure SMTP with SPF, DKIM and DMARC.
- [ ] Schedule `python -m app.cli prune` daily and database backups (with restore tests).
- [ ] Review the audit log regularly (`account_locked`, `role_changed`, `trainee_override_promoted`, `mfa_reset_by_admin`).
