# Decisions log

Append-only. Every non-trivial architectural choice gets a short entry
with context, alternatives considered, and why we picked what we picked.
New entries go at the top.

---

## 2026-04-09 — CE wordmark is always the style-guide PNG. No exceptions.

**Rule.** The "curious endeavor." wordmark, wherever it appears, is
the canonical red PNG from the style guide — never browser-rendered
text, never a different color, never a different weight, never the
`--red` CSS variable applied to a font.

**Canonical file:** `site/assets/logos/ce-logo-red.png`
(1670×160, red serif wordmark, transparent background).

**Why.**
- **Perfect visual consistency.** Same pixels everywhere, no font
  fallback flash (Larken loads from Typekit — if it's slow or blocked,
  users see Georgia until it arrives).
- **Style guide is the source of truth.** Any text-rendered version
  is a guess at what the style guide intends. The PNG is what the
  style guide ships.
- **Kerning, tracking, weight, optical sizing** all vary between
  fonts and viewports. The PNG doesn't.
- **Red is part of the wordmark itself,** not a color applied on top.
  There is no non-red CE wordmark. Ever.

**How to use it.**

```html
<!-- Anywhere the wordmark appears: nav, hero text cell, footer, OG image -->
<img src="/assets/logos/ce-logo-red.png"
     alt="Curious Endeavor"
     style="height: 1.2em; width: auto;">
```

Size it via `height` in `em` or `px` — `width: auto` preserves the
aspect ratio. Don't apply `color`, `filter`, `mix-blend-mode`, or
anything that tints the image.

**Enforcement.** `scripts/check-hero-consistency.mjs` (Layer-4 lint,
see below) fails any PR that:

1. Contains the literal string "curious endeavor." inside an HTML
   element that renders text, outside of a comment or alt attribute.
2. References a hero or logo element styled to non-red color
   (`#000`, `var(--black)`, any non-red color) when the element class
   includes "hero-logo" or "ce-hero-title" with variant=logo.
3. Includes an `<img>` for the wordmark pointing at anything other
   than `/assets/logos/ce-logo-red.png`.

**Open migration work.** Home page (`/`) and `/figma-story/` on old
prod still use the text span. They'll be swapped to the PNG as part
of the home + essay Phase 1 conversions. Tracked in `open-items.md`.

---

## 2026-04-09 — Fresh repo, escape `public/public/` nesting

**Context.** Legacy repo `Assaf-Dagan/ce-website` had the site in
`public/public/` (Vercel web root nested inside a git repo that also
held tools, Discord exports, PDFs, Python scripts, ~1GB of zip files,
and debug screenshots). Working in it was error-prone: two nearly
identical 1,600-line HTML files for `/deck/` and `/wexelerate/`, a
Vercel rewrite duct-taping them together, broken image refs that
nobody noticed because there was no link health check.

**Decision.** New standalone repo `ce-site` under the
`curious-endeavor` GitHub org, cloned locally at `/root/ce-website/`.
`site/` is the single web root — no nesting. Everything non-website
stays in `/root/.openclaw/workspace/`.

**Alternatives considered.**
- *Clean up in place.* Would have kept old history + Vercel project.
  Rejected because the cruft is load-bearing for other workflows and
  untangling would take longer than starting fresh.
- *Collapse to `public/` at repo root in the old repo.* Requires a
  big-bang move of hundreds of files and risks breaking dozens of
  relative-path references. Same amount of work as a fresh repo with
  worse blast radius.

**Consequence.** Both repos run in parallel during migration. DNS stays
on the old repo until Phase 3 cutover; new repo deploys to a preview URL.

---

## 2026-04-09 — `/deck/` and `/wexelerate/` collapse to a single canonical URL

**Context.** `vercel.json` in the legacy repo rewrote `/deck/` to
`/wexelerate/`, meaning two near-identical 1,600-line HTML files had
to be kept in sync manually. A mobile hero fix was edited in the wrong
file and didn't reach prod until we found the rewrite.

**Decision.** In the new repo, `/deck/` is the canonical URL. The old
`/wexelerate/` path is gone. No rewrite needed — one file, one URL.

**Consequence.** Incoming links to `/wexelerate/` will 404 after
cutover. Add a redirect in `vercel.json` (`source: /wexelerate/...,
destination: /deck/...`) during Phase 3. Inbound analytics traffic to
`/wexelerate/` is near zero per prior checks.

---

## 2026-04-09 — `ce-hero` component is canonical, lives at `site/components/ce-hero/`

**Context.** 14 HTML pages in the old repo implemented their own
3×3 hero grid with bespoke CSS and JS — each slightly different, mostly
broken on mobile, 3 of them pointing to `staging.curiousendeavor.com`
for images (prod depending on staging).

**Decision.** Extract one component, `ce-hero`:
- CSS namespaced under `.ce-hero-*` so it can't collide with page styles
- JS is a self-contained IIFE — zero dependencies
- Image pool is a JSON file at `pools/<name>.json`, images live in
  `site/assets/hero-pool/` — same-origin, no staging dependency
- Page overrides via `data-hero-*` attributes: title, label, subtitle,
  pool name, inline image list, height
- WebP with JPEG fallback via canvas-based feature detection
- Brick-wall mobile layout ported from the figma-story
  ("Subject Matter Expert") page, which was the best hero on the site

**Alternatives considered.**
- *Web Component / Custom Element.* Rejected — every page on the site
  is plain HTML, and a custom element adds a lifecycle dance for no
  gain.
- *Use an existing framework.* No — the site has no build step and
  no framework today. Keeping it that way.

---

## 2026-04-09 — Hero image pool: 14 curated, same-origin, WebP + JPEG pyramid

**Context.** The figma-story page lists 26 hero image filenames in JS
but 12 of them return 404 everywhere. The verify-on-load trick hid
this from users but wasted bandwidth. Image originals were PNG at
full size — Gen_air1.png alone was 867KB.

**Decision.** Curate down to the 14 that actually exist. For each:
- Resize to max 1400w, strip metadata
- Progressive JPEG, quality 82, 4:2:0 chroma — primary delivery
- WebP quality 80, `method=6` — secondary delivery for modern browsers
- No 1×/2× split for v1 — the single optimized size is already small
  enough (34KB median). Revisit if mobile data budgets become an issue.

**Result.** Total pool size dropped from ~3.6MB of originals to
~1.5MB JPEG + ~0.7MB WebP. Browsers that support WebP (all modern)
get the smaller file automatically.

**Alternatives considered.**
- *AVIF.* Better compression than WebP but ImageMagick 6.9 builds here
  don't ship `HEIC/AVIF` encode reliably. Skip for v1.
- *`<picture>` with srcset.* Requires putting `<img>` tags in the DOM
  instead of CSS `background-image`, which would change the component
  shape. Feature-detect + single URL is simpler and covers the same
  browsers.

---

## 2026-04-09 — Sitemap page is a real `/sitemap/` URL, noindex

**Context.** Need a page that lists every HTML file in the site with
its live status on prod + staging, filterable, searchable. Asked for
"an html page with a map to all loose html page on the site and an
indication about staging / production".

**Decision.** Ship it at `/sitemap/` on the live site (not just in
`project/`), with:
- `<meta name="robots" content="noindex, nofollow">` so it doesn't
  surface in search
- No links to it from any public page — reachable by typing the URL
- Data comes from `/sitemap/pages.json`, regenerated by
  `scripts/build-sitemap.mjs` from a filesystem scan
- Client-side health checks hit prod + staging origins via no-cors
  fetch on load (re-runnable via "Recheck" button)
- CSV export, sortable columns, tag filters (live/draft/archived),
  search across path + title + tag
- Separate SEO sitemap (`/sitemap.xml`) will be generated by the same
  script in a later phase. Different artifact, different consumers.

---

## 2026-04-09 — `staging` branch is the integration branch, password-protected

**Context.** Need a place to QA changes before prod.

**Decision.** Three branches in this repo:
- `main`    — prod, pushed through merges from `staging`
- `staging` — integration branch, auto-deploys to
              `staging.curiousendeavor.com`
- feature branches off `staging` — auto-deploy to Vercel previews

Staging gets password protection via Vercel's built-in deployment
protection so it isn't publicly crawlable.

---

## 2026-04-09 — No build step, no framework

**Context.** Every time the site has picked up a build step historically
it's broken on deploy within a month. The site is ~300 HTML pages of
mostly-static content with a few serverless functions.

**Decision.** Stay plain HTML/CSS/JS. `npm` is used only for the
Node-based scripts (`build-sitemap.mjs`, `check-links.mjs`) — not for
the site itself. `npx serve site` is the dev server. Zero build.

**Consequence.** No bundler, no minification, no tree-shaking. Files
served directly. Cache-busting via `?v=YYYYMMDD` query strings on the
ce-hero component references.

---
