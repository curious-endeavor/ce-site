#!/usr/bin/env node
/* ============================================================
   check-hero-consistency.mjs — Layer-4 enforcement for the
   ce-hero component + CE wordmark rules.

   Walks every .html in site/ and fails (exit 1) if any page:

   HERO RULES
   1. Has `<section class="hero">` or any `hero-grid` / `hero-cell`
      class outside of the component itself. (The canonical class
      prefix is `ce-hero-*`, not `hero-*`.)
   2. Defines its own .hero-grid or .ce-hero-grid block in a
      <style> tag — the component owns all hero CSS.
   3. Has an inlined crossfade IIFE or references the old
      `grid-images/compressed/` path — the component JS is the
      only code that touches the pool.
   4. Has a `<section class="ce-hero">` but doesn't import
      `/components/ce-hero/ce-hero.css` and `.js`.

   WORDMARK RULES
   5. Contains "curious endeavor." as rendered text (not inside
      <!-- comment -->, <title>, alt="", or aria-label="") —
      must be an <img> pointing at the canonical PNG.
   6. Has <img> referencing a non-canonical CE logo path.
      Canonical: /assets/logos/ce-logo-red.png

   Run:
     node scripts/check-hero-consistency.mjs
   Exits 0 if clean, 1 if any violations.
   ============================================================ */

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const SITE_ROOT = '/root/ce-website/site';
const COMPONENT_PATH = '/components/ce-hero/';
const CANONICAL_LOGO = '/assets/logos/ce-logo-red.png';

/* ── Walk site/ for .html files ── */
async function walk(root, rel = '') {
  const out = [];
  let entries;
  try { entries = await readdir(path.join(root, rel), { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const childRel = path.join(rel, e.name);
    if (e.isDirectory()) out.push(...(await walk(root, childRel)));
    else if (e.isFile() && e.name.endsWith('.html')) out.push(childRel);
  }
  return out;
}

/* ── Strip comments, <title>, alt attrs before scanning for literal text ── */
function stripMetaText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/\balt\s*=\s*"[^"]*"/gi, '')
    .replace(/\balt\s*=\s*'[^']*'/gi, '')
    .replace(/\baria-label\s*=\s*"[^"]*"/gi, '')
    .replace(/\baria-label\s*=\s*'[^']*'/gi, '')
    .replace(/\bdata-hero-[a-z]*\s*=\s*"[^"]*"/gi, '')
    .replace(/\bdata-hero-[a-z]*\s*=\s*'[^']*'/gi, '');
}

/* ── Check one file ── */
async function checkFile(fileRel) {
  const abs = path.join(SITE_ROOT, fileRel);
  const html = await readFile(abs, 'utf8');
  const violations = [];
  const isComponentFile = fileRel.startsWith('components/');

  /* Rule 1: No <section class="hero"> or hero-grid/hero-cell unprefixed classes */
  if (!isComponentFile) {
    if (/\bclass\s*=\s*["'][^"']*\bhero\b(?!-)[^"']*["']/.test(html)) {
      violations.push('R1: uses unprefixed "hero" class — should be "ce-hero"');
    }
    if (/\bclass\s*=\s*["'][^"']*\bhero-grid\b[^"']*["']/.test(html)) {
      violations.push('R1: uses bespoke "hero-grid" class — should use ce-hero component');
    }
    if (/\bclass\s*=\s*["'][^"']*\bhero-cell\b[^"']*["']/.test(html)) {
      violations.push('R1: uses bespoke "hero-cell" class — should use ce-hero component');
    }
  }

  /* Rule 2: No bespoke hero CSS in <style> tags on non-component files */
  if (!isComponentFile) {
    const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    for (const block of styleBlocks) {
      if (/\.hero-grid\s*\{/.test(block) || /\.hero-cell\s*\{/.test(block)) {
        violations.push('R2: redefines .hero-grid / .hero-cell in <style> — component owns this');
      }
      /* Allow .ce-hero-* overrides (variants), block attempts to redefine the component */
      if (/\.ce-hero-grid\s*\{[^}]*(position|transform|display)\s*:/.test(block)) {
        violations.push('R2: overrides .ce-hero-grid position/transform/display — use data-hero-* attrs instead');
      }
    }
  }

  /* Rule 3: No inlined crossfade / old image pool references */
  if (!isComponentFile) {
    if (/grid-images\/compressed\//.test(html)) {
      violations.push('R3: references old grid-images/compressed/ path — pool lives in /components/ce-hero/pools/');
    }
    if (/staging\.curiousendeavor\.com/.test(html)) {
      violations.push('R3: references staging.curiousendeavor.com — prod must not depend on staging');
    }
    /* A crossfade IIFE usually has this pattern: new Image() + background-image url */
    if (/new\s+Image\s*\(\s*\)[\s\S]{0,400}backgroundImage/.test(html) &&
        /\.hero|img-cell/.test(html)) {
      violations.push('R3: has inlined hero crossfade IIFE — component JS should handle this');
    }
  }

  /* Rule 4: If page uses <section class="ce-hero">, it must import the component */
  if (/<section[^>]*class\s*=\s*["'][^"']*\bce-hero\b/.test(html)) {
    if (!html.includes(COMPONENT_PATH + 'ce-hero.css')) {
      violations.push('R4: uses <section class="ce-hero"> but does not <link> /components/ce-hero/ce-hero.css');
    }
    if (!html.includes(COMPONENT_PATH + 'ce-hero.js')) {
      violations.push('R4: uses <section class="ce-hero"> but does not <script src> /components/ce-hero/ce-hero.js');
    }
  }

  /* Rule 5: Literal "curious endeavor." as rendered text */
  if (!isComponentFile) {
    const scrubbed = stripMetaText(html);
    /* Find the phrase, case-insensitive, with optional period and spacing variance */
    const re = /curious\s+endeavor\.?/gi;
    let m;
    while ((m = re.exec(scrubbed)) !== null) {
      /* Check if this match is inside an <img> alt (already stripped) or attribute — we stripped those above.
         If still present, it's in visible body text → violation. */
      /* Look back a short distance for the enclosing element's start tag. If we find "data-hero-title" nearby,
         it's OK because the component injects HTML (which could be an <img>). */
      const before = scrubbed.slice(Math.max(0, m.index - 200), m.index);
      if (/data-hero-title\s*=\s*["'][^"']*$/.test(before)) continue;
      violations.push(
        `R5: text "${m[0]}" appears in rendered body — must be <img src="${CANONICAL_LOGO}"> instead`
      );
      break; /* one violation per file is enough */
    }
  }

  /* Rule 6: Any <img> referencing a non-canonical CE logo */
  const imgRe = /<img[^>]*\bsrc\s*=\s*["']([^"']*(?:ce-logo|logo-red|logo-ce)[^"']*)["']/gi;
  let im;
  while ((im = imgRe.exec(html)) !== null) {
    const src = im[1];
    /* Canonical passes */
    if (src === CANONICAL_LOGO) continue;
    /* Allow legacy old-repo path /assets/ce-logo-red.png as a transitional exception */
    if (src === '/assets/ce-logo-red.png') continue;
    violations.push(`R6: non-canonical logo ref "${src}" — use ${CANONICAL_LOGO}`);
  }

  return violations;
}

/* ── Main ── */
async function main() {
  const files = await walk(SITE_ROOT);
  console.log(`Scanning ${files.length} HTML files under ${SITE_ROOT}/\n`);

  let totalViolations = 0;
  const failed = [];

  for (const rel of files) {
    const v = await checkFile(rel);
    if (v.length) {
      failed.push({ file: rel, violations: v });
      totalViolations += v.length;
      console.log(`✗ ${rel}`);
      for (const line of v) console.log(`    ${line}`);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  if (failed.length === 0) {
    console.log(`✓ All ${files.length} files clean — hero + wordmark rules satisfied.`);
    process.exit(0);
  } else {
    console.log(`✗ ${failed.length}/${files.length} files have ${totalViolations} violation(s).`);
    console.log(`See project/decisions.md "CE wordmark is always the style-guide PNG" for the full rule set.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(2); });
