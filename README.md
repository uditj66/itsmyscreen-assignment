# Real-Time Poll Rooms

A full-stack application for creating and voting in polls with **live updates** via Server-Sent Events (SSE). Users sign in with Google, create polls with multiple options, and see vote counts update in real time across all open poll pages.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Pages](#pages)
- [API Routes](#api-routes)
- [SSE Service Endpoints](#sse-service-endpoints)
- [Data Models](#data-models)
- [Edge Cases Handled](#edge-cases-handled)
- [Environment Variables](#environment-variables)
- [Setup & Run](#setup--run)
- [Live Updates Flow](#live-updates-flow)
- [Authentication](#authentication)
- [Fairness Mechanisms (One Vote per Account)](#fairness-mechanisms-one-vote-per-account)
- [Why Not IP- or Cookie-Based Voting?](#why-not-ip--or-cookie-based-voting)
- [What We Could Improve Next](#what-we-could-improve-next)

---

## Architecture Overview

```
┌─────────────────┐     GET /api/poll/:id      ┌──────────────────┐
│                 │ ◄───────────────────────── │                  │
│   Browser       │     POST /api/poll/create  │   Next.js        │
│   (React)       │ ─────────────────────────► │   Frontend       │
│                 │     POST /api/poll/:id/vote                   │
│                 │ ─────────────────────────► │   (Port 3000)    │
│                 │                            │                  │
│                 │     EventSource(/stream/:id)│        │         │
│                 │ ◄───────────────────────── │        │ POST    │
└────────┬────────┘                            └────────┬─────────┘
         │                                               │ /notify/:id
         │ GET /stream/:pollId                           │
         ▼                                               ▼
┌─────────────────┐                            ┌──────────────────┐
│   SSE Service   │ ◄────────────────────────── │   MongoDB        │
│   (Port 5000)   │   Bearer SSE_SECRET         │   (Poll data)    │
└─────────────────┘                            └──────────────────┘
```

- **Frontend (Next.js)**: App Router, API routes, server-side DB access, Google OAuth (NextAuth), and server → SSE notify.
- **SSE Service (Express)**: Standalone Node server that holds open EventSource connections per poll and broadcasts updates when the frontend POSTs to `/notify/:pollId`.
- **MongoDB**: Stores polls (question, options, votes, voter IDs). No polling; live updates are pushed via SSE.

---

## Tech Stack

| Layer        | Technology |
|-------------|------------|
| Frontend    | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui–style components (Card, Button, Input, Progress, Alert), react-hook-form, Zod |
| Auth        | NextAuth.js v4, Google OAuth, JWT sessions (30-day max age) |
| Database    | MongoDB, Mongoose |
| Live updates| Standalone Express SSE service (Node ≥18), CORS, Bearer token auth for notify |

---

## Project Structure

```
itsmyscreen-assignment/
├── frontend/                    # Next.js application
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts   # NextAuth handlers (GET, POST)
│   │   │   └── poll/
│   │   │       ├── create/route.ts          # POST – create poll
│   │   │       └── [id]/
│   │   │           ├── route.ts              # GET – fetch poll by id
│   │   │           └── vote/route.ts         # POST – vote (auth required)
│   │   ├── layout.tsx                        # Root layout, header, AuthStatus
│   │   ├── page.tsx                          # Home – create poll form
│   │   ├── globals.css
│   │   └── poll/
│   │       └── [id]/page.tsx                 # Poll view + vote + SSE client
│   ├── components/
│   │   ├── auth-status.tsx                   # Sign in / user + Sign out
│   │   ├── providers.tsx                     # SessionProvider
│   │   └── ui/                               # Card, Button, Input, Progress, Alert, etc.
│   ├── lib/
│   │   ├── auth.ts                           # NextAuth options (Google, JWT, callbacks)
│   │   ├── db.ts                             # MongoDB connection (cached)
│   │   └── sse.ts                            # sendPollUpdateToSSE() – POST to SSE service
│   ├── models/
│   │   └── Poll.ts                           # Mongoose Poll schema
│   ├── types/
│   │   └── next-auth.d.ts                    # Session.user.id, JWT.id
│   ├── .env.example
│   ├── next.config.ts
│   └── package.json
├── sse-service/                 # Standalone SSE server
│   ├── src/
│   │   ├── index.ts            # Express app: GET /stream/:pollId, POST /notify/:pollId
│   │   └── types.ts            # PollId, ClientSet, NotifyBody
│   ├── .env                    # PORT, SSE_SECRET, ALLOWED_ORIGIN
│   └── package.json
├── LIVE-UPDATES-ANALYSIS.md     # Detailed SSE flow and troubleshooting
└── README.md                    # This file
```

---

## Pages

| Route | File | Description |
|-------|------|-------------|
| **`/`** | `frontend/app/page.tsx` | **Home – Create poll** – Form with question (min 5 chars) and options (min 2, add/remove). Client-side validation via Zod + react-hook-form. On success, redirects to `/poll/:id`. Shows root error (e.g. “Failed to create poll”) from API. |
| **`/poll/[id]`** | `frontend/app/poll/[id]/page.tsx` | **Poll view** – Fetches poll via `GET /api/poll/:id`. Shows question, options with vote counts and progress bars, total votes, “Copy link”. If not signed in: “Sign in with Google to vote”. If signed in and not voted: option buttons + “Submit vote”. If already voted: “You have already voted.” Opens EventSource to `NEXT_PUBLIC_SSE_SERVER_URL/stream/:id` for live updates (when URL is set); shows “Live” indicator. Handles 401 (sign in), 409 (already voted), and network errors. |

**Layout (all pages):** `app/layout.tsx` – Root layout with Geist fonts, global styles, header (“Poll Rooms” link + `AuthStatus`), and `Providers` (NextAuth `SessionProvider`).

---

## API Routes

All under `frontend/app/api/`.

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| **GET**  | `/api/auth/*` | NextAuth | NextAuth catch-all (sign in, sign out, callbacks, session). |
| **POST** | `/api/auth/*` | NextAuth | Same. |
| **POST** | `/api/poll/create` | `app/api/poll/create/route.ts` | Create poll. Body: `{ question: string, options: string[] }`. Validates: question trimmed, min 5 chars; options array min 2 items, each non-empty trimmed string. Returns `{ success: true, data: { id, question, options, createdAt, updatedAt } }`. 400 on validation error, 503 if DB unavailable, 500 on server error. |
| **GET**  | `/api/poll/[id]` | `app/api/poll/[id]/route.ts` | Get poll by ID. If user is signed in (JWT), includes `hasVoted` by checking `voterUserIds`. Returns `{ success: true, data: PollData }` or error. 400 invalid id, 404 not found, 503 DB unavailable, 500 on error. |
| **POST** | `/api/poll/[id]/vote` | `app/api/poll/[id]/vote/route.ts` | Vote for option. **Requires auth** (401 if not signed in). Body: `{ optionIndex: number }` (integer ≥ 0). Validates poll exists and `optionIndex < options.length`. Uses atomic `findOneAndUpdate` with `voterUserIds: { $ne: userId }` so one vote per user (409 if already voted). Then calls `sendPollUpdateToSSE()` to push update to SSE service. Returns `{ success: true }` or 400/404/409/500. |

---

## SSE Service Endpoints

Run on port **5000** by default (`sse-service`).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| **GET**  | `/stream/:pollId` | None | Opens SSE stream for that poll. Sets `Content-Type: text/event-stream`, sends `event: connected` with `{ pollId }`. Client is added to in-memory set for `pollId`. On request close, client is removed. |
| **POST** | `/notify/:pollId` | `Authorization: Bearer <SSE_SECRET>` | Body: `{ question, options, totalVotes }`. If token ≠ `SSE_SECRET` → 401. Sends `event: update` with JSON payload to all clients for that `pollId`. Responds with `{ success: true, deliveredTo: number }`. 400 if `pollId` missing. |

---

## Data Models

**Poll (Mongoose)** – `frontend/models/Poll.ts`

| Field | Type | Notes |
|-------|------|-------|
| `question` | String | Required, minlength 5 |
| `options` | Array | `{ text: String, votes: Number }`, required, min 2 items |
| `voterUserIds` | [String] | Default `[]`, `select: false` (only used server-side to enforce one vote per user) |
| `createdAt` / `updatedAt` | Date | From `timestamps: true` |

`hasVoted` is not stored; it is computed in GET `/api/poll/[id]` when a user is authenticated by checking if their `userId` (Google `sub`) is in `voterUserIds`.

---

## Edge Cases Handled

### Create poll (Home)

- **Empty or short question:** Zod requires min 1 then trim then min 5 characters → “Question must be at least 5 characters”.
- **Empty options:** Each option trimmed and must be non-empty; array must have at least 2 options.
- **Minimum options:** Cannot remove an option when only 2 remain (button disabled).
- **Duplicate options:** Allowed by backend; frontend does not deduplicate.
- **API errors:** Non-OK response shows `json.message` or “Failed to create poll.” in form.
- **Missing redirect id:** If API returns success but no `data.id`, shows “Failed to create poll.”

### Get poll (`/poll/[id]`)

- **Missing or invalid `id`:** API returns 400 “Invalid poll ID.” or 404 “Poll not found.” → error card.
- **DB unavailable:** 503 “Database unavailable.” → error card.
- **Unauthenticated:** Poll still returned; `hasVoted` omitted (UI shows “Sign in to vote”).
- **Authenticated:** `hasVoted` included so UI shows “You have already voted” or vote buttons.

### Vote

- **Not signed in:** 401 “Sign in with Google to vote.” → shown in poll card; Sign in button available.
- **Invalid poll id / poll not found:** 400 or 404 with message.
- **Invalid body:** `optionIndex` must be integer ≥ 0 → 400 “Invalid option index.”
- **optionIndex out of range:** `optionIndex >= options.length` → 400 “Invalid option index.”
- **Already voted:** Atomic update with `voterUserIds: { $ne: userId }`; if no document updated → 409 “You have already voted.” UI sets `hasVoted` and clears error.
- **Race (e.g. two tabs):** Same atomic condition prevents double vote; second request gets 409.
- **DB down:** 503 before or during vote.

### Live updates (SSE)

- **No `NEXT_PUBLIC_SSE_SERVER_URL`:** EventSource not opened; no “Live” indicator; poll still works without live updates.
- **Invalid SSE payload:** Poll page uses Zod `ssePayloadSchema.safeParse`; invalid events ignored.
- **EventSource error:** `onerror` closes the connection (no automatic reconnect in current code).
- **Missing `SSE_SERVER_URL` or `SSE_SECRET` (frontend):** `sendPollUpdateToSSE` returns without POSTing; vote still saved but no broadcast (see LIVE-UPDATES-ANALYSIS.md for dev logging).
- **Notify auth failure:** SSE service returns 401 if Bearer token does not match `SSE_SECRET`.

### Auth

- **Session loading:** `AuthStatus` shows loading skeleton until session is resolved.
- **Sign-in redirect:** After Google sign-in, returns to current page (e.g. poll URL) via `callbackUrl`.

### General

- **MongoDB connection:** Cached in `lib/db.ts` (global in dev) to avoid repeated connections.
- **Poll id from route:** `params.id` normalized to string (array segments handled).
- **Copy link:** Clipboard API failure leaves “Copy link” state (no toast).
- **Plurals:** “1 vote” vs “N votes” in UI.

---

## Environment Variables

### Frontend (`frontend/.env`)

Copy from `frontend/.env.example`.

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string (e.g. `mongodb://localhost:27017/poll-rooms`) |
| `NEXT_PUBLIC_SSE_SERVER_URL` | For live updates | SSE base URL for browser (e.g. `http://localhost:5000`) |
| `SSE_SERVER_URL` | For live updates | Same base URL for Next.js server to call `/notify/:pollId` |
| `SSE_SECRET` | For live updates | Shared secret with SSE service; must match `sse-service/.env` |
| `AUTH_SECRET` | Yes (for auth) | NextAuth secret (e.g. `openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` | Yes (for auth) | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes (for auth) | Google OAuth client secret |

### SSE Service (`sse-service/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No (default 5000) | Port the SSE service listens on |
| `SSE_SECRET` | Yes | Must match frontend `SSE_SECRET` for `/notify` |
| `ALLOWED_ORIGIN` | No (default `*`) | CORS origin (e.g. `http://localhost:3000`) |

---

## Setup & Run

1. **MongoDB**  
   Have MongoDB running and set `MONGODB_URI` in `frontend/.env`.

2. **Frontend**
   ```bash
   cd frontend
   cp .env.example .env
   # Edit .env: MONGODB_URI, AUTH_*, SSE_*, NEXT_PUBLIC_SSE_SERVER_URL
   npm install
   npm run dev
   ```
   App: [http://localhost:3000](http://localhost:3000).

3. **SSE service** (for live updates)
   ```bash
   cd sse-service
   # Create .env: PORT=5000, SSE_SECRET=<same as frontend>, ALLOWED_ORIGIN=http://localhost:3000
   npm install
   npm run dev
   ```
   Listens on port 5000.

4. **Run order**  
   Start SSE service first, then frontend. Open a poll page; when someone votes, counts update without refresh (if env and CORS are correct).

---

## Live Updates Flow

1. Browser opens `EventSource(NEXT_PUBLIC_SSE_SERVER_URL/stream/:pollId)` and subscribes to `"update"` events.
2. User votes → `POST /api/poll/:id/vote` → Next.js updates MongoDB (atomic one-vote-per-user) and calls `sendPollUpdateToSSE(pollId, summary)`.
3. `lib/sse.ts` POSTs to `SSE_SERVER_URL/notify/:pollId` with `Authorization: Bearer SSE_SECRET` and `{ question, options, totalVotes }`.
4. SSE service receives notify, validates Bearer token, and sends `event: update` with JSON to all clients for that `pollId`.
5. Poll page receives event, parses JSON, validates with Zod, updates state → UI re-renders with new counts.

Details and troubleshooting: see **LIVE-UPDATES-ANALYSIS.md**.

---

## Authentication

- **Provider:** Google OAuth via NextAuth (NextAuth.js v4).
- **Session:** JWT, 30-day max age. No database session store.
- **Identity:** Google `sub` is stored in JWT as `token.id` and exposed as `session.user.id`; used as stable user id for `voterUserIds` (one vote per user across devices).
- **Routes:** No middleware; pages that need auth (e.g. vote) check session or token in API and return 401 if missing.
- **Sign-in page:** Custom `signIn: "/"` so sign-in UI is the home page.

---

## Fairness Mechanisms (One Vote per Account)

The app enforces **one vote per account** and prevents abuse (e.g. voting from the same account on two devices at once) using two mechanisms:

### 1. Authentication-based identity

- Voting is **gated behind sign-in**: `POST /api/poll/[id]/vote` uses NextAuth’s JWT (`getToken`). If the user is not signed in, the API returns **401** and the UI prompts “Sign in with Google to vote.”
- **Stable user ID:** The Google OAuth `sub` is stored in the JWT as `token.id` and exposed as `session.user.id`. This ID is used as the voter identity and stored in the poll’s `voterUserIds` array.
- Because identity is tied to the **Google account**, one person has one identity across devices and browsers. They cannot get a second vote by switching devices or browsers without using another Google account.

### 2. Race-condition handling (same account, two devices/tabs)

- Even with auth, the same user could open the poll in two tabs or on two devices and click “Vote” at nearly the same time. Without care, both requests could pass the “not voted yet” check and both could be recorded.
- The vote is applied with a **single atomic MongoDB update**: `findOneAndUpdate` with a condition that the poll’s `voterUserIds` does **not** already contain the current `userId`. The update both appends `userId` to `voterUserIds` and increments the chosen option’s vote count in one operation.
- If two requests from the same user run concurrently, only one update matches the condition and succeeds; the other finds no document to update (user already in `voterUserIds`) and the API returns **409 “You have already voted.”** So duplicate votes from the same account are prevented even under race conditions.

---

## Why Not IP- or Cookie-Based Voting?

Alternatives like **hashing IP** or **using cookies** to limit votes are simpler but have serious drawbacks. We use auth + server-side `voterUserIds` instead.

### Limitations of IP-based methods (e.g. hashing IP)

- **Same network, different people:** Many users can share one IP (home WiFi, office, school). If “one vote per IP,” only the first voter from that network can vote; others see “already voted” even though they are different people.
- **Same person, different IP (VPN / mobile):** One user can vote once from home, then use a VPN or switch to mobile data and vote again. So IP-based limiting is both unfair (blocks legitimate users) and easy to bypass (VPN/different network).

### Limitations of cookie-based methods

- **Deleting cookies:** A user can clear cookies (or use incognito) and vote again; the server sees a “new” visitor and allows a second vote.
- **Different browser or device:** Cookies are per-browser (and per-device). The same person can vote once in Chrome and again in Firefox, or on phone and laptop, and get multiple votes.

So cookie- and IP-based approaches either block legitimate voters (same WiFi) or fail to stop one person from voting multiple times (VPN, clear cookies, different browser). Using **authentication (Google account)** plus **atomic server-side checks** gives one stable identity per person and prevents double-voting even when the same account is used from multiple devices or tabs.

---

## What We Could Improve Next

- **SSE reconnection:** Automatically reconnect the EventSource when the connection drops so live updates keep working after a short network glitch.
- **Copy-link feedback:** Show a short toast or message when “Copy link” succeeds (or fails) so the user knows the link was copied.
- **Close poll:** Let the poll creator close a poll (e.g. a “Close poll” button) so no new votes can be cast and the UI shows “Poll closed.”

---

## Quick Reference – All Routes & Pages

| Type | Method | Path | Purpose |
|------|--------|------|---------|
| Page | GET | `/` | Create poll form |
| Page | GET | `/poll/[id]` | View poll, vote, live updates |
| API | GET/POST | `/api/auth/*` | NextAuth |
| API | POST | `/api/poll/create` | Create poll |
| API | GET | `/api/poll/[id]` | Get poll (+ hasVoted if authenticated) |
| API | POST | `/api/poll/[id]/vote` | Vote (auth required, one per user) |
| SSE | GET | `/stream/:pollId` | Subscribe to live updates for poll |
| SSE | POST | `/notify/:pollId` | Notify all subscribers (Bearer token) |

This README and **LIVE-UPDATES-ANALYSIS.md** together document the project, edge cases, and all routes and pages for anyone who wants to understand or extend the application.
