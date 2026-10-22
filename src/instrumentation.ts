import type { Instrumentation } from "next";

/** Server errors from pages, route handlers, and server actions go to the error log (src/lib/errors/report.ts). */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("@/lib/errors/report");
  const e = err as { message?: string; digest?: string; stack?: string };
  await reportError({
    kind: "server",
    message: e?.message ?? String(err),
    digest: e?.digest ?? null,
    route: context.routePath,
    path: request.path,
    detail: { method: request.method, routeType: context.routeType, stack: e?.stack?.split("\n").slice(0, 6).join("\n") },
  });
};
