/**
 * Operators of this deployment: the people who may see the ingestion log and other internals.
 * Set ADMIN_EMAILS to a comma-separated list of addresses. Nobody is an admin when it is empty.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(email: string | null | undefined): boolean {
  return Boolean(email) && adminEmails().includes(String(email).trim().toLowerCase());
}
