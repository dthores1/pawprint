# Front-End Architecture

A one-page answer to "how is this designed?" Whiskerville is a client-rendered
single-page app: **React 18 + TypeScript**, built with **Vite**, styled with
**Tailwind**, routed with **React Router v6**, backed directly by **Supabase**
(Postgres + RLS, Auth, Storage) — there is no custom API server. See
`README.md` for product logic and `CLAUDE.md` for working conventions.

## Composition

```
index.tsx → App.tsx
  AuthProvider          session, org memberships, currentOrg, currentPersonId
    WhiskerProvider     every entity collection + all CRUD actions
      BrowserRouter
        Gate            splash → landing/login → onboarding → routed app
          AppShell      sidebar + <Outlet/> for pages/*
```

One bundle serves three modes (`lib/appMode.ts`): **production**, **demo**
(`VITE_APP_MODE=demo` — no auth, in-memory seed data, powers the public
portfolio deploy), and the read-only **admin console** (`src/admin`, served
from admin.whiskerville.app). Demo works by swapping the two providers for
`DemoProviders` that expose the *same context API* over seeded state, so every
page renders identically without knowing which mode it's in.

## State: two contexts, no state library

There is no Redux/Zustand/React Query. Server state lives in
**`WhiskerContext`** — a single provider that loads each collection from
Supabase scoped to the current org and exposes it alongside async actions
(`addAnimal`, `placeAnimal`, `claimTransportRequest`, …). Actions are
**optimistic**: update local state, persist, reconcile or refetch on error.
Components never call Supabase directly — the context is the data layer, and
`src/lib/*Api.ts` mappers translate DB rows ↔ the shared TS types (all in
`src/types/index.ts`). Auth/session state lives in **`AuthContext`**.
Page-local UI state is plain `useState`; there's deliberately no global UI
store.

## Scaling: scoped loads + slim indexes + virtualization

Animals and people grow unbounded (10k–20k+ rows), so the app never loads
everything heavy upfront:

- **Heavy collections** (`animals`, `people`) load only the operational subset
  at boot (in-care animals; active contacts). More rows merge in on demand:
  "Show Historical" toggles (`ensureHistoricalLoaded`), profile visits by URL
  (`ensureAnimal(id)`), the Reports page (loads everything).
- **Slim indexes** (`animalsIndex`, `peopleIndex`) hold a thin projection of
  *every* row and serve search, pickers, and name/photo/status lookups.
- All full-table reads page through `fetchAllPages()` (1000-row `.range()`
  loop), so nothing truncates at the PostgREST row cap.
- Long lists render through `@tanstack/react-virtual` (window scroll):
  `VirtualizedGrid` for card grids, `useWindowRowVirtualizer` for tables.

## Multi-tenancy is enforced below the front end

Every table carries `organization_id` with RLS policies gating access to org
members; the app uses the anon key and is fully constrained by them. The
front end just scopes queries to `currentOrg` — even a buggy query can't leak
another tenant's rows. "No data" usually means a membership/RLS issue, not an
empty table.

## Component organization

`src/pages/` holds route-level screens; `src/components/<domain>/` (animals,
clinics, supplies, …) holds feature modals and cards; `src/components/ui/`
holds the primitive kit (Button, Card, Modal, Forms, Avatar, DatePicker,
search pickers). One component per file, named exports, PascalCase. Reused
logic lives in `src/lib/` (pure helpers, permission hooks, status taxonomies).
Design tokens (colors, shadows, fonts, status palette) live in
`tailwind.config.js`; animation is `framer-motion`. Relational fields always
use search-driven typeahead pickers, never `<select>`.

## Cross-cutting concerns

- **Analytics** (`lib/analytics.ts`): PostHog, explicit typed events only,
  fired from component handlers (never inside the context, which demo/view-as
  no-op). Gated to production; properties are ids/enums/counts, never PII.
- **Error reporting** (`lib/errorReporting.ts` + `lib/supabase.ts`): the
  Supabase client's `fetch` is wrapped, so every failed REST/storage mutation
  funnels through one choke point — a global "Something went wrong" toast plus
  a silent insert into `client_error_logs`. No per-call-site error handling.
- **Permissions**: role/grant checks are hooks (`useCanManageFosters`,
  `useCanArchive`, …) that hide UI affordances; the server enforces the same
  rules via RLS, so the UI gating is honesty, not security.

## Notable design decisions

- **Derived, not duplicated**: "in foster" is derived from active placements;
  fosters are a filtered view of `people` (role `foster_parent`), not a table;
  relationship rows are stored one-directional and mirrored at render time.
- **The context API is the stable seam** — Supabase replaced an in-memory
  prototype without rewriting components because `useWhisker()` kept its
  shape; demo mode exploits the same seam.
- **Deletion is soft**: archives go through a Recycle Bin flow rather than
  hard deletes.
