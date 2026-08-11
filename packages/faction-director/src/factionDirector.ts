import { WorldTime } from "@grimoire3d/campaign-ir";

export type FactionRuntimeState = {
  factionId: string;
  strength: number;
  alert: number;
  disposition: number;
  territory: string[];
  goals: string[];
  allies: string[];
  enemies: string[];
  lastUpdatedAt: WorldTime;
};

export type WorldTurnReport = {
  elapsedHours: number;
  newTime: WorldTime;
  factionUpdates: string[];
  regionRestocked: boolean;
};

export class FactionDirector {
  public static advanceWorldTurn(
    factions: Record<string, FactionRuntimeState>,
    currentTime: WorldTime,
    elapsedHours: number,
    playerActivity?: { regionId: string; defeatedEncounterId?: string }
  ): WorldTurnReport {
    const totalHours = currentTime.hour + elapsedHours;
    const additionalDays = Math.floor(totalHours / 24);
    const newHour = totalHours % 24;
    const newTime: WorldTime = {
      day: currentTime.day + additionalDays,
      hour: newHour,
    };

    const factionUpdates: string[] = [];

    // Faction Clocks & Conflict Resolution
    for (const fId in factions) {
      const f = factions[fId];
      f.lastUpdatedAt = newTime;

      // Alert level decay over time unless player attacked recently
      if (playerActivity && playerActivity.defeatedEncounterId) {
        f.alert = Math.min(10, f.alert + 2);
        factionUpdates.push(`Faction '${f.factionId}' alert increased to ${f.alert} due to recent expedition activity.`);
      } else if (f.alert > 0) {
        f.alert = Math.max(0, f.alert - 1);
      }

      // Faction Conflict Clocks (e.g. Kobold Clan vs Goblin Raiders)
      if (f.factionId === "kobold-clan" && factions["goblin-raiders"]) {
        const goblin = factions["goblin-raiders"];
        if (goblin.alert > 5 && f.strength > 0) {
          f.strength = Math.max(1, f.strength - 1);
          factionUpdates.push(`Border skirmish between Kobold Clan and Goblin Raiders. Kobold strength now ${f.strength}.`);
        }
      }
    }

    return {
      elapsedHours,
      newTime,
      factionUpdates,
      regionRestocked: elapsedHours >= 24,
    };
  }
}
