import { VersionedAdventure, MonsterTemplate } from "@grimoire3d/ir";
import { SimulatorEngine } from "@grimoire3d/simulator";
import { createStandardCharacter } from "@grimoire3d/rules-core";
import { ValidationIssue } from "./validator";

export interface EncounterDifficultyReport {
  encounterId: string;
  locationId: string;
  locationLabel: string;
  winRate: number;
  totalSimulations: number;
  wins: number;
  losses: number;
  status: "pass" | "difficult" | "unwinnable";
  topDamagingMonster?: {
    monsterTemplateId: string;
    monsterName: string;
    totalDamage: number;
    damagePercentage: number;
  };
  damagePerMonster: Record<string, number>;
}

export interface WinnabilityOptions {
  numSimulations?: number;
  baseSeed?: number;
  partyLevel?: number;
}

/**
 * Derives the expected party level from encounter metadata, adventure metadata,
 * or defaults to 2 for classic dungeon modules.
 */
export function derivePartyLevel(adv: any, enc?: any): number {
  if (typeof enc?.targetPartyLevel === "number") return enc.targetPartyLevel;
  if (typeof enc?.metadata?.targetPartyLevel === "number") return enc.metadata.targetPartyLevel;
  if (typeof adv?.targetPartyLevel === "number") return adv.targetPartyLevel;
  if (typeof adv?.metadata?.targetPartyLevel === "number") return adv.metadata.targetPartyLevel;
  return 2;
}

/**
 * Simulates each encounter in the adventure N times using SimulatorEngine to evaluate
 * difficulty, win rates, and monster threat levels.
 */
export function analyzeCombatWinnability(
  vAdventure: VersionedAdventure,
  options?: WinnabilityOptions
): {
  issues: ValidationIssue[];
  reports: EncounterDifficultyReport[];
} {
  const issues: ValidationIssue[] = [];
  const reports: EncounterDifficultyReport[] = [];
  const numSims = options?.numSimulations ?? 100;
  const baseSeed = options?.baseSeed ?? 42;

  const adv = vAdventure.adventure;
  const monsterMap = new Map<string, MonsterTemplate>(adv.monsters.map((m) => [m.id, m]));

  for (const loc of adv.locations) {
    if (!loc.encounter || !loc.encounter.enemies || loc.encounter.enemies.length === 0) {
      continue;
    }

    const enc = loc.encounter;
    const level = options?.partyLevel ?? derivePartyLevel(adv, enc);
    const party = createStandardCharacter({
      name: "Party Vanguard",
      race: "human",
      class: "fighter",
      level,
    });

    let wins = 0;
    const totalDamagePerMonster: Record<string, number> = {};
    const lossDamagePerMonster: Record<string, number> = {};

    for (let i = 0; i < numSims; i++) {
      const seed = baseSeed + i;
      const engine = new SimulatorEngine(vAdventure, seed, party);
      engine.state.currentLocationId = loc.id;

      const res = engine.executeAction({ kind: "combatAction", action: "attack" });
      if (res.success) {
        wins++;
      }

      if (res.combatStats) {
        for (const [mId, dmg] of Object.entries(res.combatStats.damageByMonster)) {
          totalDamagePerMonster[mId] = (totalDamagePerMonster[mId] || 0) + dmg;
          if (!res.success) {
            lossDamagePerMonster[mId] = (lossDamagePerMonster[mId] || 0) + dmg;
          }
        }
      }
    }

    const winRate = wins / numSims;
    const winRatePct = Math.round(winRate * 100);

    // Identify top damaging monster (preferring damage in losses, falling back to total damage)
    const activeDamageMap = Object.keys(lossDamagePerMonster).length > 0 ? lossDamagePerMonster : totalDamagePerMonster;
    let topMonsterId = "";
    let topMonsterDamage = 0;
    let totalDamageOverall = 0;

    for (const [mId, dmg] of Object.entries(activeDamageMap)) {
      totalDamageOverall += dmg;
      if (dmg > topMonsterDamage) {
        topMonsterDamage = dmg;
        topMonsterId = mId;
      }
    }

    const topMonster = monsterMap.get(topMonsterId);
    const damagePercentage = totalDamageOverall > 0 ? Math.round((topMonsterDamage / totalDamageOverall) * 100) : 0;

    const report: EncounterDifficultyReport = {
      encounterId: enc.id,
      locationId: loc.id,
      locationLabel: loc.label,
      winRate,
      totalSimulations: numSims,
      wins,
      losses: numSims - wins,
      status: winRate >= 0.5 ? "pass" : winRate >= 0.1 ? "difficult" : "unwinnable",
      topDamagingMonster: topMonsterId
        ? {
            monsterTemplateId: topMonsterId,
            monsterName: topMonster ? topMonster.name : topMonsterId,
            totalDamage: topMonsterDamage,
            damagePercentage,
          }
        : undefined,
      damagePerMonster: totalDamagePerMonster,
    };
    reports.push(report);

    const monsterInfo = report.topDamagingMonster
      ? ` Deadliest monster: '${report.topDamagingMonster.monsterName}' dealt ${report.topDamagingMonster.totalDamage} damage (${report.topDamagingMonster.damagePercentage}% of damage taken).`
      : "";

    if (winRate < 0.1) {
      issues.push({
        code: "ENCOUNTER_UNWINNABLE",
        severity: "error",
        entityType: "encounter",
        entityId: enc.id,
        message: `Encounter '${enc.id}' in location '${loc.label}' (${loc.id}) is unwinnable: win rate ${winRatePct}% across ${numSims} simulations with Level ${level} party.${monsterInfo}`,
        suggestedFix: `Reduce enemy count, adjust monster HP/damage stats, or raise the recommended party level.`,
      });
    } else if (winRate < 0.5) {
      issues.push({
        code: "ENCOUNTER_DIFFICULT",
        severity: "warning",
        entityType: "encounter",
        entityId: enc.id,
        message: `Encounter '${enc.id}' in location '${loc.label}' (${loc.id}) is difficult: win rate ${winRatePct}% across ${numSims} simulations with Level ${level} party.${monsterInfo}`,
        suggestedFix: `Review encounter balance or consider providing potions/tactical advantages.`,
      });
    }
  }

  return { issues, reports };
}
