"""Role → permission matrix. Enforced on every endpoint on the server; the web app only mirrors it for display."""
PERMS: dict[str, frozenset[str]] = {
    "owner": frozenset({"train", "train_all", "users", "roles", "grant_admin", "override", "programs", "settings", "audit", "export", "cohorts", "announce", "preview"}),
    "admin": frozenset({"train", "train_all", "users", "roles", "override", "programs", "audit", "export", "cohorts", "announce", "preview"}),
    "developer": frozenset({"programs", "settings", "audit", "export", "preview"}),
    "trainer": frozenset({"train", "cohorts_read", "announce", "preview"}),
    "trainee": frozenset({"learn"}),
}
# Roles a given role may assign to others (nobody can assign "owner"; nobody may change their own role).
ASSIGNABLE: dict[str, tuple[str, ...]] = {
    "owner": ("admin", "developer", "trainer", "trainee"),
    "admin": ("developer", "trainer", "trainee"),
}


def has(role: str, perm: str) -> bool:
    return perm in PERMS.get(role, frozenset())
