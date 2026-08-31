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

## Conflict resolution

(to be filled in)

## Skipped / not done

(to be filled in)
