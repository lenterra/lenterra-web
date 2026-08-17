#!/usr/bin/env node
// Build both artefacts into one directory.
//
// The site goes at the root and the dashboard under `/dashboard`, which is what
// every path in both already assumes: the site's navigation is root-absolute
// and Vite's `base` is `/dashboard/`.
//
// **This is also a fix.** The deleted GitHub Actions workflows each uploaded a
// complete deployment containing only their own half — the dashboard in one,
// the landing site in the other — into the same target. Whichever ran last
// erased the other. One artefact, one deploy, no race.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-web');

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: root, shell: false });
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) {
    console.error(`\n${command} ${args.join(' ')} failed`);
    process.exit(1);
  }
}

function bytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    total += entry.isDirectory() ? bytes(path) : statSync(path).size;
  }
  return total;
}

// The site first, because it clears and rewrites its own output directory and
// the dashboard's build does the same to its own. Neither knows about this one.
run('node', ['site/build.mjs']);
run('node', ['site/check.mjs']);
run('npm', ['run', 'build:dashboard']);

if (existsSync(out)) rmSync(out, { recursive: true });
mkdirSync(out, { recursive: true });

cpSync(join(root, 'dist-site'), out, { recursive: true });
cpSync(join(root, 'dashboard/dist'), join(out, 'dashboard'), { recursive: true });

// The dashboard is a hash-routed single page, so `/dashboard/` serves every
// route inside it. What it does *not* handle is a deep link to a path that was
// never a route — that lands on the site's own 404, which is correct, because
// the visitor is more likely to have mistyped a page than a dashboard route.

const size = bytes(out);
console.log('');
console.log(`dist-web  ${(size / 1024).toFixed(0)} KB across ${count(out)} files`);
console.log('  /            the landing site');
console.log('  /dashboard   the teacher dashboard');
console.log('');
console.log('Deploy with: npm run deploy:web');

function count(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    total += entry.isDirectory() ? count(join(dir, entry.name)) : 1;
  }
  return total;
}
