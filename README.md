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

Six workspaces, each with its own toolbox and panels:

| Workspace | Highlights |
| --- | --- |
| **Vector** | Pen, Pencil, Vector Brush, Node/Corner tools, Knife, Scissors, 21 parametric shapes (star, cog, spiral, heart…), Transparency and Contour tools, boolean ops, Expand Stroke, groups, gradients and patterns, stroke alignment and arrowheads, 8 stackable effects, blend modes, multiple artboards, guides, snapshots |
| **Pixel** | Raster layers, 14 brush presets, selection tools (marquee, lasso, magic wand, colour range), clone/heal/dodge/burn/blur/smudge, fill and gradient, 45 live-preview adjustments and filters, merge down |
| **Layout** | Pages panel, image and picture frames, tables, text frames, grid |
| **Typography** | Artistic and frame text, Character / Paragraph / Text Styles panels, wrapping, alignment and justify |
| **Slice** | Slice tool, Slices panel, per-slice format (PNG/JPEG/SVG) and scale, export all |
| **Scripting** | JavaScript `app` API (add, update, remove, group, select, pages, undo), saved macros; a whole script is one undo step |

Also: autosave (IndexedDB) with crash recovery, `.vedit` documents, SVG/PNG export, Electron desktop build, per-workspace shortcuts.

## Limitations

VectorEdit is a young project and does **not** have everything Affinity has. Missing today: non-destructive adjustment/filter layers, live masks, AI features, true master pages and spreads, pressure dynamics for brushes, mesh warp / perspective, and mesh or hatch fills. Text styles are stored per browser. Scripts are not sandboxed, so only run code you trust.

### Shortcuts

| Key | Action |
| --- | --- |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo |
| `Ctrl+D` | Duplicate |
| `Ctrl+A` | Select all |
| `Ctrl+0` / `Ctrl+1` | Fit artboard / 100% |
| `Ctrl+]` / `Ctrl+[` | Bring forward / send backward (add Shift for front / back) |
| `Ctrl+R` / `Ctrl+'` | Toggle rulers / grid |
| `X` / `Shift+X` / `D` | Switch fill-stroke target / swap / reset colors |

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
