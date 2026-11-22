# Fenwick Hall (The Manor in the Woods)

A third-person narrative walking simulator with gated spatial progression, environmental storytelling, discipline scenes, scripted journeys and a post-game domestic simulation. Silas Fenwick inherits a decayed house in the Fenwood, above the village of Redmere, and restores it and the lives of the seven women who come under his roof. The design is in `docs/gdd.md`. It's built on the figures and discipline engine of [Project Meridian](https://github.com/asonichero/meridian). **What's built, what's drafted and what's still open is in `docs/alpha-plan.md`.**

## Run it

```
npm run serve        # http://localhost:8123/ opens the correction test (session.html); /figures.html a heroine and Silas, posed or in a correction; /household.html the line-up; /model.html the bodies and clothes
npm test             # the pain model, the scripted correction, conversations, the figures' rig, the cast and their lines, the estate, the guest bedroom
```

No build step and no dependencies: three.js r128 is in `vendor/`. The bodies, clothes and hair are built in Blender and saved as `models/fenwick_{f,m}.glb`, `models/fenwick_hair.glb` and `models/fenwick_meta.json`. To rebuild them you need Blender 5 (the `bpy` module from PyPI works, with numpy and scikit-image) or Blender's own binary with `-b --python`:

```
python3 -m venv .blender && .blender/bin/pip install "bpy==5.1.*" scikit-image
.blender/bin/python tools/blender/build_figures.py -- f m      # the bodies (hers from the measured reference, his derived), their rig and keys, and the clothes (about 5 minutes each)
node tools/export-head.js                                     # the head the game builds in code, for the hair to fit (tools/blender/head.json)
.blender/bin/python tools/blender/build_hair.py                # the hair styles and Silas's beard (seconds)
```

`poses.html` is the pose editor (the figures page with `?edit=1`), after the one in fairy-shoe. Set up a moment of a correction (the pose, her clothes, his right hand as it goes, raised or on her), then **Edit pose** freezes it.
- **Editing by dragging:** a dot sits on each joint of whoever you're editing, her or Silas (blue left, red right, white the middle). Dragging the hips moves the whole figure; dragging a hand or foot places it and the arm or leg follows; dragging any other joint turns the bone above it. **Pin hands** holds both hands still while the rest moves.
- **Exact values:** click a dot to set that joint's rotation exactly, in degrees. For the hips, you also get the figure's place in centimetres and its turn.
- **Report:** **Copy report** lists every moment you edited and each joint you changed: its own rotation (and what it was), where it is in the room, and where it is from the other figure's hips. Send it back to be built in. Nothing in the editor changes the game by itself.

`model.html` shows the bodies and clothes as a turnaround; `household.html` lines everyone up (`?who=<id>&view=head-three` for a close look at someone's hair, `?<id>=<outfit>` for another outfit, `?clothes=up,down,down` for the layers raised and lowered).

## Clothes and hair

- **Dresses** for six of the seven: a bodice laced down the front with the chemise showing at the neckline, sleeves to the wrist or the elbow, and a gathered skirt that falls from the waist, over the hips and seat, and hangs nearly straight to the lower calf (no petticoats). Below the waist the skirt is live cloth (`js/figure.js`: `makeCloth`, `tickCloth`). It's a grid of points whose rest shape is taken from the garment as built, held at the waist and falling with gravity. It lies over her, Silas, the furniture and the floor: her body and his as spheres measured from the models and carried by the bones, the furniture as boxes. Whenever it's put somewhere new, it settles at once behind the cut: she's eased from standing into the pose with the cloth following her, so it never starts tangled through her legs. Once she's still it's frozen, carried by her bones, so it costs next to nothing; while it's down her legs stay still and only her hips turn. Raised, the back is wound into a smooth roll laid across the small of her back, and the sides and front hang free from it, clear of her seat and hips. When it changes, the scene goes through black. Under them are knee-length drawers, stockings and shoes or ankle boots. **Gretel** wears a patched kirtle (the same cut, to above the knee) over darned leggings, with boots. **Red** wears the same for walking the estate, more often as time goes on (`Estate.outfitFor`). Each heroine's colours, apron, print and patches are in `Cast.WARDROBE` and drawn on per pixel. Goldie and Eleanor wear the Hall's maid's uniform, a russet work dress and apron. Some have outfits for story moments: Goldie's own clothes, Eleanor's rags and her days-off dress, Rapunzel's tower gown.
- **Nightclothes**, barefoot: a white chemise and drawers (Goldie, Red, Eleanor), a rough chemise and smalls (Gretel), a linen night-dress (Rapunzel, Snow White, Belle); Silas a nightshirt and linen drawers. The chemises and his nightshirt are shirt-length, so the drawers or smalls show below them. A chemise isn't raised by hand: it rides up of itself over the table and at its edge, and across the knee it goes up when her drawers come down. The night-dresses are raised like skirts.
- **Silas's trousers** have a lower crotch and a modest bulge at the front.
- **Her body** carries painted detail drawn from the model's rest pose: areolae and nipples, the crease under each breast (set by her bust), collarbones, navel, the hip lines, the spine and shoulder blades, the dimples above the seat, kneecaps. Her ankles narrow over the ankle bones and Achilles tendon into feet with an arch, five toes and their nails.
- **Hair** is built in Blender to fit the code-built head: a scalp shell cut along the hairline, under tapered locks that follow the scalp, fall with gravity, curl into ringlets or coil into a bun. Locks taper to fine ends where they gather. Goldie has curls over her whole head, ringlets in rows down the back; Red and Rapunzel have a center part into their plaits; Snow White has a side part and fringe; Belle a chignon set against the back of her head; Eleanor a working bun; Gretel a knife-cut crop; Silas short tousled hair and a beard.
- **Plaits** (Red, Snow White, Rapunzel) are rounded where the locks gather into them and end in a tie and a short brush. Each is skinned to a chain of bones that falls with gravity, bending along its length, its end heavier so it hangs straight rather than flicking about. The chain is kept out of the head, the back and the floor. So a plait lies down her back standing, falls toward the floor across the knee, and drapes forward when she's bent over.
- **Necks and shoulders**: the back of the neck runs up into the skull. A raised arm keeps the ribcage in place: the upper arm's skin weights are confined to the arm and the cap of the shoulder, and the armpit skin is blended straight across between ribcage and arm, so it forms a hollow rather than a wing.

## The correction test (`session.html`)

The guest bedroom of Chapter 1, where Silas finds Goldie asleep among half-eaten rations, spilled ink and a broken antique chair.

- **Set-up**: who's corrected, in order (any of the seven), the position (across the knee on the oak chair, across the knee on the edge of the bed, over the writing table), the room as found / being restored / restored, Ch. 1's clues out or cleared away, day or night, Silas's look, and each heroine's relationship sliders (submission, desire, comfort, defiance, resentment). URL parameters set the same: `?who=goldie,belle&pos=otk:bed&state=found&clues=1&time=night&terms=1`.
- **Her terms** (optional, first): Silas sets out how his household works. She agrees and chooses her safe word.
- **The correction** plays as Meridian's does: her skirt raised and gathered just above her hips (through black; across the knee his other hand rests across the small of her back, just above the roll, the fingers bent over her far side; over the table it's on her middle back), leggings lowered where she wears them, then drawers. Runs on a toggle (**Space**), pace (`[` `]`), strength (`-` `=`), side (**D**), where (**A**), soothe (**S**), the clothes (**T B U**), end turn (**Enter**), cameras (**C**). The meter shows her distress against the bar where she'd call her word. Her responses are in her own voice, by distress band, defiance and temperament.
- **Aftercare** on the settle (or the bed's edge): reassure her, say why it mattered, ask how she is; then what she's to do with the rest of the day. A summary follows.

![The guest bedroom, restored, at night](docs/correction-test.jpg)

## Figures (`figures.html`)

A heroine and Silas together in a plain space, as Meridian's figures page has them:
- **What you can set:** any heroine in any of her outfits, or **None** (here only: nothing on, to see how the body moves without clothes masking it); her clothes raised or lowered; Silas dressed, in his nightclothes or with nothing on (he has one build, average); her defiance, submission, desire and comfort; her expression and her body's response; front, ¾, side, back or close on her head; a turntable.
- **Standing poses:** side by side, facing him, being told off (her stance from the sliders), in the corner.
- **Correction poses:** across the knee (on a chair or the edge of a bed), hands on a table, over a table, and the aftercare on a settle.
- **The correction loop:** in the correction poses, the correction itself runs on props where a room's furniture would be. The controls are the correction test's (run, pace, strength, side, where, soothe, clothes, end turn, cameras), with no dialogue and no meter. Round follows round: end the turn and Silas soothes her, dresses her, and she's placed again. Her marks build up, and nothing she goes through changes the sliders. **Reset** (**R**) clears her marks and lets what she feels settle. After her safe word it waits for Reset.
- **From the address:** `?who=&outfit=&clothes=&pose=&def=&sub=&des=&com=&expr=&resp=&view=&build=&spin=1`.

## Files

| File | What it is |
|---|---|
| `js/cast.js` | Silas, the seven heroines and the village cast: what the GDD states (names, ages, roles, flaws, how each resists) kept apart from drafts (bodies, looks, pain stats, safe words, clothes) |
| `js/lines.js` | Everything said: Silas placing and correcting her; her reactions, defiance and word; the aftercare; her terms |
| `js/estate.js` | The estate as game state: chapters, zones and their gates, restoration and hearths, homes, vignettes, the week, relationship tracks (nothing in one lowers another), post-game habit drift and its clues, the finale's roles, reputation |
| `js/guestroom.js`, `js/kit.js` | The guest bedroom (Ch. 1), as found and restored; the kit rooms are painted from |
| `js/session.js` | The correction, played (ported from Meridian; changed only to take Fenwick's cast, and her period layers: a skirt raised from its hem, only the layers she wears, what each cushions) |
| `js/figure.js`, `js/poses.js` | The figures (Blender-built bodies, clothes and hair, skeleton, skinning, toon shading, faces; the period garments' details and stockings drawn per pixel; a long braid) and posing |
| `tools/blender/build_figures.py`, `tools/blender/build_hair.py`, `tools/export-head.js` | Building the bodies and clothes, and the hair, in Blender |
| `js/pain.js`, `js/discipline.js`, `js/talk.js`, `js/audio.js`, `js/stage.js` | Ported from Meridian: the pain model, the scripted correction, conversations, synthesised sound (plus a hearth ambience), the renderer |
| `session.html`, `figures.html`, `household.html`, `model.html` | The correction test; a heroine and Silas, posed or in a looping correction; the household line-up; the models' turnaround |
| `docs/gdd.md`, `docs/The_Manor_in_the_Woods_GDD.docx` | The design document |
| `docs/alpha-plan.md` | The plan: stated, ported, drafted, open |
