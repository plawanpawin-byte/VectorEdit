# Feature coverage

A checklist of what VectorEdit implements, measured against the feature inventory of professional vector/raster editors
(compiled from the public scripting API and UI strings of a commercial editor that the author studied; nothing was copied).
✅ done · 🟡 partial · ❌ not yet. This file is the honest source of truth; the README only summarises it.

## Toolbar parity with the reference editor's studios

The studio definition files (`*.afstudio`) of the studied editor are zstd-compressed property lists. Decoding them gives the
tool list of each studio as short internal tags (for example `blnd`, `buil`, `vFil`), which this table follows. Tags whose
meaning could not be established with confidence are marked ❓ and are not claimed.

| Studio | Tools in the studio | Status here |
| --- | --- | --- |
| Vector (19 slots) | Move, Artboard, Node, Corner, Contour, Pen, Pencil, Vector Brush, Knife, Fill, Transparency, 24 shapes, Blend, Shape Builder, Vector Flood Fill, Artistic Text, Frame Text, Image Placement, Measure, Area Measure, Colour Picker/Dropper, View, Zoom | ✅ all present. Gaps: `form` (a second tool next to Node ❓) and `strk` (stroke tool ❓). Crop is a non-destructive clipping mask; Dropper copies an object's style, Colour Picker samples the rendered page |
| Pixel | Move, Perspective, Mesh Warp, Warp, Crop, Object/Flood/Freehand selection, 5 marquees (rect, ellipse, column, row), Fill, Flood Fill, Paint, Mask, Mixer, Colour Replacement, Pixel brush, Erase, Background Erase, Flood Erase, Adjustment brush, Burn, Dodge, Sponge, Filter brush, Blur, Sharpen, Median, Smudge, Clone, Undo brush, Inpainting, Heal, Patch, Blemish, Red eye | ✅ except: Object selection and Inpainting (AI), `tnbr` ❓. Mask brush paints a non-destructive layer mask (removable; not yet baked or linked to selections). Patch outlines a flaw and drags it onto clean pixels. Warp is implemented as Push Warp; Undo brush restores the layer's state before its last change |
| Retouching | selection tools + Paint, Adjust, Filter, Erase, Dodge, Burn, Sponge | ✅ |
| Colour Grading | selection tools + Paint, Adjust, Filter, Colour Replacement, Fill, Erase (+ scopes panel) | ✅ tools and scopes (histogram, waveform, vectorscope) |
| Compositing | Crop, picture frames, selection tools (+ equalizer panel) | ✅ tools |
| Layout / Typography | Move, Node, Frame Text, Table, Artistic Text, Pen, shapes, picture frames (rect, ellipse), Image Placement, Data, Crop, Fill, Transparency, Picker | ✅ Data merge fills `{{Field}}` text from CSV, one page per row (text only, no image fields) |
| Slice | Select/Export, Slice | ✅ |
| Scripting | Vector tools + brushes | ✅ |
| Canva AI, Astrophotography | AI generation, astro stacking tools | ❌ (out of scope) |

## Workspaces
| Area | Status | Notes |
| --- | --- | --- |
| Vector | ✅ | |
| Pixel | ✅ | |
| Layout | 🟡 | pages, master pages, frames, tables; no spreads, page numbering, baseline grid |
| Typography | 🟡 | character/paragraph/styles panels; no hyphenation controls, OpenType features, TOC/index |
| Slice | ✅ | PNG/JPEG/SVG at any scale |
| Scripting | 🟡 | own JavaScript `app` API (not compatible with other editors' scripts) |
| Retouching, Colour Grading, Compositing | ✅ | toolboxes built from the shared pixel tools; no scopes panel |
| Astrophotography, AI studio | ❌ | |

## Vector objects and paths
| Feature | Status |
| --- | --- |
| Pen, Pencil, Node, Corner, Knife, Scissors, Vector brush | ✅ |
| Blend, Shape Builder, Vector Flood Fill, Area Measure | ✅ |
| Boolean: add, subtract, intersect, exclude, **divide** | ✅ |
| Reverse, join, smooth, separate compound path, convert to curves, expand stroke | ✅ |
| Contour (offset copies), Perspective, Envelope warp (3×3 … 6×6 mesh) | ✅ |
| Step and repeat, stroke weight ±, show/hide/lock all | ✅ |
| Image trace (threshold) | 🟡 (single colour, no colour tracing) |
| Rectangle with four independent corner radii | ❌ (one radius) |
| Path effects, corner effects, text on shape outlines beyond paths | ❌ |

## Shapes (26)
Triangle, diamond, trapezoid, parallelogram, polygon, star, double star, square star, burst, cross, arrow, chevron, lightning, heart, teardrop, cloud, cog, ring, pie, segment, crescent, callout, spiral, cat, elliptical callout, **QR code** (URL, email, phone, SMS, Wi-Fi payloads) — all with live parameters. 

## Fill, stroke, effects
| Feature | Status |
| --- | --- |
| Solid, linear and radial gradient, transparency (fade) gradient | ✅ |
| Hatch / pattern fills (9 patterns) | ✅ |
| Mesh gradient fill (2×2 … 5×5 colour grid, smooth blend) | 🟡 (colour grid over the bounding box, not free-form mesh points) |
| Diffusion and bitmap fills; conical/other gradient types | ❌ |
| Stroke: weight, cap, join, dash, alignment (centre/inside/outside), arrowheads | ✅ |
| Miter limit, balanced dashes | ❌ |
| Effects: shadow, inner shadow, glow, inner glow, outline, colour overlay, bevel, blur | ✅ |
| Gradient overlay, Phong bevel | ❌ |
| Blend modes, opacity | ✅ |
| Clipping masks | ✅ |
| Nested groups | ✅ |
| Non-destructive adjustment layers (8 kinds, optional region) | ✅ |

## Pixel
| Feature | Status |
| --- | --- |
| Raster layers, brush (14 presets), eraser, fill, gradient, crop, picker | ✅ |
| Clone, healing brush, dodge, burn, sponge, blur, sharpen, median, smudge, mixer, colour replacement, background eraser, flood erase, pixel brush, filter brush, adjustment brush, blemish and red-eye tools | ✅ |
| Perspective and mesh warp on pixel layers (resampled on release) | ✅ |
| Column and row marquees | ✅ |
| Selections: marquee, lasso, wand, selection brush, grow/shrink, feather, smooth, outline, **by range** (shadows, midtones, highlights, reds, greens, blues, transparent, opaque) | ✅ |
| Adjustments (21): levels, curves, brightness/contrast, exposure, white balance, colour balance, HSL, selective colour, black & white, recolour, posterise, threshold, split toning, shadows/highlights, vibrance, invert, normals, tone compression, auto levels/contrast/white balance | ✅ |
| Filters (30): Gaussian, box, bilateral, median, maximum, minimum, motion, radial, lens blur; unsharp, clarity, high pass; add noise, denoise, dust & scratches; ripple, twirl, spherical, pinch/punch, polar↔rectangular; pixelate, halftone, voronoi, bloom, diffuse glow, vignette, diffuse, edge detect, emboss | ✅ |
| Field blur, depth of field, defringe | ❌ |
| Macros: record filters, replay as one undo step, import/export | ✅ |
| Layer masks (Mask Brush) | ✅ |
| Non-destructive filter/adjustment layers on pixel layers, live masks | ❌ |
| Brush dynamics: pen pressure → size/opacity, speed → size, tilt → width | 🟡 (no custom response curves or per-parameter controllers) |
| ~200 brush presets | ❌ (15 presets) |
| AI: generative fill, remove background, select subject, colourise | ❌ (out of scope for an offline app) |

## Document
Multiple pages, master pages, guides, snapshots, history panel, autosave and recovery, `.vedit` format, SVG/PNG export, slices, Electron desktop build — ✅.
SVG import (shapes, paths with all commands, groups, transforms, solid colours; File → Import SVG) — 🟡: no gradients, text, images or filters.
PDF export, one page per artboard — 🟡: pages made of plain shapes (fills, strokes, dashes, opacity, holes) are true vector; pages with text, images, gradients, effects, blend modes or masks fall back to a 2× JPEG and the app says why.
Import of other editors' file formats, colour profiles (CMYK/ICC), bleed and print marks — ❌.
