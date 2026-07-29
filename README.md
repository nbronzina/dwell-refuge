# dwell:refuge

A climate refuge soundscape by [Heated Studio](https://heated.studio), built on the mk-dwell engine by Playground.

The piece makes audible a present we haven't finished naming: the interior that holds while the outside becomes unpredictable. Everything you hear is domestic — appliances, pipes, blinds, a dripping faucet — under climate stress.

The engine is hybrid: every sound is synthesized in real time with the Web Audio API, and key layers (rain, thunder, cicadas, wind, water, creaks, room tone) can be replaced by real CC0 field recordings dropped into `audio/` — see [audio/README.md](audio/README.md). Any missing recording falls back to its synthesized version, so the piece always works, offline included.

## The space

Your cursor is your position. The center is where you want to stay; the corners are what you want to escape from.

```
storm ─────────── heat
  │                │
  │     refuge     │
  │                │
flood ────────── drought
```

| Zone | Position | What you hear |
|------|----------|---------------|
| **storm** | top left | Rain on glass, an interior leak, blinds rattling, thunder shaking the window |
| **heat** | top right | AC drone, fridge cycling, cicadas through closed windows, a ceiling fan |
| **refuge** | center | Room tone, steady ventilation, the building settling — normalcy |
| **flood** | bottom left | Water in pipes, drips into a bucket, a sump pump, splashes |
| **drought** | bottom right | Dry wind, dust, a scarce faucet, wood creaking |

Each zone is a room, not a point — spatially and acoustically. Each hostile climate owns its full quadrant and the refuge holds the center: anywhere inside a region you hear that zone at full presence, crossfades live in the seams and corridors between rooms, and beyond its fade band a zone is genuinely silent. Within a room, elements sit at fixed spots in the stereo field (the rain at the window on your left, the drip into the bucket on your right), one-shot events come from a different place each time, and the mix shifts as you move — approach the window and the rain comes forward. Each room also has its own acoustics (a bright room with a window, a metallic basement, an empty diffuse expanse…), and fading zones sound muffled as well as quiet.

## Interactions

- **Move** (mouse, touch, arrow keys, or device tilt on mobile) to travel between zones. The Y axis controls depth: bright and present at the top, muffled and distant at the bottom.
- **Stay** in a zone and it evolves — hostile zones intensify over ~2 minutes; the refuge settles even calmer.
- **Be still** and the space rewards you: the filter opens and detail emerges.
- **Walk away** and after 90 seconds the weather comes to you — your position drifts slowly toward the nearest hostile zone.
- **Esc** returns to the entry screen. The back arrow fades everything out before leaving.

Headphones recommended.

## Architecture

Plain HTML/CSS/JS. No frameworks, no build step, no external audio.

| File | Role |
|------|------|
| `js/synthesis.js` | Reusable Web Audio building blocks: noise generators (with click-free loop seams and shared cached buffers), AM insect synthesis, appliance cycles, drips with cached impulse responses, per-zone reverb profiles, a generic event scheduler |
| `js/samples.js` | Optional field-recording layer: manifest, background loading/decoding, a crossfading looper for un-edited recordings, one-shot pools with variant picking and rate jitter — every slot falls back to synthesis |
| `js/zones.js` | The five zone soundscapes: layer balance, event timing, per-zone reverb, welcome triggers, visual event dispatch |
| `js/audio.js` | Engine: distance-based zone gains, Y-axis filter/reverb/delay, temporal evolution, stillness reward, micro-drift LFOs, stereo panning, master chain (sub-bass highpass → compressor), tab pause/resume, graceful exit |
| `js/input.js` | Mouse/touch/keyboard/gyroscope input, throttled audio updates, zone-tinted background, idle drift |
| `js/main.js` | State, entry/leave transitions, hints, visual pulses, zone label |
| `service-worker.js` | Offline support — network-first for the page, cache-first for assets |

## Running locally

Serve the directory with any static server (the service worker needs http, not `file://`):

```bash
npx serve .
# or
python3 -m http.server
```

Audio starts on the enter button — browsers require a user gesture to start an AudioContext.

## Development

**Smoke test** — exercises the whole audio graph (zone construction, engine lifecycle, re-entry, graceful exit) against a mocked Web Audio API, including leak detection for oscillators and looped sources:

```bash
node test/smoke.js
```

**Tuning overlay** — append `?debug` to the URL for live engine state: dominant zone, per-zone gain and evolution factor, velocity, stillness, spatialization mode, context state.

## Browser notes

- Chrome / Edge / Firefox / Safari 14.1+ (StereoPannerNode; older browsers fall back to mono placement).
- Desktops with more than 4 cores get HRTF spatialization; everything else uses stereo panning.
- iOS 13+ asks permission for device orientation — the "use motion" button handles it.
- `prefers-reduced-motion` disables the visual pulses.
