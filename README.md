# COGNIA — Education Management Platform

COGNIA is a multi-institution education management platform built with Next.js, TypeScript, and Supabase. Its tenant foundation supports early childhood, basic and secondary education, technical and vocational training, and higher education.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` to connect the application.

For Vercel, set both variables in Project Settings > Environment Variables for Production and any Preview or Development environments you use, then redeploy. `NEXT_PUBLIC_` values are embedded at build time. The auth pages can be prerendered without them, but Supabase middleware and authentication will not work until valid values are configured.

## Current foundation

- Supabase email/password authentication, password reset, invitation acceptance, and session refresh.
- Institution onboarding and platform administrator review.
- Institution memberships, workspace switching, invitation management, and tenant-scoped Row Level Security.
- Academic sessions, configurable academic periods, classes and arms, departments, subjects, faculties, programmes, levels, and optional course credit units.
- Student and staff directories are currently interface placeholders; admissions, attendance, fees, communications, transcripts, and grade processing still need their feature workflows.

The connected Supabase project has the migrations in `supabase/migrations` applied. Apply these migrations to any other project before using institution categories and the expanded academic model. Keep publishable keys in public environment variables; never expose a Supabase secret or service-role key to the browser.
