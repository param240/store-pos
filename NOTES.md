# Store POS Assignment - Notes

Notes on what I found in the mobile app, what I changed, and the reasoning
behind it. I'll keep adding to this as I work through the bugs and features.

## Bug fixes

### Product list performance

The product screen renders the whole ~5000 item catalog through a Flatlist and
it was janky while scrolling. Fixes in `mobile/app/(tabs)/index.tsx` and
`mobile/components/ProductCard.tsx`:

- Added a keyExtractor. Without it the list falls back to the array index, so
  views get recycled onto the wrong items while scrolling.
- Pulled the inline renderItem out into its own callback.
- Wrapped ProductCard in memo so a row only re-renders when its own data
  changes instead of on every list render.
- Made the onPress/renderItem handlers stable with useCallback. Without this
  the memo is pointless, since every render would hand the card a new function.
- Gave the Flatlist some render-window settings (initialNumToRender,
  maxToRenderPerBatch, windowSize, removeClippedSubviews) so it isn't mounting
  the entire catalog upfront.
- Removed a module-level Map in ProductCard that cached an image url per product
  and never released it - it grew one entry per product for the whole session.
  The url is just derived from the id, so there was nothing to cache.

### Cart type wasn't imported

`services/api.ts` used the `Cart` type in `cartAction` but only re-exported it
at the bottom, so it was a type error. Added `Cart` to the top import.

### Search was hitting a search endpoint that doesn't exist

`SearchBar` was calling `/products?search=...`, but the backend ignores that
param and just returns the first 20 products by id. So search always showed the
same wrong 20 results. Since the backend is no handling the filtering, I moved search to the
client (see Features). Removed the unused `searchProducts` from the api client.

### Pagination was silently skipping products

While loading the full catalog I noticed I was only getting 4976 of 5000
products. The backend sets `next_cursor` to the row *after* the last one it
returns, and its next query is `id > cursor`, so that row gets skipped - one
product lost per page. I can't change the backend, but every product already
carries its own `cursor`, so I page using the last returned item's cursor
instead of trusting `next_cursor` (I only use `next_cursor` to know if there's
more). That gets all 5000.

### Sync poller was leaking timers

`useSyncPoller` never cleared its `setInterval` and re-ran on every
`sinceVersion` change, so intervals stacked up over time (a likely cause of the
app going sluggish). Rewrote it to clear on cleanup, keep values in refs so the
timer isn't rebuilt, guard overlapping polls, and catch offline errors. Wired it
into `app/_layout.tsx` as a periodic catch-up. Watermark starts at 1, not 0,
since everything is seeded at version 1 and `/sync` filters `version > since`

### Cart wasn't cleared after placing an order

Creating an order leaves the cart untouched - the backend order just references
the cart id and doesn't empty it, and there's no clear action in the cart API.
So after placing an order the same items were still sitting in the cart. Added a
`clearCart` that removes each item and call it after the order is created.
Clearing is safe because orders don't snapshot their items.

### Orders tab didn't refresh when you came back to it

The orders list was fetched in a `useEffect` keyed on `deviceId`, but tab screens
stay mounted, so switching back to the tab never refetched - user had to pull to
refresh to see a new order. Switched it to `useFocusEffect` so it reloads every
time the tab regains focus.

### Add-to-cart feedback

Adding to the cart gave no confirmation, so I added a small non-blocking "Added
to cart" toast message.

### Payment endpoint behaviour

`POST /orders/:id/pay` fails at random (~30%), and a failure is final: the
backend sets the order to `failed` and then rejects any further pay on it with a
400 (`order_not_in_draft`), so there's no retrying the same order - you'd have to
place a new one.

Handling on the client:

- Both the orders list and the order detail screen guard against a rapid
  double-tap - while a pay is in flight the button is disabled and shows
  "Processing…", so you can't fire two payments at the same order.
- The 400 is surfaced properly (via an `ApiError` carrying the server's error
  code) rather than swallowed into a generic message. Paying an order that's
  already been handled - paid or failed, including paid on another device -
  shows "this order can no longer be paid" and refreshes, instead of looking
  like a network failure.
- A genuine payment failure says so plainly and points the user at placing a new
  order, since the order is now terminal. Status is colour-coded throughout
  (draft / paid / failed).

I didn't add a retry button - it would only 400 against the fixed backend - and
left the live cross-device order status (the `order_update` WebSocket broadcast)
out of scope.

## Features

### Offline cache

On startup the app now hydrates products, categories and tags straight from
AsyncStorage first, so there's something on screen instantly and it works with
no network, then it refreshes in the background. If a fetch fails we keep the
cached data instead of throwing up an error, and a NetInfo listener kicks off a
silent refresh when the connection comes back. The product cache is written in
chunks because a single 5000-item blob can blow past Android's AsyncStorage
per-value size limit. Lives mostly in `store/productStore.ts`, wired up in
`app/_layout.tsx`.

Product images are part of the offline story too. They come from picsum.photos,
and with the default RN Image every row that scrolled into view offline fired a
request that failed and retried through Android's native image pipeline, which
made scrolling sluggish while offline. Switched to `expo-image` with a
memory-disk cache, so images seen once are served from disk (visible offline, no
network churn) and uncached ones show a placeholder instead of hammering. That
smoothed out offline scrolling and means cached imagery survives a network drop.

### A note on storage (why AsyncStorage, for now)

The catalog is cached in AsyncStorage, written in chunks. The chunking isn't
cosmetic: on Android AsyncStorage reads each value through a SQLite CursorWindow
that's capped around 2 MB, so a single ~5000-item JSON blob can quietly fail to
read back. Splitting it into chunks of 1000 (~500 KB each) keeps every value
comfortably under that ceiling.

I looked at swapping to `expo-file-system` (one JSON file, no chunking) and to
`expo-sqlite`. My call was to keep AsyncStorage:

- Once chunking handles the size limit, AsyncStorage and a JSON file are doing
  the identical job - serialize an array, read it back. A file would drop the
  ~15 lines of chunking but adds a dependency and another API to re-verify, for
  no change in behaviour.
- `expo-sqlite` is the genuinely better production option, but only if we lean
  into it: keep the catalog on disk and query/filter/paginate with SQL instead
  of holding all 5000 rows in memory and filtering in JS. That's a real
  re-architecture (schema, upserts during preload, list + search reading from
  the DB, bump/sync as UPDATEs) and it earns its keep when the catalog is large
  enough that in-memory stops being reasonable - think tens of thousands of
  items, not five thousand. At this size it'd be over-engineering, and the time
  is better spent on the sync and conflict work.

### Product search over the full catalog

For search to actually be correct it needs the whole catalog on the device, not
just the pages that happen to be loaded. So on launch the app pages through the
entire catalog in the background (200 at a time, ~25 requests) into the product
store, which doubles as the offline cache. Search then filters that full set by
name and description, debounced so typing stays smooth.

### Real-time sync

The app now holds a single WebSocket connection (mounted in `app/_layout.tsx` so
it's live on every screen) and applies bump events straight into local state -
the product/category/tag's version updates in place, no reload. `useWebSocket`
was rewritten to close on unmount, reconnect with backoff when the connection
drops, keep its handler in a ref, and ignore malformed frames. Events only apply
when they're newer than what we hold, so a stale or out-of-order message can't
walk a version backwards. The catch-up poller reuses the same apply logic, so it
and the socket converge on the same state. Verified by bumping a product from
another client and watching the card tick from v2 to v3 within a couple seconds.

One thing I skipped on purpose: a live event updates memory but doesn't rewrite
the whole chunked cache (too expensive per event) - the cache catches up on the
next background refresh.

### Background sync

When the app comes back to the foreground it hits `/sync?since=<last known
version>` and applies just the changed entities - no full reload. It reuses the
same apply path as the WebSocket, so it's really just a catch-up for anything
that happened while the app was backgrounded and the socket was asleep. Queued
bumps get replayed at the same moment. The `useAppState` hook it hangs off of was
also leaking its listener, so that's cleaned up too. Coming back online is
handled separately (the NetInfo listener does a fuller catalog refresh, since
that can also pick up added/removed products, not just version bumps).

Worth being upfront about a limitation here: `/sync` filters on `version >
since`, but versions are per-entity, so if we advance our watermark to the
highest version we've seen, a different entity bumped to a lower number while we
were away can be missed by the diff. The live WebSocket covers the normal case;
this is only a gap for the exact window where the app is backgrounded and an
older-numbered entity changes. Fixing it properly would need a backend change
(e.g. a global change sequence), which is off limits.

## Conflict resolution

Strategy: **server wins, then rebase**. A bump only ever increments a version and
carries no data of its own, so when the server rejects our push there's nothing
to lose by re-applying the increment on top of the server's newer version.

The flow: `bumpProduct` optimistically bumps the local version (so it shows even
offline), drops the intent into a persisted queue, and tries to flush. On flush
each bump is pushed to the server; a 409 comes back with the server's
`current_version`, so we adopt that and retry the bump against it, up to a few
times. Network failures leave the queue alone and it replays on the next
reconnect (wired from the NetInfo listener and on startup). If the rebase somehow
can't converge after a few tries we take the server's version and log the
conflict into `pendingConflicts` rather than looping forever. `api.bumpProduct`
had to be changed to actually surface the 409 body (`ConflictError`) instead of
throwing a generic error that dropped `current_version`.

Two related fixes came with this: the product detail screen loaded through
`GET /products/:id`, which doesn't exist (404), so it was broken - it now reads
the product from the already-preloaded catalog, which also makes the version tick
live. And bumps queued while offline survive an app kill since the queue is
persisted.

Skipped: category/tag bumps aren't queued (nothing in the UI triggers them, but
the same helper would generalize), and there's no dedicated conflict banner -
the rebase resolves the normal case silently and anything unresolved lands in
`pendingConflicts`.

## Skipped / not done

**Native modules (the bonus).** I left both native challenges as skeletons and
went deep on the JS side instead, since they need a prebuild / dev build and
can't run in Expo Go, which is where the rest of this was built and tested. For
the record, how I'd do them:

- Android `SyncBackgroundTask` (Kotlin): a WorkManager `PeriodicWorkRequest` on a
  15-minute interval whose `doWork()` reads the last known version from
  SharedPreferences, calls `/sync?since=...`, writes the new version back, and
  returns `Result.success()` (or `retry()` on failure). Enqueue it with
  `enqueueUniquePeriodicWork(..., KEEP, ...)` on app launch so it survives kills
  and restarts.
- iOS `RNKeepAliveManager` (Obj-C): `enable`/`disable` methods that set
  `[UIApplication sharedApplication].idleTimerDisabled` on the main queue
  (`requiresMainQueueSetup`), exposed through `RCT_EXPORT_METHOD` so JS can call
  `NativeModules.RNKeepAliveManager.enable()` during operating hours.

**Backend left untouched** per the README. A few things I worked around rather
than fixed at the source: the cursor pagination off-by-one, `/products?search=`
not being implemented, no `GET /products/:id`, and `/sync`'s per-entity version
watermark. Each is covered in the sections above.
