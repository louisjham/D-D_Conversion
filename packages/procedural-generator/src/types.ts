import { z } from "zod";

export const DungeonThemeSchema = z.enum([
  "classic-dungeon",
  "cavern-complex",
  "ancient-crypt",
  "keep-fortress",
]);
export type DungeonTheme = z.infer<typeof DungeonThemeSchema>;

export const RoomRoleSchema = z.enum([
  "entrance",
  "hub",
  "treasure",
  "boss",
  "puzzle",
  "trap",
  "secret",
  "connector",
]);
export type RoomRole = z.infer<typeof RoomRoleSchema>;

export const TopologyPatternSchema = z.enum([
  "hub-and-spoke",
  "linear-with-loopback",
  "branching-with-bottleneck",
  "b2-hybrid",
]);
export type TopologyPattern = z.infer<typeof TopologyPatternSchema>;

export const GeneratorOptionsSchema = z.object({
  seed: z.number().default(42),
  title: z.string().default("Procedural Dungeon"),
  theme: DungeonThemeSchema.default("classic-dungeon"),
  roomCount: z.number().min(4).max(30).default(10),
  targetPartyLevel: z.number().min(1).max(10).default(3),
  includeBossRoom: z.boolean().default(true),
  includeKeyLockPuzzle: z.boolean().default(true),
  topologyPattern: TopologyPatternSchema.default("b2-hybrid"),
});
export type GeneratorOptions = z.infer<typeof GeneratorOptionsSchema>;
