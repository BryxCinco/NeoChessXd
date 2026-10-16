# NEO CHESS DX

An 8-bit pixel-art chess game for the browser: a plumber-kingdom **RED army** against a speed-zone hedgehog **BLUE army**, with a CPU opponent at three difficulty levels and 17 animated elimination effects. It runs on desktop, tablets and phones.

**Play it:** [neo-chess-xd.vercel.app](https://neo-chess-xd.vercel.app)

**Full documentation:** [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md)

## Features

- **Modes:** 1 vs 1 on one device, or player vs CPU (Easy, Normal, Hard)
- **Full chess rules:** castling, en passant, promotion to any piece, check, checkmate, and every draw rule (stalemate, threefold repetition, 50-move rule, insufficient material)
- **Clocks:** no limit, 0:30, 1:00, 5:00, 10:00 or 30:00; they pause during menus and animations, and running out of time ends the game
- **Controls:** drag-and-drop or tap-to-move, with legal-move dots, last-move and check highlights
- **Undo / redo**, a move scoresheet, and captured pieces with material lead for each player
- **Saving:** the current game auto-saves and resumes after a refresh; named save slots keep the full move history
- **17 elimination effects:** the captured piece's own sprite is destroyed in a style chosen by the capturing piece (see below)
- **Checkmate cage:** an iron cage drops over the mated king, followed by a CHECKMATE! banner
- **FX Gallery:** preview every effect from the main menu
- **VS loading screen** with a 3-2-1-GO! countdown
- **Chiptune audio** generated live with Web Audio; AUDIO: OFF mutes everything and is remembered

## Elimination effects

Each capturing piece has its own finishers, used in rotation:

| Capturing piece | Finishers |
| --- | --- |
| Pawn | Stomp, Arrow Rain, Bubble Trap |
| Knight | Slash, Bat Swarm, Sandworm |
| Bishop | Deep Freeze, Thunder, Plasma Surge |
| Rook | Anvil Drop, Missile, Sniper |
| Queen | Black Hole, UFO Abduction, Giant Hand |
| King | Burn, Nuke |

## CPU opponent

The bot searches in a Web Worker, so the game stays smooth while it thinks.

| Difficulty | Search | Behaviour |
| --- | --- | --- |
| Easy | 1 move ahead | 30% random moves, large score noise |
| Normal | 2 moves + captures | 5% random moves, small score noise |
| Hard | up to 5 moves + captures, 1.5 s | always plays its best move |

It uses negamax with alpha-beta pruning, iterative deepening, quiescence search, and piece-square tables (`src/bot/engine.js`).

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 18 |
| Build | Vite 5 |
| Chess rules | chess.js 1.4.0 (pinned: the bot uses its internal move API) |
| Board | react-chessboard 2.1 |
| Pieces | 16x16 pixel grids rendered as SVG |
| Effects | HTML Canvas 2D |
| Audio | Web Audio API (no audio files) |
| Storage | localStorage |
| Hosting | Vercel, auto-deployed from `main` |

## Project structure

```
src/
  App.jsx                 top-level layout and modal wiring
  App.css                 all styling, layouts and animations
  hooks/                  useChessGame, useAudio, useSavedMatches, useMenuWizard, useResponsiveLayout
  components/             menu, board screen, player bars, scoresheet, VS intro, promotion, modals, FX gallery, logo
  bot/                    engine.js (search), botWorker.js (Web Worker), requestBotMove.js (bridge)
  fx/eliminationFx.js     the 17 elimination effects
  usePixelAnimation.js    canvas loop, checkmate cage
  sprites/pieceSprites.js pixel art and palette for all 12 pieces
  pixelPieces.jsx         sprites to SVG
  audioEngine.js          generated music and sound effects
```

## Run locally

Requires Node.js and npm.

```bash
npm install
npm run dev       # dev server
npm run build     # production build in dist/
npm run preview   # serve the build locally
npm run lint      # ESLint
```

Pushing to `main` deploys to Vercel automatically.
