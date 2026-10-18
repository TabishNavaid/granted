import { MobileTopBar, Sidebar } from "@/components/app/sidebar";
import { services } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [org, user, pending] = await Promise.all([services.org.get(), services.org.currentUser(), services.inbox.pendingCount()]);
  const props = { orgName: org.name, userName: user.fullName, pendingCount: pending };
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
      >
        Skip to content
      </a>
      <Sidebar {...props} />
      <MobileTopBar {...props} />
      <main id="main" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
