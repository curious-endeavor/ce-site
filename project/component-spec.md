# `ce-hero` component — API reference

Canonical hero for every page on curiousendeavor.com.

Location: `site/components/ce-hero/`

- `ce-hero.css` — all styles, namespaced under `.ce-hero-*`
- `ce-hero.js`  — self-contained IIFE, no dependencies
- `pools/default.json` — default image pool

---

## Quick start

```html
<!-- In <head> -->
<link rel="stylesheet" href="/components/ce-hero/ce-hero.css">

<!-- In <body>, where you want the hero -->
<section class="ce-hero"
         data-hero-title="Your creative department, <em>minus the department</em>."
         data-hero-label="Pitch · April 2026">
</section>

<!-- Before </body> -->
<script src="/components/ce-hero/ce-hero.js" defer></script>
```

That's the entire integration. The script builds the 9-cell grid,
loads the pool, verifies image availability, and starts the crossfade.

---

## Data attributes

All optional except the hero being present on the page at all.

| Attribute | Default | Description |
|---|---|---|
| `data-hero-title` | `"curious endeavor."` | Headline HTML. Use `<em>` for the red word. Raw HTML allowed — the author controls the markup inside the cell. |
| `data-hero-label` | `""` | Small uppercase label shown under the title (e.g. `"Pitch · April 2026"`). Plain text. |
| `data-hero-subtitle` | `""` | Short paragraph under the title. Raw HTML allowed. |
| `data-hero-pool` | `"default"` | Pool name. Resolves to `/components/ce-hero/pools/<name>.json`. Falls back to `default` if the named pool 404s. |
| `data-hero-pool-images` | — | Comma-separated list of absolute image URLs. Overrides the pool entirely — used for "pin this page to these exact images" cases. |
| `data-hero-height` | `100vh` | CSS value for `--ce-hero-height`. Useful for `70vh`, `auto`, `calc(100vh - 68px)`. |

---

## Pool JSON format

`site/components/ce-hero/pools/default.json`:

```json
{
  "name": "default",
  "description": "Freeform notes about what's in this pool.",
  "base": "/assets/hero-pool/",
  "images": [
    "Day_8_chair.jpg",
    "Tempo_0001_spark.jpg"
  ],
  "webp": {
    "Day_8_chair.jpg":    "Day_8_chair.webp",
    "Tempo_0001_spark.jpg": "Tempo_0001_spark.webp"
  }
}
```

- `base` is prepended to every image name when building URLs
- `webp` is an optional sibling map — the component switches to the
  `.webp` variant on browsers that support WebP
- `images` may contain either plain strings or objects of the form
  `{ "jpg": "a.jpg", "webp": "a.webp" }` for per-image format pairs

---

## Responsive behavior

Breakpoints and layouts baked into `ce-hero.css`:

| Viewport | Grid | Height | Notes |
|---|---|---|---|
| ≥1201px | 3×3 absolute-positioned, slight bleed | `--ce-hero-height` (default `100vh`) | Pure desktop hero |
| ≤1200px | 3×3 fluid, contained | auto, min `100vh` | Tablet, no horizontal bleed |
| ≤540px | 2-col brick-wall, 8 image cells + center text | auto | Ported from `figma-story` |

The brick-wall phone layout uses interlocking tall/short cells in the
top + bottom halves with the text cell spanning both columns in the
middle, giving a masonry feel without measuring cells in JS.

`prefers-reduced-motion: reduce` disables the crossfade loop entirely
— the initial image assignment is still shown, but nothing animates.

---

## CSS custom properties

Tokens the page `<section>` can override inline or via a wrapping
class to tune the component without touching `ce-hero.css`:

| Property | Default | Purpose |
|---|---|---|
| `--ce-hero-height` | `100vh` | Section height on desktop |
| `--ce-red` | `#cc0000` | Accent color (used by `<em>` in title) |
| `--ce-black` | `#1a1a1a` | Title color |
| `--ce-grey` | `#666` | Subtitle color |
| `--ce-bg` | `#fff` | Section background (behind the grid) |
| `--ce-bg-alt` | `#f7f5f2` | Cell placeholder while images load |
| `--ce-border` | `#e8e8e8` | Separator color (if added later) |
| `--ce-muted` | `#999` | Label color |
| `--ce-font-serif` | `'larken', serif` | Title family |
| `--ce-font-sans` | `'Inter', sans-serif` | Label + subtitle family |

The component also falls through to existing page-level variables
(`--red`, `--black`, `--grey`, `--bg`, etc.) if they exist, so pages
that already define the CE palette won't need to duplicate it.

---

## Adding a new pool

1. Drop images into `site/assets/hero-pool/` (or a new folder under
   `site/assets/`).
2. Create `site/components/ce-hero/pools/<name>.json` with the shape
   above.
3. Compress each image:
   ```bash
   convert source.png -resize '1400x1400>' -strip \
     -interlace Plane -sampling-factor 4:2:0 -quality 82 out.jpg
   convert source.png -resize '1400x1400>' -strip \
     -quality 80 -define webp:method=6 out.webp
   ```
4. Use it on a page: `data-hero-pool="<name>"`.

---

## Accessibility

- Each image cell has `aria-hidden="true"` — images are decorative
- The text cell contains a real `<h1>` (`.ce-hero-title`) — indexable
  by search engines and screen readers
- `prefers-reduced-motion` kills the crossfade loop
- Focus outlines on the component's only interactive children
  (none today, placeholder for future CTAs) inherit from page styles

---

## Performance

- **Initial load:** One HTTP request for CSS, one for JS, one for
  pool JSON, N for the verified subset of pool images. First-paint
  shows nothing until verification completes (≈400–800ms on broadband).
  Grid fades in all-at-once via `.ce-hero-grid.is-loaded` for polish.
- **Runtime:** Crossfades use `background-image` + opacity transitions,
  handled entirely on the compositor thread. One `Image()` preload per
  transition per cell.
- **Image sizes:** 14 images × ~30–120KB JPEG, ~10–60KB WebP. Total
  pool download on WebP browsers: ~700KB. Images past the initial
  assignment load lazily on first crossfade.

---

## Known limitations

- No AVIF. Wait for widespread ImageMagick AVIF encode support in the
  ambient toolchain.
- No 1×/2× split. Retina screens get the same 1400w image. Upgrade
  path: add `{ "1x": "foo@1x.jpg", "2x": "foo@2x.jpg" }` to the pool
  entries and have the JS pick based on `window.devicePixelRatio`.
- Client-side verification runs every page load. Overhead is ~50ms
  for 14 `Image()` probes, parallel. If pool grows past ~30 images,
  move verification to build-time and bake the verified list into a
  compiled `default.verified.json`.
