# Arrivio Mobile Send PWA

Mobile-optimized PWA for sending guest links. Lives at `app.ivrly.com`.

## Setup

1. Clone this repo
2. Copy `.env.local.template` to `.env.local` and fill in values
3. `npm install`
4. `npm run dev`

## Deploy to Vercel

1. Create new Vercel project pointing to this repo
2. Add all environment variables from `.env.local.template`
3. Set custom domain: `app.ivrly.com`

## Supabase Auth Config

In Supabase dashboard → Authentication → URL Configuration:
- Add `https://app.ivrly.com` to **Site URL**
- Add `https://app.ivrly.com/auth/callback` to **Redirect URLs**

## Session

180-day sessions via Supabase default JWT expiry. Users authenticate once via magic link,
then launch from home screen icon with no further auth required.

## PWA Install

On iOS: Safari → Share → Add to Home Screen
On Android: Chrome → Menu → Add to Home Screen (or install prompt)
