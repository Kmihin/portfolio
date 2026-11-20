"""Shared Blender studio: a seamless ivory backdrop (a shade darker than the page), soft warm light,
a camera, and the materials of the sculptures: navy marble with gold veins, white marble with grey
veins, brass. Used by sculptures.py and build.py. (On the site the marble is drawn by its own shader,
scene.ts; these materials are for the pictures, and their names tell the site which is which.)"""
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


def marble(name, base, vein, scale=0.9, roughness=0.14):
    """Polished marble: a base colour clouded a little, fine meandering veins (a strongly distorted
    wave, kept to a thin line), a clear coat."""
    material = principled(name, base, roughness=roughness, coat=0.6)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    coords = nodes.new("ShaderNodeTexCoord")
    wave = nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.inputs["Scale"].default_value = scale
    wave.inputs["Distortion"].default_value = 16.0
    wave.inputs["Detail"].default_value = 10.0
    wave.inputs["Detail Scale"].default_value = 2.0
    wave.inputs["Detail Roughness"].default_value = 0.6
    ramp = nodes.new("ShaderNodeValToRGB")
    elements = ramp.color_ramp.elements
    elements[0].position = 0.0
    elements[0].color = (*srgb_to_linear(base), 1)
    elements[1].position = 0.955
    elements[1].color = (*srgb_to_linear(base), 1)
    middle = elements.new(0.978)
    middle.color = (*srgb_to_linear(vein), 1)
    end = elements.new(1.0)
    end.color = (*srgb_to_linear(base), 1)
    # A soft clouding of the base: a second, darker tone mixed in by a large noise.
    cloud = nodes.new("ShaderNodeTexNoise")
    cloud.inputs["Scale"].default_value = 2.5
    cloud.inputs["Detail"].default_value = 4.0
    darker = tuple(c * 0.8 for c in base)
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (*srgb_to_linear(darker), 1)
    links.new(coords.outputs["Object"], wave.inputs["Vector"])
    links.new(coords.outputs["Object"], cloud.inputs["Vector"])
    links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    links.new(cloud.outputs["Fac"], mix.inputs["Factor"])
    links.new(ramp.outputs["Color"], mix.inputs["B"])
    links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    return material


def materials():
    # The keys are the roles in sculptures.py; the names are what the site looks for (scene.ts).
    return {
        "navy": marble("Navy marble", (0.04, 0.09, 0.15), (0.88, 0.72, 0.42)),
        "white": marble("White marble", (0.93, 0.91, 0.87), (0.6, 0.59, 0.57), scale=0.7),
        "brass": principled("Brass", (0.79, 0.64, 0.38), metallic=1.0, roughness=0.3),
        "polished": principled("Polished brass", (0.84, 0.7, 0.44), metallic=1.0, roughness=0.16),
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
    wall = principled("Backdrop ivory", (0.93, 0.9, 0.84), roughness=0.7)
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
