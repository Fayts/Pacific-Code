import { requireOrgContext } from "@/lib/auth/context";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireOrgContext();
  const userName = [context.profile?.first_name, context.profile?.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="min-h-svh">
      <Sidebar organizationName={context.organization.name} />
      <div className="flex min-h-svh flex-col md:pl-60">
        <Topbar
          organizationName={context.organization.name}
          userName={userName || context.email}
          email={context.email}
        />
        <main className="flex-1 px-4 py-5 md:px-6 md:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
