# tools/

One-off asset scripts. Nothing here runs as part of the build — these exist so the
assets in `public/` can be re-cut later without re-deriving how they were made.

## The icon

The mark is a stack of three stones. The original came out of Gemini as a **JPEG with
an opaque slate tile baked in** — it refused to emit transparency — so the tile was
keyed out of the raster afterwards rather than regenerated.

### Files

| File | What it is |
| --- | --- |
| `design/cairn-icon-source.jpeg` | The original generated image, untouched |
| `design/cairn-icon-master.png` | 1024×1024 opaque master, the script's input |
| `design/cairn-icon-transparent.png` | 663×663 RGBA master, output — cut new sizes from this |
| `public/logo-96.png`, `logo-192.png` | Transparent, used in-app (`src/App.svelte`) |
| `public/favicon-*.png`, `apple-touch-icon.png`, `icon-512.png` | Opaque tile, used by the browser and OS |

`design/` is otherwise gitignored (it holds throwaway comps); these three icon files
are explicitly un-ignored because the script needs them as input.

### Regenerating

```sh
python3 tools/make-logo.py     # from the repo root; needs pillow + numpy
```

It rewrites the transparent master and both `logo-*.png`. As of this writing it
reproduces the checked-in files byte for byte.

### Why the keying works at all

The source is unusually cooperative, and it's worth knowing that the method is not
generally transferable:

- the tile is a **flat, uniform `#29313C`**, ±3 of JPEG noise
- the stone colours sit far from it in RGB space
- **there is no cast shadow on the background** — under the bottom stone it returns to
  clean slate within ~20px

So nothing had to be invented or painted back in. A source with a gradient ground or a
drop shadow would need a different approach entirely.

### Why each step is the way it is

- **Alpha from colour distance to the slate, ramped 14→48 RGB units** — not a hard
  threshold, so the stone edges keep their antialiasing instead of going jaggy.
- **Corners removed geometrically, not by keying white.** The top stone's highlight is
  `#E8E6D8`, only 52 units from white; a white key would have eaten it.
- **Corner radius 185, not the measured 157.** The artwork's corner arc is softer than
  an ideal rounded rect — at x=157 the pixel is still `#C7CED7`, a white→slate blend, so
  a mask at the measured radius leaves a white sliver at 0.85 alpha. Over-masking the
  corner costs nothing: everything just inside it is background anyway.
- **The mask is downscaled with `BOX`, not `LANCZOS`.** LANCZOS rings on a hard mask
  edge, and the overshoot pulls the corner's white blend back through as faint alpha at
  exactly the arc's tangent points. `BOX` is an area average and has no overshoot.
- **Premultiplied resize.** The slate still sitting in the RGB of transparent pixels
  would otherwise bleed a dark fringe into every stone edge on downscale.
- **Cropped to the artwork's real bounds** (573×616 of the 1024 frame). This is why the
  mark reads noticeably larger at the same 44px than it did before — most of the frame
  was tile padding.
- **Bbox taken from an eroded mask,** so a stray sliver of JPEG noise along the tile
  border can't defeat the crop the way a raw threshold would.

### Why the favicons are still opaque tiles

Deliberate, and the script does not touch them:

- `apple-touch-icon.png` **must** be opaque — iOS composites transparency to solid black.
- A tile also survives being dropped on an arbitrary light or dark browser tab.

Transparent is right for in-app, opaque is right for the OS. If the 16/32px tab icons
should be transparent too, cut them from `design/cairn-icon-transparent.png` — but leave
the Apple icon alone. The opaque set was cut in a separate one-off pass and isn't
reproduced by this script.
