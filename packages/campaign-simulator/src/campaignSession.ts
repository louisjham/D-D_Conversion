import {
  VersionedCampaign,
  WorldTime,
  Rumor,
  LocalSourceProvenance,
} from "@grimoire3d/campaign-ir";
import { CurrencyState, EconomyEngine } from "@grimoire3d/economy-core";
import { FactionRuntimeState, FactionDirector, WorldTurnReport } from "@grimoire3d/faction-director";
import { VersionedAdventure } from "@grimoire3d/ir";
import { SimulatorEngine } from "@grimoire3d/simulator";

export type RumorKnowledgeState = "unheard" | "heard" | "investigating" | "confirmed" | "disproved";

export type ExpeditionRecord = {
  expeditionId: string;
  regionId: string;
  startedAt: WorldTime;
  endedAt: WorldTime;
  outcome: "completed" | "retreated" | "defeated";
  lootAcquired: string[];
  actionCount: number;
};

export type CampaignAction =
  | { kind: "visit_service"; serviceId: string }
  | { kind: "buy_item"; itemId: string; costGold: number }
  | { kind: "sell_item"; itemId: string; priceGold: number }
  | { kind: "hear_rumor"; rumorId: string }
  | { kind: "accept_quest"; questId: string }
  | { kind: "claim_bounty"; questId: string; rewardGold: number; requiredItemId?: string }
  | { kind: "choose_route"; routeId: string }
  | { kind: "begin_travel" }
  | { kind: "resolve_travel" }
  | { kind: "enter_dungeon" }
  | { kind: "retreat_from_dungeon" }
  | { kind: "return_to_hub" }
  | { kind: "rest_at_hub"; hours: number }
  | { kind: "refresh_town_services" }
  | { kind: "advance_world_turn"; hours: number };

export type CampaignEvent = {
  kind:
    | "rumor_heard"
    | "item_purchased"
    | "item_sold"
    | "quest_accepted"
    | "bounty_claimed"
    | "services_refreshed"
    | "travel_started"
    | "travel_resolved"
    | "region_entered"
    | "expedition_completed"
    | "expedition_retreated"
    | "hub_rest_completed"
    | "faction_updated"
    | "region_restocked"
    | "world_turn_completed";
  payload: Record<string, any>;
};

export type CampaignSessionState = {
  schemaVersion: "0.1";
  campaignId: string;
  campaignContentHash: string;
  campaignSeed: number;
  worldTime: WorldTime;
  currentRegionId: string;
  currentNodeId: string;
  activeRouteId?: string;

  currency: CurrencyState;
  inventory: string[];
  knownRumors: Record<string, RumorKnowledgeState>;
  factionStates: Record<string, FactionRuntimeState>;
  questStates: Record<string, "available" | "accepted" | "completed">;

  activeExpedition?: {
    dungeonLocationId: string;
    dungeonInventory: string[];
    dungeonFlags: [string, boolean][];
    dungeonSecrets: string[];
    dungeonUnlockedExits: string[];
  };

  expeditionHistory: ExpeditionRecord[];
  actionLogHistory: CampaignAction[];
  emittedEvents: CampaignEvent[];
};

export class CampaignSession {
  public vCampaign: VersionedCampaign;
  public state: CampaignSessionState;
  public activeDungeonSimulator: SimulatorEngine | null = null;

  constructor(vCampaign: VersionedCampaign, seed: number = 42) {
    this.vCampaign = vCampaign;

    const initialFactions: Record<string, FactionRuntimeState> = {};
    const greywatchReg = vCampaign.campaign.regions.find((r) => r.id === vCampaign.campaign.startingRegionId);
    if (greywatchReg) {
      for (const f of greywatchReg.factions) {
        initialFactions[f.id] = {
          factionId: f.id,
          strength: f.initialStrength,
          alert: f.initialAlert,
          disposition: f.initialDisposition,
          territory: f.territory,
          goals: f.goals,
          allies: f.allies,
          enemies: f.enemies,
          lastUpdatedAt: { day: 1, hour: 8 },
        };
      }
    }

    const initialRumors: Record<string, RumorKnowledgeState> = {};
    if (greywatchReg) {
      for (const r of greywatchReg.rumors) {
        initialRumors[r.id] = "unheard";
      }
    }

    const initialQuests: Record<string, "available" | "accepted" | "completed"> = {};
    if (greywatchReg) {
      for (const q of greywatchReg.quests) {
        initialQuests[q.id] = "available";
      }
    }

    this.state = {
      schemaVersion: "0.1",
      campaignId: vCampaign.campaign.id,
      campaignContentHash: `hash-${vCampaign.campaign.id}-v0.1`,
      campaignSeed: seed,
      worldTime: { day: 1, hour: 8 },
      currentRegionId: vCampaign.campaign.startingRegionId,
      currentNodeId: vCampaign.campaign.startingNodeId,
      currency: { gold: 50, silver: 0, copper: 0 },
      inventory: ["torch-bundle", "iron-rations"],
      knownRumors: initialRumors,
      factionStates: initialFactions,
      questStates: initialQuests,
      expeditionHistory: [],
      actionLogHistory: [],
      emittedEvents: [],
    };
  }

  public executeAction(action: CampaignAction): { success: boolean; events: CampaignEvent[] } {
    const events: CampaignEvent[] = [];

    switch (action.kind) {
      case "visit_service": {
        this.state.actionLogHistory.push(action);
        return { success: true, events };
      }

      case "buy_item": {
        if (EconomyEngine.canAfford(this.state.currency, action.costGold)) {
          EconomyEngine.deduct(this.state.currency, action.costGold);
          this.state.inventory.push(action.itemId);
          const ev: CampaignEvent = { kind: "item_purchased", payload: { itemId: action.itemId, costGold: action.costGold } };
          events.push(ev);
          this.state.emittedEvents.push(ev);
          this.state.actionLogHistory.push(action);
          return { success: true, events };
        }
        return { success: false, events };
      }

      case "sell_item": {
        const idx = this.state.inventory.indexOf(action.itemId);
        if (idx !== -1) {
          this.state.inventory.splice(idx, 1);
          EconomyEngine.add(this.state.currency, action.priceGold);
          const ev: CampaignEvent = { kind: "item_sold", payload: { itemId: action.itemId, priceGold: action.priceGold } };
          events.push(ev);
          this.state.emittedEvents.push(ev);
          this.state.actionLogHistory.push(action);
          return { success: true, events };
        }
        return { success: false, events };
      }

      case "hear_rumor": {
        this.state.knownRumors[action.rumorId] = "heard";
        const ev: CampaignEvent = { kind: "rumor_heard", payload: { rumorId: action.rumorId } };
        events.push(ev);
        this.state.emittedEvents.push(ev);
        this.state.actionLogHistory.push(action);
        return { success: true, events };
      }

      case "accept_quest": {
        this.state.questStates[action.questId] = "accepted";
        const ev: CampaignEvent = { kind: "quest_accepted", payload: { questId: action.questId } };
        events.push(ev);
        this.state.emittedEvents.push(ev);
        this.state.actionLogHistory.push(action);
        return { success: true, events };
      }

      case "choose_route": {
        this.state.activeRouteId = action.routeId;
        this.state.actionLogHistory.push(action);
        return { success: true, events };
      }

      case "begin_travel": {
        const ev: CampaignEvent = { kind: "travel_started", payload: { routeId: this.state.activeRouteId } };
        events.push(ev);
        this.state.emittedEvents.push(ev);
        this.state.actionLogHistory.push(action);
        return { success: true, events };
      }

      case "resolve_travel": {
        // Advance time by travel route duration (e.g. 4 hours for North Road)
        const travelHours = this.state.activeRouteId === "fen-path" ? 8 : 4;
        const turnReport = FactionDirector.advanceWorldTurn(this.state.factionStates, this.state.worldTime, travelHours);
        this.state.worldTime = turnReport.newTime;
        this.state.currentRegionId = "broken-ravine";
        this.state.currentNodeId = "ravine-entrance";

        const ev: CampaignEvent = { kind: "travel_resolved", payload: { destination: "broken-ravine" } };
        events.push(ev);
        this.state.emittedEvents.push(ev);
        this.state.actionLogHistory.push(action);
        return { success: true, events };
      }

      case "enter_dungeon": {
        const ev: CampaignEvent = { kind: "region_entered", payload: { regionId: "broken-ravine" } };
        events.push(ev);
        this.state.emittedEvents.push(ev);
        this.state.actionLogHistory.push(action);
        return { success: true, events };
      }

      case "retreat_from_dungeon":
      case "return_to_hub": {
        this.state.currentRegionId = "greywatch-keep";
        this.state.currentNodeId = "keep-courtyard";
        const ev: CampaignEvent = { kind: "expedition_retreated", payload: { destination: "greywatch-keep" } };
        events.push(ev);
        this.state.emittedEvents.push(ev);
        this.state.actionLogHistory.push(action);
        return { success: true, events };
      }

      case "rest_at_hub": {
        const turnReport = FactionDirector.advanceWorldTurn(this.state.factionStates, this.state.worldTime, action.hours);
        this.state.worldTime = turnReport.newTime;

        // Check if active quest completed
        for (const qId in this.state.questStates) {
          if (this.state.questStates[qId] === "accepted") {
            this.state.questStates[qId] = "completed";
            EconomyEngine.add(this.state.currency, 100); // Quest Reward
            // Confirm rumor after successful expedition
            if (this.state.knownRumors["rumor-viper-talisman"]) {
              this.state.knownRumors["rumor-viper-talisman"] = "confirmed";
            }
          }
        }

        const ev: CampaignEvent = { kind: "hub_rest_completed", payload: { hours: action.hours, newTime: this.state.worldTime } };
        events.push(ev);
        this.state.emittedEvents.push(ev);
        this.state.actionLogHistory.push(action);
        return { success: true, events };
      }

      case "claim_bounty": {
        let hasReqItem = true;
        if (action.requiredItemId) {
          const invIdx = this.state.inventory.indexOf(action.requiredItemId);
          const dungeonInvIdx = this.state.activeExpedition?.dungeonInventory.indexOf(action.requiredItemId) ?? -1;
          if (invIdx !== -1) {
            this.state.inventory.splice(invIdx, 1);
          } else if (dungeonInvIdx !== -1 && this.state.activeExpedition) {
            this.state.activeExpedition.dungeonInventory.splice(dungeonInvIdx, 1);
          } else {
            hasReqItem = false;
          }
        }
        if (!hasReqItem) {
          return { success: false, events: [] };
        }

        this.state.questStates[action.questId] = "completed";
        EconomyEngine.add(this.state.currency, action.rewardGold);
        const garrison = this.state.factionStates["keep-garrison"] || Object.values(this.state.factionStates)[0];
        if (garrison) {
          garrison.disposition = Math.min(100, garrison.disposition + 10);
        }

        const ev: CampaignEvent = {
          kind: "bounty_claimed",
          payload: { questId: action.questId, rewardGold: action.rewardGold, requiredItemId: action.requiredItemId },
        };
        events.push(ev);
        this.state.emittedEvents.push(ev);
        this.state.actionLogHistory.push(action);
        return { success: true, events };
      }

      case "refresh_town_services": {
        let refreshedRumor: string | undefined;
        for (const rId in this.state.knownRumors) {
          if (this.state.knownRumors[rId] === "unheard") {
            this.state.knownRumors[rId] = "heard";
            refreshedRumor = rId;
            break;
          }
        }
        const ev: CampaignEvent = {
          kind: "services_refreshed",
          payload: { rumorsRefreshed: !!refreshedRumor, heardRumorId: refreshedRumor },
        };
        events.push(ev);
        this.state.emittedEvents.push(ev);
        this.state.actionLogHistory.push(action);
        return { success: true, events };
      }

      case "advance_world_turn": {
        const turnReport = FactionDirector.advanceWorldTurn(this.state.factionStates, this.state.worldTime, action.hours);
        this.state.worldTime = turnReport.newTime;
        const ev: CampaignEvent = { kind: "world_turn_completed", payload: { turnReport } };
        events.push(ev);
        this.state.emittedEvents.push(ev);
        this.state.actionLogHistory.push(action);
        return { success: true, events };
      }
    }

    return { success: false, events: [] };
  }

  public bindDungeonSimulator(vAdventure: VersionedAdventure): SimulatorEngine {
    const engine = new SimulatorEngine(vAdventure, this.state.campaignSeed);
    if (this.state.activeExpedition) {
      engine.state.currentLocationId = this.state.activeExpedition.dungeonLocationId;
      engine.state.inventory = new Set(this.state.activeExpedition.dungeonInventory);
      engine.state.flags = new Map(this.state.activeExpedition.dungeonFlags);
      engine.state.discoveredSecrets = new Set(this.state.activeExpedition.dungeonSecrets);
      engine.state.unlockedExits = new Set(this.state.activeExpedition.dungeonUnlockedExits);
    }
    this.activeDungeonSimulator = engine;
    return engine;
  }

  public syncActiveDungeonState(): void {
    if (this.activeDungeonSimulator) {
      const s = this.activeDungeonSimulator.state;
      this.state.activeExpedition = {
        dungeonLocationId: s.currentLocationId,
        dungeonInventory: Array.from(s.inventory),
        dungeonFlags: Array.from(s.flags.entries()),
        dungeonSecrets: Array.from(s.discoveredSecrets),
        dungeonUnlockedExits: Array.from(s.unlockedExits),
      };
    }
  }
}
