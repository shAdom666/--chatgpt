"""Pack imagegen underpaint + supplied illustration into aligned Cubism layers.

Masks perform technical part extraction; new hidden artwork is supplied by the
imagegen underpaint sources. All output keeps the 1024x1536 reference coordinates.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageChops

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "live2d" / "source"
OUT = SRC / "layers"
SIZE = (1024, 1536)


def image(name):
    im = Image.open(SRC / name).convert("RGBA")
    assert im.size == SIZE
    a = np.array(im)
    alpha = a[..., 3]
    alpha[alpha <= 6] = 0
    alpha[alpha >= 247] = 255
    a[..., :3][alpha == 0] = 0
    return Image.fromarray(a)


def poly(points):
    m = Image.new("L", SIZE)
    ImageDraw.Draw(m).polygon(points, fill=255)
    return m


def rect(box):
    m = Image.new("L", SIZE); ImageDraw.Draw(m).rectangle(box, fill=255); return m


def ellipse(box):
    m = Image.new("L", SIZE); ImageDraw.Draw(m).ellipse(box, fill=255); return m


def subtract(a, b):
    return ImageChops.subtract(a, b)


def add(name, tag, im, mask, group="body", mesh_step=25, joint=None, pivot=None):
    layer = im.copy()
    layer.putalpha(ImageChops.multiply(layer.getchannel("A"), mask))
    box = layer.getchannel("A").getbbox()
    if not box: raise ValueError("Empty layer: " + name)
    file = name + ".png"
    layer.save(OUT / file)
    x0, y0, x1, y1 = box
    step = mesh_step
    xs = list(np.linspace(max(0, x0 - 2), min(SIZE[0], x1 + 2), max(3, int((x1 - x0) / step) + 1)))
    ys = list(np.linspace(max(0, y0 - 2), min(SIZE[1], y1 + 2), max(3, int((y1 - y0) / step) + 1)))
    verts = [float(v) for y in ys for x in xs for v in (x, y)]
    triangles = []
    for y in range(len(ys) - 1):
        for x in range(len(xs) - 1):
            a = y * len(xs) + x; b = a + 1; c = a + len(xs); d = c + 1
            triangles.extend([a, b, d, a, d, c])
    entry = {"name": name, "tag": tag, "file": "layers/" + file, "bounds": list(box), "vertices": verts, "triangles": triangles, "group": group, "drawOrder": len(LAYERS) * 10}
    if joint:
        entry.update(jointBoneId=joint, jointPivotX=pivot[0], jointPivotY=pivot[1], boneWeights=[float(np.clip((verts[i+1] - 675) / 115, 0, 1)) for i in range(0, len(verts), 2)])
    LAYERS.append(entry)
    COMPOSITE.alpha_composite(layer)


LAYERS = []
COMPOSITE = Image.new("RGBA", SIZE)


def prepare():
    OUT.mkdir(parents=True, exist_ok=True)
    master = image("master-a-pose.png")
    body = image("body-underpaint.png")
    hair = image("back-hair-underpaint.png")
    wings = image("wings-underpaint.png")
    face = image("face-underpaint.png")
    add("back_hair_center", "back hair", hair, rect((320, 120, 700, 1390)), "head")
    add("back_hair_left", "back hair", hair, rect((0, 120, 319, 1390)), "head")
    add("back_hair_right", "back hair", hair, rect((701, 120, 1023, 1390)), "head")
    add("wing_left", "wings", wings, rect((0, 0, 511, 1535)), "wingLeft")
    add("wing_right", "wings", wings, rect((512, 0, 1023, 1535)), "wingRight")
    add("tail", "tail", master, poly([(823,950),(955,953),(1023,1011),(1023,1204),(946,1286),(833,1290),(784,1244),(777,1150),(815,1068)]), "tail")
    left_leg = poly([(429,914),(498,974),(503,1055),(473,1280),(475,1416),(450,1434),(393,1425),(381,1383),(400,1284),(407,1122),(415,1007)])
    right_leg = poly([(553,1045),(616,1083),(632,1152),(625,1306),(639,1414),(618,1434),(560,1430),(542,1391),(550,1312),(547,1181)])
    legs = ImageChops.lighter(left_leg, right_leg)
    add("leg_left", "legwear-l", body, left_leg, "legLeft")
    add("leg_right", "legwear-r", body, right_leg, "legRight")
    add("dress_skirt", "bottomwear", body, subtract(rect((0,786,1023,1535)), legs))
    add("dress_bodice", "topwear", body, rect((0,575,1023,791)))
    add("neck", "neck", body, rect((465,539,561,584)), "head")
    add("ear_left", "ears-l", body, rect((266,424,395,515)), "head", 12)
    add("ear_right", "ears-r", body, rect((640,424,752,515)), "head", 12)
    face_mask = rect((345,180,680,553))
    add("face_base", "face", body, face_mask, "head", 18)
    left_arm = poly([(397,619),(443,639),(438,681),(413,718),(387,759),(371,816),(363,861),(339,900),(313,903),(283,870),(256,844),(235,819),(228,791),(252,761),(283,741),(305,717),(327,680),(360,647),(373,626)])
    left_hand = poly([(247,795),(287,821),(278,850),(253,876),(209,903),(170,899),(163,877),(177,849),(207,825)])
    right_arm = poly([(620,620),(665,626),(696,659),(721,693),(747,726),(786,749),(804,775),(812,801),(792,829),(767,847),(740,877),(708,909),(680,901),(662,863),(651,820),(632,768),(615,727),(595,682)])
    right_hand = poly([(779,797),(818,818),(850,846),(862,881),(849,905),(819,904),(786,880),(758,852),(740,823)])
    add("arm_left", "handwear-l", master, ImageChops.lighter(left_arm,left_hand), "armLeft", 16, "leftElbow", (319,757))
    add("arm_right", "handwear-r", master, ImageChops.lighter(right_arm,right_hand), "armRight", 16, "rightElbow", (710,757))
    # Front-hair extraction excludes the open facial area. Inpainted skin stays
    # behind it, so head turns do not expose transparent gaps under the fringe.
    hair_outer = poly([(228,159),(761,159),(782,271),(806,330),(813,418),(842,475),(818,525),(838,596),(821,655),(806,703),(756,732),(696,715),(657,678),(623,685),(605,663),(578,565),(441,565),(433,666),(406,698),(365,715),(307,710),(268,679),(238,616),(211,575),(200,480),(213,380),(219,287)])
    face_hole = poly([(386,388),(407,356),(430,348),(461,378),(487,411),(524,428),(555,419),(577,378),(614,355),(642,383),(654,416),(667,451),(650,489),(619,521),(577,542),(523,553),(474,547),(431,531),(391,505),(362,466),(369,431)])
    front = subtract(hair_outer, face_hole)
    add("front_hair_left", "front hair", master, ImageChops.multiply(front,rect((0,0,425,1535))), "head", 16)
    add("front_hair_center", "front hair", master, ImageChops.multiply(front,rect((426,0,598,1535))), "head", 16)
    add("front_hair_right", "front hair", master, ImageChops.multiply(front,rect((599,0,1023,1535))), "head", 16)
    add("horn_left", "headwear", master, poly([(274,111),(343,83),(415,91),(436,137),(405,201),(373,282),(333,326),(288,313),(268,267),(273,218),(296,160)]), "head", 18)
    add("horn_right", "headwear", master, poly([(600,89),(666,71),(706,99),(722,158),(755,216),(754,272),(724,318),(682,314),(657,282),(645,223),(614,170)]), "head", 18)
    add("crown_root_details", "headwear", master, rect((200,0,830,199)), "head", 15)
    add("ahoge", "front hair", master, poly([(428,164),(431,92),(458,37),(506,13),(556,20),(594,55),(592,91),(561,80),(527,84),(508,128),(503,169)]), "head", 12)
    add("hair_ornament", "headwear", master, poly([(671,276),(711,262),(750,285),(780,323),(777,362),(762,391),(761,473),(764,501),(733,510),(701,502),(697,423),(693,390),(660,357),(656,316)]), "head", 10)
    # Eye aperture, iris and lash layers are separate meshes with native IDs.
    for side, box, iris_box, brow in [
        ("l", (380,395,499,488), (413,411,485,480), (398,340,457,361)),
        ("r", (550,395,661,488), (556,411,625,480), (559,340,622,362))]:
        eye_mask = ellipse(box)
        add("eye_white_"+side, "eyewhite-"+side, face, eye_mask, "head", 6)
        add("iris_"+side, "irides-"+side, master, ellipse(iris_box), "head", 5)
        # Preserve ink rather than a rectangular patch of face-colored pixels.
        a = np.array(master); rgb = a[...,:3].astype(float)
        dark = ((rgb[...,0]*.30 + rgb[...,1]*.59 + rgb[...,2]*.11) < 119).astype(np.uint8)*255
        lash_mask = ImageChops.multiply(eye_mask, Image.fromarray(dark))
        add("eyelash_"+side, "eyelash-"+side, master, lash_mask, "head", 5)
        add("eyebrow_"+side, "eyebrow-"+side, master, rect(brow), "head", 7)
    add("mouth", "mouth", face, ellipse((494,493,544,535)), "head", 5)
    COMPOSITE.save(SRC / "assembled-preview.png")
    preview = Image.new("RGBA", SIZE, (241,242,247,255)); preview.alpha_composite(COMPOSITE); preview.thumbnail((683,1024)); preview.convert("RGB").save(SRC / "assembled-preview.jpg",quality=95)
    (SRC / "layers.json").write_text(json.dumps({"width":1024,"height":1536,"layers":LAYERS},ensure_ascii=False),encoding="utf-8")
    print("Prepared",len(LAYERS),"aligned layers; native canvas",SIZE)


if __name__ == "__main__": prepare()
