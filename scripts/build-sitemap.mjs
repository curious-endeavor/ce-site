#!/usr/bin/env node
/* ============================================================
   build-sitemap.mjs — generate site/sitemap/pages.json

   Scans the old repo (/root/.openclaw/workspace/public/public/)
   and the new repo (site/) for every HTML page and produces a
   structured inventory consumed by site/sitemap/index.html.

   Output row shape:
   {
     "path":      "/deck/",                     // canonical URL
     "title":     "Curious Endeavor — Deck",    // from <title>
     "tag":       "live" | "draft" | "archived",
     "usesHero":  true,                         // uses ce-hero component
     "modified":  "2026-04-09",                 // last file mtime (ISO date)
     "file":      "old:public/deck/index.html", // source for provenance
     "notes":     ""                            // free-form
   }

   Tagging rules (heuristic, override by adding path to ARCHIVED):
   - If directory name starts with "_archive"   → archived
   - If filename contains "v2","v3","draft","old","backup","-current","wip" → draft
   - Otherwise → live

   Run:
     node scripts/build-sitemap.mjs
   ============================================================ */
import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const OLD_ROOT = '/root/.openclaw/workspace/public/public';
const NEW_ROOT = '/root/ce-website/site';
const OUT_FILE = '/root/ce-website/site/sitemap/pages.json';

/* Explicit overrides — paths listed here get the matching tag */
const ARCHIVED_PATHS = new Set([
  '/_archive/',
  '/lobster/v2.html',
  '/lobster/v3.html',
  '/lobster/v4.html',
  '/wfp/',
]);

/* Pages that should be hidden from the sitemap entirely */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.vercel',
  '_archive',
  'api',
  'captures',
  'exports',
  'visual-dedup',
  'visuals-channel-complete',
]);

const DRAFT_HINTS = /\b(v[2-9]|draft|wip|old|backup|-current|-test|-v2|-v3)\b/i;

async function walk(root, rel = '') {
  const out = [];
  let entries;
  try { entries = await readdir(path.join(root, rel), { withFileTypes: true }); }
  catch { return out; }

  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    if (e.name.startsWith('.')) continue;
    const childRel = path.join(rel, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(root, childRel)));
    } else if (e.isFile() && e.name.endsWith('.html')) {
      out.push(childRel);
    }
  }
  return out;
}

function urlFor(fileRel) {
  /* /foo/index.html → /foo/   ;   /foo/bar.html → /foo/bar.html */
  let p = '/' + fileRel.replace(/\\/g, '/');
  if (p.endsWith('/index.html')) p = p.slice(0, -'index.html'.length);
  return p;
}

function tagFor(url, fileRel) {
  for (const a of ARCHIVED_PATHS) if (url.startsWith(a)) return 'archived';
  if (DRAFT_HINTS.test(fileRel)) return 'draft';
  return 'live';
}

async function extractMeta(absFile) {
  try {
    const html = await readFile(absFile, 'utf8');
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    const usesHero =
      /class\s*=\s*["'][^"']*\bce-hero\b/.test(html) ||
      /components\/ce-hero\/ce-hero\.(css|js)/.test(html);
    const st = await stat(absFile);
    const modified = st.mtime.toISOString().slice(0, 10);
    return { title, usesHero, modified };
  } catch { return { title: '', usesHero: false, modified: '' }; }
}

async function scanRoot(root, label) {
  if (!existsSync(root)) return [];
  const files = await walk(root);
  const rows = [];
  for (const rel of files) {
    const abs = path.join(root, rel);
    const p = urlFor(rel);
    const meta = await extractMeta(abs);
    rows.push({
      path: p,
      title: meta.title,
      tag: tagFor(p, rel),
      usesHero: meta.usesHero,
      modified: meta.modified,
      file: `${label}:${rel}`,
      notes: '',
    });
  }
  return rows;
}

function dedupe(rows) {
  /* Prefer new-repo rows over old-repo rows for the same path */
  const byPath = new Map();
  for (const r of rows) {
    const existing = byPath.get(r.path);
    if (!existing) { byPath.set(r.path, r); continue; }
    const existingIsNew = existing.file.startsWith('new:');
    const thisIsNew = r.file.startsWith('new:');
    if (thisIsNew && !existingIsNew) byPath.set(r.path, r);
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

async function main() {
  console.log('Scanning old repo:', OLD_ROOT);
  const oldRows = await scanRoot(OLD_ROOT, 'old');
  console.log('  →', oldRows.length, 'pages');

  console.log('Scanning new repo:', NEW_ROOT);
  const newRows = await scanRoot(NEW_ROOT, 'new');
  console.log('  →', newRows.length, 'pages');

  const merged = dedupe([...oldRows, ...newRows]);
  console.log('Total unique pages:', merged.length);

  const payload = {
    generated: new Date().toISOString(),
    count: merged.length,
    pages: merged,
  };

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
  console.log('Wrote:', OUT_FILE);
}

main().catch((e) => { console.error(e); process.exit(1); });
