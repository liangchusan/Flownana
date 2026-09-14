# Self-hosted fonts

Inter (normal variable weight 400–600) and JetBrains Mono (normal 400) retain
the previous Google Fonts families, subsets and `font-display: swap` behavior.
The application serves these WOFF2 assets locally; runtime rendering no longer
requests fonts.googleapis.com or fonts.gstatic.com.

Downloaded 2026-09-14 from the Google Fonts CSS API:
https://fonts.googleapis.com/css2?family=Inter:wght@400..600&family=JetBrains+Mono:wght@400&display=swap

Font URLs returned by that API used `fonts.gstatic.com/s/inter/v20/` and
`fonts.gstatic.com/s/jetbrainsmono/v24/`. Subset mapping and unicode ranges are
recorded in `app/fonts.css`. The latin Inter subset is preloaded; other subsets
are loaded by the browser only when needed.

Both families are licensed under the SIL Open Font License. The accompanying
`Inter-OFL.txt` and `JetBrains-Mono-OFL.txt` are copied from the Google Fonts
repository's `ofl/inter/OFL.txt` and `ofl/jetbrainsmono/OFL.txt` respectively.
