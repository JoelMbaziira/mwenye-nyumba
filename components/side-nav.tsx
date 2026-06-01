"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Users, Wrench, FileText, BarChart2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard",             label: "Overview",     icon: LayoutDashboard },
  { href: "/dashboard/properties",  label: "Properties",   icon: Building2 },
  { href: "/dashboard/tenants",     label: "Tenants",      icon: Users },
  { href: "/dashboard/maintenance", label: "Maintenance",  icon: Wrench },
];

const NAV_BOTTOM = [
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function SideNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);
  }

  if (mobile) {
    return (
      <div className="flex items-center justify-around px-1 py-1.5">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={cn(
            "flex flex-col items-center gap-0.5 rounded-lg px-4 py-2 text-[11px] font-medium transition-colors",
            isActive(href) ? "text-[hsl(148,52%,33%)]" : "text-muted-foreground hover:text-foreground"
          )}>
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-3 py-4">
      <nav className="flex-1 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)] shadow-sm"
                : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white"
            )}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-0.5 border-t border-[var(--sidebar-border)] pt-3">
        {NAV_BOTTOM.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--sidebar-text)] transition-all hover:bg-[var(--sidebar-hover)] hover:text-white">
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
