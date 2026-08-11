import { describe, it, expect } from "vitest";
import { SimulatorEngine, AutoPlayAgent } from "./index";
import { serpentAltarAdventure } from "@grimoire3d/fixtures";
import { VersionedAdventure } from "@grimoire3d/ir";

describe("AutoPlayAgent — Autonomous AI Agent Test Suite", () => {
  it("1. AutoPlayAgent initializes and executes step-by-step decision loop", () => {
    const engine = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, 42);
    const agent = new AutoPlayAgent(engine);

    expect(agent.stepCount).toBe(0);

    const step1 = agent.step();
    expect(step1.success).toBe(true);
    expect(agent.stepCount).toBe(1);
    expect(engine.state.discoveredRooms.size).toBeGreaterThanOrEqual(1);
  });

  it("2. AutoPlayAgent autonomously completes Serpent Altar Crypt and reaches victory", () => {
    const engine = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, 100);
    engine.state.playerHp = 50;
    engine.state.playerMaxHp = 50;
    engine.state.playerAc = 14;
    engine.state.playerAttackBonus = 15;

    const agent = new AutoPlayAgent(engine, 100);

    const runResult = agent.runUntilCompletion();
    expect(runResult.totalSteps).toBeLessThan(100);
    expect(engine.state.gameEnded).toBe(true);
    expect(engine.state.gameOutcome).toBe("victory");
    expect(engine.state.flags.get("escaped-crypt")).toBe(true);
  });

  it("3. AutoPlayAgent operates deterministically under fixed random seed", () => {
    const seed = 999;

    const engineA = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, seed);
    engineA.state.playerHp = 40;
    const agentA = new AutoPlayAgent(engineA, 100);
    const resA = agentA.runUntilCompletion();

    const engineB = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, seed);
    engineB.state.playerHp = 40;
    const agentB = new AutoPlayAgent(engineB, 100);
    const resB = agentB.runUntilCompletion();

    expect(resA.totalSteps).toBe(resB.totalSteps);
    expect(resA.outcome).toBe(resB.outcome);
    expect(engineA.state.actionLog).toEqual(engineB.state.actionLog);
  });
});
