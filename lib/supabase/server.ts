import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const store = await cookieStore;
          return store.get(name)?.value;
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
            const store = await cookieStore;
            store.set({ name, value, ...options });
          } catch {
            // Called from a Server Component; ignore.
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            const store = await cookieStore;
            store.set({ name, value: "", ...options });
          } catch {
            // Called from a Server Component; ignore.
          }
        },
      },
    }
  );
}