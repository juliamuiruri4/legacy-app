# Delegation brief — test backfill (Playwright + xUnit + pytest)

## Primary goal

Expand the Playwright accessibility and happy-path coverage started in the session
that added `tests/playwright/assets.spec.ts`, `employees.spec.ts`, and
`accessibility.spec.ts`. Keep every new locator using role, label, or text
strategies (`getByRole`, `getByLabel`, `getByText`). Avoid CSS selectors unless
there is no accessible alternative.

Work only inside:

- `tests/playwright/**/*.ts`
- `services/web/src/**/*.astro`
- `services/web/src/**/*.tsx`
- `services/web/src/**/*.ts`
- `services/web/src/**/*.css`

Do **not** change backend services, database code, routing, or page titles.

---

## Secondary goal — backend unit test backfill

### services/assets-svc (xUnit, .NET 8)

The existing test project is at `services/assets-svc/Tests/AssetsService.Tests.csproj`.
It already uses xUnit and `Microsoft.AspNetCore.Mvc.Testing`; no new framework
dependencies are needed. Add tests in new `.cs` files in that project — do **not**
edit `SmokeTests.cs` or `AssetsDbTests.cs`.

Cover the following against a real in-memory or temp-file SQLite database
(follow the pattern in `AssetsDbTests.cs` — construct `AssetsDb` with a
`Path.GetTempPath()` path and call `Initialize()` before each test):

| Area | Cases to add |
|---|---|
| **Create** | happy path (returns 201 + `id`); missing required field returns 400 |
| **Read** | `GET /assets/{id}` returns correct asset; unknown id returns 404 |
| **Update** | `PUT /assets/{id}` persists changes; unknown id returns 404 |
| **Delete** | `DELETE /assets/{id}` removes the row; unknown id returns 404 |
| **Search** | `GET /assets?status=available` filters correctly; `q=` matches tag/manufacturer/model; combined filters narrow results |
| **Stats by status** | `GET /assets/stats/by-status` returns a count per status key |

Run command:
```bash
dotnet test services/assets-svc/Tests/AssetsService.Tests.csproj
```

### services/reporting-svc (pytest, Python)

No test files exist yet. Create `services/reporting-svc/tests/` and add focused
unit tests using `pytest` and `httpx` (both already implied by the service's
`pyproject.toml` / setup). Mock outbound HTTP calls with `respx` or
`unittest.mock` — do **not** spin up real backend services.

Cover:

| Area | Cases to add |
|---|---|
| **`GET /reports/warranty-expiring`** | asset expiring within window is included; asset outside window is excluded; asset with no `warrantyExpiry` is skipped; `within_days` param changes the cutoff; assets-svc 502 propagates as HTTP 502 |
| **`GET /reports/utilization`** | returns correct `utilization_pct` (in_use/total × 100); zero total returns 0.0 (no division-by-zero); assets-svc 502 propagates as HTTP 502 |
| **`POST /imports/assets`** | valid CSV creates all rows; missing required column returns 400; CSV with no rows succeeds with empty result |

Run command:
```bash
cd services/reporting-svc && pytest
```

---

## Cross-cutting constraints

- **Do not change production backend behavior.** Small frontend markup and
  accessibility fixes are allowed when required for role/label-based tests. If a
  real backend production bug blocks a test, document it in the PR description
  under a "Known production bugs" heading instead of fixing it.
- **Do not add new backend framework dependencies** unless they are strictly
  required by the test framework already implied by the service (xUnit for .NET,
  pytest + httpx for Python).
- **Prefer isolated test data and temporary SQLite databases.** Each xUnit test
  class should create its own `Guid`-named temp file and delete it in a `finally`
  block (see `AssetsDbTests.cs` for the pattern). Each pytest test should use
  fixture-scoped mock data.
- **Include exact commands and results in the PR description.** Copy the full
  terminal output from `dotnet test` and `pytest` into the Test evidence block of
  the PR.

---

## What is already covered (Playwright)

| Spec file | Describe blocks |
|---|---|
| `smoke.spec.ts` | Navigation — title, navbar links, Assets and Employees route changes |
| `assets.spec.ts` | Assets list happy path (columns, row count, New asset link); badge color contracts for all four statuses (Exercise #8); Add asset form (heading, buttons, all labels via `getByLabel`, Cancel link) |
| `employees.spec.ts` | Employees list happy path (columns, row count, detail links, Department + Active-only filter labels, Filter button URL update) |
| `accessibility.spec.ts` | Dashboard landmarks (`navigation`, `main`, `contentinfo`); active `aria-current=page` for Dashboard, Assets, Employees links; negative case (inactive links have no `aria-current`); asset form all-labels check; asset list filter labels + Type filter URL update; keyboard focus + Enter on Assets navbar link; keyboard focus + Enter on New asset link |

---

## What still needs coverage

Work through the items below in order. Open one focused `test.describe` block per
area and add it to the most relevant existing spec file, or create a new spec file
if the area is clearly separate.

### 1 — Dashboard cards (accessibility.spec.ts or new dashboard.spec.ts)

- Each summary card (`Total assets`, `Employees`, `Utilization`, `Lost / retired`)
  is rendered as a link (`<a>`). Verify each is reachable with
  `getByRole("link", { name: /Total assets/i })` (or the visible text).
- Verify the "Assets by status" list items are links that carry the status in their
  accessible name or visible text (e.g. `getByRole("link", { name: /available/i })`).

### 2 — Asset detail page (new assets-detail.spec.ts)

- Navigate to `/assets/1` (or any id known to exist; the table row link from the
  list test is a reliable source). Verify:
  - Page has a `heading` with the asset tag text.
  - Landmarks: `navigation`, `main`, `contentinfo` present.
  - `aria-current=page` is on the Assets nav link (path starts with `/assets`).

### 3 — Employees detail page (employees.spec.ts or new file)

- Navigate via the first row link found in the employees table (reuse the locator
  from the existing row-link test). Verify:
  - Page has a `heading`.
  - Landmarks present.
  - `aria-current=page` on the Employees nav link.

### 4 — Asset list — filter round-trip (assets.spec.ts)

- Select `Status = available` and click Filter; assert URL contains
  `status=available` and all visible badges match `getByRole("table").getByText("available")`.
- Enter a search term in the `Search tag / manufacturer / model` field, click
  Filter, assert URL contains `q=<term>`.
- Click the `Clear` link (visible when filters are active); assert URL is exactly
  `/assets`.

### 5 — Add asset form — keyboard tab order (accessibility.spec.ts)

- On `/assets/new`, `Tab` through all labelled controls and confirm each receives
  focus in visible order. At minimum verify:
  `Asset tag` → `Type` → `Manufacturer` → `Model` → `Serial number` → `Status`.
- Confirm the `Create` button is reachable by keyboard and carries the `button` role
  (not a link).

### 6 — Assignments and Reports pages (new assignments.spec.ts / reports.spec.ts)

- Verify the pages load (no unhandled error, correct heading visible).
- Verify landmarks and `aria-current` on their respective nav links.
- If service back-ends are unreachable, the page should show an accessible warning
  (`getByRole("alert")` or `getByRole("status")`); test that the warning is visible
  rather than a blank page.

---

## Locator rules

- **Always prefer** `getByRole`, `getByLabel`, `getByText` over CSS or XPath.
- When scoping within a table, chain off `page.getByRole("table")` so that filter
  `<option>` elements are not matched by `getByText`.
- Use `{ exact: false }` or a regex only when the visible text includes dynamic
  values (counts, dates).
- Do **not** use `page.locator("css=…")` or `page.$(".class")`.

---

## Running the tests

```bash
npm run test:e2e          # headless — webServer config starts the app automatically
npm run test:e2e:ui       # interactive UI mode
```

The `webServer` block in `playwright.config.ts` runs `npm run dev` (the full
polyglot stack) and waits for port 4321 before launching browsers.
`reuseExistingServer` is `true` outside CI, so a running dev server is reused.

---

## Validation checklist before opening a PR

- [ ] `npm run test:e2e` passes with zero failures.
- [ ] No CSS selector locators introduced.
- [ ] No changes outside `tests/playwright/` and `services/web/src/`.
- [ ] Each new `test.describe` has a name that makes the area clear in the report.
