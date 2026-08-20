# Media Creation Workspace P0

Status: Approved and implemented baseline  
Scope: `/ai-image`, `/ai-video`, `/ai-music`

## Product direction

Flownana is a media creation workspace inspired by Codex's goal-oriented interaction model, adapted for media deliverables. P0 supports mostly single-turn generation. Projects and autonomous multi-step orchestration are explicitly out of scope.

The durable user deliverable is the generated media asset. The Create stream is recent operational history, not a user-visible session system.

## Information architecture

- One shared workspace across image, video, and audio routes.
- Collapsible desktop sidebar and mobile drawer.
- Primary destinations: Create and Assets.
- New Create clears only the composer draft; it does not clear recent history.
- Create has no top-level media filter. Media filtering belongs in Assets.
- A right details panel is hidden by default and opens only when requested. Create does not show a redundant desktop title/subtitle bar above the stream.

## Create stream

- Mixed image, video, and audio records are displayed in chronological order, with the newest work at the bottom.
- Every submitted Prompt is shown as a right-aligned prompt bubble. Any original input attachment appears directly above the prompt, preserving its aspect ratio.
- A corresponding Result Block appears immediately in a generating state.
- One Prompt maps to one Result Block. A Result Block can contain one to four outputs.
- Image supports one to four outputs in P0. Video and audio support one output.
- The response is lightweight and borderless: English processing status, divider, type-specific inline parameters, generated media, then actions. While generation is active, the stream immediately reserves a proportion-matched result frame animated with the existing Flownana banana-at-sea logo; no visible result-number label is shown. Completed timing is visually secondary. The optional Details panel remains available for the full prompt, inputs, and parameter set.
- A centered conversation timestamp appears before the first run, when the local calendar day changes, or when at least one hour separates adjacent runs. Labels use `Today`, `Yesterday`, or a compact English calendar date plus local time.
- Active records show a live `Processing` timer. New completed and failed records persist processing duration in `Generation.parameters` and show `Processed in` or `Failed after`; legacy records without reliable duration omit the time. Multi-output image runs use the slowest output duration.
- Media uses contained rendering and supports `16:9`, `9:16`, `1:1`, `4:3`, and `3:4` without cropping. A single desktop result is capped near 512px wide and 480px tall; mobile results use the available width while keeping the original aspect ratio.
- Desktop video previews play muted on hover, then pause and reset when the pointer leaves.
- Clicking image, video, or audio opens a focused media viewer.

## Result actions

- Download, Reference, and Delete are lightweight controls in each successful output's top-right corner. They reveal on desktop hover or keyboard focus and remain visible on touch layouts. There is no separate expand control; clicking image or video still opens the focused viewer.
- Reprompt replaces the current draft without confirmation and restores the original prompt, original input asset, model, parameters, and output count where saved. It never auto-submits.
- Download keeps the existing authenticated download endpoint and `result_download_clicked` event.
- Reference adds the output to the current composer draft.
- Delete removes the selected media from Create and Assets while retaining a compact deleted placeholder in the Create record. Unreferenced owned Blob storage is cleaned up; media still referenced by another generation input is retained until it is no longer in use.
- Reprompt, Details, and More form one adjacent action group below the result. The More menu closes on any click outside Remove from recent and on Escape. More → Remove from recent hides the Prompt and Result record from Create without deleting successful media from Assets, including provider-failed and local-only failed runs.

## Composer

- The composer stays at the bottom of Create and contains Image, Video, and Audio generation type controls.
- Model and settings use progressive disclosure.
- The Generate action displays the total estimated credit cost.
- After a valid submission starts, prompt and attachments clear; the current media type and generator settings remain.
- Existing core analytics events remain unchanged; no new event names are introduced.
- Existing task concurrency limit remains five. A multi-image request counts every requested output toward that limit.

### Active model input capability matrix

| Generator | Accepted inputs | Maximum | Notes |
| --- | --- | --- | --- |
| GPT Image 2 | Image | 1 | Input optional |
| Nano Banana 2 | Image | 1 | Input optional |
| Qwen Image 3.0 Pro | Image | 1 | Input optional |
| Seedance 2 Fast | Image | 1 | Input optional |
| MiniMax H3 | Image | 1 | Input optional |
| Grok Imagine Video 1.5 | Image | 1 | Input required |
| HappyHorse 1.1 | Image | 1 | Input optional |
| Suno audio | None | 0 | Prompt and audio settings only |

Video and audio files are not valid composer inputs for the currently active models. Referencing one keeps it visible as incompatible, shows one warning Toast, blocks generation, and offers Remove incompatible. Compatible attachments are never deleted automatically during a generator switch.

## Assets

- Assets contains only successful, undeleted generated outputs.
- Uploaded reference files are not automatically saved as Assets.
- The library is a flat media grid rather than Run grouping.
- P0 filters: All, Images, Videos, Audio.
- P0 utilities: prompt search and Newest/Oldest sorting.
- Reference returns to Create and adds the selected asset to the composer.
- Pending and failed tasks remain visible only in Create.

## Responsive behavior

- Desktop: collapsible sidebar, central workspace, optional right details panel.
- Mobile: top navigation trigger, drawer sidebar, single-column stream, bottom composer, full-screen details surface.
- Required validation widths: 390px and 1440px.

## Explicitly out of scope

- Project and Session management
- Autonomous multi-step media orchestration
- Asset batch operations
- Favorites
- Date and model filters
- Saving uploads as Assets
- Advanced editing tools
