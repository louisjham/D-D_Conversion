import React from "react";

export type AssetCategory = "biome" | "door" | "interactable" | "monster" | "hero";

export interface AssetSpec {
  id: string;
  name: string;
  category: AssetCategory;
  primaryColor: string;
  secondaryColor: string;
  patternId?: string;
  iconName: string;
  svgPath?: string;
}

export const ASSET_CATALOG: Record<string, AssetSpec> = {
  // --- Biomes & Floors ---
  crypt: {
    id: "crypt",
    name: "Crypt Flagstone",
    category: "biome",
    primaryColor: "#0f172a",
    secondaryColor: "#334155",
    patternId: "pattern-crypt-tiles",
    iconName: "Castle",
  },
  cavern: {
    id: "cavern",
    name: "Cavern Rock Floor",
    category: "biome",
    primaryColor: "#172554",
    secondaryColor: "#1e3a8a",
    patternId: "pattern-cavern-rock",
    iconName: "Mountain",
  },
  keep: {
    id: "keep",
    name: "Castle Keep Paving",
    category: "biome",
    primaryColor: "#1e1b4b",
    secondaryColor: "#312e81",
    patternId: "pattern-keep-paving",
    iconName: "Castle",
  },
  forest: {
    id: "forest",
    name: "Woodland Turf",
    category: "biome",
    primaryColor: "#064e3b",
    secondaryColor: "#047857",
    patternId: "pattern-forest-turf",
    iconName: "Trees",
  },

  // --- Doors & Exits ---
  "door-wooden": {
    id: "door-wooden",
    name: "Heavy Oak Door",
    category: "door",
    primaryColor: "#b45309",
    secondaryColor: "#78350f",
    iconName: "DoorClosed",
  },
  "door-locked": {
    id: "door-locked",
    name: "Locked Iron Gate",
    category: "door",
    primaryColor: "#f59e0b",
    secondaryColor: "#b45309",
    iconName: "Lock",
  },
  "door-secret": {
    id: "door-secret",
    name: "Concealed Brick Wall",
    category: "door",
    primaryColor: "#8b5cf6",
    secondaryColor: "#6d28d9",
    iconName: "Eye",
  },

  // --- Interactables & Objects ---
  chest: {
    id: "chest",
    name: "Reinforced Chest",
    category: "interactable",
    primaryColor: "#f59e0b",
    secondaryColor: "#78350f",
    iconName: "Box",
  },
  altar: {
    id: "altar",
    name: "Ancient Stone Altar",
    category: "interactable",
    primaryColor: "#10b981",
    secondaryColor: "#047857",
    iconName: "Sparkles",
  },
  trap: {
    id: "trap",
    name: "Concealed Pit Trap",
    category: "interactable",
    primaryColor: "#ef4444",
    secondaryColor: "#991b1b",
    iconName: "Flame",
  },
  key: {
    id: "key",
    name: "Iron Key",
    category: "interactable",
    primaryColor: "#eab308",
    secondaryColor: "#ca8a04",
    iconName: "Key",
  },

  // --- Monsters & Creatures ---
  goblin: {
    id: "goblin",
    name: "Goblin Scout",
    category: "monster",
    primaryColor: "#15803d",
    secondaryColor: "#166534",
    iconName: "Skull",
  },
  orc: {
    id: "orc",
    name: "Orc Berserker",
    category: "monster",
    primaryColor: "#b91c1c",
    secondaryColor: "#991b1b",
    iconName: "Swords",
  },
  skeleton: {
    id: "skeleton",
    name: "Skeleton Warrior",
    category: "monster",
    primaryColor: "#e2e8f0",
    secondaryColor: "#94a3b8",
    iconName: "Skull",
  },
  dragon: {
    id: "dragon",
    name: "Red Dragon",
    category: "monster",
    primaryColor: "#dc2626",
    secondaryColor: "#7f1d1d",
    iconName: "Flame",
  },

  // --- Player Heroes ---
  fighter: {
    id: "fighter",
    name: "Hero Fighter",
    category: "hero",
    primaryColor: "#10b981",
    secondaryColor: "#047857",
    iconName: "Shield",
  },
  wizard: {
    id: "wizard",
    name: "Hero Wizard",
    category: "hero",
    primaryColor: "#6366f1",
    secondaryColor: "#4338ca",
    iconName: "Sparkles",
  },
};

/**
 * On-the-Fly Asset Matcher: Resolves any arbitrary entity name/label into a recognizable 2D Asset Spec.
 */
export function get2dAssetSpec(labelOrId: string, categoryFallback: AssetCategory = "interactable"): AssetSpec {
  const lower = labelOrId.toLowerCase();

  if (lower.includes("chest") || lower.includes("coffer") || lower.includes("box")) return ASSET_CATALOG["chest"];
  if (lower.includes("altar") || lower.includes("shrine") || lower.includes("statue")) return ASSET_CATALOG["altar"];
  if (lower.includes("trap") || lower.includes("needle") || lower.includes("pit")) return ASSET_CATALOG["trap"];
  if (lower.includes("key")) return ASSET_CATALOG["key"];
  if (lower.includes("goblin")) return ASSET_CATALOG["goblin"];
  if (lower.includes("orc")) return ASSET_CATALOG["orc"];
  if (lower.includes("skeleton") || lower.includes("zombie")) return ASSET_CATALOG["skeleton"];
  if (lower.includes("dragon")) return ASSET_CATALOG["dragon"];
  if (lower.includes("secret") || lower.includes("concealed")) return ASSET_CATALOG["door-secret"];
  if (lower.includes("lock") || lower.includes("gate")) return ASSET_CATALOG["door-locked"];
  if (lower.includes("door") || lower.includes("exit")) return ASSET_CATALOG["door-wooden"];

  return {
    id: `custom-${lower}`,
    name: labelOrId,
    category: categoryFallback,
    primaryColor: categoryFallback === "monster" ? "#ef4444" : categoryFallback === "hero" ? "#10b981" : "#f59e0b",
    secondaryColor: "#334155",
    iconName: categoryFallback === "monster" ? "Skull" : categoryFallback === "hero" ? "Shield" : "Box",
  };
}

/**
 * React Component providing reusable SVG defs (patterns, stone textures, grid overlays)
 * to make 2D maps instantly textured and recognizable.
 */
export const DungeonTileSvgPatterns: React.FC = () => {
  return (
    <defs>
      {/* Pattern 1: Crypt Flagstone Grid */}
      <pattern id="pattern-crypt-tiles" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#334155" strokeWidth="0.8" opacity="0.6" />
        <rect x="2" y="2" width="16" height="16" fill="none" stroke="#1e293b" strokeWidth="0.5" />
      </pattern>

      {/* Pattern 2: Cavern Rough Rock */}
      <pattern id="pattern-cavern-rock" width="16" height="16" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="1.5" fill="#1e3a8a" opacity="0.5" />
        <circle cx="12" cy="10" r="2" fill="#172554" opacity="0.7" />
        <path d="M 0 8 Q 8 12 16 8" fill="none" stroke="#1e3a8a" strokeWidth="0.5" opacity="0.4" />
      </pattern>

      {/* Pattern 3: Castle Keep Paving */}
      <pattern id="pattern-keep-paving" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="12" height="12" fill="none" stroke="#312e81" strokeWidth="0.8" opacity="0.5" />
        <rect x="12" y="12" width="12" height="12" fill="none" stroke="#312e81" strokeWidth="0.8" opacity="0.5" />
      </pattern>

      {/* Pattern 4: Forest Turf */}
      <pattern id="pattern-forest-turf" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 3 10 L 5 4 L 7 10 M 13 16 L 15 10 L 17 16" stroke="#047857" strokeWidth="1" fill="none" opacity="0.6" />
      </pattern>
    </defs>
  );
};
