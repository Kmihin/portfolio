"""The 3D objects of the site, modelled in Blender's Python API.

- chip: the main object. A processor package in its real layers: solder balls underneath, a
  laminated substrate printed with traces, rings of capacitors, a silicon interposer on its bumps,
  two compute dies, an I/O die and two stacks of memory on micro bumps, framed in cobalt, the metal
  that carries their heat, and a brushed heat spreader marked "KM". Each layer is its own object,
  so the site can take the chip apart (an exploded view).
- One object per case study: signed documents with a pen, a laminated steel padlock with its key, a
  rack server, a volleyball, a dumbbell with a shaker and an apple, a modern two storey house (in
  floors, with rooms inside and photos of the real apartment on its walls, so the site can lift
  the roof and the upper floor), a safe.

Every builder puts its object on the floor (z = 0), centred on x and y, and returns its parts.
Each case study object also has a story: its parts keyframed on frames 0 to 100 (the key in the
lock, the safe's door opening...). On the site the scroll through its page plays it (scene.ts);
frame 0 is the object at rest, as in the pictures. build.py exports them for the site and renders
the pictures."""
import math
import random

import bpy  # first: it makes bmesh and mathutils importable
import bmesh
from mathutils import Vector

import studio
import textures

R = math.radians


# ---------- Helpers ----------


def box(name, size, location, material, rotation=(0, 0, 0), bevel=0.02, segments=4):
    if bevel:
        obj = studio.rounded_box(name, size, bevel=bevel, segments=segments)
    else:  # a sharp box, for cutting
        bpy.ops.mesh.primitive_cube_add(size=1)
        obj = bpy.context.active_object
        obj.name = name
        obj.scale = size
        bpy.ops.object.transform_apply(scale=True)
    obj.location = location
    obj.rotation_euler = rotation
    studio.assign(obj, material)
    return obj


def cylinder(name, radius, depth, location, material, rotation=(0, 0, 0), vertices=64, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    if bevel:
        modifier = obj.modifiers.new("Bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        bpy.ops.object.modifier_apply(modifier="Bevel")
    studio.smooth(obj)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=R(40))
    except Exception:
        pass
    studio.assign(obj, material)
    return obj


def sphere(name, radius, location, material, segments=64, rings=40):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=location)
    obj = bpy.context.active_object
    obj.name = name
    studio.smooth(obj)
    studio.assign(obj, material)
    return obj


def torus(name, major, minor, location, material, rotation=(0, 0, 0), segments=96):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=segments, minor_segments=20, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    studio.smooth(obj)
    studio.assign(obj, material)
    return obj


def cut(target, cutter):
    """Cut the cutter's shape out of the target (and remove the cutter)."""
    modifier = target.modifiers.new("Cut", "BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.object = cutter
    modifier.solver = "EXACT"
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    return target


def join(objects, name):
    """Join several objects into one (the first one's material slots are kept per face)."""
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = name
    return objects[0]


def text(name, body, size, depth, location, rotation=(0, 0, 0), material=None):
    bpy.ops.object.text_add(location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.data.body = body
    obj.data.size = size
    obj.data.extrude = depth
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    bpy.ops.object.convert(target="MESH")
    obj.name = name
    if material:
        studio.assign(obj, material)
    return obj


def plane(name, size, location, material):
    """A flat picture (its UVs cover it once), facing up."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0], size[1], 1)
    bpy.ops.object.transform_apply(scale=True)
    studio.assign(obj, material)
    return obj


def turned(x, y, angle):
    return (x * math.cos(angle) - y * math.sin(angle), x * math.sin(angle) + y * math.cos(angle))


def capacitor(m, location, turn, length=0.075, width=0.04, height=0.03):
    """A small ceramic capacitor: a body with a metal cap at each end."""
    x, y, z = location
    bevel = 0.003 if length >= 0.06 else 0.0  # the tiny ones are too small to show it
    parts = [box("Cap", (length * 0.66, width, height * 0.94), location, m["ceramic"], rotation=(0, 0, turn), bevel=bevel, segments=1)]
    for end in (-1, 1):
        dx, dy = turned(end * length * 0.41, 0, turn)
        parts.append(box("CapEnd", (length * 0.18, width * 1.02, height), (x + dx, y + dy, z), m["solder"], rotation=(0, 0, turn), bevel=bevel, segments=1))
    return parts


# ---------- Stories: keyframes on frames 0 to 100 ----------

_rest = {}


def key(obj, frame, move=(0, 0, 0), turn=(0, 0, 0), size=None):
    """Key a part at a frame: moved and turned (degrees) from where it rests, optionally scaled."""
    if obj.name not in _rest:
        _rest[obj.name] = (obj.location.copy(), obj.rotation_euler.copy())
    location, rotation = _rest[obj.name]
    obj.location = (location.x + move[0], location.y + move[1], location.z + move[2])
    obj.rotation_euler = (rotation.x + R(turn[0]), rotation.y + R(turn[1]), rotation.z + R(turn[2]))
    obj.keyframe_insert("location", frame=frame)
    obj.keyframe_insert("rotation_euler", frame=frame)
    if size is not None:
        obj.scale = (size, size, size)
        obj.keyframe_insert("scale", frame=frame)


def settle(obj, origin):
    """Give a part a plain rest pose (no turn) with its origin at a point, so a story turns it about
    that point."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.context.scene.cursor.location = origin
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.context.scene.cursor.location = (0, 0, 0)
    return obj


def pivot(name, location, children):
    """An empty at a point (a hinge, the hands on a handle) holding parts that turn about it."""
    empty = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(empty)
    empty.location = location
    bpy.context.view_layer.update()
    for child in children:
        world = child.matrix_world.copy()
        child.parent = empty
        child.matrix_world = world
    return empty


# ---------- The main object: a processor ----------


def chip(m):
    """A processor, lying flat, in the layers the site takes apart (from the floor up, z):
    Balls (to 0.064), Substrate (0.06 to 0.13), Components on it, Bumps (to 0.138), Interposer
    (to 0.15), DieLine on it, MicroBumps (to 0.1545), Die (the dies and memory, to 0.1845),
    Thermal (to 0.1905) and Lid (to 0.2405)."""
    # Underneath: a grid of solder balls, and a field of capacitors in the middle where there are none.
    balls = []
    for i in range(18):
        for j in range(18):
            if 6 <= i <= 11 and 6 <= j <= 11:
                continue
            balls.append(sphere("Ball", 0.032, (-0.935 + i * 0.11, -0.935 + j * 0.11, 0.032), m["solder"], segments=8, rings=5))
    for i in range(6):
        for j in range(5):
            balls += capacitor(m, (-0.27 + i * 0.108, -0.26 + j * 0.13, 0.047), R(90) * ((i + j) % 2), length=0.06, width=0.032, height=0.026)
    balls = join(balls, "Balls")

    # The substrate: layers of laminate with thin copper planes between them (they show as fine
    # lines at the edge), and its printed top.
    stack = (("pcb", 0.012), ("solder", 0.002), ("laminate", 0.018), ("solder", 0.002), ("laminate", 0.018), ("solder", 0.002), ("pcb", 0.016))
    layers, z = [], 0.06
    for key, thickness in stack:
        inset = 0.004 if key == "solder" else 0.0
        layers.append(box("Substrate", (2.2 - inset, 2.2 - inset, thickness), (0, 0, z + thickness / 2), m[key], bevel=0.0))
        z += thickness
    layers.append(plane("Print", (2.16, 2.16), (0, 0, 0.1302), studio.textured("Substrate print", textures.image("substrate"), roughness=0.4, coat=0.6)))
    substrate = join(layers, "Substrate")

    # Components: three rings of capacitors outside the lid, small ones in the lid's notches and
    # inside it round the interposer (seen when the lid lifts), resistor arrays and a controller.
    components = []
    for side in range(4):
        angle = side * R(90)
        for k in range(11):
            along = -0.75 + k * 0.15
            x, y = turned(along, 0.84, angle)
            components += capacitor(m, (x, y, 0.145), angle + R(90))
            if k % 3 != 1:
                x, y = turned(along + 0.04, 0.95, angle)
                components += capacitor(m, (x, y, 0.143), angle, length=0.06, width=0.032, height=0.026)
        for k in range(30):
            x, y = turned(-0.87 + k * 0.06, 1.045, angle)
            components += capacitor(m, (x, y, 0.14), angle + R(90), length=0.04, width=0.02, height=0.02)
        for along in (-0.42, 0.42):
            for dx in (-0.05, 0.05):
                for out in (0.715, 0.735):
                    x, y = turned(along + dx, out, angle)
                    components += capacitor(m, (x, y, 0.14), angle, length=0.03, width=0.014, height=0.016)
        half = 0.67 if side % 2 == 0 else 0.625
        for k in range(16):
            x, y = turned(-0.56 + k * 0.075, half, angle)
            components += capacitor(m, (x, y, 0.14), angle, length=0.03, width=0.014, height=0.016)
    for x, y in ((0.93, 0.93), (-0.93, -0.93), (-0.75, 0.93)):
        components.append(box("Array", (0.1, 0.05, 0.02), (x, y, 0.14), m["graphite"], bevel=0.003, segments=1))
        for k in range(4):
            for end in (-1, 1):
                components.append(box("Lead", (0.014, 0.012, 0.022), (x - 0.036 + k * 0.024, y + end * 0.026, 0.14), m["solder"], bevel=0.0))
    components.append(box("Controller", (0.13, 0.13, 0.02), (0.92, -0.92, 0.14), m["graphite"], bevel=0.004, segments=1))
    for side in range(4):
        for k in range(8):
            x, y = turned(-0.0525 + k * 0.015, 0.072, side * R(90))
            components.append(box("Lead", (0.008, 0.016, 0.006), (0.92 + x, -0.92 + y, 0.133), m["solder"], bevel=0.0))
    components = join(components, "Components")

    # The bumps that carry the interposer, the interposer with its wiring, and the cobalt lines.
    (ix, iy), (iw, ih) = textures.INTERPOSER
    bumps = []
    for i in range(int(iw / 0.075)):
        for j in range(int(ih / 0.075)):
            bumps.append(box("Bump", (0.026, 0.026, 0.008), (ix - iw / 2 + 0.04 + i * 0.075, iy - ih / 2 + 0.04 + j * 0.075, 0.134), m["solder"], bevel=0.0))
    bumps = join(bumps, "Bumps")
    interposer = join([
        box("Interposer", (iw, ih, 0.012), (ix, iy, 0.144), m["silicon"], bevel=0.002, segments=1),
        plane("Wiring", (iw - 0.006, ih - 0.006), (ix, iy, 0.1502), studio.textured("Interposer print", textures.image("interposer"), roughness=0.25, metallic=0.3)),
    ], "Interposer")
    sites = [(center, size) for center, size, _ in textures.DIES] + list(textures.MEMORY)
    lines = []
    for (x, y), (w, h) in sites:
        frame_w, frame_h = w + 0.035, h + 0.035
        lines += [
            box("Line", (frame_w, 0.008, 0.004), (x, y + frame_h / 2, 0.1522), m["glow"], bevel=0.0),
            box("Line", (frame_w, 0.008, 0.004), (x, y - frame_h / 2, 0.1522), m["glow"], bevel=0.0),
            box("Line", (0.008, frame_h, 0.004), (x + frame_w / 2, y, 0.1522), m["glow"], bevel=0.0),
            box("Line", (0.008, frame_h, 0.004), (x - frame_w / 2, y, 0.1522), m["glow"], bevel=0.0),
        ]
    die_line = join(lines, "DieLine")

    # Micro bumps under every die and memory stack.
    micro = []
    for (x, y), (w, h) in sites:
        for i in range(int(w / 0.04)):
            for j in range(int(h / 0.04)):
                micro.append(box("MicroBump", (0.014, 0.014, 0.004), (x - w / 2 + 0.02 + i * 0.04, y - h / 2 + 0.02 + j * 0.04, 0.1525), m["solder"], bevel=0.0))
    micro = join(micro, "MicroBumps")

    # The dies on their underfill, each with a picture of its circuits, and the memory: a base die
    # with eight thin dies stacked on it.
    die = []
    for (x, y), (w, h), picture in textures.DIES:
        die.append(box("Underfill", (w + 0.02, h + 0.02, 0.008), (x, y, 0.1585), m["underfill"], bevel=0.003, segments=1))
        die.append(box("Silicon", (w, h, 0.03), (x, y, 0.1695), m["silicon"], bevel=0.002, segments=1))
        die.append(plane("Circuits", (w - 0.004, h - 0.004), (x, y, 0.1847), print_material(picture)))
    for (x, y), (w, h) in textures.MEMORY:
        die.append(box("Underfill", (w + 0.02, h + 0.02, 0.008), (x, y, 0.1585), m["underfill"], bevel=0.003, segments=1))
        die.append(box("Base", (w, h, 0.006), (x, y, 0.1575), m["silicon"], bevel=0.0))
        level = 0.1605
        for _ in range(8):
            die.append(box("Glue", (w - 0.004, h - 0.004, 0.0005), (x, y, level + 0.00025), m["underfill"], bevel=0.0))
            die.append(box("Layer", (w, h, 0.0025), (x, y, level + 0.0005 + 0.00125), m["silicon"], bevel=0.0))
            level += 0.003
    die = join(die, "Die")

    thermal = []
    for (x, y), (w, h) in sites:
        thermal.append(box("Thermal", (w - 0.02, h - 0.02, 0.006), (x, y, 0.1875), m["thermal"], bevel=0.002, segments=1))
    thermal = join(thermal, "Thermal")

    # The lid: a brushed heat spreader on a rim with a black seal, notches in its sides, laser marked.
    plate = box("Lid", (1.5, 1.5, 0.05), (0, 0, 0.2155), m["brushed"], bevel=0.012, segments=3)
    rim = box("Rim", (1.5, 1.5, 0.0565), (0, 0, 0.16225), m["brushed"], bevel=0.004, segments=1)
    cut(rim, box("Hollow", (1.38, 1.38, 0.2), (0, 0, 0.16), m["brushed"], bevel=0.0))
    seal = box("Seal", (1.48, 1.48, 0.004), (0, 0, 0.132), m["underfill"], bevel=0.0)
    cut(seal, box("Hollow", (1.4, 1.4, 0.1), (0, 0, 0.132), m["underfill"], bevel=0.0))
    for side in range(4):
        for along in (-0.42, 0.42):
            x, y = turned(along, 0.75, side * R(90))
            notch = (0.2, 0.12, 0.4) if side % 2 == 0 else (0.12, 0.2, 0.4)
            for part in (plate, rim, seal):
                cut(part, box("Notch", notch, (x, y, 0.2), m["brushed"], bevel=0.0))
    top = 0.2409
    marks = [
        text("Monogram", "KM", 0.42, 0.0008, (0, 0.16, top), material=m["graphite"]),
        text("Name", "KRISTJAN MIHIN", 0.075, 0.0008, (0, -0.16, top), material=m["graphite"]),
        text("Role", "FULL-STACK  .NET  AZURE", 0.048, 0.0008, (0, -0.27, top), material=m["graphite"]),
        text("Serial", "KM 2026 SI 01", 0.042, 0.0008, (-0.25, -0.5, top), material=m["graphite"]),
    ]
    # A small data matrix code and a pin 1 triangle.
    rng = random.Random(3)
    for i in range(12):
        for j in range(12):
            if i == 0 or j == 0 or (i == 11 and j % 2 == 0) or (j == 11 and i % 2 == 0) or rng.random() < 0.45:
                marks.append(box("Dot", (0.011, 0.011, 0.0016), (0.42 + i * 0.012, -0.6 + j * 0.012, top), m["graphite"], bevel=0.0))
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.04, depth=0.0016, location=(-0.62, 0.62, top), rotation=(0, 0, R(45)))
    triangle = bpy.context.active_object
    studio.assign(triangle, m["graphite"])
    lid = join([plate, rim, seal, *marks, triangle], "Lid")
    return [balls, substrate, components, bumps, interposer, die_line, micro, die, thermal, lid]


_prints = {}


def print_material(picture):
    """The circuits of a die (one material per picture, shared by both compute dies)."""
    if picture not in _prints:
        _prints[picture] = studio.textured("Die print " + picture, textures.image(picture), roughness=0.2, metallic=0.3)
    return _prints[picture]


# ---------- The case study objects ----------


def documents(m):
    """Signed documents passing between companies: a stack of paper on a light grey felt desk pad (so
    the white paper stands out on the light page), a pen, a seal."""
    folder = box("Folder", (1.95, 2.3, 0.03), (-0.03, 0.02, 0.015), m["deskpad"], bevel=0.02, segments=3)
    sheets = []
    for i, (dx, dy, turn) in enumerate(((-0.14, 0.06, -8), (-0.04, 0.0, 2), (0.06, -0.04, 10))):
        sheets.append(box(f"Sheet{i + 1}", (1.26, 1.78, 0.006), (dx, dy, 0.003 + i * 0.007), m["paper"], rotation=(0, 0, R(turn)), bevel=0.002, segments=1))

    # On the top sheet (local coordinates, turned with the sheet): lines of text, a signature, a seal.
    turn = R(10)
    top = 0.024

    def on_sheet(x, y):
        return (0.06 + x * math.cos(turn) - y * math.sin(turn), -0.04 + x * math.sin(turn) + y * math.cos(turn), top)

    lines = []
    for k in range(12):
        width = 0.5 if k % 4 == 3 else 0.9
        lines.append(box("Line", (width, 0.014, 0.001), on_sheet(-0.45 + width / 2, 0.66 - k * 0.075), m["graphite"], rotation=(0, 0, turn), bevel=0.0))
    lines.append(box("Signature", (0.36, 0.01, 0.001), on_sheet(0.18, -0.62), m["cobalt"], rotation=(0, 0, turn), bevel=0.0))
    top_sheet = join([sheets[2], *lines], "Top")
    seal = join([
        cylinder("Seal", 0.11, 0.012, on_sheet(-0.32, -0.6), m["cobalt"], bevel=0.004),
        torus("SealRim", 0.085, 0.005, on_sheet(-0.32, -0.6), m["paper"]),
    ], "Seal")

    # A pen lying across the stack.
    pen_turn = (0, R(90), R(-32))
    body = cylinder("PenBody", 0.042, 1.2, (0.0, -0.18, top + 0.042), m["graphite"], rotation=pen_turn, bevel=0.01)
    cap = cylinder("PenCap", 0.045, 0.4, (-0.5, 0.13, top + 0.042), m["brushed"], rotation=pen_turn, bevel=0.01)
    clip = box("PenClip", (0.34, 0.02, 0.016), (-0.47, 0.09, top + 0.094), m["polished"], rotation=(0, 0, R(-32)), bevel=0.005)
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.042, depth=0.12, location=(0.56, -0.53, top + 0.042), rotation=pen_turn)
    nib = bpy.context.active_object
    nib.name = "Nib"
    studio.smooth(nib)
    studio.assign(nib, m["polished"])
    pen = settle(join([body, cap, clip, nib], "Pen"), (0.611, -0.562, top + 0.042))  # its tip
    for part in (*sheets[:2], top_sheet, seal, pen):  # everything lies on the folder
        part.location.z += 0.031

    # The story: the sheets spread, the pen lifts, signs along the line, the seal stamps it.
    for sheet, move, turn in ((sheets[0], (-0.35, 0.1, 0), -14), (sheets[1], (0.25, 0.2, 0), 10)):
        key(sheet, 0)
        key(sheet, 25, move, (0, 0, turn))
        key(sheet, 82, move, (0, 0, turn))
        key(sheet, 100)
    for part in (top_sheet, seal):
        key(part, 0)
        key(part, 25, (0, -0.08, 0))
    key(seal, 64, (0, -0.08, 0))
    key(seal, 72, (0, -0.08, 0.32))
    key(seal, 78, (0, -0.08, 0))
    key(seal, 82, (0, -0.08, 0.03))
    key(seal, 86, (0, -0.08, 0))
    for part in (top_sheet, seal):
        key(part, 92, (0, -0.08, 0))
        key(part, 100)
    key(pen, 0)
    key(pen, 20, (-0.443, -0.169, 0.14), (0, 35, 0))
    key(pen, 30, (-0.443, -0.169, 0.006), (0, 35, 0))
    key(pen, 40, (-0.3, -0.15, 0.02), (0, 35, 0))
    key(pen, 48, (-0.2, -0.12, 0.006), (0, 35, 0))
    key(pen, 56, (-0.089, -0.107, 0.006), (0, 35, 0))
    key(pen, 63, (-0.089, -0.107, 0.16), (0, 35, 0))
    key(pen, 90, (0.12, 0.1, 0))
    key(pen, 100)
    return [folder, *sheets[:2], top_sheet, seal, pen]


def padlock(m):
    """Roles and rights: a heavy padlock of laminated steel plates, riveted, with a hardened shackle
    in shrouds, a keyway in a polished bezel, and its key."""
    plates = [box("Plate", (1.0, 0.44, 0.082), (0, 0, 0.041 + k * 0.086), m["steel"], bevel=0.014, segments=3) for k in range(9)]
    body = join(plates, "Body")
    top = 0.77
    rivets = []
    for x in (-0.4, 0.4):
        for y in (-0.13, 0.13):
            dome = sphere("Rivet", 0.036, (x, y, top), m["polished"], segments=24, rings=12)
            dome.scale = (1, 1, 0.45)
            rivets.append(dome)
    # The keyway: a polished bezel with a turning plug and a slot.
    face = -0.22
    keyway = [
        cylinder("Bezel", 0.12, 0.03, (0, face - 0.01, 0.3), m["polished"], rotation=(R(90), 0, 0), bevel=0.008),
        cylinder("Plug", 0.08, 0.034, (0, face - 0.014, 0.3), m["solder"], rotation=(R(90), 0, 0), bevel=0.004),
        box("Slot", (0.018, 0.01, 0.11), (0, face - 0.031, 0.3), m["graphite"], bevel=0.0),
        box("Ward", (0.05, 0.01, 0.014), (0.012, face - 0.031, 0.27), m["graphite"], bevel=0.0),
        text("Stamp", "HARDENED STEEL", 0.045, 0.0008, (0, face - 0.0008, 0.62), rotation=(R(90), 0, 0), material=m["graphite"]),
    ]
    # The shackle: thick hardened steel, two legs in graphite shrouds and an arch.
    # The left leg is the long one: it stays in the body when the shackle opens and turns about it.
    legs = [
        cylinder("Leg", 0.078, 0.8, (-0.3, 0, top + 0.04), m["polished"]),
        cylinder("Leg", 0.078, 0.46, (0.3, 0, top + 0.21), m["polished"]),
    ]
    arch = torus("Arch", 0.3, 0.078, (0, 0, top + 0.44), m["polished"], rotation=(R(90), 0, 0))
    cut(arch, box("Half", (0.9, 0.3, 0.45), (0, 0, top + 0.215), m["polished"], bevel=0.0))
    shackle = join([arch, *legs], "Shackle")
    shrouds = [cylinder("Shroud", 0.105, 0.05, (x, 0, top + 0.02), m["graphite"], bevel=0.01) for x in (-0.3, 0.3)]
    # The key, lying in front: a rubber grip and a cut steel blade.
    turn = R(18)
    grip = box("Grip", (0.26, 0.2, 0.05), (0.82, -0.6, 0.025), m["graphite"], rotation=(0, 0, turn), bevel=0.06, segments=6)
    cut(grip, cylinder("Hole", 0.035, 0.2, (0.88, -0.58, 0.025), m["graphite"]))
    blade = [box("Blade", (0.42, 0.06, 0.022), (0.55, -0.69, 0.011), m["polished"], rotation=(0, 0, turn), bevel=0.005)]
    for k in range(5):
        dx, dy = turned(-0.18 + k * 0.07, -0.035, turn)
        blade.append(box("Tooth", (0.035, 0.03 + 0.012 * (k % 3), 0.022), (0.55 + dx, -0.69 + dy, 0.011), m["polished"], rotation=(0, 0, turn), bevel=0.004))
    key_part = settle(join([grip, *blade], "Key"), (0.35, -0.755, 0.011))  # its tip
    key_part.rotation_mode = "ZYX"  # turn round z first (point at the lock), then stand it up
    settle(shackle, (-0.3, 0, top))  # the left leg: it swings open about it

    # The story: the key rises, points at the keyway, goes in, turns; the shackle springs open.
    key(key_part, 0)
    key(key_part, 15, (0, 0, 0.24), (0, 0, -60))
    key(key_part, 30, (-0.35, 0.135, 0.289), (0, 90, -108))
    key(key_part, 42, (-0.35, 0.615, 0.289), (0, 90, -108))
    key(key_part, 52, (-0.35, 0.615, 0.289), (0, 180, -108))
    key(key_part, 100, (-0.35, 0.615, 0.289), (0, 180, -108))
    key(shackle, 0)
    key(shackle, 52)
    key(shackle, 62, (0, 0, 0.15))
    key(shackle, 80, (0, 0, 0.15), (0, 0, 110))
    key(shackle, 100, (0, 0, 0.15), (0, 0, 110))
    return [body, join(rivets, "Rivets"), join(keyway, "Keyway"), shackle, join(shrouds, "Shrouds"), key_part]


def server(m):
    """Moving to the cloud: a 2U rack server, its drives lit in cobalt, a frosted cloud above it."""
    chassis = box("Chassis", (2.0, 1.3, 0.34), (0, 0.1, 0.17), m["brushed"], bevel=0.02)
    bezel = box("Bezel", (1.86, 0.04, 0.3), (0, -0.56, 0.17), m["graphite"], bevel=0.012)
    ears = [box("Ear", (0.09, 0.05, 0.34), (x, -0.57, 0.17), m["brushed"], bevel=0.01) for x in (-1.0, 1.0)]
    screws = [cylinder("Screw", 0.018, 0.02, (x, -0.6, z), m["polished"], rotation=(R(90), 0, 0), vertices=24) for x in (-1.0, 1.0) for z in (0.08, 0.26)]
    drives = []
    for row in range(2):
        for col in range(6):
            x = -0.72 + col * 0.26
            z = 0.1 + row * 0.13
            drive = box(f"Drive{len(drives) + 1}", (0.23, 0.03, 0.1), (x, -0.585, z), m["iron"], bevel=0.008, segments=2)
            light = box("Light", (0.02, 0.01, 0.02), (x + 0.08, -0.6, z + 0.02), m["glow"], bevel=0.003, segments=1)
            drives.append(join([drive, light], drive.name))
    vents = [box("Vent", (0.012, 0.02, 0.22), (0.86 + k * 0.025, -0.585, 0.17), m["iron"], bevel=0.002, segments=1) for k in range(4)]
    puffs = [sphere("Puff", r, (x, 0.2, z), m["frosted"], segments=40, rings=24) for x, z, r in ((-0.35, 1.05, 0.28), (0.0, 1.15, 0.36), (0.36, 1.05, 0.27), (0.12, 0.95, 0.26), (-0.15, 0.95, 0.24))]
    cloud = settle(join(puffs, "Cloud"), (0, 0.2, 1.05))

    # The story: one drive after another slides out and flies up into the cloud, which grows.
    for i, drive in enumerate(drives):
        start = 4 + i * 5.5
        x, y, z = drive.location
        key(drive, 0, size=1)
        key(drive, start, size=1)
        key(drive, start + 8, (0, -0.25, 0), size=1)
        key(drive, start + 22, (-x * 0.8, 0.2 - y, 1.05 - z), size=0.2)
        key(drive, 100, (-x * 0.8, 0.2 - y, 1.05 - z), size=0.2)
    key(cloud, 0, size=1)
    key(cloud, 50, size=1.06)
    key(cloud, 95, size=1.18)
    return [chassis, bezel, join(ears, "Ears"), join(screws, "Screws"), *drives, join(vents, "Vents"), cloud]


def volleyball(m):
    """Court booking: a volleyball with swirling blue and yellow panels, seams and fine dimples."""
    material = studio.textured("Ball", textures.image("ball"), roughness=0.4, coat=0.2, normal=textures.image("ball-normal"))
    ball = sphere("Ball", 0.62, (0, 0, 0.62), material, segments=128, rings=64)
    ball.rotation_euler = (R(25), R(-20), R(35))

    # The story: a few bounces, smaller each time, spinning, then it comes to rest.
    for frame, height, spin in ((0, 0, 0), (18, 0.9, -180), (34, 0, -360), (46, 0.5, -480), (58, 0, -600), (66, 0.2, -660), (74, 0, -700), (100, 0, -720)):
        key(ball, frame, (0, 0, height), (spin, 0, 0))
    return [ball]


def apple(m, location, radius):
    """An apple: a sphere shaped with a dimple at the top and bottom, a stem and a leaf."""
    body = sphere("Apple", radius, location, m["apple"], segments=48, rings=32)
    for vertex in body.data.vertices:
        height = vertex.co.z / radius  # -1 at the bottom, 1 at the top
        vertex.co.z *= 0.88
        if height > 0.75:
            vertex.co.z -= (height - 0.75) * 0.5 * radius
        if height < -0.8:
            vertex.co.z += (-0.8 - height) * 0.35 * radius
        vertex.co.x *= 1 + 0.06 * max(0.0, height)
        vertex.co.y *= 1 + 0.06 * max(0.0, height)
    x, y, z = location
    stem = cylinder("Stem", 0.012, 0.09, (x + 0.01, y, z + radius * 0.75), m["stem"], rotation=(0, R(12), 0), vertices=12)
    leaf = sphere("Leaf", 0.06, (x + 0.07, y, z + radius * 0.8), m["foliage"], segments=16, rings=10)
    leaf.scale = (1, 0.45, 0.12)
    leaf.rotation_euler = (0, R(-20), R(25))
    return join([body, stem, leaf], "Apple")


def fitness(m):
    """Training and nutrition: a hex dumbbell (rubber heads, a chrome handle with cobalt rings), a
    protein shaker with a cobalt lid, and an apple."""
    apothem = 0.24 * math.cos(R(30))
    level = apothem  # the heads rest on a flat side
    parts = [cylinder("Handle", 0.055, 0.62, (0, 0.15, level), m["polished"], rotation=(0, R(90), 0), vertices=32)]
    for side in (-1, 1):
        x = side * 0.42
        parts += [
            cylinder("Head", 0.24, 0.24, (x, 0.15, level), m["rubber"], rotation=(R(30), R(90), 0), vertices=6, bevel=0.02),
            cylinder("Cap", 0.1, 0.012, (x + side * 0.124, 0.15, level), m["polished"], rotation=(0, R(90), 0), vertices=32, bevel=0.003),
            cylinder("Collar", 0.085, 0.05, (side * 0.285, 0.15, level), m["polished"], rotation=(0, R(90), 0), vertices=32, bevel=0.006),
            torus("Ring", 0.058, 0.006, (side * 0.2, 0.15, level), m["cobalt"], rotation=(0, R(90), 0), segments=32),
        ]
    dumbbell = join(parts, "Dumbbell")

    shaker = join([
        cylinder("Bottle", 0.13, 0.48, (0.68, -0.42, 0.24), m["frosted"], vertices=48, bevel=0.01),
        cylinder("Protein", 0.118, 0.2, (0.68, -0.42, 0.11), m["protein"], vertices=48),
        cylinder("Lid", 0.137, 0.08, (0.68, -0.42, 0.52), m["cobalt"], vertices=48, bevel=0.01),
        cylinder("Spout", 0.045, 0.05, (0.68, -0.47, 0.585), m["cobalt"], vertices=24, bevel=0.006),
        *[box("Mark", (0.04, 0.004, 0.004), (0.68, -0.552, 0.12 + k * 0.06), m["graphite"], bevel=0.0) for k in range(5)],
    ], "Shaker")
    fruit = apple(m, (-0.6, -0.45, 0.15), 0.16)

    # The story: a curl of the dumbbell, the shaker shaken, the apple rolled a little and back.
    key(dumbbell, 0)
    key(dumbbell, 18, (0, -0.1, 0.5))
    key(dumbbell, 30, (0, -0.1, 0.5), (0, -20, 0))
    key(dumbbell, 42, (0, -0.1, 0.5), (0, 20, 0))
    key(dumbbell, 55)
    key(shaker, 0)
    key(shaker, 52)
    for k, frame in enumerate(range(56, 86, 5)):
        key(shaker, frame, (0, 0, 0.18 if k % 2 == 0 else 0.08), (0, 14 if k % 2 == 0 else -14, 0))
    key(shaker, 92)
    key(fruit, 0)
    key(fruit, 30, (0.22, 0, 0), (0, 80, 0))
    key(fruit, 70, (0.22, 0, 0), (0, 80, 0))
    key(fruit, 100)
    return [dumbbell, shaker, fruit]


def window(m, wall, face, along, z, width, height, mullions=1, cutters=()):
    """A window through a wall (and any walls behind it, cutters): an opening, a graphite frame
    and smoked glass. face: ("y", y) for a wall facing the front, ("x", x) for one facing left."""
    axis, level = face

    def at(a, depth, height_at):  # a point on the wall: along it, into it, how high
        return (level + depth, a, height_at) if axis == "x" else (a, level + depth, height_at)

    def size(a, depth, tall):
        return (depth, a, tall) if axis == "x" else (a, depth, tall)

    for target in (wall, *cutters):
        cut(target, box("Opening", size(width, 0.4, height), at(along, 0, z), m["porcelain"], bevel=0.0))
    parts = [box("Glass", size(width, 0.006, height), at(along, 0.025, z), m["smoked"], bevel=0.0)]
    t = 0.022
    for dz in (-1, 1):
        parts.append(box("Frame", size(width, 0.03, t), at(along, 0.012, z + dz * (height - t) / 2), m["graphite"], bevel=0.0))
    for k in range(mullions + 2):
        a = along - (width - t) / 2 + k * (width - t) / (mullions + 1)
        parts.append(box("Frame", size(t, 0.03, height), at(a, 0.012, z), m["graphite"], bevel=0.0))
    return parts


def walls(name, x0, x1, y0, y1, z0, z1, material, thickness=0.05):
    """Four thin walls round a floor: front (y0), back, left (x0), right."""
    height, middle = z1 - z0, (z0 + z1) / 2
    return {
        "front": box(name, (x1 - x0, thickness, height), ((x0 + x1) / 2, y0 + thickness / 2, middle), material, bevel=0.0),
        "back": box(name, (x1 - x0, thickness, height), ((x0 + x1) / 2, y1 - thickness / 2, middle), material, bevel=0.0),
        "left": box(name, (thickness, y1 - y0, height), (x0 + thickness / 2, (y0 + y1) / 2, middle), material, bevel=0.0),
        "right": box(name, (thickness, y1 - y0, height), (x1 - thickness / 2, (y0 + y1) / 2, middle), material, bevel=0.0),
    }


def table(m, x, y, z, width, depth, top_material, height=0.09):
    parts = [box("Top", (width, depth, 0.012), (x, y, z + height), top_material, bevel=0.003, segments=1)]
    for dx in (-1, 1):
        for dy in (-1, 1):
            parts.append(box("Leg", (0.01, 0.01, height), (x + dx * (width / 2 - 0.015), y + dy * (depth / 2 - 0.015), z + height / 2), m["graphite"], bevel=0.0))
    return parts


def framed_photo(m, name, location, size, facing):
    """A photo of the real apartment in a thin graphite frame, hung on a wall facing the front (-y)
    or the right (+x)."""
    turn = (R(90), 0, 0) if facing == "front" else (R(90), 0, R(90))
    picture = plane("Photo", size, location, studio.textured("Photo " + name, textures.image("photo-" + name), roughness=0.6))
    picture.rotation_euler = turn
    x, y, z = location
    behind = (x, y + 0.004, z) if facing == "front" else (x - 0.004, y, z)
    frame_size = (size[0] + 0.03, 0.006, size[1] + 0.03) if facing == "front" else (0.006, size[0] + 0.03, size[1] + 0.03)
    return [picture, box("Frame", frame_size, behind, m["graphite"], bevel=0.0)]


def house(m):
    """A holiday home: a modern two storey house in four layers the site can lift apart (Terrace,
    Ground, Upper, Roof). White walls, graphite frames and roof, big windows, a recessed balcony,
    a carport with a car, and rooms inside: living room, kitchen and dining, stairs, bedroom,
    study and bathroom. An empty named Living marks the living room (the site walks into it)."""
    white, dark, oak, fabric = m["porcelain"], m["graphite"], m["oak"], m["fabric"]

    # The terrace, with steps to the door.
    terrace = join([
        box("Terrace", (2.9, 1.7, 0.04), (0.1, -0.05, 0.02), m["concrete"], bevel=0.006, segments=1),
        box("Step", (0.62, 0.12, 0.02), (-0.27, -0.52, 0.05), m["concrete"], bevel=0.004, segments=1),
    ], "Terrace")

    # Ground floor: x -1.225 to 0.225, y -0.45 to 0.55, z 0.04 to 0.66.
    g = walls("Wall", -1.225, 0.225, -0.45, 0.55, 0.04, 0.66, white)
    ground = []
    ground += window(m, g["front"], ("y", -0.45), -1.0, 0.4, 0.16, 0.44)
    ground += window(m, g["front"], ("y", -0.45), -0.76, 0.4, 0.16, 0.44)
    ground += window(m, g["front"], ("y", -0.45), -0.27, 0.33, 0.56, 0.52, mullions=2)
    ground += window(m, g["left"], ("x", -1.225), 0.05, 0.4, 0.22, 0.4)
    ground += window(m, g["left"], ("x", -1.225), 0.35, 0.4, 0.16, 0.4)
    ground += list(g.values())
    ground.append(box("Floor", (1.36, 0.92, 0.012), (-0.5, 0.05, 0.046), oak, bevel=0.0))
    ground.append(box("Partition", (0.03, 0.4, 0.62), (-0.45, 0.3, 0.35), white, bevel=0.0))
    # Living room: rug, sofa, coffee table, a plant.
    ground.append(box("Rug", (0.46, 0.32, 0.004), (-0.82, -0.04, 0.054), fabric, bevel=0.0))
    ground += [
        box("Sofa", (0.44, 0.15, 0.06), (-0.82, 0.32, 0.085), fabric, bevel=0.015, segments=2),
        box("SofaBack", (0.44, 0.05, 0.13), (-0.82, 0.4, 0.12), fabric, bevel=0.015, segments=2),
        box("SofaArm", (0.04, 0.17, 0.09), (-1.05, 0.33, 0.1), fabric, bevel=0.012, segments=2),
        box("SofaArm", (0.04, 0.17, 0.09), (-0.59, 0.33, 0.1), fabric, bevel=0.012, segments=2),
    ]
    ground += table(m, -0.82, -0.04, 0.056, 0.2, 0.12, dark, height=0.05)
    ground += [
        cylinder("Pot", 0.035, 0.08, (-1.13, 0.45, 0.096), dark, vertices=24),
        sphere("Plant", 0.07, (-1.13, 0.45, 0.18), m["foliage"], segments=16, rings=10),
    ]
    # Kitchen along the back wall, an island, the dining table with chairs and lamps above it.
    ground += [
        box("Counter", (0.5, 0.12, 0.17), (-0.17, 0.44, 0.14), white, bevel=0.004, segments=1),
        box("Worktop", (0.52, 0.13, 0.012), (-0.17, 0.44, 0.231), dark, bevel=0.002, segments=1),
        box("Island", (0.28, 0.11, 0.17), (-0.17, 0.2, 0.14), white, bevel=0.004, segments=1),
        box("IslandTop", (0.3, 0.13, 0.012), (-0.17, 0.2, 0.231), oak, bevel=0.002, segments=1),
    ]
    ground += table(m, -0.22, -0.2, 0.052, 0.26, 0.14, oak)
    for dx in (-0.07, 0.07):
        for dy in (-1, 1):
            ground.append(box("Seat", (0.055, 0.055, 0.008), (-0.22 + dx, -0.2 + dy * 0.1, 0.11), dark, bevel=0.002, segments=1))
            ground.append(box("ChairBack", (0.055, 0.008, 0.06), (-0.22 + dx, -0.2 + dy * 0.127, 0.14), dark, bevel=0.002, segments=1))
            ground.append(box("ChairLeg", (0.008, 0.008, 0.056), (-0.22 + dx, -0.2 + dy * 0.1, 0.08), dark, bevel=0.0))
    for dx in (-0.07, 0.07):
        ground.append(cylinder("Lamp", 0.025, 0.03, (-0.22 + dx, -0.2, 0.44), dark, vertices=20))
        ground.append(box("Cord", (0.003, 0.003, 0.2), (-0.22 + dx, -0.2, 0.56), dark, bevel=0.0))
    # The stairs up, along the right wall.
    for k in range(8):
        ground.append(box("Stair", (0.12, 0.06, 0.012), (0.12, -0.36 + k * 0.06, 0.1 + k * 0.075), oak, bevel=0.0))
    ground.append(box("Stringer", (0.012, 0.5, 0.012), (0.055, -0.15, 0.36), dark, rotation=(R(51), 0, 0), bevel=0.0))
    # The carport: a graphite pier, walls, and a car.
    ground += [
        box("Pier", (0.2, 0.2, 0.64), (0.33, -0.44, 0.36), dark, bevel=0.004, segments=1),
        box("CarportBack", (1.0, 0.08, 0.62), (0.74, 0.51, 0.35), white, bevel=0.003, segments=1),
        box("CarportSide", (0.08, 0.55, 0.62), (1.21, 0.27, 0.35), white, bevel=0.003, segments=1),
        box("Car", (0.36, 0.78, 0.11), (0.76, 0.0, 0.13), dark, bevel=0.04, segments=4),
        box("Cabin", (0.3, 0.4, 0.1), (0.76, 0.05, 0.22), m["smoked"], bevel=0.04, segments=4),
    ]
    for dx in (-0.17, 0.17):
        for dy in (-0.25, 0.25):
            ground.append(cylinder("Wheel", 0.06, 0.04, (0.76 + dx, dy, 0.1), m["iron"], rotation=(0, R(90), 0), vertices=24))
    # Photos of the real apartment, framed on the walls: above the sofa and on the partition.
    ground += framed_photo(m, "living", (-0.82, 0.497, 0.44), (0.32, 0.2), facing="front")
    ground += framed_photo(m, "exterior", (-0.433, 0.3, 0.44), (0.3, 0.19), facing="right")
    ground = join(ground, "Ground")
    living = bpy.data.objects.new("Living", None)
    bpy.context.scene.collection.objects.link(living)
    living.location = (-0.82, 0.05, 0.2)

    # Upper floor: x -1.1 to 1.25, y -0.55 to 0.55, z 0.71 to 1.31; the balcony is recessed into
    # its front between x 0.29 and 1.15, back to y -0.25.
    u = walls("Wall", -1.1, 1.25, -0.55, 0.55, 0.71, 1.31, white)
    cut(u["front"], box("Recess", (0.86, 0.4, 0.62), (0.72, -0.55, 1.01), white, bevel=0.0))
    fin = box("Fin", (0.34, 0.14, 0.62), (-0.2, -0.6, 1.0), dark, bevel=0.004, segments=1)
    upper = []
    upper += window(m, u["front"], ("y", -0.55), -0.8, 1.03, 0.3, 0.34)
    upper += window(m, fin, ("y", -0.67), -0.2, 1.03, 0.22, 0.42, cutters=(u["front"],))
    upper += window(m, u["left"], ("x", -1.1), -0.2, 1.03, 0.26, 0.3)
    upper += window(m, u["left"], ("x", -1.1), 0.25, 1.03, 0.16, 0.3)
    upper += list(u.values()) + [fin]
    upper += [
        box("Slab", (2.45, 1.16, 0.05), (0.075, 0.0, 0.685), white, bevel=0.004, segments=1),
        box("Floor", (2.25, 1.0, 0.01), (0.075, 0.0, 0.715), oak, bevel=0.0),
        box("FinRail", (0.3, 0.015, 0.015), (-0.2, -0.69, 0.92), dark, bevel=0.0),
    ]
    # The balcony: recess walls, a glass door, a graphite frame, a railing, louvres.
    upper += [
        box("RecessWall", (0.05, 0.3, 0.6), (0.315, -0.4, 1.01), white, bevel=0.0),
        box("RecessWall", (0.05, 0.3, 0.6), (1.125, -0.4, 1.01), white, bevel=0.0),
        box("Glass", (0.78, 0.006, 0.5), (0.72, -0.25, 0.98), m["smoked"], bevel=0.0),
        box("Frame", (0.8, 0.03, 0.02), (0.72, -0.26, 1.23), dark, bevel=0.0),
        box("Frame", (0.8, 0.03, 0.06), (0.72, -0.26, 1.29), white, bevel=0.0),
    ]
    for k in range(4):
        upper.append(box("Frame", (0.02, 0.03, 0.5), (0.34 + k * 0.255, -0.26, 0.98), dark, bevel=0.0))
    frame = box("Frame", (1.0, 0.16, 0.62), (0.72, -0.6, 1.0), dark, bevel=0.004, segments=1)
    cut(frame, box("Inside", (0.86, 0.4, 0.5), (0.72, -0.6, 1.0), dark, bevel=0.0))
    upper.append(frame)
    upper.append(box("Rail", (0.84, 0.02, 0.02), (0.72, -0.63, 0.98), dark, bevel=0.0))
    upper += [box("Bar", (0.008, 0.008, 0.22), (0.31 + k * 0.042, -0.63, 0.86), dark, bevel=0.0) for k in range(20)]
    upper += [box("Louvre", (0.014, 0.1, 0.46), (0.98 + k * 0.034, -0.36, 0.99), dark, bevel=0.0) for k in range(6)]
    # Rooms: bedroom (left), study (middle), bathroom (behind the balcony).
    upper += [
        box("Partition", (0.03, 0.38, 0.6), (-0.35, 0.3, 1.01), white, bevel=0.0),
        box("Partition", (0.03, 0.3, 0.6), (-0.35, -0.35, 1.01), white, bevel=0.0),
        box("Partition", (0.03, 0.5, 0.6), (0.29, 0.25, 1.01), white, bevel=0.0),
    ]
    upper += [
        box("Bed", (0.36, 0.44, 0.06), (-0.72, 0.24, 0.75), oak, bevel=0.006, segments=1),
        box("Mattress", (0.34, 0.42, 0.045), (-0.72, 0.24, 0.8), white, bevel=0.012, segments=2),
        box("Duvet", (0.35, 0.28, 0.02), (-0.72, 0.17, 0.83), fabric, bevel=0.008, segments=2),
        box("Pillow", (0.13, 0.07, 0.03), (-0.79, 0.4, 0.835), white, bevel=0.012, segments=2),
        box("Pillow", (0.13, 0.07, 0.03), (-0.65, 0.4, 0.835), white, bevel=0.012, segments=2),
        box("Headboard", (0.4, 0.03, 0.16), (-0.72, 0.48, 0.79), dark, bevel=0.006, segments=1),
        box("Nightstand", (0.07, 0.07, 0.07), (-0.96, 0.44, 0.755), oak, bevel=0.004, segments=1),
        box("Nightstand", (0.07, 0.07, 0.07), (-0.48, 0.44, 0.755), oak, bevel=0.004, segments=1),
    ]
    upper += framed_photo(m, "bedroom", (-0.72, 0.497, 1.1), (0.3, 0.19), facing="front")
    upper += table(m, -0.03, 0.42, 0.72, 0.4, 0.14, oak, height=0.13)
    upper += [
        box("Monitor", (0.18, 0.012, 0.1), (-0.03, 0.46, 0.93), dark, bevel=0.003, segments=1),
        box("Screen", (0.17, 0.002, 0.09), (-0.03, 0.4535, 0.93), m["glow"], bevel=0.0),
        box("Stand", (0.012, 0.012, 0.05), (-0.03, 0.47, 0.875), dark, bevel=0.0),
        box("Chair", (0.08, 0.08, 0.01), (-0.03, 0.3, 0.8), dark, bevel=0.003, segments=1),
        box("ChairBack", (0.08, 0.01, 0.1), (-0.03, 0.26, 0.86), dark, bevel=0.003, segments=1),
        box("Shelf", (0.03, 0.3, 0.42), (-0.31, -0.3, 0.92), oak, bevel=0.003, segments=1),
        box("Tub", (0.36, 0.17, 0.08), (0.9, 0.4, 0.76), white, bevel=0.03, segments=3),
        box("Vanity", (0.2, 0.08, 0.1), (0.5, 0.46, 0.77), oak, bevel=0.004, segments=1),
        box("Basin", (0.12, 0.06, 0.012), (0.5, 0.46, 0.826), white, bevel=0.004, segments=1),
    ]
    upper = join(upper, "Upper")

    # The roof: a thin graphite slab with a deep overhang, a lower one on it, and a white ceiling.
    roof = join([
        box("Roof", (2.62, 1.36, 0.05), (0.075, -0.02, 1.335), dark, bevel=0.006, segments=2),
        box("RoofTop", (2.3, 1.06, 0.04), (0.075, -0.02, 1.38), m["iron"], bevel=0.01, segments=2),
        box("Ceiling", (2.34, 1.08, 0.004), (0.075, 0.0, 1.308), white, bevel=0.0),
    ], "Roof")
    return [terrace, ground, upper, roof, living]


def safe(m):
    """Private paperwork: a graphite safe with a brushed door, a dial and a handle wheel. Inside: a
    shelf, a stack of papers, a cobalt passport, folders and a cobalt light."""
    body = box("Body", (1.2, 1.1, 1.2), (0, 0, 0.64), m["graphite"], bevel=0.06, segments=6)
    cut(body, box("Inside", (0.98, 1.0, 0.98), (0, -0.15, 0.64), m["graphite"], bevel=0.0))
    contents = [
        box("Shelf", (0.97, 0.88, 0.02), (0, -0.1, 0.66), m["graphite"], bevel=0.0),
        box("Papers", (0.46, 0.34, 0.14), (-0.18, -0.05, 0.22), m["paper"], bevel=0.006, segments=1),
        box("Passport", (0.16, 0.22, 0.02), (0.24, -0.12, 0.16), m["cobalt"], bevel=0.006, segments=1),
        box("Folder", (0.05, 0.32, 0.36), (-0.3, -0.02, 0.85), m["paper"], bevel=0.006, segments=1),
        box("Folder", (0.05, 0.32, 0.36), (-0.24, -0.02, 0.85), m["graphite"], bevel=0.006, segments=1),
        box("Folder", (0.05, 0.32, 0.36), (-0.18, -0.02, 0.85), m["paper"], bevel=0.006, segments=1),
        box("Lamp", (0.8, 0.02, 0.012), (0, -0.5, 1.12), m["glow"], bevel=0.0),
    ]
    feet = [box("Foot", (0.14, 0.14, 0.04), (x, y, 0.02), m["iron"], bevel=0.01) for x in (-0.45, 0.45) for y in (-0.4, 0.4)]
    door = box("Door", (0.98, 0.06, 0.98), (0, -0.56, 0.64), m["brushed"], bevel=0.02)
    cut(door, box("Groove", (0.86, 0.1, 0.86), (0, -0.6, 0.64), m["brushed"], bevel=0.0, segments=1))
    inner = box("Inner", (0.84, 0.03, 0.84), (0, -0.565, 0.64), m["brushed"], bevel=0.01)
    dial = cylinder("Dial", 0.15, 0.06, (-0.15, -0.62, 0.78), m["polished"], rotation=(R(90), 0, 0), bevel=0.01)
    dial = join([dial, box("Pointer", (0.012, 0.01, 0.06), (-0.15, -0.652, 0.86), m["graphite"], bevel=0.0)], "Dial")
    ticks = []
    for k in range(40):
        a = k / 40 * math.tau
        length = 0.04 if k % 5 == 0 else 0.022
        ticks.append(box("Tick", (0.006, 0.006, length), (-0.15 + math.sin(a) * 0.19, -0.6, 0.78 + math.cos(a) * 0.19), m["graphite"], rotation=(0, -a, 0), bevel=0.0, segments=1))
    ring = torus("Ring", 0.205, 0.006, (-0.15, -0.6, 0.78), m["cobalt"], rotation=(R(90), 0, 0))
    hub = cylinder("Hub", 0.06, 0.08, (0.22, -0.62, 0.52), m["polished"], rotation=(R(90), 0, 0), bevel=0.01)
    spokes = []
    for k in range(3):
        a = R(90 + k * 120)
        spokes.append(cylinder("Spoke", 0.014, 0.2, (0.22 + math.cos(a) * 0.1, -0.64, 0.52 + math.sin(a) * 0.1), m["polished"], rotation=(0, -a + R(90), 0)))
        spokes.append(sphere("Knob", 0.03, (0.22 + math.cos(a) * 0.2, -0.64, 0.52 + math.sin(a) * 0.2), m["polished"], segments=24, rings=16))
    wheel = join([hub, *spokes], "Wheel")
    hinges = [cylinder("Hinge", 0.03, 0.16, (0.5, -0.58, z), m["polished"]) for z in (0.36, 0.92)]
    light = box("Light", (0.04, 0.01, 0.04), (0.3, -0.58, 0.95), m["glow"], bevel=0.005, segments=1)
    hinge = pivot("DoorHinge", (0.5, -0.58, 0.64), [door, inner, dial, join(ticks, "Ticks"), ring, wheel, light])

    # The story: the dial spins to the code, the wheel turns, the door swings open.
    key(dial, 0)
    key(dial, 12, turn=(0, 400, 0))
    key(dial, 25, turn=(0, 250, 0))
    key(wheel, 25)
    key(wheel, 38, turn=(0, 180, 0))
    key(hinge, 0)
    key(hinge, 38)
    key(hinge, 70, turn=(0, 0, 105))
    key(hinge, 100, turn=(0, 0, 105))
    return [body, join(contents, "Contents"), join(feet, "Feet"), join(hinges, "Hinges"), hinge]


# What build.py renders and exports: the name, the builder, where the camera looks and where it stands.
OBJECTS = {
    "chip": (chip, (0, 0, 0.12), (1.5, -3.9, 3.3)),
    "document-platform": (documents, (0, 0, 0.05), (1.0, -3.0, 2.3)),
    "rebac-authorization": (padlock, (0.2, -0.1, 0.6), (1.7, -5.2, 1.9)),
    "azure-migration": (server, (0, 0, 0.55), (1.6, -5.4, 1.9)),
    "mojbeach": (volleyball, (0, 0, 0.6), (1.2, -4.6, 1.6)),
    "fuel-guide": (fitness, (0.02, -0.1, 0.25), (1.0, -3.6, 1.7)),
    "stekner-house": (house, (0.05, 0, 0.62), (-2.6, -6.2, 2.6)),
    "omnikeep": (safe, (0, 0, 0.62), (1.4, -5.0, 1.6)),
}
