"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (iconOnly) {
    return (
      <button
        onClick={signOut}
        title="Sign out"
        className="grid h-7 w-7 place-items-center rounded-md text-[var(--sidebar-text)] transition-colors hover:bg-white/10 hover:text-white md:opacity-60 md:hover:opacity-100"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 text-sm">
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  );
}
