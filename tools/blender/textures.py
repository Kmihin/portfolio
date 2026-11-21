"""Pictures painted onto the objects (PIL and numpy): the printed top of the chip's substrate, the
floor plans of its dies and the wiring of its interposer, the volleyball's panels with their
seams and dimples (a colour picture and a normal map), and photos of the holiday apartment for the
pictures on the walls of the model house. Each is painted once per run into a temporary folder; image() gives
its path."""
import math
import os
import random
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FOLDER = tempfile.mkdtemp(prefix="km-textures-")
_painted = {}

# The chip's layout, in the chip's units (it is 2.2 wide): the interposer, the silicon that the
# dies sit on; the dies, each (centre, size, picture); and the memory stacks beside them.
INTERPOSER = ((0.0, 0.0), (1.3, 1.2))
DIES = (((-0.42, 0.28), (0.34, 0.48), "ccd"), ((-0.42, -0.28), (0.34, 0.48), "ccd"), ((0.16, 0.0), (0.42, 0.82), "iod"))
MEMORY = (((0.52, 0.27), (0.2, 0.36)), ((0.52, -0.27), (0.2, 0.36)))


def image(name):
    if name not in _painted:
        path = os.path.join(FOLDER, name + ".png")
        PAINTERS[name]().save(path)
        _painted[name] = path
    return _painted[name]


def font(size):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


# ---------- The substrate's printed top ----------


def substrate():
    """Solder mask over copper traces fanning out from under the interposer to the edge, vias, test
    pads, a pin 1 triangle and a few printed marks. Painted for a print 2.16 units wide."""
    size = 2048
    width = 2.16
    picture = Image.new("RGB", (size, size), "#23272c")
    draw = ImageDraw.Draw(picture)
    rng = random.Random(4)

    def px(x, y):
        return ((x / width + 0.5) * size, (0.5 - y / width) * size)

    trace, via = "#363c43", "#4c535b"
    # Traces from every edge of the interposer out towards the rim, bending at 45 degrees.
    for (cx, cy), (w, h) in (INTERPOSER,):
        for side in range(4):
            normal = ((1, 0), (0, 1), (-1, 0), (0, -1))[side]
            tangent = (-normal[1], normal[0])
            half_normal = (w if side % 2 == 0 else h) / 2 + 0.02
            half_along = (h if side % 2 == 0 else w) / 2 - 0.02
            count = int(half_along * 2 / 0.012)
            for k in range(count):
                along = -half_along + k * 0.012
                start = (cx + normal[0] * half_normal + tangent[0] * along, cy + normal[1] * half_normal + tangent[1] * along)
                out = 0.03 + rng.random() * 0.06
                bend = (start[0] + normal[0] * out, start[1] + normal[1] * out)
                spread = along / max(half_along, 0.01) * (0.15 + rng.random() * 0.2)
                run = abs(spread)
                diagonal = (bend[0] + normal[0] * run + tangent[0] * spread, bend[1] + normal[1] * run + tangent[1] * spread)
                length = 0.08 + rng.random() * 0.3
                end = (diagonal[0] + normal[0] * length, diagonal[1] + normal[1] * length)
                if max(abs(end[0]), abs(end[1])) > 1.0:
                    continue
                draw.line([px(*start), px(*bend), px(*diagonal), px(*end)], fill=trace, width=3, joint="curve")
                ex, ey = px(*end)
                draw.ellipse([ex - 6, ey - 6, ex + 6, ey + 6], fill=via)
                draw.ellipse([ex - 2.5, ey - 2.5, ex + 2.5, ey + 2.5], fill="#1b1e22")
    # Test pads along the rim, a pin 1 triangle and printed marks.
    for k in range(40):
        a = -0.98 + k * 0.05
        for x, y in ((a, 1.03), (a, -1.03), (1.03, a), (-1.03, a)):
            cx, cy = px(x, y)
            draw.rectangle([cx - 7, cy - 7, cx + 7, cy + 7], fill="#9aa0a8")
    tx, ty = px(-0.98, 0.98)
    draw.polygon([(tx, ty), (tx + 70, ty), (tx, ty + 70)], fill="#e9e7e1")
    marks = font(30)
    draw.text(px(0.62, -0.93), "KM-01  2026", fill="#d9d7d1", font=marks)
    draw.text(px(-0.95, -0.93), "SI  E4  0718", fill="#d9d7d1", font=marks)
    return picture


# ---------- The interposer ----------


def interposer():
    """The silicon under the dies: the outline of every die, dense wiring between them, and a grid
    of through-silicon vias. Painted for the interposer's 1.3 by 1.2."""
    (cx0, cy0), (width, height) = INTERPOSER
    size = (1536, round(1536 * height / width))
    picture = Image.new("RGB", size, "#1f2430")
    draw = ImageDraw.Draw(picture)

    def px(x, y):
        return ((x - cx0) / width + 0.5) * size[0], (0.5 - (y - cy0) / height) * size[1]

    for i in range(0, size[0], 24):  # the vias
        for j in range(0, size[1], 24):
            draw.ellipse([i + 10, j + 10, i + 14, j + 14], fill="#2c3342")
    links = "#4a5578"
    for cy in (0.28, -0.28):  # compute dies to the I/O die
        for k in range(40):
            y = cy - 0.18 + k * 0.009
            draw.line([px(-0.25, y), px(-0.05, y)], fill=links, width=2)
    for cy in (0.27, -0.27):  # the I/O die to the memory stacks
        for k in range(34):
            y = cy - 0.15 + k * 0.009
            draw.line([px(0.37, y), px(0.42, y)], fill=links, width=2)
    for (x, y), (w, h), _ in DIES:
        a, b = px(x - w / 2 - 0.01, y + h / 2 + 0.01), px(x + w / 2 + 0.01, y - h / 2 - 0.01)
        draw.rectangle([a, b], outline="#5a6690", width=3)
    for (x, y), (w, h) in MEMORY:
        a, b = px(x - w / 2 - 0.01, y + h / 2 + 0.01), px(x + w / 2 + 0.01, y - h / 2 - 0.01)
        draw.rectangle([a, b], outline="#5a6690", width=3)
    seal_ring(draw, picture.size)
    return picture


# ---------- The dies ----------


def stripes(draw, box, step, colors, vertical=False):
    x0, y0, x1, y1 = box
    k = 0
    position = x0 if vertical else y0
    end = x1 if vertical else y1
    while position < end:
        if vertical:
            draw.rectangle([position, y0, min(position + step - 1, x1), y1], fill=colors[k % 2])
        else:
            draw.rectangle([x0, position, x1, min(position + step - 1, y1)], fill=colors[k % 2])
        position += step
        k += 1


def logic(draw, box, rng, count, palette):
    x0, y0, x1, y1 = box
    for _ in range(count):
        w, h = rng.randint(6, 46), rng.randint(6, 46)
        x, y = rng.randint(x0, max(x0, x1 - w)), rng.randint(y0, max(y0, y1 - h))
        draw.rectangle([x, y, x + w, y + h], fill=rng.choice(palette))


LOGIC = ["#323a4e", "#3a4460", "#2b3244", "#424d6c", "#36405a"]
SRAM = ("#3d4766", "#2d3448")


def core(rng):
    """One processor core: its L2 cache striped at the top, logic below."""
    picture = Image.new("RGB", (300, 220), "#2e3547")
    draw = ImageDraw.Draw(picture)
    stripes(draw, (8, 8, 291, 70), 3, SRAM)
    draw.rectangle([8, 76, 291, 211], fill="#2a3142")
    logic(draw, (12, 80, 287, 207), rng, 260, LOGIC)
    for k in range(4):  # register files: small dense arrays
        stripes(draw, (20 + k * 68, 150, 70 + k * 68, 200), 2, SRAM, vertical=True)
    return picture


def seal_ring(draw, size):
    w, h = size
    draw.rectangle([0, 0, w - 1, h - 1], outline="#151922", width=14)
    draw.rectangle([18, 18, w - 19, h - 19], outline="#4a5577", width=2)


def ccd():
    """A compute die: eight cores in two columns around a shared L3 cache."""
    rng = random.Random(7)
    picture = Image.new("RGB", (768, 1024), "#262c3a")
    draw = ImageDraw.Draw(picture)
    one = core(rng)
    for row in range(4):
        y = 40 + row * 238
        picture.paste(one, (34, y))
        picture.paste(one.transpose(Image.FLIP_LEFT_RIGHT), (434, y))
    # The L3 cache: arrays of SRAM in the middle column.
    for row in range(16):
        for col in range(2):
            x0, y0 = 342 + col * 44, 44 + row * 59
            stripes(draw, (x0, y0, x0 + 38, y0 + 52), 2, SRAM, vertical=row % 2 == 0)
    seal_ring(draw, picture.size)
    return picture


def iod():
    """The I/O die: memory and PCIe interfaces along its edges, logic and a small graphics block inside."""
    rng = random.Random(11)
    picture = Image.new("RGB", (1024, 1536), "#262b37")
    draw = ImageDraw.Draw(picture)
    for side_x in (30, 914):  # the interfaces: rows of identical cells along both long edges
        for k in range(46):
            y = 40 + k * 31
            for c in range(4):
                draw.rectangle([side_x + c * 21, y, side_x + c * 21 + 16, y + 24], fill="#3c4560" if c % 2 else "#323a52")
    stripes(draw, (150, 40, 874, 120), 4, SRAM)
    logic(draw, (150, 140, 874, 900), rng, 1400, LOGIC)
    for row in range(4):  # graphics: a block of repeated compute units
        for col in range(6):
            x0, y0 = 170 + col * 116, 940 + row * 136
            draw.rectangle([x0, y0, x0 + 104, y0 + 124], fill="#303850")
            stripes(draw, (x0 + 8, y0 + 8, x0 + 96, y0 + 40), 2, SRAM)
            logic(draw, (x0 + 6, y0 + 48, x0 + 98, y0 + 118), rng, 30, LOGIC)
    seal_ring(draw, picture.size)
    return picture


# ---------- The volleyball ----------

BALL_SIZE = (2048, 1024)


def ball_field():
    """For every pixel of the picture (mapped round the sphere): its panel colour and its height."""
    w, h = BALL_SIZE
    u = (np.arange(w) + 0.5) / w
    v = 1 - (np.arange(h) + 0.5) / h
    lon, lat = np.meshgrid(u * 2 * np.pi, (v - 0.5) * np.pi)
    d = np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)])
    axis = np.argmax(np.abs(d), axis=0)
    # Project onto the faces of a cube: three strips per face, at right angles on neighbouring faces.
    major = np.take_along_axis(d, axis[None], 0)[0]
    a = np.take_along_axis(d, ((axis + 1) % 3)[None], 0)[0] / np.abs(major)
    b = np.take_along_axis(d, ((axis + 2) % 3)[None], 0)[0] / np.abs(major)
    # The swirl: turn each face's strips, most in its middle and not at all at its edge.
    edge = np.maximum(np.abs(a), np.abs(b))
    twist = 1.25 * (1 - edge) ** 1.5 * np.sign(major)
    strip = a * np.cos(twist) - b * np.sin(twist)
    index = np.clip(np.floor((strip + 1) / 2 * 3), 0, 2)
    middle = index == 1
    yellow = np.where(major > 0, middle, ~middle)
    # Seams: between the strips and along the cube's edges.
    seam = np.minimum(np.minimum(np.abs(strip - 1 / 3), np.abs(strip + 1 / 3)), 1 - edge)
    groove = np.clip(1 - seam / 0.016, 0, 1) ** 2
    # Dimples: a fine grid of shallow cups.
    cell = 0.034
    da = (a / cell) % 1 - 0.5
    db = (b / cell) % 1 - 0.5
    cup = np.clip(1 - (da**2 + db**2) / 0.12, 0, 1)
    height = -groove * 1.0 - cup * 0.18
    return lat, yellow, groove, height


def ball():
    lat, yellow, groove, _ = ball_field()
    blue = np.array([22, 52, 178], dtype=float)
    gold = np.array([250, 196, 18], dtype=float)
    color = np.where(yellow[..., None], gold, blue)
    color *= (1 - 0.35 * groove)[..., None]
    return Image.fromarray(color.clip(0, 255).astype(np.uint8))


def ball_normal():
    lat, _, _, height = ball_field()
    w, h = BALL_SIZE
    depth = 0.004  # the deepest groove, in units of the ball's radius
    east = np.gradient(height * depth, axis=1) / (np.maximum(np.cos(lat), 0.08) * 2 * np.pi / w)
    north = -np.gradient(height * depth, axis=0) / (np.pi / h)
    normal = np.stack([-east, -north, np.ones_like(east)], axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    return Image.fromarray(((normal * 0.5 + 0.5) * 255).astype(np.uint8))


def grain_normal():
    """Fine sand grain of powder coat on cast iron, as a normal map round a sphere."""
    rng = np.random.default_rng(5)
    w, h = 1024, 512
    noise = Image.fromarray((rng.random((h, w)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    height = np.asarray(noise, dtype=float) / 255
    east = np.gradient(height, axis=1) * 2.2
    north = -np.gradient(height, axis=0) * 2.2
    normal = np.stack([-east, -north, np.ones_like(east)], axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    return Image.fromarray(((normal * 0.5 + 0.5) * 255).astype(np.uint8))


# ---------- Photos of the holiday apartment (from its website) ----------

PHOTOS = os.path.join(os.path.dirname(__file__), "photos")


def photo(name):
    """A photo from the apartment's website (tools/blender/photos), for a picture on a wall in the model."""
    return lambda: Image.open(os.path.join(PHOTOS, name + ".jpg")).convert("RGB")


PAINTERS = {"substrate": substrate, "interposer": interposer, "ccd": ccd, "iod": iod, "ball": ball, "ball-normal": ball_normal, "grain-normal": grain_normal,
    "photo-living": photo("living"),
    "photo-bedroom": photo("bedroom"),
    "photo-exterior": photo("exterior"),
}
