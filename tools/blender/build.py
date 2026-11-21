"""Builds the objects of objects.py for the site.

- export: one GLB (public/models/objects.glb). Each object sits under an empty named after it
  ("chip", or a case study's slug), centred and scaled to fit a sphere of radius 1. The parts and
  the materials keep their names: the site takes the chip apart by its part names and gives each
  material its look by name (scene.ts). The stories (keyframes on frames 0 to 100) go with it as
  one animation; the site splits it by object and plays each by the scroll.
- render: a picture of one object in the light studio (a case study cover, or the chip as the
  hero still when the page has no 3D).

Run: python3 build.py export <out dir>
     python3 build.py render <name> <samples> <out dir>"""
import os
import sys

import bpy  # first: it makes bmesh and mathutils importable
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
import objects  # noqa: E402
import studio  # noqa: E402


def bounds(parts):
    bpy.context.view_layer.update()
    corners = [part.matrix_world @ Vector(corner) for part in parts for corner in part.bound_box]
    low = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    high = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    center = (low + high) / 2
    return center, max((corner - center).length for corner in corners)


def apply_modifiers(parts):
    for part in parts:
        bpy.context.view_layer.objects.active = part
        for modifier in list(part.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)


def drop_unused_uvs(parts):
    """Parts with no picture on them need no texture coordinates: a lighter file. (The site's
    materials must then not need them either: no anisotropy, which takes its direction from them.)"""
    for part in parts:
        if part.type != "MESH":
            continue
        pictured = any(material and material.node_tree and any(node.type == "TEX_IMAGE" for node in material.node_tree.nodes) for material in part.data.materials)
        if not pictured:
            while part.data.uv_layers:
                part.data.uv_layers.remove(part.data.uv_layers[0])


def meshes_of(parts):
    """The meshes among the parts and everything they hold (parts can hang from pivots)."""
    every = [*parts, *(child for part in parts for child in part.children_recursive)]
    return [part for part in every if part.type == "MESH"]


def export(out):
    scene = studio.reset()
    scene.frame_start, scene.frame_end = 0, 100
    m = studio.materials()
    empties = []
    for name, (build, _, _) in objects.OBJECTS.items():
        parts = build(m)
        scene.frame_set(0)
        meshes = meshes_of(parts)
        apply_modifiers(meshes)
        drop_unused_uvs(meshes)
        center, radius = bounds(meshes)
        # The empty centres and scales the object, so the parts keep their own places (and their
        # keyframes stay right).
        empty = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(empty)
        empty.scale = (1 / radius,) * 3
        empty.location = -center / radius
        for part in parts:
            if part.parent is None:
                part.parent = empty
        empties.append(empty)

    bpy.ops.object.select_all(action="DESELECT")
    for empty in empties:
        empty.select_set(True)
        for child in empty.children_recursive:
            child.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=f"{out}/objects.glb",
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
        export_image_format="JPEG",
        export_jpeg_quality=88,
        export_yup=True,
        export_animations=True,
        export_animation_mode="SCENE",
        export_anim_scene_split_object=False,
        export_nla_strips_merged_animation_name="Stories",
    )


def render(name, samples, out):
    scene = studio.reset()
    m = studio.materials()
    build, target, place = objects.OBJECTS[name]
    build(m)
    scene.frame_set(0)  # the object at rest
    studio.backdrop(scene)
    studio.lights(scene)
    studio.camera(scene, location=place, target=target, lens=55)
    studio.render(scene, f"{out}/{name}.png", 1500, 1000, samples=samples)


if __name__ == "__main__":
    if sys.argv[1] == "export":
        export(sys.argv[2])
    else:
        render(sys.argv[2], int(sys.argv[3]), sys.argv[4])
