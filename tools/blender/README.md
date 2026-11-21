# Blender scripts

The 3D objects of the site and the case study pictures are made with these scripts (Blender's Python
module, `pip install bpy`; it needs the Python version its wheel is built for).

- `studio.py`: the light studio, the lights, the camera and the materials (brushed and polished metal, graphite, cast iron, porcelain, paper, leather, silicon, glass, cobalt).
- `textures.py`: pictures painted onto the models (the substrate's traces, the dies' circuits, the volleyball's panels, seams and dimples).
- `objects.py`: the models. The chip (the main object, in separate layers so the site can open it) and one object per case study.
- `build.py export <out dir>`: exports every object as one `objects.glb` (for `public/models/`), each centred and scaled to radius 1 under a node named after it.
- `build.py render <name> <samples> <out dir>`: renders one object (`chip` or a case study slug). Case studies go to `public/covers/<slug>.webp` (WebP, 1200x800), the chip to `public/models/chip-still.webp`.

Example: `python3 tools/blender/build.py render omnikeep 64 /tmp/out`
