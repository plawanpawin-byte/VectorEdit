# VectorEdit

A browser-based vector editor with a dense, dark, panel-driven workspace in the style of professional design tools.
Everything (UI, tools, state) is original code: React, TypeScript and plain CSS, no UI kit.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle in dist/
npm test         # unit tests (geometry, boolean ops, history, groups)
```

## Desktop app (Electron)

```bash
npm run electron:dev    # Vite dev server + Electron window with hot reload
npm run electron:start  # build, then open the production bundle in Electron
npm run electron:pack   # unpacked app in release/ (no installer)
npm run electron:dist   # installer for the current OS (NSIS/portable, dmg, AppImage)
```

The desktop build adds a native menu, Open/Save/Save As for `.vedit` documents, native export dialogs and
the file name in the window title. In the browser, Save downloads a `.vedit` file and Open uses a file picker.
Installers for Windows are best built on Windows, macOS ones on macOS.

## What works

Nine workspaces (Vector, Pixel, Retouching, Colour Grading, Compositing, Layout, Typography, Slice, Scripting), each with its own toolbox and panels:

| Workspace | Highlights |
| --- | --- |
| **Vector** | Pen, Pencil, Vector Brush, Node/Corner tools, Knife, Scissors, 26 parametric shapes (star, double star, square star, cat, elliptical callout, cog, spiral, heart, QR code with URL/email/phone/SMS/Wi-Fi payloads…), an Object menu (Divide, reverse, join, smooth, separate, step and repeat, image trace to vector, show/hide/lock all), Transparency, Contour, Perspective and Envelope Warp (3×3 to 6×6 mesh) tools, 9 pattern fills, boolean ops, Expand Stroke, nested groups in a Layers tree, clipping masks, adjustment layers that can be limited to an outline, non-destructive adjustment layers, gradients and patterns, stroke alignment and arrowheads, 8 stackable effects, blend modes, multiple artboards, guides, snapshots |
| **Pixel** | Macro recorder (record filters, replay in one undo step, import/export JSON), raster layers, 14 brush presets, selection tools (marquee, lasso, magic wand, colour range), clone/heal/dodge/burn/blur/smudge, fill and gradient, 51 live-preview adjustments and filters (median, bilateral, lens blur, diffuse glow, selective colour, polar conversions, normal map…), merge down |
| **Retouching / Colour Grading / Compositing** | Focused toolboxes built from the pixel tools: healing, clone, dodge/burn, adjustment and filter brushes, colour replacement, perspective and mesh warp |
| **Layout** | Master pages (content repeats behind every page that uses it), Pages panel, image and picture frames, tables, text frames, grid |
| **Typography** | Artistic and frame text, Character / Paragraph / Text Styles panels, wrapping, alignment and justify |
| **Slice** | Slice tool, Slices panel, per-slice format (PNG/JPEG/SVG) and scale, export all |
| **Scripting** | JavaScript `app` API (add, update, remove, group, select, pages, undo), saved macros; a whole script is one undo step |

Also: PDF export (vector for plain shapes, image fallback), SVG import, colour scopes, data merge (CSV → pages), layer masks, pen-pressure brushes, autosave (IndexedDB) with crash recovery, `.vedit` documents, SVG/PNG export, Electron desktop build, per-workspace shortcuts.

## Limitations

VectorEdit is a young project and does **not** have everything Affinity has. See [docs/COVERAGE.md](docs/COVERAGE.md) for a feature-by-feature checklist. Missing today: AI features, filter layers and live masks for pixel layers, custom brush response curves, vector PDF for text and gradients, CMYK, free-form mesh-point gradients (a colour-grid mesh fill exists), and Affinity file-format import. Master pages repeat content but have no page numbering or spreads yet. Text styles are stored per browser. Scripts are not sandboxed, so only run code you trust.

## Layout

```
src/
  store.ts, types.ts, document.ts   state, history, file format
  geometry.ts, pathops.ts, boolean.ts, offset.ts   vector maths
  tools/                            one file per tool family (plugin registry)
  raster/                           pixel layers, brushes, filters
  components/                       Canvas, panels, top bar
  scripting.ts, slices.tsx          automation and slice export
tests/                              Vitest suites
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). MIT licensed.

## Disclaimer

VectorEdit is an independent open-source project. It is not affiliated with, endorsed by or derived from Affinity, Canva or Serif. All code, icons and assets are original.
