import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function checkPackageNoForbiddenImports(packageDir: string, forbiddenTerms: string[]) {
  const files: string[] = [];

  function walk(dir: string) {
    for (const item of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
        files.push(fullPath);
      }
    }
  }

  walk(path.join(packageDir, "src"));

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    for (const term of forbiddenTerms) {
      const regex = new RegExp(`from\\s+["']${term}["']|import\\(["']${term}["']\\)`, "i");
      if (regex.test(content)) {
        throw new Error(`Forbidden import '${term}' found in core compiler package file: ${file}`);
      }
    }
  }
}

describe("Package Boundary Compliance Tests", () => {
  const forbiddenList = ["@babylonjs/core", "@babylonjs/gui", "react", "react-dom"];
  const rootDir = path.resolve(__dirname, "../../../packages");

  it("1. @grimoire3d/ir must have 0 dependencies on Babylon or React", () => {
    checkPackageNoForbiddenImports(path.join(rootDir, "ir"), forbiddenList);
  });

  it("2. @grimoire3d/validator must have 0 dependencies on Babylon or React", () => {
    checkPackageNoForbiddenImports(path.join(rootDir, "validator"), forbiddenList);
  });

  it("3. @grimoire3d/rules-core must have 0 dependencies on Babylon or React", () => {
    checkPackageNoForbiddenImports(path.join(rootDir, "rules-core"), forbiddenList);
  });

  it("4. @grimoire3d/simulator must have 0 dependencies on Babylon or React", () => {
    checkPackageNoForbiddenImports(path.join(rootDir, "simulator"), forbiddenList);
  });
});
