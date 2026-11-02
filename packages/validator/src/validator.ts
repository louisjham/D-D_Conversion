import {
  VersionedAdventure,
  VersionedAdventureSchema,
  Location,
  Exit,
  Condition,
  Item,
  resolveItem,
  getItem,
  ITEM_REGISTRY,
} from "@grimoire3d/ir";
import { getSpell } from "@grimoire3d/spell-core";
import {
  analyzeCombatWinnability,
  WinnabilityOptions,
  EncounterDifficultyReport,
} from "./combatWinnability";

export { analyzeCombatWinnability };
export type { WinnabilityOptions, EncounterDifficultyReport };

export type ValidationIssue = {
  code: string;
  severity: "error" | "warning" | "info";
  entityType: "location" | "exit" | "item" | "secret" | "encounter" | "npc" | "quest" | "adventure";
  entityId: string;
  message: string;
  suggestedFix?: string;
  provenanceRefs?: string[];
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

export interface ValidatorOptions extends WinnabilityOptions {
  checkCombatWinnability?: boolean;
}

export function validateAdventure(versionedAdv: unknown, options?: ValidatorOptions): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Zod Schema Validation
  const parseResult = VersionedAdventureSchema.safeParse(versionedAdv);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      issues.push({
        code: "SCHEMA_PARSE_ERROR",
        severity: "error",
        entityType: "adventure",
        entityId: "root",
        message: `Schema error at ${issue.path.join(".")}: ${issue.message}`,
        suggestedFix: "Check required fields and correct data types in the JSON envelope.",
      });
    }
    return { valid: false, issues };
  }

  const vAdventure = parseResult.data as VersionedAdventure;
  const adv = vAdventure.adventure;

  // Build ID lookup tables
  const locationMap = new Map<string, Location>();
  const itemSet = new Set<string>();
  const monsterSet = new Set<string>();
  const npcSet = new Set<string>();
  const exitSet = new Set<string>();
  const secretSet = new Set<string>();
  const settableFlags = new Set<string>();

  // Collect flags set by effects across interactables, encounters, secrets, quests
  for (const loc of adv.locations) {
    for (const inter of loc.interactables) {
      if (inter.onInspectEffects) {
        for (const eff of inter.onInspectEffects) {
          if (eff.kind === "setFlag") settableFlags.add(eff.flag);
        }
      }
    }

    for (const sec of loc.secrets) {
      settableFlags.add(`${sec.id}-discovered`);
      if (sec.revealsExitId) {
        const exit = loc.exits.find((e) => e.id === sec.revealsExitId);
        if (exit && exit.visibleWhen?.kind === "flag") {
          settableFlags.add(exit.visibleWhen.flag);
        }
      }
    }

    if (loc.encounter) {
      if (loc.encounter.victoryEffects) {
        for (const eff of loc.encounter.victoryEffects) {
          if (eff.kind === "setFlag") settableFlags.add(eff.flag);
        }
      }
    }
  }

  for (const quest of adv.quests) {
    for (const eff of quest.rewards) {
      if (eff.kind === "setFlag") settableFlags.add(eff.flag);
    }
  }

  // Also implicit flags set on escapes/wins
  settableFlags.add("escaped-crypt");
  settableFlags.add("quest-complete-escape-crypt");

  // Validate items
  for (const item of adv.items) {
    if (itemSet.has(item.id)) {
      issues.push({
        code: "DUPLICATE_ITEM_ID",
        severity: "error",
        entityType: "item",
        entityId: item.id,
        message: `Duplicate item ID: '${item.id}'`,
        suggestedFix: `Rename item ID '${item.id}' to a unique string.`,
        provenanceRefs: item.provenance ? [item.provenance.sourceId] : undefined,
      });
    }
    itemSet.add(item.id);

    // Flag registry ID collisions: a custom item using an id that exists in the registry must be intentional
    const registryItem = ITEM_REGISTRY[item.id];
    if (registryItem) {
      const diffFields: string[] = [];
      const fieldsToCheck: (keyof Item)[] = [
        "name",
        "type",
        "description",
        "valueCoins",
        "physical",
        "weapon",
        "armor",
        "alchemical",
        "tool",
        "magic",
      ];
      for (const field of fieldsToCheck) {
        if (JSON.stringify(item[field]) !== JSON.stringify(registryItem[field])) {
          diffFields.push(field);
        }
      }
      if (diffFields.length > 0) {
        issues.push({
          code: "ITEM_ID_SHADOWS_REGISTRY",
          severity: "warning",
          entityType: "item",
          entityId: item.id,
          message: `Custom item '${item.id}' shadows canonical registry item with differing fields: ${diffFields.join(", ")}`,
          suggestedFix: `Confirm if overriding canonical item '${item.id}' is intended, or assign a unique custom ID.`,
          provenanceRefs: item.provenance ? [item.provenance.sourceId] : undefined,
        });
      }
    }
  }

  const isValidItemRef = (itemId: string): boolean => {
    if (itemSet.has(itemId)) return true;
    if (resolveItem(itemId, adv)) return true;
    return false;
  };

  // Validate quest item references
  for (const quest of adv.quests) {
    if (quest.completionCondition.kind === "hasItem" && !isValidItemRef(quest.completionCondition.itemId)) {
      issues.push({
        code: "UNKNOWN_ITEM_REFERENCE",
        severity: "error",
        entityType: "quest",
        entityId: quest.id,
        message: `Quest '${quest.id}' completion condition requires unknown item ID '${quest.completionCondition.itemId}'.`,
        suggestedFix: `Add item '${quest.completionCondition.itemId}' to adventure items or use a canonical registry item ID.`,
      });
    }
    for (const eff of quest.rewards) {
      if (eff.kind === "grantItem" && !isValidItemRef(eff.itemId)) {
        issues.push({
          code: "UNKNOWN_ITEM_REFERENCE",
          severity: "error",
          entityType: "quest",
          entityId: quest.id,
          message: `Quest '${quest.id}' reward grants unknown item ID '${eff.itemId}'.`,
          suggestedFix: `Add item '${eff.itemId}' to adventure items or use a canonical registry item ID.`,
        });
      }
    }
  }

  // Validate monsters
  for (const mon of adv.monsters) {
    if (monsterSet.has(mon.id)) {
      issues.push({
        code: "DUPLICATE_MONSTER_ID",
        severity: "error",
        entityType: "encounter",
        entityId: mon.id,
        message: `Duplicate monster template ID: '${mon.id}'`,
        suggestedFix: `Ensure monster IDs are unique across the adventure.`,
      });
    }
    monsterSet.add(mon.id);
  }

  // Validate NPCs
  for (const npc of adv.npcs) {
    if (npcSet.has(npc.id)) {
      issues.push({
        code: "DUPLICATE_NPC_ID",
        severity: "error",
        entityType: "npc",
        entityId: npc.id,
        message: `Duplicate NPC ID: '${npc.id}'`,
        suggestedFix: `Use unique NPC identifiers.`,
      });
    }
    npcSet.add(npc.id);
  }

  // Validate locations
  for (const loc of adv.locations) {
    if (locationMap.has(loc.id)) {
      issues.push({
        code: "DUPLICATE_LOCATION_ID",
        severity: "error",
        entityType: "location",
        entityId: loc.id,
        message: `Duplicate location ID: '${loc.id}'`,
        suggestedFix: `Assign a unique location ID to '${loc.label}'.`,
        provenanceRefs: loc.provenance ? [loc.provenance.sourceId] : undefined,
      });
    }
    locationMap.set(loc.id, loc);

    for (const exit of loc.exits) {
      if (exitSet.has(exit.id)) {
        issues.push({
          code: "DUPLICATE_EXIT_ID",
          severity: "error",
          entityType: "exit",
          entityId: exit.id,
          message: `Duplicate exit ID: '${exit.id}' in location '${loc.id}'`,
          suggestedFix: `Ensure all exit IDs are unique across all locations.`,
        });
      }
      exitSet.add(exit.id);

      // Check condition flags
      if (exit.visibleWhen?.kind === "flag") {
        if (!settableFlags.has(exit.visibleWhen.flag)) {
          issues.push({
            code: "UNSATISFIABLE_CONDITION_FLAG",
            severity: "error",
            entityType: "exit",
            entityId: exit.id,
            message: `Exit '${exit.id}' requires flag '${exit.visibleWhen.flag}' which no secret, interactable, or encounter sets.`,
            suggestedFix: `Add an interactable or secret that sets flag '${exit.visibleWhen.flag}'.`,
            provenanceRefs: exit.provenance ? [exit.provenance.sourceId] : undefined,
          });
        }
      }

      if (exit.locked?.requiredFlag) {
        if (!settableFlags.has(exit.locked.requiredFlag)) {
          issues.push({
            code: "UNSATISFIABLE_CONDITION_FLAG",
            severity: "error",
            entityType: "exit",
            entityId: exit.id,
            message: `Locked exit '${exit.id}' requires flag '${exit.locked.requiredFlag}' which is never set.`,
            suggestedFix: `Ensure a room interactable or encounter grants flag '${exit.locked.requiredFlag}'.`,
          });
        }
      }
    }

    for (const secret of loc.secrets) {
      if (secretSet.has(secret.id)) {
        issues.push({
          code: "DUPLICATE_SECRET_ID",
          severity: "error",
          entityType: "secret",
          entityId: secret.id,
          message: `Duplicate secret ID: '${secret.id}' in location '${loc.id}'`,
          suggestedFix: `Rename duplicate secret ID.`,
        });
      }
      secretSet.add(secret.id);
    }
  }

  // 2. Start Location Check
  if (!locationMap.has(adv.start)) {
    issues.push({
      code: "INVALID_START_LOCATION",
      severity: "error",
      entityType: "adventure",
      entityId: adv.id,
      message: `Start location '${adv.start}' does not exist in adventure locations.`,
      suggestedFix: `Set 'start' property to a valid location ID.`,
    });
  }

  // 3. Exit Target & Lock Reference Checks
  for (const loc of adv.locations) {
    for (const exit of loc.exits) {
      if (!locationMap.has(exit.target)) {
        issues.push({
          code: "DANGLING_EXIT_TARGET",
          severity: "error",
          entityType: "exit",
          entityId: exit.id,
          message: `Exit '${exit.id}' in '${loc.id}' targets non-existent location '${exit.target}'.`,
          suggestedFix: `Update exit target to an existing location ID or remove the exit.`,
          provenanceRefs: exit.provenance ? [exit.provenance.sourceId] : undefined,
        });
      }

      if (exit.locked?.keyItemId && !isValidItemRef(exit.locked.keyItemId)) {
        issues.push({
          code: "UNKNOWN_ITEM_REFERENCE",
          severity: "error",
          entityType: "exit",
          entityId: exit.id,
          message: `Locked exit '${exit.id}' references non-existent key item ID '${exit.locked.keyItemId}'.`,
          suggestedFix: `Add '${exit.locked.keyItemId}' to adventure items or use a canonical registry item ID.`,
        });
      }

      if (exit.visibleWhen?.kind === "hasItem" && !isValidItemRef(exit.visibleWhen.itemId)) {
        issues.push({
          code: "UNKNOWN_ITEM_REFERENCE",
          severity: "error",
          entityType: "exit",
          entityId: exit.id,
          message: `Exit '${exit.id}' visibleWhen condition requires unknown item ID '${exit.visibleWhen.itemId}'.`,
          suggestedFix: `Add '${exit.visibleWhen.itemId}' to adventure items or use a canonical registry item ID.`,
        });
      }
    }

    for (const secret of loc.secrets) {
      if (secret.revealsExitId && !exitSet.has(secret.revealsExitId)) {
        issues.push({
          code: "DANGLING_SECRET_EXIT_REFERENCE",
          severity: "error",
          entityType: "secret",
          entityId: secret.id,
          message: `Secret '${secret.id}' references non-existent exit ID '${secret.revealsExitId}'.`,
          suggestedFix: `Point revealsExitId to a valid exit in '${loc.id}'.`,
        });
      }
      if (secret.grantsItemId && !isValidItemRef(secret.grantsItemId)) {
        issues.push({
          code: "UNKNOWN_ITEM_REFERENCE",
          severity: "error",
          entityType: "secret",
          entityId: secret.id,
          message: `Secret '${secret.id}' grants non-existent item ID '${secret.grantsItemId}'.`,
          suggestedFix: `Define item '${secret.grantsItemId}' in adventure items or use a canonical registry item ID.`,
        });
      }
    }

    for (const inter of loc.interactables) {
      if (inter.onInspectEffects) {
        for (const eff of inter.onInspectEffects) {
          if (eff.kind === "grantItem" && !isValidItemRef(eff.itemId)) {
            issues.push({
              code: "UNKNOWN_ITEM_REFERENCE",
              severity: "error",
              entityType: "location",
              entityId: loc.id,
              message: `Interactable '${inter.id}' grants non-existent item ID '${eff.itemId}'.`,
              suggestedFix: `Add item '${eff.itemId}' to adventure items or use a canonical registry item ID.`,
            });
          }
        }
      }
    }

    if (loc.encounter) {
      for (const enemy of loc.encounter.enemies) {
        if (!monsterSet.has(enemy.monsterTemplateId)) {
          issues.push({
            code: "MISSING_MONSTER_TEMPLATE",
            severity: "error",
            entityType: "encounter",
            entityId: loc.encounter.id,
            message: `Encounter '${loc.encounter.id}' in '${loc.id}' references non-existent monster '${enemy.monsterTemplateId}'.`,
            suggestedFix: `Add monster template '${enemy.monsterTemplateId}' to adventure monsters.`,
          });
        }
      }

      // Check if encounter trigger condition is unachievable
      if (loc.encounter.trigger.kind === "flag") {
        if (!settableFlags.has(loc.encounter.trigger.flag)) {
          issues.push({
            code: "UNREACHABLE_ENCOUNTER",
            severity: "warning",
            entityType: "encounter",
            entityId: loc.encounter.id,
            message: `Encounter '${loc.encounter.id}' requires flag '${loc.encounter.trigger.flag}' which is never set.`,
            suggestedFix: `Set trigger to 'always' or ensure flag '${loc.encounter.trigger.flag}' can be set.`,
          });
        }
      }

      if (loc.encounter.trigger.kind === "hasItem" && !isValidItemRef(loc.encounter.trigger.itemId)) {
        issues.push({
          code: "UNKNOWN_ITEM_REFERENCE",
          severity: "error",
          entityType: "encounter",
          entityId: loc.encounter.id,
          message: `Encounter '${loc.encounter.id}' in '${loc.id}' trigger requires unknown item ID '${loc.encounter.trigger.itemId}'.`,
          suggestedFix: `Add item '${loc.encounter.trigger.itemId}' to adventure items or use a canonical registry item ID.`,
        });
      }

      if (loc.encounter.victoryEffects) {
        for (const eff of loc.encounter.victoryEffects) {
          if (eff.kind === "grantItem" && !isValidItemRef(eff.itemId)) {
            issues.push({
              code: "UNKNOWN_ITEM_REFERENCE",
              severity: "error",
              entityType: "encounter",
              entityId: loc.encounter.id,
              message: `Encounter '${loc.encounter.id}' victory effect grants unknown item ID '${eff.itemId}'.`,
              suggestedFix: `Add item '${eff.itemId}' to adventure items or use a canonical registry item ID.`,
            });
          }
        }
      }

      if (loc.encounter.defeatEffects) {
        for (const eff of loc.encounter.defeatEffects) {
          if (eff.kind === "grantItem" && !isValidItemRef(eff.itemId)) {
            issues.push({
              code: "UNKNOWN_ITEM_REFERENCE",
              severity: "error",
              entityType: "encounter",
              entityId: loc.encounter.id,
              message: `Encounter '${loc.encounter.id}' defeat effect grants unknown item ID '${eff.itemId}'.`,
              suggestedFix: `Add item '${eff.itemId}' to adventure items or use a canonical registry item ID.`,
            });
          }
        }
      }
    }
  }

  // 3b. Spell Reference Validation
  const customSpells = new Set<string>();
  if (adv.spells) {
    for (const s of adv.spells) {
      customSpells.add(s.id);
      customSpells.add(s.name.toLowerCase());
    }
  }

  const isValidSpellRef = (spellId: string): boolean => {
    if (customSpells.has(spellId) || customSpells.has(spellId.toLowerCase())) return true;
    if (getSpell(spellId)) return true;
    return false;
  };

  // Validate NPCs spell references
  for (const npc of adv.npcs) {
    if (npc.spellIds) {
      for (const spellId of npc.spellIds) {
        if (!isValidSpellRef(spellId)) {
          issues.push({
            code: "UNKNOWN_SPELL_REFERENCE",
            severity: "error",
            entityType: "npc",
            entityId: npc.id,
            message: `NPC '${npc.id}' references unknown spell '${spellId}'.`,
            suggestedFix: `Add spell '${spellId}' to adventure.spells or use a valid canonical spell ID.`,
          });
        }
      }
    }
  }

  // Validate Locations (encounters, interactables, hazards) spell references
  for (const loc of adv.locations) {
    if (loc.encounter?.spellIds) {
      for (const spellId of loc.encounter.spellIds) {
        if (!isValidSpellRef(spellId)) {
          issues.push({
            code: "UNKNOWN_SPELL_REFERENCE",
            severity: "error",
            entityType: "encounter",
            entityId: loc.encounter.id,
            message: `Encounter '${loc.encounter.id}' in '${loc.id}' references unknown spell '${spellId}'.`,
            suggestedFix: `Add spell '${spellId}' to adventure.spells or use a valid canonical spell ID.`,
          });
        }
      }
    }

    for (const inter of loc.interactables) {
      if (inter.spellIds) {
        for (const spellId of inter.spellIds) {
          if (!isValidSpellRef(spellId)) {
            issues.push({
              code: "UNKNOWN_SPELL_REFERENCE",
              severity: "error",
              entityType: "location",
              entityId: loc.id,
              message: `Interactable '${inter.id}' in '${loc.id}' references unknown spell '${spellId}'.`,
              suggestedFix: `Add spell '${spellId}' to adventure.spells or use a valid canonical spell ID.`,
            });
          }
        }
      }
    }

    if (loc.boundaries?.hazards) {
      for (const hazard of loc.boundaries.hazards) {
        if (hazard.spellIds) {
          for (const spellId of hazard.spellIds) {
            if (!isValidSpellRef(spellId)) {
              issues.push({
                code: "UNKNOWN_SPELL_REFERENCE",
                severity: "error",
                entityType: "location",
                entityId: loc.id,
                message: `Hazard '${hazard.id}' in '${loc.id}' references unknown spell '${spellId}'.`,
                suggestedFix: `Add spell '${spellId}' to adventure.spells or use a valid canonical spell ID.`,
              });
            }
          }
        }
      }
    }
  }

  // 4. Graph Reachability (Static Structural Check)
  const reachableFromStart = new Set<string>();
  if (locationMap.has(adv.start)) {
    const queue = [adv.start];
    reachableFromStart.add(adv.start);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const loc = locationMap.get(currentId);
      if (!loc) continue;

      for (const exit of loc.exits) {
        if (!reachableFromStart.has(exit.target)) {
          reachableFromStart.add(exit.target);
          queue.push(exit.target);
        }
      }
    }

    for (const [locId, loc] of locationMap.entries()) {
      if (!reachableFromStart.has(locId)) {
        issues.push({
          code: "ORPHAN_LOCATION",
          severity: "warning",
          entityType: "location",
          entityId: locId,
          message: `Location '${loc.label}' (${locId}) is not reachable from start location '${adv.start}'.`,
          suggestedFix: `Add an exit leading to location '${locId}' from a reachable room.`,
          provenanceRefs: loc.provenance ? [loc.provenance.sourceId] : undefined,
        });
      }
    }
  }

  // 5. State-Space Lock/Key & Solvability Search
  const stateSpaceAnalysis = analyzeStateSpaceSolvability(adv, locationMap);
  for (const issue of stateSpaceAnalysis) {
    issues.push(issue);
  }

  // 6. Combat Winnability & Difficulty Analysis
  if (options?.checkCombatWinnability ?? true) {
    const combatAnalysis = analyzeCombatWinnability(vAdventure, options);
    for (const issue of combatAnalysis.issues) {
      issues.push(issue);
    }
  }

  const hasErrors = issues.some((i) => i.severity === "error");
  return { valid: !hasErrors, issues };
}

/**
 * State-space search over (locationId, inventoryItems, setFlags) with safety depth cap.
 */
function analyzeStateSpaceSolvability(adv: any, locationMap: Map<string, Location>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!locationMap.has(adv.start)) return issues;

  const reachableKeys = new Set<string>();
  const visitedStates = new Set<string>();

  type State = {
    locationId: string;
    inventory: Set<string>;
    flags: Set<string>;
  };

  const initialState: State = {
    locationId: adv.start,
    inventory: new Set<string>(),
    flags: new Set<string>(),
  };

  const queue: State[] = [initialState];
  const MAX_STATE_SPACE = 5000;
  let statesExplored = 0;
  let stateSpaceTruncated = false;

  while (queue.length > 0) {
    statesExplored++;
    if (statesExplored > MAX_STATE_SPACE) {
      stateSpaceTruncated = true;
      break;
    }

    const state = queue.shift()!;
    const stateKey = `${state.locationId}|${Array.from(state.inventory).sort().join(",")}|${Array.from(state.flags).sort().join(",")}`;
    if (visitedStates.has(stateKey)) continue;
    visitedStates.add(stateKey);

    const loc = locationMap.get(state.locationId);
    if (!loc) continue;

    const nextInventory = new Set(state.inventory);
    const nextFlags = new Set(state.flags);

    // Collect interactables in current room
    for (const inter of loc.interactables) {
      if (inter.onInspectEffects) {
        for (const eff of inter.onInspectEffects) {
          if (eff.kind === "grantItem") {
            nextInventory.add(eff.itemId);
            reachableKeys.add(eff.itemId);
          } else if (eff.kind === "setFlag" && eff.value) {
            nextFlags.add(eff.flag);
          }
        }
      }
    }

    // Collect secrets in current room
    for (const secret of loc.secrets) {
      nextFlags.add(`${secret.id}-discovered`);
      if (secret.revealsExitId) {
        const exit = loc.exits.find((e) => e.id === secret.revealsExitId);
        if (exit && exit.visibleWhen?.kind === "flag") {
          nextFlags.add(exit.visibleWhen.flag);
        }
      }
      if (secret.grantsItemId) {
        nextInventory.add(secret.grantsItemId);
        reachableKeys.add(secret.grantsItemId);
      }
    }

    // Collect encounter victory effects
    if (loc.encounter && loc.encounter.victoryEffects) {
      for (const eff of loc.encounter.victoryEffects) {
        if (eff.kind === "grantItem") {
          nextInventory.add(eff.itemId);
          reachableKeys.add(eff.itemId);
        } else if (eff.kind === "setFlag" && eff.value) {
          nextFlags.add(eff.flag);
        }
      }
    }

    // Explore Exits
    for (const exit of loc.exits) {
      if (exit.visibleWhen?.kind === "flag" && !nextFlags.has(exit.visibleWhen.flag)) {
        continue; // Secret exit hidden
      }

      let canPass = true;
      if (exit.locked) {
        const keyReq = exit.locked.keyItemId;
        const flagReq = exit.locked.requiredFlag;

        if (keyReq && !nextInventory.has(keyReq) && !exit.locked.pickable) {
          canPass = false;
        }
        if (flagReq && !nextFlags.has(flagReq)) {
          canPass = false;
        }
      }

      if (canPass && locationMap.has(exit.target)) {
        queue.push({
          locationId: exit.target,
          inventory: nextInventory,
          flags: nextFlags,
        });
      }
    }
  }

  if (stateSpaceTruncated) {
    issues.push({
      code: "STATE_SPACE_TRUNCATED",
      severity: "warning",
      entityType: "adventure",
      entityId: adv.id,
      message: `State-space analysis reached max limit (${MAX_STATE_SPACE} states explored). Solvability check incomplete.`,
      suggestedFix: `Simplify state dependencies or review flag cycles.`,
    });
  }

  // Check for locked exits whose key is never reachable
  for (const loc of adv.locations) {
    for (const exit of loc.exits) {
      if (exit.locked?.keyItemId) {
        const keyId = exit.locked.keyItemId;
        if (!reachableKeys.has(keyId) && !exit.locked.pickable) {
          issues.push({
            code: "UNSOLVABLE_LOCK_KEY_UNREACHABLE",
            severity: "error",
            entityType: "exit",
            entityId: exit.id,
            message: `Locked exit '${exit.id}' requires key '${keyId}' which is never reachable in state-space search.`,
            suggestedFix: `Place key item '${keyId}' in an accessible room before exit '${exit.id}'.`,
          });
        }
      }
    }
  }

  return issues;
}
