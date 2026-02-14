# Live updates – full codebase analysis

## Flow (vote → live update)

1. **Browser** opens `EventSource(SSE_URL/stream/:pollId)` and listens for `"update"` events.
2. User clicks **Vote** → POST to Next.js ` /api/poll/[id]/vote`.
3. **Vote API** updates DB, then calls `sendPollUpdateToSSE(pollId, summary)`.
4. **lib/sse.ts** POSTs to `SSE_SERVER_URL/notify/:pollId` with Bearer token.
5. **SSE service** receives notify and sends `event: update` to all clients for that `pollId`.
6. **Browser** receives the event, parses JSON, validates with Zod, calls `setPoll` → UI updates.

---

## Issues found and fixes

### 1. Port mismatch (fixed)

- **SSE service** default port was **8000** (`process.env.PORT ?? "8000"`).
- **Frontend** assumes SSE at **5000** (e.g. `next.config` fallback `http://localhost:5000` and common `.env`).
- If you ran the SSE service without `PORT=5000`, it listened on **8000** while the browser connected to **5000** → **no SSE connection** → no client in the map → notify reaches the server but **deliveredTo = 0**.
- **Fix:** SSE service default port changed to **5000** in `sse-service/src/index.ts`.

### 2. Missing or wrong env (frontend)

- **lib/sse.ts** uses `SSE_SERVER_URL` and `SSE_SECRET`. If either is missing, it returns `null` and **no POST is sent** to the SSE service, so no broadcast happens.
- **Fix:** In development, a single `console.error` was added when env is missing so you see: *"[SSE] Not notifying: set SSE_SERVER_URL and SSE_SECRET in .env"*.
- **frontend/.env.example** was added with all required variables. Copy to `.env` and set:
  - `NEXT_PUBLIC_SSE_SERVER_URL=http://localhost:5000` (browser → SSE)
  - `SSE_SERVER_URL=http://localhost:5000` (Next.js server → SSE notify)
  - `SSE_SECRET=...` (same value as in `sse-service/.env`)

### 3. Checklist for your setup

- **sse-service/.env**  
  - `PORT=5000` (or match the URL you use in the frontend).  
  - `SSE_SECRET=...`  
  - `ALLOWED_ORIGIN=http://localhost:3000` (your Next.js dev URL).

- **frontend/.env** (or .env.local)  
  - `NEXT_PUBLIC_SSE_SERVER_URL=http://localhost:5000` (same host:port as SSE service).  
  - `SSE_SERVER_URL=http://localhost:5000` (same).  
  - `SSE_SECRET=` **same string** as in sse-service.  
  - `MONGODB_URI=...`

- **Run order**  
  1. Start SSE service: `cd sse-service && npm run dev` (listens on 5000 by default).  
  2. Start frontend: `cd frontend && npm run dev`.  
  3. Open a poll page; you should see “Live” and, when someone votes, the numbers update without refresh.

---

## File-by-file summary

| File | Role | Status |
|------|------|--------|
| **frontend/app/poll/[id]/page.tsx** | One initial fetch, then EventSource to `NEXT_PUBLIC_SSE_SERVER_URL/stream/:id`, listens for `"update"`, Zod-validates payload, `setPoll`. | OK – no polling; correct event name and payload shape. |
| **frontend/app/api/poll/[id]/vote/route.ts** | Validates body, updates DB, calls `sendPollUpdateToSSE(id, { question, options, totalVotes })`, returns `{ success: true }`. | OK – notify is called with correct data. |
| **frontend/lib/sse.ts** | POSTs to `SSE_SERVER_URL/notify/:pollId` with Bearer `SSE_SECRET`. Returns null if URL or secret missing. | Fixed – dev log when env missing; .env.example added. |
| **sse-service/src/index.ts** | GET `/stream/:pollId` → add client to map, send `connected`. POST `/notify/:pollId` → auth, then `sendSSE(client, "update", payload)` to all clients for that pollId. | Fixed – default PORT set to 5000. |
| **frontend/next.config.ts** | CSP `connect-src` includes SSE origin so the browser can open EventSource. | OK. |

---

## If live updates still don’t work

1. **Terminal where Next.js runs**  
   After a vote, if you see `[SSE] Not notifying: ...`, add or fix `SSE_SERVER_URL` and `SSE_SECRET` in `.env`.

2. **Browser DevTools → Network**  
   - Filter by “EventSource” or “stream”.  
   - Confirm a request to `http://localhost:5000/stream/<pollId>` with status 200 and type “eventsource”.  
   - If it’s missing or fails, the URL/port or CSP is wrong (port fixed; ensure `.env` has `NEXT_PUBLIC_SSE_SERVER_URL=http://localhost:5000`).

3. **Browser DevTools → Console**  
   - Any CSP error about `connect-src` or `localhost:5000` means the page’s CSP is still blocking the SSE origin; `next.config` should allow it as above.

4. **SSE service terminal**  
   - When you open a poll page, you don’t get a log per connection (by design).  
   - When you vote, the notify request is handled; if the EventSource was connected (same pollId, correct port), the client receives the `update` event.

5. **Same machine, one voter**  
   - One vote per IP: after you vote once, the same browser/tab can’t vote again. Open the **same** poll in another device or use a VPN to get a different IP and vote again; the first tab should update via SSE.
