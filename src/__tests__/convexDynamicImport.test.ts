import { describe, test, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// The Convex runtime throws `TypeError: dynamic module import unsupported`
// for `await import(...)`, which rolled back the completed-deposit mutation
// in mobileMoney.ts (pawaPay settlement). Deployed functions must use
// top-level static imports only.
describe("Convex runtime compatibility", () => {
  test("no dynamic import() anywhere in deployed Convex functions", () => {
    const dir = path.join("src", "convex");
    const files = readdirSync(dir).filter(
      (f) => f.endsWith(".ts") && !f.startsWith("_")
    );
    expect(files.length).toBeGreaterThan(10);

    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(path.join(dir, file), "utf8");
      // Dynamic import call: import("...") or await import("..."), but not
      // a static `import ... from "..."` statement.
      if (/(^|[^.\w])import\s*\(/m.test(source)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});