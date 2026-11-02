import {
  Item,
  Interactable,
  ObjectMaterial,
  PhysicalObjectProperties,
  WeaponProperties,
  ArmorProperties,
  AlchemicalProperties,
  ToolProperties,
  PlayerCharacter,
} from "@grimoire3d/ir";
import { SeededRNG } from "./rules";

// ============================================================================
// ARMS & EQUIPMENT GUIDE: MATERIAL SPECIFICATIONS
// ============================================================================

export interface MaterialSpec {
  hardness: number;
  hpPerInch: number;
  weightMultiplier: number;
  costModifierGp?: number;
  description: string;
}

export const MATERIAL_SPECS: Record<ObjectMaterial, MaterialSpec> = {
  cloth: {
    hardness: 0,
    hpPerInch: 2,
    weightMultiplier: 0.1,
    description: "Cloth and woven fibers; fragile and highly combustible.",
  },
  paper: {
    hardness: 0,
    hpPerInch: 2,
    weightMultiplier: 0.1,
    description: "Parchment, vellum, or paper; extremely delicate.",
  },
  glass: {
    hardness: 1,
    hpPerInch: 2,
    weightMultiplier: 0.8,
    description: "Glass and crystal; brittle and vulnerable to sonic and bludgeoning damage.",
  },
  leather: {
    hardness: 2,
    hpPerInch: 5,
    weightMultiplier: 0.5,
    description: "Cured hide and boiled leather; flexible and resilient.",
  },
  wood: {
    hardness: 5,
    hpPerInch: 10,
    weightMultiplier: 1.0,
    description: "Durable dungeon timber; vulnerable to fire damage.",
  },
  bone: {
    hardness: 6,
    hpPerInch: 10,
    weightMultiplier: 0.8,
    description: "Carved animal or monster bone; lightweight low-tech material.",
  },
  stone: {
    hardness: 8,
    hpPerInch: 15,
    weightMultiplier: 2.5,
    description: "Granite, masonry, and cavern stone; vulnerable to Stonebreaker acid.",
  },
  bronze: {
    hardness: 9,
    hpPerInch: 20,
    weightMultiplier: 2.8,
    description: "Alloy of copper and tin; standard ancient metal.",
  },
  iron: {
    hardness: 10,
    hpPerInch: 30,
    weightMultiplier: 3.0,
    description: "Wrought or cast iron; stalwart dungeon portal and portcullis material.",
  },
  steel: {
    hardness: 10,
    hpPerInch: 30,
    weightMultiplier: 3.0,
    description: "Tempered blade and armor steel; standard adventurer gear material.",
  },
  darkwood: {
    hardness: 5,
    hpPerInch: 10,
    weightMultiplier: 0.5,
    costModifierGp: 3000,
    description: "Rare wood as hard as normal timber but half as heavy.",
  },
  chitin: {
    hardness: 5,
    hpPerInch: 10,
    weightMultiplier: 0.5,
    costModifierGp: 2000,
    description: "Tough giant insect carapace; non-metallic and half weight.",
  },
  mithral: {
    hardness: 15,
    hpPerInch: 30,
    weightMultiplier: 0.5,
    costModifierGp: 1000,
    description: "Shining silver-white true-metal; half weight, highly protective, reduced spell failure.",
  },
  adamantine: {
    hardness: 20,
    hpPerInch: 40,
    weightMultiplier: 1.0,
    costModifierGp: 3000,
    description: "Ultra-dense black star metal; weapons bypass hardness under 20.",
  },
  "baatorian-green-steel": {
    hardness: 12,
    hpPerInch: 30,
    weightMultiplier: 1.0,
    costModifierGp: 2000,
    description: "Green-flecked iron mined from the Nine Hells; +1 natural enhancement to weapon damage.",
  },
  "solanian-truesteel": {
    hardness: 11,
    hpPerInch: 25,
    weightMultiplier: 1.0,
    costModifierGp: 1000,
    description: "Silvery celestial iron from Mount Celestia; +1 bonus on critical hit confirmation rolls.",
  },
  "gehennan-morghuth-iron": {
    hardness: 9,
    hpPerInch: 20,
    weightMultiplier: 1.0,
    costModifierGp: 4000,
    description: "Volcanic fiendish ore from Gehenna; naturally poisonous (DC 12 Fortitude or lose Dex).",
  },
  "elven-darkleaf": {
    hardness: 10,
    hpPerInch: 20,
    weightMultiplier: 0.75,
    costModifierGp: 750,
    description: "Elven armor material; +1 Max Dex, +2 check penalty bonus, -5% arcane spell failure.",
  },
  "elven-leafweave": {
    hardness: 5,
    hpPerInch: 10,
    weightMultiplier: 0.75,
    costModifierGp: 750,
    description: "Light elven armor; +1 Max Dex, +2 check penalty bonus, -5% arcane spell failure.",
  },
  "blended-quartz": {
    hardness: 8,
    hpPerInch: 15,
    weightMultiplier: 2.0,
    costModifierGp: 2000,
    description: "Quartz-infused plate; -20% arcane spell failure, double weight.",
  },
  "astral-driftmetal": {
    hardness: 12,
    hpPerInch: 30,
    weightMultiplier: 1.1,
    costModifierGp: 1000,
    description: "Mined from Astral islands; 25% miss chance bypass against incorporeal foes.",
  },
  urdrukar: {
    hardness: 15,
    hpPerInch: 30,
    weightMultiplier: 1.1,
    costModifierGp: 500,
    description: "Underdark leaden metal; completely shields against divination and scrying.",
  },
  "ysgardian-heartwire": {
    hardness: 10,
    hpPerInch: 30,
    weightMultiplier: 1.0,
    costModifierGp: 1500,
    description: "Resilient spun wire from Ysgard; +2 AC against critical confirmation rolls.",
  },
};

// ============================================================================
// OBJECT DURABILITY & DESTRUCTION
// ============================================================================

export interface DurabilityCalcResult {
  hardness: number;
  maxHp: number;
  breakDc: number;
}

/**
 * Calculates physical hardness, hit points, and break DC according to the Arms & Equipment Guide.
 */
export function calcObjectDurability(
  material: ObjectMaterial = "wood",
  thicknessInches: number = 1,
  type: "door" | "chest" | "lock" | "grate" | "generic" = "generic"
): DurabilityCalcResult {
  const spec = MATERIAL_SPECS[material] || MATERIAL_SPECS.wood;
  const hardness = spec.hardness;
  const maxHp = Math.max(1, Math.round(spec.hpPerInch * thicknessInches));

  let breakDc: number;
  switch (type) {
    case "door":
      if (material === "wood") breakDc = thicknessInches > 1.5 ? 18 : 15;
      else if (material === "iron" || material === "steel") breakDc = 28;
      else if (material === "stone") breakDc = 28;
      else breakDc = 15;
      break;
    case "chest":
      breakDc = material === "iron" || material === "steel" ? 23 : 17;
      break;
    case "lock":
      breakDc = material === "iron" || material === "steel" ? 25 : 20;
      break;
    case "grate":
      breakDc = 26;
      break;
    default:
      breakDc = 10 + Math.round(hardness * 0.8) + Math.min(10, Math.round(thicknessInches * 2));
      break;
  }

  return { hardness, maxHp, breakDc };
}

export interface DamageObjectResult {
  incomingDamage: number;
  effectiveHardness: number;
  damageDealt: number;
  absorbedByHardness: number;
  remainingHp: number;
  isDestroyed: boolean;
  message: string;
}

/**
 * Evaluates damage inflicted on an unattended object or interactable.
 * Implements material hardness, Adamantine hardness bypass, Stonebreaker acid, and energy modifiers.
 */
export function damageObject(
  target: {
    id?: string;
    label?: string;
    hardness?: number;
    hp?: number;
    maxHp?: number;
    material?: ObjectMaterial;
    isBroken?: boolean;
  },
  incomingDamage: number,
  damageType: "slashing" | "piercing" | "bludgeoning" | "fire" | "cold" | "lightning" | "acid" | "sonic" = "slashing",
  attackerWeaponMaterial?: ObjectMaterial,
  attackerItemSubstance?: string
): DamageObjectResult {
  const material = target.material || "wood";
  const spec = MATERIAL_SPECS[material] || MATERIAL_SPECS.wood;
  const baseHardness = target.hardness ?? spec.hardness;
  const currentHp = target.hp ?? target.maxHp ?? spec.hpPerInch;

  // 1. Check Adamantine hardness bypass:
  // Adamantine weapons ignore hardness under 20 (Arms & Equipment Guide p. 12)
  let effectiveHardness = baseHardness;
  if (attackerWeaponMaterial === "adamantine" && baseHardness < 20) {
    effectiveHardness = 0;
  }

  // 2. Check Stonebreaker Acid bypass:
  // Deals direct 3d10 damage to stone objects and completely ignores hardness (Arms & Equipment Guide p. 33)
  if (attackerItemSubstance === "stonebreaker-acid" && material === "stone") {
    effectiveHardness = 0;
  }

  // 3. Energy and Weapon Type Multipliers
  let adjustedDamage = incomingDamage;
  if (damageType === "fire") {
    if (material === "wood" || material === "paper" || material === "cloth") {
      adjustedDamage = incomingDamage * 2; // Vulnerable
    } else if (material === "stone" || material === "iron" || material === "steel") {
      adjustedDamage = Math.floor(incomingDamage * 0.5); // Half damage
    }
  } else if (damageType === "cold") {
    adjustedDamage = Math.floor(incomingDamage * 0.25); // Quarter damage to objects
  } else if (damageType === "lightning") {
    if (material === "iron" || material === "steel" || material === "bronze") {
      adjustedDamage = incomingDamage; // Full to metal
    } else {
      adjustedDamage = Math.floor(incomingDamage * 0.5); // Half to others
    }
  } else if (damageType === "piercing") {
    adjustedDamage = Math.floor(incomingDamage * 0.5); // Piercing attacks ineffective against solid objects
  }

  // 4. Calculate net damage after hardness
  const damageDealt = Math.max(0, adjustedDamage - effectiveHardness);
  const absorbedByHardness = Math.min(adjustedDamage, effectiveHardness);
  const remainingHp = Math.max(0, currentHp - damageDealt);
  const isDestroyed = remainingHp === 0;

  let message = `Struck object for ${incomingDamage} (${damageType}) damage. `;
  if (effectiveHardness === 0 && baseHardness > 0) {
    message += `Hardness (${baseHardness}) was bypassed! `;
  } else if (absorbedByHardness > 0) {
    message += `${absorbedByHardness} damage absorbed by hardness. `;
  }
  message += `${damageDealt} dealt. Remaining integrity: ${remainingHp}/${target.maxHp ?? currentHp} HP.`;
  if (isDestroyed) {
    message += ` Object was smashed and destroyed!`;
  }

  return {
    incomingDamage,
    effectiveHardness,
    damageDealt,
    absorbedByHardness,
    remainingHp,
    isDestroyed,
    message,
  };
}

// ============================================================================
// PHYSICAL CHECKS: FORCING & BREAKING OBJECTS
// ============================================================================

export interface BreakCheckResult {
  roll: number;
  strMod: number;
  toolBonus: number;
  total: number;
  dc: number;
  success: boolean;
  message: string;
}

/**
 * Resolves a Strength check to force open a stuck, barred, or locked door/chest.
 * Incorporates circumstance bonuses from tools like crowbars (+2) or portable rams (+4).
 */
export function resolveBreakAttempt(
  character: PlayerCharacter,
  target: { breakDc?: number; label?: string },
  tool?: Item,
  rng: SeededRNG = new SeededRNG(Date.now())
): BreakCheckResult {
  const roll = rng.rollDice(20);
  const strMod = Math.floor((character.abilities.str - 10) / 2);

  let toolBonus = 0;
  if (tool?.tool?.category === "crowbar") {
    toolBonus = 2; // Arms & Equipment Guide: +2 circumstance bonus on Strength checks to open doors/chests
  } else if (tool?.tool?.category === "portable-ram") {
    toolBonus = 4; // +4 circumstance bonus
  }

  const dc = target.breakDc ?? 15;
  const total = roll + strMod + toolBonus;
  const success = total >= dc;

  let msg = `Break check on ${target.label || "object"}: Rolled ${roll} + STR (${strMod})`;
  if (toolBonus > 0) {
    msg += ` + Tool (${toolBonus})`;
  }
  msg += ` = ${total} vs DC ${dc}. Result: ${success ? "SUCCESS! Object forced open." : "FAILED. Object held fast."}`;

  return {
    roll,
    strMod,
    toolBonus,
    total,
    dc,
    success,
    message: msg,
  };
}

// ============================================================================
// LOCKPICKING MECHANICS
// ============================================================================

export interface LockpickCheckResult {
  roll: number;
  dexMod: number;
  profBonus: number;
  penalty: number;
  total: number;
  dc: number;
  success: boolean;
  message: string;
}

/**
 * Resolves a Dexterity (Sleight of Hand) check using Thieves' Tools to pick a lock.
 * Without thieves' tools, an improvised check suffers a -2 penalty.
 */
export function resolveLockpickAttempt(
  character: PlayerCharacter,
  lockDc: number = 15,
  hasThievesTools: boolean = true,
  rng: SeededRNG = new SeededRNG(Date.now())
): LockpickCheckResult {
  const roll = rng.rollDice(20);
  const dexMod = Math.floor((character.abilities.dex - 10) / 2);
  const isProf = character.class === "rogue" || (character.classFeatures && character.classFeatures.includes("sneak-attack"));
  const profBonus = isProf ? character.proficiencyBonus : 0;
  const penalty = hasThievesTools ? 0 : -2;

  const total = roll + dexMod + profBonus + penalty;
  const success = total >= lockDc;

  let msg = `Lockpicking attempt: Rolled ${roll} + DEX (${dexMod})`;
  if (profBonus > 0) msg += ` + Prof (${profBonus})`;
  if (penalty < 0) msg += ` - Improvised Tools (${penalty})`;
  msg += ` = ${total} vs DC ${lockDc}. Result: ${success ? "SUCCESS! Lock picked cleanly." : "FAILED. Tumblers refused to turn."}`;

  return {
    roll,
    dexMod,
    profBonus,
    penalty,
    total,
    dc: lockDc,
    success,
    message: msg,
  };
}

// ============================================================================
// ALCHEMICAL SUBSTANCES & ITEMS (ARMS & EQUIPMENT GUIDE CHAPTER 2)
// ============================================================================

export interface AlchemicalUseResult {
  substanceType: string;
  effectName: string;
  applied: boolean;
  damage?: number;
  damageType?: string;
  durationRounds?: number;
  saveDc?: number;
  saveSuccess?: boolean;
  message: string;
}

/**
 * Resolves the use of an alchemical substance from the Arms & Equipment Guide.
 */
export function resolveAlchemicalSubstance(
  item: Item,
  target: {
    name?: string;
    material?: ObjectMaterial;
    isUndead?: boolean;
    isVermin?: boolean;
    isPlant?: boolean;
    hasDarkvision?: boolean;
  },
  rng: SeededRNG = new SeededRNG(Date.now())
): AlchemicalUseResult {
  const sub = item.alchemical?.substanceType || "acid-flask";
  const targetName = target.name || "target";

  switch (sub) {
    case "bladefire": {
      // Coated weapon burns for 1d6 rounds, deals +1 fire damage, sheds light as torch
      const dur = rng.rollDice(6);
      return {
        substanceType: sub,
        effectName: "Bladefire Ignition",
        applied: true,
        damage: 1,
        damageType: "fire",
        durationRounds: dur,
        message: `Applied bladefire to weapon. The blade ignites with searing blue fire for ${dur} rounds (+1 fire damage on strikes, sheds light as a torch).`,
      };
    }
    case "acid-flask": {
      const dmg = rng.rollDice(6);
      return {
        substanceType: sub,
        effectName: "Acid Burn",
        applied: true,
        damage: dmg,
        damageType: "acid",
        message: `Shattered acid flask against ${targetName}! Splashes for ${dmg} acid damage (1 splash damage to adjacent).`,
      };
    }
    case "alchemists-fire": {
      const dmg = rng.rollDice(6);
      return {
        substanceType: sub,
        effectName: "Alchemist's Fire",
        applied: true,
        damage: dmg,
        damageType: "fire",
        durationRounds: 2,
        message: `Direct hit with Alchemist's Fire on ${targetName}! Deals ${dmg} fire damage immediately, and continues burning next round.`,
      };
    }
    case "stonebreaker-acid": {
      // Deals 3d10 damage to stone objects and ignores hardness
      const isStone = target.material === "stone";
      const roll1 = rng.rollDice(10);
      const roll2 = rng.rollDice(10);
      const roll3 = rng.rollDice(10);
      const totalDmg = roll1 + roll2 + roll3;
      return {
        substanceType: sub,
        effectName: "Stonebreaker Dissolution",
        applied: true,
        damage: totalDmg,
        damageType: "acid",
        message: isStone
          ? `Poured Stonebreaker Acid on stone structure! Highly corrosive reaction disintegrates stone for ${totalDmg} damage, ignoring hardness!`
          : `Poured Stonebreaker Acid on non-stone target. Mildly acidic, dealing ${Math.floor(totalDmg / 3)} damage.`,
      };
    }
    case "sparkstone": {
      const dmg = rng.rollDice(6);
      return {
        substanceType: sub,
        effectName: "Electrical Spark",
        applied: true,
        damage: dmg,
        damageType: "lightning",
        message: `Struck sparkstone against hard surface! Discharges blinding electrical crackle for ${dmg} lightning damage.`,
      };
    }
    case "verminbane": {
      return {
        substanceType: sub,
        effectName: "Vermin Repellent",
        applied: true,
        durationRounds: 60,
        message: `Ignited verminbane pellet! Emits acrid smoke that repels insect swarms and vermin within a 10-foot radius.`,
      };
    }
    case "gravebane": {
      const dc = 12;
      const saveRoll = rng.rollDice(20);
      const repelled = saveRoll < dc;
      return {
        substanceType: sub,
        effectName: "Undead Barrier",
        applied: repelled,
        saveDc: dc,
        saveSuccess: !repelled,
        message: `Released gravebane aerosol! Undead creatures must make a DC 12 Will check to approach. ${repelled ? "Undead is repelled!" : "Undead resists repellent."}`,
      };
    }
    case "ghostoil": {
      return {
        substanceType: sub,
        effectName: "Ghostoil Blessing",
        applied: true,
        durationRounds: 2,
        message: `Coated weapon with ghostoil. For the next 2 rounds, strikes against incorporeal beings and specters deal full physical damage.`,
      };
    }
    case "clearbreath": {
      return {
        substanceType: sub,
        effectName: "Poison Gas Immunity",
        applied: true,
        durationRounds: 600,
        message: `Inhaled clearbreath vapor. Grants a +5 circumstance bonus on saving throws against inhaled toxins, spores, and troglodyte stench for 1 hour.`,
      };
    }
    case "fleetfoot": {
      return {
        substanceType: sub,
        effectName: "Speed Surge",
        applied: true,
        durationRounds: 10,
        message: `Drank fleetfoot elixir! Adrenaline surges through muscles, granting +10 feet to movement speed for 10 rounds.`,
      };
    }
    default:
      return {
        substanceType: sub,
        effectName: "Generic Alchemical Use",
        applied: true,
        message: `Used alchemical item '${item.name}' against ${targetName}.`,
      };
  }
}

// ============================================================================
// WEAPON & ARMOR CHARACTERISTICS AND COMBAT STATS
// ============================================================================

export interface WeaponCombatStats {
  damageDice: string;
  damageType: string;
  attackBonus: number;
  damageBonus: number;
  critRange: number;
  critMultiplier: number;
  specialProperties: string[];
}

/**
 * Calculates complete attack and damage profiles for a weapon, accounting for
 * Arms and Equipment Guide materials (Baatorian Green Steel, Solanian Truesteel, Gehennan Morghuth-Iron).
 */
export function calcArmsAndEquipmentWeapon(
  weapon: Item,
  character: PlayerCharacter
): WeaponCombatStats {
  const wp = weapon.weapon;
  const damageDice = wp?.damageDice || "1d8";
  const damageType = wp?.damageType || "slashing";
  const material = wp?.material || "steel";

  const isFinesse = wp?.properties?.includes("finesse");
  const strMod = Math.floor((character.abilities.str - 10) / 2);
  const dexMod = Math.floor((character.abilities.dex - 10) / 2);
  const primaryMod = isFinesse ? Math.max(strMod, dexMod) : strMod;

  let attackBonus = primaryMod + character.proficiencyBonus + (wp?.enhancementBonus || 0);
  let damageBonus = primaryMod + (wp?.enhancementBonus || 0);
  let critRange = wp?.critRange || 20;
  let critMultiplier = wp?.critMultiplier || 2;
  const specialProperties = [...(wp?.properties || [])];

  // Material rules from Arms & Equipment Guide Chapter 1:
  if (material === "baatorian-green-steel") {
    // +1 natural enhancement bonus to weapon damage
    damageBonus += 1;
    specialProperties.push("baatorian-keen (+1 damage)");
  } else if (material === "solanian-truesteel") {
    // +1 bonus on confirmation roll for critical hits
    specialProperties.push("celestial-truesteel (+1 crit confirm)");
  } else if (material === "gehennan-morghuth-iron") {
    // -1 attack and damage, naturally delivers DC 12 poison
    attackBonus -= 1;
    damageBonus -= 1;
    specialProperties.push("morghuth-poison (DC 12 Fort or lose Dex)");
  }

  return {
    damageDice,
    damageType,
    attackBonus,
    damageBonus,
    critRange,
    critMultiplier,
    specialProperties,
  };
}

export interface ArmorCombatStats {
  totalAcBonus: number;
  maxDexBonus: number | null;
  armorCheckPenalty: number;
  arcaneSpellFailure: number;
  weightLbs: number;
  specialAbilities: string[];
}

/**
 * Calculates armor stats, applying material modifications from the Arms & Equipment Guide
 * (e.g., Mithral, Elven Darkleaf, Blended Quartz, Chitin, Ysgardian Heartwire).
 */
export function calcArmsAndEquipmentArmor(armor: Item): ArmorCombatStats {
  const ap = armor.armor;
  const material = ap?.material || "steel";
  const spec = MATERIAL_SPECS[material] || MATERIAL_SPECS.steel;

  let totalAcBonus = ap?.acBonus || 2;
  let maxDexBonus = ap?.maxDexBonus ?? null;
  let armorCheckPenalty = ap?.armorCheckPenalty || 0;
  let arcaneSpellFailure = ap?.arcaneSpellFailure || 0;
  let weightLbs = Math.round(20 * spec.weightMultiplier);
  const specialAbilities = [...(ap?.specialAbilities || [])];

  // Material rules from Arms & Equipment Guide Table 1-11:
  if (material === "mithral") {
    // Max Dex +2, check penalty reduced by 3, arcane spell failure -10%, half weight
    if (maxDexBonus !== null) maxDexBonus += 2;
    armorCheckPenalty = Math.min(0, armorCheckPenalty + 3);
    arcaneSpellFailure = Math.max(0, arcaneSpellFailure - 10);
    specialAbilities.push("mithral-agility");
  } else if (material === "elven-darkleaf" || material === "elven-leafweave") {
    // Max Dex +1, check penalty +2 bonus (less penalty), spell failure -5%
    if (maxDexBonus !== null) maxDexBonus += 1;
    armorCheckPenalty = Math.min(0, armorCheckPenalty + 2);
    arcaneSpellFailure = Math.max(0, arcaneSpellFailure - 5);
    specialAbilities.push("elven-flexibility");
  } else if (material === "blended-quartz") {
    // Arcane spell failure -20%, weight x2
    arcaneSpellFailure = Math.max(0, arcaneSpellFailure - 20);
    weightLbs *= 2;
    specialAbilities.push("quartz-dispersion");
  } else if (material === "chitin") {
    // Druid usable (non-metal), half weight
    specialAbilities.push("chitin-organic (druid permitted)");
  } else if (material === "ysgardian-heartwire") {
    specialAbilities.push("heartwire-ward (+2 AC vs crit confirm)");
  }

  return {
    totalAcBonus,
    maxDexBonus,
    armorCheckPenalty,
    arcaneSpellFailure,
    weightLbs,
    specialAbilities,
  };
}

// ============================================================================
// STANDARD ARMS & EQUIPMENT CATALOG
// ============================================================================

export const STANDARD_EQUIPMENT_CATALOG: Item[] = [
  // --- Weapons ---
  {
    id: "item-longsword",
    name: "Steel Longsword",
    type: "weapon",
    description: "A standard double-edged martial blade crafted of tempered steel.",
    valueCoins: 15,
    physical: { material: "steel", hardness: 10, hp: 5, thicknessInches: 0.25, weightLbs: 3 },
    weapon: { damageDice: "1d8", damageType: "slashing", properties: ["versatile"], material: "steel" },
  },
  {
    id: "item-baatorian-dagger",
    name: "Baatorian Green Steel Dagger",
    type: "weapon",
    description: "An infernal blade forged of emerald-flecked steel from the Nine Hells. Unnaturally sharp.",
    valueCoins: 2002,
    physical: { material: "baatorian-green-steel", hardness: 12, hp: 4, thicknessInches: 0.2, weightLbs: 1 },
    weapon: { damageDice: "1d4", damageType: "piercing", properties: ["finesse", "light", "thrown"], material: "baatorian-green-steel" },
  },
  {
    id: "item-adamantine-greatsword",
    name: "Adamantine Greatsword",
    type: "weapon",
    description: "A massive two-handed sword forged of black starmetal. Slices through stone and iron doors effortlessly.",
    valueCoins: 3050,
    physical: { material: "adamantine", hardness: 20, hp: 20, thicknessInches: 0.5, weightLbs: 6 },
    weapon: { damageDice: "2d6", damageType: "slashing", properties: ["heavy", "two-handed"], material: "adamantine" },
  },

  // --- Armor ---
  {
    id: "item-mithral-shirt",
    name: "Mithral Chain Shirt",
    type: "armor",
    description: "A lightweight shirt of interlocking silvery rings worn under normal clothes.",
    valueCoins: 1100,
    physical: { material: "mithral", hardness: 15, hp: 15, weightLbs: 10 },
    armor: { armorCategory: "light", acBonus: 4, maxDexBonus: 6, armorCheckPenalty: 0, arcaneSpellFailure: 10, material: "mithral" },
  },
  {
    id: "item-darkleaf-breastplate",
    name: "Elven Darkleaf Breastplate",
    type: "armor",
    description: "Form-fitted armor fashioned from cured leaves and wood by elven artisans.",
    valueCoins: 1150,
    physical: { material: "elven-darkleaf", hardness: 10, hp: 15, weightLbs: 15 },
    armor: { armorCategory: "medium", acBonus: 5, maxDexBonus: 3, armorCheckPenalty: -2, arcaneSpellFailure: 15, material: "elven-darkleaf" },
  },

  // --- Tools & Exploration Gear ---
  {
    id: "item-crowbar",
    name: "Iron Crowbar",
    type: "tool",
    description: "A sturdy iron pry-bar that grants a +2 circumstance bonus on Strength checks to burst open doors and chests.",
    valueCoins: 2,
    physical: { material: "iron", hardness: 10, hp: 10, weightLbs: 5 },
    tool: { category: "crowbar", bonusSkill: "athletics", bonusAmount: 2 },
  },
  {
    id: "item-thieves-tools",
    name: "Thieves' Tools",
    type: "tool",
    description: "A leather pouch containing lockpicks, small wire saws, skeleton keys, and tension wrenches.",
    valueCoins: 25,
    physical: { material: "steel", hardness: 10, hp: 5, weightLbs: 1 },
    tool: { category: "thieves-tools", bonusSkill: "sleight-of-hand", bonusAmount: 2 },
  },
  {
    id: "item-listening-cone",
    name: "Listening Cone",
    type: "tool",
    description: "A superior brass cone designed for eavesdropping through wooden doors and stone walls.",
    valueCoins: 20,
    physical: { material: "bronze", hardness: 9, hp: 3, weightLbs: 1 },
    tool: { category: "listening-cone", bonusSkill: "perception", bonusAmount: 2 },
  },

  // --- Alchemical Consumables ---
  {
    id: "item-bladefire",
    name: "Flask of Bladefire",
    type: "alchemical",
    description: "An adhesive alchemical oil that ignites blades for 1d6 rounds without harming the steel.",
    valueCoins: 20,
    physical: { material: "glass", hardness: 1, hp: 2, weightLbs: 1 },
    alchemical: { substanceType: "bladefire", damageDice: "1", damageType: "fire", durationRounds: 4 },
  },
  {
    id: "item-stonebreaker-acid",
    name: "Flask of Stonebreaker Acid",
    type: "alchemical",
    description: "A corrosive green chemical that aggressively dissolves masonry and stone structures, bypassing hardness.",
    valueCoins: 20,
    physical: { material: "glass", hardness: 1, hp: 2, weightLbs: 1 },
    alchemical: { substanceType: "stonebreaker-acid", damageDice: "3d10", damageType: "acid" },
  },
  {
    id: "item-gravebane",
    name: "Gravebane Pellet",
    type: "alchemical",
    description: "A pungent incense that creates an invisible ward repelling skeletons, zombies, and lesser undead.",
    valueCoins: 50,
    physical: { material: "cloth", hardness: 0, hp: 1, weightLbs: 0.5 },
    alchemical: { substanceType: "gravebane", saveDc: 12 },
  },
];
