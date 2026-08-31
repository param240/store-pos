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

## Features

(to be filled in)

## Conflict resolution

(to be filled in)

## Skipped / not done

(to be filled in)
