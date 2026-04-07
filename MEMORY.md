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
- Nano Banana image generation API

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
- Yearly plans month 2–12: cron `/api/cron/monthly-credits` (catch-up loop; grants all overdue months in one run if cron was delayed)
- Each credit batch expires 30 days after grant; consumed FIFO by expiry

## Schema
- `Subscription.nextPlan` field removed (was unused); migration: 20260407000000_remove_next_plan

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

## Acceptance (Current Release)
- unauthenticated users cannot generate
- authenticated users can generate successfully
- correct credits are deducted on success
- credits are refunded on generation failure
- main landing CTA leads users into the correct flow
- core conversion events are trackable
- no major blocking bug on landing / auth / checkout / generation / result path

## Product Risks / Reality Check
- homepage messaging currently promises video / image / music, but the clearest confirmed implemented core is image generation
- README appears outdated relative to current subscriptions / credits / Stripe data model
- GA4 should be treated as first-class work, not a later add-on

## Current Priorities
1. tighten MVP scope
2. stabilize image generation funnel
3. add GA4 on core funnel
4. improve launch readiness for paid traffic validation

## Decisions
- Lite agent system only
- use Codex as the engineering agent
- use GPT as product / QA / growth copilot by prompt
- keep shared memory in this file for now