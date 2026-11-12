"""Role → permission matrix. Enforced on every endpoint on the server; the web app only mirrors it for display."""
PERMS: dict[str, frozenset[str]] = {
    "owner": frozenset({"learn", "train", "train_all", "users", "roles", "grant_admin", "override", "programs", "settings", "audit", "export", "cohorts", "announce", "preview"}),
    "admin": frozenset({"learn", "train", "train_all", "users", "roles", "override", "programs", "audit", "export", "cohorts", "announce", "preview"}),
    # Developer: builds and maintains the platform and solves technical problems — content, settings, audit,
    # account support (unlock, resend invites, password resets), read access to every learner's progress, announcements.
    # Cannot change roles, grant admin, override promotions, or touch admin/owner accounts.
    "developer": frozenset({"learn", "programs", "settings", "audit", "export", "preview", "users", "train", "train_all", "cohorts", "announce"}),
    "trainer": frozenset({"learn", "train", "cohorts_read", "announce", "preview"}),
    "trainee": frozenset({"learn"}),
}
# Roles a given role may assign to others (nobody can assign "owner"; nobody may change their own role).
ASSIGNABLE: dict[str, tuple[str, ...]] = {
    "owner": ("admin", "developer", "trainer", "trainee"),
    "admin": ("developer", "trainer", "trainee"),
    "developer": ("trainer", "trainee"),
}


def has(role: str, perm: str) -> bool:
    return perm in PERMS.get(role, frozenset())
