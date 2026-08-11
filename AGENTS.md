# AGENTS.md — Grimoire3D Development Guide

## Project Overview
Monorepo for D&D adventure conversion tooling. Packages use `@grimoire3d/*` namespace with path aliases. Core domain: adventure IR, validation, simulation, compilation, UI.

## Build / Lint / Test Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server for `apps/studio` |
| `npm run build` | Production build of `apps/studio` |
| `npm run test` | Run all Vitest tests (root) |
| `npm run test -- --run packages/validator/src/validator.test.ts` | Run single test file |
| `npm run test -- --run -t "Invariant 1"` | Run single test by name |
| `npm run typecheck` | TypeScript `--noEmit` across workspace |

### Package-Level Commands
Individual packages have no scripts; all tooling runs from root. Vitest config at `vitest.config.ts` uses `include: ["packages/**/*.test.ts"]`.

## Code Style Guidelines

### TypeScript
- **Strict mode**: `"strict": true`, `noImplicitReturns: true`, `isolatedModules: true`
- **Target**: ES2022, `moduleResolution: "bundler"`, `jsx: "react-jsx"`
- **Path aliases**: All internal packages mapped in `tsconfig.json` and `vitest.config.ts`
- **Imports**: Use `@grimoire3d/*` aliases. Relative imports only within same package.

### Formatting (No Prettier/ESLint configured)
- 2-space indentation, semicolons, single quotes
- Trailing commas in multiline objects/arrays
- Max line length ~100 chars (soft)
- No auto-formatter enforced — match existing style

### Naming Conventions
- **Types/Interfaces**: PascalCase (`ValidationIssue`, `GameState`)
- **Functions**: camelCase (`validateAdventure`, `executeAction`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_STATE_SPACE`)
- **Discriminated Union Members**: PascalCase type field (`type: "PLAYER_MOVED"`)
- **Props Interfaces**: Suffix with `Props` (`GridMapViewProps`)
- **Files**: PascalCase for components (`GridMapView.tsx`), camelCase for utils (`validator.ts`)

### Architecture Patterns

**Discriminated Unions** for actions/events:
```ts
export type GameAction =
  | { kind: "move"; direction: Direction }
  | { type: "MOVE"; exitId: string }; // Legacy support
```

**Error Handling**: Never throw for expected failures. Return result objects:
```ts
return { success: false, message: "Exit locked", events: [] };
```

**State Management**: Mutable class state (`SimulatorEngine.state`) with immutable event log. Use `Map`/`Set` for collections.

**Validation**: Zod schemas in `@grimoire3d/ir`. Parse with `safeParse`, collect issues array with codes, severity, entity refs.

**Determinism**: `SeededRNG` for all randomness. Tests assert replay equivalence under same seed.

**Provenance**: Optional `provenance: { sourceId: string }` on IR entities for traceability.

### React / UI (packages/ui-*)
- **Components**: `React.FC<Props>` with explicit interface
- **Styling**: Tailwind utility classes (no CSS modules)
- **Icons**: `lucide-react` (tree-shakable imports)
- **State**: Local `useState`/`useMemo`, no global store
- **Accessibility**: Semantic HTML, `aria-label` on interactive SVGs

### Testing (Vitest)
- **Structure**: `describe`/`it` with descriptive names
- **Fixtures**: Import from `@grimoire3d/fixtures` (pre-built adventures)
- **Assertions**: `expect` with `.toBe()`, `.toContain()`, `.toBe(true)`
- **Invariants**: Test property-based invariants (state mutation, replay, entity validity)
- **Coverage**: No coverage threshold enforced

## Key Packages

| Package | Purpose |
|---------|---------|
| `ir` | Core IR types + Zod schemas (`VersionedAdventure`, `Location`, `Exit`, `RandomTableSchema`) |
| `validator` | Static analysis: schema, references, reachability, lock/key solvability, boss drop tracking |
| `simulator` | Stateful engine: `SimulatorEngine`, `executeAction`, domain events |
| `rules-core` | Dice mechanics: `resolveCheck`, `resolveSimpleCombat`, `SeededRNG` |
| `save-format` | Serialization: `createSaveGameEnvelope` |
| `world-compiler` | Compile IR → runtime format |
| `ui-editor` | React components: graph, grid, inspectors, validation panel |
| `campaign-*` | Campaign-level IR, simulator, B2 Keep & Greywatch hub fixtures (`b2Campaign`, `greywatchCampaign`) |
| `economy-core` | Economic simulation |
| `importers` | Source format → IR conversion & B2 PDF extraction (`scripts/build_b2_ir.py`) |
| `visual-logic` | Visual event trigger node graph compiler (`EventGraphCompiler`) |
| `spell-core` | Custom spell & magic system engine (`SpellEvaluator`, $XdX$ per level scaling, status effects) |
| `dialogue-engine` | Branching narrative tree engine (`DialogueEngineSession`, skill checks DC) |
| `procedural-generator` | 1-click algorithmic dungeon & encounter generator (`ProceduralGenerator`) |

## Common Workflows

### Add New Validation Rule
1. Add error code constant in `validator.ts`
2. Implement check in `validateAdventure` (after existing passes)
3. Add test case in `validator.test.ts` using fixture adventure
4. Run `npm run test -- --run packages/validator/src/validator.test.ts`

### Add New Simulator Action
1. Extend `GameAction` union in `simulator.ts`
2. Add handler in `executeAction` (follow move/inspect pattern)
3. Emit appropriate `DomainEvent`
4. Add invariant test in `invariants.test.ts`

### Add New IR Type
1. Define in `packages/ir/src/types.ts`
2. Add Zod schema in `packages/ir/src/index.ts`
3. Update validators, simulator, compiler as needed
4. Run `npm run typecheck`

## Performance Notes
- State-space search capped at 5000 states (`MAX_STATE_SPACE`)
- `frameloop="demand"` for Three.js scenes (see `three-d-scene` skill)
- Instanced meshes for >50 repeated objects
- Lazy-load heavy scenes with `dynamic(() => import(...), { ssr: false })`

## Accessibility
- Wrap `<Canvas>` in `role="img" aria-label="..."` or `aria-hidden="true"`
- All interactive elements: hover, active, focus-visible, disabled states
- Respect `prefers-reduced-motion` (static poster fallback)

## Token Integration (Three.js)
```ts
const brand = useMemo(() => getComputedStyle(document.documentElement).getPropertyValue("--color-brand").trim(), []);
<meshStandardMaterial color={brand} />
```
Never hardcode hex values in scene files.

## No External Linting
No ESLint, Prettier, or Husky configured. Code review enforces consistency.