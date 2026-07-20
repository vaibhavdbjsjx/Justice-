# LexMind Desktop (Tauri)

A native Mac/Windows/Linux shell over the LexMind web app (Phase 11).

**Architecture — deliberately thin.** The desktop app is a native window
pointed at the deployed LexMind web application. Supabase auth (SSR cookies)
and every secret-bearing call (AI, Stripe) live on the server, so nothing
sensitive ships in this binary, and web + desktop stay in lockstep with zero
duplicated UI. Navigation is pinned to the app's origin; external links
("Verify source" citations, exports) open in the system browser.

## Prerequisites

- Rust (stable) via [rustup](https://rustup.rs) — `curl … | sh`, no sudo.
- Xcode Command Line Tools on macOS (already present on this box).
- **Several GB of free disk** for the toolchain + first build.

## Commands

```bash
cd apps/desktop
npm install                       # @tauri-apps/cli

# One-time: generate all icon sizes from the source mark
npx tauri icon src-tauri/icons/source.svg

# Dev: run the web app first (npm --prefix ../web run dev), then
npm run dev                       # debug builds point at http://localhost:3000

# Release: bake in the production URL
LEXMIND_APP_URL=https://app.lexmind.com npm run build
```

The bundle lands in `src-tauri/target/release/bundle/` (`.app`/`.dmg` on
macOS, `.msi` on Windows, `.deb`/`.AppImage` on Linux — build on each OS or
in CI; Tauri does not cross-compile).

## Configuration

- `LEXMIND_APP_URL` (compile-time): the deployed web app URL. Debug builds
  default to `http://localhost:3000`; release builds fall back to a
  placeholder that MUST be overridden before shipping.
- Window branding/sizing: `src-tauri/tauri.conf.json` + `src/main.rs`.
