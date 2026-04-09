# One-time setup — git init + push to GitHub

This scaffold is ready to commit. The sandbox currently running Kitt
can't execute `git init` on this directory (permission block), so the
first commit and remote push have to be done from an unblocked shell.

## Option A — paste these in an SSH session on the server

```bash
cd /root/ce-website
git init -b main
git config user.name  "Assaf Dagan"
git config user.email "assaf@curiousendeavor.com"
git add -A
git commit -m "chore: initial commit — Phase 0 scaffold

ce-hero component (css, js, default pool), home page,
sitemap page + generator, check-links script, project docs,
vercel.json, 14 hero images (jpeg + webp), 306 old-repo pages
catalogued in pages.json for Phase 1 migration."
```

That creates the local repo and the first commit. You should see 44
files added, ~2.3 MB, 1 commit.

## Option B — run the prepared script

```bash
bash /tmp/init-ce-site.sh
```

Same effect as Option A. The script is already staged at that path.

## Then create the GitHub repo and push

### If you have a working `gh` CLI

```bash
gh auth login -h github.com    # only if not already logged in
gh repo create curious-endeavor/ce-site \
  --private \
  --source=/root/ce-website \
  --remote=origin \
  --push
```

That creates the remote under the `curious-endeavor` org, adds it as
`origin`, and pushes `main` in one go.

### If `gh` is not available — do it by hand

1. In GitHub UI, create an empty repo under the `curious-endeavor` org
   named `ce-site`. **Do not** initialize it with a README / .gitignore /
   license — we already have those locally.
2. Copy the SSH or HTTPS clone URL GitHub gives you.
3. Run:
   ```bash
   cd /root/ce-website
   git remote add origin git@github.com:curious-endeavor/ce-site.git
   git branch -M main
   git push -u origin main
   ```

## After the push

1. In Vercel dashboard: *Add New Project* → select `curious-endeavor/ce-site`.
2. Framework preset: **Other** (no build step). Output directory: `site`.
   This matches what's already in `vercel.json`.
3. Assign a preview/staging subdomain — `preview.curiousendeavor.com`
   or `staging.curiousendeavor.com` (the latter is currently nginx-404,
   so repointing it is free).
4. Enable Vercel Deployment Protection on the staging branch (password
   or SSO) so it's not publicly crawlable.
5. Visit `<preview-url>/sitemap/` — that's the internal page-map with
   live prod + staging health checks across all 306 old-repo pages.
   Use it to track migration progress in Phase 1/2.

## What's in the scaffold (summary)

```
/root/ce-website/
├── README.md                  ← repo overview, principles, dev commands
├── SETUP.md                   ← this file (safe to delete after setup)
├── vercel.json                ← publishDir=site, caching, security headers, redirects
├── package.json               ← sitemap + check-links scripts, no build step
├── .gitignore
├── site/
│   ├── index.html             ← home, uses ce-hero component
│   ├── components/ce-hero/    ← CSS + JS + default pool JSON
│   ├── assets/hero-pool/      ← 14 images as JPEG + WebP (2.3 MB total)
│   └── sitemap/               ← internal page-map + pages.json
├── project/                   ← NOT served — internal docs
│   ├── decisions.md           ← architecture decisions log
│   ├── component-spec.md      ← ce-hero API reference
│   ├── migration-plan.md      ← Phase 0 → Phase 4 rollout
│   └── open-items.md          ← known gaps (Lukas is done, strategy-brief noted)
└── scripts/
    ├── build-sitemap.mjs      ← regenerates site/sitemap/pages.json
    └── check-links.mjs        ← probes prod + staging, CI-ready
```

See `README.md` and `project/migration-plan.md` for everything that
comes after this first push.
