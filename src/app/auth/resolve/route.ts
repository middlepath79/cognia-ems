import { NextResponse, type NextRequest } from "next/server";
import { resolvePostLoginRoute } from "@/lib/post-login-route";

export async function GET(request: NextRequest) {
  const destination = await resolvePostLoginRoute();
  return NextResponse.redirect(new URL(destination, request.url));
}
