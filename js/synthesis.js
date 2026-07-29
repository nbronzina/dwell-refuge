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
    function createScheduler(minInterval, maxInterval, fn) {
        let timeoutId = null;
        let running = false;

        function scheduleNext() {
            if (!running) return;
            const interval = (minInterval + Math.random() * (maxInterval - minInterval)) * 1000;
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
            isRunning: () => running
        };
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
    function createWind(ctx, filterFreq = 400, lfoRate = 0.1, lfoDepth = 0.3) {
        const noiseBuffer = getNoiseBuffer(ctx, 'white', 4);
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = filterFreq;
        filter.Q.value = 0.3;

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

        function cycle() {
            if (!isRunning) return;

            if (isOn) {
                // Turn off with fade
                outputGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
                isOn = false;
                const nextOff = (offTime * 0.5 + Math.random() * offTime) * 1000;
                cycleTimeout = setTimeout(cycle, nextOff);
            } else {
                // Turn on with fade
                outputGain.gain.setTargetAtTime(0.08, ctx.currentTime, 0.3);
                isOn = true;
                const nextOn = (onTime * 0.8 + Math.random() * onTime * 0.4) * 1000;
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
            connect: (dest) => outputGain.connect(dest)
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
    function triggerDrip(ctx, dryDest, wetDest, type, gain) {
        const profile = DRIP_PROFILES[type] || DRIP_PROFILES.room;
        const freq = profile.freqBase + Math.random() * profile.freqRange;
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
    function createDripWithReverb(ctx, destination, type = 'room', gain = 0.15) {
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

        const osc = triggerDrip(ctx, dry, reverb, type, gain);

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
    function scheduleDripsWithReverb(ctx, destination, minInterval, maxInterval, type = 'room', gain = 0.15) {
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
            triggerDrip(ctx, dry, reverb, type, gain);
        });

        return {
            start: scheduler.start,
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
            connect: (dest) => outputGain.connect(dest)
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
     */
    function createCreak(ctx, destination, gain = 0.1) {
        const duration = 0.1 + Math.random() * 0.15;
        const freq = 150 + Math.random() * 200;

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
        creakGain.connect(destination);

        osc.start(now);
        osc.stop(now + duration + 0.05);

        return osc;
    }

    /**
     * Schedule creaks at random intervals
     */
    function scheduleCreaks(ctx, destination, minInterval, maxInterval, gain = 0.1) {
        return createScheduler(minInterval, maxInterval, () => {
            createCreak(ctx, destination, gain);
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
    // PUBLIC API
    // ============================================

    return {
        resetSeed,
        createScheduler,
        createPinkNoiseBuffer,
        createWhiteNoiseBuffer,
        createFilteredNoise,
        createNoiseBurst,
        createClick,
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
