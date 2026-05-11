# Test plan — PR #3 (GitHub Pages + Fly.io production setup)

## What changed
- Frontend now supports static export for GitHub Pages: `STATIC_EXPORT=1` →
  `output:'export'` + `basePath:'/match57'` + `assetPrefix` + `trailingSlash`.
- Dynamic routes that are incompatible with static export were rewritten:
  `/chats/[id]` → `/chat?id=N`, `/admin/users/[id]` → `/admin/user?id=N`.
- API client (`lib/api.ts`), media URLs (`lib/media.ts`), and WebSocket URL
  (`RealtimeProvider.tsx`) are now driven by `NEXT_PUBLIC_API_BASE`.
- Backend gained `COOKIE_SAMESITE` / `COOKIE_SECURE` / `FRONTEND_ORIGINS` env
  knobs for cross-origin cookies (GH Pages ↔ Fly.io).

## Threat model — what would look identical if broken?
- A vanilla `npm run build` (without `STATIC_EXPORT=1`) would produce a working
  Next.js dev server bundle but **no `out/` directory**, no basePath in URLs.
  Test must serve the **`out/` artifact** directly to prove static export.
- If the routing refactor is broken, `/chat?id=N` would 404 on the static host
  or hydrate into the wrong page. Test must hard-refresh the deep link.
- If `NEXT_PUBLIC_API_BASE` plumbing is broken, the frontend would call the
  static host's `/api/*` (404) instead of the backend. Test must prove a
  successful backend round-trip from a different origin.
- If WS URL derivation is broken, realtime events would never arrive. Test
  must verify a message goes out from one tab and lands in another within ~1s
  without any HTTP refresh.

## Setup (already done by Devin before recording starts)
- Backend running on `http://localhost:8000` with env:
  - `FRONTEND_ORIGINS=http://localhost:4000`
  - `PUBLIC_BASE_URL=http://localhost:4000/match57`
  - `COOKIE_SAMESITE=lax` / `COOKIE_SECURE=0` (localhost is same-site →
    cookies still flow on credentialed XHR cross-port)
  - `SESSION_SECRET=<random>`
- Frontend built with `STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/match57
  NEXT_PUBLIC_API_BASE=http://localhost:8000 npm run build`
- Static `out/` served on `http://localhost:4000` via `npx serve out -p 4000`
  (so the app is reachable at `http://localhost:4000/match57/`)

## Primary flow

### Test 1 — App loads from static export at `/match57/`
- **Action:** Navigate to `http://localhost:4000/match57/`.
- **Expected:**
  - HTTP 200; landing page renders with heading "MATCH 57".
  - DevTools Network: `_next/static/...` assets all loaded from
    `http://localhost:4000/match57/_next/...` (basePath applied).
  - DevTools Network: `manifest.json` requested at
    `http://localhost:4000/match57/manifest.json` (200, not 404).
- **Would-be-broken signal:** any 404 on `_next/static`, broken layout, or
  manifest 404 → basePath wiring is wrong.

### Test 2 — Cross-origin auth round-trip works
- **Action:** Click "Регистрация", fill the wizard for user **A** (email:
  `a-test@match57.local`, password: `Pass1234!`, name "Anna", age 17, gender
  female, looking for any), submit.
- **Expected:**
  - DevTools Network: `POST http://localhost:8000/api/auth/register` returns
    200 with `Set-Cookie: match57_session=...; SameSite=Lax; HttpOnly; Path=/`.
  - Browser navigates into the authed app (BottomNav visible).
  - Backend stdout shows `🔗 Email verification link: http://localhost:4000/match57/verify-email?token=...`.
- **Would-be-broken signal:** CORS error, `Failed to fetch`, or login redirect
  loop → CORS / cookie / API_BASE wiring is wrong.

### Test 3 — Email verify deep link works
- **Action:** Copy the verify link from backend stdout, open it in the same
  tab.
- **Expected:** `/verify-email?token=...` page renders, then shows
  "Email подтверждён" within 2s. Top profile widget no longer shows
  "email не подтверждён".
- **Would-be-broken signal:** 404 on the path → deep linking with basePath is
  wrong.

### Test 4 — Routing refactor: chat opens via query string
- **Setup:** Repeat Test 2 in **incognito tab** to register user **B** (email
  `b-test@match57.local`, password `Pass1234!`, name "Boris", age 18, gender
  male, looking for any).
- **Action:** In tab A, go to `/swipe`, swipe right (👍) on Boris. In tab B,
  go to `/likes`, click the "Лайкнуть в ответ" button on Anna's card.
- **Expected:** Tab B navigates to `http://localhost:4000/match57/chat/?id=N`
  (note the `?id=` query string — NOT `/chats/N`). Conversation header shows
  "Anna". Message composer is visible.
- **Would-be-broken signal:** redirect to `/chats` (NaN id), 404, blank page,
  or URL like `/chats/N/` → query-string routing refactor is broken.

### Test 5 — Realtime message + reaction
- **Action:** In tab B's chat, type "привет" and hit send. Switch to tab A,
  open `/matches`, click "Открыть чат" → ends up at `/chat?id=N`.
- **Expected:**
  - The message "привет" is already in tab A's history (delivered via WS,
    not via reload).
  - DevTools Network in tab A shows a **WebSocket** connection to
    `ws://localhost:8000/api/ws` (status 101 Switching Protocols).
- **Action:** Tab A double-taps the message bubble and adds a 👍 reaction.
- **Expected:** Within 1s, tab B's bubble shows `👍 1` without any HTTP page
  reload (WS `reaction` event).
- **Would-be-broken signal:** Either tab requires F5 to see the change → WS
  is broken, or WS connects to `localhost:4000` (frontend host) → URL
  derivation from `NEXT_PUBLIC_API_BASE` is broken.

### Test 6 — SPA fallback / hard refresh on deep link
- **Action:** In tab A, with the chat open at `/match57/chat/?id=N`, press
  F5.
- **Expected:** Same chat re-loads (no 404, no blank index, no redirect to
  landing). `serve` returns 200 because static export pre-renders
  `out/chat/index.html`.
- **Would-be-broken signal:** 404 page, or redirect to `/match57/` landing →
  static export didn't pre-render the chat route.

## Secondary check — admin/user query-string route
- **Action:** SQL-edit one of the two test users to `is_admin=1` (`sqlite3
  data/match57.db "UPDATE users SET is_admin=1 WHERE id=1"`), reload as
  admin, navigate to `/admin/users`, click any row.
- **Expected:** URL becomes `/match57/admin/user/?id=N`. Page shows that
  user's profile, stats, ban controls.
- **Would-be-broken signal:** 404 or routing to `/admin/users/N` → admin
  detail page wasn't refactored.

## Pass criteria
All six tests pass. If any fails, the test report will mark it as failed and
explain what was observed vs expected.
