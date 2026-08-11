# Grimoire3D Studio — Complete User & Authoring Guide

Welcome to **Grimoire3D Studio**, a professional-grade RPG game generation, authoring, and simulation environment built on a modular TypeScript monorepo (`@grimoire3d/*`).

This guide details every workspace feature, editor view, procedural generator, AI auto-play controller, and package engine within Grimoire3D.

---

## 📑 Table of Contents
1. [Architecture & Core Concepts](#-1-architecture--core-concepts)
2. [Studio Interface & Main Views](#-2-studio-interface--main-views)
   - [Campaign Expedition Hub 🗺️](#campaign-expedition-hub-)
   - [Adventure Editor & Graph 🧭](#adventure-editor--graph-)
   - [2D Playable Dungeon Game 🎮](#2d-playable-dungeon-game-)
   - [2D Grid Layout 📐](#2d-grid-layout-)
   - [Playtest Workbench 🧪](#playtest-workbench-)
   - [Visual Logic Node Graph ⚡](#visual-logic-node-graph-)
   - [Spells & Dialogue Engine 🔮](#spells--dialogue-engine-)
3. [Specialized Authoring Tools](#-3-specialized-authoring-tools)
   - [🎲 Procedural Dungeon Generator Wizard](#-procedural-dungeon-generator-wizard)
   - [🤖 Autonomous Auto-Play Agent Controller](#-autonomous-auto-play-agent-controller)
   - [⚡ Visual Logic Node Graph (`@grimoire3d/visual-logic`)](#-visual-logic-node-graph-grimoire3dvisual-logic)
   - [🔮 Custom Spell & Skill Engine (`@grimoire3d/spell-core`)](#-custom-spell--skill-engine-grimoire3dspell-core)
   - [🗣️ Branching Dialogue Engine (`@grimoire3d/dialogue-engine`)](#️-branching-dialogue-engine-grimoire3ddialogue-engine)
4. [CLI Commands & Developer Workflows](#-4-cli-commands--developer-workflows)

---

## 🏛️ 1. Architecture & Core Concepts

Grimoire3D separates adventure content from runtime logic using a pure Intermediate Representation (IR):

```
packages/
├── ir/                     # Zod schemas for Locations, Exits, Items, Monsters, Quests
├── validator/              # Static analysis: lock-key solvability, reachability, boss drops
├── simulator/              # Deterministic game engine & AutoPlayAgent AI controller
├── rules-core/             # Dice mechanics (1d20 + bonus), combat, and SeededRNG (Mulberry32)
├── world-compiler/         # Spatial 2D/3D layout compilation & portal frustum culling
├── save-format/            # Versioned save game envelopes
├── campaign-simulator/     # Faction disposition, town services, bounty claims, rumor rotation
├── visual-logic/           # Event trigger node graphs (Triggers -> Conditions -> Actions)
├── spell-core/              # Level-scaling dice formulas, mana pools, status effects
├── dialogue-engine/        # Branching narrative trees, skill checks (Persuasion DC), choice flags
├── procedural-generator/   # 1-click algorithmic dungeon & encounter generation
└── runtime-babylon/        # 3D Babylon.js viewport with frustum culling
```

### Core Design Principles:
- **Pure IR & Zod Validation**: Content is serialized in standard JSON (`VersionedAdventure`).
- **Deterministic Replayability**: All randomness uses `SeededRNG`. The same seed guarantees identical roll outcomes.
- **Static Solvability Analysis**: `@grimoire3d/validator` runs graph reachability and state-space search to guarantee that adventures contain no unwinnable states, missing keys, or dangling exits.

---

## 🖥️ 2. Studio Interface & Main Views

Launch the Studio interface by running `npm run dev` and navigating to `http://localhost:5173`.

### Campaign Expedition Hub 🗺️
- **Purpose**: Campaign-level hub management for Keep on the Borderlands / Greywatch.
- **Features**:
  - Rest at the Provisioner / Tavern to restore party HP and rotate town rumors (`SERVICES_REFRESHED`).
  - Turn in boss trophies & quest items for gold rewards and garrison faction disposition boosts.
  - Launch expeditions to outlying cave complexes (Kobold Caves A, Orc Caves B, Goblin Caves C, etc.).

### Adventure Editor & Graph 🧭
- **Purpose**: Visual room topology and entity inspector.
- **Features**:
  - **Topology Graph**: Displays room nodes, exit edges, locked doors, and secrets.
  - **Location Inspector**: Edit room descriptions, biome lighting, exits, interactables, and secrets live.
  - **Validation Panel**: Displays live validator issues (unreachable rooms, missing keys, dangling exits) with 1-click focus.

### 2D Playable Dungeon Game 🎮
- **Purpose**: Full interactive dungeon exploration viewport.
- **Features**:
  - Fog-of-war exploration, directional movement controls (North, South, East, West), room inspection, and item usage.
  - **🤖 Auto-Play Control Panel**: Integrated floating AI panel to run the game autonomously.

### 2D Grid Layout 📐
- **Purpose**: Spatial grid mapping and room coordinate placement.
- **Features**: Drag and align rooms on a 2D tile grid to layout dungeon floors visually.

### Playtest Workbench 🧪
- **Purpose**: Automated script testing.
- **Features**: Load walkthrough JSON scripts (`walkthrough.json`) and assert replay equivalence under fixed random seeds.

### Visual Logic Node Graph ⚡
- **Purpose**: Visual event trigger node graph editor (`@grimoire3d/visual-logic`).
- **Features**: Author event chains connecting trigger nodes (On Interact, On Room Enter), condition nodes (Check Flag, Check Item), and action nodes (Grant Item, Set Flag).

### Spells & Dialogue Engine 🔮
- **Purpose**: Interactive testing suite for spells and NPC dialogue trees.
- **Features**:
  - Cast custom spells with dynamic $XdX$ per level damage, mana deduction, and status effects (`blessed`, `shielded`, `poisoned`).
  - Test branching NPC conversations with skill check rolls (Persuasion DC 12) and branch routing.

---

## 🛠️ 3. Specialized Authoring Tools

### 🎲 Procedural Dungeon Generator Wizard
- **How to Use**: Click the **"🎲 Procedural Generator"** button in the top navigation bar.
- **Options**:
  - **Theme**: Select *Cavern Complex*, *Classic Dungeon*, *Ancient Crypt*, or *Keep Fortress*.
  - **Room Count**: Set total rooms ($4-25$).
  - **Party Level**: Scale monster HP, AC, attack bonus, and damage ($Lvl 1-10$).
  - **Toggles**: Enable/disable Overlord Boss Room and Key-Lock Puzzles.
- **Output**: 1-click **"✨ Generate & Load Dungeon"** creates a 100% validated `VersionedAdventure` IR and loads it into the Studio viewport instantly.

### 🤖 Autonomous Auto-Play Agent Controller
- **How to Use**: Open the **"2D Playable Dungeon Game"** tab and use the **Auto-Play Control Panel** widget.
- **Controls**:
  - **▶ Run Auto-Play**: Starts the AI controller at 400ms per turn step.
  - **Pause**: Pauses execution.
  - **Step**: Executes a single AI action turn.
- **AI Decision Heuristic**: Evaluates combat threats, resting thresholds, uninspected chests, secret doors, inventory keys, and unvisited room navigation.

### ⚡ Visual Logic Node Graph (`@grimoire3d/visual-logic`)
- **Node Types**:
  - `TriggerNode`: On Room Enter, On Interact, On Turn Interval, On Combat Victory.
  - `ConditionNode`: Check Flag, Check Item, Check Ability DC.
  - `ActionNode`: Set Flag, Grant Item, Reveal Secret, Unlock Exit, Teleport.
- **Compiler**: `EventGraphCompiler.compile(graph)` verifies cycle freedom and produces IR-validated `Condition[]` and `Effect[]` arrays.

### 🔮 Custom Spell & Skill Engine (`@grimoire3d/spell-core`)
- **Spell Config**: School (`evocation`, `abjuration`, etc.), Level ($0-9$), Mana Cost, Target Type, Dice Formula (`1d6`), Level Scaling, Allowed Classes, Status Effects.
- **Cast Evaluator**: `SpellEvaluator.castSpell(spell, caster, rng)` deducts mana, rolls scaling dice, applies status effects (`blessed`, `shielded`), and returns execution reports.

### 🗣️ Branching Dialogue Engine (`@grimoire3d/dialogue-engine`)
- **Dialogue Config**: `DialogueTree` containing nodes, speaker text, portraits, and choices.
- **Skill Checks**: Choices support skill checks (e.g. `persuasion` DC 12) routing to `successNextNodeId` or `failureNextNodeId`.
- **Session Evaluator**: `DialogueEngineSession` tracks active speaker nodes, filters choices by condition flags (`visibleWhen`), and applies outcome effects.

---

## ⚡ 4. CLI Commands & Developer Workflows

All workspace operations run from the monorepo root:

| Command | Description |
| :--- | :--- |
| **`npm run dev`** | Starts Vite development server for `apps/studio` at `http://localhost:5173`. |
| **`npm run build`** | Builds production bundles for `apps/studio` (includes bundle budget checks). |
| **`npm run typecheck`** | Runs TypeScript compiler (`tsc --noEmit`) across all workspace packages. |
| **`npm run test`** | Runs Vitest unit test suite (83 tests across 15 test files). |
| **`npm run test -- --run packages/simulator/src/autoPlayAgent.test.ts`** | Runs single test file. |

---

> [!NOTE]
> All adventure IR files generated or exported from Grimoire3D are fully compliant with D&D SRD 5.1 CC-BY licenses and local-first offline storage standards.
