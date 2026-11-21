
import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({
      success: false,
      message: "Supabase environment variables are missing.",
    }, { status: 500 });
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        message: "Supabase responded, but the request was not successful.",
        status: response.status,
      }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      message: "COGNIA successfully connected to Supabase!",
      status: response.status,
    });

  } catch {
    return NextResponse.json({
      success: false,
      message: "Could not reach Supabase. Check your project URL and connection.",
    }, { status: 500 });
  }
}

