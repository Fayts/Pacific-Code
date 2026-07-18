import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";

export function Topbar({
  organizationName,
  userName,
  email,
}: {
  organizationName: string;
  userName: string;
  email: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-md md:px-6">
      <MobileNav organizationName={organizationName} />
      <p className="truncate text-sm font-semibold md:hidden">
        {organizationName}
      </p>
      <div className="ml-auto flex items-center gap-2">
        <UserMenu userName={userName} email={email} />
      </div>
    </header>
  );
}
