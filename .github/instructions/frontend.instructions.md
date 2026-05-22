---
applyTo: "services/web/src/**/*.{astro,ts,tsx}"
---

- Keep Astro as the composition layer and React components focused on interactive UI only; move reusable logic into `src/lib` helpers/hooks instead of duplicating behavior in page/component files.
- Use strict TypeScript patterns: explicit domain types for API data, `unknown` + narrowing at boundaries, no `any`, no unsafe casts, and exhaustiveness checks for discriminated unions.
- Prefer server-side data fetching in Astro routes/pages for initial render; keep client-side fetches for user-driven interactions and avoid duplicate requests across server/client boundaries.
- Treat API integration via shared client utilities in `src/lib/api/*`; centralize URL/headers/error mapping and avoid ad-hoc `fetch` calls in many components.
- Always render explicit loading, empty, and error states for async UI paths; show actionable error text and avoid silent failures or infinite spinners.
- Build accessible UI by default: semantic HTML first, keyboard-operable controls, visible focus styles, labels for form fields, and `aria-*` only when native semantics are insufficient.
- Keep styling consistent with existing frontend patterns (tokens/utilities/components already in use); avoid one-off inline style logic when a shared style pattern exists.
- Optimize rendering and bundle size: minimize client hydration scope (`client:*` only where needed), avoid unnecessary state, memoize only when it measurably reduces re-renders, and remove dead code.
- Write/maintain tests for meaningful behavior changes (component states, API adapters, utilities); prefer deterministic tests and avoid brittle snapshot-only coverage.
- Make incremental, low-risk edits: preserve existing behavior unless intentionally changed, keep modules small and cohesive, document non-obvious decisions briefly in code, and avoid adding new dependencies unless clearly justified.
