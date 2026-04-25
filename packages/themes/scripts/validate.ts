#!/usr/bin/env node
/**
 * Run: `node --experimental-strip-types scripts/validate.ts`
 * Exits non-zero if any persona fails WCAG AA in either color space.
 */

import { personaList } from "../src/index.js";
import { validateAllPersonas } from "../src/lib/validate.js";

const { ok, issues, report } = validateAllPersonas(personaList);

const groups = new Map<string, typeof report>();
for (const row of report) {
  const key = `${row.personaId} / ${row.scheme}`;
  const bucket = groups.get(key) ?? [];
  bucket.push(row);
  groups.set(key, bucket);
}

for (const [key, rows] of groups) {
  console.log(`\n${key}`);
  for (const r of rows) {
    const mark = r.passed ? "✓" : "✗";
    console.log(
      `  ${mark} [${r.colorSpace.padEnd(5)}] ${r.pair.padEnd(38)} ${r.ratio.toFixed(2).padStart(5)}:1 (min ${r.minimum}:1)`,
    );
  }
}

if (issues.length > 0) {
  console.log("\nIssues:");
  for (const i of issues) {
    const icon = i.severity === "error" ? "✗" : "⚠";
    console.log(`  ${icon} [${i.code}] ${i.personaId} (${i.scheme}): ${i.message}`);
  }
}

const errorCount = issues.filter((i) => i.severity === "error").length;
const warningCount = issues.filter((i) => i.severity === "warning").length;

console.log(
  `\n${ok ? "PASS" : "FAIL"} — ${personaList.length} personas, ${errorCount} errors, ${warningCount} warnings`,
);

process.exit(ok ? 0 : 1);
