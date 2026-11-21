"""Shared Blender studio: a seamless light grey backdrop (a shade darker than the page), soft
neutral light, a camera, and the materials of the objects (brushed and polished metal, graphite,
cast iron, porcelain, paper, leather, silicon, glass, cobalt). Used by objects.py and build.py."""
import math

import bpy  # first: it makes bmesh and mathutils importable
import bmesh
from mathutils import Vector

BLACK = (0x02 / 255, 0x03 / 255, 0x06 / 255)
CYAN = (0x7C / 255, 0xE6 / 255, 0xFC / 255)
MAGENTA = (0xFC / 255, 0x36 / 255, 0xBE / 255)
PORCELAIN = (0xF4 / 255, 0xF3 / 255, 0xEF / 255)
GRAPHITE = (0x16 / 255, 0x18 / 255, 0x1D / 255)
COBALT = (0x2E / 255, 0x5B / 255, 0xFF / 255)


def srgb_to_linear(color):
    def channel(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return tuple(channel(c) for c in color)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 10
    scene.cycles.transmission_bounces = 10
    scene.cycles.glossy_bounces = 6
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = True
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Base Contrast"
    return scene


def principled(name, base, metallic=0.0, roughness=0.3, transmission=0.0, ior=1.45, emission=None, strength=0.0, coat=0.0, anisotropic=0.0):
    material = bpy.data.materials.new(name)
    try:
        material.use_nodes = True
    except Exception:
        pass
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*srgb_to_linear(base), 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Transmission Weight"].default_value = transmission
    bsdf.inputs["IOR"].default_value = ior
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Anisotropic"].default_value = anisotropic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*srgb_to_linear(emission), 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    return material


def materials():
    # The keys are the roles in objects.py; the names are what the site looks for (scene.ts).
    return {
        "brushed": principled("Brushed metal", (0.7, 0.72, 0.75), metallic=1.0, roughness=0.32, anisotropic=0.6),
        "polished": principled("Polished metal", (0.76, 0.77, 0.79), metallic=1.0, roughness=0.22),
        "graphite": principled("Graphite", GRAPHITE, roughness=0.42, coat=0.4),
        "iron": principled("Cast iron", (0.11, 0.115, 0.125), roughness=0.72),
        "porcelain": principled("Porcelain", PORCELAIN, roughness=0.55),
        "paper": principled("Paper", (0.96, 0.955, 0.94), roughness=0.85),
        "leather": principled("Leather", (0.95, 0.945, 0.93), roughness=0.6, coat=0.15),
        "silicon": principled("Silicon", (0.13, 0.15, 0.2), metallic=0.4, roughness=0.18),
        "pcb": principled("Substrate", (0.17, 0.19, 0.21), roughness=0.5, coat=0.5),
        "cobalt": principled("Cobalt", COBALT, roughness=0.45),
        "glow": principled("Cobalt glow", COBALT, roughness=0.4, emission=COBALT, strength=3.0),
        "frosted": principled("Frosted glass", (0.96, 0.97, 0.99), roughness=0.35, transmission=1.0, ior=1.45),
        "smoked": principled("Smoked glass", (0.45, 0.48, 0.54), roughness=0.08, transmission=1.0, ior=1.5, coat=0.5),
        "steel": principled("Steel", (0.52, 0.54, 0.57), metallic=1.0, roughness=0.26, anisotropic=0.5),
        "solder": principled("Solder", (0.76, 0.77, 0.79), metallic=1.0, roughness=0.24),
        "thermal": principled("Thermal", (0.64, 0.66, 0.68), metallic=1.0, roughness=0.45),
        "ceramic": principled("Ceramic", (0.73, 0.69, 0.61), roughness=0.5),
        "laminate": principled("Laminate", (0.24, 0.26, 0.28), roughness=0.6),
        "underfill": principled("Underfill", (0.07, 0.08, 0.09), roughness=0.6),
        "concrete": principled("Concrete", (0.84, 0.83, 0.81), roughness=0.85),
        "oak": principled("Oak", (0.8, 0.7, 0.55), roughness=0.55),
        "fabric": principled("Fabric", (0.66, 0.67, 0.68), roughness=0.9),
        "foliage": principled("Foliage", (0.25, 0.36, 0.28), roughness=0.7),
        "powder": principled("Powder coat", (0.075, 0.08, 0.09), roughness=0.62),
        "deskpad": principled("Desk pad", (0.7, 0.69, 0.66), roughness=0.9),
        "rubber": principled("Rubber", (0.09, 0.095, 0.105), roughness=0.75),
        "protein": principled("Protein", (0.86, 0.81, 0.72), roughness=0.8),
        "apple": principled("Apple", (0.6, 0.09, 0.08), roughness=0.45),
        "stem": principled("Stem", (0.3, 0.22, 0.14), roughness=0.8),
    }


def textured(name, picture=None, roughness=0.5, metallic=0.0, coat=0.0, normal=None, strength=1.0, base=(1, 1, 1)):
    """A material whose colour is a picture (textures.py) or a plain colour (base), with an
    optional normal map."""
    material = principled(name, base, metallic=metallic, roughness=roughness, coat=coat)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    if picture:
        color = nodes.new("ShaderNodeTexImage")
        color.image = bpy.data.images.load(picture)
        links.new(color.outputs["Color"], bsdf.inputs["Base Color"])
    if normal:
        bumps = nodes.new("ShaderNodeTexImage")
        bumps.image = bpy.data.images.load(normal)
        bumps.image.colorspace_settings.name = "Non-Color"
        mapping = nodes.new("ShaderNodeNormalMap")
        mapping.inputs["Strength"].default_value = strength
        links.new(bumps.outputs["Color"], mapping.inputs["Color"])
        links.new(mapping.outputs["Normal"], bsdf.inputs["Normal"])
    return material


def assign(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)


def smooth(obj):
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def backdrop(scene):
    """A seamless sweep: the floor curves up into the back wall, light grey."""
    mesh = bpy.data.meshes.new("Backdrop")
    bm = bmesh.new()
    profile = []
    for i in range(20):  # floor, from the front to the bend
        profile.append((-12 + i * (12 / 20), 0.0))
    for i in range(25):  # the bend, a quarter circle of radius 4
        a = i / 24 * math.pi / 2
        profile.append((4 * math.sin(a), 4 - 4 * math.cos(a)))
    profile.append((4.0, 20.0))  # the back wall
    width = 40
    rows = []
    for x in (-width / 2, width / 2):
        rows.append([bm.verts.new((x, y + 2.0, z)) for y, z in profile])
    for i in range(len(profile) - 1):
        bm.faces.new((rows[0][i], rows[1][i], rows[1][i + 1], rows[0][i + 1]))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("Backdrop", mesh)
    scene.collection.objects.link(obj)
    smooth(obj)
    wall = principled("Backdrop grey", (0.86, 0.855, 0.84), roughness=0.7)
    assign(obj, wall)

    world = bpy.data.worlds.new("World")
    scene.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (*srgb_to_linear((0.85, 0.85, 0.84)), 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.25
    return obj


def area_light(scene, name, location, target, energy, size, color=(1, 0.93, 0.82)):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = location
    light.visible_camera = False
    direction = Vector(target) - Vector(location)
    light.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return light


def lights(scene):
    # One soft key from above left (clear shadows give the objects weight), a soft fill, a rim behind.
    area_light(scene, "Key", (-3.5, -3.0, 6.5), (0, 0, 0.8), 700, 2.2, (1.0, 1.0, 0.99))
    area_light(scene, "Fill", (5.0, -5.0, 2.5), (0, 0, 1), 120, 6.0, (1.0, 1.0, 1.0))
    area_light(scene, "Rim", (2.5, 4.0, 4.0), (0, 0, 1.1), 260, 2.0, (0.95, 0.97, 1.0))


def camera(scene, location=(0, -8.0, 2.6), target=(0, 0, 1.05), lens=58):
    data = bpy.data.cameras.new("Camera")
    data.lens = lens
    cam = bpy.data.objects.new("Camera", data)
    scene.collection.objects.link(cam)
    cam.location = location
    cam.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    return cam


def render(scene, path, width=1600, height=1066, samples=64):
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.cycles.samples = samples
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def rounded_box(name, size, bevel=0.08, segments=6):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    modifier = obj.modifiers.new("Bevel", "BEVEL")
    modifier.width = bevel
    modifier.segments = segments
    modifier.limit_method = "NONE"
    bpy.ops.object.modifier_apply(modifier="Bevel")
    smooth(obj)
    return obj
