# Fenwick Hall (The Manor in the Woods)

A third-person narrative walking simulator with gated spatial progression, environmental storytelling, discipline scenes, scripted journeys and a post-game domestic simulation. Silas Fenwick inherits a decayed house in the Fenwood, above the village of Redmere, and restores it and the lives of the seven women who come under his roof. The design is in `docs/gdd.md`. It's built on the figures and discipline engine of [Project Meridian](https://github.com/asonichero/meridian). **What's built, what's drafted and what's still open is in `docs/alpha-plan.md`.**

## Run it

```
npm run serve        # http://localhost:8123/ opens the correction test (session.html); /figures.html is the household line-up; /model.html the bodies and clothes
npm test             # the pain model, the scripted correction, conversations, the figures' rig, the cast and their lines, the estate, the guest bedroom
```

No build step and no dependencies: three.js r128 is in `vendor/`. The bodies are Blender-built (`models/fenwick_{f,m}.glb`). To rebuild them, see Meridian's README; the tools are in `tools/` and need Blender 4.0.

## The correction test (`session.html`)

The guest bedroom of Chapter 1, where Silas finds Goldie asleep among half-eaten rations, spilled ink and a broken antique chair.

- **Set-up**: who's corrected, in order (any of the seven), the position (across the knee on the oak chair, across the knee on the edge of the bed, hands on the writing table), the room as found / being restored / restored, Ch. 1's clues out or cleared away, day or night, Silas's look, and each heroine's relationship sliders (submission, desire, comfort, defiance, resentment). URL parameters set the same: `?who=goldie,belle&pos=otk:bed&state=found&clues=1&time=night&terms=1`.
- **Her terms** (optional, first): Silas sets out how his household works. She agrees and chooses her safe word.
- **The correction** plays as Meridian's does. Runs on a toggle (**Space**), pace (`[` `]`), strength (`-` `=`), side (**D**), where (**A**), soothe (**S**), the clothes (**T B U**), end turn (**Enter**), cameras (**C**). The meter shows her distress against the bar where she'd call her word. Her responses are in her own voice, by distress band, defiance and temperament.
- **Aftercare** on the settle (or the bed's edge): reassure her, say why it mattered, ask how she is; then what she's to do with the rest of the day. A summary follows.

![The guest bedroom, restored, at night](docs/correction-test.jpg)

## Files

| File | What it is |
|---|---|
| `js/cast.js` | Silas, the seven heroines and the village cast: what the GDD states (names, ages, roles, flaws, how each resists) kept apart from drafts (bodies, looks, pain stats, safe words, clothes) |
| `js/lines.js` | Everything said: Silas placing and correcting her; her reactions, defiance and word; the aftercare; her terms |
| `js/estate.js` | The estate as game state: chapters, zones and their gates, restoration and hearths, homes, vignettes, the week, relationship tracks (nothing in one lowers another), post-game habit drift and its clues, the finale's roles, reputation |
| `js/guestroom.js`, `js/kit.js` | The guest bedroom (Ch. 1), as found and restored; the kit rooms are painted from |
| `js/session.js` | The correction, played (ported from Meridian unchanged but for the roster hook) |
| `js/figure.js`, `js/poses.js` | The figures (Blender-built bodies, skeleton, skinning, toon shading, faces, garments; a long braid added) and posing |
| `js/pain.js`, `js/discipline.js`, `js/talk.js`, `js/audio.js`, `js/stage.js` | Ported from Meridian: the pain model, the scripted correction, conversations, synthesised sound (plus a hearth ambience), the renderer |
| `session.html`, `figures.html`, `model.html` | The correction test, the household line-up, the models' turnaround |
| `docs/gdd.md`, `docs/The_Manor_in_the_Woods_GDD.docx` | The design document |
| `docs/alpha-plan.md` | The plan: stated, ported, drafted, open |
