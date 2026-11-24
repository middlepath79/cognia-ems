import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePostLoginRoute } from "@/lib/post-login-route";
import { getSafeInternalPath } from "@/lib/auth-routing";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = getSafeInternalPath(request.nextUrl.searchParams.get("next"), request.url);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (nextPath) return NextResponse.redirect(new URL(nextPath, request.url));
      return NextResponse.redirect(new URL(await resolvePostLoginRoute(), request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=verification", request.url));
}
