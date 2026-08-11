import { z } from "zod";

export const DungeonThemeSchema = z.enum([
  "classic-dungeon",
  "cavern-complex",
  "ancient-crypt",
  "keep-fortress",
]);
export type DungeonTheme = z.infer<typeof DungeonThemeSchema>;

export const GeneratorOptionsSchema = z.object({
  seed: z.number().default(42),
  title: z.string().default("Procedural Dungeon"),
  theme: DungeonThemeSchema.default("classic-dungeon"),
  roomCount: z.number().min(3).max(30).default(10),
  targetPartyLevel: z.number().min(1).max(10).default(3),
  includeBossRoom: z.boolean().default(true),
  includeKeyLockPuzzle: z.boolean().default(true),
});
export type GeneratorOptions = z.infer<typeof GeneratorOptionsSchema>;
