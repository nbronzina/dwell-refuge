// ============================================
// DWELL:REFUGE - Audio Engine
// Climate refuge soundscape with positioned zones
// Optimized for production
// ============================================

const RefugeAudio = (function() {
    'use strict';

    let audioContext = null;
    let masterGain = null;
    let isRunning = false;
    let isPaused = false;

    // Spatial processing nodes
    let reverbNode = null;
    let reverbGain = null;
    let delayNode = null;
    let delayFeedback = null;
    let delayGain = null;
    let filterNode = null;
    let compressor = null;
    let subFilter = null;

    // Active zone sources
    let activeSources = [];

    // Animation frame ID for cleanup
    let animationFrameId = null;

    // Per-zone gain levels (optimized hierarchy)
    const ZONE_GAINS = {
        storm: 0.7,      // Enveloping but not saturating
        heat: 0.5,       // Quiet = more oppressive
        flood: 0.75,     // Claustrophobic presence
        drought: 0.6,    // Empty, less is more
        refuge: 0.3      // Almost subliminal - the calm
    };

    // Gain each zone drifts toward while it stays dominant
    // (hostile zones intensify, refuge settles even calmer)
    const EVOLUTION_TARGETS = {
        storm: 0.85,
        heat: 0.6,
        flood: 0.9,
        drought: 0.7,
        refuge: 0.22
    };
    // Evolution is an ARC, not a ramp: intensify while dwelling,
    // hold, then recede to a settled state below peak - long-form
    // listening needs the recession half (restraint as system)
    const EVOLUTION_RAMP_UP = 120;   // rise to full intensity
    const EVOLUTION_HOLD = 120;      // plateau at peak
    const EVOLUTION_RECEDE = 240;    // then settle down...
    const EVOLUTION_FLOOR = 0.35;    // ...to this fraction of peak
    const EVOLUTION_RAMP_DOWN = 30;  // decay after leaving the zone

    function evolutionArc(t) {
        if (t <= EVOLUTION_RAMP_UP) return t / EVOLUTION_RAMP_UP;
        const t2 = t - EVOLUTION_RAMP_UP;
        if (t2 <= EVOLUTION_HOLD) return 1;
        const t3 = t2 - EVOLUTION_HOLD;
        if (t3 >= EVOLUTION_RECEDE) return EVOLUTION_FLOOR;
        const k = t3 / EVOLUTION_RECEDE;
        return 1 - (1 - EVOLUTION_FLOOR) * (k * k * (3 - 2 * k));
    }

    // Spatial model: each zone is a REGION (its quadrant), not a
    // point. Anywhere inside the zone's rectangle it plays at full
    // level - the whole room is habitable. Leaving the rectangle,
    // the sound fades over FADE_DISTANCE with a smoothstep
    // (arriving somewhere, not switching something) and then goes
    // silent. Regions nearly tile the space, so crossfades live in
    // the seams and corridors between rooms, corridors are quieter
    // than rooms (as corridors are), and there is never dead air.
    const FADE_DISTANCE = 0.25;

    function rectDistance(px, py, rect) {
        const dx = Math.max(rect.x0 - px, 0, px - rect.x1);
        const dy = Math.max(rect.y0 - py, 0, py - rect.y1);
        return Math.sqrt(dx * dx + dy * dy);
    }

    function falloff(distance) {
        if (distance <= 0) return 1;
        if (distance >= FADE_DISTANCE) return 0;
        const t = distance / FADE_DISTANCE;
        return 1 - t * t * (3 - 2 * t);  // inverted smoothstep
    }

    // Smoothing time constants (seconds)
    const SMOOTH = {
        zoneGain: 0.15,      // Zone crossfade
        filter: 0.08,        // Filter sweep
        reverb: 0.12,        // Wet/dry mix
        delay: 0.12          // Delay amount
    };

    // Current cursor position (0-1)
    let position = { x: 0.5, y: 0.5 };

    // Stillness reward: staying still reveals detail.
    // Movement blurs the space slightly; resting opens it up.
    let currentVelocity = 0;
    let stillness = 0;
    const STILLNESS_VELOCITY = 0.3;      // Velocity above this = fully "moving"
    const STILLNESS_SMOOTH = 0.008;      // Per-frame easing (~2s to settle)
    const STILLNESS_FILTER_BONUS = 1800; // Extra filter opening (Hz) when still
    const STILLNESS_GAIN_BONUS = 0.08;   // Extra zone gain (fraction) when still

    // Temporal evolution tracking
    let lastDominantZone = null;
    let lastEvolutionUpdate = 0;
    let welcomeTimeout = null;

    // Micro-drift LFOs
    let microDrifts = [];

    // Corridor bed (audible only in the seams between zones)
    let hallway = null;

    let visibilityHooked = false;

    // HRTF spatialization is CPU-heavy and inconsistent on weak or
    // mobile hardware - use it only on capable desktops, otherwise
    // fall back to plain stereo panning
    let useHRTF = false;

    function shouldUseHRTF() {
        if (typeof navigator === 'undefined') return false;
        const isDesktop = !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
        return isDesktop && (navigator.hardwareConcurrency || 0) > 4;
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    function init() {
        if (audioContext) return;

        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Master compressor/limiter (protects against clipping)
        compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -6;   // dB
        compressor.knee.value = 6;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.005;
        compressor.release.value = 0.1;
        compressor.connect(audioContext.destination);

        // Sub-bass cleanup: room tones and drones stack low-frequency
        // energy that would pump the compressor without adding anything
        // audible - cut below ~24Hz before it gets there
        subFilter = audioContext.createBiquadFilter();
        subFilter.type = 'highpass';
        subFilter.frequency.value = 24;
        subFilter.Q.value = 0.7;
        subFilter.connect(compressor);

        // Master gain for fade in/out
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(subFilter);

        // Global filter (responds to Y position)
        // Range: 400Hz (muffled) to 12000Hz (bright)
        filterNode = audioContext.createBiquadFilter();
        filterNode.type = 'lowpass';
        filterNode.frequency.value = 6000;
        filterNode.Q.value = 0.7;

        // Delay effect
        delayNode = audioContext.createDelay(2);
        delayNode.delayTime.value = 0.3;
        delayFeedback = audioContext.createGain();
        delayFeedback.gain.value = 0.2;
        delayGain = audioContext.createGain();
        delayGain.gain.value = 0;

        delayNode.connect(delayFeedback);
        delayFeedback.connect(delayNode);
        delayNode.connect(delayGain);

        // Reverb (shorter, more room-like)
        reverbNode = audioContext.createConvolver();
        reverbNode.buffer = Synthesis.createReverbImpulse(audioContext, 2.5, 2.5);
        reverbGain = audioContext.createGain();
        reverbGain.gain.value = 0;
        reverbNode.connect(reverbGain);

        // Connect effects chain
        filterNode.connect(delayNode);
        filterNode.connect(reverbNode);
        filterNode.connect(masterGain);
        delayGain.connect(masterGain);
        reverbGain.connect(masterGain);

        // Tab visibility handling (hook once - init can run again after teardown)
        if (!visibilityHooked) {
            visibilityHooked = true;
            setupVisibilityHandling();
        }
    }

    // ============================================
    // TAB VISIBILITY HANDLING
    // ============================================

    function setupVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                pauseAudio();
            } else {
                resumeAudio();
            }
        });
    }

    function pauseAudio() {
        if (!isRunning || isPaused) return;
        isPaused = true;

        // Fade out quickly
        if (masterGain) {
            masterGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.3);
        }

        // Suspend context to save CPU
        if (audioContext && audioContext.state === 'running') {
            audioContext.suspend();
        }
    }

    function resumeAudio() {
        if (!isRunning || !isPaused) return;
        isPaused = false;

        // Resume context
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }

        // Fade back in
        if (masterGain) {
            masterGain.gain.setTargetAtTime(1, audioContext.currentTime, 0.5);
        }

        // Restart the update loop (it may have exited while paused)
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        lastEvolutionUpdate = 0;
        updateGlobalEffects();
    }

    // ============================================
    // SMOOTH PARAMETER TRANSITIONS
    // ============================================

    function smoothParam(param, value, timeConstant) {
        param.setTargetAtTime(value, audioContext.currentTime, timeConstant);
    }

    // ============================================
    // MICRO-DRIFT (subtle parameter breathing)
    // ============================================

    function createMicroDrift(param, range, speed, baseValue) {
        const lfo = audioContext.createOscillator();
        const lfoGain = audioContext.createGain();

        lfo.type = 'sine';
        lfo.frequency.value = speed;
        // Amplitude from the intended base value, not the current one
        // (params like masterGain are still 0 when drifts are created)
        const base = baseValue !== undefined ? baseValue : param.value;
        lfoGain.gain.value = base * range;

        lfo.connect(lfoGain);
        lfoGain.connect(param);
        lfo.start();

        return { lfo, lfoGain, stop: () => { try { lfo.stop(); } catch(e) {} } };
    }

    function setupMicroDrifts() {
        cleanupMicroDrifts();

        // Filter cutoff drift (±10% of resting cutoff, very slow)
        microDrifts.push(createMicroDrift(filterNode.frequency, 0.1, 0.015, 6000));

        // Master gain drift (±3% of full level, subtle breathing)
        microDrifts.push(createMicroDrift(masterGain.gain, 0.03, 0.008, 1));
    }

    function cleanupMicroDrifts() {
        microDrifts.forEach(d => d.stop());
        microDrifts = [];
    }

    // ============================================
    // TEMPORAL EVOLUTION
    // ============================================

    function getDominantZone() {
        let closest = null;
        let minDist = Infinity;

        activeSources.forEach(source => {
            const distance = rectDistance(position.x, position.y, source.rect);
            if (distance < minDist) {
                minDist = distance;
                closest = source.name;
            }
        });

        return closest;
    }

    function updateEvolution(deltaTime) {
        const dominantZone = getDominantZone();

        if (dominantZone !== lastDominantZone) {
            lastDominantZone = dominantZone;
            scheduleWelcomeEvent(dominantZone);
        }

        // Dominant zone follows its arc; the others settle back
        activeSources.forEach(source => {
            if (source.name === dominantZone) {
                source.dwellTime += deltaTime;
            } else {
                // Leaving unwinds dwell time quickly (~30s from peak)
                source.dwellTime = Math.max(0,
                    source.dwellTime - deltaTime * (EVOLUTION_RAMP_UP / EVOLUTION_RAMP_DOWN));
            }

            const factor = evolutionArc(source.dwellTime);
            source.evolutionFactor = factor;

            const target = EVOLUTION_TARGETS[source.name] || source.maxGain;
            source.evolutionGain = lerp(source.maxGain, target, factor);

            // Stress corrupts, not just amplifies: the zone's own
            // machinery goes subtly wrong as intensity rises
            if (source.setStress && Math.abs(factor - source.lastStress) > 0.02) {
                source.lastStress = factor;
                source.setStress(factor);
            }
        });
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    // ============================================
    // WELCOME EVENTS
    // Entering a zone triggers a characteristic sound
    // within a few seconds, so exploration reads immediately
    // ============================================

    function scheduleWelcomeEvent(zoneName) {
        if (welcomeTimeout) clearTimeout(welcomeTimeout);

        welcomeTimeout = setTimeout(() => {
            welcomeTimeout = null;
            if (!isRunning || isPaused) return;
            // Only fire if the listener is still in this zone
            if (getDominantZone() !== zoneName) return;

            const source = activeSources.find(s => s.name === zoneName);
            if (source && source.trigger) source.trigger();
        }, 2000 + Math.random() * 2000);
    }

    // ============================================
    // GRACEFUL EXIT
    // ============================================

    function gracefulExit() {
        if (!audioContext || !masterGain) return Promise.resolve();

        const fadeTime = 2;
        const ctx = audioContext;

        return new Promise(resolve => {
            masterGain.gain.setTargetAtTime(0, ctx.currentTime, fadeTime / 3);
            setTimeout(() => {
                teardown();
                // Release everything so a future init() builds a fresh context
                audioContext = null;
                masterGain = null;
                compressor = null;
                subFilter = null;
                filterNode = null;
                reverbNode = null;
                reverbGain = null;
                delayNode = null;
                delayFeedback = null;
                delayGain = null;
                ctx.close().then(resolve).catch(resolve);
            }, fadeTime * 1000);
        });
    }

    // ============================================
    // ZONE SOURCE MANAGEMENT
    // ============================================

    function createZoneOutput(zoneDef) {
        // Full HRTF placement on capable desktops
        if (useHRTF && audioContext.createPanner) {
            const p = audioContext.createPanner();
            p.panningModel = 'HRTF';
            p.distanceModel = 'inverse';
            p.refDistance = 1;
            p.rolloffFactor = 1;
            const px = (zoneDef.x - 0.5) * 2;
            const pz = (zoneDef.y - 0.5) * 2;
            if (p.positionX) {
                p.positionX.value = px;
                p.positionY.value = 0;
                p.positionZ.value = pz;
            } else if (p.setPosition) {
                p.setPosition(px, 0, pz);
            }
            return p;
        }

        // Stereo placement based on the zone's X position
        if (audioContext.createStereoPanner) {
            const p = audioContext.createStereoPanner();
            p.pan.value = (zoneDef.x - 0.5) * 1.4;
            return p;
        }

        // Last resort: plain gain (mono placement)
        return audioContext.createGain();
    }

    function createZoneSources() {
        activeSources = [];
        useHRTF = shouldUseHRTF();

        Zones.ZONE_SOURCES.forEach(zoneDef => {
            const zoneOut = createZoneOutput(zoneDef);

            // Air absorption: distant zones lose highs as well as
            // volume - the strongest distance cue after loudness
            const distFilter = audioContext.createBiquadFilter();
            distFilter.type = 'lowpass';
            distFilter.frequency.value = 16000;
            distFilter.Q.value = 0.4;
            zoneOut.connect(distFilter);
            distFilter.connect(filterNode);

            // Create zone with its soundscape
            const zone = zoneDef.create(audioContext, zoneOut);

            // Get optimized gain for this zone
            const maxGain = ZONE_GAINS[zoneDef.name] || 0.5;

            activeSources.push({
                name: zoneDef.name,
                x: zoneDef.x,
                y: zoneDef.y,
                rect: zoneDef.rect,
                halfW: (zoneDef.rect.x1 - zoneDef.rect.x0) / 2,
                halfH: (zoneDef.rect.y1 - zoneDef.rect.y0) / 2,
                gainNode: zone.gainNode,
                trigger: zone.trigger,
                setProximity: zone.setProximity,
                setStress: zone.setStress,
                cleanup: zone.cleanup,
                output: zoneOut,
                distFilter: distFilter,
                maxGain: maxGain,
                evolutionGain: maxGain,
                evolutionFactor: 0,
                dwellTime: 0,
                lastStress: 0
            });
        });

        // The corridor between rooms: a neutral hallway presence
        // audible only in the seams, so crossing zones sounds like
        // moving through the house rather than between audio files
        hallway = {
            gain: audioContext.createGain(),
            tone: Synthesis.createRoomTone(audioContext, Synthesis.TONIC, 0.03),
            noise: Synthesis.createFilteredNoise(audioContext, 'pink', 'lowpass', 240, 0.4)
        };
        hallway.gain.gain.value = 0;
        hallway.gain.connect(filterNode);
        hallway.tone.connect(hallway.gain);
        hallway.noise.gain.gain.value = 0.02;
        hallway.noise.connect(hallway.gain);
        hallway.tone.start();
        hallway.noise.start();

        // Setup micro-drifts on master parameters
        setupMicroDrifts();
    }

    function updateZoneGains() {
        // Stillness slightly lifts everything - detail as reward
        const stillnessBoost = 1 + STILLNESS_GAIN_BONUS * stillness;

        let maxFalloff = 0;

        activeSources.forEach(source => {
            const distance = rectDistance(position.x, position.y, source.rect);

            // Region falloff: full anywhere inside the rectangle,
            // silent beyond the fade band
            const fall = falloff(distance);
            if (fall > maxFalloff) maxFalloff = fall;
            const gain = source.evolutionGain * stillnessBoost * fall;

            smoothParam(source.gainNode.gain, gain, SMOOTH.zoneGain);

            // Through the wall: inside a room the zone is full
            // spectrum; from the corridor it is heard as through
            // drywall (heavy lowpass, not gentle air absorption)
            const absorb = Math.min(1, distance / FADE_DISTANCE);
            const cutoff = 16000 - (16000 - 550) * absorb;
            smoothParam(source.distFilter.frequency, cutoff, SMOOTH.filter);

            // Element mix shifts with the listener's spot in the
            // room, normalized to the region's extents (its edge = 1)
            if (source.setProximity) {
                source.setProximity(
                    (position.x - source.x) / source.halfW,
                    (position.y - source.y) / source.halfH
                );
            }
        });

        // The hallway exists only where no room does
        if (hallway) {
            smoothParam(hallway.gain.gain, (1 - maxFalloff) * 0.8, SMOOTH.zoneGain);
        }
    }

    // ============================================
    // GLOBAL EFFECTS (Y-axis response)
    // ============================================

    function updateGlobalEffects() {
        if (!audioContext || !isRunning || isPaused) {
            return;
        }

        const now = performance.now() / 1000;
        const deltaTime = lastEvolutionUpdate ? now - lastEvolutionUpdate : 0;
        lastEvolutionUpdate = now;

        // Update temporal evolution
        if (deltaTime > 0 && deltaTime < 1) {
            updateEvolution(deltaTime);
        }

        // Ease stillness toward its target
        const targetStillness = Math.max(0, Math.min(1, 1 - currentVelocity / STILLNESS_VELOCITY));
        stillness += (targetStillness - stillness) * STILLNESS_SMOOTH;

        // Y position affects depth:
        // Y = 0 (top) = bright, dry, present
        // Y = 1 (bottom) = muffled, wet, distant
        const depth = position.y;

        // Filter: 400Hz - 12000Hz sweep, opening further with stillness
        const filterFreq = Math.min(12000,
            400 + (1 - depth) * 11600 + stillness * STILLNESS_FILTER_BONUS);
        smoothParam(filterNode.frequency, filterFreq, SMOOTH.filter);

        // Reverb: 0.08 - 0.45 (subtle to noticeable)
        const reverbAmount = 0.08 + depth * 0.37;
        smoothParam(reverbGain.gain, reverbAmount, SMOOTH.reverb);

        // Delay: 0 - 0.35 (none to subtle echo)
        const delayAmount = depth * 0.35;
        smoothParam(delayGain.gain, delayAmount, SMOOTH.delay);
        smoothParam(delayFeedback.gain, 0.15 + depth * 0.2, SMOOTH.delay);

        // Update zone gains based on distance
        updateZoneGains();

        animationFrameId = requestAnimationFrame(updateGlobalEffects);
    }

    // ============================================
    // TEARDOWN
    // ============================================

    function teardown() {
        isRunning = false;
        isPaused = false;

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (welcomeTimeout) {
            clearTimeout(welcomeTimeout);
            welcomeTimeout = null;
        }

        cleanupMicroDrifts();

        activeSources.forEach(source => {
            if (source.cleanup) source.cleanup();
            if (source.output) {
                try { source.output.disconnect(); } catch(e) {}
            }
            if (source.distFilter) {
                try { source.distFilter.disconnect(); } catch(e) {}
            }
        });
        activeSources = [];

        if (hallway) {
            try { hallway.tone.stop(); } catch(e) {}
            try { hallway.noise.stop(); } catch(e) {}
            try { hallway.gain.disconnect(); } catch(e) {}
            hallway = null;
        }

        lastDominantZone = null;
        lastEvolutionUpdate = 0;
        stillness = 0;
        currentVelocity = 0;
    }

    function stopEngine() {
        if (!isRunning) return;
        const ctx = audioContext;
        teardown();

        // Silence any residual tails
        if (masterGain && ctx) {
            masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        }
    }

    // ============================================
    // PUBLIC API
    // ============================================

    return {
        start: function() {
            if (isRunning) return;

            init();

            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

            isRunning = true;
            isPaused = false;
            lastEvolutionUpdate = 0;

            // Create all zone sources
            createZoneSources();

            // Start spatial update loop
            updateGlobalEffects();

            // Fade in master - 4 second emergence from silence
            masterGain.gain.cancelScheduledValues(audioContext.currentTime);
            masterGain.gain.setValueAtTime(0, audioContext.currentTime);
            masterGain.gain.linearRampToValueAtTime(1, audioContext.currentTime + 4);
        },

        stop: stopEngine,

        // Fade over `seconds`, then stop sources but keep the context
        // alive so the piece can be re-entered
        fadeOutAndStop: function(seconds) {
            const fade = seconds || 2;
            if (!isRunning) return Promise.resolve();

            if (masterGain && audioContext) {
                masterGain.gain.setTargetAtTime(0, audioContext.currentTime, fade / 3);
            }

            return new Promise(resolve => {
                setTimeout(() => {
                    stopEngine();
                    resolve();
                }, fade * 1000);
            });
        },

        // Full exit: fade, tear down and close the context
        gracefulExit: gracefulExit,

        // Instant silence for pagehide (no time for a fade)
        muteImmediately: function() {
            if (masterGain && audioContext) {
                masterGain.gain.cancelScheduledValues(audioContext.currentTime);
                masterGain.gain.value = 0;
            }
        },

        setPosition: function(x, y) {
            position.x = Math.max(0, Math.min(1, x));
            position.y = Math.max(0, Math.min(1, y));
        },

        // Fed continuously by the input layer for the stillness reward
        setVelocity: function(v) {
            currentVelocity = v;
        },

        isRunning: function() {
            return isRunning && !isPaused;
        },

        getDominantZone: function() {
            return isRunning ? getDominantZone() : null;
        },

        getZoneSources: function() {
            return Zones.ZONE_SOURCES;
        },

        // Live tuning state for the ?debug overlay
        getDebugState: function() {
            return {
                running: isRunning,
                paused: isPaused,
                contextState: audioContext ? audioContext.state : 'none',
                spatial: useHRTF ? 'hrtf' : 'stereo',
                dominant: lastDominantZone,
                stillness: stillness,
                velocity: currentVelocity,
                position: { x: position.x, y: position.y },
                zones: activeSources.map(s => ({
                    name: s.name,
                    gain: s.gainNode.gain.value,
                    evolution: s.evolutionFactor
                }))
            };
        }
    };
})();
