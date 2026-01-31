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

    // ============================================
    // INITIALIZATION
    // ============================================

    function init() {
        if (audioContext) return;

        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Master gain for fade in/out
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(audioContext.destination);

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
                maxGain: maxGain
            });
        });
    }

    function updateZoneGains() {
        activeSources.forEach(source => {
            const dx = position.x - source.x;
            const dy = position.y - source.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Inverse distance attenuation with steeper falloff
            const gain = source.maxGain / (1 + distance * DISTANCE_FACTOR);

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

            // Cancel animation frame
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }

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
