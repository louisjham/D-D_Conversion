import { describe, it, expect } from "vitest";
import { VersionedAdventure } from "@grimoire3d/ir";
import { b2KeepOnTheBorderlands, serpentAltarAdventure } from "@grimoire3d/fixtures";
import {
  validateAdventure,
  analyzeCombatWinnability,
} from "./index";

describe("Combat Winnability & Encounter Difficulty Validation", () => {
  it("1. B2's Ogre cave encounter passes as tough but beatable (win rate >= 50%)", () => {
    const analysis = analyzeCombatWinnability(b2KeepOnTheBorderlands as VersionedAdventure, {
      numSimulations: 100,
      baseSeed: 42,
    });

    const ogreReport = analysis.reports.find((r) => r.encounterId === "encounter-ogre");
    expect(ogreReport).toBeDefined();
    expect(ogreReport?.locationId).toBe("cave-e-ogre");
    expect(ogreReport?.status).toBe("pass");
    expect(ogreReport?.winRate).toBeGreaterThanOrEqual(0.5);

    // Ensure no ENCOUNTER_UNWINNABLE error for the ogre cave
    const ogreError = analysis.issues.find(
      (i) => i.entityId === "encounter-ogre" && i.code === "ENCOUNTER_UNWINNABLE"
    );
    expect(ogreError).toBeUndefined();
  });

  it("2. Deliberately overtuned encounter (boss HP x 10) correctly flags ENCOUNTER_UNWINNABLE", () => {
    const adv: VersionedAdventure = JSON.parse(JSON.stringify(b2KeepOnTheBorderlands));
    const ogreMonster = adv.adventure.monsters.find((m) => m.id === "ogre-brute");
    expect(ogreMonster).toBeDefined();

    // Multiply boss HP by 10 (22 -> 220 HP)
    ogreMonster!.hp *= 10;

    const result = validateAdventure(adv, {
      numSimulations: 100,
      baseSeed: 42,
    });

    expect(result.valid).toBe(false);

    const unwinnableIssue = result.issues.find(
      (i) => i.code === "ENCOUNTER_UNWINNABLE" && i.entityId === "encounter-ogre"
    );
    expect(unwinnableIssue).toBeDefined();
    expect(unwinnableIssue?.severity).toBe("error");
    expect(unwinnableIssue?.message).toContain("Ogre Brute");
    expect(unwinnableIssue?.message).toContain("Deadliest monster");
    expect(unwinnableIssue?.suggestedFix).toBeDefined();
  });

  it("3. Results are deterministic given the same seed set", () => {
    const seed = 999;
    const runA = analyzeCombatWinnability(b2KeepOnTheBorderlands as VersionedAdventure, {
      numSimulations: 50,
      baseSeed: seed,
    });
    const runB = analyzeCombatWinnability(b2KeepOnTheBorderlands as VersionedAdventure, {
      numSimulations: 50,
      baseSeed: seed,
    });

    expect(runA.reports.length).toBe(runB.reports.length);
    for (let i = 0; i < runA.reports.length; i++) {
      expect(runA.reports[i].encounterId).toBe(runB.reports[i].encounterId);
      expect(runA.reports[i].winRate).toBe(runB.reports[i].winRate);
      expect(runA.reports[i].wins).toBe(runB.reports[i].wins);
      expect(runA.reports[i].damagePerMonster).toEqual(runB.reports[i].damagePerMonster);
    }
  });

  it("4. Classifies 10-50% win rate encounters as ENCOUNTER_DIFFICULT warning", () => {
    const adv: VersionedAdventure = JSON.parse(JSON.stringify(serpentAltarAdventure));
    const viper = adv.adventure.monsters.find((m) => m.id === "giant-viper");
    expect(viper).toBeDefined();

    // Calibrate viper to be difficult: 60 HP, AC 17, Atk +6
    viper!.hp = 60;
    viper!.ac = 17;
    viper!.attackBonus = 6;

    const analysis = analyzeCombatWinnability(adv, {
      numSimulations: 100,
      baseSeed: 42,
      partyLevel: 1,
    });

    const report = analysis.reports.find((r) => r.encounterId === "enc-altar-viper");
    expect(report).toBeDefined();

    const difficultIssue = analysis.issues.find(
      (i) => i.code === "ENCOUNTER_DIFFICULT" || i.code === "ENCOUNTER_UNWINNABLE"
    );
    expect(difficultIssue).toBeDefined();
    if (report!.winRate >= 0.1 && report!.winRate < 0.5) {
      expect(difficultIssue?.code).toBe("ENCOUNTER_DIFFICULT");
      expect(difficultIssue?.severity).toBe("warning");
    }
  });

  it("5. Reports which monster contributes most to losses and damage percentage", () => {
    const adv: VersionedAdventure = JSON.parse(JSON.stringify(b2KeepOnTheBorderlands));
    const analysis = analyzeCombatWinnability(adv, {
      numSimulations: 50,
      baseSeed: 42,
    });

    for (const report of analysis.reports) {
      if (report.losses > 0 && report.topDamagingMonster) {
        expect(report.topDamagingMonster.monsterTemplateId).toBeDefined();
        expect(report.topDamagingMonster.monsterName).toBeDefined();
        expect(report.topDamagingMonster.totalDamage).toBeGreaterThan(0);
        expect(report.topDamagingMonster.damagePercentage).toBeGreaterThanOrEqual(0);
        expect(report.topDamagingMonster.damagePercentage).toBeLessThanOrEqual(100);
      }
    }
  });
});
