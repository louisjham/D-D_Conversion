import { describe, it, expect } from "vitest";
import { runWalkthroughScript, WalkthroughStep } from "./walkthroughRunner";
import { serpentAltarAdventure, serpentAltarWalkthrough } from "@grimoire3d/fixtures";
import { VersionedAdventure } from "@grimoire3d/ir";

describe("Headless Simulator & Golden Walkthrough Test", () => {
  it("should execute canonical walkthrough script to completion using seeded RNG", () => {
    const result = runWalkthroughScript(
      serpentAltarAdventure as VersionedAdventure,
      serpentAltarWalkthrough as WalkthroughStep[],
      42
    );

    expect(result.success).toBe(true);
    expect(result.stepsExecuted).toBe(serpentAltarWalkthrough.length);
    expect(result.error).toBeUndefined();
  });
});
