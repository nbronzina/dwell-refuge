// ============================================
// DWELL:REFUGE - Field Recordings (optional layer)
// Real CC0 recordings replace their synthesized counterparts
// when the files are present in audio/. Missing files are
// normal: every slot falls back to synthesis, so the piece
// works with any subset - or none at all.
// ============================================

const Samples = (function() {
    'use strict';

    // What can be replaced by a recording. `trim` scales the file
    // to the loudness the mix expects - adjust it per recording
    // instead of re-editing the file.
    const MANIFEST = {
        'rain-window': {
            files: ['rain-window.mp3'], loop: true, trim: 1,
            desc: 'steady rain against a window pane'
        },
        'thunder': {
            files: ['thunder-1.mp3', 'thunder-2.mp3', 'thunder-3.mp3'], loop: false, trim: 1,
            desc: 'distant rolling thunder, one clap per file'
        },
        'cicadas': {
            files: ['cicadas.mp3'], loop: true, trim: 1,
            desc: 'night insect chorus, outdoors (the heat zone is a sleepless hot night)'
        },
        'room-tone': {
            files: ['room-tone.mp3'], loop: true, trim: 1,
            desc: 'quiet interior room tone'
        },
        'water-pipes': {
            files: ['water-pipes.mp3'], loop: true, trim: 1,
            desc: 'water gurgling through pipes'
        },
        'splash': {
            files: ['splash-1.mp3', 'splash-2.mp3'], loop: false, trim: 1,
            desc: 'small indoor water splashes'
        },
        'wind-dry': {
            files: ['wind-dry.mp3'], loop: true, trim: 1,
            desc: 'dry wind through a doorframe or open field'
        },
        'creak': {
            files: ['creak-1.mp3', 'creak-2.mp3'], loop: false, trim: 1,
            desc: 'wood creaking under strain'
        }
    };

    const BASE_PATH = 'audio/';

    // key -> array of decoded AudioBuffers (variants)
    const buffers = {};
    let loadStarted = false;
    let filesLoaded = 0;
    const filesTotal = Object.keys(MANIFEST)
        .reduce((n, k) => n + MANIFEST[k].files.length, 0);

    function makeDecoder() {
        // AudioBuffers are plain PCM data - decode with a throwaway
        // offline context so loading can begin before the user gesture
        // that unlocks the real AudioContext
        if (typeof OfflineAudioContext !== 'undefined') {
            return new OfflineAudioContext(1, 1, 44100);
        }
        if (typeof webkitOfflineAudioContext !== 'undefined') {
            return new webkitOfflineAudioContext(1, 1, 44100);
        }
        return null;
    }

    function load() {
        if (loadStarted) return Promise.resolve();
        loadStarted = true;

        if (typeof fetch === 'undefined') return Promise.resolve();
        const decoder = makeDecoder();
        if (!decoder) return Promise.resolve();

        const jobs = [];
        Object.keys(MANIFEST).forEach(key => {
            MANIFEST[key].files.forEach(file => {
                jobs.push(
                    fetch(BASE_PATH + file)
                        .then(res => {
                            if (!res.ok) throw new Error('http ' + res.status);
                            return res.arrayBuffer();
                        })
                        .then(data => decoder.decodeAudioData(data))
                        .then(buffer => {
                            if (!buffers[key]) buffers[key] = [];
                            buffers[key].push(buffer);
                            filesLoaded++;
                        })
                        .catch(() => { /* missing file: synthesis covers this slot */ })
                );
            });
        });

        return Promise.all(jobs).then(() => {
            if (filesLoaded > 0) {
                console.log('dwell:refuge field recordings: ' + filesLoaded + '/' + filesTotal + ' files loaded');
            }
        });
    }

    function has(key) {
        return !!(buffers[key] && buffers[key].length);
    }

    function pick(key) {
        const list = buffers[key];
        return list[Math.floor(Math.random() * list.length)];
    }

    function trimFor(key) {
        return (MANIFEST[key] && MANIFEST[key].trim) || 1;
    }

    /**
     * Seamless looper: alternating sources overlapping under an
     * equal-power-ish crossfade, so any recording loops cleanly
     * without editing exact loop points into the file.
     * Same interface as the synthesis modules: gain / connect /
     * start / stop.
     */
    function createLoop(ctx, key) {
        const buffer = pick(key);

        const out = ctx.createGain();
        out.gain.value = 1;
        const trimGain = ctx.createGain();
        trimGain.gain.value = trimFor(key);
        trimGain.connect(out);

        const xfade = Math.min(1.5, buffer.duration / 6);
        let stopped = false;
        let timer = null;
        const live = new Set();

        function spawn(startTime) {
            if (stopped) return;

            const src = ctx.createBufferSource();
            src.buffer = buffer;
            const env = ctx.createGain();
            src.connect(env);
            env.connect(trimGain);

            const d = buffer.duration;
            env.gain.setValueAtTime(0, startTime);
            env.gain.linearRampToValueAtTime(1, startTime + xfade);
            env.gain.setValueAtTime(1, Math.max(startTime + xfade, startTime + d - xfade));
            env.gain.linearRampToValueAtTime(0, startTime + d);

            src.start(startTime);
            src.stop(startTime + d + 0.05);
            live.add(src);
            src.onended = () => {
                live.delete(src);
                try { env.disconnect(); } catch(e) {}
            };

            // Wake shortly before the crossfade point to schedule the next pass
            const nextStart = startTime + d - xfade;
            const wakeMs = Math.max(0, (nextStart - ctx.currentTime) * 1000 - 250);
            timer = setTimeout(() => spawn(nextStart), wakeMs);
        }

        return {
            gain: out,
            connect: dest => out.connect(dest),
            start: () => spawn(ctx.currentTime + 0.05),
            stop: () => {
                stopped = true;
                if (timer) clearTimeout(timer);
                live.forEach(src => { try { src.stop(); } catch(e) {} });
                live.clear();
                try { out.disconnect(); } catch(e) {}
            }
        };
    }

    /**
     * Play a one-shot recording: random variant, slight playback
     * rate jitter so repeats never sound identical.
     * Returns false when no recording is available - callers fall
     * back to synthesis, which also means recordings that finish
     * decoding mid-session get picked up on their next event.
     */
    function playOneShot(ctx, key, destination, gain = 0.3) {
        if (!has(key)) return false;

        const buffer = pick(key);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        if (src.playbackRate) {
            src.playbackRate.value = 0.94 + Math.random() * 0.12;
        }

        const g = ctx.createGain();
        g.gain.value = gain * trimFor(key);

        src.connect(g);
        g.connect(destination);
        src.start();
        src.onended = () => {
            try { src.disconnect(); } catch(e) {}
            try { g.disconnect(); } catch(e) {}
        };
        return true;
    }

    function status() {
        return filesLoaded + '/' + filesTotal;
    }

    return {
        MANIFEST,
        load,
        has,
        createLoop,
        playOneShot,
        status,
        // Test hook: inject a decoded buffer without fetch
        _inject: function(key, buffer) {
            if (!buffers[key]) buffers[key] = [];
            buffers[key].push(buffer);
            filesLoaded++;
        }
    };
})();
