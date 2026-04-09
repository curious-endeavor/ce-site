/* ============================================================
   ce-hero.js — canonical CE hero component (vanilla, no deps)
   ============================================================

   Responsibilities:
   1. Build the 9-cell grid skeleton inside each .ce-hero element.
   2. Read title/label/subtitle/pool from data-* attributes.
   3. Fetch the image pool (JSON) from /components/ce-hero/pools/<name>.json
      — or honor an explicit data-hero-pool-images="a.jpg,b.jpg" override.
   4. Verify each image is loadable (skip 404s silently).
   5. Assign unique images per panel, then crossfade on a stagger.
   6. Respect prefers-reduced-motion.

   Author: CE — ce-site repo, 2026-04.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Defaults ---------- */
  var DEFAULT_POOL_URL   = '/components/ce-hero/pools/default.json';
  var POOL_URL_TEMPLATE  = '/components/ce-hero/pools/{name}.json';
  var DEFAULT_TITLE      = 'curious endeavor.';
  var HOLD_MIN_MS        = 5000;
  var HOLD_RANGE_MS      = 2000;
  var STAGGER_STEP_MS    = 600;
  var REDUCED_MOTION     = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* WebP support detection — runs once at script load */
  var SUPPORTS_WEBP = (function () {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext && c.getContext('2d')) &&
             c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch (e) { return false; }
  })();

  /* resolveAsset — given a pool base and image name, pick the best format.
     Pool image entries can be either:
       "Day_8_chair.jpg"           — literal, used as-is
       { "jpg": "foo.jpg", "webp": "foo.webp" }  — explicit pair
     If a literal ends in .jpg/.png and a .webp sibling exists in the pool's
     "webp" map, we'll prefer it. */
  function resolveAsset(entry, webpMap) {
    if (typeof entry === 'object' && entry !== null) {
      return SUPPORTS_WEBP && entry.webp ? entry.webp : (entry.jpg || entry.src);
    }
    if (SUPPORTS_WEBP && webpMap && webpMap[entry]) return webpMap[entry];
    return entry;
  }

  /* ---------- Bootstrap every .ce-hero on the page ---------- */
  var heroes = document.querySelectorAll('.ce-hero');
  if (!heroes.length) return;
  heroes.forEach(initHero);

  /* ============================================================
     initHero — per-instance setup
     ============================================================ */
  function initHero(host) {
    if (host.dataset.ceHeroInit === '1') return;
    host.dataset.ceHeroInit = '1';

    var title    = host.dataset.heroTitle    || DEFAULT_TITLE;
    var label    = host.dataset.heroLabel    || '';
    var subtitle = host.dataset.heroSubtitle || '';
    var poolName = host.dataset.heroPool     || 'default';
    var poolInline = host.dataset.heroPoolImages || ''; // comma-sep override
    var height   = host.dataset.heroHeight;
    if (height) host.style.setProperty('--ce-hero-height', height);

    /* Build grid skeleton */
    var grid = buildGrid(host, { title: title, label: label, subtitle: subtitle });
    var cells = grid.querySelectorAll('.ce-hero-cell.is-img');

    /* Resolve pool source */
    var inlineImages = poolInline ? poolInline.split(',').map(trim).filter(Boolean) : null;
    var poolUrl = POOL_URL_TEMPLATE.replace('{name}', encodeURIComponent(poolName));

    (inlineImages
      ? Promise.resolve({ base: '', images: inlineImages })
      : fetchPool(poolUrl).catch(function () { return fetchPool(DEFAULT_POOL_URL); })
    ).then(function (pool) {
      if (!pool || !pool.images || !pool.images.length) {
        grid.classList.add('is-loaded'); // show empty grid — no crash
        return;
      }
      /* Resolve the best format for each image using WebP detection. */
      var webpMap = pool.webp || null;
      var resolved = pool.images.map(function (img) { return resolveAsset(img, webpMap); });
      verifyImages(pool.base || '', resolved).then(function (verified) {
        if (!verified.length) {
          grid.classList.add('is-loaded');
          return;
        }
        mountImages(grid, cells, verified, pool.base || '');
      });
    });
  }

  /* ============================================================
     buildGrid — construct the 9 cells + center text cell
     ============================================================ */
  function buildGrid(host, txt) {
    /* If page has a pre-built grid (progressive enhancement), respect it. */
    var existing = host.querySelector('.ce-hero-grid');
    if (existing) {
      /* Make sure text cell has expected content if page left it blank */
      var textCell = existing.querySelector('.ce-hero-text-cell');
      if (textCell && !textCell.children.length) populateTextCell(textCell, txt);
      return existing;
    }

    var grid = document.createElement('div');
    grid.className = 'ce-hero-grid';

    /* 9 cells total, index 4 (0-based) is the text cell */
    for (var i = 0; i < 9; i++) {
      var cell = document.createElement('div');
      if (i === 4) {
        cell.className = 'ce-hero-cell ce-hero-text-cell';
        populateTextCell(cell, txt);
      } else {
        cell.className = 'ce-hero-cell is-img';
        cell.setAttribute('aria-hidden', 'true');
        var a = document.createElement('div'); a.className = 'ce-hero-layer is-a';
        var b = document.createElement('div'); b.className = 'ce-hero-layer is-b';
        cell.appendChild(a); cell.appendChild(b);
      }
      grid.appendChild(cell);
    }
    host.appendChild(grid);
    return grid;
  }

  function populateTextCell(cell, txt) {
    var h = document.createElement('h1');
    h.className = 'ce-hero-title';
    h.innerHTML = txt.title;         // intentional — authors control markup (e.g. <em>)
    cell.appendChild(h);

    if (txt.subtitle) {
      var p = document.createElement('p');
      p.className = 'ce-hero-subtitle';
      p.innerHTML = txt.subtitle;
      cell.appendChild(p);
    }

    if (txt.label) {
      var l = document.createElement('span');
      l.className = 'ce-hero-label';
      l.textContent = txt.label;
      cell.appendChild(l);
    }
  }

  /* ============================================================
     fetchPool — load pool JSON
     Shape: { "name": "default", "base": "/assets/hero-pool/", "images": ["a.jpg", ...] }
     ============================================================ */
  function fetchPool(url) {
    return fetch(url, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('Pool fetch failed: ' + url);
        return r.json();
      });
  }

  /* ============================================================
     verifyImages — filter to only images that actually load
     ============================================================ */
  function verifyImages(base, names) {
    return Promise.all(names.map(function (name) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload  = function () { resolve(name); };
        img.onerror = function () { resolve(null); };
        img.src = base + name;
      });
    })).then(function (results) {
      return results.filter(Boolean);
    });
  }

  /* ============================================================
     mountImages — assign unique starting images, start crossfade loop
     ============================================================ */
  function mountImages(grid, cells, pool, base) {
    var current = new Array(cells.length).fill(null);

    /* Shuffle pool, first cells.length items become initial assignments. */
    var shuffled = pool.slice().sort(function () { return Math.random() - 0.5; });

    cells.forEach(function (cell, i) {
      var name = shuffled[i % shuffled.length];
      current[i] = name;
      var a = cell.querySelector('.ce-hero-layer.is-a');
      a.style.backgroundImage = "url('" + base + encodeURI(name) + "')";
    });

    grid.classList.add('is-loaded');

    if (REDUCED_MOTION) return; // static grid, no crossfade

    cells.forEach(function (cell, i) {
      var a = cell.querySelector('.ce-hero-layer.is-a');
      var b = cell.querySelector('.ce-hero-layer.is-b');
      var useA = true;
      var hold = HOLD_MIN_MS + Math.random() * HOLD_RANGE_MS;
      var startDelay = 2500 + i * STAGGER_STEP_MS + Math.random() * 800;

      function crossfade() {
        var next = pickUnique(pool, current, i);
        var incoming = useA ? b : a;
        var outgoing = useA ? a : b;
        var pre = new Image();
        pre.onload = function () {
          incoming.style.backgroundImage = "url('" + base + encodeURI(next) + "')";
          incoming.style.opacity = '1';
          outgoing.style.opacity = '0';
          current[i] = next;
          useA = !useA;
        };
        pre.src = base + next;
      }

      setTimeout(function tick() {
        crossfade();
        setTimeout(tick, hold);
      }, startDelay);
    });
  }

  /* Pick an image from pool that's not currently shown in any other cell. */
  function pickUnique(pool, current, selfIdx) {
    var inUse = new Set();
    for (var i = 0; i < current.length; i++) {
      if (i !== selfIdx && current[i] != null) inUse.add(current[i]);
    }
    var avail = pool.filter(function (n) { return !inUse.has(n); });
    if (!avail.length) avail = pool.slice();
    return avail[Math.floor(Math.random() * avail.length)];
  }

  function trim(s) { return ('' + s).trim(); }
})();
