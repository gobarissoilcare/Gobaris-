# Gobaris

Single-page marketing site for Gobaris (vermicompost from Braj). Everything —
styles, scripts, and images — lives inline in `index.html`, so the site has
no build step and no external asset paths to break.

## Local preview

Just open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Hosting on a custom domain

This repo is set up so a static host (GitHub Pages, Netlify, Vercel, etc.)
can serve it with zero configuration:

- `index.html` is the entry point at the repo root.
- `.nojekyll` disables GitHub Pages' Jekyll processing (avoids it choking on
  files/folders starting with `_`).
- All images are embedded as base64 data URIs — no relative asset paths to
  keep in sync when moving domains.
- The only external dependency is Google Fonts, loaded over HTTPS.

**GitHub Pages:** repo Settings → Pages → Deploy from branch → `main` / `root`.

**Custom domain:** add a `CNAME` file at the repo root containing just your
domain (e.g. `gobaris.com`), then point your domain's DNS at the host
per its instructions.
