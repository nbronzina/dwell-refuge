// ============================================
// DWELL:REFUGE - Synthesis Utilities
// Reusable Web Audio API synthesis functions
// ============================================

const Synthesis = (function() {
    'use strict';

    // Seeded random for reproducible generation
    let seed = Date.now();
    function seededRandom() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    }

    // Reset seed for consistency
    function resetSeed(newSeed) {
        seed = newSeed || Date.now();
    }

    // ============================================
    // NOISE GENERATORS
    // ============================================

    /**
     * Crossfade the buffer's tail into its head so looped
     * playback has no discontinuity click at the seam
     */
    function smoothLoopEnds(output, sampleRate) {
        const fadeLen = Math.min(Math.floor(sampleRate * 0.05), Math.floor(output.length * 0.1));
        if (fadeLen < 2) return;
        const start = output.length - fadeLen;
        for (let i = 0; i < fadeLen; i++) {
            const w = i / fadeLen;
            output[start + i] = output[start + i] * (1 - w) + output[i] * w;
        }
    }

    /**
     * Create pink noise buffer
     * Pink noise: 1/f spectrum, natural sounding
     */
    function createPinkNoiseBuffer(ctx, duration = 2) {
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = buffer.getChannelData(0);

        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

        for (let i = 0; i < bufferSize; i++) {
            const white = seededRandom() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
        }

        smoothLoopEnds(output, ctx.sampleRate);
        return buffer;
    }

    /**
     * Create white noise buffer
     */
    function createWhiteNoiseBuffer(ctx, duration = 2) {
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            output[i] = seededRandom() * 2 - 1;
        }

        smoothLoopEnds(output, ctx.sampleRate);
        return buffer;
    }

    // Shared looped noise buffers - several zones loop the same
    // kind of noise, so generate each variant once per session.
    // Consumers decorrelate by starting at a random offset.
    const noiseBufferCache = {};

    function getNoiseBuffer(ctx, type, duration = 2) {
        const key = type + ':' + duration + ':' + ctx.sampleRate;
        if (!noiseBufferCache[key]) {
            noiseBufferCache[key] = type === 'pink'
                ? createPinkNoiseBuffer(ctx, duration)
                : createWhiteNoiseBuffer(ctx, duration);
        }
        return noiseBufferCache[key];
    }

    /**
     * Create looped noise source with filter
     * @param {AudioContext} ctx
     * @param {string} noiseType - 'pink' or 'white'
     * @param {string} filterType - 'lowpass', 'highpass', 'bandpass'
     * @param {number} cutoff - filter cutoff frequency
     * @param {number} Q - filter resonance
     */
    function createFilteredNoise(ctx, noiseType, filterType, cutoff, Q = 0.5) {
        const buffer = getNoiseBuffer(ctx, noiseType === 'pink' ? 'pink' : 'white', 2);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = cutoff;
        filter.Q.value = Q;

        const gain = ctx.createGain();
        gain.gain.value = 0;

        source.connect(filter);
        filter.connect(gain);

        return {
            source,
            filter,
            gain,
            // Random offset decorrelates zones sharing the same buffer
            start: () => source.start(0, Math.random() * buffer.duration),
            stop: () => source.stop(),
            connect: (dest) => gain.connect(dest)
        };
    }

    // ============================================
    // BURST GENERATORS (Thunder, Clicks, Cracks)
    // ============================================

    /**
     * Create noise burst for thunder/impact sounds
     * @param {AudioContext} ctx
     * @param {AudioNode} destination
     * @param {number} freq - center frequency of resonance
     * @param {number} duration - burst duration in seconds
     * @param {number} decay - envelope decay time
     */
    function createNoiseBurst(ctx, destination, freq = 100, duration = 0.5, decay = 2) {
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = buffer.getChannelData(0);

        // Create burst with exponential decay
        for (let i = 0; i < bufferSize; i++) {
            const t = i / ctx.sampleRate;
            const envelope = Math.exp(-t * decay);
            output[i] = (Math.random() * 2 - 1) * envelope;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = freq;
        filter.Q.value = 1;

        const gain = ctx.createGain();
        gain.gain.value = 0.5;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(destination);

        source.start();
        source.onended = () => {
            source.disconnect();
            filter.disconnect();
            gain.disconnect();
        };

        return source;
    }

    /**
     * Create short click/drip sound
     */
    function createClick(ctx, destination, freq = 1000, duration = 0.02, gain = 0.3) {
        const osc = ctx.createOscillator();
        const clickGain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.value = freq;

        filter.type = 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = 10;

        const now = ctx.currentTime;
        clickGain.gain.setValueAtTime(0, now);
        clickGain.gain.linearRampToValueAtTime(gain, now + 0.001);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(filter);
        filter.connect(clickGain);
        clickGain.connect(destination);

        osc.start(now);
        osc.stop(now + duration + 0.01);

        return osc;
    }

    // ============================================
    // SCHEDULED EVENTS
    // ============================================

    /**
     * Generic random-interval scheduler
     * @param {number} minInterval - minimum time between events (seconds)
     * @param {number} maxInterval - maximum time between events (seconds)
     * @param {Function} fn - called on each event
     */
    function createScheduler(minInterval, maxInterval, fn, opts = {}) {
        let timeoutId = null;
        let running = false;
        let rate = 1;  // density scalar: >1 = more frequent (stress), <1 = sparser
        const restChance = opts.restChance || 0;
        const restMin = opts.restMin || 30;
        const restMax = opts.restMax || 60;

        function scheduleNext() {
            if (!running) return;
            // Authored series beat dice: pass opts.intervalSeries
            // (a createSeries of 0-1 values) for composed timing
            const u = opts.intervalSeries ? opts.intervalSeries.next() : Math.random();
            let interval = ((minInterval + u * (maxInterval - minInterval)) /
                Math.max(0.1, rate)) * 1000;
            // Occasional long rest: long-form listening needs
            // genuine gaps, not constant activity
            if (restChance > 0 && Math.random() < restChance) {
                interval += (restMin + Math.random() * (restMax - restMin)) * 1000;
            }
            timeoutId = setTimeout(() => {
                if (!running) return;
                fn();
                scheduleNext();
            }, interval);
        }

        return {
            start: () => {
                running = true;
                scheduleNext();
            },
            stop: () => {
                running = false;
                if (timeoutId) clearTimeout(timeoutId);
            },
            isRunning: () => running,
            setRate: (r) => { rate = r; }
        };
    }

    // ============================================
    // HARMONIC ECOLOGY
    // The house is tuned to its own infrastructure: the tonal
    // center is 50Hz - the electrical mains hum. Each zone owns a
    // chord of just-intonation ratios over it; pitched events snap
    // to the nearest chord tone, so crossing zones is a harmonic
    // modulation, not just a mix change.
    // ============================================

    const TONIC = 50;  // Hz - the mains hum is the tonic

    function buildChordTable(ratios, minFreq = 30, maxFreq = 8000) {
        const table = [];
        for (let oct = 0; oct < 9; oct++) {
            const base = TONIC * Math.pow(2, oct);
            ratios.forEach(r => {
                const f = base * r;
                if (f >= minFreq && f <= maxFreq) table.push(f);
            });
        }
        return table.sort((a, b) => a - b);
    }

    function snapFreq(freq, table) {
        if (!table || !table.length) return freq;
        let best = table[0];
        let bestDiff = Infinity;
        for (let i = 0; i < table.length; i++) {
            const d = Math.abs(Math.log(table[i] / freq));
            if (d < bestDiff) { bestDiff = d; best = table[i]; }
        }
        return best;
    }

    /**
     * Schedule recurring drips/clicks at random intervals
     */
    function scheduleDrips(ctx, destination, minInterval, maxInterval, freqMin = 800, freqMax = 1200, gain = 0.15) {
        return createScheduler(minInterval, maxInterval, () => {
            const freq = freqMin + Math.random() * (freqMax - freqMin);
            createClick(ctx, destination, freq, 0.03 + Math.random() * 0.02, gain);
        });
    }

    /**
     * Schedule bursts at random intervals (for thunder, cracks)
     */
    function scheduleBursts(ctx, destination, minInterval, maxInterval, freqMin, freqMax, duration, decay, gain = 0.4) {
        return createScheduler(minInterval, maxInterval, () => {
            const freq = freqMin + Math.random() * (freqMax - freqMin);
            createNoiseBurst(ctx, destination, freq, duration, decay);
        });
    }

    /**
     * Thunder: a bright initial crack decaying into a long low
     * rumble whose amplitude undulates (the "rolling" character
     * of real thunder), swept dark by a falling lowpass
     */
    function createThunder(ctx, destination, gain = 0.5) {
        const dur = 2.5 + Math.random() * 1.5;
        const rate = ctx.sampleRate;
        const len = Math.floor(rate * dur);
        const buffer = ctx.createBuffer(1, len, rate);
        const data = buffer.getChannelData(0);
        const undulationStep = Math.floor(rate * 0.05);

        let undulation = 0.6;
        for (let i = 0; i < len; i++) {
            const t = i / rate;
            // Slow random walk gives the rolling, uneven decay
            if (i % undulationStep === 0) {
                undulation = Math.max(0.15, Math.min(1, undulation + (Math.random() - 0.5) * 0.4));
            }
            const crack = t < 0.08 ? Math.exp(-t * 40) * 0.9 : 0;
            const rumble = Math.exp(-t * 1.1) * undulation;
            data[i] = (Math.random() * 2 - 1) * (crack + rumble);
        }

        const src = ctx.createBufferSource();
        src.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900 + Math.random() * 600, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.5);
        filter.Q.value = 0.7;

        const g = ctx.createGain();
        g.gain.value = gain;

        src.connect(filter);
        filter.connect(g);
        g.connect(destination);

        src.start();
        src.onended = () => {
            try { src.disconnect(); } catch(e) {}
            try { filter.disconnect(); } catch(e) {}
            try { g.disconnect(); } catch(e) {}
        };

        return src;
    }

    /**
     * Rain patter: individual raindrops hitting the glass, each a
     * tiny damped tick at a random spot across the window. Layered
     * over the noise wash it turns "shhh" into audible rain.
     */
    function createRainPatter(ctx, destination, dropsPerSec = 8, gain = 0.05) {
        let running = false;
        let timeout = null;
        const canPan = !!ctx.createStereoPanner;

        function drop() {
            if (!running) return;

            const freq = 2500 + Math.random() * 3500;
            const dur = 0.008 + Math.random() * 0.012;
            const now = ctx.currentTime;

            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(gain * (0.3 + Math.random() * 0.7), now + 0.001);
            g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
            osc.connect(g);

            let out = g;
            let panner = null;
            if (canPan) {
                panner = ctx.createStereoPanner();
                panner.pan.value = (Math.random() * 2 - 1) * 0.8;
                g.connect(panner);
                out = panner;
            }
            out.connect(destination);

            osc.start(now);
            osc.stop(now + dur + 0.02);
            if (panner) {
                const p = panner;
                setTimeout(() => { try { p.disconnect(); } catch(e) {} }, (dur + 0.2) * 1000);
            }

            timeout = setTimeout(drop, (1000 / dropsPerSec) * (0.3 + Math.random() * 1.4));
        }

        return {
            start: () => { running = true; drop(); },
            stop: () => {
                running = false;
                if (timeout) clearTimeout(timeout);
            }
        };
    }

    // ============================================
    // AM SYNTHESIS (Cicadas, Insects)
    // ============================================

    /**
     * Create AM synthesis for insect sounds
     * @param {AudioContext} ctx
     * @param {number} carrierFreq - carrier frequency (4000-10000 for cicadas)
     * @param {number} modFreq - modulation frequency (8-20 for insect pulses)
     * @param {number} modDepth - modulation depth (0-1)
     */
    function createAMSynth(ctx, carrierFreq, modFreq, modDepth = 0.8) {
        const carrier = ctx.createOscillator();
        const modulator = ctx.createOscillator();
        const modulatorGain = ctx.createGain();
        const outputGain = ctx.createGain();

        carrier.type = 'sawtooth';
        carrier.frequency.value = carrierFreq;

        modulator.type = 'sine';
        modulator.frequency.value = modFreq;

        modulatorGain.gain.value = modDepth;
        outputGain.gain.value = 0;

        // AM: modulator controls carrier amplitude
        modulator.connect(modulatorGain);
        modulatorGain.connect(outputGain.gain);
        carrier.connect(outputGain);

        return {
            carrier,
            modulator,
            gain: outputGain,
            start: () => {
                carrier.start();
                modulator.start();
            },
            stop: () => {
                carrier.stop();
                modulator.stop();
            },
            connect: (dest) => outputGain.connect(dest),
            setCarrierFreq: (freq) => carrier.frequency.setTargetAtTime(freq, ctx.currentTime, 0.5),
            setModFreq: (freq) => modulator.frequency.setTargetAtTime(freq, ctx.currentTime, 0.5)
        };
    }

    /**
     * Create multiple AM synths for cicada chorus
     */
    function createInsectChorus(ctx, count = 8, freqMin = 4000, freqMax = 8000) {
        const insects = [];
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;

        for (let i = 0; i < count; i++) {
            const carrierFreq = freqMin + Math.random() * (freqMax - freqMin);
            const modFreq = 8 + Math.random() * 12;
            const insect = createAMSynth(ctx, carrierFreq, modFreq, 0.7);
            insect.gain.gain.value = 0.03;
            insect.connect(masterGain);
            insects.push(insect);
        }

        // Add slow drift to parameters
        let driftInterval = null;

        return {
            insects,
            gain: masterGain,
            start: () => {
                insects.forEach(i => i.start());
                // Drift parameters slowly
                driftInterval = setInterval(() => {
                    insects.forEach(insect => {
                        insect.setCarrierFreq(freqMin + Math.random() * (freqMax - freqMin));
                        insect.setModFreq(8 + Math.random() * 12);
                    });
                }, 5000 + Math.random() * 5000);
            },
            stop: () => {
                insects.forEach(i => {
                    try { i.stop(); } catch(e) {}
                });
                if (driftInterval) clearInterval(driftInterval);
            },
            connect: (dest) => masterGain.connect(dest)
        };
    }

    // ============================================
    // DRONES
    // ============================================

    /**
     * Create subtle drone
     * @param {AudioContext} ctx
     * @param {number} freq - base frequency
     * @param {number} gainValue - volume
     */
    function createDrone(ctx, freq, gainValue = 0.1) {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        filter.type = 'lowpass';
        filter.frequency.value = freq * 2;
        filter.Q.value = 0.5;

        gain.gain.value = gainValue;

        osc.connect(filter);
        filter.connect(gain);

        return {
            osc,
            filter,
            gain,
            start: () => osc.start(),
            stop: () => osc.stop(),
            connect: (dest) => gain.connect(dest)
        };
    }

    /**
     * Create room tone with very low frequency content
     */
    function createRoomTone(ctx, baseFreq = 60, gainValue = 0.05) {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc1.type = 'sine';
        osc1.frequency.value = baseFreq;
        osc2.type = 'sine';
        osc2.frequency.value = baseFreq * 2;

        filter.type = 'lowpass';
        filter.frequency.value = 400;
        filter.Q.value = 0.3;

        gain.gain.value = gainValue;

        const mixer = ctx.createGain();
        mixer.gain.value = 1;

        osc1.connect(mixer);
        osc2.connect(mixer);
        mixer.connect(filter);
        filter.connect(gain);

        return {
            gain,
            start: () => {
                osc1.start();
                osc2.start();
            },
            stop: () => {
                osc1.stop();
                osc2.stop();
            },
            connect: (dest) => gain.connect(dest)
        };
    }

    // ============================================
    // WIND / MODULATED NOISE
    // ============================================

    /**
     * Create wind with LFO modulation on gain
     */
    function createWind(ctx, filterFreq = 400, lfoRate = 0.1, lfoDepth = 0.3, q = 0.3) {
        const noiseBuffer = getNoiseBuffer(ctx, 'white', 4);
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = filterFreq;
        filter.Q.value = q;  // high Q = wind forcing a window frame, not open field

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = lfoRate;
        lfoGain.gain.value = lfoDepth;

        const outputGain = ctx.createGain();
        outputGain.gain.value = 0.3;

        // LFO modulates output gain
        lfo.connect(lfoGain);
        lfoGain.connect(outputGain.gain);

        noise.connect(filter);
        filter.connect(outputGain);

        return {
            noise,
            filter,
            lfo,
            gain: outputGain,
            start: () => {
                noise.start(0, Math.random() * noiseBuffer.duration);
                lfo.start();
            },
            stop: () => {
                noise.stop();
                lfo.stop();
            },
            connect: (dest) => outputGain.connect(dest)
        };
    }

    // ============================================
    // REVERB
    // ============================================

    /**
     * Create impulse response for reverb
     */
    function createReverbImpulse(ctx, duration = 3, decay = 2) {
        const sampleRate = ctx.sampleRate;
        const length = sampleRate * duration;
        const impulse = ctx.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            const env = Math.pow(1 - t / duration, decay);
            left[i] = (Math.random() * 2 - 1) * env;
            right[i] = (Math.random() * 2 - 1) * env;
        }

        return impulse;
    }

    /**
     * Create convolver reverb
     */
    function createReverb(ctx, duration = 3, decay = 2) {
        const convolver = ctx.createConvolver();
        convolver.buffer = createReverbImpulse(ctx, duration, decay);

        const gain = ctx.createGain();
        gain.gain.value = 0.3;

        convolver.connect(gain);

        return {
            convolver,
            gain,
            input: convolver,
            connect: (dest) => gain.connect(dest)
        };
    }

    /**
     * Zone reverb profiles
     * Each zone has its own acoustic character
     */
    const ZONE_REVERB_PROFILES = {
        storm: {
            duration: 0.3,    // Short - room with window
            decay: 4,
            wetDry: 0.15,
            preDelay: 0.005,
            filterFreq: 4000   // Bright
        },
        heat: {
            duration: 0.6,    // Medium - closed apartment
            decay: 2.5,
            wetDry: 0.2,
            preDelay: 0.01,
            filterFreq: 2500   // Warmer
        },
        flood: {
            duration: 1.2,    // Long - basement/garage
            decay: 1.5,
            wetDry: 0.35,
            preDelay: 0.02,
            filterFreq: 1800   // Metallic character
        },
        drought: {
            duration: 1.5,    // Very long - empty space
            decay: 1.2,
            wetDry: 0.25,
            preDelay: 0.025,
            filterFreq: 6000   // Diffuse, airy
        },
        refuge: {
            duration: 0.4,    // Short - comfortable living room
            decay: 3,
            wetDry: 0.12,
            preDelay: 0.008,
            filterFreq: 3000   // Warm, cozy
        }
    };

    /**
     * Create zone-specific reverb with unique character
     */
    function createZoneReverb(ctx, zoneName) {
        const profile = ZONE_REVERB_PROFILES[zoneName] || ZONE_REVERB_PROFILES.refuge;

        // Pre-delay
        const preDelay = ctx.createDelay(0.1);
        preDelay.delayTime.value = profile.preDelay;

        // Convolver
        const convolver = ctx.createConvolver();
        convolver.buffer = createReverbImpulse(ctx, profile.duration, profile.decay);

        // High cut filter for character
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = profile.filterFreq;
        filter.Q.value = 0.5;

        // Wet/dry mix
        const wet = ctx.createGain();
        wet.gain.value = profile.wetDry;
        const dry = ctx.createGain();
        dry.gain.value = 1 - profile.wetDry;

        // Input splitter
        const input = ctx.createGain();

        // Connect wet path: input → preDelay → convolver → filter → wet
        input.connect(preDelay);
        preDelay.connect(convolver);
        convolver.connect(filter);
        filter.connect(wet);

        // Connect dry path: input → dry
        input.connect(dry);

        // Output mixer
        const output = ctx.createGain();
        wet.connect(output);
        dry.connect(output);

        return {
            input: input,
            output: output,
            wet: wet,
            dry: dry,
            connect: (dest) => output.connect(dest),
            setWetDry: (amount) => {
                wet.gain.setTargetAtTime(amount, ctx.currentTime, 0.1);
                dry.gain.setTargetAtTime(1 - amount, ctx.currentTime, 0.1);
            }
        };
    }

    // ============================================
    // DOMESTIC SOUNDS
    // ============================================

    /**
     * Create appliance cycling sound (fridge, pump)
     * Turns on and off at intervals
     */
    function createApplianceCycle(ctx, baseFreq = 100, onTime = 30, offTime = 60) {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const noise = ctx.createBufferSource();
        noise.buffer = getNoiseBuffer(ctx, 'pink', 2);
        noise.loop = true;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = baseFreq * 2;
        noiseFilter.Q.value = 2;

        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0.02;

        osc.type = 'sine';
        osc.frequency.value = baseFreq;
        osc2.type = 'sine';
        osc2.frequency.value = baseFreq * 2.02; // Slight detune for richness

        const mixer = ctx.createGain();
        mixer.gain.value = 0.5;

        const outputGain = ctx.createGain();
        outputGain.gain.value = 0;

        osc.connect(mixer);
        osc2.connect(mixer);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(mixer);
        mixer.connect(outputGain);

        let cycleTimeout = null;
        let isOn = false;
        let isRunning = false;
        let stress = 0;  // 0-1: strained appliances short-cycle

        function cycle() {
            if (!isRunning) return;

            if (isOn) {
                // Turn off with fade
                outputGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
                isOn = false;
                const nextOff = (offTime * 0.5 + Math.random() * offTime) * 1000 / (1 + stress);
                cycleTimeout = setTimeout(cycle, nextOff);
            } else {
                // Turn on with fade
                outputGain.gain.setTargetAtTime(0.08, ctx.currentTime, 0.3);
                isOn = true;
                const nextOn = (onTime * 0.8 + Math.random() * onTime * 0.4) * 1000 / (1 + stress * 1.5);
                cycleTimeout = setTimeout(cycle, nextOn);
            }
        }

        return {
            gain: outputGain,
            start: () => {
                osc.start();
                osc2.start();
                noise.start(0, Math.random() * 2);
                isRunning = true;
                // Start in off state, turn on after random delay
                cycleTimeout = setTimeout(cycle, Math.random() * 5000);
            },
            stop: () => {
                isRunning = false;
                if (cycleTimeout) clearTimeout(cycleTimeout);
                try { osc.stop(); } catch(e) {}
                try { osc2.stop(); } catch(e) {}
                try { noise.stop(); } catch(e) {}
            },
            connect: (dest) => outputGain.connect(dest),
            // Stress: shorter cycles (working harder for less) and
            // a slight sag in pitch, as under brownout
            setStress: (s) => {
                stress = s;
                osc.frequency.setTargetAtTime(baseFreq * (1 - 0.02 * s), ctx.currentTime, 2);
                osc2.frequency.setTargetAtTime(baseFreq * 2.02 * (1 - 0.02 * s), ctx.currentTime, 2);
            }
        };
    }

    /**
     * Drip acoustic profiles per surface type
     */
    const DRIP_PROFILES = {
        metal: { reverbTime: 0.3, wet: 0.4, freqBase: 1200, freqRange: 400, duration: 0.08, Q: 15 },
        tile:  { reverbTime: 0.5, wet: 0.2, freqBase: 800,  freqRange: 300, duration: 0.05, Q: 8 },
        room:  { reverbTime: 0.2, wet: 0.2, freqBase: 800,  freqRange: 300, duration: 0.05, Q: 8 }
    };

    // Impulse responses are expensive to generate - cache one per drip type
    const dripImpulseCache = {};

    function getDripImpulse(ctx, type) {
        const profile = DRIP_PROFILES[type] || DRIP_PROFILES.room;
        const key = type + ':' + ctx.sampleRate;
        if (!dripImpulseCache[key]) {
            dripImpulseCache[key] = createReverbImpulse(ctx, profile.reverbTime, 3);
        }
        return dripImpulseCache[key];
    }

    /**
     * Fire a single drip into pre-built dry/wet destinations
     */
    function triggerDrip(ctx, dryDest, wetDest, type, gain, table, pitchSeries) {
        const profile = DRIP_PROFILES[type] || DRIP_PROFILES.room;
        const u = pitchSeries ? pitchSeries.next() : Math.random();
        const freq = snapFreq(profile.freqBase + u * profile.freqRange, table);
        const duration = profile.duration;

        const osc = ctx.createOscillator();
        const dripGain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        // Pitch drops slightly (water drop characteristic)
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.7, ctx.currentTime + duration);

        filter.type = 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = profile.Q;

        const now = ctx.currentTime;
        dripGain.gain.setValueAtTime(0, now);
        dripGain.gain.linearRampToValueAtTime(gain, now + 0.002);
        dripGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(filter);
        filter.connect(dripGain);
        dripGain.connect(dryDest);
        if (wetDest) dripGain.connect(wetDest);

        osc.start(now);
        osc.stop(now + duration + 0.05);

        return osc;
    }

    /**
     * Create drip with specific reverb character (one-off)
     * @param {string} type - 'metal' (bucket), 'tile' (bathroom), 'room' (general)
     */
    function createDripWithReverb(ctx, destination, type = 'room', gain = 0.15, table = null) {
        const profile = DRIP_PROFILES[type] || DRIP_PROFILES.room;

        const reverb = ctx.createConvolver();
        reverb.buffer = getDripImpulse(ctx, type);

        const reverbGain = ctx.createGain();
        reverbGain.gain.value = profile.wet;

        const dry = ctx.createGain();
        dry.gain.value = 0.7;

        reverb.connect(reverbGain);
        reverbGain.connect(destination);
        dry.connect(destination);

        const osc = triggerDrip(ctx, dry, reverb, type, gain, table);

        // Detach the one-off reverb chain once the tail has rung out
        setTimeout(() => {
            try { reverb.disconnect(); } catch(e) {}
            try { reverbGain.disconnect(); } catch(e) {}
            try { dry.disconnect(); } catch(e) {}
        }, (profile.duration + profile.reverbTime + 0.3) * 1000);

        return osc;
    }

    /**
     * Schedule drips sharing one persistent reverb chain
     * (avoids building a ConvolverNode per drip)
     */
    function scheduleDripsWithReverb(ctx, destination, minInterval, maxInterval, type = 'room', gain = 0.15, opts = {}) {
        const profile = DRIP_PROFILES[type] || DRIP_PROFILES.room;

        const reverb = ctx.createConvolver();
        reverb.buffer = getDripImpulse(ctx, type);

        const reverbGain = ctx.createGain();
        reverbGain.gain.value = profile.wet;

        const dry = ctx.createGain();
        dry.gain.value = 0.7;

        reverb.connect(reverbGain);
        reverbGain.connect(destination);
        dry.connect(destination);

        const scheduler = createScheduler(minInterval, maxInterval, () => {
            triggerDrip(ctx, dry, reverb, type, gain, opts.table, opts.pitchSeries);
        }, opts);

        return {
            start: scheduler.start,
            setRate: scheduler.setRate,
            stop: () => {
                scheduler.stop();
                try { reverb.disconnect(); } catch(e) {}
                try { reverbGain.disconnect(); } catch(e) {}
                try { dry.disconnect(); } catch(e) {}
            }
        };
    }

    /**
     * Create mechanical hum (fan, motor)
     * Low frequency with slight wobble
     */
    function createMechanicalHum(ctx, freq = 40, wobbleRate = 0.5, wobbleDepth = 2) {
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        const outputGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        // Subtle frequency wobble (motor irregularity)
        lfo.type = 'sine';
        lfo.frequency.value = wobbleRate;
        lfoGain.gain.value = wobbleDepth;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        filter.type = 'lowpass';
        filter.frequency.value = freq * 3;
        filter.Q.value = 1;

        outputGain.gain.value = 0;

        osc.connect(filter);
        filter.connect(outputGain);

        return {
            gain: outputGain,
            start: () => {
                osc.start();
                lfo.start();
            },
            stop: () => {
                try { osc.stop(); } catch(e) {}
                try { lfo.stop(); } catch(e) {}
            },
            connect: (dest) => outputGain.connect(dest),
            // Strain: the motor wobbles harder and sags flat -
            // familiar machinery going subtly wrong under load
            setStrain: (s) => {
                lfoGain.gain.setTargetAtTime(wobbleDepth * (1 + s * 3), ctx.currentTime, 0.5);
                osc.frequency.setTargetAtTime(freq * (1 - 0.035 * s), ctx.currentTime, 1.5);
            }
        };
    }

    /**
     * Create glass vibration effect (window rattling from thunder)
     * Triggered effect, not continuous
     */
    function createGlassVibration(ctx, destination, intensity = 0.1, duration = 2) {
        const noise = ctx.createBufferSource();
        noise.buffer = createWhiteNoiseBuffer(ctx, duration);

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 300 + Math.random() * 200;
        filter.Q.value = 10;

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 8 + Math.random() * 4; // Rattling frequency
        lfoGain.gain.value = intensity;

        const outputGain = ctx.createGain();
        outputGain.gain.value = 0;

        // Envelope
        const now = ctx.currentTime;
        outputGain.gain.setValueAtTime(0, now);
        outputGain.gain.linearRampToValueAtTime(intensity, now + 0.05);
        outputGain.gain.setValueAtTime(intensity, now + duration * 0.3);
        outputGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        lfo.connect(lfoGain);
        lfoGain.connect(outputGain.gain);
        noise.connect(filter);
        filter.connect(outputGain);
        outputGain.connect(destination);

        noise.start();
        lfo.start();
        noise.stop(ctx.currentTime + duration + 0.1);
        lfo.stop(ctx.currentTime + duration + 0.1);
    }

    /**
     * Create wood/material creak sound
     * @param {number|null} pan - fixed stereo position, or null for center
     */
    function createCreak(ctx, destination, gain = 0.1, pan = null, table = null) {
        const duration = 0.1 + Math.random() * 0.15;
        const freq = snapFreq(150 + Math.random() * 200, table);

        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const creakGain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        // Frequency bend (creak characteristic)
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * (0.8 + Math.random() * 0.4), ctx.currentTime + duration);

        filter.type = 'bandpass';
        filter.frequency.value = freq * 1.5;
        filter.Q.value = 5;

        const now = ctx.currentTime;
        creakGain.gain.setValueAtTime(0, now);
        creakGain.gain.linearRampToValueAtTime(gain, now + 0.01);
        creakGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(filter);
        filter.connect(creakGain);

        let out = destination;
        if (pan !== null && ctx.createStereoPanner) {
            const panner = ctx.createStereoPanner();
            panner.pan.value = pan;
            panner.connect(destination);
            creakGain.connect(panner);
            setTimeout(() => { try { panner.disconnect(); } catch(e) {} }, (duration + 0.3) * 1000);
        } else {
            creakGain.connect(out);
        }

        osc.start(now);
        osc.stop(now + duration + 0.05);

        return osc;
    }

    /**
     * Schedule creaks at random intervals
     * @param {number} panSpread - each creak comes from a different
     *   random spot within ±panSpread (the house settles all around you)
     */
    function scheduleCreaks(ctx, destination, minInterval, maxInterval, gain = 0.1, panSpread = 0) {
        return createScheduler(minInterval, maxInterval, () => {
            const pan = panSpread > 0 ? (Math.random() * 2 - 1) * panSpread : null;
            createCreak(ctx, destination, gain, pan);
        });
    }

    /**
     * Create distant filtered cicadas (heard through closed window)
     */
    function createFilteredCicadas(ctx, count = 4) {
        const insects = [];
        const masterGain = ctx.createGain();
        const windowFilter = ctx.createBiquadFilter();

        // Window glass filters out high frequencies
        windowFilter.type = 'lowpass';
        windowFilter.frequency.value = 2000;
        windowFilter.Q.value = 0.5;

        masterGain.gain.value = 0;

        for (let i = 0; i < count; i++) {
            const carrierFreq = 3000 + Math.random() * 2000;
            const modFreq = 10 + Math.random() * 8;
            const insect = createAMSynth(ctx, carrierFreq, modFreq, 0.6);
            insect.gain.gain.value = 0.02;
            insect.connect(windowFilter);
            insects.push(insect);
        }

        windowFilter.connect(masterGain);

        let driftInterval = null;

        return {
            insects,
            gain: masterGain,
            start: () => {
                insects.forEach(i => i.start());
                driftInterval = setInterval(() => {
                    insects.forEach(insect => {
                        insect.setCarrierFreq(3000 + Math.random() * 2000);
                        insect.setModFreq(10 + Math.random() * 8);
                    });
                }, 4000 + Math.random() * 4000);
            },
            stop: () => {
                insects.forEach(i => {
                    try { i.stop(); } catch(e) {}
                });
                if (driftInterval) clearInterval(driftInterval);
            },
            connect: (dest) => masterGain.connect(dest)
        };
    }

    // ============================================
    // AUTHORED SERIES (Mini Metro serialism)
    // Hand-written cycles replace raw randomness: unpredictable in
    // the small, composer-shaped in the large. Give independent
    // series coprime lengths so they phase against each other.
    // ============================================

    function createSeries(values) {
        let i = 0;
        return { next: () => values[i++ % values.length] };
    }

    // ============================================
    // MAINTENANCE & INTRUDERS
    // The sounds of a person coping (evidence of adaptation, not
    // disaster), and - rarely - the outside world intruding.
    // All scheduled on the audio clock; cleanup rides onended.
    // ============================================

    function noiseShot(ctx, dest, o) {
        const src = ctx.createBufferSource();
        src.buffer = getNoiseBuffer(ctx, o.noise || 'pink', 2);
        const f = ctx.createBiquadFilter();
        f.type = o.type || 'bandpass';
        f.frequency.value = o.freq || 800;
        f.Q.value = o.q || 1;
        const g = ctx.createGain();
        const t = o.when !== undefined ? o.when : ctx.currentTime;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(o.peak || 0.05, t + (o.attack || 0.02));
        g.gain.exponentialRampToValueAtTime(0.0001, t + (o.attack || 0.02) + (o.decay || 0.5));
        if (o.freqTo) {
            f.frequency.setValueAtTime(o.freq, t);
            f.frequency.linearRampToValueAtTime(o.freqTo, t + (o.attack || 0.02) + (o.decay || 0.5));
        }
        src.connect(f);
        f.connect(g);
        g.connect(dest);
        src.start(t, Math.random() * 1.5);
        src.stop(t + (o.attack || 0.02) + (o.decay || 0.5) + 0.1);
        src.onended = () => {
            try { f.disconnect(); g.disconnect(); } catch(e) {}
        };
        return src;
    }

    // A quiet human exhale - someone lives here
    function createSigh(ctx, dest, gain = 0.02) {
        noiseShot(ctx, dest, { freq: 900, freqTo: 450, q: 0.7, peak: gain, attack: 0.3, decay: 1.1 });
    }

    // Tape smoothed onto a window frame - a half-theatrical defense
    function createTapeSmooth(ctx, dest, gain = 0.03) {
        noiseShot(ctx, dest, { type: 'highpass', freq: 1800, freqTo: 3800, peak: gain, attack: 0.12, decay: 0.35 });
    }

    // A page turned
    function createPageTurn(ctx, dest, gain = 0.02) {
        noiseShot(ctx, dest, { type: 'highpass', freq: 1500, peak: gain, attack: 0.03, decay: 0.22 });
    }

    // The bucket, emptied: slosh, set-down clunk, one last drip.
    // The single most maintenance sound in the house.
    function createBucketEmpty(ctx, dest, gain = 0.06) {
        const now = ctx.currentTime;
        noiseShot(ctx, dest, { freq: 420, freqTo: 700, q: 1.3, peak: gain, attack: 0.18, decay: 0.7 });
        noiseShot(ctx, dest, { type: 'lowpass', freq: 160, peak: gain * 1.2, attack: 0.005, decay: 0.25, when: now + 1.05 });
        createClick(ctx, dest, 900, 0.04, gain * 0.5);
    }

    // Water poured from a stored jug - the pitch of a filling
    // vessel rises; scarcity has a duration discipline
    function createPour(ctx, dest, gain = 0.035) {
        noiseShot(ctx, dest, { freq: 650, freqTo: 1300, q: 2.2, peak: gain, attack: 0.25, decay: 1.1 });
    }

    // A kettle put on: slow rise, accelerating bubble, switch-off
    function createKettle(ctx, dest, gain = 0.02) {
        const now = ctx.currentTime;
        const dur = 16;
        noiseShot(ctx, dest, { type: 'lowpass', freq: 300, freqTo: 1500, peak: gain, attack: dur * 0.7, decay: dur * 0.3 });
        let t = now + 3;
        let step = 1.1;
        while (t < now + dur - 1) {
            createClick(ctx, dest, 350 + Math.random() * 450, 0.03, gain * (0.4 + Math.random() * 0.5));
            t += step;
            step = Math.max(0.18, step * 0.86);  // bubbling accelerates
        }
        // the switch clicks off
        const off = ctx.createOscillator();
        const og = ctx.createGain();
        off.type = 'square';
        off.frequency.value = 1400;
        og.gain.setValueAtTime(0, now + dur);
        og.gain.linearRampToValueAtTime(gain, now + dur + 0.004);
        og.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.05);
        off.connect(og);
        og.connect(dest);
        off.start(now + dur);
        off.stop(now + dur + 0.08);
    }

    // A distant siren, through the wall and the rain
    function createSiren(ctx, dest, gain = 0.03) {
        const now = ctx.currentTime;
        const dur = 14;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = 600;
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 0.16;
        lg.gain.value = 28;
        lfo.connect(lg);
        lg.connect(o.frequency);
        const wall = ctx.createBiquadFilter();
        wall.type = 'lowpass';
        wall.frequency.value = 850;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(gain, now + dur * 0.4);
        g.gain.linearRampToValueAtTime(0.0001, now + dur);
        o.connect(wall);
        wall.connect(g);
        g.connect(dest);
        o.start(now);
        lfo.start(now);
        o.stop(now + dur);
        lfo.stop(now + dur);
        o.onended = () => { try { wall.disconnect(); g.disconnect(); lg.disconnect(); } catch(e) {} };
    }

    // A neighbor's generator: sputters, catches, runs, recedes
    function createGenerator(ctx, dest, gain = 0.03) {
        const now = ctx.currentTime;
        // sputter: decelerating gaps closing into a firing rate
        let t = now;
        let gap = 0.4;
        for (let i = 0; i < 9; i++) {
            noiseShot(ctx, dest, { type: 'lowpass', freq: 180, peak: gain * 0.9, attack: 0.004, decay: 0.09, when: t });
            t += gap;
            gap = Math.max(0.07, gap * 0.72);
        }
        // steady running: hum at 66.7Hz (a just fourth over the mains)
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 66.7;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 220;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain, t + 1.2);
        g.gain.setValueAtTime(gain, t + 9);
        g.gain.linearRampToValueAtTime(0.0001, t + 14);
        o.connect(lp);
        lp.connect(g);
        g.connect(dest);
        o.start(t);
        o.stop(t + 14.2);
        o.onended = () => { try { lp.disconnect(); g.disconnect(); } catch(e) {} };
    }

    // An emergency alert buzzing on a phone in another room
    function createAlertBuzz(ctx, dest, gain = 0.035) {
        const now = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = 470;
        const am = ctx.createOscillator();
        const amG = ctx.createGain();
        am.type = 'square';
        am.frequency.value = 26;
        amG.gain.value = 0.5;
        am.connect(amG);
        const phone = ctx.createBiquadFilter();
        phone.type = 'bandpass';
        phone.frequency.value = 1300;
        phone.Q.value = 2;
        const g = ctx.createGain();
        g.gain.value = 0;
        amG.connect(g.gain);
        // three buzzes, the standard alert pattern
        for (let i = 0; i < 3; i++) {
            const t = now + i * 0.85;
            g.gain.setValueAtTime(gain, t);
            g.gain.setValueAtTime(0, t + 0.55);
        }
        o.connect(phone);
        phone.connect(g);
        g.connect(dest);
        o.start(now);
        am.start(now);
        o.stop(now + 2.6);
        am.stop(now + 2.6);
        o.onended = () => { try { phone.disconnect(); g.disconnect(); amG.disconnect(); } catch(e) {} };
    }

    // A helicopter passing, far off - surveillance weather
    function createHelicopter(ctx, dest, gain = 0.04) {
        const now = ctx.currentTime;
        const dur = 13;
        const src = ctx.createBufferSource();
        src.buffer = getNoiseBuffer(ctx, 'pink', 2);
        src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 260;
        const rotor = ctx.createOscillator();
        const rG = ctx.createGain();
        rotor.type = 'sine';
        rotor.frequency.setValueAtTime(12, now);
        rotor.frequency.linearRampToValueAtTime(15, now + dur * 0.5);  // approach
        rotor.frequency.linearRampToValueAtTime(11, now + dur);        // recede
        rG.gain.value = 0.5;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(gain, now + dur * 0.45);
        g.gain.linearRampToValueAtTime(0.0001, now + dur);
        rotor.connect(rG);
        rG.connect(g.gain);
        src.connect(lp);
        lp.connect(g);
        g.connect(dest);
        src.start(now, Math.random());
        rotor.start(now);
        src.stop(now + dur);
        rotor.stop(now + dur);
        src.onended = () => { try { lp.disconnect(); g.disconnect(); rG.disconnect(); } catch(e) {} };
    }

    // ============================================
    // MEMORY SOUNDS
    // At most one per zone, already nostalgic: the ordinary past
    // haunting the ordinary future. This is where the grief lives.
    // ============================================

    // An ice-cream van, streets away, in the heat - the jingle
    // slightly flat, worn like the memory itself
    function createIceCreamVan(ctx, dest, gain = 0.02) {
        const now = ctx.currentTime;
        const jingle = [400, 500, 600, 500, 400, 300, 400];  // authored, on the heat chord
        const wall = ctx.createBiquadFilter();
        wall.type = 'lowpass';
        wall.frequency.value = 1500;
        const g = ctx.createGain();
        const dur = jingle.length * 0.45 + 4;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(gain, now + dur * 0.35);   // the van approaches
        g.gain.linearRampToValueAtTime(0.0001, now + dur);        // and passes
        wall.connect(g);
        g.connect(dest);

        const vib = ctx.createOscillator();
        const vibG = ctx.createGain();
        vib.type = 'sine';
        vib.frequency.value = 5.2;
        vibG.gain.value = 4;
        vib.connect(vibG);
        vib.start(now);
        vib.stop(now + dur);

        let lastOsc = null;
        jingle.forEach((f, i) => {
            const t = now + 0.8 + i * 0.45;
            const o = ctx.createOscillator();
            const og = ctx.createGain();
            o.type = 'triangle';
            o.frequency.value = f * 0.985;  // a touch flat
            vibG.connect(o.frequency);
            og.gain.setValueAtTime(0, t);
            og.gain.linearRampToValueAtTime(0.8, t + 0.03);
            og.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
            o.connect(og);
            og.connect(wall);
            o.start(t);
            o.stop(t + 0.5);
            lastOsc = o;
        });
        if (lastOsc) {
            lastOsc.onended = () => {
                try { wall.disconnect(); g.disconnect(); vibG.disconnect(); } catch(e) {}
            };
        }
    }

    // Lawn sprinklers ghosting the drought: the tick-tick-tick of
    // water that used to be spent on grass, sweeping past
    function createSprinklers(ctx, dest, gain = 0.02) {
        const now = ctx.currentTime;
        const dur = 9;

        let out = dest;
        let panner = null;
        if (ctx.createStereoPanner) {
            panner = ctx.createStereoPanner();
            panner.pan.setValueAtTime(-0.6, now);
            panner.pan.linearRampToValueAtTime(0.6, now + dur);  // sweeping the lawn
            panner.connect(dest);
            out = panner;
            setTimeout(() => { try { panner.disconnect(); } catch(e) {} }, (dur + 1) * 1000);
        }

        // the fine spray bed
        noiseShot(ctx, out, { type: 'bandpass', freq: 3400, q: 1.5, peak: gain * 0.5, attack: dur * 0.3, decay: dur * 0.7 });

        // the ratchet ticks
        let t = now + 0.3;
        while (t < now + dur - 0.4) {
            noiseShot(ctx, out, {
                type: 'highpass', freq: 5000,
                peak: gain * (0.6 + Math.random() * 0.4),
                attack: 0.003, decay: 0.035, when: t
            });
            t += 0.21 + Math.random() * 0.03;
        }
    }

    // ============================================
    // SCORE MOMENT
    // A rare, pre-composed figure on the zone's chord: slow
    // triangle tones with long envelopes. Exists only for the
    // still listener - reward content that lives nowhere else.
    // ============================================

    function createScoreMoment(ctx, dest, table, gain = 0.035) {
        const t0 = ctx.currentTime + 0.2;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1200;
        lp.Q.value = 0.5;
        const master = ctx.createGain();
        master.gain.value = gain;
        lp.connect(master);
        master.connect(dest);

        const contour = [0, 2, 1, 3, 2, 4, 3];  // authored, not rolled
        const notesTable = table.filter(f => f >= 150 && f <= 700);
        let t = t0;
        let lastOsc = null;
        for (let i = 0; i < contour.length; i++) {
            const f = notesTable[contour[i] % notesTable.length];
            const o = ctx.createOscillator();
            o.type = 'triangle';
            o.frequency.value = f;
            const g = ctx.createGain();
            const a = 1.2 + Math.random() * 0.8;
            const d = 3 + Math.random() * 2;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.5 + Math.random() * 0.3, t + a);
            g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
            o.connect(g);
            g.connect(lp);
            o.start(t);
            o.stop(t + a + d + 0.1);
            lastOsc = o;
            t += 2.2 + Math.random() * 1.6;
        }
        if (lastOsc) {
            lastOsc.onended = () => {
                try { lp.disconnect(); master.disconnect(); } catch(e) {}
            };
        }
    }

    // ============================================
    // THE RADIO
    // The one aperture through which the outside enters the
    // refuge: an occasional news bulletin, fully synthesized,
    // never intelligible - the cadence is the message. Heard
    // through a small tinny speaker, per the lo-fi rule: full
    // fidelity reads as narration and breaks the piece.
    // ============================================

    function createRadio(ctx) {
        // Small-speaker chain: thin, boxy, slightly honky
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 280;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3000;
        lp.Q.value = 0.7;
        const tin = ctx.createBiquadFilter();
        tin.type = 'peaking';
        tin.frequency.value = 1800;
        tin.gain.value = 4;
        tin.Q.value = 1.2;
        const out = ctx.createGain();
        out.gain.value = 1;

        hp.connect(lp);
        lp.connect(tin);
        tin.connect(out);

        let active = false;

        // Two-tone news sting on tonic + fifth
        function chime(when) {
            [TONIC * 8, TONIC * 12].forEach((f, i) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = 'sine';
                o.frequency.value = f;
                const t = when + i * 0.45;
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.5, t + 0.02);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
                o.connect(g);
                g.connect(hp);
                o.start(t);
                o.stop(t + 1);
            });
        }

        function playBulletin(duration = 24) {
            if (active) return false;
            active = true;

            const start = ctx.currentTime + 0.1;
            chime(start);
            const speechStart = start + 1.6;
            const end = speechStart + duration;

            // Speech-shaped babble: pink noise through two wandering
            // formants, gated by syllable and sentence rhythm
            const noise = ctx.createBufferSource();
            noise.buffer = getNoiseBuffer(ctx, 'pink', 2);
            noise.loop = true;
            const f1 = ctx.createBiquadFilter();
            f1.type = 'bandpass';
            f1.Q.value = 6;
            const f2 = ctx.createBiquadFilter();
            f2.type = 'bandpass';
            f2.Q.value = 8;
            const vg = ctx.createGain();
            vg.gain.value = 0;

            noise.connect(f1);
            noise.connect(f2);
            f1.connect(vg);
            f2.connect(vg);
            vg.connect(hp);

            // Schedule the whole bulletin's prosody upfront
            let t = speechStart;
            let sentenceLeft = 4 + Math.floor(Math.random() * 6);
            while (t < end) {
                const syl = 0.09 + Math.random() * 0.16;
                const level = 0.5 + Math.random() * 0.5;
                vg.gain.setTargetAtTime(0.35 * level, t, 0.02);
                vg.gain.setTargetAtTime(0.0001, t + syl * 0.7, 0.03);
                f1.frequency.setValueAtTime(350 + Math.random() * 450, t);
                f2.frequency.setValueAtTime(1100 + Math.random() * 1400, t);
                t += syl + 0.03 + Math.random() * 0.09;
                if (--sentenceLeft <= 0) {
                    t += 0.35 + Math.random() * 0.6;  // announcer's breath
                    sentenceLeft = 4 + Math.floor(Math.random() * 8);
                }
            }

            noise.start(speechStart);
            noise.stop(end + 0.5);
            noise.onended = () => {
                try { f1.disconnect(); } catch(e) {}
                try { f2.disconnect(); } catch(e) {}
                try { vg.disconnect(); } catch(e) {}
                active = false;
            };
            return true;
        }

        return {
            gain: out,
            connect: dest => out.connect(dest),
            playBulletin: playBulletin,
            isActive: () => active,
            stop: () => { try { out.disconnect(); } catch(e) {} }
        };
    }

    // ============================================
    // PUBLIC API
    // ============================================

    return {
        resetSeed,
        createScheduler,
        TONIC,
        buildChordTable,
        snapFreq,
        createSeries,
        createRadio,
        createScoreMoment,
        // Maintenance & intruders
        createSigh,
        createTapeSmooth,
        createPageTurn,
        createBucketEmpty,
        createPour,
        createKettle,
        createSiren,
        createGenerator,
        createAlertBuzz,
        createHelicopter,
        // Memory sounds
        createIceCreamVan,
        createSprinklers,
        createPinkNoiseBuffer,
        createWhiteNoiseBuffer,
        createFilteredNoise,
        createNoiseBurst,
        createClick,
        createThunder,
        createRainPatter,
        scheduleDrips,
        scheduleBursts,
        createAMSynth,
        createInsectChorus,
        createDrone,
        createRoomTone,
        createWind,
        createReverbImpulse,
        createReverb,
        createZoneReverb,
        ZONE_REVERB_PROFILES,
        // Domestic sounds
        createApplianceCycle,
        createDripWithReverb,
        scheduleDripsWithReverb,
        createMechanicalHum,
        createGlassVibration,
        createCreak,
        scheduleCreaks,
        createFilteredCicadas
    };
})();
