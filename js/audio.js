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
    let timeInCurrentZone = 0;
    let lastDominantZone = null;
    let lastEvolutionUpdate = 0;

    // Micro-drift LFOs (one per zone)
    let microDrifts = [];

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

        // Tab visibility handling
        setupVisibilityHandling();
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

    function createMicroDrift(param, range, speed) {
        const lfo = audioContext.createOscillator();
        const lfoGain = audioContext.createGain();

        lfo.type = 'sine';
        lfo.frequency.value = speed;
        lfoGain.gain.value = param.value * range;

        lfo.connect(lfoGain);
        lfoGain.connect(param);
        lfo.start();

        return { lfo, lfoGain, stop: () => { try { lfo.stop(); } catch(e) {} } };
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
            // Zone changed - reset timer
            timeInCurrentZone = 0;
            lastDominantZone = dominantZone;
        } else {
            timeInCurrentZone += deltaTime;
        }

        // Evolution factor: 0 to 1 over 2 minutes
        const evolutionFactor = Math.min(timeInCurrentZone / 120, 1);

        // Apply evolution to the dominant zone
        applyEvolution(dominantZone, evolutionFactor);
    }

    function applyEvolution(zone, factor) {
        // Find the source for this zone
        const source = activeSources.find(s => s.name === zone);
        if (!source) return;

        // Adjust max gain based on evolution
        // Hostile zones intensify, refuge calms
        switch(zone) {
            case 'storm':
                source.evolutionGain = lerp(0.7, 0.85, factor);
                break;
            case 'heat':
                source.evolutionGain = lerp(0.5, 0.6, factor);
                break;
            case 'flood':
                source.evolutionGain = lerp(0.75, 0.9, factor);
                break;
            case 'drought':
                source.evolutionGain = lerp(0.6, 0.7, factor);
                break;
            case 'refuge':
                source.evolutionGain = lerp(0.3, 0.22, factor);
                break;
        }
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    // ============================================
    // GRACEFUL EXIT
    // ============================================

    function gracefulExit() {
        if (!audioContext || !masterGain) return Promise.resolve();

        const fadeTime = 2;

        return new Promise(resolve => {
            masterGain.gain.setTargetAtTime(0, audioContext.currentTime, fadeTime / 3);
            setTimeout(() => {
                if (audioContext) {
                    audioContext.close().then(resolve).catch(resolve);
                } else {
                    resolve();
                }
            }, fadeTime * 1000);
        });
    }

    // ============================================
    // ZONE SOURCE MANAGEMENT
    // ============================================

    function createZoneSources() {
        activeSources = [];

        Zones.ZONE_SOURCES.forEach(zoneDef => {
            // Create zone with its soundscape
            const zone = zoneDef.create(audioContext, filterNode);

            // Get optimized gain for this zone
            const maxGain = ZONE_GAINS[zoneDef.name] || 0.5;

            activeSources.push({
                name: zoneDef.name,
                x: zoneDef.x,
                y: zoneDef.y,
                gainNode: zone.gainNode,
                cleanup: zone.cleanup,
                maxGain: maxGain,
                evolutionGain: maxGain  // Start at base gain
            });
        });

        // Setup micro-drifts on master filter
        setupMicroDrifts();
    }

    function setupMicroDrifts() {
        // Clean up existing drifts
        microDrifts.forEach(d => d.stop());
        microDrifts = [];

        // Filter cutoff drift (±10%, very slow)
        const filterDrift = createMicroDrift(filterNode.frequency, 0.1, 0.015);
        microDrifts.push(filterDrift);

        // Master gain drift (±3%, subtle breathing)
        const gainDrift = createMicroDrift(masterGain.gain, 0.03, 0.008);
        microDrifts.push(gainDrift);
    }

    function cleanupMicroDrifts() {
        microDrifts.forEach(d => d.stop());
        microDrifts = [];
    }

    function updateZoneGains() {
        activeSources.forEach(source => {
            const dx = position.x - source.x;
            const dy = position.y - source.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Use evolution gain if available, otherwise base maxGain
            const effectiveMaxGain = source.evolutionGain || source.maxGain;

            // Inverse distance attenuation with steeper falloff
            const gain = effectiveMaxGain / (1 + distance * DISTANCE_FACTOR);

            smoothParam(source.gainNode.gain, gain, SMOOTH.zoneGain);
        });
    }

    // ============================================
    // GLOBAL EFFECTS (Y-axis response)
    // ============================================

    function updateGlobalEffects() {
        if (!audioContext || !isRunning || isPaused) {
            if (isRunning && !isPaused) {
                animationFrameId = requestAnimationFrame(updateGlobalEffects);
            }
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

            // Create all zone sources
            createZoneSources();

            // Start spatial update loop
            updateGlobalEffects();

            // Fade in master - 4 second emergence from silence
            masterGain.gain.setValueAtTime(0, audioContext.currentTime);
            masterGain.gain.linearRampToValueAtTime(1, audioContext.currentTime + 4);
        },

        stop: function() {
            if (!isRunning) return;
            isRunning = false;
            isPaused = false;

            // Reset evolution tracking
            timeInCurrentZone = 0;
            lastDominantZone = null;
            lastEvolutionUpdate = 0;

            // Cancel animation frame
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }

            // Cleanup micro-drifts
            cleanupMicroDrifts();

            // Cleanup all zone sources
            activeSources.forEach(source => {
                if (source.cleanup) source.cleanup();
            });
            activeSources = [];

            // Fade out with smooth decay
            if (masterGain) {
                masterGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.5);
            }
        },

        gracefulExit: gracefulExit,

        setPosition: function(x, y) {
            position.x = Math.max(0, Math.min(1, x));
            position.y = Math.max(0, Math.min(1, y));
        },

        isRunning: function() {
            return isRunning && !isPaused;
        },

        getZoneSources: function() {
            return Zones.ZONE_SOURCES;
        }
    };
})();
