import { describe, it, expect } from "vitest";
import { EventGraph, EventGraphCompiler, EventGraphEvaluator } from "./index";
import { SimulatorEngine } from "@grimoire3d/simulator";
import { serpentAltarAdventure } from "@grimoire3d/fixtures";
import { VersionedAdventure } from "@grimoire3d/ir";

describe("@grimoire3d/visual-logic — Event Graph Compiler & Evaluator Suite", () => {
  it("1. Compiles valid EventGraph with Trigger -> Condition -> Action chain", () => {
    const graph: EventGraph = {
      id: "graph-chest-lock",
      name: "Chest Unlock Sequence",
      description: "Grants key when inspecting chest with disarmed trap flag",
      nodes: [
        {
          id: "node-trigger-1",
          type: "trigger",
          kind: "onInteract",
          title: "On Inspect Wooden Chest",
          position: { x: 0, y: 0 },
          data: { targetId: "wooden-chest" },
        },
        {
          id: "node-cond-1",
          type: "condition",
          kind: "checkFlag",
          title: "Check Trap Disarmed",
          position: { x: 200, y: 0 },
          data: { flag: "trap-disarmed", equals: true },
        },
        {
          id: "node-action-1",
          type: "action",
          kind: "grantItem",
          title: "Grant Sun Key",
          position: { x: 400, y: 0 },
          data: { itemId: "sun-key" },
        },
      ],
      edges: [
        { id: "edge-1", fromNodeId: "node-trigger-1", fromPort: "out", toNodeId: "node-cond-1", toPort: "in" },
        { id: "edge-2", fromNodeId: "node-cond-1", fromPort: "out", toNodeId: "node-action-1", toPort: "in" },
      ],
    };

    const scripts = EventGraphCompiler.compile(graph);
    expect(scripts).toHaveLength(1);
    expect(scripts[0].valid).toBe(true);
    expect(scripts[0].conditions).toHaveLength(1);
    expect(scripts[0].effects).toHaveLength(1);
    expect(scripts[0].effects[0]).toEqual({ kind: "grantItem", itemId: "sun-key" });
  });

  it("2. Audits graph for missing required parameters and reports errors", () => {
    const invalidGraph: EventGraph = {
      id: "graph-invalid",
      name: "Broken Graph",
      nodes: [
        {
          id: "node-trig",
          type: "trigger",
          kind: "onRoomEnter",
          title: "On Enter Room",
          position: { x: 0, y: 0 },
          data: {},
        },
        {
          id: "node-act-broken",
          type: "action",
          kind: "grantItem",
          title: "Grant Broken Item",
          position: { x: 200, y: 0 },
          data: {}, // Missing required 'itemId'
        },
      ],
      edges: [{ id: "edge-1", fromNodeId: "node-trig", fromPort: "out", toNodeId: "node-act-broken", toPort: "in" }],
    };

    const scripts = EventGraphCompiler.compile(invalidGraph);
    expect(scripts[0].valid).toBe(false);
    expect(scripts[0].errors.some((e) => e.includes("missing required 'itemId'"))).toBe(true);
  });

  it("3. Dynamically evaluates CompiledEventScript against SimulatorEngine", () => {
    const graph: EventGraph = {
      id: "graph-secret-vault",
      name: "Secret Vault Reveal",
      nodes: [
        {
          id: "node-trigger",
          type: "trigger",
          kind: "onRoomEnter",
          title: "On Enter Vault",
          position: { x: 0, y: 0 },
          data: {},
        },
        {
          id: "node-action-flag",
          type: "action",
          kind: "setFlag",
          title: "Set Vault Visited Flag",
          position: { x: 200, y: 0 },
          data: { flag: "visited-vault", value: true },
        },
        {
          id: "node-action-item",
          type: "action",
          kind: "grantItem",
          title: "Grant Iron Key",
          position: { x: 400, y: 0 },
          data: { itemId: "iron-key" },
        },
      ],
      edges: [
        { id: "edge-1", fromNodeId: "node-trigger", fromPort: "out", toNodeId: "node-action-flag", toPort: "in" },
        { id: "edge-2", fromNodeId: "node-action-flag", fromPort: "out", toNodeId: "node-action-item", toPort: "in" },
      ],
    };

    const scripts = EventGraphCompiler.compile(graph);
    const engine = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, 42);

    const evalResult = EventGraphEvaluator.evaluateScript(scripts[0], engine);
    expect(evalResult.triggered).toBe(true);
    expect(evalResult.conditionsPassed).toBe(true);
    expect(evalResult.effectsApplied).toBe(2);

    expect(engine.state.flags.get("visited-vault")).toBe(true);
    expect(engine.state.inventory.has("iron-key")).toBe(true);
  });
});
