#!/usr/bin/env node
/* ============================================================
   check-links.mjs — probe every page in pages.json against
   prod + staging and report the diff.

   Intended to be run locally or in CI after a deploy. Fails
   with non-zero exit if any "live"-tagged page is broken on prod.

   Usage:
     node scripts/check-links.mjs          # probe all
     node scripts/check-links.mjs --live   # only live pages
     node scripts/check-links.mjs --prod   # only prod, skip staging
   ============================================================ */
import { readFile, writeFile } from 'node:fs/promises';

const PAGES_JSON = '/root/ce-website/site/sitemap/pages.json';
const PROD    = 'https://www.curiousendeavor.com';
const STAGING = 'https://staging.curiousendeavor.com';
const CONCURRENCY = 8;
const TIMEOUT_MS = 10_000;

const args = new Set(process.argv.slice(2));
const liveOnly = args.has('--live');
const prodOnly = args.has('--prod');

async function head(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal });
    return r.status;
  } catch { return 0; }
  finally { clearTimeout(t); }
}

async function pool(items, worker, n = CONCURRENCY) {
  const out = new Array(items.length);
  let i = 0;
  async function next() {
    while (i < items.length) {
      const my = i++;
      out[my] = await worker(items[my], my);
    }
  }
  await Promise.all(Array.from({ length: n }, next));
  return out;
}

function pad(s, n) { return String(s).padEnd(n); }

async function main() {
  const data = JSON.parse(await readFile(PAGES_JSON, 'utf8'));
  let pages = data.pages;
  if (liveOnly) pages = pages.filter((p) => p.tag === 'live');
  console.log(`Probing ${pages.length} pages (concurrency=${CONCURRENCY})…\n`);

  const results = await pool(pages, async (p) => {
    const prodStatus = await head(PROD + p.path);
    const stagingStatus = prodOnly ? null : await head(STAGING + p.path);
    return { path: p.path, tag: p.tag, prodStatus, stagingStatus };
  });

  const broken = results.filter((r) => r.tag === 'live' && (r.prodStatus >= 400 || r.prodStatus === 0));
  const warn   = results.filter((r) => r.stagingStatus != null && r.stagingStatus >= 400);

  console.log(pad('path', 48), pad('tag', 10), pad('prod', 6), 'staging');
  console.log('-'.repeat(80));
  for (const r of results) {
    const prodMark = r.prodStatus >= 200 && r.prodStatus < 400 ? '✓' : '✗';
    const stgMark  = r.stagingStatus == null ? '—'
      : (r.stagingStatus >= 200 && r.stagingStatus < 400 ? '✓' : '✗');
    console.log(
      pad(r.path.slice(0, 47), 48),
      pad(r.tag, 10),
      pad(`${prodMark} ${r.prodStatus}`, 6),
      `${stgMark} ${r.stagingStatus ?? '—'}`
    );
  }

  console.log('\nSummary:');
  console.log(`  Live pages broken on prod: ${broken.length}`);
  console.log(`  Any pages broken on staging: ${warn.length}`);

  await writeFile(
    '/root/ce-website/site/sitemap/link-check.json',
    JSON.stringify({ generated: new Date().toISOString(), results }, null, 2) + '\n'
  );

  process.exit(broken.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
