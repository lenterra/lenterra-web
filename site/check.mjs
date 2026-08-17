#!/usr/bin/env node
/**
 * What the site is not allowed to say, and how heavy it is allowed to be.
 *
 * Three of the site's requirements are the kind that erode rather than break.
 * Nobody sets out to put a crypto reference on a page shown to head teachers,
 * or to add an APK link "just for testing", or to let a page drift past its
 * budget — each happens one small edit at a time, and each is only noticed by
 * somebody who already knew to look.
 *
 * So they are checked here, on every build.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist-site');

/** Page weight excluding video (PRD-SITE-005). */
const PAGE_BUDGET_BYTES = 500 * 1024;

/**
 * Words that must not appear in any public page (PRD-SITE-007).
 *
 * The wallet is plumbing. A principal who searches Lenterra and finds crypto
 * language will not run a pilot, and they will be right not to on the
 * information available to them.
 *
 * Only whole words: "token" would otherwise catch nothing here but is exactly
 * the sort of term that arrives later in a sentence about sessions.
 */
const FORBIDDEN = [
  'crypto',
  'cryptocurrency',
  'blockchain',
  'wallet',
  'dompet digital',
  'token',
  'nft',
  'web3',
  'thirdweb',
  'usdc',
  'base sepolia',
  'on-chain',
  'onchain',
  'mint',
];

/**
 * Things that would be a student-facing download (PRD-SITE-006).
 *
 * The pilot's consent model runs through schools. A download button aimed at a
 * fourteen-year-old routes around the only mechanism that makes taking their
 * data lawful.
 */
const FORBIDDEN_LINKS = [
  '.apk',
  'play.google.com/store',
  'apps.apple.com',
  'expo.dev/artifacts',
];

function pagesIn(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pagesIn(full));
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

if (!existsSync(OUT)) {
  console.error('no build found; run the build first');
  process.exit(2);
}

const pages = pagesIn(OUT);
let failed = false;

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const name = page.replace(OUT, '') || '/';
  const bytes = Buffer.byteLength(html);
  const gzipped = gzipSync(html).length;

  if (bytes > PAGE_BUDGET_BYTES) {
    console.error(`✖ ${name} is ${(bytes / 1024).toFixed(1)} KB, over the 500 KB budget`);
    failed = true;
  }

  // Only the visible text, so a colour token named `--mint` or a URL fragment
  // cannot fail the build for something no reader will ever see.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase();

  for (const word of FORBIDDEN) {
    if (new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) {
      console.error(`✖ ${name} contains "${word}" — see PRD-SITE-007`);
      failed = true;
    }
  }

  for (const link of FORBIDDEN_LINKS) {
    if (html.toLowerCase().includes(link)) {
      console.error(`✖ ${name} links to "${link}" — no student-facing download in R1 (PRD-SITE-006)`);
      failed = true;
    }
  }

  // A page with no description is a page that reads as spam in a search result
  // and tells a head teacher nothing.
  if (!/<meta name="description" content="[^"]{40,}"/.test(html)) {
    console.error(`✖ ${name} has no usable description`);
    failed = true;
  }

  console.log(`${failed ? ' ' : '✓'} ${name.padEnd(28)} ${(bytes / 1024).toFixed(1).padStart(6)} KB  (${(gzipped / 1024).toFixed(1)} KB gzipped)`);
}

// Both locales must exist for every page. A missing Indonesian page is a hole
// in the version the audience actually reads (PRD-SITE-001).
const indonesian = pages.filter((page) => !page.includes(`${OUT}/en/`) && !page.endsWith('404.html'));
const english = pages.filter((page) => page.includes(`${OUT}/en/`));
if (indonesian.length !== english.length) {
  console.error(`✖ ${indonesian.length} Indonesian pages against ${english.length} English ones`);
  failed = true;
}

if (failed) process.exit(1);
console.log(`\n${pages.length} pages, all within budget and saying nothing they should not.`);
