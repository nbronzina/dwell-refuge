# dwell:refuge — State of the Art, Benchmarking & Adoption Roadmap

**Date:** 2026-07-29
**Method:** Four parallel deep-research threads — (A) interactive browser sound art & generative ambient, (B) climate & ecological sound art, (C) speculative design & the future mundane, (D) adaptive game audio & web spatial-audio tech. Full thread reports are appended below; this top section is the synthesis.

---

## 1. Where dwell:refuge stands

The single most important finding, from the climate-sound-art thread, is that **the lane is open**:

> "The strongest climate sound works route the planetary through the domestic aperture — and almost nobody has built the full house. Paterson's phone call to a glacier and Superflux's 2050 flat are the two proofs that intimacy beats spectacle; but no major work yet renders the *acoustic* interior of climate adaptation as its whole subject."

dwell:refuge's exact position — *the house as instrument, maintenance sounds as score* — has clear ancestors but no occupant. The lineage to cite (in README/about, not in the piece): Katie Paterson's *Vatnajökull (the sound of)* (2007, the climate event arriving through domestic infrastructure), Superflux's *Mitigation of Shock* (2017/2019, the climate-adapted flat), and Nick Foster's *The Future Mundane* (2013, which names our concept). Citing lineage positions the piece inside art history rather than web-toy territory.

The nearest technical relative is **ambient.garden** (Pierre Cusa, 2023) — "can a composition be organized in space rather than time?" — whose open source is the best reference implementation for our exact problem.

## 2. Convergences — what multiple threads independently agree on

These appeared in two or more threads without coordination; treat them as confirmed direction.

1. **Escalate through wrongness, not loudness.** (A: ClimaSynth, Imaginary Soundscape · B: The [Uncertain] Four Seasons, "remembered normals corrupted by degrees" · C: Foster's "partly broken", the 90%-ordinary/10%-stress ratio · D: detune/wow as strain.) The future-mundane thesis in audio form: familiar sounds going subtly wrong — an AC that short-cycles, a fridge a semitone flat under brownout, rain 15% too heavy for the gutters. This should be what our temporal evolution *does*.

2. **Compose the seams, not just the zones.** (A: Radio Garden's sonified dial, wall-muffled adjacents · C: Superflux — the outside enters only *mediated* · D: Unreal interior/exterior filter pairs, Ghost of Tsushima's directional probes.) Crossing zones should sound like moving through a house — walls, doors, hallways — not like a DJ blend.

3. **One deadpan in-fiction sentence; hide the method.** (B: Watson's "air trapped for 10,000 years", opt-in methodology pages · C: Carbon Ruins' tense-play, TBD Catalog's boring documents.) The entry text should locate, instruct, and imply duration — e.g. *"The interior has held so far."* — and never name climate change, dystopia, or hope. Mappings and data live in an opt-in "how this works" layer.

4. **Never-repeats needs structure, not dice.** (A: incommensurate loop lengths, probability-gated events · D: Mini Metro's authored series, No Man's Sky's fragment recombination, the look-ahead scheduler.) Replace raw `Math.random()` with authored series; build beds from mutually-prime loop durations.

5. **Stillness must own exclusive content.** (A: Bloom's idle takeover, Meander · D: Journey's companion layer, Dear Esther's scarcity budget.) Reward content that exists nowhere else — a sound scheduled *only* during stillness — is what turns the mechanic into a reason to return.

6. **Long-form listening needs recession.** (D: Breath of the Wild's restraint-as-system, density budgets with rest · B: anti-elegy, competence under strain.) Our 2-minute intensification currently has no decay half; pieces people leave running require rise–fall–rest.

7. **The emotional register is competence under strain, never elegy.** (B's field-wide warning: climate sound art is saturated with mourning and minor-key sonification kitsch · C: "evidence of coping, not evidence of disaster".) Every sound should imply a person who already adapted: the bucket was *placed*, the pump was *installed*, the tape was *smoothed on*. Maintenance is the score.

8. **Media-texture realism for any voice.** (C: Flash Forward's lo-fi rule, Superflux's hourly bulletin · B: World Weather Network's weather-report genre.) Any broadcast fragment must be heard *through* something — tinny speaker, wall, static. Full fidelity reads as narration and breaks the piece.

## 3. Adoption roadmap

References point into the appended thread reports: [A#] browser art, [B#] climate art, [C#] future mundane, [D#] game audio.

### Tier 1 — adopt now (low effort, identity-level payoff)

| # | What | Source | Sketch |
|---|------|--------|--------|
| 1 | **Stress macro per zone** — evolution corrupts instead of amplifies: AC wow/short-cycling, fridge detune, drip interval tightening | [A13][B8][C1] | Map the existing `evolutionFactor` to a bundle of DSP params per zone, not just gain |
| 2 | **Harmonic ecology** — quantize all pitch jitter to a just-intonation ratio set; each zone owns a chord/mode of one global scale | [D — Proteus A6] | Lookup table replaces `Math.random()` in pitch expressions; seams become harmonic modulations |
| 3 | **Compose the seams** — "through the wall" versions of adjacent zones (lowpass ~600–800Hz, −9 to −12dB) audible only in corridors | [A4][D — A4] | One BiquadFilter per zone bus, mixed by seam position |
| 4 | **Density budget + recession** — a global rise–fall–rest curve every scatterer rate multiplies against; real gaps (30–90s) per element | [D — A11] | One scalar with a slow envelope; duty cycles on schedulers |
| 5 | **Scheduled ducking** — when a one-shot fires, duck that zone's bed 2–4dB, slow release; feed-forward (we know the schedule) | [D — A5] | `setTargetAtTime` on bed gain, τ≈0.15s down / 1.2s up |
| 6 | **The radio** — a faint hourly news-bulletin cadence, unintelligible, through a tinny-speaker filter chain; the one channel through which outside enters the refuge | [C2][B5][B13] | Synthesized cadence (jingle sting + measured announcer prosody) through bandpass + small speaker IR |
| 7 | **Curatorial one-liner** — rewrite entry text around *"The interior has held so far."*; move method/data explanation to an opt-in page | [B — takeaway 5][C — takeaway 2] | Text change + a `how.html` |

### Tier 2 — next (medium effort, deepens the fiction)

| # | What | Source |
|---|------|--------|
| 8 | **Maintenance sounds** — bucket emptied (slosh, set-down clunk), tape smoothed, a sigh, slippers, kettle in the refuge; scheduled rarely | [C — takeaway 3][B14] |
| 9 | **4-probe ambience rig** — four virtual probes around the listener, each rendering the zone *it* stands in from its direction; directional seams | [D — A3, top takeaway] |
| 10 | **Look-ahead scheduler** — one Chris-Wilson-pattern clock (~40 lines) replacing all `setTimeout` schedulers; authored series (pitch/interval/pan arrays of coprime lengths) for one-shots | [D — B4, A9] |
| 11 | **Stillness-exclusive content + one rare "score moment" per zone** — 20–40s pre-composed figure, fires at most once per N minutes, gated behind stillness | [A10][D — A8] |
| 12 | **Intruder budget** — exactly one rare high-salience event per zone (emergency-alert phone buzz, neighbor's generator), probability rising with intensity | [A14][C4] |
| 13 | **Refuge as warm near-field** — kettle, pages turning, chair creak; comfort via reverb character and proximity, not just quiet; some defenses half-theatrical (a white-noise machine against the storm) | [C12][C6] |
| 14 | **HRTF hygiene** — warm panners at init (Chrome lazy-load glitch), cap HRTF at ~5 nearest sources, distance-scaled wet sends (far = wetter) | [D — B2] |

### Tier 3 — explore (bigger moves, decide after listening)

| # | What | Source |
|---|------|--------|
| 15 | **Calibration / playback compensation** — a 20s "adjust until barely audible" step or headphone/speaker toggle; our quiet details die on laptop speakers | [A1 — myNoise] |
| 16 | **Real dataset as silent clock** — e.g. a year of precipitation data compressed into the session, scheduling drips and pump cycles; methodology on the opt-in page | [B10 — Burtner][B7 — Foo] |
| 17 | **Time-of-day awareness** — real local time biases the zones (night mutes highs; dawn brings the first AC cycle) | [A10 — Eno's Reflection] |
| 18 | **Canonical-walk album export** — record a fixed 20-minute traversal as a linear piece; marketing artifact + composition review tool | [A5 — ambient.garden] |
| 19 | **Fragment recombination (Pulse-style)** — many short tagged, key-compatible fragments recombined by rules instead of long loops; abstraction layers generated offline | [D — A10, A8, B5] |
| 20 | **Modulation-brain AudioWorklet** — one plain-JS worklet generating all slow modulation channels, immune to main-thread jank | [D — B3] |
| 21 | **Memory sounds** — one per zone, already-nostalgic: ice-cream van far off in the heat, sprinklers ghosting the drought | [C8 — Carbon Ruins] |
| 22 | **Submission channel** — "record your home's climate sounds"; the piece becomes an archive | [A9 — Sound of the Earth] |

### Rejected — with reasons

- **Ambisonics / Omnitone / Resonance Audio** — both libraries abandoned; our source count isn't CPU-bound after HRTF triage; a hand-rolled FOA bus is a week of subtle bugs for a difference inaudible on ambient beds. [D — B1]
- **WebGPU audio, in-browser neural synthesis (RAVE)** — wrong latency architecture for real-time spatial work; 10–80MB model weights wreck instant-open; fights the no-build ethos. Offline asset generation only. [D — B5]
- **WASM in AudioWorklets** — 2025 practitioner consensus: well-written plain JS matches it at our DSP scale, without loader complexity. [D — B3]
- **Elegy register & sonification kitsch** — minor-key = bad-CO2 mappings and mourning-by-default are the field's exhausted defaults; our thesis (an interior that holds) is structurally anti-elegiac. [B — takeaway 4]
- **Explanatory UI / in-experience data annotation** — reads as lecture; all four threads converge on this. Opt-in layer only.
- **Server-side liveness** — Endlesss shut down in 2024; Longplayer runs on almost nothing. Fully client-side is the durable stance. [A15]

## 4. One paragraph of position (for reuse in copy)

dwell:refuge sits at the intersection of three practices that rarely meet: the spatial browser composition (ambient.garden, Radio Garden), the climate work that arrives through domestic intimacy rather than spectacle (Paterson, Superflux), and the adaptive-ambience craft of games (Tsushima's probes, Proteus's harmonic ecology). Its wager is the future mundane made audible: not the storm as event, but the house as the instrument that plays the storm — and the person who keeps emptying the bucket.

---

---

# Appendix — Full thread reports

## Thread A — Interactive Browser Sound Art & Generative Ambient

### 1. myNoise — Stéphane Pigeon (2013–ongoing)
**One-liner:** Hundreds of "noise machines," each a 10-slider generator covering 20Hz–20kHz, built by a signal-processing PhD who records his own field material.
**URL:** https://mynoise.net
**Interaction/generativity:** Each generator decomposes a soundscape into 10 color-coded spectral/semantic sliders. Two mechanics matter most: (a) **hearing calibration** — a one-time threshold test shapes every generator to your ears and playback equipment, so the intended balance survives laptop speakers vs. headphones; (b) **Animation mode** — the sliders self-animate on slow random walks, so a static mix becomes a drifting, non-repeating scene. Generators can be layered ("super-generators") in multiple tabs. Pigeon explicitly refuses generative AI; authenticity of source is part of the brand.
**Steal this:** The **slow random-walk automation within user/zone-defined bounds**. Implement each zone element's gain as a bounded 1/f random walk (target ± drift, 30–120s time constants) instead of fixed levels — this alone gives you "temporal evolution" for free and guarantees no two visits sound alike. Also seriously consider a 30-second calibration screen: dwell:refuge's quiet details (drips, blind rattles) will vanish on laptop speakers without some playback compensation.

### 2. Generative.fm / Generative.fm Play — Alex Bainter (2018–ongoing)
**One-liner:** 50+ endless ambient generators, "composed by a human, performed forever by the browser," open source.
**URL:** https://generative.fm · https://github.com/generativefm/generators
**Interaction/generativity:** Minimal listener interaction (play/stop) — all the intelligence is in the system design. Each piece is a small npm package: a set of instrument samples plus a scheduling brain (Tone.js) that fires notes with randomized timing, transposition, reverb tails, and probability gates. Key architectural idea: **piece = data + performer**, cleanly separated, so dozens of pieces share one engine.
**Steal this:** The **probability-gated event scheduler**. For sparse domestic events (a drip into a bucket, a settling creak, ice in a glass), don't loop — schedule each as `nextTime = now + baseInterval * random(0.5, 2.5)` with a per-zone "intensity" scalar multiplying event density. Bainter's pieces prove that ~6 event types with humanized timing sustain hours of listening; dwell:refuge's zones need fewer sounds than you think, but each needs randomized micro-timing.

### 3. A Soft Murmur — Gabriel Martín (2013)
**One-liner:** The canonical minimal ambient mixer: ten illustrated icons, ten sliders, nothing else.
**URL:** https://asoftmurmur.com
**Interaction/generativity:** The mixer *is* the experience — no presets shelf, you assemble believability yourself. Its overlooked killer feature is **Meander**: a mode where the mix slowly changes on its own, sounds fading in and out over minutes, plus timed fade-in ("wake up to it") and fade-out ("fall asleep to it").
**Steal this:** **Meander as the idle-drift spec.** When the cursor goes idle, don't freeze the current zone — let the listener position itself begin a slow Brownian drift through the space (biased toward the refuge), so leaving the tab open turns the piece into a self-mixing radio of your home under climate. Also steal the shape of its restraint: ten elements max visible at once; dwell:refuge's zones should each be auditable as roughly 4–6 distinguishable layers, not a wall.

### 4. Radio Garden — Studio Puckey / Moniker (2016–ongoing)
**One-liner:** Rotate a 3D globe; every green dot is a live radio station; geography becomes the entire listening interface.
**URL:** https://radio.garden
**Interaction/generativity:** Pure spatial navigation with essentially no chrome: position = selection, and crucially **the seams are sonified** — moving between stations passes through tuning static/crossfade, like turning a shortwave dial. The transition itself is a designed sound, which makes the space feel physically continuous rather than like a playlist.
**Steal this:** **Give your crossfade seams their own material.** Between dwell:refuge's zones, don't just equal-power crossfade — introduce a thin "in-between" layer that only exists at boundaries: hallway room tone, wall-muffled versions of both adjacent zones (lowpass ~600Hz + level drop, the classic "sound through drywall" trick). Crossing from heat to flood should sound like walking past a closed door, not like a DJ blend. This is cheap (one BiquadFilter per adjacent zone bus) and sells the "inside a home" fiction harder than anything else.

### 5. ambient.garden — Pierre Cusa (2023)
**One-liner:** An open-source low-poly 3D landscape where every tree is an instrument and the composition is organized in space instead of time.
**URL:** https://ambient.garden · https://github.com/pac-dev/AmbientGarden
**Interaction/generativity:** The closest existing relative to dwell:refuge. Explicit founding question: *"can a composition be organized in space rather than time, and experienced in space by the listener?"* All audio is synthesized from code (no samples). Sound sources are placed in a world; proximity fades them in; walking a path *performs* the piece. Includes an **autopilot** that walks the garden for you, and the spatial piece was later "flattened" into a linear album (*A Walk Through the Ambient Garden*).
**Steal this:** Two things. (1) **Distance = mix, with per-element rolloff curves**: Cusa gives each source its own audible radius, so dense areas resolve into solos as you approach — give dwell:refuge's per-element stereo placements individual attenuation radii inside each zone so leaning toward a corner of the storm quadrant isolates the rattling blinds. (2) **The album export**: record a "canonical walk" through dwell:refuge as a fixed 20-minute piece for Bandcamp/promo — it's a marketing artifact and a design-review tool (if the walk doesn't hold up linearly, the space isn't composed yet). Read his source — it's the best reference implementation for your exact problem.

### 6. Chrome Music Lab — Google Creative Lab (2016)
**One-liner:** ~13 Web Audio experiments (Spectrogram, Song Maker, Kandinsky…) that teach music concepts with zero instructions.
**URL:** https://musiclab.chromeexperiments.com · https://github.com/googlecreativelab/chrome-music-lab
**Interaction/generativity:** The gold standard of "no manuals": every experiment produces sound within one gesture of page load, works identically on touch and mouse, and communicates its mechanic purely through immediate audiovisual feedback.
**Steal this:** The **first-five-seconds contract**: sound (or a clear "touch to begin" gesture, required anyway by autoplay policy) within one interaction, and the very first cursor movement must audibly change something. dwell:refuge should tune its opening so that the initial position is *near but not in* the refuge — the first small mouse movement immediately shifts the stereo field, teaching "position = listening" with zero copy.

### 7. Patatap — Jono Brandel + Lullatone (2014)
**One-liner:** A–Z keys trigger 26 paired sound+animation events; spacebar swaps the whole palette.
**URL:** https://patatap.com
**Interaction/generativity:** Synesthetic one-to-one mapping — every sonic event has an exactly synchronized visual gesture (Two.js), which is why it feels instrumental rather than decorative. The **spacebar palette swap** recontextualizes all 26 keys at once, giving a tiny interface enormous range.
**Steal this:** **Every audible event gets a visual ghost.** Even with minimal UI, when a discrete event fires (drip, thunder, AC compressor kicking on), emit a sub-second, spatially-placed visual trace at that element's stereo position. This solves a real dwell:refuge problem: teaching users that elements have *positions inside* a zone, without a single word of UI.

### 8. Blob Opera — David Li w/ Google Arts & Culture (2020)
**One-liner:** Four ML-voiced blobs; drag vertically for pitch, horizontally for vowel; the others harmonize with you in real time.
**URL:** https://artsandculture.google.com/experiment/blob-opera/AAHWrq360NcGbw
**Interaction/generativity:** Masterclass in **continuous 2D control mapping**: one drag gesture controls two perceptual dimensions simultaneously, and the system responds musically (auto-harmonization) so the user can't fail. Unskilled input, skilled output.
**Steal this:** The **two-axis gesture mapping inside a zone**. Cursor position within a zone shouldn't only crossfade toward neighbors — map the orthogonal axis to a second parameter (e.g., in the storm quadrant: X = proximity to the window wall, Y = storm intensity/filter opening). Two perceptual dimensions per zone makes a 5-zone piece feel ten times larger with no new assets.

### 9. Sound of the Earth (Pandemic Chapter / Chapter 3) — Yuri Suzuki (2020 / 2022)
**One-liner:** A browser globe of crowdsourced everyday recordings from around the world; Chapter 3 uses ML to link sonically similar submissions.
**URL:** https://soundoftheearth.org · https://globalsound.dma.org
**Interaction/generativity:** Cursor-over-a-globe, each dot a domestic/everyday sound of a shared crisis (COVID) — conceptually the nearest cousin to dwell:refuge's "future mundane": ordinary sounds made poignant by shared circumstance. Chapter 3's ML clustering creates drift paths between *similar-sounding* recordings from distant places.
**Steal this:** **The mundane-archive framing.** Suzuki proved that unremarkable domestic recordings become emotionally heavy when the frame says "this is what the crisis sounds like from inside." Consider a single line of framing text on entry (one sentence, Eno-compatible) and, longer-term, a submission channel — "record your home's climate sounds" — turning dwell:refuge from a piece into an archive.

### 10. Bloom / Reflection — Brian Eno & Peter Chilvers (2008 / 2017)
**One-liner:** The canonical generative apps: Bloom (tap to plant looping tones; generative player takes over when idle), Reflection (an endless rule-based rendering of the album).
**URL:** https://generativemusic.com
**Interaction/generativity:** Reflection is a handcrafted probability system — "months spent tweaking the rules and probabilities" so sounds randomly echo, transpose, or decline to play; the app version also shifts its character with **time of day**. Bloom's defining move: **when you stop playing, the system starts** — idleness is not a pause state but a mode change.
**Steal this:** Both mechanics are already half-planned in dwell:refuge; steal the *specifics*. (1) Idle takeover à la Bloom: after ~60s of stillness the piece doesn't just drift, it audibly *rewards* — reverb opens slightly, a rare element (distant birdsong through a closed window?) is only ever scheduled during stillness. Stillness-as-reward needs content that exists nowhere else. (2) Reflection's clock: read the real local time and bias the zones — night mode mutes high-frequency content, dawn adds the first AC cycle. A home under climate stress has a daily rhythm; the piece should too.

### 11. Longplayer — Jem Finer (1999–2999)
**One-liner:** A 1,000-year composition: six short Tibetan singing-bowl recordings, replayed at different pitches/offsets by a simple algorithm that won't repeat until 2999; live-streamed continuously.
**URL:** https://longplayer.org/listen/
**Interaction/generativity:** Zero interaction; the lesson is structural. Infinite non-repetition from almost no material: a handful of loops of **incommensurate lengths, phase-shifting against each other** (the Steve Reich / *It's Gonna Rain* mechanism, well documented for Web Audio in Tero Parviainen's *JavaScript Systems Music*: https://teropa.info/blog/2016/07/28/javascript-systems-music.html).
**Steal this:** **Incommensurate loop lengths as the default policy.** Every continuous bed in dwell:refuge (rain on glass, AC hum, flood lapping) should be built from 2–3 layers whose loop durations share no common factor (e.g., 17.3s, 26.1s, 41.7s), each with independent slow LFOs on gain/filter. This is the cheapest possible "it never repeats" — pure Web Audio, no scheduler needed — and it composites with the probability-event layer from entry 2.

### 12. Imaginary Soundscape — Qosmo / Nao Tokui (2017, v2 2022)
**One-liner:** Walk Google Street View while a contrastive-learning model picks the "right" ambience for each view from 60,000+ environmental clips.
**URL:** https://qosmo.jp/en/art/imaginarysoundscape
**Interaction/generativity:** Navigation is the instrument; the AI continuously re-scores the scene as you move. The artistic payload is the **plausible-but-wrong** soundscape — an imagined hearing of a real place, which produces a soft uncanny feeling.
**Steal this:** The **plausible-wrong as an intensification device.** As a zone escalates over dwell time, don't only add layers — begin substituting sounds with slightly wrong versions (the fridge hum a semitone lower, rain that is granular-stretched 5%, per ClimaSynth below). The "future mundane" is exactly this register: everything familiar, something off. Temporal evolution via *wrongness* is more unsettling than via loudness.

### 13. ClimaSynth — Eleni-Ira Panourgia et al., Filmuniversität Babelsberg (2024)
**One-liner:** A web app using real-time granular synthesis to transform field recordings of Potsdam landscapes according to drought scenarios — climate futures encoded as synthesis parameters.
**URL:** https://zenodo.org/records/13904937 (paper; app via project pages)
**Interaction/generativity:** Users navigate recordings on a visual surface; the granular engine's configuration (grain size, density, pitch scatter) *is* the climate scenario — drying is literally parameterized. Academically framed but the mechanism is directly production-ready.
**Steal this:** **Parameterize climate as a DSP macro, per zone.** Define one "stress" scalar per zone that maps to a bundle of synthesis parameters: drought → grain sparsening + high-shelf brittleness on organic sounds; flood → increasing convolution wet with a small-room-becoming-cistern IR; heat → detune/wow on the AC motor as it strains. One macro knob per zone, driven by your dwell-time evolution clock, keeps the escalation coherent instead of ad hoc.

### 14. Ambient Chaos — Neal Agarwal (2023)
**One-liner:** A parody ambient mixer where rain and fireplace sit alongside "dentist office," "nuclear siren," and "distant arguing."
**URL:** https://neal.fun/ambient-chaos
**Interaction/generativity:** Standard toggle-mixer mechanics; the art is entirely in the **curation of wrong sounds** — it demonstrates how one intrusive element instantly reframes a relaxing bed as narrative, comedy, or dread.
**Steal this:** **The intruder budget.** Each dwell:refuge zone should hold exactly one rare, high-salience intruder event (news-radio fragment through a wall, a phone buzzing with an emergency alert, a neighbor's generator starting) with a very low scheduling probability that rises with zone intensity. Agarwal's page proves a single such sound does more storytelling than ten ambience layers — but ration it, or the piece becomes a joke.

### 15. Strudel — Alex McLean & Felix Roos (2022–ongoing)
**One-liner:** TidalCycles ported to the browser: a live-coding REPL where algorithmic patterns run on pure web audio, no install.
**URL:** https://strudel.cc
**Interaction/generativity:** The current frontier of *browser-native* generative audio (very active 2023–2026, now community-run on Codeberg). Its pattern language expresses dense polyrhythmic/probabilistic structure in one line, all scheduled against a single audio clock.
**Steal this:** Not the tool — the **pattern mini-notation as internal data format**. Author each zone's event choreography as tiny declarative pattern strings (element, weight, period, probability, stereo pos) interpreted by your engine, rather than imperative scheduling code. Zones become editable text files; iterating the composition stops requiring engine changes. (Sidebar: Endlesss, the collaborative jam platform, shut down in 2024 — cautionary tale for anything requiring server-side liveness; dwell:refuge's fully client-side stance is the durable choice, as Longplayer's 25-years-and-counting stream also suggests.)

**Also bookmarked:** *Sounds of the Forest* (Timber Festival, 2020) — 750+ openly licensed crowdsourced forest recordings, a legitimate source pool and a model for map-as-archive; *Organism* (Navid Navab & Garnet Willis, Ars Electronica Golden Nica 2025).

### Thread A — Top 5 takeaways
1. **Compose the seams, not just the zones** (Radio Garden + ambient.garden): boundary-only layer, wall-muffled adjacents, per-element attenuation radii. One filter node per zone bus; do it first.
2. **Never-repeats = incommensurate loops + probability-gated events** (Longplayer + generative.fm): mutually prime loop durations + `base × random(0.5–2.5)` event intervals scaled by intensity.
3. **Escalate through wrongness, not loudness** (ClimaSynth + Imaginary Soundscape): one "stress" macro per zone mapping to a bundled DSP recipe, driven by dwell time.
4. **Make stillness a mode with exclusive content** (Bloom + Meander): after ~60s, reverb opens and one or two stillness-only sounds appear.
5. **One gesture must teach everything; consider calibration** (Chrome Music Lab + myNoise): start adjacent to the refuge so the first movement swings the stereo field; protect the quiet details on laptop speakers.

---

## Thread B — Climate & Ecological Sound Art

### 1. The Great Animal Orchestra — Bernie Krause + United Visual Artists (2016, touring)
Immersive installation commissioned by Fondation Cartier: seven habitat soundscapes from Krause's ~5,000-hour archive, rendered by UVA as scrolling spectrogram "scores" of light in a darkened room.
**Non-didactic strategy:** Krause's biophony-loss thesis is never stated in the room — the spectrogram lets you *see* acoustic niches partition the frequency spectrum, so the argument arrives perceptually. Krause's "niche hypothesis" — every species carves its own spectral/temporal slot — is itself the compositional insight.
**Steal this:** The niche hypothesis as a *mixing discipline*. Give each zone (and each sound within a zone) a defended spectral niche — sump pump in the low-mids, drips in a high band, AC broadband but notched — so the whole piece reads as one legible "ecosystem" and degradation can be expressed as niches collapsing into each other (masking = stress).
Sources: https://www.fondationcartier.com/en/programme/exhibition/the-great-animal-orchestra · https://news.artnet.com/art-world/bernie-krause-great-animal-orchestra-cartier-2321975

### 2. Energy Field / The Art of Listening: Under Water — Jana Winderen (2010; 2019)
Hydrophone and parabolic-mic compositions from Greenland, the Barents Sea and Norwegian glaciers, released on Touch and staged as multichannel installations.
**Non-didactic strategy:** Winderen explicitly refuses the "climate art" label — the politics live entirely in the fact that these sounds are *inaudible without instruments*: she makes you feel you were never entitled to hear this.
**Steal this:** The "instrumented listening" frame. Treat the cursor not as a person walking but as a *hydrophone dropped into the house* — sounds you'd never consciously notice (pipe resonance, fridge harmonics, the wall transmitting rain) become the material.
Sources: https://touch33.net/catalogue/to73-jana-winderen-energy-field.html · https://www.janawinderen.com/

### 3. Weather Report / WEATHER — Chris Watson (2003; 2020s)
*Weather Report* compresses 14 hours of a Scottish glen, a Kenyan savannah storm cycle, and the interior of Iceland's Vatnajökull glacier into three 18-minute time-lapse compositions; hydrophones in the ice record "air trapped for 10,000 years being re-released into the atmosphere."
**Non-didactic strategy:** Time-compression as narrative; the climate meaning is carried by one devastating framing sentence in the liner notes, not by the sound design.
**Steal this:** Compressed meteorological time — give each quadrant a slow internal *weather arc* (storm builds, peaks, exhausts itself over ~10–20 minutes) rather than a static loop. And the one-sentence framing move.
Sources: https://touch33.net/catalogue/to47-chris-watson-weather-report.html · https://chriswatson.net/

### 4. Fragments of Extinction — David Monacchi (1998–ongoing)
24-hour, 3D "sound portraits" of the last undisturbed primary equatorial forests, played back in purpose-built "Eco-acoustic Theatres" as sonic heritage of ecosystems.
**Non-didactic strategy:** Archival dread — the recordings are reframed as *heritage objects*, things recorded because they will not exist. The title does the work.
**Steal this:** The patrimony frame inverted: present the interior soundscape as a *future field recording* — "a domestic soundscape, recorded 2041" — making bucket-drips elegiac without one sad chord.
Sources: https://www.fragmentsofextinction.org/ · https://iucn.org/news/protected-areas/201607/fragments-extinction-sonic-heritage-ecosystems

### 5. Vatnajökull (the sound of) — Katie Paterson (2007)
A hydrophone in the glacial lagoon of Vatnajökull wired to a mobile phone; a neon phone number in the gallery. 10,000+ callers from 47 countries.
**Non-didactic strategy:** The domestic device as portal — your own phone at your ear, the posture of a private call, carries the planetary event. Hanging up is your decision.
**Steal this:** The closest conceptual ancestor to dwell:refuge's thesis: the climate event arrives *through domestic infrastructure*. Consider one channel in the refuge that behaves like a live line to outside — a radio, a phone off the hook, a baby monitor — a framed aperture through which the storm quadrants leak into the safe center. The refuge is defined by what it lets in.
Sources: https://katiepaterson.org/artwork/vatnajokull-the-sound-of/

### 6. Silent Echoes: Dachstein — Bill Fontana (2024)
Accelerometers on Notre-Dame's fire-silenced bells transmit their standing vibrations live into the Dachstein ice caves, duetting with the melting glacier; streamed worldwide.
**Non-didactic strategy:** Juxtaposition instead of statement — two fragilities put in the same acoustic room and left to resonate. Liveness is the argument.
**Steal this:** The duet structure — let interior sounds *physically excite* each other across zones: the storm's low end sets the refuge's windows (a filtered resonance) ringing; the sump pump's rhythm phases against rain. Cross-zone resonance makes the house one connected body.
Sources: https://ars.electronica.art/hope/en/events/silent-echoes-dachstein/

### 7. Air Play — Brian Foo / Data-Driven DJ (2015)
A pop-structured track driven by three years of Beijing PM2.5 air-quality data.
**Non-didactic strategy:** Genre as Trojan horse — data mapped onto *listenable music* conventions; methodology published openly, opt-in.
**Steal this:** The opt-in methodology page: hide the mappings behind a "how this works" layer rather than annotating the experience — data legibility as a second visit, not a first impression.
Sources: https://datadrivendj.com/

### 8. The [Uncertain] Four Seasons — AKQA et al. (2021, COP26)
Vivaldi's Four Seasons algorithmically rewritten per IPCC RCP 8.5 projections for 2050 — ~1,000 localized variants; degraded birdsong passages, missing bars where biodiversity collapses.
**Non-didactic strategy:** Damage to a known object — everyone carries the original, so the *deviation itself* is audible without explanation.
**Steal this:** The corrupted-familiar: known domestic sounds behaving slightly wrongly — an AC that short-cycles, a fridge a semitone flat under brownout, rain 15% too heavy for the gutters. Deviation from a remembered normal, not spectacle.
Sources: https://www.akqa.com/work/vivaldi/the-uncertain-four-seasons/

### 9. Heat and the Heartbeat of the City / Sonic Antarctica — Andrea Polli (2004; 2009)
Sonifies observed and projected Central Park summer temperatures decade by decade; Sonic Antarctica interleaves field recordings, data audifications, and scientists' voices.
**Non-didactic strategy:** The city-dweller's body as reference point — heat where the audience lives.
**Steal this:** Anchor one data mapping to *thermal comfort*: a heat-index dataset driving the AC's strain (compressor pitch, duty cycle, failure stutter). Everyone's body knows the sound of an AC losing the fight.
Sources: https://en.wikipedia.org/wiki/Andrea_Polli

### 10. Glacier Music — Matthew Burtner (2019; ongoing)
Compositions where glacier field recordings and sonified melt measurements are embedded *as structure* — instruments follow melt-rate curves.
**Non-didactic strategy:** "Ecoacoustics" — the environmental system becomes the score's *form*, not its subject.
**Steal this:** Let a real dataset be the *clock*, not the color: a year of real precipitation data compressed into the session, silently scheduling drips and pump wake-ups. The listener never sees the data; they feel the house's rhythms are not random.
Sources: https://www.matthewburtner.com/about

### 11. Sounding Climate — NCAR/UCAR (2018)
Interactive kiosk sonifying 40 runs of the CESM Large Ensemble; the scale shifts from major to minor as CO2 rises.
**Non-didactic strategy:** Mostly didactic, but one elegant move: *ensemble uncertainty made audible* — 40 model runs as 40 slightly divergent voices.
**Steal this:** Uncertainty as detune — render scenario spread as literal detuning/ensemble-width of a drone. (And avoid its major-to-minor mapping — canonical kitsch.)
Sources: https://scied.ucar.edu/exhibits/sounding-climate

### 12. Sonification of Warming Stripes — Newcastle University / STRAUSS (2024)
Ed Hawkins' warming stripes as audio, designed as data journalism and for blind/low-vision audiences.
**Steal this:** The accessibility framing: dwell:refuge is inherently a *non-visual climate artwork* — saying so (screen-reader-friendly UI, "a climate piece you experience with your ears") positions it in a real conversation.
Sources: https://data.ncl.ac.uk/articles/media/Sonification_of_Warming_Stripes/28030463

### 13. World Weather Network — Artangel + 28 agencies (2022–23)
A planetary archipelago of artist-run weather stations; artists filed *weather reports* — the mundane genre smuggling climate in as accumulated ordinary experience.
**Steal this:** The weather report as narrative device — an occasional half-heard radio weather report, the one media genre through which climate has always entered the home. Name the storms; date the floods.
Sources: https://www.artangel.org.uk/project/world-weather-network/

### 14. Mitigation of Shock — Superflux (2017; 2019)
The canonical "future mundane" installation (see Thread C for full detail).
**Non-didactic strategy:** No catastrophe shown, only *adaptation residue* — the flat is calm, lived-in, even hopeful.
**Steal this:** *Evidence of coping, not evidence of disaster*: every sound should imply a person who already adapted (the bucket was placed; the pump was installed; the AC filter was changed). The piece's warmth depends on sounds of maintenance, not sounds of damage.
Sources: https://superflux.in/index.php/work/mitigation-of-shock/

### 15. Nature Manifesto — Björk with IRCAM (2024, Centre Pompidou)
Field recordings of endangered and extinct animals — some AI-reconstructed — in the Pompidou's escalator tubes.
**Steal this:** Honesty about synthesis: declare which sounds are recordings of a real present house and which are synthesized futures — the boundary between recorded and reconstructed is itself climate content.
Sources: https://www.npr.org/2024/11/22/nx-s1-5199068/bjork-endangered-extinct-sound

### The discipline & curation
- **Soundscape ecology** (Pijanowski, Purdue): biophony/geophony/anthropophony ratios as ecosystem-health index. dwell:refuge is anthropophony-first *by design* — the taxonomy applies inside the house (biophony: a fly; geophony: rain on the roof; anthropophony: the machines keeping you alive). A zone's "health" could literally be its ratio.
- **Curatorial pattern 2022–26** (UCLA *Atmosphere of Sound*, Onassis *Weather Engines*, Artangel): climate audio curated as **attunement**, sited outside white cubes, paired with science partners. Research consensus (Frontiers in Psychology, 2022, 32 projects): audiences perceive data-to-sound mappings as **arbitrary** unless they build on ecological perception.

### Thread B — Top 5 takeaways
1. **The domestic aperture is the open lane** — cite Paterson/Superflux as lineage.
2. **Deviation-from-the-familiar is the sharpest non-didactic tool** — remembered normals, corrupted by degrees.
3. **Hide the data, keep the rigor** — datasets as structural clock; methodology opt-in.
4. **Avoid the field's failures: mourning as default register, sonification as press release** — the register is *competence under strain*: warmth with a fray at the edges, never a sad chord.
5. **Frame with one sentence; be honest about synthesis.**

---

## Thread C — Speculative Design & the Future Mundane

### 1. The Future Mundane — Nick Foster (2013)
The essay that names dwell:refuge's core concept. URL: https://www.core77.com/posts/25678/the-future-mundane-25678
**The three principles:** (1) *Filled with background talent* — design for the extras, not the heroes; the future belongs to people to whom nothing cinematic is happening. (2) *An accretive space* — the future doesn't replace, it accretes; "the future will include spacecraft, artificial skin and self-driving vehicles, but it will also include garbage, staplers and milk." (3) *A partly broken space* — the future keeps taxes, illness, weather; things half-work. Brokenness makes a future *relatable*; perfection reads as advertising.
**Steal this:** Apply "partly broken" literally: the refuge shouldn't be pristine — the AC *strains*, the fridge cycles slightly wrong, a fan ticks. And "accretive": mix decades of technology in one soundscape (analog wall clock next to a smart-speaker chime next to a hand-cranked radio).

### 2. Mitigation of Shock (London) — Superflux (2017)
A meticulously fabricated London flat circa 2050, adapted for chronic food insecurity. URLs: https://superflux.in/index.php/work/mitigation-of-shock/ · Jain, "Post-Occupancy Anthropology," *Architectural Design*, 2019.
**Sound design detail:** The living room's baseline drone is the *constant low hum of fans and pumps* of DIY fogponics food computers. The outside world enters **only as mediated sound and paper**: a radio plays an *hourly news bulletin* — a fully produced fictional broadcast in familiar BBC cadence, reporting weather disruption and food-price spikes — timed to begin while visitors explore. Newspapers dated 2050; handwritten recipes (mealworm burger, fox stew). Framed as *optimistic*: resourceful adaptation, "hope in the blasted ruins."
**Steal this:** The **hourly news bulletin**: a faint radio, mostly unintelligible, whose *cadence* (jingle, measured announcer tone, weather-warning inflection) is recognizable even when words aren't. It timestamps the world, implies time passing, and lets the crisis enter the home domesticated — as broadcast, not spectacle.

### 3. Mitigation of Shock (Singapore) — Superflux (2019–20)
The concept re-localized as an HDB flat in a flooded, sweltering Singapore: a kayak parked at the front door, snorkeling gear as household equipment, mylar against heat, ration cards, *Pets as Proteins* cookbooks. URLs: https://superflux.in/index.php/work/mitigation-of-shock-singapore/ · https://www.fastcompany.com/90454568/
**Steal this:** The "kayak by the door" logic in sound: crisis-objects *routinized* — the drip is periodic and tended (occasionally the bucket is emptied: a slosh, a set-down clunk), a pump switched on and off like a kettle. Emergency as habit.

### 4. Uninvited Guests — Superflux (2015)
A 70-year-old widower wages quiet war against the smart devices his children send. URL: https://superflux.in/index.php/work/uninvited-guests/
**Steal this:** Device voices as domestic characters — one polite, slightly-too-calm notification chime (a thermostat acknowledging a "grid demand event") says "future" in two seconds. Human micro-sounds (a sigh, a chair creak, slippers) prove someone lives here.

### 5. TBD Catalog — Near Future Laboratory (2014)
A design-fiction product catalog of the "normal ordinary everyday near future." URL: https://tbdcatalog.com/
**Steal this:** If any text is added beyond the entry screen, make it a *boring document from inside the fiction*: a utility company's "flexible supply notice," a building memo about bucket placement. One deadpan artifact-sentence outperforms paragraphs of concept statement.

### 6. Dunne & Raby — Placebo Project / Technological Dreams / Foragers (2001–09)
Critical design staged in the home; the Placebo objects provide *psychological* comfort against invisible threats, whether or not they work. URL: https://dunneandraby.co.uk/content/projects/70/0
**Steal this:** Coping rituals that only half-work: taping a window edge, weighting the blinds, a white-noise machine turned on against the storm. The home's defenses are partly theatrical — that's what makes them tender.

### 7. 99¢ Futures — Extrapolation Factory (2013)
Futures smuggled onto real dollar-store shelves. URL: https://extrapolationfactory.com/Projects/99-FUTURES
**Steal this:** Cheapness as world-building — the future should sound *cheap*: plastic fan blades, a flimsy bucket (not a resonant pail), thin glass, a $30 AC unit. Material poverty is audible and signals "ordinary people, near future."

### 8. Carbon Ruins — Climaginaries / Lund University (2019)
A museum-from-2053 looking *back* at the fossil age; familiar objects displayed as relics.
URL: https://www.climaginaries.org/carbon-ruins
**Steal this:** Tense as framing — "the interior has held so far" implies duration and survival rather than prediction. Sonically: sounds that are *already memories* (an ice-cream van faint in the heat zone; lawn sprinklers ghosting the drought).

### 9. Forest 404 — BBC Radio 4 (2019)
A 27-part eco-thriller set in a 24th century without nature; sound itself is the archive of a lost world. Attached 7,600-listener wellbeing experiment. URL: https://en.wikipedia.org/wiki/Forest_404
**Steal this:** Validation of the text-light bet: sound alone carries the fiction, and *documentary-grade* recordings are what land emotionally. Record the real bucket, the real AC — no sweetening. Fidelity is the credibility.

### 10. Flash Forward — Rose Eveleth (2015–21)
Each episode opens with produced audio scenes *from inside* a possible future — voicemails, ads, hold music. URL: https://www.flashforwardpod.com/about/
**Steal this:** Media-texture realism: any voice or broadcast heard *through something* — phone speaker, other-room muffling, radio static — never clean. You believe the future because it sounds badly recorded.

### 11. Future Cities — Cities and Memory (2020)
500+ artists reimagined field recordings of present cities as future versions, paired A/B. URL: https://citiesandmemory.com/future-cities/
**Steal this:** The A/B logic made spatial: each zone as a recognizable *baseline domestic recording plus one degree of alteration*. The uncanny arises from the delta, not from invented sounds.

### 12. Invocation for Hope — Superflux, sound by Cosmo Sheldrake (2021)
400 fire-blackened pines concealing a living green center; the soundscape guides from burnt edge to resurgent core. URL: https://superflux.in/index.php/work/invocation-for-hope-3/
**Steal this:** A protected sonic center: the refuge should have the *warmest, closest* acoustics (small-room reverb, near-field sounds — breathing, a kettle, pages turning) while the climate zones are acoustically harder and more distant. Comfort through reverb character, not just volume.

### 13. Our Time on Earth — Barbican (2022)
The 2020s museological turn: climate futures staged as sensory experience, framed around hope and everyday agency. URL: https://www.barbican.org.uk/our-story/press-room/our-time-on-earth
**Steal this:** Positioning: the strongest 2020s climate works refuse the dystopia/utopia binary and market on *experience* ("step inside," "listen"), not message.

### 14. Speculative sound in design research (2021–25)
*Listening Is Believing* (IJDesign) — designed future *sounds* carry scenarios better than images; *Sonic Shower* (SIGGRAPH Asia 2025) — bathing as pure audio ritual for a water-scarce future; "Design at the Earview" — sonic fiction as speculative method.
**Steal this:** Sonic Shower inverted for the drought zone: a water ritual persisting in reduced form — a tap run briefly and shut off fast, a kettle filled from a stored jug, a timer beep ending a shower. Scarcity as *duration discipline* on familiar sounds.

### 15. Home Futures — Design Museum, London (2018–19)
A century of domestic futures; the real future home turned out to be the old home plus phones.
**Steal this:** Confidence for restraint: the sonic furniture of the home (kettle, clock, plumbing, doors, radio) has barely changed in 70 years and won't by 2040. Two or three invented "future sounds" against an entirely familiar bed is the historically accurate ratio.

### Thread C — Top 5 takeaways
1. **Familiar recording with one degree of deviation; brokenness carries the story** — ~90% ordinary, ~10% stress-signature; we hear the interior *working at it*.
2. **Curatorial text: promise an act of listening, one deadpan in-fiction line, never explain the stakes** — "The interior has held so far."
3. **Lived-in details: mediated broadcast, cheap materials, human maintenance** — the news cadence through a tinny speaker; plastic and thin glass; the bucket emptied, tape smoothed, a sigh.
4. **The refuge acoustically warm, not merely quiet — comforts partly placebo.**
5. **Imply time through cycles and remembered sounds** — routine periodicity reads as chronic and normalized; memory-sounds are where the grief actually lives.

---

## Thread D — Adaptive Game Audio & Web Spatial Audio

### A1. Wwise ambient structuring: Blend/Random Containers, RTPCs, States
URLs: https://www.audiokinetic.com/en/blog/open-world-ambient-design-using-image-based-parameters/ · https://www.audiokinetic.com/en/blog/all-the-parameters-new-features-with-wwise-state-based-mixing/
Blend Containers stack intensity layers with per-track volume curves over one RTPC axis; Random Containers de-loop repetition with "avoid last N"; States are named mix snapshots with per-property transition times.
**Steal this:** An *intensity RTPC per zone* (dwell-time + depth into zone) mapped through per-element breakpoint curves; zone transitions formalized as State snapshots `{busGains, lpfCutoffs, reverbSends, transitionTimes}` applied atomically.

### A2. FMOD Scatterer Instrument
URLs: https://gameaudio.fandom.com/wiki/FMOD_Studio_Scatterers · https://javierzumer.com/blog/2022/1/28/fmod-built-in-parameters
Periodic one-shot respawner: randomized interval, pitch, volume, and *random position in an annulus* around the listener (min distance prevents "inside your head" spawns); automatable rate scalar; polyphony cap.
**Steal this:** Upgrade one-shots to full scatterers: `{minInterval, maxInterval, rateScalar, minDist, maxDist, maxVoices, pool[]}` — the *rate scalar as automatable macro* is the key: one knob per scatterer that stillness/dwell/seams can modulate.

### A3. Ghost of Tsushima — scalable ambience (GDC 2021)
URLs: https://bradleymeyer.com/wp-core/2025/12/06/ghost-of-tsushima-ambience-gdc-talk-now-available-on-the-vault-for-free · https://www.asoundeffect.com/ghost-of-tsushima-sound/
Data-driven procedural ambience; the wind rig is **four mono emitters surrounding the player, each independently sampling the environment at its own position** — the stereo field itself encodes local geography.
**Steal this:** The **4-probe ambience rig**: four virtual probes offset around the listener, each evaluating *which zone it stands in* and playing that zone's bed from its own direction. Standing on a seam, you literally hear rain to the left and heat to the right. The highest-leverage spatial upgrade available.

### A4. Unreal — Audio Volumes, Ambient Zones, distance-scaled reverb sends
URLs: https://dev.epicgames.com/documentation/en-us/unreal-engine/ambient-zones-in-unreal-engine · https://www.microsoft.com/en-us/research/project/project-triton/
Interior/exterior volume+LPF pairs are the whole "wall" illusion — no raycasting. Reverb send scales with distance (far sources are wetter). Portals make sound through a doorway come *from the doorway*.
**Steal this:** (1) Interior/exterior filter pairs: route other zones' beds through a shared `lowpass ~800Hz − 9dB` "wall node" mixed by interiority. (2) Distance-scaled wet sends: dry = 1/d, wet = clamp(d/dMax) into the existing per-zone convolvers — distant one-shots become mostly reverb.

### A5. HDR audio, ducking, voice prioritization
URLs: https://www.audiokinetic.com/en/blog/wwise-hdr-overview-and-best-practices-for-game-mixing/ · https://www.asoundeffect.com/game-audio-mixing-demystified/
The mix as scarce resource: loud events push a moving audibility window; voices culled quietest-first; ducking with attack/release ramps.
**Steal this:** Feed-forward scheduled ducking (we know when one-shots fire): duck the zone bed 2–4dB, τ≈0.15s down / 1.2s up. Plus virtualization: zone buses below ~−50dB actually `stop()` their sources, remember offsets, restart on approach.

### A6. Proteus — David Kanaga's "music as ecology"
URLs: https://www.gamedeveloper.com/audio/the-sound-and-music-of-proteus---an-academic-case-study
"Every object is singing": each entity emits a loop quantized to a shared key per season; proximity mixes voices; layers are *harmonically pre-composed to coexist in any combination*.
**Steal this:** A shared tonal center: quantize playback-rate jitter to just-intonation ratios (1, 9/8, 6/5, 4/3, 3/2…), tune oscillator/filter resonances per zone to chord tones of one global scale. Zone crossfades become *harmonic modulations*. Nearly free; transforms soundscape into music.

### A7. Journey — Austin Wintory's adaptive score
URL: https://awintory.medium.com/from-journey-to-erica-214355002896
One continuous themed work where instrumentation, not track-switching, encodes state; adaptive changes are *slow and unannounced*.
**Steal this:** Evolution as *orchestration*: stems that enter (a sub drone at 60s, a filtered shimmer at 90s) with 10–20s fades, never louder versions of the same. Stillness introduces a *new harmonic voice* — presence rewarded with orchestration, not just EQ.

### A8. Dear Esther & Kentucky Route Zero — walking-sim discipline
URLs: https://gdcvault.com/play/1017704/The-Music-of-Dear-Esther · https://daily.bandcamp.com/high-scores/ben-babbitt-kentucky-route-zero-original-soundtrack-interview
Curry: silence and rare glacial cues make each entrance devastating. Babbitt: songs and their ambient abstractions recorded *in the same key* so they crossfade seamlessly; personal field recordings folded in.
**Steal this:** (1) A *scarcity budget*: one rare 20–40s "score moment" per zone, at most once per N minutes, gated behind stillness. (2) Same-source-different-focus: a "focused" version and a processed abstraction of each key loop, in the same key, crossfaded by stillness — feels like *attention shifting*, not a mix change.

### A9. Mini Metro — Disasterpeace's serialism
URLs: https://disasterpeace.com/blog/mini-metro.serialism-talk.html
No looping music: game data zipped with *authored* series (pitch sets, rhythm sets). Unpredictable in the small, composer-shaped in the large; everything quantized to a global pulse.
**Steal this:** Replace `Math.random()` in schedulers with authored series: per zone, hand-written arrays of pitch offsets, inter-onset durations, pan positions — advanced independently (coprime lengths → phasing). Ten lines of code; one-shots stop sounding like dice.

### A10. No Man's Sky — Paul Weir's Pulse
URLs: https://www.gdcvault.com/play/1024067/The-Sound-of-No-Man · https://www.asoundeffect.com/no-mans-sky-sound-procedural-audio/
Generative ≠ synthesized: curated stem libraries recombined by rules. Procedural synthesis reserved for unbounded-variation elements (creature voices).
**Steal this:** Many short tagged, key-compatible fragments per zone recombined every 20–60s instead of long loops — attacks the "4th-minute loop fatigue." Keep synthesis for drips/wind (unbounded variation), exactly Weir's division of labor.

### A11. Breath of the Wild — restraint as system
URL: https://gonintendo.com/archives/300029
Scored mostly by silence, wind, sparse aleatoric piano at ambience level; the dynamic-range budget planned across hours. Most of the time the music system's correct output is nothing.
**Steal this:** A **density budget with recession**: after peak (~3–4 min dwelling), decay layers back out toward sparser-than-initial; every scatterer gets a duty cycle with genuine 30–90s rests. One scalar all rates multiply against, following rise–fall–rest.

### B1. Omnitone & Resonance Audio (status: abandoned)
URLs: https://github.com/GoogleChrome/omnitone · https://resonance-audio.github.io/resonance-audio/develop/web/getting-started.html
The important architectural idea: encode sources into a shared ambisonic bus, apply HRTF *once to the soundfield* — O(1) binauralization. Both libraries unmaintained (Resonance archived Dec 2022).
**Verdict:** Don't adopt; revisit hand-rolled 2D FOA only if profiling shows PannerNode cost.

### B2. PannerNode/HRTF pitfalls & best practices
URLs: https://padenot.github.io/web-audio-perf/ · https://github.com/WebAudio/web-audio-api-v2/issues/102
HRTF is per-source convolution; Chrome loads HRIRs lazily (audible delay, no completion event); engines differ; direct `.value` assignment causes zipper noise.
**Steal this:** Warm HRTF panners at init (0-gain noise, 500ms); cap HRTF at the ~5 nearest/loudest sources, StereoPanner+LPF for the rest; all position updates via `setTargetAtTime` (τ≈50–100ms — free motion smoothing).

### B3. AudioWorklet — current state
URLs: https://developer.chrome.com/blog/audio-worklet-design-pattern/ · https://engineering.videocall.rs/posts/how-to-make-javascript-audio-not-suck/
Universal since Safari 14.1; 2025 consensus: pre-allocate, no GC in `process()`, profile plain JS before WASM (JIT ≈ native for numeric loops; WASM is more predictable, not faster).
**Steal this:** One justified use: a **modulation-brain worklet** — one processor generating all slow correlated LFO/1-f-noise channels, wired into params — sample-accurate and immune to main-thread jank (timers stall when the tab scrolls/backgrounds). Plain JS, loaded via `addModule`, fits the no-build constraint.

### B4. Tone.js / Elementary / Faust — transcribe, don't import
URLs: https://tonejs.github.io/ · https://www.elementary.audio/ · https://faust.grame.fr/
What they supply over raw Web Audio: Tone's Transport (the Chris Wilson look-ahead clock + musical time), Elementary's graph reconciliation (state → desired graph, diffed), Faust's DSP library exportable as standalone worklets.
**Steal this:** (1) A 40-line look-ahead scheduler — the single most important infrastructure piece; everything (scatterers, series, stem entries, rare moments) hangs off one clock. (2) A micro-reconciler for zone state to kill connect/disconnect bookkeeping bugs. (3) Faust IDE for prototyping any future physical-model synth, exported vanilla.

### B5. 2024–26 frontier: WebGPU audio, in-browser neural synthesis
URLs: https://www.webgpusound.com/ · https://www.emergentmind.com/topics/rave-model-for-neural-audio-synthesis
GPU compute is asynchronous relative to the audio callback (wrong for low-latency interaction); neural models cost 10–80MB downloads.
**Verdict:** Runtime no; **offline asset generation yes** — RAVE-style timbre transfer to derive each zone's "abstraction" layer from our field recordings; ship the audio, keep the runtime pure.

### Thread D — Top 5 takeaways
1. **The 4-probe ambience rig** (Tsushima) — directional seams; ~a day of wiring on existing infrastructure.
2. **Look-ahead scheduler + fragment recombination + authored series** — attacks loop fatigue, the defining failure mode of dwell-length listening.
3. **Harmonic ecology** (Proteus) — cheapest item, largest identity payoff.
4. **Density budget with recession + scheduled ducking** — long-dwell listening needs breathing room and figure/ground more than more layers.
5. **Spatialization hygiene + HRTF triage** — the difference between "spatial on my machine" and spatial on a fanless laptop in Firefox.
**Not worth it:** ambisonics libs (abandoned), WebGPU/neural runtime (latency, weight, ethos), WASM worklets (JS suffices).
