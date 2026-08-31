"""Key the flat slate tile out of the Gemini-generated icon and emit
transparent, content-cropped logos for in-app use.

Run from the repo root:  python3 tools/make-logo.py

Reads  design/cairn-icon-master.png  (1024x1024, opaque slate tile)
Writes design/cairn-icon-transparent.png  — RGBA master, for cutting new sizes
       public/logo-192.png, public/logo-96.png  — the in-app mark

See tools/README.md for why each step is the way it is, and for why the
favicons in public/ are deliberately NOT regenerated here.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = "design/cairn-icon-master.png"
SLATE = np.array([0x29, 0x31, 0x3C], dtype=np.float32)  # measured tile ground
LO, HI = 14.0, 48.0      # colour-distance ramp (RGB units) -> soft stone edges
RADIUS = 185             # > the measured 157: clears the corner's white blend

im = Image.open(SRC).convert("RGB")
W, H = im.size
rgb = np.asarray(im, dtype=np.float32)

alpha = np.clip((np.sqrt(((rgb - SLATE) ** 2).sum(axis=2)) - LO) / (HI - LO), 0, 1)

m = Image.new("L", (W * 4, H * 4), 0)
ImageDraw.Draw(m).rounded_rectangle(
    [0, 0, W * 4 - 1, H * 4 - 1], radius=RADIUS * 4, fill=255)
# BOX (area average), not LANCZOS: the sharp mask edge makes LANCZOS ring,
# and the overshoot pulls the corner's white blend back through as alpha.
alpha *= np.asarray(m.resize((W, H), Image.BOX), dtype=np.float32) / 255.0

# Bbox from an eroded mask, so a stray sliver of JPEG noise along the tile
# border can't defeat the crop the way a raw threshold does.
solid = Image.fromarray(((alpha > 0.15) * 255).astype(np.uint8)).filter(
    ImageFilter.MinFilter(5))
ys, xs = np.nonzero(np.asarray(solid) > 127)
y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
print(f"artwork bbox {x1-x0+1}x{y1-y0+1} at ({x0},{y0}) of {W}x{H}")

pad = int(0.04 * max(x1 - x0, y1 - y0))
half = max(x1 - x0, y1 - y0) / 2 + pad
l = int(round((x0 + x1) / 2 - half)); t = int(round((y0 + y1) / 2 - half))
side = int(round(half * 2))

# Premultiply before resampling so the slate left in transparent pixels can't
# bleed a dark fringe into the stone edges.
full = np.dstack([rgb * alpha[..., None], alpha * 255.0])
canvas = np.zeros((side, side, 4), dtype=np.float32)
sy0, sx0 = max(t, 0), max(l, 0)
sy1, sx1 = min(t + side, H), min(l + side, W)
canvas[sy0 - t:sy1 - t, sx0 - l:sx1 - l] = full[sy0:sy1, sx0:sx1]

def emit(size, path):
    s = np.asarray(Image.fromarray(canvas.astype(np.uint8))
                   .resize((size, size), Image.LANCZOS), dtype=np.float32)
    a = s[..., 3:4] / 255.0
    st = np.divide(s[..., :3], a, out=np.zeros_like(s[..., :3]), where=a > 0.003)
    Image.fromarray(np.dstack([np.clip(st, 0, 255), s[..., 3]]).astype(np.uint8)).save(
        path, optimize=True)
    print(f"  {path} {size}x{size}")

emit(side, "design/cairn-icon-transparent.png")
emit(192, "public/logo-192.png")
emit(96, "public/logo-96.png")

chk = np.asarray(Image.open("public/logo-96.png"), dtype=np.float32)
edge = np.concatenate([chk[0, :, 3], chk[-1, :, 3], chk[:, 0, 3], chk[:, -1, 3]])
print(f"96px border alpha max={edge.max():.0f} (0 = no tile residue)")
