"""Pack the imagegen transparent six-pose sheet without enlarging the pixels."""
from pathlib import Path
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "dragon-v3"


def prepare(path):
    OUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(path).convert("RGBA")
    assert sheet.size == (1536, 1024), sheet.size
    data = np.array(sheet)
    # The generated matte uses 253 for solid interiors and has 1-level background
    # residue. Normalize only near-zero/near-solid alpha; retain antialiased edges.
    alpha = data[..., 3]
    alpha[alpha <= 6] = 0
    alpha[alpha >= 247] = 255
    data[..., :3][alpha == 0] = 0
    sheet = Image.fromarray(data)
    sheet.save(OUT / "sheet.png")
    poses = []
    for i in range(6):
        x, y = i % 3 * 512, i // 3 * 512
        image = sheet.crop((x, y, x + 512, y + 512))
        image.save(OUT / ("pose%d.png" % i))
        poses.append(image)
    # Eyelids are taken from the closed-eye happy pose of the same character.
    # They are an independent rig layer; no whole-character crossfade is used.
    idle = poses[0].copy()
    happy = poses[1]
    for dst, src in [((233, 174), (231, 170)), ((297, 169), (298, 169))]:
        w, h = 28, 22
        patch = happy.crop((src[0] - w, src[1] - h, src[0] + w, src[1] + h))
        mask = Image.new("L", (w * 2, h * 2))
        ImageDraw.Draw(mask).ellipse((2, 2, w * 2 - 3, h * 2 - 3), fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(1))
        idle.paste(patch, (dst[0] - w, dst[1] - h), mask)
    idle.save(OUT / "blink0.png")
    for i in range(1, 6):
        # Non-idle expressions have their own eye poses. Do not paste mismatched
        # eye textures onto turned heads, sleeping eyes, or different expressions.
        poses[i].save(OUT / ("blink%d.png" % i))
    poses[0].save(OUT / "character.png")
    poses[0].save(ROOT / "assets" / "pet.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    preview = Image.new("RGB", (1536, 1024), (245, 242, 250))
    preview.paste(sheet, (0, 0), sheet.getchannel("A"))
    preview.save(OUT / "preview.jpg", quality=95)
    for i, p in enumerate(poses):
        a = np.array(p.getchannel("A"))
        assert (a == 0).mean() > 0.25
        assert (a == 255).mean() > 0.1
        print("pose", i, p.size, "transparent", round(float((a == 0).mean()), 3))


if __name__ == "__main__":
    prepare(sys.argv[1])
