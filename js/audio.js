// ============================================
// DWELL:REFUGE - Audio Engine
// Climate refuge soundscape with positioned zones
// ============================================

const RefugeAudio = (function() {
    'use strict';

    let audioContext = null;
    let masterGain = null;
    let isRunning = false;

    // Spatial processing nodes
    let reverbNode = null;
    let reverbGain = null;
    let delayNode = null;
    let delayFeedback = null;
    let delayGain = null;
    let filterNode = null;

    // Active zone sources
    let activeSources = [];

    // Distance attenuation parameters
    const SOURCE_GAIN_MAX_CORNER = 0.8;  // Hostile zones (corners) - LOUD
    const SOURCE_GAIN_MAX_CENTER = 0.4;  // Refuge zone (center) - subtle
    const DISTANCE_FACTOR = 10;           // Steep falloff for focused listening

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
        filterNode = audioContext.createBiquadFilter();
        filterNode.type = 'lowpass';
        filterNode.frequency.value = 8000;
        filterNode.Q.value = 0.5;

        // Delay effect
        delayNode = audioContext.createDelay(2);
        delayNode.delayTime.value = 0.35;
        delayFeedback = audioContext.createGain();
        delayFeedback.gain.value = 0.25;
        delayGain = audioContext.createGain();
        delayGain.gain.value = 0;

        delayNode.connect(delayFeedback);
        delayFeedback.connect(delayNode);
        delayNode.connect(delayGain);

        // Reverb
        reverbNode = audioContext.createConvolver();
        reverbNode.buffer = Synthesis.createReverbImpulse(audioContext, 4, 2);
        reverbGain = audioContext.createGain();
        reverbGain.gain.value = 0;
        reverbNode.connect(reverbGain);

        // Connect effects chain
        filterNode.connect(delayNode);
        filterNode.connect(reverbNode);
        filterNode.connect(masterGain);
        delayGain.connect(masterGain);
        reverbGain.connect(masterGain);
    }

    // ============================================
    // SMOOTH PARAMETER TRANSITIONS
    // ============================================

    function smoothParam(param, value, time) {
        param.setTargetAtTime(value, audioContext.currentTime, time);
    }

    // ============================================
    // ZONE SOURCE MANAGEMENT
    // ============================================

    function createZoneSources() {
        activeSources = [];

        Zones.ZONE_SOURCES.forEach(zoneDef => {
            // Create zone with its soundscape
            const zone = zoneDef.create(audioContext, filterNode);

            activeSources.push({
                name: zoneDef.name,
                x: zoneDef.x,
                y: zoneDef.y,
                gainNode: zone.gainNode,
                cleanup: zone.cleanup,
                maxGain: zoneDef.name === 'refuge' ? SOURCE_GAIN_MAX_CENTER : SOURCE_GAIN_MAX_CORNER
            });
        });
    }

    function updateZoneGains() {
        activeSources.forEach(source => {
            const dx = position.x - source.x;
            const dy = position.y - source.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Inverse distance attenuation
            const gain = source.maxGain / (1 + distance * DISTANCE_FACTOR);

            smoothParam(source.gainNode.gain, gain, 0.1);
        });
    }

    // ============================================
    // GLOBAL EFFECTS (Y-axis response)
    // ============================================

    function updateGlobalEffects() {
        if (!audioContext || !isRunning) return;

        // Y position affects depth:
        // Y = 0 (top) = bright, dry
        // Y = 1 (bottom) = muffled, wet
        const depth = position.y;

        // Filter: 200Hz - 16000Hz sweep
        const filterFreq = 200 + (1 - depth) * 15800;
        smoothParam(filterNode.frequency, filterFreq, 0.03);

        // Reverb: 0.05 - 0.6
        const reverbAmount = 0.05 + depth * 0.55;
        smoothParam(reverbGain.gain, reverbAmount, 0.05);

        // Delay: 0 - 0.5
        const delayAmount = depth * 0.5;
        smoothParam(delayGain.gain, delayAmount, 0.05);
        smoothParam(delayFeedback.gain, depth * 0.4, 0.05);

        // Update zone gains based on distance
        updateZoneGains();

        requestAnimationFrame(updateGlobalEffects);
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

            // Cleanup all zone sources
            activeSources.forEach(source => {
                if (source.cleanup) source.cleanup();
            });
            activeSources = [];

            if (masterGain) {
                masterGain.gain.setTargetAtTime(0, audioContext.currentTime, 1);
            }
        },

        setPosition: function(x, y) {
            position.x = Math.max(0, Math.min(1, x));
            position.y = Math.max(0, Math.min(1, y));
        },

        isRunning: function() {
            return isRunning;
        },

        getZoneSources: function() {
            return Zones.ZONE_SOURCES;
        }
    };
})();
