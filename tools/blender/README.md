# Blender scripts

The sculptures of the site are made with these scripts (Blender's Python module, `pip install bpy`;
it needs the Python version its wheel is built for).

- `studio.py`: the ivory studio, the lights, the camera and the materials (navy marble with gold veins, white marble, brass, polished brass).
- `sculptures.py`: the sculptures, one per room and one per case study.
- `build.py export <out dir>`: exports them all as one `sculptures.glb` (for `public/models/`), each centred and scaled to radius 1 under a node named after it.
- `build.py render <name> <samples> <out dir>`: renders one sculpture on the ivory backdrop (a preview).

Example: `python3 tools/blender/build.py export public/models`
