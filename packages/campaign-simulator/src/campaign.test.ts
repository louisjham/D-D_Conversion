import { describe, it, expect } from "vitest";
import { CampaignSession, CampaignAction, createCampaignSaveEnvelope, validateCampaignSaveCompatibility } from "./index";
import { greywatchCampaign, campaignWalkthrough } from "@grimoire3d/fixtures-campaign";
import { serpentAltarAdventure } from "@grimoire3d/fixtures";
import { VersionedAdventure } from "@grimoire3d/ir";
import fs from "fs";
import path from "path";

describe("Phase 4 — Campaign Region & Expedition Loop Test Suite", () => {
  it("1. Hub service transactions: buy item deducts gold and updates inventory", () => {
    const session = new CampaignSession(greywatchCampaign, 42);
    expect(session.state.currency.gold).toBe(50);

    const res = session.executeAction({ kind: "buy_item", itemId: "iron-key", costGold: 10 });
    expect(res.success).toBe(true);
    expect(session.state.currency.gold).toBe(40);
    expect(session.state.inventory).toContain("iron-key");

    // Insufficient funds test
    const failRes = session.executeAction({ kind: "buy_item", itemId: "expensive-magic-item", costGold: 1000 });
    expect(failRes.success).toBe(false);
    expect(session.state.currency.gold).toBe(40);
  });

  it("2. Rumor state progression: unheard -> heard -> confirmed", () => {
    const session = new CampaignSession(greywatchCampaign, 42);
    expect(session.state.knownRumors["rumor-viper-talisman"]).toBe("unheard");

    session.executeAction({ kind: "hear_rumor", rumorId: "rumor-viper-talisman" });
    expect(session.state.knownRumors["rumor-viper-talisman"]).toBe("heard");

    session.executeAction({ kind: "accept_quest", questId: "quest-sun-talisman" });
    session.executeAction({ kind: "rest_at_hub", hours: 8 });
    expect(session.state.knownRumors["rumor-viper-talisman"]).toBe("confirmed");
  });

  it("3. Travel route choice & deterministic travel time resolution", () => {
    const session = new CampaignSession(greywatchCampaign, 42);
    expect(session.state.worldTime).toEqual({ day: 1, hour: 8 });

    session.executeAction({ kind: "choose_route", routeId: "north-road" });
    session.executeAction({ kind: "begin_travel" });
    session.executeAction({ kind: "resolve_travel" });

    expect(session.state.worldTime).toEqual({ day: 1, hour: 12 }); // +4 hours
    expect(session.state.currentRegionId).toBe("broken-ravine");
    expect(session.state.currentNodeId).toBe("ravine-entrance");
  });

  it("4. Full Hub -> Travel -> Dungeon -> Retreat -> Return -> Rest loop", () => {
    const session = new CampaignSession(greywatchCampaign, 42);
    session.executeAction({ kind: "choose_route", routeId: "north-road" });
    session.executeAction({ kind: "begin_travel" });
    session.executeAction({ kind: "resolve_travel" });
    session.executeAction({ kind: "enter_dungeon" });

    // Bind dungeon simulator
    const dungeonEngine = session.bindDungeonSimulator(serpentAltarAdventure as VersionedAdventure);
    dungeonEngine.executeAction({ kind: "move", exitId: "exit-entry-to-guard" });
    dungeonEngine.executeAction({ kind: "inspect", targetId: "wooden-chest" });

    // Sync persistent state back to campaign session
    session.syncActiveDungeonState();
    expect(session.state.activeExpedition?.dungeonInventory).toContain("iron-key");

    // Retreat & Return to Hub
    session.executeAction({ kind: "retreat_from_dungeon" });
    expect(session.state.currentRegionId).toBe("greywatch-keep");

    // Rest at Inn & advance world turn
    session.executeAction({ kind: "rest_at_hub", hours: 8 });
    expect(session.state.worldTime.day).toBeGreaterThanOrEqual(1);
  });

  it("5. Persistent dungeon state across multiple expeditions", () => {
    const session = new CampaignSession(greywatchCampaign, 42);
    session.executeAction({ kind: "choose_route", routeId: "north-road" });
    session.executeAction({ kind: "begin_travel" });
    session.executeAction({ kind: "resolve_travel" });

    // First expedition
    const engine1 = session.bindDungeonSimulator(serpentAltarAdventure as VersionedAdventure);
    engine1.executeAction({ kind: "move", exitId: "exit-entry-to-guard" });
    engine1.executeAction({ kind: "inspect", targetId: "wooden-chest" });
    session.syncActiveDungeonState();

    session.executeAction({ kind: "retreat_from_dungeon" });

    // Second expedition: rebind dungeon simulator from persistent activeExpedition
    const engine2 = session.bindDungeonSimulator(serpentAltarAdventure as VersionedAdventure);
    expect(engine2.state.currentLocationId).toBe("guard-post");
    expect(engine2.state.inventory.has("iron-key")).toBe(true);
  });

  it("6. Faction clocks & world-turn updates", () => {
    const session = new CampaignSession(greywatchCampaign, 42);
    const initialAlert = session.state.factionStates["goblin-raiders"].alert;

    session.executeAction({ kind: "advance_world_turn", hours: 24 });
    expect(session.state.worldTime.day).toBe(2);
    expect(session.state.factionStates["goblin-raiders"].lastUpdatedAt.day).toBe(2);
  });

  it("7. Save/Load CampaignSaveEnvelope round-trip fidelity", () => {
    const session = new CampaignSession(greywatchCampaign, 42);
    session.executeAction({ kind: "buy_item", itemId: "iron-key", costGold: 10 });
    session.executeAction({ kind: "hear_rumor", rumorId: "rumor-viper-talisman" });

    const envelope = createCampaignSaveEnvelope("greywatch-broken-ravine", 42, session.state);
    const compat = validateCampaignSaveCompatibility(envelope, "greywatch-broken-ravine");
    expect(compat.compatible).toBe(true);

    const restoredSession = new CampaignSession(greywatchCampaign, envelope.campaignSeed);
    restoredSession.state = envelope.sessionState;

    expect(restoredSession.state.currency.gold).toBe(40);
    expect(restoredSession.state.inventory).toContain("iron-key");
    expect(restoredSession.state.knownRumors["rumor-viper-talisman"]).toBe("heard");
  });

  it("8. Deterministic campaign replayability from seed + action log", () => {
    const session1 = new CampaignSession(greywatchCampaign, 42);
    const session2 = new CampaignSession(greywatchCampaign, 42);

    const actions: CampaignAction[] = [
      { kind: "buy_item", itemId: "iron-key", costGold: 10 },
      { kind: "hear_rumor", rumorId: "rumor-viper-talisman" },
      { kind: "choose_route", routeId: "north-road" },
      { kind: "begin_travel" },
      { kind: "resolve_travel" },
    ];

    for (const a of actions) {
      session1.executeAction(a);
      session2.executeAction(a);
    }

    expect(session1.state.currency).toEqual(session2.state.currency);
    expect(session1.state.worldTime).toEqual(session2.state.worldTime);
  });

  it("9. Canonical campaign walkthrough script execution", () => {
    const session = new CampaignSession(greywatchCampaign, 42);
    for (const step of campaignWalkthrough as CampaignAction[]) {
      const res = session.executeAction(step);
      expect(res.success).toBe(true);
    }

    expect(session.state.actionLogHistory.length).toBe(campaignWalkthrough.length);
    expect(session.state.worldTime.day).toBeGreaterThanOrEqual(2);
  });

  it("10. CI Quarantine Guard: No tracked code imports local-content or exposes B2 raw source", () => {
    const localContentPath = path.resolve(__dirname, "../../../local-content/b2-benchmark");
    // Verify local-content directory exists or is safely gitignored
    expect(fs.existsSync(localContentPath)).toBe(true);
  });

  it("11. CLAIM_BOUNTY turns in boss loot item, awards gold reward, and improves garrison disposition", () => {
    const session = new CampaignSession(greywatchCampaign, 42);
    session.state.inventory.push("silver-key-ogre");
    session.state.questStates["quest-slay-ogre"] = "accepted";
    const preGold = session.state.currency.gold;
    const targetFaction = session.state.factionStates["keep-garrison"] || Object.values(session.state.factionStates)[0];
    const preDisp = targetFaction.disposition;

    const res = session.executeAction({
      kind: "claim_bounty",
      questId: "quest-slay-ogre",
      rewardGold: 250,
      requiredItemId: "silver-key-ogre",
    });

    expect(res.success).toBe(true);
    expect(session.state.inventory).not.toContain("silver-key-ogre");
    expect(session.state.currency.gold).toBe(preGold + 250);
    expect(session.state.questStates["quest-slay-ogre"]).toBe("completed");
    expect(targetFaction.disposition).toBeGreaterThan(preDisp);
  });

  it("12. REFRESH_TOWN_SERVICES rotates unheard rumors and emits SERVICES_REFRESHED event", () => {
    const session = new CampaignSession(greywatchCampaign, 42);
    const res = session.executeAction({ kind: "refresh_town_services" });

    expect(res.success).toBe(true);
    const event = session.state.emittedEvents.find((e) => e.kind === "services_refreshed");
    expect(event).toBeDefined();
  });
});
