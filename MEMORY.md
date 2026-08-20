# MEMORY.md

## Product
Flownana is a 0→1 AI generation website focused on fast launch and validation.
Current confirmed working core is AI image generation.
The active product supports image and video generation, with image remaining the MVP priority. New music generation is retired; historical audio remains accessible.

## Current Tech Stack
- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- NextAuth
- Prisma + PostgreSQL
- Stripe
- KIE GPT Image 2, Nano Banana 2, and Qwen Image 3.0 Pro image generation APIs

## UI Design System (as of 2026-08-13)
- `DESIGN.md` is the cross-tool visual source of truth for AI-assisted UI work.
- Direction is Claude-inspired, adapted for Flownana: warm cream canvas, warm ink, restrained coral primary actions, editorial display type, quiet surface hierarchy, and media-first creation/results.
- The Claude reference is an independent public analysis from getdesign.md, not an official Anthropic component library; do not copy Claude names, marks, or proprietary assets.
- Semantic tokens live in `app/globals.css` and are exposed by `tailwind.config.ts`; UI code should prefer classes such as `bg-background`, `text-foreground`, `bg-primary`, and `border-border` over raw values.
- Base primitives belong in `components/ui/`, business compositions in `components/blocks/`, and rendered visual QA is available at `/design-system` with search indexing disabled.
- Run `npm run design:check` for UI changes, then inspect touched surfaces at mobile and desktop widths.

## Current Core Routes
- / : landing page
- /generate : redirects to /ai-image
- /ai-image : main current creation entry

## Media Creation Workspace P0 (as of 2026-08-14)
- `/ai-image` and `/ai-video` share one responsive media creation workspace. Each explicit route selects its corresponding initial composer type, while the generic `/generate` entry restores the last Image/Video choice and defaults a new user to Video. The central Create stream still loads historical image, video, and music generations together. `/ai-music` redirects to `/ai-image`.
- The workspace uses a collapsible Create/Assets sidebar, a chronological Prompt + Result stream without a redundant desktop title bar, a lightweight bottom composer with one combined Image/Video selector before the model, and an optional right details panel. There is no user-visible Session or Project system in P0. Audio generation is not a selectable composer type.
- The Create stream uses an approved Codex-inspired message hierarchy without copying Codex branding or agent-process UI: original input attachments appear above the right-aligned prompt, while the response is a borderless sequence of English processing status, divider, type-specific inline parameters, proportionally rendered media, and lightweight actions. Conversation time separators appear before the first run, after a local calendar-day change, or after at least one hour between runs; labels use `Today`, `Yesterday`, or a compact calendar date. Active results immediately reserve an aspect-ratio-matched media frame animated as a small Flownana banana drifting across a deeper-blue sea and show no visible result-number label; completed timing is intentionally lighter secondary copy. Download, Reference, and Delete sit in the result media's top-right corner, reveal on desktop hover or keyboard focus, and remain visible on touch layouts; there is no separate expand action, while clicking image or video still opens its preview. Inline video previews add play/pause, progress, elapsed/duration, and sound controls; previews start muted, and videos explicitly generated with Sound Off keep the sound control disabled. Reprompt, Details, and More remain one adjacent action group below the result. More menus dismiss when the user clicks anywhere other than Remove from recent or presses Escape. Desktop result media is capped near 512px wide and 480px tall; four 9:16 image outputs use one four-column desktop row and two mobile columns to avoid an excessively tall result block. Mobile single results use the available width. Details remains available as a separate full information panel.
- New generations save `processingDurationMs` inside `Generation.parameters` without a schema migration. Active records show a live `Processing` timer, completed and failed records show `Processed in` or `Failed after`, and legacy image/music records without recoverable timing show only `Processed` or `Failed`. Multi-output image runs use the slowest output duration for the run-level status.
- One Prompt maps to one Result Block. Image requests can produce 1–4 separately billed outputs grouped by `parameters.runId`; video remains single-output. Historical music records remain single-output. `outputIndex` and `outputCount` are stored in `Generation.parameters` without a schema migration. The existing maximum of five concurrent tasks counts every requested image output.
- Reprompt directly replaces the current draft and restores saved prompt, original input image, model, parameters, and output count where available. A successful submit clears prompt and attachments but preserves generator type and settings.
- The composer owns one shared multi-attachment draft across Image/Video switches. Removing an attachment updates that canonical draft, so a deleted Reference or uploaded file cannot return after a type switch. The plus menu offers image upload and Choose from Assets; video and audio rows remain visible but disabled with model-specific unsupported copy for the current model set. GPT Image 2, Nano Banana 2, Grok Imagine Video 1.5, and HappyHorse 1.1 accept one image; Qwen Image 3.0 Pro accepts up to three images; MiniMax H3 accepts an optional first and last frame. Grok requires its one image. Attachments beyond the selected model's limit and referenced video/audio stay visibly marked incompatible, block generation, and offer Remove unsupported.
- Deleting media changes the generation to a centered, compact deleted placeholder when no outputs remain and removes it from Assets. The output relationship is removed; an unreferenced Vercel Blob and its `MediaAsset` row are deleted, while media still reused as another generation input is retained. More → Remove from recent writes `hiddenFromRecent` into `Generation.parameters`, hiding the Prompt + Result record while preserving successful media in Assets. Removal resolves the full run by `runId` as well as database/task ID so provider failures and local-only failed placeholders can be removed reliably.
- Assets is a flat grid of successful, undeleted generated outputs with All/Images/Videos/Audio filters, prompt search, Newest/Oldest sorting, preview, download, delete, and Reference back into Create. Uploaded inputs are not automatically saved as Assets.
- No new GA4 event names were added. Existing generation and result download events remain in place. The approved specification is `docs/prd-media-creation-workspace-p0.md`.

## Current Core Business Logic
- user login required for generation
- generation consumes credits
- failed generation should refund consumed credits
- subscriptions and credit batches exist in the data model
- Stripe event deduplication exists in the data model
- new generated image/video media is downloaded server-side and uploaded to Vercel Blob before saving `Generation.urls`; image-to-image and video image-to-video input media are also normalized server-side into public Vercel Blob image URLs. Every uploaded or generated file is registered in `MediaAsset`, linked to its generation through `GenerationMedia` with an `input` or `output` role, and stores available Content-Type and byte-size metadata. Historical generated music remains registered and accessible. `Generation.inputUrls` remains as a compatibility field during the gradual migration.
- generated media persistence validates provider download content type before Blob upload; Create, Assets, and media previews automatically retry transient Vercel Blob failures up to three times with cache-busting URLs, expose an explicit Retry fallback, and refresh older provider-hosted media URLs through `/api/creations/media-url` when direct loading fails
- Image and video generation failures use the shared catalog in `lib/generation-errors.ts`. Authentication, prompt/input validation, file format/size, invalid images, unsupported parameters, content policy, user-credit shortage, credit conflicts, provider balance/auth outages, rate limits, timeouts, network failures, media persistence, missing tasks, and unknown failures return stable error codes with a user-facing title, explanation, next action, retryability, and credit-refund status. Provider raw messages stay in server logs; Toasts and My Creations cards never expose provider balances, API credentials, or internal field names. The operational reference is `docs/generation-failure-handling.md`.
- Image generation offers KIE GPT Image 2, Nano Banana 2, and Qwen Image 3.0 Pro. GPT Image 2 uses `gpt-image-2-text-to-image` and `gpt-image-2-image-to-image` with platform credits 1K=2, 2K=3, 4K=5. Nano Banana 2 uses `nano-banana-2` with platform credits 1K=2, 2K=4, 4K=5. Qwen Image 3.0 Pro uses `qwen3/pro-text-to-image` and `qwen3/pro-image-to-image` with platform credits 1K=2 and 2K=4 and accepts up to three input images at 10 MB each. KIE additionally bills Qwen input images at 0.5 API credits per image; the current static Flownana image option price is unchanged by input count and should be monitored before paid-scale validation. Platform image credits are otherwise calculated from KIE API credits multiplied by 0.3 and rounded. All three use KIE `/api/v1/jobs/createTask` and `/api/v1/jobs/recordInfo`. Image aspect ratio options are limited to `auto`, `9:16`, `16:9`, `1:1`, `3:4`, and `4:3`; GPT Image 2 still hides/rejects `auto` except at 1K and hides/rejects `1:1` at 4K, while Qwen Image 3.0 Pro hides/rejects `auto` and only offers 1K/2K.
- older generation history may still contain external provider media URLs; UI attempts to refresh KIE media URLs via `/api/creations/media-url` when direct media loading fails
- generation history display de-duplicates local optimistic items and persisted database rows by `taskId`; image/video result cards use square covers with contained media so non-square generations are shown fully with empty space instead of being cropped
- generation history deletion is available for successful, failed, and unavailable-media items; delete removes the persisted row by `taskId || id` and clears legacy localStorage history keys keyed by either user id or email
- Google sign-in entry points pass the current path as `callbackUrl`; NextAuth redirects preserve same-origin callback URLs instead of forcing auth callbacks back to the homepage
- Non-production environments support a `test-login` NextAuth credentials provider so QA can log in without Google OAuth. It is enabled in local development by default and can be enabled for Vercel preview/test with `ENABLE_TEST_AUTH=true` plus `NEXT_PUBLIC_ENABLE_TEST_AUTH=true`; it is disabled for Vercel production. Local development defaults to a renewable 1,000-credit `test-auth` batch, while Preview sets `TEST_AUTH_CREDITS=0` so subscription QA reflects only paid-plan credits.
- creation pages treat NextAuth `loading` as a distinct state; refresh should not briefly show logged-out CTAs or switch logged-in users from My Creations to Explore while the session is resolving
- `/home`, `/ai-image`, and `/ai-video` wrap their creation UI in a page-level `SessionBoundary` with the server session and server-preload the first creation history batch so My Creations does not wait for client session resolution before showing existing history
- Create, Assets, and My Creations downloads share the authenticated same-origin `/api/creations/download` URL builder using the canonical `creationId` parameter; the API temporarily accepts legacy `id` links and verifies the media URL belongs to the current user's generation. Verified public Vercel Blob outputs redirect to the Blob CDN's `download=1` URL so large files do not pass through a Vercel Function, while legacy third-party media remains proxied as an attachment.
- Successful image and video generations persist display-safe generation parameters in `Generation.parameters`. My Creations opens a responsive, full-screen media detail view that shows the saved prompt, model, mode, aspect ratio, resolution, duration, and audio when available, with only Regenerate, Download, and Delete actions. Older rows fall back to details derivable from `modelOptionId` and explicitly identify settings that were never saved.
- Image and video Regenerate restores the original input image from the generation's input `MediaAsset`; generated output assets are never reused as input media. `Generation.inputUrls` is the legacy fallback. Reusing a saved input asset does not create another Blob copy. Legacy image-to-image or image-to-video rows without a saved input restore the prompt but require the user to upload the original image again.
- Billing summary clients share a 60-second in-memory/localStorage cache and in-flight request dedupe for sidebar credits, pricing, and user menu. The user menu displays email, plan, and remaining credits, and supports editing the user's display name through authenticated `PATCH /api/account/profile`; NextAuth `update()` refreshes the session name after a successful save.
- Video generation platform credits are calculated from the model's KIE API credits multiplied by 0.3 and rounded to the nearest integer unless a model has an explicitly documented exception.
- Video generation UI applies canonical parameter display rules across models: aspect ratio options are capped to `Auto`, `16:9`, `9:16`, `1:1`, `4:3`, and `3:4`; resolution options are capped to `Auto`, `480P`, `720P`, `1080P`, `2K`, and `4K`; unsupported or non-canonical provider values such as `5:4` are not shown. Fixed-duration models show fixed duration buttons, continuous whole-second ranges use the duration slider, and audio-capable models show `Auto`, `On`, and `Off` with `On` selected when switching into that model. Text-to-video `Auto` aspect ratio resolves to a provider-safe `16:9`. Image-to-video requests omit aspect ratio regardless of the UI selection so uploaded image framing drives the output and does not conflict with provider contracts.
- VEO 3.1 video status polling uses KIE `/api/v1/veo/record-info` and parses `successFlag` plus `response.resultUrls`; the synchronous poll window is kept below Vercel's 300s timeout so failures can be persisted and consumed credits refunded.
- Video generation no longer offers VEO 3.1 Lite, VEO 3.1 Fast, VEO 3.1 Quality, Kling 3.0, Kling 3.0 Turbo, Seedance 2, Seedance 2 Mini, Seedance 2 Fast, HappyHorse 1.0, or Bytedance Seedance 1.5 Pro as selectable models.
- Video generation offers MiniMax H3 through KIE `minimax-h3/text-to-video` and `minimax-h3/image-to-video` at 720P and 2K for 4s through 15s. The app's 720P option maps to KIE's `768P` request value/tier. MiniMax image-to-video accepts up to two images: the first is sent as `first_frame_url` and the second as `last_frame_url`. Platform credits are calculated from KIE API credits per second (720P/768P: 18, 2K: 29) multiplied by duration and then by 0.3, rounded to the nearest integer.
- Video generation offers Grok Imagine Video 1.5 through KIE `grok-imagine-video-1-5-preview` at 480P and 720P for 1s through 15s. Grok requires an input image, so it is only exposed when the user has uploaded an image and server-side generation rejects missing image input before consuming credits. Platform credits are calculated from KIE API credits per second (480P: 14.5, 720P: 25) multiplied by duration and then by 0.3, rounded to the nearest integer.
- Video generation offers HappyHorse 1.1 through KIE `happyhorse-1-1/text-to-video` and `happyhorse-1-1/image-to-video`. HappyHorse 1.1 supports every whole second from 3s through 15s at 720P and 1080P. Platform credits are calculated from KIE API credits per second (720P: 22, 1080P: 34) multiplied by duration and then by 0.3, rounded to the nearest integer.
- Active KIE video request bodies are centralized in `lib/kie-video-request.ts` and contract-tested for MiniMax H3, Grok Imagine Video 1.5, and HappyHorse 1.1. MiniMax maps UI 720P to KIE `768P` and uses `first_frame_url` plus optional `last_frame_url`; HappyHorse uses `image_urls`; Grok omits the obsolete `mode` field; image-driven video requests omit `aspect_ratio`.
- Suno music generation is retired. The Audio composer and AI Music navigation/marketing entry points are removed, `/ai-music` and legacy `/create/voice` redirect to `/ai-image`, and `POST /api/suno/generate` returns HTTP 410 with `model_retired`. Existing audio records and assets remain viewable, downloadable, and deletable; Reprompt explains that audio generation is unavailable.
- The `/ai-video` generate button checks NextAuth client session before calling `/api/veo/generate`; logged-out or expired-session users are sent through Google sign-in with `signup_started` source `ai_video_generate` instead of seeing a raw API 401.
- `/ai-video` inserts a local optimistic My Creations card immediately after an authenticated user clicks Generate. The card uses a temporary local id, shows a generating animation while the API request is pending, is replaced with the real `taskId` and media URL on success, and becomes a failed card on generation error. Users can run up to 5 concurrent video generation requests; the Generate button stays available until that active-task limit is reached.
- `/ai-image` inserts a local optimistic My Creations card immediately after an authenticated user clicks Generate. The card shows a generating animation while the API request is pending, is replaced with the real `taskId` and image URL on success, and becomes a failed card on generation error. Users can run up to 5 concurrent image generation requests; the Generate button stays available until that active-task limit is reached. Image pending/generating/processing optimistic cards are not persisted to localStorage because the synchronous image endpoint cannot recover those local-only placeholders after refresh.
- Image inputs reject unsupported formats and enforce the active model's count and size limit before generation: Qwen Image 3.0 Pro allows three images up to 10 MB each, while the other active models allow one or two images as documented and keep the existing 20 MB client cap. New generated media must be persisted to Vercel Blob; storage/download/content-type failures no longer silently save short-lived provider URLs and instead fail clearly with automatic credit refund. Video tasks that remain pending for 45 minutes are marked timed out and refunded on status polling.

## Subscription Plans (as of 2026-08-07)
- Starter: $16 monthly or $96 yearly ($8/month effective), 200 credits/month, 720P output.
- Pro: $48 monthly or $288 yearly ($24/month effective), 800 credits/month, 1080P output.
- Max: $96 monthly or $576 yearly ($48/month effective), 2,400 credits/month, 1080P output.
- Yearly billing is 50% off the monthly rate; yearly credits are still issued monthly and expire 30 days after each grant.
- Checkout retrieves the configured Stripe Price before creating a session and rejects inactive prices or any USD amount/recurring-interval mismatch, preventing displayed pricing from diverging from the actual charge.
- Billing summaries and yearly cron grants resolve entitlements from `stripePriceId` instead of trusting the denormalized stored `planType`, so an unrecognized or misconfigured price cannot display or receive a different tier's credits.
- The configured Stripe account is currently test mode. On 2026-08-07, the six exact current catalog Prices were verified in Stripe and synchronized to Vercel Production/Preview/Development. Legacy two-plan compatibility was intentionally removed before launch; its orphaned database subscription, associated subscription credit batches, linked grant dedupe records, and obsolete $50/$300 Stripe Prices were cleared before the first Preview deployment.

## Subscription Upgrade Rules (as of 2026-08-07)
Allowed upgrade paths (old sub cancelled, new sub starts immediately with first credits):
- starter_monthly → starter_yearly ✅
- starter_monthly → pro_monthly / pro_yearly / max_monthly / max_yearly ✅
- starter_yearly → pro_yearly / max_yearly ✅ (with remaining-month credit coupon)
- pro_monthly → pro_yearly ✅
- pro_monthly → max_monthly ✅
- pro_monthly → max_yearly ✅
- pro_yearly → max_yearly ✅ (with proration credit coupon)
- max_monthly → max_yearly ✅
- max_yearly → (no further upgrade)

Monthly subscribers may move to the same tier yearly or any higher tier monthly/yearly. Yearly subscribers may move only to a higher yearly tier. All yearly-to-higher-yearly upgrades credit the value of unissued remaining months based on the actual current Stripe yearly price. Downgrades are disabled in code; UI directs users to the billing portal.

## Credit Issuance Rules
- First month: granted via webhook `checkout.session.completed` or `invoice.paid`
- Monthly plans: each month's invoice triggers `invoice.paid` → grant credits
- Yearly plans month 2–12: Vercel Cron calls `/api/cron/monthly-credits` daily at 08:00 UTC with `CRON_SECRET`; catch-up loop grants all overdue months in one run if cron was delayed. Each due month uses a unique subscription-and-date grant key, and its dedupe record, credit batch, and `nextCreditAt` update commit in one transaction so retries cannot duplicate credits.
- Each credit batch expires 30 days after grant; consumed FIFO by expiry

## Stripe Subscription Sync Rules
- `customer.subscription.created`, `updated`, `deleted`, `paused`, and `resumed` synchronize the local subscription record, including terminal cancellation state.
- `invoice.payment_failed`, `invoice.payment_action_required`, and `invoice.finalization_failed` retrieve and synchronize the current Stripe subscription state without issuing credits.
- During an upgrade, failure to cancel and synchronize the previous subscription fails the webhook so Stripe can retry; the failure is not silently accepted.
- Checkout return URLs include Stripe's `{CHECKOUT_SESSION_ID}`. The authenticated billing page verifies that the Session is complete, paid, and owned by the signed-in user before showing success; it then idempotently synchronizes the new subscription, cancels the previous subscription for upgrades, and grants the first credit batch. Query-string labels or amounts are never trusted as proof of payment.
- Webhook and return-page credit grants share the same subscription-period dedupe key, so concurrent or repeated completion handling cannot grant credits twice.
- GA4 `purchase_success` hardening remains deferred until GA integration work.

## Schema
- `Subscription.nextPlan` field removed (was unused); migration: 20260407000000_remove_next_plan
- Production Supabase Prisma migration history was baselined on 2026-05-19 via Supabase migration `baseline_prisma_migration_history`; `_prisma_migrations` now records the four local Prisma migrations as applied.
- Generation history has a composite index on `[userId, type, createdAt desc]` for typed My Creations queries; migration: 20260623000000_add_generation_user_type_created_at_index.
- Long-term media management uses `MediaAsset` for user-owned Blob metadata and `GenerationMedia` for ordered input/output task relationships. Migration `20260812090000_add_generation_input_urls` creates both tables, adds the compatibility `Generation.inputUrls` field, and backfills existing generation outputs and any saved inputs without deleting legacy data.

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
- `/home`, `/ai-image`, and `/ai-video` use a compact left creation sidebar for navigation; logged-in users see membership status above credit balance and avatar in the sidebar footer. Free users see `Upgrade` linking to `/pricing`, paid users see their plan label linking to `/account/billing`, and logged-out users see a muted user-avatar button in the sidebar footer that starts sign-in with `signup_started` source `sidebar_avatar`.

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

## Current Preview QA (2026-08-07)
- Stable test URL: `https://flownana-test.vercel.app`, pointing to Preview deployment `dpl_3B5MAJjGCiYAy3BpbND4juSgNbUX` (`READY`). No production deployment was performed.
- Preview-only auth is configured with `ENABLE_TEST_AUTH=true`, `NEXT_PUBLIC_ENABLE_TEST_AUTH=true`, `TEST_AUTH_CREDITS=0`, and `NEXTAUTH_URL=https://flownana-test.vercel.app`; production test auth remains disabled.
- Preview has the six verified Stripe test-mode Starter/Pro/Max Price IDs. Deployment Protection may require the project owner's Vercel sign-in before the URL opens.
- The 2026-08-07 Starter-to-Pro monthly QA transaction exposed that Stripe test-mode webhooks currently target the production domain rather than Preview. The paid Pro subscription was repaired (old Starter canceled, Pro synchronized, 800 Pro credits granted), and Preview return-page verification now completes this initial purchase/upgrade synchronization even when the webhook is routed elsewhere. Recurring invoice events still require the production webhook endpoint after production deployment.

## Current Production (2026-08-07)
- As of 2026-08-12, `https://www.flownana.com` points to Vercel production deployment `dpl_89EksargNEycssYGaPgz7GNpXsP9` (`READY`), which includes long-term `MediaAsset` / `GenerationMedia` management and correct original-input reuse for Regenerate.
- Production Supabase has applied migrations `20260623000000_add_generation_user_type_created_at_index` and `20260807090000_add_generation_parameters`; the composite history index and nullable `Generation.parameters` JSONB column were read-back verified before the application deployment.
- On 2026-08-12, Production Supabase applied and recorded migration `20260812090000_add_generation_input_urls`. Read-back verified `Generation.inputUrls`, `MediaAsset`, `GenerationMedia`, three media indexes, and three foreign keys; 14 existing output URLs from 17 generations were backfilled into 14 assets and 14 task relationships. Existing generations had no previously saved input URLs to backfill. The repository's empty legacy directory `prisma/migrations/20260402053151_init` still blocks normal `prisma migrate deploy` until migration history is repaired, so this migration was executed directly and then marked applied with `prisma migrate resolve`.
- Post-deploy `npm run smoke:prod` passed homepage, AI image/video pages, demo media, authenticated API protection, cron protection, and video-options checks for deployment `dpl_89EksargNEycssYGaPgz7GNpXsP9`.
- Production now runs the checkout-return verification and shared idempotent Stripe completion logic. The configured Stripe account remains in test mode until live-mode keys, Prices, and webhook secret are intentionally provisioned for launch.

## Product Risks / Reality Check
- the active generation offer is image and video; historical audio remains in user libraries but cannot be regenerated
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
