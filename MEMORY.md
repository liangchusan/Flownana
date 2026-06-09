# MEMORY.md

## Product
Flownana is a 0→1 AI generation website focused on fast launch and validation.
Current confirmed working core is AI image generation.
The broader brand message may include video / image / music, but current MVP priority is image-first.

## Current Tech Stack
- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- NextAuth
- Prisma + PostgreSQL
- Stripe
- KIE GPT Image 2 and Nano Banana 2 image generation APIs

## Current Core Routes
- / : landing page
- /generate : redirects to /ai-image
- /ai-image : main current creation entry

## Current Core Business Logic
- user login required for generation
- generation consumes credits
- failed generation should refund consumed credits
- subscriptions and credit batches exist in the data model
- Stripe event deduplication exists in the data model
- new generated image/video/music media is downloaded server-side and uploaded to Vercel Blob before saving `Generation.urls`
- Image generation offers both KIE GPT Image 2 and Nano Banana 2. GPT Image 2 uses `gpt-image-2-text-to-image` and `gpt-image-2-image-to-image` with platform credits 1K=2, 2K=3, 4K=5. Nano Banana 2 uses `nano-banana-2` with platform credits 1K=2, 2K=4, 4K=5. Platform image credits are calculated from KIE API credits multiplied by 0.3 and rounded. Both use KIE `/api/v1/jobs/createTask` and `/api/v1/jobs/recordInfo`. Image aspect ratio options are limited to `auto`, `9:16`, `16:9`, `1:1`, `3:4`, and `4:3`; GPT Image 2 still hides/rejects `auto` except at 1K and hides/rejects `1:1` at 4K.
- older generation history may still contain external provider media URLs; UI attempts to refresh KIE media URLs via `/api/creations/media-url` when direct media loading fails
- generation history display de-duplicates local optimistic items and persisted database rows by `taskId`
- generation history deletion is available for successful, failed, and unavailable-media items; delete removes the persisted row by `taskId || id` and clears legacy localStorage history keys keyed by either user id or email
- Google sign-in entry points pass the current path as `callbackUrl`; NextAuth redirects preserve same-origin callback URLs instead of forcing auth callbacks back to the homepage
- Non-production environments support a `test-login` NextAuth credentials provider so QA can log in without Google OAuth. It is enabled in local development by default and can be enabled for Vercel preview/test with `ENABLE_TEST_AUTH=true` plus `NEXT_PUBLIC_ENABLE_TEST_AUTH=true`; it is disabled for Vercel production. Test login provisions `test@flownana.local` and a renewable `test-auth` credit batch.
- creation pages treat NextAuth `loading` as a distinct state; refresh should not briefly show logged-out CTAs or switch logged-in users from My Creations to Explore while the session is resolving
- My Creations downloads use authenticated same-origin `/api/creations/download`; the API verifies the media URL belongs to the current user's generation before streaming it as an attachment
- Video generation platform credits are calculated from the model's KIE API credits multiplied by 0.3 and rounded to the nearest integer unless a model has an explicitly documented exception. Kling 3.0 uses KIE per-second prices for std/pro and audio/no-audio variants. VEO 3.1 uses KIE base 720P generation prices because the app does not request 1080P or 4K upgrade endpoints.
- VEO 3.1 video status polling uses KIE `/api/v1/veo/record-info` and parses `successFlag` plus `response.resultUrls`; the synchronous poll window is kept below Vercel's 300s timeout so failures can be persisted and consumed credits refunded.
- Video generation no longer offers Bytedance Seedance 1.5 Pro; Seedance options use KIE `bytedance/seedance-2` and `bytedance/seedance-2-fast`. Seedance 2 duration supports every whole second from 4s through 15s. Platform credits for Seedance 2 options are calculated from KIE no-video-input API credits per second multiplied by duration and then by 0.3, rounded to the nearest integer.
- Video generation offers HappyHorse 1.0 text-to-video through KIE `happyhorse/text-to-video`. HappyHorse supports every whole second from 3s through 15s at 720P and 1080P. Platform credits are calculated from KIE API credits per second (720P: 28, 1080P: 48) multiplied by duration and then by 0.3, rounded to the nearest integer.
- The `/ai-video` generate button checks NextAuth client session before calling `/api/veo/generate`; logged-out or expired-session users are sent through Google sign-in with `signup_started` source `ai_video_generate` instead of seeing a raw API 401.
- `/ai-video` inserts a local optimistic My Creations card immediately after an authenticated user clicks Generate. The card uses a temporary local id, shows a generating animation while the API request is pending, is replaced with the real `taskId` and media URL on success, and becomes a failed card on generation error. Users can run up to 5 concurrent video generation requests; the Generate button stays available until that active-task limit is reached.

## Subscription Upgrade Rules (as of 2026-04-07)
Allowed upgrade paths (old sub cancelled, new sub starts immediately with first credits):
- pro_monthly → pro_yearly ✅
- pro_monthly → max_monthly ✅ (newly added)
- pro_monthly → max_yearly ✅
- pro_yearly → max_yearly ✅ (with proration credit coupon)
- max_monthly → max_yearly ✅
- max_yearly → (no further upgrade)

Downgrades are disabled in code. UI shows a disabled button with note to use billing portal.

## Credit Issuance Rules
- First month: granted via webhook `checkout.session.completed` or `invoice.paid`
- Monthly plans: each month's invoice triggers `invoice.paid` → grant credits
- Yearly plans month 2–12: Vercel Cron calls `/api/cron/monthly-credits` daily at 08:00 UTC with `CRON_SECRET`; catch-up loop grants all overdue months in one run if cron was delayed
- Each credit batch expires 30 days after grant; consumed FIFO by expiry

## Schema
- `Subscription.nextPlan` field removed (was unused); migration: 20260407000000_remove_next_plan
- Production Supabase Prisma migration history was baselined on 2026-05-19 via Supabase migration `baseline_prisma_migration_history`; `_prisma_migrations` now records the four local Prisma migrations as applied.

## MVP Scope (Current)
Must support:
- landing page
- auth
- AI image generation
- credits consumption
- basic subscription / payment-related flow
- result display and download
- core analytics

Not current priority:
- expanding video flow
- expanding music flow
- large system refactor
- complex agent orchestration
- heavy admin system

## GA4 Events
Must track at minimum:
- landing_page_view
- hero_cta_click
- ai_image_entry_click
- signup_started
- signup_completed
- pricing_viewed
- checkout_started
- purchase_success
- generation_started
- generation_success
- generation_failed
- result_download_clicked
- insufficient_credits_shown

Auth CTA placement:
- `/home`, `/ai-image`, `/ai-video`, and `/ai-music` use a compact left creation sidebar for navigation; logged-in users see membership status above credit balance and avatar in the sidebar footer. Free users see `Upgrade` linking to `/pricing`, paid users see their plan label linking to `/account/billing`, and logged-out users do not see a sidebar footer sign-in CTA.

## Acceptance (Current Release)
- unauthenticated users cannot generate
- authenticated users can generate successfully
- correct credits are deducted on success
- credits are refunded on generation failure
- main landing CTA leads users into the correct flow
- core conversion events are trackable
- no major blocking bug on landing / auth / checkout / generation / result path

## Release Verification
- Before production deploy: run `npm run lint`, `npm run test`, and `npm run build`.
- After production deploy: run `npm run smoke:prod`.
- Production deploy still requires explicit approval.
- Business logic changes should include focused tests for pure credit, subscription, generation pricing, or history-display rules where practical.
- GA4 is loaded only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is configured; core funnel events are emitted from landing, pricing, checkout, auth, generation, failure, insufficient-credit, purchase-success, and download surfaces.

## Product Risks / Reality Check
- homepage messaging currently promises video / image / music, but the clearest confirmed implemented core is image generation
- README appears outdated relative to current subscriptions / credits / Stripe data model
- GA4 should be treated as first-class work, not a later add-on

## Current Priorities
1. tighten MVP scope
2. stabilize image generation funnel
3. add GA4 on core funnel
4. improve launch readiness for paid traffic validation

## TODO
- Replace the temporary homepage demo video with Flownana-owned video assets hosted on the website.
- Backfill older provider-hosted generation media into Vercel Blob where still recoverable.

## Decisions
- Lite agent system only
- use Codex as the engineering agent
- use GPT as product / QA / growth copilot by prompt
- keep shared memory in this file for now
