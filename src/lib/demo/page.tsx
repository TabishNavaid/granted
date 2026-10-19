import type { ReactNode } from "react";
import { DemoPage } from "@/components/demo/demo-page";
import { browserDemoFlag } from "./server";
import type { DemoParams, DemoRoute } from "./pages";

type Props = { params?: Promise<DemoParams>; searchParams?: Promise<DemoParams> };

/**
 * A page that renders on the server, or, in the browser demo, renders the
 * same body in the browser from the visitor's saved state. The nonce is new
 * on every server render, so `router.refresh()` after a change makes the
 * browser render again too.
 */
export function demoPage<P>(route: DemoRoute, render: (props: P) => Promise<ReactNode> | ReactNode) {
  return async function Page(props: P) {
    const flag = browserDemoFlag();
    if (!flag) return render(props);
    const { params, searchParams } = props as Props;
    const [p, s] = await Promise.all([params ?? {}, searchParams ?? {}]);
    return <DemoPage route={route} params={p} searchParams={s} flag={flag} nonce={crypto.randomUUID()} />;
  };
}
