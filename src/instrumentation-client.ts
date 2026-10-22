// Browser errors go to /api/errors, at most five per page load, so a broken page cannot flood the log.
let sent = 0;

function send(message: string, stack?: string) {
  if (sent >= 5 || !message) return;
  sent++;
  const body = JSON.stringify({ message: message.slice(0, 1000), stack: stack?.slice(0, 2000), path: location.pathname });
  try {
    if (!navigator.sendBeacon?.("/api/errors", new Blob([body], { type: "application/json" }))) void fetch("/api/errors", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
  } catch {
    // Never let reporting break the page.
  }
}

if (process.env.NODE_ENV === "production") {
  window.addEventListener("error", (e) => {
    // Errors from extensions and cross-origin scripts arrive as "Script error." with nothing useful.
    if (!e.filename || !e.filename.startsWith(location.origin)) return;
    send(e.message, e.error instanceof Error ? e.error.stack : undefined);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    send(r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack : undefined);
  });
}
