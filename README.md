# VectorEdit

A browser-based vector editor with a dense, dark, panel-driven workspace in the style of professional design tools.
Everything (UI, tools, state) is original code: React, TypeScript and plain CSS, no UI kit.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle in dist/
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

- **Tools:** Selection (V), Direct Selection (A), Pen (P), Type (T), Line (\\), Rectangle (M), Ellipse (L), Hand (H), Zoom (Z)
- **Pen:** click to add points, drag to pull Bézier handles, click the first point to close, Enter or double-click to finish
- **Direct selection:** move anchors and handles of paths
- **Selection:** click, Shift-click, marquee, drag to move, 8-handle scaling (Shift keeps proportions)
- **Workspace modes:** Vector, Layout (grid on, layout tools), Draw (pen and shapes)
- **Top bar:** undo/redo, arrange, flip, align (to artboard or selection), grid, snap to 10 px, export
- **Panels:** Color (saturation/brightness picker + hue), Swatches, Stroke, Appearance · Layers (thumbnails, opacity, blend mode, lock, visibility, rename) · Transform, Navigator, History
- **Text:** type directly on the canvas; double-click text to edit
- **Document Setup:** artboard size and presets from the context bar
- **View:** wheel to pan, Ctrl/Alt + wheel to zoom at the cursor, Space for temporary Hand, rulers, grid, fit artboard
- **Edit:** undo/redo with coalescing, duplicate, delete, arrow-key nudging, z-order
- **Export:** SVG and PNG (File menu)

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
  store.ts         document state, history, view, pen drafting
  geometry.ts      bounds, hit-testing, Bézier flattening, scaling
  components/      Canvas, Toolbar, MenuBar, OptionsBar, Panels, Rulers, StatusBar
```

## Not yet

Boolean path operations, gradients, groups, multiple artboards, clipping masks, code signing and auto-update for the desktop build.
