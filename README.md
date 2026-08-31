# Store POS Assessment

## Scenario

You are joining the engineering team at a retail company. Their stores run on tablet-based POS terminals — each store has at least 10 devices showing a live catalog of products, categories, and tags.

Your job is to take ownership of the React Native app and make it production ready and reliable. The previous engineer left the codebase in a state that mostly works in development but has known stability and performance problems in the field. Devices occasionally freeze, the app gets sluggish after a few hours of uptime, and when a store's internet drops for a few minutes things get out of sync.

---

## What's in the current code

1. A functioning backend with seed data. (you dont have to write any code here)
2. A broken react native application.

## Your Task

1. **Find and fix all bugs** in the `mobile/` app.
2. **Complete the missing features** — offline cache, real-time multi-device sync, conflict resolution, and background sync (described below).
3. **Write a `NOTES.md`** in the repo root explaining: what you found, what you fixed, what strategy you chose for conflict resolution, and anything you skipped with a reason.

> Note: please commit code regularly.

---

## Getting Started

### Backend

```bash
cd backend
go run . --seed     # populates 5000 products into store.db, then exits
go run .            # starts the API server on :8080
```

The server exposes a REST API and a WebSocket endpoint at `ws://localhost:8080/ws`.

### Mobile

```bash
cd mobile
npm install # you can use npm or yarn or pnpm or bun
npx expo start # use npx or bunx or npm or yarn or pnpm
```

For a physical device, update `mobile/constants/config.ts` with your machine's local IP.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/products` | Cursor-paginated list (`?after=<cursor>&limit=50`) |
| POST | `/products/:id/bump` | Bump product version; body `{"expected_version": N}` — returns **409** if version doesn't match |
| GET | `/categories` | Full category tree |
| POST | `/categories/:id/bump` | Same conflict-check pattern |
| GET | `/tags` | All tags |
| POST | `/tags/:id/bump` | Same conflict-check pattern |
| POST | `/cart` | `{"action":"add"/"remove"/"update"/"list", "device_id":"...", ...}` |
| POST | `/orders` | Create order from cart — starts in `draft` state |
| GET | `/orders` | List orders (`?device_id=...` optional) |
| POST | `/orders/:id/pay` | Attempt payment — randomly succeeds or fails |
| GET | `/sync` | Changed entities since version N (`?since=<version>`) |
| GET | `/ws` | WebSocket — broadcasts bump events to all connected devices |

### Version bump conflict

When bumping a version, you must send the version you currently hold:

```json
POST /products/42/bump
{ "expected_version": 3 }
```

If the server's current version is different, it returns:

```json
HTTP 409
{ "error": "version_conflict", "current_version": 6 }
```

---

## Features to Implement

### 1 — Offline cache
When the device has no network, the app should load the last known product list from local storage instead of showing an error. When the network returns, silently refresh in the background.

### 2 — Real-time sync
All devices in a store must reflect version bumps within seconds. Use the WebSocket at `/ws` — it broadcasts a JSON event whenever any entity is bumped:

```json
{ "type": "product_bump", "entity_id": 42, "version": 7, "updated_at": "..." }
```

Receiving this event should update the relevant item in local state without a full reload.

### 3 — Conflict resolution
**This is the core challenge.** Consider this scenario:

- Device A holds a product at `version: 3` and bumps it while offline → local state shows `version: 4`
- While Device A is offline, Device B bumps the same product 3 more times → server is now at `version: 6`
- Device A reconnects and tries to push its `version: 4` bump

The server will reject it with a 409. Your app must handle this gracefully. There is no single correct answer — pick a strategy, implement it, and explain your reasoning in `NOTES.md`.

### 4 — Background sync
When the app returns from the background (or the device comes back online), diff local entity versions against `GET /sync?since=<last_known_version>` and apply only the changed entities — no full reload.

---

## Bonus — Native Modules

See `mobile/native/README.md` for two optional native module challenges (Android Kotlin + iOS Objective-C). These test depth of React Native knowledge beyond the JS layer.

---

## Submission

- Push to a public GitHub/Bitbucket repo and share the link
- Include `NOTES.md` in the root — this is as important as the code itself
- Partial submissions are welcome; document what you skipped and why

**Time budget: 4–6 hours.**
