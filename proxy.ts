import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Change "middleware" to "proxy" to match the new Next.js 16 specification
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - public assets
     * The /pay route is intentionally NOT excluded — but it has no auth check
     * in updateSession, so it stays publicly reachable.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};