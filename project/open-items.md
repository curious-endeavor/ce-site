# Open items — known gaps

Things I know are missing, wrong, or deferred. Each entry has context
and the minimum fix required to close it.

---

## Blockers

### Lukas Richthammer headshot — file missing

- **Where it's referenced:** old repo
  `public/wexelerate/index.html` (team section) expects
  `../brandwatch-v2/assets/lukas.png`. The file doesn't exist anywhere
  on disk — scanned `/root/.openclaw/workspace`, `/tmp`, and the
  entire filesystem.
- **Status:** needs upload from user.
- **Fix:** Drop a headshot (JPEG or PNG, any reasonable size) at
  `/tmp/lukas.jpg` and I'll crop + compress + place it at both
  `/root/.openclaw/workspace/public/public/brandwatch-v2/assets/lukas.png`
  (old repo) and `/root/ce-website/site/assets/team/lukas.jpg`
  (new repo).

### GitHub push — `gh auth` token invalid

- The `Assaf-Dagan` GitHub CLI token is expired; attempts to check
  the `curious-endeavor` org or create a new repo return
  401 Unauthorized.
- **Fix:** `gh auth login -h github.com` with org scope, then I can
  create `curious-endeavor/ce-site` and push the initial commit.
- **Workaround:** create the empty repo manually in the GitHub UI
  and paste the SSH/HTTPS remote URL here; I'll add the remote and
  push.

### Google Drive folder scan — MCP tool unavailable

- Folder:
  `https://drive.google.com/drive/folders/1kfDgg1yp7P25EfqbCTGBjAUOFIXozSlK`
- The Drive MCP tool (`mcp__…__google_drive_search`) returned
  `stream closed` on every invocation this session and was not
  re-offered after the mid-session tool reshuffle.
- **Workaround:** If there are specific files in that folder that
  matter (Lukas photo, higher-res mockups, team photos), download
  them locally and drop into `/tmp/`. I'll pick them up.

---

## Deferred — fix in Phase 2 or later

### Deliverable mockups are the March "Dove DACH" samples

The 4 rendered mockups I deployed (production-assets, localization,
campaign-architecture, execution-playbook) are brand-consistent but
literally say "Prepared for Dove · DACH / March 2026" and have Dove-
specific copy. They're meant to read as an illustrative pitch.

- **Options:** leave as-is, re-render from the HTML source with
  generic labels, or swap with a real client case study in Phase 2.
- **HTML source:** `work/active-projects/brandwatch/mockup-screens/*.html`
- **Recommendation:** leave for Phase 0/1, re-render generic versions
  in Phase 2 along with the brandwatch migration.

### Hero pool image count is thin

14 images per pool is the minimum that works for a 3×3 desktop grid
with rotation. Doubling the pool would let cells rotate longer before
repeating. Requires sourcing more approved portfolio stills.

### No AVIF, no 1×/2× split

See `component-spec.md` → "Known limitations". Revisit when:
- The ambient ImageMagick toolchain ships reliable AVIF encode, or
- Mobile data budgets become a measured problem (check via
  Vercel Analytics after cutover)

### `/wexelerate/` redirect after cutover

Old external links point at `/wexelerate/`. Add a redirect in
`vercel.json`:

```json
"redirects": [
  { "source": "/wexelerate",  "destination": "/deck/", "permanent": true },
  { "source": "/wexelerate/", "destination": "/deck/", "permanent": true }
]
```

Do this in Phase 3 cutover, not before.

### `api/*.js` serverless functions not migrated

`api/taste.js`, `api/intake.js`, `api/search.js`, `api/generate.js`,
`api/trends.js`, `api/intake-save.js`, `api/intake-session.js`
live in the old repo. Copy into this repo's `api/` at the repo root
(Vercel picks them up there) as part of Phase 2.

---

## Housekeeping

### Old debug screenshots clutter old repo

`img-audit-0.png` through `img-audit-14.png`, `comparison-page.png`,
`coinbase-preview.png`, etc. live at the old repo root and serve no
purpose. Delete during Phase 2 cleanup.

### Typekit account dependency

Fonts come from `https://use.typekit.net/ffj8sbd.css`. If the Adobe
Fonts account lapses, every page breaks typography. Consider
self-hosting Larken + Inter in `site/assets/fonts/` as a future
hardening step.
