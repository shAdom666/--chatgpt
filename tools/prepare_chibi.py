"""Prepare transparent 2x chibi frames and 24-fps optical-flow animation.

Original art: ZipZipPipe; sprite source: savanna0425/llm-pet.
Noncommercial use only; retain assets/NOTICE.md.
Requires Pillow, numpy and opencv-python-headless, only at asset-build time.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "chibi-hd"
COUNTS = [6, 8, 8, 4, 5, 8, 6, 6, 6]
W, H, STEPS, SCALE = 192, 208, 3, 2


def premultiply(rgba):
    f = rgba.astype(np.float32) / 255
    f[..., :3] *= f[..., 3:4]
    return f


def straight(p):
    p = np.clip(p, 0, 1)
    alpha = p[..., 3:4]
    rgb = np.divide(p[..., :3], alpha, out=np.zeros_like(p[..., :3]), where=alpha > 1 / 255)
    return np.rint(np.concatenate([np.clip(rgb, 0, 1), alpha], axis=2) * 255).astype(np.uint8)


def enlarge(p):
    # Resize premultiplied color, so transparent pixels do not create dark halos.
    p = cv2.resize(p, (W * SCALE, H * SCALE), interpolation=cv2.INTER_LANCZOS4)
    return Image.fromarray(straight(p))


def gray(p):
    neutral = p[..., :3] + (1 - p[..., 3:4]) * 0.18
    return cv2.cvtColor(np.rint(neutral * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)


def flow(a, b):
    return cv2.calcOpticalFlowFarneback(gray(a), gray(b), None, 0.5, 4, 25, 5, 7, 1.5, 0)


def centroid(p, x, y):
    alpha = p[..., 3]
    return np.array([(alpha * x).sum(), (alpha * y).sum()]) / max(alpha.sum(), 1)


def prepare():
    OUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(ROOT / "assets" / "chatgpt-chibi.webp").convert("RGBA")
    assert sheet.size == (W * 8, H * 9)
    x, y = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    samples = []
    for row, count in enumerate(COUNTS):
        originals = [premultiply(np.asarray(sheet.crop((i * W, row * H, (i + 1) * W, (row + 1) * H)))) for i in range(count)]
        atlas = Image.new("RGBA", (W * SCALE * count * STEPS, H * SCALE))
        previews = []
        for i, a in enumerate(originals):
            b = originals[(i + 1) % count]
            # Remove whole-body displacement before local flow estimation. Large
            # jump offsets otherwise exceed the flow solver's capture range.
            shift = centroid(b, x, y) - centroid(a, x, y)
            aligned = cv2.remap(b, x + shift[0], y + shift[1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
            ab, ba = flow(a, aligned), flow(aligned, a)
            for step in range(STEPS):
                t = step / STEPS
                if step == 0:
                    p = a
                else:
                    wa = cv2.remap(a, x - ab[..., 0] * t, y - ab[..., 1] * t, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
                    wb = cv2.remap(aligned, x - ba[..., 0] * (1 - t), y - ba[..., 1] * (1 - t), cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
                    p = wa * (1 - t) + wb * t
                    p = cv2.remap(p, x - shift[0] * t, y - shift[1] * t, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
                rendered = enlarge(p)
                atlas.paste(rendered, ((i * STEPS + step) * W * SCALE, 0))
                previews.append(rendered)
        atlas.save(OUT / ("row%d.png" % row), optimize=True)
        print("row", row, "frames", count * STEPS, "cell", (W * SCALE, H * SCALE), flush=True)
        samples.extend([previews[0], previews[1], previews[2], previews[3]])
        if row in (0, 1, 3):
            bg_frames = []
            for f in previews:
                bg = Image.new("RGBA", f.size, (245, 241, 251, 255)); bg.alpha_composite(f)
                bg_frames.append(bg.convert("RGB"))
            bg_frames[0].save(OUT / ("preview%d.gif" % row), save_all=True, append_images=bg_frames[1:], duration=[42, 42, 41] * count, loop=0)
    contact = Image.new("RGBA", (4 * W * SCALE, 9 * H * SCALE), (245, 241, 251, 255))
    for i, sample in enumerate(samples):
        contact.alpha_composite(sample, ((i % 4) * W * SCALE, (i // 4) * H * SCALE))
    contact.thumbnail((1024, 2500)); contact.save(OUT / "qa-contact.png")
    sheet.crop((0, 0, W, H)).save(ROOT / "assets" / "pet.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    enlarge(premultiply(np.asarray(sheet.crop((0, 0, W, H))))).save(OUT / "character.png")
    (OUT / "animation.json").write_text(json.dumps({"character": "chatgpt-chibi", "sourceCell": [W, H], "renderCell": [W * SCALE, H * SCALE], "sourceFps": 8, "fps": 24, "counts": [n * STEPS for n in COUNTS], "method": "bidirectional Farneback optical flow; premultiplied-alpha Lanczos4 2x resampling", "attribution": "ZipZipPipe; savanna0425/llm-pet; noncommercial"}, indent=2), encoding="utf-8")


if __name__ == "__main__":
    prepare()
