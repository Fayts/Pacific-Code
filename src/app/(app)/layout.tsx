"use client";

import { useAppData } from "@/components/providers/app-data-provider";
import { RequireSession } from "@/components/providers/require-session";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

function AppShell({ children }: { children: React.ReactNode }) {
  const { session, organization } = useAppData();
  const user = session?.user;
  const userName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "";
  const organizationName = organization?.name ?? "Pacific Code";

  return (
    <div className="min-h-svh">
      <Sidebar organizationName={organizationName} />
      <div className="flex min-h-svh flex-col md:pl-60">
        <Topbar
          organizationName={organizationName}
          userName={userName}
          email={user?.email ?? ""}
        />
        <main className="flex-1 px-4 py-5 md:px-6 md:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireSession>
      <AppShell>{children}</AppShell>
    </RequireSession>
  );
}
