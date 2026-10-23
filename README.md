# VectorEdit

A browser-based vector editor with a dense, dark, panel-driven workspace in the style of professional design tools.
Everything (UI, tools, state) is original code: React, TypeScript and plain CSS, no UI kit.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle in dist/
```

## What works

- **Tools:** Selection (V), Direct Selection (A), Pen (P), Type (T), Line (\\), Rectangle (M), Ellipse (L), Hand (H), Zoom (Z)
- **Pen:** click to add points, drag to pull Bézier handles, click the first point to close, Enter or double-click to finish
- **Direct selection:** move anchors and handles of paths
- **Selection:** click, Shift-click, marquee, drag to move, 8-handle scaling (Shift keeps proportions)
- **Panels:** Properties (transform, fill, stroke, opacity, text, arrange), Color, Swatches, Layers (visibility, lock, rename)
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

Boolean path operations, gradients, groups, artboard management, file save/open (`.json`), clipping masks.
