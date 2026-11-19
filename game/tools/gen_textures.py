"""Procedural, original texture set for the Last Shift prototype.

Everything here is generated from noise + math, so there are no third-party licensing questions.
Run: python3 -I tools/gen_textures.py public/tex
Outputs WebP files (albedo, packed ORM = R:ao G:roughness B:metalness, normal maps).
"""
import math
import os
import sys

import numpy as np
from PIL import Image

RNG = np.random.default_rng(1977)


def fft_noise(n, beta=2.0, seed=None):
    """Tileable 1/f^beta noise in [0,1]."""
    rng = np.random.default_rng(seed) if seed is not None else RNG
    fx = np.fft.fftfreq(n)[:, None]
    fy = np.fft.fftfreq(n)[None, :]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    spectrum = (rng.normal(size=(n, n)) + 1j * rng.normal(size=(n, n))) / (f ** (beta / 2.0))
    spectrum[0, 0] = 0
    img = np.real(np.fft.ifft2(spectrum))
    img -= img.min()
    img /= img.max()
    return img


def normal_from_height(h, strength=4.0):
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * strength
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * strength
    nz = np.ones_like(h)
    length = np.sqrt(dx * dx + dy * dy + nz * nz)
    n = np.stack([-dx / length, dy / length, nz / length], axis=-1)
    return ((n * 0.5 + 0.5) * 255).clip(0, 255).astype(np.uint8)


def save(arr, path, quality=82):
    if arr.dtype != np.uint8:
        arr = (np.clip(arr, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(arr).save(path, "WEBP", quality=quality, method=6)
    print(f"{path}: {os.path.getsize(path) // 1024} KB")


def lerp(a, b, t):
    return a + (b - a) * t


def marble(out):
    """2x2 checker of black-green and cream marble with brass inlay lines. Texture = 4 m x 4 m."""
    n = 1024
    yy, xx = np.mgrid[0:n, 0:n] / n
    turb = fft_noise(n, 3.4, 11)
    turb2 = fft_noise(n, 3.2, 12)
    v1 = (1 - np.abs(np.sin((xx * 2 + yy * 3 + turb * 3.0) * math.pi))) ** 9
    v2 = (1 - np.abs(np.sin((xx * 7 - yy * 3 + turb2 * 12.0) * math.pi))) ** 22
    veins_dark = np.clip(v1 * 0.9 + v2 * 0.6, 0, 1)
    l1 = (1 - np.abs(np.sin((xx * 4 - yy * 2 + turb2 * 8) * math.pi))) ** 6
    l2 = (1 - np.abs(np.sin((xx * 9 + yy * 4 + turb * 10) * math.pi))) ** 18
    veins_light = np.clip(l1 * 0.8 + l2 * 0.7, 0, 1)
    cloud = fft_noise(n, 2.6, 13)

    tile = ((np.floor(xx * 2) + np.floor(yy * 2)) % 2).astype(bool)
    dark = np.stack([0.035 + cloud * 0.035, 0.055 + cloud * 0.04, 0.05 + cloud * 0.035], -1)
    dark = dark + veins_dark[..., None] * np.array([0.55, 0.53, 0.46])
    cream = np.stack([0.62 + cloud * 0.1, 0.56 + cloud * 0.09, 0.47 + cloud * 0.08], -1)
    cream = cream - veins_light[..., None] * np.array([0.30, 0.29, 0.26])
    alb = np.where(tile[..., None], dark, cream)

    # Brass inlay grid (thin) and a smaller diamond inset at tile centres.
    gx = np.abs(((xx * 2) % 1) - 0.5)
    gy = np.abs(((yy * 2) % 1) - 0.5)
    line = (np.maximum(gx, gy) > 0.493)
    diamond = np.abs(gx + gy - 0.16) < 0.006
    brass = line | diamond
    brass_col = np.array([0.78, 0.58, 0.30])
    alb = np.where(brass[..., None], brass_col, alb)

    scuff = fft_noise(n, 1.2, 14)
    rough = np.where(tile, 0.12, 0.2) + scuff * 0.22 + cloud * 0.05
    rough = np.where(brass, 0.32, rough)
    metal = np.where(brass, 1.0, 0.0)
    ao = np.ones_like(rough)
    ao = np.where(line, 0.8, ao)
    save(alb, f"{out}/marble_albedo.webp")
    save(np.stack([ao, rough, metal], -1), f"{out}/marble_orm.webp")
    h = brass * 0.0 - line * 0.6 + veins_dark * 0.02
    save(normal_from_height(h, 1.5), f"{out}/marble_normal.webp", 90)


def wood(out):
    """Dark walnut veneer panels (texture = 1.2 m wide panel set)."""
    n = 512
    yy, xx = np.mgrid[0:n, 0:n] / n
    warp = fft_noise(n, 2.4, 21)
    rings = np.sin((xx * 22 + warp * 6) * math.pi * 2) * 0.5 + 0.5
    fine = fft_noise(n, 0.9, 22)
    grain = rings * 0.55 + fine * 0.45
    base = np.array([0.17, 0.085, 0.045])
    hi = np.array([0.34, 0.18, 0.09])
    alb = base + (hi - base) * grain[..., None]
    # panel grooves every 1/3
    groove = (np.abs(((xx * 3) % 1)) < 0.012) | (np.abs(((yy * 2) % 1)) < 0.012)
    alb = np.where(groove[..., None], alb * 0.35, alb)
    rough = 0.42 + fine * 0.2
    rough = np.where(groove, 0.8, rough)
    ao = np.where(groove, 0.5, 1.0)
    save(alb, f"{out}/wood_albedo.webp")
    save(np.stack([ao, rough, np.zeros_like(rough)], -1), f"{out}/wood_orm.webp")
    save(normal_from_height(-groove.astype(float) * 0.5 + grain * 0.02, 2.0), f"{out}/wood_normal.webp", 90)


def stone(out):
    """Ashlar limestone blocks with Art Deco fluting band. Texture = 4 m x 4 m of wall."""
    n = 1024
    yy, xx = np.mgrid[0:n, 0:n] / n
    cloud = fft_noise(n, 2.4, 31)
    fine = fft_noise(n, 1.0, 32)
    rows = 4
    row = np.floor(yy * rows)
    offs = (row % 2) * 0.25
    bx = ((xx + offs) * 2) % 1
    by = (yy * rows) % 1
    joint = (bx < 0.012) | (bx > 0.988) | (by < 0.02) | (by > 0.98)
    # vertical fluting on the lower half of each block row (Deco pilaster rhythm)
    flute = np.where(row % 4 == 3, 0.5 + 0.5 * np.cos(xx * 2 * math.pi * 24), 0.0)
    base = np.array([0.50, 0.46, 0.40])
    alb = base * (0.82 + cloud[..., None] * 0.25 + fine[..., None] * 0.08)
    alb = np.where(joint[..., None], alb * 0.45, alb)
    alb = alb * (1 - flute[..., None] * 0.18)
    rough = 0.72 + fine * 0.18
    ao = np.where(joint, 0.55, 1.0) * (1 - flute * 0.2)
    save(alb, f"{out}/stone_albedo.webp")
    save(np.stack([ao, rough, np.zeros_like(rough)], -1), f"{out}/stone_orm.webp")
    h = -joint.astype(float) * 0.6 + flute * 0.35 + fine * 0.04
    save(normal_from_height(h, 2.5), f"{out}/stone_normal.webp", 90)


def frieze(out):
    """Art Deco sunburst + chevron relief band (repeats horizontally). 1024x256 = 4 m x 1 m."""
    w, hgt = 1024, 256
    yy, xx = np.mgrid[0:hgt, 0:w].astype(float)
    u = (xx % 256) / 256.0
    v = yy / hgt
    # Sunburst fans
    cx, cy = 0.5, 1.05
    ang = np.arctan2(v - cy, u - cx)
    rad = np.sqrt((u - cx) ** 2 + (v - cy) ** 2)
    rays = (np.cos(ang * 22) > 0.55) & (rad < 0.95) & (rad > 0.25)
    arcs = (np.abs(rad - 0.25) < 0.02) | (np.abs(rad - 0.95) < 0.02)
    chevron = (np.abs(((u * 8 + np.abs(v - 0.12) * 6) % 1) - 0.5) < 0.12) & (v < 0.16)
    h = rays * 0.6 + arcs * 0.9 + chevron * 0.5
    h = np.clip(h, 0, 1)
    base = np.array([0.52, 0.47, 0.40])
    gold = np.array([0.72, 0.55, 0.30])
    alb = base + (gold - base) * (arcs | chevron)[..., None] * 0.9
    alb = alb * (0.85 + h[..., None] * 0.2)
    rough = 0.65 - (arcs | chevron) * 0.3
    metal = (arcs | chevron) * 0.8
    save(alb, f"{out}/frieze_albedo.webp")
    save(np.stack([np.ones_like(rough), rough, metal], -1), f"{out}/frieze_orm.webp")
    hh = np.pad(h, ((0, 0), (0, 0)))
    save(normal_from_height(hh, 3.0), f"{out}/frieze_normal.webp", 90)


def paper(out):
    """4 paper sheets (ledgers, ticker strips) in a 2x2 atlas, with alpha."""
    n = 512
    atlas = np.zeros((n, n, 4))
    for i in range(4):
        ox, oy = (i % 2) * 256, (i // 2) * 256
        yy, xx = np.mgrid[0:256, 0:256] / 256
        tone = 0.8 + fft_noise(256, 1.4, 40 + i) * 0.15
        col = np.stack([tone * 0.95, tone * 0.92, tone * 0.84], -1)
        lines = (((yy * 26) % 1) < 0.06) & (xx > 0.08) & (xx < 0.92)
        rng = np.random.default_rng(50 + i)
        ink = np.zeros((256, 256))
        for r in range(4, 24):
            for c in range(3):
                if rng.random() < 0.7:
                    x0 = 0.1 + c * 0.28 + rng.random() * 0.04
                    x1 = x0 + 0.08 + rng.random() * 0.12
                    y0 = r / 26 + 0.012
                    ink[(yy > y0) & (yy < y0 + 0.018) & (xx > x0) & (xx < x1)] = 1
        col = np.where(lines[..., None], col * np.array([0.75, 0.82, 0.9]), col)
        col = col * (1 - ink[..., None] * 0.65)
        edge = np.minimum(np.minimum(xx, 1 - xx), np.minimum(yy, 1 - yy))
        alpha = (edge > 0.015).astype(float)
        atlas[oy:oy + 256, ox:ox + 256, :3] = col
        atlas[oy:oy + 256, ox:ox + 256, 3] = alpha
    save(atlas, f"{out}/paper_atlas.webp")


def noise(out):
    n = 256
    a = fft_noise(n, 1.8, 61)
    b = fft_noise(n, 1.2, 62)
    c = fft_noise(n, 2.6, 63)
    save(np.stack([a, b, c], -1), f"{out}/noise.webp", 90)


def skyline(out):
    """Night city silhouettes with lit windows, seen through the hall's tall windows (2048x512)."""
    w, h = 2048, 512
    img = np.zeros((h, w, 3))
    yy = np.linspace(0, 1, h)[:, None]
    sky = np.array([0.05, 0.08, 0.14]) * (1 - yy[..., None]) + np.array([0.16, 0.18, 0.24]) * yy[..., None]
    img[:] = sky
    rng = np.random.default_rng(71)
    for layer, (dark, density, hmin, hmax) in enumerate([(0.10, 0.25, 0.2, 0.55), (0.06, 0.45, 0.35, 0.85)]):
        x = 0
        while x < w:
            bw = int(rng.integers(40, 140))
            bh = int(h * rng.uniform(hmin, hmax))
            top = h - bh
            col = np.array([0.03, 0.045, 0.07]) + dark * 0.2
            img[top:, x:x + bw] = col
            if rng.random() < 0.3:  # deco spire
                sx = x + bw // 2
                sw = max(4, bw // 6)
                sh = int(rng.integers(20, 80))
                img[max(0, top - sh):top, sx - sw // 2:sx + sw // 2] = col
            for wy in range(top + 8, h - 6, 12):
                for wx in range(x + 6, x + bw - 6, 10):
                    if rng.random() < density * (0.4 if layer == 0 else 1):
                        warm = rng.random() < 0.8
                        c = np.array([1.0, 0.72, 0.38]) if warm else np.array([0.55, 0.85, 1.0])
                        img[wy:wy + 5, wx:wx + 4] = c * rng.uniform(0.45, 1.0)
            x += bw + int(rng.integers(0, 12))
    save(img, f"{out}/skyline.webp", 80)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "public/tex"
    os.makedirs(out, exist_ok=True)
    marble(out)
    wood(out)
    stone(out)
    frieze(out)
    paper(out)
    noise(out)
    skyline(out)
