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
    const EVOLUTION_RAMP_UP = 120;   // seconds to full intensity while dominant
    const EVOLUTION_RAMP_DOWN = 30;  // seconds to settle back after leaving

    const DISTANCE_FACTOR = 12;  // Steep falloff for focused listening

    // Smoothing time constants (seconds)
    const SMOOTH = {
        zoneGain: 0.15,      // Zone crossfade
        filter: 0.08,        // Filter sweep
        reverb: 0.12,        // Wet/dry mix
        delay: 0.12          // Delay amount
    };

    // Current cursor position (0-1)
    let position = { x: 0.5, y: 0.5 };

    // Temporal evolution tracking
    let lastDominantZone = null;
    let lastEvolutionUpdate = 0;
    let welcomeTimeout = null;

    // Micro-drift LFOs
    let microDrifts = [];

    let visibilityHooked = false;

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

        // Master gain for fade in/out
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(compressor);

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
            const dx = position.x - source.x;
            const dy = position.y - source.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
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

        // Dominant zone intensifies; the others settle back to base
        activeSources.forEach(source => {
            if (source.name === dominantZone) {
                source.evolutionFactor = Math.min(1, source.evolutionFactor + deltaTime / EVOLUTION_RAMP_UP);
            } else {
                source.evolutionFactor = Math.max(0, source.evolutionFactor - deltaTime / EVOLUTION_RAMP_DOWN);
            }

            const target = EVOLUTION_TARGETS[source.name] || source.maxGain;
            source.evolutionGain = lerp(source.maxGain, target, source.evolutionFactor);
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

    function createZoneSources() {
        activeSources = [];

        Zones.ZONE_SOURCES.forEach(zoneDef => {
            // Per-zone stereo placement based on the zone's X position
            // (falls back to a plain gain where StereoPannerNode is missing)
            const zoneOut = audioContext.createStereoPanner
                ? audioContext.createStereoPanner()
                : audioContext.createGain();
            if (zoneOut.pan) {
                zoneOut.pan.value = (zoneDef.x - 0.5) * 1.4;
            }
            zoneOut.connect(filterNode);

            // Create zone with its soundscape
            const zone = zoneDef.create(audioContext, zoneOut);

            // Get optimized gain for this zone
            const maxGain = ZONE_GAINS[zoneDef.name] || 0.5;

            activeSources.push({
                name: zoneDef.name,
                x: zoneDef.x,
                y: zoneDef.y,
                gainNode: zone.gainNode,
                trigger: zone.trigger,
                cleanup: zone.cleanup,
                output: zoneOut,
                maxGain: maxGain,
                evolutionGain: maxGain,
                evolutionFactor: 0
            });
        });

        // Setup micro-drifts on master parameters
        setupMicroDrifts();
    }

    function updateZoneGains() {
        activeSources.forEach(source => {
            const dx = position.x - source.x;
            const dy = position.y - source.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Inverse distance attenuation with steeper falloff
            const gain = source.evolutionGain / (1 + distance * DISTANCE_FACTOR);

            smoothParam(source.gainNode.gain, gain, SMOOTH.zoneGain);
        });
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

        // Y position affects depth:
        // Y = 0 (top) = bright, dry, present
        // Y = 1 (bottom) = muffled, wet, distant
        const depth = position.y;

        // Filter: 400Hz - 12000Hz sweep (more dramatic range)
        const filterFreq = 400 + (1 - depth) * 11600;
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
        });
        activeSources = [];

        lastDominantZone = null;
        lastEvolutionUpdate = 0;
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

        isRunning: function() {
            return isRunning && !isPaused;
        },

        getDominantZone: function() {
            return isRunning ? getDominantZone() : null;
        },

        getZoneSources: function() {
            return Zones.ZONE_SOURCES;
        }
    };
})();
