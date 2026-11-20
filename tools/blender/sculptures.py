"""The sculptures of the site, modelled in Blender's Python API: navy marble with gold veins, white
marble with grey veins, and brass (studio.py). One per room of the page:

- hero: an armillary sphere, a navy marble core inside three brass rings, on a white marble stand.
- skills: a seven-sided navy marble prism on brass axle and white marble stands, one skill
  engraved in brass on each face (from content/skills.json).
- offer: a brass balance on a white marble base, a navy marble weight in one pan.
- closing: a navy marble chess king with brass bands and cross.
- contact: a white marble envelope on a brass stand, sealed with a brass KM seal.
- One per case study: a marble scroll, a floating marble island under a brass cloud, an ornate
  brass key on a pedestal, a dumbbell with marble heads and a marble apple, a marble beach court
  with a brass net, a marble chest with brass fittings, a modern villa.

Every builder puts its sculpture on the floor (z = 0), centred, and returns its parts. Parts the
site moves keep their own names (Ring1-3, Core, Prism with Label1-7, Beam, PanLeft, PanRight, Lid,
Key, Hatch, FrontDoor, Ball, Dumbbell, Cloud, Seal). Every case study object also has an empty
named Entry: the point the site zooms into when its full case study is opened. build.py exports
them for the site and renders the pictures."""
import json
import math
import os
import random

import bpy  # first: it makes bmesh and mathutils importable
import bmesh
from mathutils import Vector

import studio

R = math.radians
CONTENT = os.path.join(os.path.dirname(__file__), "..", "..", "content")


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



def lathe(name, profile, material, location=(0, 0, 0), steps=64):
    """A round shape turned from a profile: (radius, height) points from the bottom up."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(bm, geom=verts + edges, axis=(0, 0, 1), cent=(0, 0, 0), angle=math.tau, steps=steps, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    studio.smooth(obj)
    studio.assign(obj, material)
    return obj


def entry(location):
    """The point the site zooms into when the case study is opened (an empty named Entry)."""
    empty = bpy.data.objects.new("Entry", None)
    bpy.context.scene.collection.objects.link(empty)
    empty.location = location
    return empty


# ---------- The rooms ----------


def armillary(m):
    """Hero: a globe floating inside three brass rings, over a brass meridian on a white marble
    stand. The site turns the rings slowly round the globe, and the globe round its tilted axis."""
    center = (0, 0, 1.6)
    base = lathe("Base", [(0, 0), (0.55, 0), (0.55, 0.06), (0.48, 0.08), (0.42, 0.15), (0.2, 0.21), (0.13, 0.28), (0, 0.28)], m["white"])
    stem = join([
        # The stem ends at the meridian, so the turning rings never touch it.
        cylinder("Stem", 0.045, 0.38, (0, 0, 0.44), m["brass"], vertices=32),
        sphere("Knob", 0.05, (0, 0, 0.62), m["polished"], segments=32, rings=16),
    ], "Stem")
    meridian = torus("Meridian", 0.98, 0.022, center, m["brass"], rotation=(R(90), 0, 0))
    cut(meridian, box("Half", (2.4, 0.2, 1.2), (0, 0, center[2] + 0.62), m["brass"], bevel=0.0))
    # The core is a globe: navy marble seas, brass continents and meridians. Its picture is a mask
    # (red: land, green: the 30 degree lines), drawn from Natural Earth land shapes (public domain,
    # via the world-atlas package); the site paints the marble and the brass from it.
    globe = studio.textured("Globe", os.path.join(os.path.dirname(__file__), "globe-mask.png"), roughness=0.2)
    core = sphere("Core", 0.42, center, globe, segments=96, rings=64)
    rings = []
    for i, (radius, tilt) in enumerate(((0.88, (R(23), 0, 0)), (0.77, (R(90), 0, R(30))), (0.66, (R(70), R(60), 0)))):
        ring = torus(f"Ring{i + 1}", radius, 0.026, center, m["brass"], rotation=tilt)
        ticks = []
        for k in range(36):
            a = k / 36 * math.tau
            length = 0.07 if k % 3 == 0 else 0.04
            tick = box("Tick", (0.012, length, 0.012), (center[0] + math.cos(a) * radius, center[1] + math.sin(a) * radius, center[2]), m["polished"], rotation=(0, 0, a + R(90)), bevel=0.0)
            ticks.append(tick)
        # The ticks sit on a flat ring round the centre; turned with it.
        ticks = settle(join(ticks, "Ticks"), center)
        ticks.rotation_euler = tilt
        rings.append(join([ring, ticks], f"Ring{i + 1}"))
    return [base, stem, meridian, core, *rings]


SKILL_LABELS = {
    "01-csharp": "C#  .NET",
    "02-azure": "AZURE",
    "03-sql": "SQL SERVER",
    "04-devops": "DEVOPS",
    "05-frontend": "REACT",
    "06-integrations": "APIs",
    "07-security": "SECURITY",
    "08-products": "POSTGRES",
}


def prism(m):
    """Tech Expertise: a navy marble prism with a face for each skill, lying on a brass axle between
    two white marble stands; one skill engraved in brass on each face, in the order of
    content/skills.json. The labels hang from the prism (Label1, Label2, ...), so the site can turn
    the prism to any of them."""
    skills = json.load(open(os.path.join(CONTENT, "skills.json")))
    sides = len(skills)
    height = 0.95
    body = cylinder("Prism", 0.62, 2.4, (0, 0, height), m["navy"], rotation=(0, R(90), 0), vertices=sides)
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    for polygon in body.data.polygons:
        polygon.use_smooth = False
    faces = sorted(
        [polygon for polygon in body.data.polygons if abs(polygon.normal.x) < 0.1],
        key=lambda polygon: math.atan2(-polygon.normal.y, polygon.normal.z) % math.tau,
    )
    caps = [cylinder("Cap", 0.66, 0.05, (x, 0, height), m["brass"], rotation=(0, R(90), 0), vertices=sides) for x in (-1.22, 1.22)]
    for cap in caps:
        cap.rotation_euler = (0, R(90), 0)
    labels = []
    for k, (skill, face) in enumerate(zip(skills, faces)):
        normal = face.normal
        angle = math.atan2(-normal.y, normal.z)
        point = face.center + normal * 0.002
        label = text(f"Label{k + 1}", SKILL_LABELS.get(skill["id"], skill["title"].upper()), 0.24, 0.004, (point.x, point.y, point.z + height), rotation=(angle, 0, 0), material=m["polished"])
        labels.append(label)
    body = join([body, *caps], "Prism")
    holder = pivot("Turn", (0, 0, height), [body, *labels])
    axle = cylinder("Axle", 0.05, 3.0, (0, 0, height), m["polished"], rotation=(0, R(90), 0), vertices=32)
    stands = []
    for x in (-1.45, 1.45):
        stands.append(box("Stand", (0.16, 0.5, height + 0.12), (x, 0, (height + 0.12) / 2), m["white"], bevel=0.02, segments=3))
        stands.append(box("Foot", (0.3, 0.7, 0.06), (x, 0, 0.03), m["white"], bevel=0.015, segments=3))
    return [holder, axle, join(stands, "Stands")]


def balance(m):
    """What I Offer: a brass balance on a white marble base; in its pans a pair of small objects
    for each service (PAN_LOADS). The beam (Beam) and the pans (PanLeft, PanRight, their origins at
    the beam's ends) are for the site to tilt."""
    base = lathe("Base", [(0, 0), (0.5, 0), (0.5, 0.07), (0.42, 0.1), (0.3, 0.18), (0.12, 0.24), (0, 0.24)], m["white"])
    column = join([
        cylinder("Column", 0.045, 1.25, (0, 0, 0.86), m["brass"], vertices=32),
        sphere("Finial", 0.07, (0, 0, 1.62), m["polished"], segments=32, rings=16),
        cylinder("Ring", 0.07, 0.04, (0, 0, 0.3), m["polished"], vertices=32),
    ], "Column")
    top = 1.5
    beam = join([
        box("Beam", (1.7, 0.05, 0.05), (0, 0, top), m["polished"], bevel=0.012, segments=2),
        cylinder("Hub", 0.08, 0.08, (0, 0, top), m["brass"], rotation=(R(90), 0, 0), vertices=32),
        sphere("End", 0.04, (-0.85, 0, top), m["polished"], segments=24, rings=12),
        sphere("End", 0.04, (0.85, 0, top), m["polished"], segments=24, rings=12),
    ], "Beam")
    pans = []
    for side, name in ((-1, "PanLeft"), (1, "PanRight")):
        x = side * 0.85
        bowl = lathe("Bowl", [(0, 0), (0.24, 0.02), (0.32, 0.07), (0.34, 0.09), (0.33, 0.1), (0.3, 0.08), (0.22, 0.04), (0, 0.03)], m["brass"], location=(x, 0, 0.62))
        chains = []
        for k in range(3):
            a = k / 3 * math.tau
            bottom = Vector((x + math.cos(a) * 0.3, math.sin(a) * 0.3, 0.71))
            hook = Vector((x, 0, top - 0.04))
            middle = (bottom + hook) / 2
            direction = hook - bottom
            chain = cylinder("Chain", 0.006, direction.length, tuple(middle), m["polished"], vertices=8)
            chain.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
            chains.append(chain)
        pan = join([bowl, *chains], name)
        settle(pan, (x, 0, top))
        pans.append(pan)
    # What lies in the pans: a pair for each service (LoadL0, LoadR0, ...), hung from the pans so
    # they swing with them. The site shows the pair of the picked service.
    loads = []
    for i, pair in enumerate(PAN_LOADS):
        for (side, letter), build in zip(((-1, "L"), (1, "R")), pair):
            load = build(m)
            load.scale = (1.4, 1.4, 1.4)  # modelled small; a little larger reads better in the pans
            settle(load, (0, 0, 0))
            load.name = f"Load{letter}{i}"
            load.location = (side * 0.85, 0, 0.65)
            bpy.context.view_layer.update()
            pan = pans[0 if side < 0 else 1]
            load.parent = pan
            load.matrix_parent_inverse = pan.matrix_world.inverted()
            loads.append(load)
    return [base, column, beam, *pans, *loads]


# ---------- What lies in the balance's pans ----------
# Each builds one small object standing on the floor (z = 0), centred, its front towards -y.


def piece(parts, lean=0.0, turn=0.0):
    """Join the parts into one object with its origin at the floor's centre, leaned back (lean,
    degrees round x) and turned (turn, degrees round z)."""
    obj = settle(join(parts, "Piece"), (0, 0, 0))
    obj.rotation_euler = (R(-lean), 0, R(turn))
    return settle(obj, (0, 0, 0))


def browser(m, lines):
    """A browser window standing up: a white marble frame, a navy screen with brass lines of text
    (lines), a brass title bar with three dots."""
    parts = [
        box("Frame", (0.26, 0.04, 0.2), (0, 0, 0.12), m["white"], bevel=0.012, segments=2),
        box("Screen", (0.22, 0.01, 0.13), (0, -0.02, 0.105), m["navy"], bevel=0.004, segments=1),
        box("Bar", (0.262, 0.042, 0.03), (0, 0, 0.205), m["brass"], bevel=0.006, segments=1),
        box("Foot", (0.16, 0.1, 0.02), (0, 0, 0.01), m["polished"], bevel=0.005, segments=1),
    ]
    for k in range(3):
        parts.append(sphere("Dot", 0.007, (-0.11 + k * 0.02, -0.022, 0.205), m["navy"], segments=12, rings=8))
    for k, width in enumerate(lines):
        parts.append(box("Line", (width, 0.004, 0.012), (-0.09 + width / 2, -0.026, 0.145 - k * 0.028), m["polished"], bevel=0.0))
    return piece(parts, lean=8)


def gear(m, radius=0.1, teeth=10, location=(0, 0, 0)):
    """A brass gear standing up, a navy marble hub in the middle."""
    x, y, z = location
    z += radius + 0.02
    parts = [
        cylinder("Gear", radius * 0.82, 0.04, (x, y, z), m["polished"], rotation=(R(90), 0, 0), vertices=48),
        cylinder("Hub", radius * 0.3, 0.05, (x, y, z), m["navy"], rotation=(R(90), 0, 0), vertices=32),
    ]
    for k in range(teeth):
        a = k / teeth * math.tau
        parts.append(box("Tooth", (0.05, 0.04, 0.035), (x + math.cos(a) * radius * 0.9, y, z + math.sin(a) * radius * 0.9), m["polished"], rotation=(0, -a, 0), bevel=0.004, segments=1))
    return join(parts, "Gear")


def web_apps_left(m):
    return browser(m, (0.12, 0.17, 0.09))


def web_apps_right(m):
    return piece([gear(m)], turn=-15)


def websites_left(m):
    return browser(m, (0.18, 0.1, 0.14, 0.06))


def websites_right(m):
    """A fountain pen lying across the pan, its brass nib down."""
    parts = [
        lathe("Nib", [(0, 0), (0.012, 0.02), (0.024, 0.06), (0.026, 0.07), (0, 0.07)], m["polished"]),
        cylinder("Band", 0.028, 0.016, (0, 0, 0.078), m["brass"], vertices=32),
        cylinder("Barrel", 0.026, 0.16, (0, 0, 0.165), m["navy"], vertices=32),
        sphere("End", 0.026, (0, 0, 0.245), m["brass"], segments=24, rings=12),
    ]
    pen = settle(join(parts, "Pen"), (0, 0, 0.125))  # turned about its middle
    pen.rotation_euler = (0, R(-72), R(25))
    pen.location = (0, 0, 0.07)
    return settle(pen, (0, 0, 0))


def tablet(m, old):
    """A tablet standing up: the old one plain white marble, chipped and cracked; the new one a
    navy screen in a polished brass frame."""
    if old:
        slab = box("Tablet", (0.17, 0.025, 0.23), (0, 0, 0.135), m["white"], bevel=0.01, segments=2)
        cut(slab, box("Chip", (0.08, 0.1, 0.08), (0.085, 0, 0.25), m["white"], rotation=(0, R(40), 0), bevel=0.0))
        parts = [slab]
        crack = [(-0.07, 0.235), (-0.02, 0.18), (-0.045, 0.13), (0.025, 0.08), (0.0, 0.03)]
        for (x1, z1), (x2, z2) in zip(crack, crack[1:]):
            length = math.hypot(x2 - x1, z2 - z1)
            parts.append(box("Crack", (length, 0.004, 0.006), ((x1 + x2) / 2, -0.0135, (z1 + z2) / 2), m["navy"], rotation=(0, -math.atan2(z2 - z1, x2 - x1), 0), bevel=0.0))
    else:
        parts = [
            box("Tablet", (0.18, 0.026, 0.24), (0, 0, 0.14), m["polished"], bevel=0.014, segments=2),
            box("Screen", (0.158, 0.008, 0.212), (0, -0.012, 0.14), m["navy"], bevel=0.006, segments=1),
        ]
    parts.append(box("Stand", (0.12, 0.08, 0.025), (0, 0.03, 0.0125), m["polished"], bevel=0.005, segments=1))
    return piece(parts, lean=10, turn=8 if old else -8)


def plug(m):
    """A plug standing on its end, two brass pins up, its cable along the pan."""
    parts = [
        cylinder("Plug", 0.06, 0.11, (0, 0, 0.075), m["navy"], vertices=48, bevel=0.01),
        cylinder("Collar", 0.064, 0.02, (0, 0, 0.135), m["polished"], vertices=48),
        cylinder("Cable", 0.013, 0.14, (-0.09, 0, 0.02), m["brass"], rotation=(0, R(90), 0), vertices=16),
    ]
    for x in (-0.025, 0.025):
        parts.append(box("Pin", (0.014, 0.014, 0.08), (x, 0, 0.18), m["polished"], bevel=0.003, segments=1))
    return piece(parts, turn=20)


def socket(m):
    """A wall socket in white marble, standing up: a brass ring round its two holes."""
    parts = [
        box("Socket", (0.18, 0.07, 0.18), (0, 0, 0.09), m["white"], bevel=0.014, segments=2),
        torus("Ring", 0.052, 0.008, (0, -0.036, 0.1), m["polished"], rotation=(R(90), 0, 0), segments=48),
        cylinder("Face", 0.048, 0.006, (0, -0.036, 0.1), m["brass"], rotation=(R(90), 0, 0), vertices=48),
    ]
    for x in (-0.022, 0.022):
        parts.append(cylinder("Hole", 0.01, 0.01, (x, -0.04, 0.1), m["navy"], rotation=(R(90), 0, 0), vertices=16))
    return piece(parts, lean=5, turn=-12)


def rack(m):
    """A server rack in white marble with brass drive slots and small lights."""
    parts = [box("Rack", (0.16, 0.14, 0.27), (0, 0, 0.14), m["white"], bevel=0.01, segments=2)]
    for k in range(5):
        z = 0.045 + k * 0.048
        parts.append(box("Slot", (0.12, 0.008, 0.026), (-0.008, -0.071, z), m["brass"], bevel=0.002, segments=1))
        parts.append(sphere("Light", 0.006, (0.062, -0.072, z), m["navy"], segments=12, rings=8))
    return piece(parts, turn=12)


def cloud(m):
    """A small cloud of polished brass."""
    puffs = ((-0.07, 0.075, 0.065), (0.0, 0.105, 0.085), (0.075, 0.075, 0.06), (0.03, 0.055, 0.06), (-0.03, 0.055, 0.055))
    return piece([sphere("Puff", r, (x, 0, z), m["polished"], segments=32, rings=20) for x, z, r in puffs])


def clock(m):
    """An old clock: a white marble face in a brass rim, navy hands, a brass cog behind it."""
    z = 0.14
    parts = [
        cylinder("Clock", 0.11, 0.04, (0, 0, z), m["white"], rotation=(R(90), 0, 0), vertices=64),
        torus("Rim", 0.11, 0.012, (0, -0.012, z), m["brass"], rotation=(R(90), 0, 0), segments=64),
        box("Hour", (0.012, 0.006, 0.055), (0, -0.023, z + 0.024), m["navy"], bevel=0.0),
        box("Minute", (0.008, 0.006, 0.08), (0.028, -0.024, z - 0.022), m["navy"], rotation=(0, R(-140), 0), bevel=0.0),
        box("Foot", (0.12, 0.07, 0.025), (0, 0, 0.0125), m["polished"], bevel=0.005, segments=1),
        gear(m, radius=0.055, teeth=8, location=(0.09, 0.03, 0.15)),
    ]
    for k in range(12):
        a = k / 12 * math.tau
        parts.append(sphere("Mark", 0.006, (math.cos(a) * 0.088, -0.022, z + math.sin(a) * 0.088), m["polished"], segments=10, rings=6))
    return piece(parts, turn=-10)


def chip(m):
    """A modern chip: a navy marble square with brass pins and a polished die, tipped up towards
    you on a small white marble block."""
    parts = [
        box("Block", (0.16, 0.16, 0.05), (0, 0, 0.025), m["white"], bevel=0.008, segments=2),
        box("Chip", (0.15, 0.15, 0.025), (0, 0, 0.065), m["navy"], bevel=0.006, segments=1),
        box("Die", (0.07, 0.07, 0.01), (0, 0, 0.08), m["polished"], bevel=0.003, segments=1),
    ]
    for k in range(5):
        offset = -0.056 + k * 0.028
        for x, y, rotation in ((offset, -0.08, 0), (offset, 0.08, 0), (-0.08, offset, 90), (0.08, offset, 90)):
            parts.append(box("Pin", (0.012, 0.03, 0.006), (x, y, 0.066), m["polished"], rotation=(0, 0, R(rotation)), bevel=0.0))
    return piece(parts, lean=-25, turn=15)


def phone(m):
    """A phone standing up: a polished brass body, a navy screen."""
    parts = [
        box("Phone", (0.125, 0.02, 0.235), (0, 0, 0.14), m["polished"], bevel=0.018, segments=3),
        box("Screen", (0.108, 0.006, 0.212), (0, -0.01, 0.14), m["navy"], bevel=0.012, segments=2),
        box("Speaker", (0.03, 0.004, 0.005), (0, -0.0135, 0.235), m["brass"], bevel=0.0),
        box("Stand", (0.1, 0.07, 0.025), (0, 0.03, 0.0125), m["white"], bevel=0.005, segments=1),
    ]
    return piece(parts, lean=10, turn=10)


def bell(m):
    """A notification bell in polished brass."""
    parts = [
        lathe("Bell", [(0.095, 0.02), (0.09, 0.035), (0.07, 0.055), (0.056, 0.1), (0.046, 0.15), (0.034, 0.18), (0.018, 0.196), (0, 0.2)], m["polished"]),
        torus("Lip", 0.093, 0.01, (0, 0, 0.022), m["brass"], segments=48),
        sphere("Clapper", 0.022, (0, 0, 0.022), m["brass"], segments=20, rings=12),
        sphere("Knob", 0.016, (0, 0, 0.214), m["polished"], segments=20, rings=12),
    ]
    return piece(parts)


def calendar(m):
    """A desk calendar: a white marble block, a navy band with two brass rings, a grid of brass
    days with one navy (booked)."""
    parts = [
        box("Calendar", (0.2, 0.06, 0.2), (0, 0, 0.1), m["white"], bevel=0.01, segments=2),
        box("Band", (0.202, 0.062, 0.05), (0, 0, 0.18), m["navy"], bevel=0.01, segments=2),
    ]
    for x in (-0.05, 0.05):
        parts.append(torus("Ring", 0.022, 0.005, (x, 0, 0.205), m["polished"], rotation=(0, R(90), 0), segments=32))
    for row in range(3):
        for col in range(4):
            booked = row == 1 and col == 2
            parts.append(box("Day", (0.026, 0.004, 0.026), (-0.06 + col * 0.04, -0.031, 0.125 - row * 0.04), m["navy" if booked else "brass"], bevel=0.0))
    return piece(parts, lean=6, turn=-10)


def small_key(m):
    """A brass key lying on a white marble cushion, tipped up towards you."""
    z = 0.065
    parts = [
        box("Cushion", (0.22, 0.13, 0.05), (0, 0, 0.025), m["white"], bevel=0.015, segments=3),
        cylinder("Shaft", 0.011, 0.17, (0.01, 0, z), m["polished"], rotation=(0, R(90), 0), vertices=16),
        torus("Bow", 0.035, 0.01, (-0.1, 0, z), m["polished"], segments=40),
        box("Bit", (0.012, 0.035, 0.012), (0.07, -0.02, z), m["polished"], bevel=0.0),
        box("Bit", (0.012, 0.025, 0.012), (0.088, -0.015, z), m["polished"], bevel=0.0),
    ]
    return piece(parts, lean=-20, turn=-15)


def magnifier(m):
    """A brass magnifying glass leaning on a small white marble block, its lens a disc of white
    marble."""
    z = 0.12
    parts = [
        box("Block", (0.12, 0.1, 0.06), (0.06, 0.02, 0.03), m["white"], bevel=0.01, segments=2),
        torus("Rim", 0.075, 0.012, (-0.03, 0, z), m["polished"], rotation=(R(90), 0, 0), segments=48),
        cylinder("Lens", 0.072, 0.008, (-0.03, 0, z), m["white"], rotation=(R(90), 0, 0), vertices=48),
        cylinder("Grip", 0.014, 0.13, (0.08, 0, 0.05), m["navy"], rotation=(0, R(-60), 0), vertices=16),
    ]
    return piece(parts, lean=8, turn=10)


def shield(m):
    """A shield in navy marble with a polished brass rim and a brass boss, standing up."""
    # A square top and a diamond below it make the point.
    parts = [
        box("Shield", (0.2, 0.035, 0.12), (0, 0, 0.18), m["navy"], bevel=0.015, segments=3),
        cylinder("Point", 0.1, 0.035, (0, 0, 0.12), m["navy"], rotation=(R(90), 0, 0), vertices=4),
        box("Rim", (0.21, 0.03, 0.012), (0, 0.004, 0.24), m["polished"], bevel=0.003, segments=1),
        sphere("Boss", 0.03, (0, -0.02, 0.165), m["polished"], segments=24, rings=12),
        box("Stand", (0.12, 0.08, 0.02), (0, 0.03, 0.01), m["white"], bevel=0.005, segments=1),
    ]
    return piece(parts, lean=8, turn=-10)


# One pair per service, in the order of content/services.json.
PAN_LOADS = [
    (web_apps_left, web_apps_right),                           # Custom web applications
    (websites_left, websites_right),                           # Custom websites
    (lambda m: tablet(m, True), lambda m: tablet(m, False)),   # Website redesign
    (plug, socket),                                            # Integrations and APIs
    (rack, cloud),                                             # Azure and DevOps
    (clock, chip),                                             # Legacy .NET modernization
    (phone, bell),                                             # Mobile apps
    (calendar, small_key),                                     # Booking and ordering systems
    (magnifier, shield),                                       # Review and rescue
]


def king(m):
    """The closing statement: a navy marble chess king with brass bands, a brass cross on top, on
    a brass disc."""
    body = lathe("King", [
        (0, 0.06), (0.5, 0.06), (0.5, 0.16), (0.44, 0.2), (0.4, 0.3), (0.3, 0.36), (0.22, 0.48),
        (0.17, 0.8), (0.15, 1.1), (0.16, 1.28), (0.3, 1.34), (0.3, 1.4), (0.18, 1.44), (0.22, 1.56),
        (0.28, 1.72), (0.26, 1.8), (0.1, 1.86), (0, 1.86),
    ], m["navy"], steps=96)
    disc = cylinder("Disc", 0.56, 0.06, (0, 0, 0.03), m["brass"], vertices=96, bevel=0.01)
    bands = [torus("Band", 0.43, 0.022, (0, 0, 0.27), m["polished"]), torus("Band", 0.3, 0.02, (0, 0, 1.37), m["polished"])]
    cross = join([
        box("Cross", (0.07, 0.07, 0.36), (0, 0, 2.02), m["polished"], bevel=0.01, segments=2),
        box("Cross", (0.24, 0.07, 0.07), (0, 0, 2.07), m["polished"], bevel=0.01, segments=2),
        sphere("Ball", 0.06, (0, 0, 1.88), m["polished"], segments=24, rings=12),
    ], "Cross")
    return [disc, body, join(bands, "Bands"), cross]


def envelope(m):
    """Contact: a white marble envelope standing on a brass stand, its flap closed by a brass seal
    marked KM (Seal: the site lifts it as the email comes on screen)."""
    body = box("Envelope", (1.5, 0.06, 0.95), (0, 0, 0.62), m["white"], bevel=0.015, segments=3)
    mesh = bpy.data.meshes.new("Flap")
    bm = bmesh.new()
    points = [(-0.73, -0.031, 1.07), (0.73, -0.031, 1.07), (0, -0.031, 0.55)]
    front = [bm.verts.new(p) for p in points]
    back = [bm.verts.new((x, y - 0.025, z)) for x, y, z in points]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((front[i], front[j], back[j], back[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    flap = bpy.data.objects.new("Flap", mesh)
    bpy.context.scene.collection.objects.link(flap)
    studio.assign(flap, m["white"])
    edges = [box("Edge", (0.02, 0.004, 0.86), (x, -0.032, 0.6), m["white"], rotation=(0, R(a), 0), bevel=0.0) for x, a in ((-0.4, -58), (0.4, 58))]
    seal = join([
        cylinder("Seal", 0.15, 0.04, (0, -0.075, 0.6), m["polished"], rotation=(R(90), 0, 0), vertices=48, bevel=0.012),
        torus("Rim", 0.125, 0.008, (0, -0.096, 0.6), m["brass"], rotation=(R(90), 0, 0)),
        text("Mark", "KM", 0.11, 0.008, (0, -0.096, 0.6), rotation=(R(90), 0, 0), material=m["brass"]),
    ], "Seal")
    stand = join([
        box("Stand", (1.1, 0.34, 0.06), (0, 0, 0.03), m["brass"], bevel=0.015, segments=2),
        box("Slot", (1.0, 0.03, 0.14), (0, 0.06, 0.12), m["brass"], bevel=0.008, segments=2),
        box("Slot", (1.0, 0.03, 0.14), (0, -0.06, 0.12), m["brass"], bevel=0.008, segments=2),
    ], "Stand")
    return [stand, join([body, flap, *edges], "Envelope"), seal]


# ---------- The case studies ----------


def scroll(m):
    """Document platform: a white marble scroll half unrolled, brass knobs on its roller, lines of
    text inlaid in brass, a signature, and a brass seal on a navy ribbon."""
    roller = cylinder("Roller", 0.17, 1.4, (0, 0.62, 0.17), m["white"], rotation=(0, R(90), 0), vertices=64, bevel=0.01)
    knobs = []
    for x in (-0.76, 0.76):
        knobs.append(cylinder("Knob", 0.06, 0.12, (x, 0.62, 0.17), m["brass"], rotation=(0, R(90), 0), vertices=32, bevel=0.01))
        knobs.append(sphere("Knob", 0.08, (x * 1.11, 0.62, 0.17), m["polished"], segments=32, rings=16))
    sheet = box("Sheet", (1.36, 1.3, 0.02), (0, -0.02, 0.01), m["white"], bevel=0.006, segments=2)
    curl = cylinder("Curl", 0.05, 1.36, (0, -0.68, 0.05), m["white"], rotation=(0, R(90), 0), vertices=48)
    lines = []
    for k in range(10):
        width = 0.65 if k % 4 == 3 else 1.05
        lines.append(box("Line", (width, 0.016, 0.004), (-0.52 + width / 2, 0.42 - k * 0.08, 0.021), m["brass"], bevel=0.0))
    lines.append(box("Signature", (0.42, 0.012, 0.004), (0.25, -0.5, 0.021), m["polished"], bevel=0.0))
    ribbon = join([
        box("Ribbon", (0.06, 0.4, 0.006), (-0.28, -0.5, 0.024), m["navy"], rotation=(0, 0, R(18)), bevel=0.0),
        box("Ribbon", (0.06, 0.4, 0.006), (-0.2, -0.52, 0.026), m["navy"], rotation=(0, 0, R(-14)), bevel=0.0),
    ], "Ribbon")
    seal = join([
        cylinder("Seal", 0.13, 0.03, (-0.24, -0.38, 0.045), m["polished"], vertices=48, bevel=0.01),
        text("Mark", "KM", 0.1, 0.006, (-0.24, -0.38, 0.06), material=m["brass"]),
    ], "Seal")
    return [join([roller, *knobs], "Roller"), join([sheet, curl], "Sheet"), join(lines, "Text"), ribbon, seal, entry((0.1, 0.1, 0.03))]


def island(m):
    """Azure migration: a floating navy marble island with a white marble top, small marble server
    towers on it, a brass cloud above, and a few stones drifting below."""
    rng = random.Random(8)
    bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=0.82, radius2=0.05, depth=0.9, location=(0, 0, 0.75), rotation=(R(180), 0, 0))
    rock = bpy.context.active_object
    rock.name = "Rock"
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.subdivide(number_cuts=3)
    bpy.ops.object.mode_set(mode="OBJECT")
    for vertex in rock.data.vertices:
        if vertex.co.z < 0.44:  # leave the top flat
            vertex.co.x *= 1 + rng.uniform(-0.12, 0.12)
            vertex.co.y *= 1 + rng.uniform(-0.12, 0.12)
            vertex.co.z += rng.uniform(-0.04, 0.04)
    studio.assign(rock, m["navy"])
    top = cylinder("Top", 0.84, 0.08, (0, 0, 1.24), m["white"], vertices=64, bevel=0.02)
    towers = []
    for x in (-0.36, 0.0, 0.36):
        towers.append(box("Tower", (0.22, 0.3, 0.52), (x, 0.05, 1.54), m["white"], bevel=0.02, segments=3))
        for k in range(5):
            towers.append(box("Slot", (0.16, 0.01, 0.018), (x, -0.105, 1.36 + k * 0.08), m["brass"], bevel=0.0))
    cloud = join([sphere("Puff", r, (x, 0.05, z), m["polished"], segments=40, rings=24) for x, z, r in ((-0.36, 2.25, 0.24), (0.0, 2.34, 0.32), (0.34, 2.24, 0.23), (0.14, 2.14, 0.22), (-0.16, 2.14, 0.21))], "Cloud")
    settle(cloud, (0, 0.05, 2.24))
    stones = []
    for x, y, z, r in ((-0.55, -0.2, 0.25, 0.09), (0.45, 0.25, 0.12, 0.07), (0.2, -0.35, 0.02, 0.05)):
        stones.append(sphere("Stone", r, (x, y, z), m["navy"], segments=12, rings=8))
    return [rock, top, join(towers, "Towers"), cloud, join(stones, "Stones"), entry((0, -0.11, 1.52))]


def ornate_key(m):
    """Access control: an ornate brass key standing above a white marble pedestal with a navy
    marble top (Key: the site turns it a quarter when the study is picked)."""
    column = box("Pedestal", (0.5, 0.5, 0.7), (0, 0, 0.41), m["white"], bevel=0.02, segments=3)
    cut(column, box("Niche", (0.3, 0.3, 0.42), (0, -0.25, 0.38), m["white"], bevel=0.0))
    pedestal = join([
        column,
        box("Plinth", (0.66, 0.66, 0.08), (0, 0, 0.04), m["white"], bevel=0.015, segments=3),
        box("Top", (0.62, 0.62, 0.06), (0, 0, 0.79), m["navy"], bevel=0.015, segments=3),
        box("Keyhole", (0.16, 0.16, 0.012), (0, 0, 0.826), m["polished"], bevel=0.004, segments=1),
        box("Slot", (0.03, 0.09, 0.004), (0, 0, 0.833), m["navy"], bevel=0.0),
        # The niche's back, lined in navy: kept clear of the niche's own back wall (y -0.1), so the
        # two never fight over the same pixels.
        box("Inside", (0.28, 0.02, 0.4), (0, -0.115, 0.38), m["navy"], bevel=0.0),
    ], "Pedestal")
    # A small door in the pedestal, hinged on its left edge: the key opens it.
    hatch = join([
        box("Hatch", (0.3, 0.02, 0.42), (0, -0.262, 0.38), m["navy"], bevel=0.006, segments=1),
        sphere("Knob", 0.018, (0.11, -0.28, 0.38), m["polished"], segments=16, rings=10),
    ], "Hatch")
    settle(hatch, (-0.15, -0.262, 0.38))
    parts = [
        torus("Bow", 0.22, 0.035, (0, 0, 1.95), m["brass"], rotation=(R(90), 0, 0)),
        cylinder("Shaft", 0.035, 0.9, (0, 0, 1.3), m["brass"], vertices=32),
        torus("Collar", 0.05, 0.014, (0, 0, 1.68), m["polished"]),
        torus("Collar", 0.05, 0.014, (0, 0, 1.62), m["polished"]),
        sphere("Center", 0.05, (0, 0, 1.95), m["polished"], segments=24, rings=12),
    ]
    for k in range(4):  # a quatrefoil inside the bow
        a = k * R(90) + R(45)
        parts.append(torus("Leaf", 0.07, 0.014, (math.cos(a) * 0.09, 0, 1.95 + math.sin(a) * 0.09), m["polished"], rotation=(R(90), 0, 0)))
    for k, depth in enumerate((0.16, 0.1, 0.16, 0.12)):  # the bit
        parts.append(box("Bit", (depth, 0.04, 0.05), (depth / 2 + 0.02, 0, 0.92 + k * 0.06), m["brass"], bevel=0.006, segments=2))
    key_part = join(parts, "Key")
    settle(key_part, (0, 0, 1.3))
    return [pedestal, hatch, key_part, entry((0, -0.16, 0.38))]


def apple(m, location, radius):
    """An apple of white marble, its stem and leaf in brass."""
    body = sphere("Apple", radius, location, m["white"], segments=48, rings=32)
    for vertex in body.data.vertices:
        height = vertex.co.z / radius
        vertex.co.z *= 0.88
        if height > 0.75:
            vertex.co.z -= (height - 0.75) * 0.5 * radius
        if height < -0.8:
            vertex.co.z += (-0.8 - height) * 0.35 * radius
        vertex.co.x *= 1 + 0.06 * max(0.0, height)
        vertex.co.y *= 1 + 0.06 * max(0.0, height)
    x, y, z = location
    stem = cylinder("Stem", 0.012, 0.09, (x + 0.01, y, z + radius * 0.75), m["brass"], rotation=(0, R(12), 0), vertices=12)
    leaf = sphere("Leaf", 0.06, (x + 0.07, y, z + radius * 0.8), m["polished"], segments=16, rings=10)
    leaf.scale = (1, 0.45, 0.12)
    leaf.rotation_euler = (0, R(-20), R(25))
    return join([body, stem, leaf], "Apple")


def dumbbell(m):
    """Fuel Guide: a dumbbell with navy marble heads and a knurled brass handle, a white marble
    apple beside it."""
    level = 0.26
    parts = [cylinder("Handle", 0.055, 0.72, (0, 0.1, level), m["brass"], rotation=(0, R(90), 0), vertices=32)]
    for k in range(12):
        parts.append(torus("Knurl", 0.056, 0.006, (-0.2 + k * 0.036, 0.1, level), m["polished"], rotation=(0, R(90), 0), segments=32))
    for side in (-1, 1):
        parts.append(cylinder("Head", 0.26, 0.24, (side * 0.48, 0.1, level), m["navy"], rotation=(0, R(90), 0), vertices=64, bevel=0.04))
        parts.append(cylinder("Collar", 0.09, 0.05, (side * 0.335, 0.1, level), m["polished"], rotation=(0, R(90), 0), vertices=32, bevel=0.008))
        parts.append(cylinder("Cap", 0.11, 0.012, (side * 0.605, 0.1, level), m["brass"], rotation=(0, R(90), 0), vertices=48, bevel=0.004))
    return [join(parts, "Dumbbell"), apple(m, (0.82, -0.45, 0.15), 0.16), entry((0, 0.1, 0.26))]


def court(m):
    """MojBeach: a white marble beach court with brass lines, a brass net between two posts, and a
    navy marble ball over it."""
    slab = box("Court", (2.1, 1.15, 0.08), (0, 0, 0.04), m["white"], bevel=0.02, segments=3)
    lines = [
        box("Line", (1.9, 0.016, 0.004), (0, 0.47, 0.081), m["brass"], bevel=0.0),
        box("Line", (1.9, 0.016, 0.004), (0, -0.47, 0.081), m["brass"], bevel=0.0),
        box("Line", (0.016, 0.95, 0.004), (0.95, 0, 0.081), m["brass"], bevel=0.0),
        box("Line", (0.016, 0.95, 0.004), (-0.95, 0, 0.081), m["brass"], bevel=0.0),
        box("Line", (0.016, 0.95, 0.004), (0, 0, 0.081), m["brass"], bevel=0.0),
    ]
    net = [
        cylinder("Post", 0.025, 0.66, (0, y, 0.41), m["polished"], vertices=24) for y in (-0.62, 0.62)
    ]
    net.append(box("Band", (0.012, 1.24, 0.03), (0, 0, 0.7), m["polished"], bevel=0.0))
    for k in range(31):
        net.append(box("Wire", (0.004, 0.004, 0.26), (0, -0.6 + k * 0.04, 0.56), m["brass"], bevel=0.0))
    for k in range(7):
        net.append(box("Wire", (0.004, 1.2, 0.004), (0, 0, 0.44 + k * 0.04), m["brass"], bevel=0.0))
    ball = sphere("Ball", 0.13, (0.42, 0.1, 0.95), m["navy"], segments=64, rings=40)
    seams = [torus("Seam", 0.131, 0.006, (0.42, 0.1, 0.95), m["polished"], rotation=r, segments=48) for r in ((0, 0, 0), (R(90), 0, 0), (0, R(90), 0))]
    return [join([slab, *lines], "Court"), join(net, "Net"), join([ball, *seams], "Ball"), entry((-0.5, 0.1, 0.1))]


def chest(m):
    """Omnikeep: a navy marble chest with brass corners, bands and a lock (Lid: its origin on the
    hinge at the back, so the site can open it a little)."""
    body = box("Chest", (1.1, 0.7, 0.55), (0, 0, 0.3), m["navy"], bevel=0.03, segments=3)
    cut(body, box("Hollow", (0.96, 0.56, 0.5), (0, 0, 0.36), m["navy"], bevel=0.0))  # empty inside
    fittings = []
    for x in (-0.53, 0.53):
        for y in (-0.33, 0.33):
            fittings.append(box("Corner", (0.07, 0.07, 0.55), (x, y, 0.3), m["brass"], bevel=0.01, segments=2))
    for x, y in ((-0.48, -0.28), (0.48, -0.28), (-0.48, 0.28), (0.48, 0.28)):
        fittings.append(sphere("Foot", 0.05, (x, y, 0.025), m["polished"], segments=20, rings=12))
    fittings.append(box("Plate", (0.2, 0.02, 0.2), (0, -0.355, 0.42), m["polished"], bevel=0.01, segments=2))
    fittings.append(box("Keyhole", (0.03, 0.01, 0.07), (0, -0.366, 0.41), m["navy"], bevel=0.0))
    # Two hinges at the back: the barrel on the hinge line, a leaf down the back of the chest.
    for x in (-0.3, 0.3):
        fittings.append(cylinder("Hinge", 0.025, 0.14, (x, 0.37, 0.58), m["polished"], rotation=(0, R(90), 0), vertices=24))
        fittings.append(box("Leaf", (0.12, 0.012, 0.1), (x, 0.362, 0.52), m["brass"], bevel=0.004, segments=1))
    lid = join([
        box("Lid", (1.12, 0.72, 0.14), (0, 0, 0.65), m["navy"], bevel=0.05, segments=4),
        box("Band", (0.08, 0.74, 0.15), (-0.3, 0, 0.65), m["brass"], bevel=0.01, segments=2),
        box("Band", (0.08, 0.74, 0.15), (0.3, 0, 0.65), m["brass"], bevel=0.01, segments=2),
        box("Hasp", (0.08, 0.03, 0.14), (0, -0.37, 0.56), m["polished"], bevel=0.01, segments=2),
        # The hinges' leaves on the lid: they turn with it about the barrels.
        box("Leaf", (0.12, 0.012, 0.09), (-0.3, 0.366, 0.635), m["brass"], bevel=0.004, segments=1),
        box("Leaf", (0.12, 0.012, 0.09), (0.3, 0.366, 0.635), m["brass"], bevel=0.004, segments=1),
    ], "Lid")
    settle(lid, (0, 0.37, 0.58))
    return [body, join(fittings, "Fittings"), lid, entry((0, 0, 0.3))]


def villa(m):
    """The holiday apartment: a modern two storey villa in white marble, its roof, fins and window
    panes in navy marble, the window frames and railing in brass, on a white marble terrace."""
    white, navy, brass = m["white"], m["navy"], m["brass"]
    parts = [box("Terrace", (2.9, 1.7, 0.05), (0.1, -0.05, 0.025), white, bevel=0.01, segments=2)]
    ground = box("Ground", (1.45, 1.0, 0.62), (-0.5, 0.05, 0.36), white, bevel=0.006, segments=2)
    cut(ground, box("Doorway", (0.18, 0.3, 0.42), (0.12, -0.45, 0.26), white, bevel=0.0))
    parts.append(ground)
    # The hall behind the door is light, so the open door reads.
    parts.append(box("Hall", (0.16, 0.02, 0.4), (0.12, -0.315, 0.26), white, bevel=0.0))
    parts.append(box("Slab", (2.45, 1.16, 0.05), (0.075, 0.0, 0.69), white, bevel=0.006, segments=2))
    parts.append(box("Upper", (2.35, 1.1, 0.6), (0.075, 0.0, 1.01), white, bevel=0.006, segments=2))
    # The pier holding up the upper floor stands at the carport's outer front corner.
    parts.append(box("Pier", (0.2, 0.2, 0.64), (1.14, -0.44, 0.37), navy, bevel=0.006, segments=2))
    parts.append(box("CarportBack", (1.0, 0.08, 0.62), (0.74, 0.51, 0.36), white, bevel=0.004, segments=2))
    parts.append(box("Roof", (2.62, 1.36, 0.05), (0.075, -0.02, 1.335), navy, bevel=0.008, segments=2))
    parts.append(box("RoofTop", (2.3, 1.06, 0.04), (0.075, -0.02, 1.38), navy, bevel=0.01, segments=2))
    parts.append(box("Fin", (0.34, 0.14, 0.62), (-0.2, -0.6, 1.0), navy, bevel=0.006, segments=2))
    frame = box("Frame", (1.0, 0.16, 0.62), (0.72, -0.6, 1.0), navy, bevel=0.006, segments=2)
    cut(frame, box("Inside", (0.86, 0.4, 0.5), (0.72, -0.6, 1.0), navy, bevel=0.0))
    parts.append(frame)
    # Windows: a navy marble pane in a brass frame, on the wall faces.
    for x, z, w, h in ((-1.0, 0.4, 0.16, 0.44), (-0.76, 0.4, 0.16, 0.44), (-0.27, 0.34, 0.56, 0.52), (-0.8, 1.03, 0.3, 0.34), (-0.2, 1.03, 0.22, 0.42), (0.72, 0.99, 0.8, 0.46)):
        y = -0.68 if x == -0.2 and z > 0.7 else (-0.56 if z > 0.7 else -0.46)
        if x == 0.72:
            y = -0.56
        parts.append(box("Pane", (w, 0.012, h), (x, y, z), navy, bevel=0.0))
        parts.append(box("Sash", (w + 0.03, 0.008, 0.02), (x, y - 0.008, z + h / 2), brass, bevel=0.0))
        parts.append(box("Sash", (w + 0.03, 0.008, 0.02), (x, y - 0.008, z - h / 2), brass, bevel=0.0))
        parts.append(box("Sash", (0.02, 0.008, h), (x - w / 2, y - 0.008, z), brass, bevel=0.0))
        parts.append(box("Sash", (0.02, 0.008, h), (x + w / 2, y - 0.008, z), brass, bevel=0.0))
    for x, z, w, h in ((0.05, 0.4, 0.22, 0.4), (0.35, 0.4, 0.16, 0.4)):
        parts.append(box("Pane", (0.012, w, h), (-1.231, x, z), navy, bevel=0.0))
    parts.append(box("Rail", (0.84, 0.02, 0.02), (0.72, -0.64, 0.98), brass, bevel=0.0))
    parts += [box("Bar", (0.008, 0.008, 0.22), (0.31 + k * 0.042, -0.64, 0.86), brass, bevel=0.0) for k in range(20)]
    # The front door, hinged on its left edge: it opens when the case study is opened.
    door = join([
        box("FrontDoor", (0.17, 0.02, 0.41), (0.12, -0.452, 0.26), navy, bevel=0.004, segments=1),
        box("Handle", (0.012, 0.02, 0.06), (0.18, -0.468, 0.26), brass, bevel=0.0),
    ], "FrontDoor")
    settle(door, (0.035, -0.452, 0.26))
    return [join(parts, "Villa"), door, entry((0.12, -0.3, 0.26))]


def lighthouse(m):
    """Project Hub: a white marble lighthouse that watches over everything I run. Navy marble
    bands, roof and door; a brass gallery and lamp room, its faceted brass lamp (Lamp) turns
    slowly. The door (Door, hinged on its left edge) opens when the case study is opened."""
    white, navy, brass, polished = m["white"], m["navy"], m["brass"], m["polished"]

    def radius(z):
        # The tower narrows from 0.42 at its foot (z 0.2) to 0.28 at the gallery (z 1.9).
        return 0.42 - (z - 0.2) * (0.14 / 1.7)

    tower = lathe("Tower", [(0, 0.2), (0.42, 0.2), (0.28, 1.9), (0, 1.9)], white, steps=96)
    # An arched doorway: a box with a half round top.
    doorway = join([
        box("Doorway", (0.2, 0.3, 0.26), (0, -0.4, 0.33), white, bevel=0.0),
        cylinder("Arch", 0.1, 0.3, (0, -0.4, 0.46), white, rotation=(R(90), 0, 0), vertices=32),
    ], "Doorway")
    cut(tower, doorway)
    # Smooth only across the round faces, so the cut leaves no shading smear on the tower.
    bpy.ops.object.select_all(action="DESELECT")
    tower.select_set(True)
    bpy.context.view_layer.objects.active = tower
    bpy.ops.object.shade_smooth_by_angle(angle=R(30))
    # Its brass frame: two posts, the arch over them and a sill.
    arch = torus("Frame", 0.106, 0.012, (0, -0.412, 0.46), brass, rotation=(R(90), 0, 0), segments=48)
    cut(arch, box("Lower", (0.3, 0.1, 0.12), (0, -0.412, 0.4), brass, bevel=0.0))
    parts = [
        lathe("Plinth", [(0, 0), (0.62, 0), (0.62, 0.08), (0.55, 0.12), (0.5, 0.2), (0, 0.2)], white, steps=96),
        tower,
        # The hall behind the door is light, so the open door reads; kept clear of the doorway's back.
        box("Hall", (0.18, 0.02, 0.32), (0, -0.265, 0.37), white, bevel=0.0),
        arch,
        box("Post", (0.024, 0.024, 0.26), (-0.106, -0.412, 0.33), brass, bevel=0.004, segments=1),
        box("Post", (0.024, 0.024, 0.26), (0.106, -0.412, 0.33), brass, bevel=0.004, segments=1),
        box("Sill", (0.27, 0.06, 0.02), (0, -0.42, 0.21), brass, bevel=0.004, segments=1),
    ]
    for bottom, top in ((0.95, 1.08), (1.55, 1.68)):
        parts.append(lathe("Band", [(0, bottom), (radius(bottom) + 0.006, bottom), (radius(top) + 0.006, top), (0, top)], navy, steps=96))
    for z in (1.25, 1.75):
        parts.append(box("Window", (0.06, 0.03, 0.13), (0, -radius(z) + 0.004, z), navy, bevel=0.006, segments=1))
    # The gallery: a navy platform with a brass railing round it.
    parts.append(cylinder("Gallery", 0.4, 0.05, (0, 0, 1.925), navy, vertices=96, bevel=0.01))
    parts.append(torus("Rail", 0.38, 0.008, (0, 0, 2.06), brass, segments=96))
    for k in range(20):
        a = k / 20 * math.tau
        parts.append(cylinder("Post", 0.006, 0.11, (math.cos(a) * 0.38, math.sin(a) * 0.38, 2.005), brass, vertices=8))
    # The lamp room: brass bars round the lamp, a navy roof with a brass finial.
    for k in range(8):
        a = k / 8 * math.tau
        parts.append(cylinder("Bar", 0.01, 0.34, (math.cos(a) * 0.22, math.sin(a) * 0.22, 2.12), polished, vertices=12))
    parts.append(cylinder("Floor", 0.25, 0.03, (0, 0, 1.965), brass, vertices=64))
    parts.append(cylinder("Ceiling", 0.25, 0.03, (0, 0, 2.3), brass, vertices=64))
    parts.append(lathe("Roof", [(0, 2.31), (0.3, 2.31), (0.27, 2.36), (0.08, 2.56), (0, 2.6)], navy, steps=96))
    parts.append(sphere("Finial", 0.035, (0, 0, 2.63), polished, segments=24, rings=12))
    lamp = cylinder("Lamp", 0.12, 0.2, (0, 0, 2.13), polished, vertices=8)
    settle(lamp, (0, 0, 2.13))
    # The door, hinged on its left edge.
    door = join([
        box("Door", (0.19, 0.025, 0.26), (0, -0.405, 0.33), navy, bevel=0.004, segments=1),
        cylinder("DoorTop", 0.095, 0.025, (0, -0.405, 0.46), navy, rotation=(R(90), 0, 0), vertices=32),
        # Two brass studs and a ring handle.
        sphere("Stud", 0.008, (-0.05, -0.42, 0.45), polished, segments=12, rings=8),
        sphere("Stud", 0.008, (0.05, -0.42, 0.45), polished, segments=12, rings=8),
        torus("Handle", 0.016, 0.004, (0.055, -0.422, 0.32), polished, rotation=(R(90), 0, 0), segments=24),
    ], "Door")
    settle(door, (-0.095, -0.405, 0.33))
    return [join(parts, "Lighthouse"), lamp, door, entry((0, -0.3, 0.38))]


# What build.py renders and exports: the name, the builder, where the camera looks and where it stands.
OBJECTS = {
    "armillary": (armillary, (0, 0, 1.25), (1.4, -5.6, 2.2)),
    "prism": (prism, (0, 0, 0.8), (1.6, -6.2, 2.2)),
    "balance": (balance, (0, 0, 0.9), (1.2, -5.2, 1.8)),
    "king": (king, (0, 0, 1.0), (1.0, -5.0, 1.8)),
    "envelope": (envelope, (0, 0, 0.6), (1.0, -4.4, 1.4)),
    "document-platform": (scroll, (0, 0, 0.12), (0.8, -3.4, 2.6)),
    "azure-migration": (island, (0, 0, 1.2), (1.2, -5.4, 2.2)),
    "rebac-authorization": (ornate_key, (0, 0, 1.1), (1.0, -5.0, 1.8)),
    "fuel-guide": (dumbbell, (0.1, -0.1, 0.25), (1.0, -3.8, 1.8)),
    "mojbeach": (court, (0, 0, 0.4), (1.6, -4.4, 2.2)),
    "project-hub": (lighthouse, (0, 0, 1.3), (1.4, -5.8, 2.4)),
    "omnikeep": (chest, (0, 0, 0.45), (1.2, -4.2, 1.9)),
    "stekner-house": (villa, (0.05, 0, 0.62), (-2.6, -6.2, 2.6)),
}
