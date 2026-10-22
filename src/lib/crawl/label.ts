/** "riverbendyouth.org/about" for a source chip. */
export function sourceLabelFor(url: string): string {
  try {
    const u = new URL(url);
    const p = u.pathname.replace(/\/$/, "");
    const label = `${u.hostname.replace(/^www\./, "")}${p}`;
    return label.length > 42 ? `${label.slice(0, 40)}…` : label;
  } catch {
    return url;
  }
}
