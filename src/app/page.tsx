import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CogniaBrand from "@/components/brand/cognia-brand";
import { resolvePostLoginRoute } from "@/lib/post-login-route";
import { createClient } from "@/lib/supabase/server";
import LandingPage from "./landing-page";
import "./landing.css";

export const metadata: Metadata = {
  title: "COGNIA | One connected workspace for your school",
  description:
    "Bring your school's administration, students, staff, academics, attendance and everyday operations together with COGNIA.",
};

export default async function Home() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();

  if (typeof claims?.claims.sub === "string") {
    redirect(await resolvePostLoginRoute());
  }

  return (
    <LandingPage
      navBrand={<CogniaBrand href="/" size="standard" />}
      footerBrand={<CogniaBrand href="/" size="standard" tone="dark" subtitle="EDUCATION MANAGEMENT" />}
      year={new Date().getFullYear()}
    />
  );
}
