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

        return buffer;
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
        const buffer = noiseType === 'pink'
            ? createPinkNoiseBuffer(ctx, 2)
            : createWhiteNoiseBuffer(ctx, 2);

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
            start: () => source.start(),
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
     * Schedule recurring drips/clicks at random intervals
     * @param {AudioContext} ctx
     * @param {AudioNode} destination
     * @param {number} minInterval - minimum time between drips (seconds)
     * @param {number} maxInterval - maximum time between drips (seconds)
     * @param {number} freqMin - minimum frequency
     * @param {number} freqMax - maximum frequency
     * @param {number} gain - click gain
     */
    function scheduleDrips(ctx, destination, minInterval, maxInterval, freqMin = 800, freqMax = 1200, gain = 0.15) {
        let timeoutId = null;
        let isRunning = false;

        function scheduleNext() {
            if (!isRunning) return;

            const interval = (minInterval + Math.random() * (maxInterval - minInterval)) * 1000;

            timeoutId = setTimeout(() => {
                if (!isRunning) return;
                const freq = freqMin + Math.random() * (freqMax - freqMin);
                createClick(ctx, destination, freq, 0.03 + Math.random() * 0.02, gain);
                scheduleNext();
            }, interval);
        }

        return {
            start: () => {
                isRunning = true;
                scheduleNext();
            },
            stop: () => {
                isRunning = false;
                if (timeoutId) clearTimeout(timeoutId);
            }
        };
    }

    /**
     * Schedule bursts at random intervals (for thunder, cracks)
     */
    function scheduleBursts(ctx, destination, minInterval, maxInterval, freqMin, freqMax, duration, decay, gain = 0.4) {
        let timeoutId = null;
        let isRunning = false;

        function scheduleNext() {
            if (!isRunning) return;

            const interval = (minInterval + Math.random() * (maxInterval - minInterval)) * 1000;

            timeoutId = setTimeout(() => {
                if (!isRunning) return;
                const freq = freqMin + Math.random() * (freqMax - freqMin);
                const burst = createNoiseBurst(ctx, destination, freq, duration, decay);
                scheduleNext();
            }, interval);
        }

        return {
            start: () => {
                isRunning = true;
                scheduleNext();
            },
            stop: () => {
                isRunning = false;
                if (timeoutId) clearTimeout(timeoutId);
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
    function createWind(ctx, filterFreq = 400, lfoRate = 0.1, lfoDepth = 0.3) {
        const noiseBuffer = createWhiteNoiseBuffer(ctx, 4);
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
                noise.start();
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

    // ============================================
    // PUBLIC API
    // ============================================

    return {
        resetSeed,
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
        createReverb
    };
})();
