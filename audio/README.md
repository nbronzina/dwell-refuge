# Field recordings

Drop CC0/CC BY field recordings here and the engine uses them automatically — no code changes. Any file that's missing falls back to its synthesized version, so the piece works with any subset (or none). See `CREDITS.txt` for the attribution of the files already included.

## Files

| File | Zone | What to look for | Type | Status |
|------|------|------------------|------|--------|
| `rain-window.mp3` | storm | Steady rain against a window pane, no voices/traffic | loop | ✅ included |
| `thunder-1.mp3` `thunder-2.mp3` `thunder-3.mp3` | storm | One distant rolling thunderclap per file, with tail | one-shot | ✅ included |
| `cicadas.mp3` | heat | Cicada chorus, outdoors, steady (the engine adds the "closed window" filter) | loop | ✅ included |
| `room-tone.mp3` | refuge | Very quiet interior room tone, nothing identifiable | loop | synthesized |
| `water-pipes.mp3` | flood | Water gurgling through pipes or a drain | loop | ✅ included |
| `splash-1.mp3` `splash-2.mp3` | flood | Small indoor water splash, short | one-shot | ✅ included |
| `wind-dry.mp3` | drought | Dry wind — a doorframe whistle or open field | loop | ✅ included |
| `creak-1.mp3` `creak-2.mp3` | drought | Wood creaking under strain, short | one-shot | synthesized |

## Format

- **mp3**, 44.1 kHz, ~96–128 kbps (Safari doesn't decode ogg)
- Loops: 15–60 seconds. Exact loop points don't matter — the engine crossfades the ends — but start and end at similar ambience level, and trim silences
- One-shots: trimmed tight, natural tail included
- Keep the total under ~10 MB; these load in the background while the visitor reads the intro

## Level

Recordings vary wildly in loudness. Instead of re-editing files, adjust the `trim` value for that key in `js/samples.js` (1 = as-is, 0.5 = half, 2 = double) and check the balance with `?debug` in the URL.

## Sourcing and licensing

- [freesound.org](https://freesound.org) — filter by license: Creative Commons 0
- [Wikimedia Commons](https://commons.wikimedia.org) — check each file's license
- [archive.org](https://archive.org) — check each item's license
- Your own recordings — best option, and thematically right for this piece

Even for CC0, list every file in `CREDITS.txt` here (source URL, author, license) — courtesy, and traceability for the exhibition.
