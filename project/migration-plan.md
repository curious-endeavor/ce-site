# Migration plan — old repo → ce-site

From `Assaf-Dagan/ce-website` (public/public/ mess) to
`curious-endeavor/ce-site` (this repo).

Old repo backup: tag `pre-migration-2026-04-09` on both
`main` and `staging` branches.

---

## Phase 0 — Scaffold (done 2026-04-09)

- [x] Create fresh repo `/root/ce-website/`
- [x] Directory tree: `site/`, `project/`, `scripts/`
- [x] `ce-hero` component (CSS + JS + default pool)
- [x] 14 hero images copied + compressed (JPEG + WebP) into
      `site/assets/hero-pool/`
- [x] Home page (`site/index.html`) wired to `ce-hero`
- [x] Sitemap page (`site/sitemap/index.html`) + generator
      (`scripts/build-sitemap.mjs`) with 306 pages catalogued
- [x] Link health checker (`scripts/check-links.mjs`)
- [x] Project docs: `README`, `decisions`, `component-spec`,
      `migration-plan`, `open-items`
- [x] `vercel.json`, `.gitignore`, `package.json`
- [x] Initial commit
- [ ] Push to GitHub org `curious-endeavor` as `ce-site` (blocked on
      `gh auth` re-login — user action required)
- [ ] Connect to new Vercel project, deploy to preview URL
      (e.g. `preview.curiousendeavor.com`)
- [ ] Enable Vercel password protection on staging

## Phase 1 — First conversions (sanity check the component)

Convert the three most important pages to use `ce-hero` + prove the
component works in real pitches. Each is a separate PR.

- [ ] `site/index.html` — home page (already in Phase 0)
- [ ] `site/essays/subject-matter-expert/` — from `/figma-story/`
      - Keep the essay body as-is, swap the hero for the component
      - Rename to `subject-matter-expert` (the page title) to drop
        the internal-jargon `figma-story` URL
      - Add redirect `/figma-story/` → `/essays/subject-matter-expert/`
- [ ] `site/deck/` — from `/wexelerate/` (the real deck)
      - Canonical URL is `/deck/` going forward; `/wexelerate/` is
        redirected in `vercel.json`
      - Rip out the bespoke 1,600-line hero CSS/JS, replace with the
        3-line `ce-hero` include
      - Title/label/subtitle preserved via `data-hero-*`
      - Also strip the redundant deck/wexelerate file duplication
- [ ] QA all three on phone + tablet + desktop
- [ ] Re-run `node scripts/check-links.mjs --live`
- [ ] Merge to `staging`

## Phase 2 — Bulk pitch migration

Every pitch page gets converted. Order by traffic or recency —
recent pitches first.

- [ ] `/pitches/brandwatch/` ← `/brandwatch-v2/`
- [ ] `/pitches/cropster/` ← `/cropster-pitch/`
- [ ] `/pitches/porsche/` ← `/porsche/`
- [ ] `/pitches/metaroom/` ← `/metaroom-pitch/`
- [ ] `/pitches/lukas-ams/` ← `/lukas-ams/`
- [ ] `/landing/ce-landing/` ← `/ce-landing/`
- [ ] All `lobster/v*.html` → consolidate into one canonical or mark
      archived
- [ ] `/etoro-*` pitches — review which are active, archive rest
- [ ] `/fidelity-*` research pages — archive into `project/research/`
      if they're not public

**During Phase 2 we also tackle the non-website cruft the user asked
about.** Things in the OLD repo that should NOT move into `ce-site`:

- `brandwatch_deck_fix.py`, `composite_*.py`, `generate_*.py`
  → move to `/root/.openclaw/workspace/tools/brandwatch/`
- Discord history JSONs → stay in `workspace/discord-history/`
- `all-phat-visuals-complete.zip`, `ce-workspace-migration.zip`
  → move to `workspace/archive/`
- `.vercel/`, `api/` directory (serverless functions) → copied into
  ce-site under `api/` at repo root (Vercel picks them up there)
- `devis_*.pdf`, `CE-Motivationsschreiben-2026.pdf` → move to
  `workspace/docs/legal/`
- `img-audit-*.png` debug screenshots → delete
- Research screenshots (t212, revolut, fidelity, coinbase, monzo)
  → stay in workspace, not published

An explicit checklist of every file/folder + its destination lives in
`project/cleanup-inventory.md` (to be generated in Phase 2).

## Phase 3 — Cutover

- [ ] Confirm `scripts/check-links.mjs --live` passes against the new
      repo's preview URL
- [ ] Side-by-side QA vs. old prod for every live page
- [ ] In Vercel dashboard: swap `curiousendeavor.com` DNS pointer
      from old repo's project to new repo's project
- [ ] First 24h: keep old repo deployment alive as fallback
- [ ] After 48h clean: archive old repo (mark read-only in GitHub,
      don't delete)
- [ ] Update all external references (LinkedIn, email footers,
      analytics, …) to the new repo URLs where they differ

## Phase 4 — Post-migration hardening

- [ ] Add `robots.txt` and generate SEO `sitemap.xml` via
      `scripts/build-sitemap.mjs` (separate from the internal
      `/sitemap/` page)
- [ ] Add OG social preview images to every live page template
- [ ] Pick analytics tool (Plausible / Vercel Analytics / GA4) and
      ship site-wide via a shared `<head>` include
- [ ] GitHub Action: run `check-links.mjs --live` on every PR; fail
      PR if any live page breaks
- [ ] Decide on long-term font hosting (currently Typekit
      `use.typekit.net/ffj8sbd.css`)

---

## Non-goals

- **Not changing the visual design.** The ce-hero component ports the
  *existing* best-in-class hero (figma-story) as-is. Color, type,
  layout all match current prod.
- **Not rewriting pitch content.** Copy stays the same unless a pitch
  is being retired.
- **Not introducing a framework.** See `decisions.md` — zero build
  step.
- **Not migrating the API endpoints yet** (`api/taste.js`, `api/intake.js`,
  etc.) — they move in Phase 2 as part of the cleanup.

---

## Success criteria

Migration is done when:

1. `curiousendeavor.com` DNS points at `ce-site`'s Vercel project
2. `scripts/check-links.mjs --live` exits 0 against prod
3. All 14 historical hero-grid pages use `ce-hero`
4. No page loads anything from `staging.curiousendeavor.com`
5. Home, `/deck/`, `/essays/subject-matter-expert/` pass Lighthouse
   mobile performance ≥ 85
6. Old repo `Assaf-Dagan/ce-website` is marked read-only
