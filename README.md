# VisualMind

A 3D spatial mind-mapping tool built on [Babylon.js](https://babylonjs.com). Place and connect typed concept nodes — Questions, Answers, Notes, and more — in a navigable 3D scene.

## Try it now

**[helpful-zuccutto-9f1a65.netlify.app](https://helpful-zuccutto-9f1a65.netlify.app/)**

No install required — runs in the browser.

## What it does

- Place **7 node types** (Answer, Question, Note, Plus, Minus, Link, Reference) in 3D space
- Connect nodes with directional links
- Rotate and pan the scene with mouse or touch
- Auto-saves graphs to local storage

## Run it locally

```bash
git clone https://github.com/captnbli/VisualMindBabylonWindsurf.git
cd VisualMindBabylonWindsurf
npm install
npm start        # dev server at localhost:1234
```

Other commands:
```bash
npm run build    # production build
npm test         # run tests
```

## Node types

| Type      | Key | Color     | Purpose                        |
|-----------|-----|-----------|--------------------------------|
| Answer    | `a` | Blue      | Resolved conclusions           |
| Question  | `q` | Amber     | Open questions to explore      |
| Note      | `n` | Teal      | Context and supporting info    |
| Plus      | `+` | Lime      | Positive evidence              |
| Minus     | `-` | Coral     | Counterpoints and tension      |
| Link      | `l` | Violet    | Connections between ideas      |
| Reference | `r` | Orange    | External sources               |

## Controls

| Action              | Input                    |
|---------------------|--------------------------|
| Place node          | Press key + click canvas |
| Select node         | Click node               |
| Rotate scene        | Drag (Spin mode)         |
| Pan scene           | Drag (Pan mode)          |
| Toggle Spin / Pan   | `Space`                  |
| Undo                | `⌘Z` / `Ctrl+Z`         |
| Save                | `⌘S` / `Ctrl+S`         |

## Design system

Visual language, typography, color, spacing, and motion are documented in [DESIGN.md](DESIGN.md).

## Tech stack

- [Babylon.js 7](https://babylonjs.com) — 3D engine
- TypeScript
- Parcel — bundler
- Vitest — tests

## Project structure

```
ts/
  concepts/       # Node type classes (Answer, Question, Note, ...)
  ui/             # Toolbar + panel controllers
  graph_manager   # Node/edge state
  input_handler   # Mouse/touch/keyboard input
  camera_controller
  selection_manager
  persistence_manager
tests/
```
