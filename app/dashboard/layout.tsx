import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { SideNav } from "@/components/side-nav";
import { Bell, Home } from "lucide-react";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = (user.user_metadata?.full_name as string) || user.email || "";
  const initials = fullName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "U";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Dark green sidebar */}
      <aside
        className="hidden w-56 shrink-0 flex-col md:flex"
        style={{ backgroundColor: "var(--sidebar)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[var(--sidebar-border)]">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">
            <Home className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-[13px] font-bold leading-tight text-white">Mwenye</p>
            <p className="text-[13px] font-bold leading-tight text-white">Nyumba</p>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto pt-2">
          <SideNav />
        </div>

        {/* User profile at bottom */}
        <div className="border-t border-[var(--sidebar-border)] p-3">
          <div className="flex items-center gap-2.5 rounded-lg p-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white leading-tight">{fullName}</p>
              <p className="text-[10px] text-[var(--sidebar-text)]">Landlord</p>
            </div>
            <SignOutButton iconOnly />
          </div>
        </div>
      </aside>

      {/* Content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex h-14 items-center justify-between border-b bg-white px-4 md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg" style={{ backgroundColor: "var(--sidebar)" }}>
              <Home className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-sm font-bold">Mwenye Nyumba</span>
          </Link>
          <SignOutButton iconOnly />
        </header>

        <main className="flex-1 overflow-auto p-5 md:p-8">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t bg-white/95 backdrop-blur md:hidden">
        <SideNav mobile />
      </nav>
      <div className="h-16 md:hidden" />
    </div>
  );
}
