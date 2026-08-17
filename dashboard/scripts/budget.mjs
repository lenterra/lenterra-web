/**
 * Enforce the initial-bundle budget (TRD-TCH-003, TRD-PERF-009).
 *
 * "≤200 KB gzipped" is only a real constraint if something fails when it is
 * exceeded. Left to review, a budget is a number in a document that drifts one
 * dependency at a time until a teacher on a school laptop waits nine seconds
 * for a class list — at which point nobody can point to the commit that did it.
 *
 * What counts is the *entry graph*: the entry script plus everything the built
 * HTML preloads, because the browser fetches all of it before first paint.
 * Lazily-imported routes and the wallet SDK are excluded, which is the whole
 * reason they are lazily imported.
 */

import { gzipSync } from 'node:zlib';
import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

/** The number in 20-12. Raising it is a decision, not a convenience. */
const BUDGET_BYTES = 200 * 1024;

const html = readFileSync(join(dist, 'index.html'), 'utf8');

// Everything the browser is told to fetch up front: the entry script and every
// modulepreload, plus the stylesheets, which block paint just as firmly.
const referenced = [...html.matchAll(/(?:src|href)="\/dashboard\/(assets\/[^"]+)"/g)].map(
  (match) => match[1],
);

if (referenced.length === 0) {
  console.error('budget: found no assets in dist/index.html — did the build run?');
  process.exit(1);
}

let total = 0;
const rows = [];

for (const asset of referenced) {
  // Source maps are not fetched by a browser during a normal load.
  if (asset.endsWith('.map')) continue;

  const path = join(dist, asset);
  const raw = readFileSync(path);
  const gzipped = gzipSync(raw, { level: 9 }).length;
  total += gzipped;
  rows.push({ asset, raw: statSync(path).size, gzipped });
}

rows.sort((a, b) => b.gzipped - a.gzipped);

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

for (const row of rows) {
  console.log(`  ${kb(row.gzipped).padStart(9)} gz  ${row.asset}`);
}

console.log(`\ninitial load: ${kb(total)} gzipped across ${rows.length} files`);
console.log(`budget:       ${kb(BUDGET_BYTES)}`);

if (total > BUDGET_BYTES) {
  console.error(
    `\nOver budget by ${kb(total - BUDGET_BYTES)}.\n` +
      `Either move something behind a dynamic import, or change the budget in\n` +
      `20-12-teacher-dashboard-tech.md and here — deliberately, in the same commit.`,
  );
  process.exit(1);
}

console.log(`\nUnder budget with ${kb(BUDGET_BYTES - total)} to spare.`);
