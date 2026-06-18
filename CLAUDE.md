# Cube Match 3D

A 6-face 5×5 cube match-3 puzzle game. Built with vanilla HTML/CSS/JS, packaged as an Android app via Capacitor.

## Tech Stack

- **Frontend**: Vanilla JS (no framework), HTML5 Canvas (WebGL-free, custom 3D math)
- **Packaging**: Capacitor 6 → Android APK (`ai.nextad.cubematch3d`)
- **Backend**: Firebase (Firestore + Auth + Analytics)
- **Auth**: Anonymous by default, upgradeable to Google via `@codetrix-studio/capacitor-google-auth`

## Build & Deploy

```bash
npm run build    # copy index.html + js/ + css/ → www/
npm run sync     # build + cap sync android
npm run deploy   # sync + gradle assembleRelease + adb install
```

Release APK: `android/app/build/outputs/apk/release/app-release.apk`

## File Structure

```
index.html          # single-page app, all overlays live here
css/game.css        # all styles
js/
  firebase.js       # Firebase init, Firestore, Auth, Analytics (logEvent helper here)
  board.js          # match-3 logic, tile elimination, scoring
  render.js         # 3D cube rendering (custom matrix math, Canvas 2D)
  math.js           # m3 matrix library (rotX/rotY/mul/id)
  state.js          # global state (score, moves, level, etc.)
  config.js         # COLORS, FACES, LEVELS constants
  input.js          # touch/mouse input handling
  audio.js          # sound effects
  slice.js          # slice tool logic
  ui/
    main.js         # app entry point, onPlay(), splash screen
    game.js         # game modes: startClassicGame, startTimedGame, endClassicGame, endTimedGame
    account.js      # Google linking, nickname, sign out
    leaderboard.js  # leaderboard overlay, tab switching
    friends.js      # friend search, requests, removal
    city.js         # city progression widget (SVG, block milestones)
    toast.js        # showToast(), city unlock toasts
    tutorial.js     # tutorial overlay
```

## Game Modes

- **Classic**: 20 moves, maximize score. Best stored in `localStorage cb3d_classic_best`.
- **Time Attack**: 60 seconds, maximize score. Best stored in `localStorage cb3d_ta_best`.
- (Endless mode was removed — do not re-add)

## Firebase Collections

| Collection | Purpose |
|---|---|
| `players/{uid}` | Per-user progress: `classicBest`, `taBest`, `blocksElim`, `nickname`, `tools`, `sliceDay` |
| `nicknames/{name}` | Nickname → uid mapping for uniqueness |
| `leaderboard_classic/{nickname}` | Global classic leaderboard |
| `leaderboard_timed/{nickname}` | Global timed leaderboard |
| `friendRequests/{toUid_fromUid}` | Pending friend requests |
| `friendships/{uid1_uid2}` | Confirmed friendships (uid1 < uid2 alphabetically) |

## Firebase Apps

- **Android app**: `1:525393991475:android:54cff6749d84265b801046` (Firestore/Auth)
- **Web app**: `1:525393991475:web:a8ab46d970a126c7801046`, measurementId `G-8V7ZLVK8K3` (Analytics JS SDK)

## Analytics Events

All events go through `logEvent(name, params)` defined in `js/firebase.js`.

| Event | Params | Where |
|---|---|---|
| `app_open` | `is_anonymous` | main.js |
| `mode_selected` | `mode` | game.js |
| `game_start` | `mode` | game.js |
| `game_end` | `mode`, `score`, `is_new_best` | game.js |
| `slice_used` | `mode`, `remaining` | slice.js |
| `leaderboard_opened` | `tab` | leaderboard.js |
| `leaderboard_tab_switched` | `tab` | leaderboard.js |
| `nickname_set` | — | account.js |
| `google_link_success` | `is_new_account` | account.js |
| `sign_out` | — | account.js |
| `city_stage_unlocked` | `stage`, `blocks` | city.js |
| `friend_request_sent` | `result` | friends.js |
| `friend_request_accepted` | — | friends.js |
| `friend_request_rejected` | — | friends.js |
| `friend_removed` | — | friends.js |

## Version Bumping

Every JS file has a `?v=N` cache-busting query in `index.html`. Bump the version whenever a file is modified.

| File | Current version |
|---|---|
| firebase.js | v15 |
| board.js | v11 |
| slice.js | v10 |
| ui/account.js | v15 |
| ui/leaderboard.js | v15 |
| ui/city.js | v12 |
| ui/game.js | v23 |
| ui/friends.js | v12 |
| ui/main.js | v15 |
| ui/toast.js | v11 |
| ui/tutorial.js | v11 |

## Key Conventions

- All JS is `'use strict'`, no modules/bundler — plain `<script>` tags loaded in order
- Global functions are called directly from `onclick=` attributes in HTML
- `window._gameMode` is the source of truth for current mode (`'classic'` | `'timed'`)
- `hideAll()` in main.js clears all overlays — always update it when adding/removing overlays
- Firebase is initialized lazily via `initFirebase()` (called on first user interaction)
- `logEvent()` is safe to call before Firebase init — it no-ops if `_analytics` is null
- Score submission only happens if a nickname is set
- `localStorage` keys: `cb3d_classic_best`, `cb3d_ta_best`, `cb3d_nickname`, `cb3d_blocks`, `cb3d_gp`, `cb3d_sliceday`, `cb3d_did`
