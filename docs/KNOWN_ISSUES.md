# Known issues and limitations

Things that are known, understood and deliberately left as they are for now.
Each entry says what the issue is, why it matters, and what fixing it would take.

## Open issues

### Pinch-zoom is still blocked on phones

- **Where:** `src/hooks/useResponsiveLayout.js`, the "mobile pinch-zoom lock" effect.
- **What:** `index.html` no longer forbids zooming (`user-scalable=no` and
  `maximum-scale` were removed for accessibility), but this hook still cancels
  multi-touch `touchmove` and the iOS `gesturestart` / `gesturechange` events.
  `touch-action: manipulation` in `App.css` also disables double-tap zoom. So in
  practice a player still cannot pinch to zoom.
- **Why it was left:** removing the lock changes how the board feels. A second
  finger touching the screen while dragging a piece would zoom the page.
- **To fix:** delete the effect, then test dragging and tap-to-move on a real
  phone. Consider keeping the lock on the board only (`touch-action: none` on
  the board frame) and allowing zoom everywhere else.
- **Status:** to be decided in Part 6.

### Save-slot ids can collide

- **Where:** `src/hooks/useSavedMatches.js`, `id: 'match_' + Date.now()`.
- **What:** two saves made in the same millisecond get the same id. Deleting
  one would then delete both, and React would warn about duplicate keys.
- **Why it was left:** it cannot happen through the UI. Every save is followed
  by a modal that has to be dismissed before the next one.
- **To fix:** use `crypto.randomUUID()` or append a counter. Old saves keep
  working either way, since ids are only compared for equality.
- **Status:** minor, not blocking.

## Intentional behaviour (not bugs)

### Playing BLUE: the CPU's first move cannot be undone straight away

- **Where:** `src/hooks/useChessGame.js`, `canUndo`.
- **What:** when you play BLUE the CPU (RED) moves first. UNDO stays disabled
  until you have made a move of your own.
- **Why:** undo takes back *your* last move together with the CPU's reply. With
  only the CPU's opening move on the board there is nothing of yours to take
  back, and undoing it would just make the CPU move again.

### RANDOM side is re-rolled on every rematch

- **Where:** `src/hooks/useChessGame.js`, `assignColors`.
- **What:** with "RANDOM" chosen, REMATCH picks a side again, so you may get the
  same colour twice or switch.
- **Why:** RANDOM means "surprise me every game". To keep a colour, pick RED or
  BLUE in the menu. A saved or refreshed game always keeps the colour it had.

### EASY follows the opening book for two moves only

- **Where:** `src/bot/engine.js`, `DIFFICULTY.easy.bookPlies`.
- **What:** EASY plays known opening moves for the first two moves of each
  side, then switches to its own shallow, noisy search. The other levels
  follow the book to the end of each line (four or five moves).
- **Why:** it keeps EASY beginner-friendly. A sensible start, but no long
  stretch of memorised theory.

### The fixed top buttons can sit over the board when the page is scrolled

- **Where:** `.top-controls-row` in `src/App.jsx`.
- **What:** on very short screens (for example 320x568) the match is taller
  than the screen. Scrolling down moves the board under the fixed UNDO / MENU /
  REDO / HINT row.
- **Why it was left:** the buttons have to stay reachable. A match now always
  opens scrolled to the top, where nothing overlaps.

## Test coverage limits

The test suite runs in jsdom, which has no Web Audio API and no canvas. Code
that only talks to those APIs cannot be exercised there.

| File | Line coverage | Why |
| --- | --- | --- |
| `src/audioEngine.js` | low | Builds oscillators and gain nodes with the Web Audio API. The volume routing is tested against a fake `AudioContext`; the sounds themselves are not. |
| `src/effects/*.js`, `src/fx/eliminationFx.js` | high, but shallow | Canvas drawing. Every effect is played start to finish against a fake 2D context, which proves it runs, ends and cleans up, but not what it looks like. Looks are checked in the FX GALLERY. |
| `src/App.jsx` | 0% | Pure wiring of hooks to components, with no logic of its own. It is covered by the browser smoke test instead of unit tests. |

Features that depend on those APIs and so are checked by hand or in the
browser, not in the unit tests:

- Music and sound-effect volume as heard (the gain values are unit-tested).
- The pulsing outline of a hint (the squares and the style are unit-tested).
- Capture effects and the checkmate cage, including the "animations off" look
  (whether an effect is triggered at all is unit-tested).
- The screen-FX switch (the `<html>` class is unit-tested; the scanlines,
  starfield and screen flash it hides are CSS).
- Clipboard and file download in a real browser (the calls are unit-tested
  against stand-ins).

## Notes for testing in a headless browser

A headless Chromium tab that is not focused reports
`document.visibilityState === 'hidden'` and stops delivering
`requestAnimationFrame` callbacks. Canvas effects then appear frozen partway
through — for example the checkmate cage hanging above the king. This is the
browser throttling a background tab, not a bug in the game. Start the browser
with `--disable-renderer-backgrounding --disable-background-timer-throttling
--disable-backgrounding-occluded-windows` and call
`Emulation.setFocusEmulationEnabled` before checking any animation.
