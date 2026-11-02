import { Item, Adventure } from "./types";
import rawItems from "./items.json" with { type: "json" };

export const ITEM_REGISTRY: Record<string, Item> = rawItems as Record<string, Item>;

export function normalizeItemId(id: string): string {
  let clean = id.toLowerCase().trim().replace(/^item-/, "");
  clean = clean.replace(/’|'|‘|`/g, "");
  clean = clean.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  // Common aliases
  if (clean === "healing-potion") return "potion-of-healing";
  if (clean === "plate-armor") return "plate";
  if (clean === "rope") return "rope-hempen-50-feet";
  if (clean === "rations") return "rations-1-day";
  return clean;
}

export function getItem(id: string): Item | undefined {
  if (ITEM_REGISTRY[id]) return ITEM_REGISTRY[id];
  const normalized = normalizeItemId(id);
  if (ITEM_REGISTRY[normalized]) return ITEM_REGISTRY[normalized];
  return Object.values(ITEM_REGISTRY).find(
    (item) => item.id === id || normalizeItemId(item.id) === normalized || normalizeItemId(item.name) === normalized
  );
}

export function getItemsByType(type: Item["type"]): Item[] {
  const seen = new Set<string>();
  const results: Item[] = [];
  for (const item of Object.values(ITEM_REGISTRY)) {
    if (item.type === type && !seen.has(item.id)) {
      seen.add(item.id);
      results.push(item);
    }
  }
  return results;
}

export function resolveItem(id: string, adventure?: Adventure): Item | undefined {
  // Resolution order: adventure custom items FIRST, then registry fallback
  if (adventure && adventure.items) {
    const norm = normalizeItemId(id);
    const custom = adventure.items.find(
      (item) => item.id === id || normalizeItemId(item.id) === norm || normalizeItemId(item.name) === norm
    );
    if (custom) return custom;
  }
  return getItem(id);
}
