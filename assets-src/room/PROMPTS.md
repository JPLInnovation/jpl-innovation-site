# Real objects for the 3D studio: prompts

Run these in a Claude chat on claude.ai (or ChatGPT) with the Higgsfield connector on: the trial's unlimited
generations do not work in Claude Code. Save every file into this folder (`assets-src/room/`) with the name given;
Claude Code then slims each one down, scales it to its place and swaps it into the room.

## Stays as it is (and why)

| Thing | Why it stays |
|---|---|
| F450 drone, KitBot robot | the team's real CAD: a generated one would be a made-up machine |
| Monitor and laptop screens | live 4K screenshots of the real pages, they scroll |
| Whiteboards, easel board text | written live from the site's text |
| Project wall panels, portraits, logo, door sign | the site's own pictures and words |
| Sketchbook | draws the real design page stroke by stroke |
| Window frame, walls, floor, ceiling | the room's shape: they get real-looking **textures** instead (batch D) |
| Blinking LEDs, light strips, dust | effects, kept on top of the new objects |

## Message to paste first (once per chat)

> For each item I send, use Higgsfield to make a realistic **3D model (GLB)**: first generate a clean product photo
> of the object with GPT Image 2.6 (4k, high quality, plain light-grey studio background, three-quarter view, soft
> even light, no text or logos), then turn that photo into a 3D model. Real materials (wood grain, brushed metal,
> matte plastic, fabric), **game-ready: under 40,000 triangles, PBR textures at 2K**. Give me the GLB and the photo
> for each, named as I say. Use my unlimited trial generations. Don't ask between items, just go through the list.

## Batch A: the desk area and the team's table

1. `desk.glb`: a modern home-office desk, light oak top 160 x 75 cm, slim matte black steel legs, a cable tray underneath, slightly used
2. `desk-lamp.glb`: an architect's desk lamp, matte black, articulated arm, warm bulb
3. `keyboard.glb`: a compact mechanical keyboard, dark grey keys, a few off-white keys
4. `monitor.glb`: a 27-inch computer monitor on a slim stand, thin black bezels, screen **plain black** (the website puts the real page on it)
5. `mouse.glb`: a wireless mouse on a small dark felt mouse pad
6. `team-table.glb`: a long meeting table, 200 x 90 cm, walnut top, black metal frame
7. `chair.glb`: a modern office chair, black mesh back, grey fabric seat, five-star base with wheels
8. `laptop.glb`: a slim silver laptop, open, screen **plain black**
9. `mug.glb`: a matte white ceramic coffee mug, a little steam not needed

## Batch B: the work stations

10. `robot-cart.glb`: a low heavy-duty rolling workshop cart, 120 x 80 cm, grey steel deck, rubber caster wheels, a few scuffs (a robot stands on it)
11. `pegboard.glb`: a white metal pegboard 170 x 105 cm with real hand tools hung on it: pliers, screwdrivers, hex keys, a tape measure, wire cutters, a small hammer
12. `workbench.glb`: a sturdy electronics workbench, 180 x 75 cm, light wood top on grey steel frame, a lower shelf
13. `landing-mat.glb`: a flat green self-healing cutting mat with a white grid, 90 x 60 cm, lying flat
14. `soldering-station.glb`: a soldering station with iron in its holder, a brass tip cleaner and a small spool of solder
15. `multimeter.glb`: a yellow handheld digital multimeter with red and black probes
16. `battery.glb`: a LiPo drone battery pack, 4S, black wrap, yellow XT60 plug
17. `server-rack.glb`: a 12U black network rack cabinet on castors, open front, with two network switches and neat blue and yellow patch cables (the website adds blinking port lights on top)
18. `easel.glb`: a wooden A-frame easel holding a blank white whiteboard 60 x 80 cm (the website writes on it)
19. `toolbox.glb`: a red metal workshop toolbox, closed, slightly worn
20. `parts-shelf.glb`: a wall shelf with clear plastic parts bins full of screws, propellers and small electronics

## Batch C: the back wall and the room's life

21. `binders.glb`: eight office ring binders standing on a wooden wall shelf, mixed blue, red, orange, green, purple, teal spines, no text
22. `shelving.glb`: a tall open metal shelving unit with labelled plastic storage bins and a few boxes
23. `plant-floor.glb`: a large indoor fiddle-leaf fig in a matte white pot, about 1.4 m tall
24. `plant-desk.glb`: a small snake plant in a concrete pot, about 30 cm
25. `plant-sill.glb`: a small leafy pothos in a white pot, a few vines hanging down
26. `door.glb`: a modern flat interior door in a light wood finish with a slim black handle, in its frame, slightly ajar
27. `lanyard.glb`: an event badge on a lanyard hanging from a hook
28. `backpack.glb`: a dark grey school backpack leaning against a wall
29. `rug.png` (image only, no 3D): a top-down photo of a plain woven grey wool rug, flat, filling the frame, seamless

## Batch D: textures for the room's surfaces (images only, no 3D)

Ask for each as a **flat, seamless, tileable texture photo, straight on, even light, no shadows, 2048 x 2048**:

30. `tex-floor.png`: polished light-grey concrete floor, subtle speckles
31. `tex-wall.png`: smooth matte white painted plaster wall, very subtle texture
32. `tex-ceiling.png`: white acoustic ceiling panel surface
33. `tex-oak.png`: light oak wood grain
34. `tex-walnut.png`: walnut wood grain
35. `tex-steel.png`: brushed grey steel

## Light theme

The objects need no second version: they are real materials, and the site relights the room for each theme (a bright
daytime studio in the light theme, a dim evening one in the dark). The surfaces and the window do change, so these
are the light theme's own:

36. `tex-wall-light.png`: smooth matte warm-cream painted plaster wall (a soft pale yellow, like #fcfad8), very subtle texture
37. `tex-floor-light.png`: pale warm-beige polished concrete floor, subtle speckles
38. `rug-light.png` (top-down, seamless): a woven rug in soft navy blue (#0A174E) with a thin pale-yellow border line

(Same rules as batch D: flat, seamless, tileable, straight on, even light, 2048 x 2048.) The window's light-theme view
is the **dusk** pair below.

## The window view (images only)

See the four prompts for `sky-night.png`, `sky-dusk.png`, `city-night.png`, `city-dusk.png`: save those to
`assets-src/window/`.
