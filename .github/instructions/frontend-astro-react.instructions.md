---
  applyTo: "services/web/**/*.{astro,ts,tsx}"
  description: This file defines engineering standards for Astro + TypeScript React frontend code in services/web.
---

- Keep Astro as the server-first orchestration layer and React components focused on isolated interactive UI only.
- Use strict TypeScript: explicit types at module boundaries, no `any`, no unsafe casts, and narrow unknown data with guards.
- Centralize backend access through existing `src/lib/api/*` patterns; do not fetch backend services directly from browser components.
- Use predictable async UX: every remote request path must model loading, success, and error states with clear user feedback.
- Handle failures explicitly with typed error objects/messages; never swallow errors or silently return empty fallback data.
- Prefer accessible markup by default: semantic elements, keyboard support, visible focus states, and proper labels/ARIA only when needed.
- Keep styling consistent with established frontend patterns; reuse existing tokens/utilities before introducing new CSS approaches.
- Optimize performance: fetch only required data, avoid redundant requests, keep hydration minimal, and defer non-critical client code.
- Preserve maintainability with small, single-purpose components and utilities; extract shared logic instead of duplicating.
- Add or update targeted tests for behavior changes (component rendering, interaction, and data-state handling) using existing test tooling.
- Favor incremental, behavior-safe edits over broad rewrites; keep diffs focused on the requested outcome and avoid unrelated churn.
- Minimize dependencies: prefer built-in platform/framework capabilities and current project libraries before adding new packages.
