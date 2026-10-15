# CampusCycle setup guide

A lightweight web app for BSIS students and alumni to sell, give away, swap, and request books, components, and materials.

Stack: React (Vite), Supabase (auth, Postgres, storage), Vercel, GitHub.

## 1. Set up Supabase

1. Create a project at supabase.com.
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, and run it. This creates the tables, Row Level Security policies, rate-limit triggers, realtime for chat and alerts, and the `listing-images` storage bucket.
3. Under **Authentication > Providers**, keep Email enabled. Keep "Confirm email" on so people cannot sign up with addresses they do not own.
4. Under **Authentication > URL Configuration**, set the Site URL to your Vercel URL and add `http://localhost:5173` and `https://your-app.vercel.app/reset` to Redirect URLs.
5. Under **Project Settings > API**, copy the Project URL and the anon public key.

## 2. Run locally

```
npm install
cp .env.example .env     # paste your URL and anon key
npm run dev
```

## 3. Deploy

1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New > Project**, import the repository (Vite is detected automatically).
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables, then deploy.

`vercel.json` already routes every path to the app, so refreshing a listing page works.

## Features

- Browse with search, type and category filters; post listings with up to 3 photos
- Chat inside the app: many conversations at once, live delivery, "Seen" marks, unread badges
- Alerts: new messages, and when a listing you asked about is marked done
- Profiles: edit your own (name, program, bio, avatar color), view anyone's and their listings

## Moderation

Reports are stored in the `reports` table and are only readable from the Supabase dashboard (Table Editor). To take a listing down, set its `status` to `hidden`. The owner cannot reverse that.

## Security notes

- The anon key is safe to expose in the browser. Access is enforced by Row Level Security.
- Limits (database triggers): 10 listings per day, 20 new chats per day, 30 messages per minute.

## Adding another campus later

`schools` and `school_id` already exist on profiles and listings. To expand, add a school row, let users pick it at signup, and filter listings by `school_id`.
