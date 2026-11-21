import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_SCHOOL_COOKIE } from "@/lib/school-workspace";

export async function GET(request: NextRequest) {
  const schoolId = request.nextUrl.searchParams.get("schoolId");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") return NextResponse.redirect(new URL("/login", request.url));
  if (!schoolId) return NextResponse.redirect(new URL("/admin", request.url));

  const { data: membership } = await supabase.from("school_memberships").select("school_id").eq("user_id", userId).eq("school_id", schoolId).eq("role", "school_admin").eq("status", "active").maybeSingle();
  if (!membership) return NextResponse.redirect(new URL("/admin", request.url));
  const { data: school } = await supabase.from("schools").select("id, status").eq("id", membership.school_id).maybeSingle();
  if (school?.status !== "active") return NextResponse.redirect(new URL("/school-review", request.url));

  const response = NextResponse.redirect(new URL("/admin", request.url));
  response.cookies.set(ACTIVE_SCHOOL_COOKIE, school.id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
