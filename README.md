# Store POS

A tablet-based point-of-sale app — React Native (Expo) frontend, Go backend.
This repo takes the app from a "works in dev but flaky in the field" state to
production-ready: fixing the stability and performance bugs and building out the
offline cache, real-time multi-device sync, conflict resolution, and background
sync.

## Demo

[▶ Watch the implementation walkthrough](assets/demo.mp4) — click to play in the
browser, no download.

<!-- For a player embedded directly in this README, open it in the GitHub web
editor, drag assets/demo.mp4 into the text area, and GitHub inserts an inline
video player (a user-attachments URL) in place of this link. -->

## Write-up

The full engineering write-up lives in **[NOTES.md](NOTES.md)** — every bug I
found and fixed, the four features, the conflict-resolution strategy and why I
chose it, and what I skipped with reasons.

The original take-home brief is preserved in **[ASSESSMENT.md](ASSESSMENT.md)**.

## Getting started

### Backend

```bash
cd backend
go run . --seed   # seed 5000 products into store.db, then exit
go run .          # REST API + WebSocket on :8080
```

### Mobile

```bash
cd mobile
npm install
npx expo start    # open on iOS/Android (Expo Go, SDK 52)
```

For a physical device, set your machine's local IP in `mobile/constants/config.ts`.
