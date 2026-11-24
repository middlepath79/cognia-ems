import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

test("public landing page keeps authenticated users on the existing workspace resolver", () => {
  const rootPage = fs.readFileSync(path.join(process.cwd(), "src", "app", "page.tsx"), "utf8");
  const landingPage = fs.readFileSync(path.join(process.cwd(), "src", "app", "landing-page.tsx"), "utf8");

  assert.match(rootPage, /supabase\.auth\.getClaims\(\)/);
  assert.match(rootPage, /redirect\(await resolvePostLoginRoute\(\)\)/);
  assert.match(rootPage, /<LandingPage/);
  assert.match(landingPage, /href="\/register"/);
  assert.match(landingPage, /href="\/login"/);
  assert.match(landingPage, /prefers-reduced-motion/);
  assert.match(landingPage, /useGSAP/);
  assert.match(landingPage, /gsap\.from\(featureCards,[\s\S]*stagger: 0\.08/);

  const anchorTargets = [...landingPage.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
  const sectionIds = new Set([...landingPage.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  assert.deepEqual(anchorTargets.filter((target) => !sectionIds.has(target)), []);
});

test("landing registration and sign-in retain the existing Supabase journeys", () => {
  const authForm = fs.readFileSync(path.join(process.cwd(), "src", "components", "auth-form.tsx"), "utf8");
  const brand = fs.readFileSync(path.join(process.cwd(), "src", "components", "brand", "cognia-brand.tsx"), "utf8");

  assert.match(authForm, /supabase\.auth\.signInWithPassword/);
  assert.match(authForm, /supabase\.auth\.signUp/);
  assert.match(authForm, /emailRedirectTo: `\$\{origin\}\/auth\/callback\?next=\/onboarding`/);
  assert.match(brand, /src="\/brand\/cognia-logo\.png"/);
});
