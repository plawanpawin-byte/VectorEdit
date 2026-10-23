# Feature coverage

A checklist of what VectorEdit implements, measured against the feature inventory of professional vector/raster editors
(compiled from the public scripting API and UI strings of a commercial editor that the author studied; nothing was copied).
✅ done · 🟡 partial · ❌ not yet. This file is the honest source of truth; the README only summarises it.

## Workspaces
| Area | Status | Notes |
| --- | --- | --- |
| Vector | ✅ | |
| Pixel | ✅ | |
| Layout | 🟡 | pages, master pages, frames, tables; no spreads, page numbering, baseline grid |
| Typography | 🟡 | character/paragraph/styles panels; no hyphenation controls, OpenType features, TOC/index |
| Slice | ✅ | PNG/JPEG/SVG at any scale |
| Scripting | 🟡 | own JavaScript `app` API (not compatible with other editors' scripts) |
| Retouching / Colour grading / Compositing / Astrophotography / AI studios | ❌ | |

## Vector objects and paths
| Feature | Status |
| --- | --- |
| Pen, Pencil, Node, Corner, Knife, Scissors, Vector brush | ✅ |
| Boolean: add, subtract, intersect, exclude, **divide** | ✅ |
| Reverse, join, smooth, separate compound path, convert to curves, expand stroke | ✅ |
| Contour (offset copies), Perspective, Envelope warp (3×3 … 6×6 mesh) | ✅ |
| Step and repeat, stroke weight ±, show/hide/lock all | ✅ |
| Image trace (threshold) | 🟡 (single colour, no colour tracing) |
| Rectangle with four independent corner radii | ❌ (one radius) |
| Path effects, corner effects, text on shape outlines beyond paths | ❌ |

## Shapes (24)
Triangle, diamond, trapezoid, parallelogram, polygon, star, double star, square star, burst, cross, arrow, chevron, lightning, heart, teardrop, cloud, cog, ring, pie, segment, crescent, callout, spiral, **QR code** (URL, email, phone, SMS, Wi-Fi payloads) — all with live parameters. ❌ Callout ellipse variant, themed art shapes.

## Fill, stroke, effects
| Feature | Status |
| --- | --- |
| Solid, linear and radial gradient, transparency (fade) gradient | ✅ |
| Hatch / pattern fills (9 patterns) | ✅ |
| Diffusion, bitmap and gradient-mesh fills; conical/other gradient types | ❌ |
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
| Clone, heal, dodge, burn, blur, smudge and similar retouch tools | ✅ |
| Selections: marquee, lasso, wand, selection brush, grow/shrink, feather, smooth, outline, **by range** (shadows, midtones, highlights, reds, greens, blues, transparent, opaque) | ✅ |
| Adjustments (21): levels, curves, brightness/contrast, exposure, white balance, colour balance, HSL, selective colour, black & white, recolour, posterise, threshold, split toning, shadows/highlights, vibrance, invert, normals, tone compression, auto levels/contrast/white balance | ✅ |
| Filters (30): Gaussian, box, bilateral, median, maximum, minimum, motion, radial, lens blur; unsharp, clarity, high pass; add noise, denoise, dust & scratches; ripple, twirl, spherical, pinch/punch, polar↔rectangular; pixelate, halftone, voronoi, bloom, diffuse glow, vignette, diffuse, edge detect, emboss | ✅ |
| Field blur, depth of field, defringe | ❌ |
| Macros: record filters, replay as one undo step, import/export | ✅ |
| Non-destructive filter/adjustment layers on pixel layers, live masks | ❌ |
| Brush dynamics (pressure/tilt controllers), ~200 brush presets | ❌ |
| AI: generative fill, remove background, select subject, colourise | ❌ (out of scope for an offline app) |

## Document
Multiple pages, master pages, guides, snapshots, history panel, autosave and recovery, `.vedit` format, SVG/PNG export, slices, Electron desktop build — ✅.
Import of other editors' file formats, PDF export, colour profiles (CMYK/ICC), bleed and print marks — ❌.
