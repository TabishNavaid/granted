import { MobileTopBar, Sidebar, type SidebarProps } from "@/components/app/sidebar";
import { services } from "@/lib/services";

/** What the sidebar shows. On a server it loads for the page; in the browser demo it loads in the tab (src/components/demo/demo-shell.tsx). */
export async function loadShell(): Promise<SidebarProps> {
  const [org, user, pending, workspaces, demo] = await Promise.all([services.org.get(), services.org.currentUser(), services.inbox.pendingCount(), services.org.listWorkspaces(), services.demo.status()]);
  return { orgType: org.orgType, orgName: org.name, userName: user.fullName, pendingCount: pending, workspaces, demo: demo.active ? { replay: demo.replay, recordedOn: demo.recordedOn, current: demo.current, orgName: org.name } : null };
}

/** The app's frame. Without a sidebar yet, the same boxes hold its place so the page does not move when it arrives. */
export function AppFrame({ shell, children }: { shell: SidebarProps | null; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-ink focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      {shell ? <Sidebar {...shell} /> : <div className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-rule lg:block" />}
      {shell ? <MobileTopBar {...shell} /> : <div className="sticky top-0 z-30 h-14 border-b border-rule bg-paper lg:hidden" />}
      <main id="main" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
