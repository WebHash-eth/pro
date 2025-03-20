import { ReactNode } from "react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/app/components/mobile-nav";
import { UserNav } from "@/app/components/user-nav";
import { SidebarNav } from "../components/sidebar-nav";
import { ThemeAwareLogo } from "../components/theme-aware-logo";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(auth);

  if (!session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4">
        <MobileNav />
        <div className="flex-1 flex justify-center">
          <Link href="/" className="flex items-center font-semibold">
            <ThemeAwareLogo width={120} height={26} className="w-[120px] h-[26px]" />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserNav session={session} />
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:fixed md:h-screen w-64 border-r bg-background z-30">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/" className="flex items-center font-semibold">
            <ThemeAwareLogo width={140} height={30} className="w-[140px] h-[30px]" />
          </Link>
        </div>
        <SidebarNav />
        <div className="mt-auto p-4 border-t flex items-center justify-between">
          <UserNav session={session} />
          <ThemeToggle />
        </div>
      </aside>
      <div className="md:pl-64 flex-1">
        <main className="flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}