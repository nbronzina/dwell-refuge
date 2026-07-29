// ============================================
// DWELL:REFUGE - Main Controller
// State management, transitions, UI
// ============================================

(function() {
    'use strict';

    // Elements
    const entryScreen = document.getElementById('entry');
    const enterBtn = document.getElementById('enterBtn');
    const soundSpace = document.getElementById('space');
    const hint = document.getElementById('hint');
    const zoneLabel = document.getElementById('zoneLabel');
    const backLink = document.querySelector('.back-link');

    const reducedMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Zone label appears after this much stillness
    const LABEL_DELAY = 5;              // seconds
    const STILLNESS_THRESHOLD = 0.05;   // velocity below this counts as still

    // State
    let hasEntered = false;
    let isExiting = false;
    let stillTime = 0;

    // Initialize
    function init() {
        // Web Audio unavailable: say so instead of failing silently
        if (!(window.AudioContext || window.webkitAudioContext)) {
            enterBtn.disabled = true;
            const entryHint = document.querySelector('.entry-hint');
            if (entryHint) {
                entryHint.textContent = 'This browser does not support Web Audio.';
            }
            return;
        }

        RefugeInput.init();

        // Entry button
        enterBtn.addEventListener('click', enter);
        enterBtn.addEventListener('touchend', function(e) {
            e.preventDefault();
            enter();
        });

        // Back link: fade out, close audio, then navigate
        if (backLink) {
            backLink.addEventListener('click', function(e) {
                if (hasEntered && !isExiting) {
                    e.preventDefault();
                    isExiting = true;
                    RefugeAudio.gracefulExit().then(function() {
                        window.location.href = backLink.href;
                    });
                }
            });
        }

        // The page is actually going away: no time for a fade,
        // just avoid an audible click
        window.addEventListener('pagehide', function() {
            RefugeAudio.muteImmediately();
        });

        // Keyboard support
        document.addEventListener('keydown', function(e) {
            if (!hasEntered && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                enter();
            }
            // Escape to leave
            if (hasEntered && e.key === 'Escape') {
                leave();
            }
        });

        // Visual pulses synced to zone sound events
        document.addEventListener('refuge:event', handleZoneEvent);

        // Zone label on stillness
        setInterval(updateZoneLabel, 500);

        // Tuning overlay: append ?debug to the URL
        if (window.location.search.indexOf('debug') !== -1) {
            initDebugOverlay();
        }
    }

    // ============================================
    // DEBUG OVERLAY (?debug)
    // Live engine state for tuning gains, evolution
    // and the stillness reward without guessing
    // ============================================

    function initDebugOverlay() {
        const panel = document.createElement('pre');
        panel.className = 'debug-panel';
        document.body.appendChild(panel);

        setInterval(function() {
            const s = RefugeAudio.getDebugState();
            const lines = [
                'ctx: ' + s.contextState + (s.paused ? ' (paused)' : ''),
                'spatial: ' + s.spatial,
                'pos: ' + s.position.x.toFixed(2) + ', ' + s.position.y.toFixed(2),
                'dominant: ' + (s.dominant || '-'),
                'velocity: ' + s.velocity.toFixed(3),
                'stillness: ' + s.stillness.toFixed(2),
                ''
            ];
            s.zones.forEach(function(z) {
                lines.push(
                    z.name.padEnd(8) +
                    ' g=' + z.gain.toFixed(3) +
                    ' evo=' + z.evolution.toFixed(2)
                );
            });
            panel.textContent = lines.join('\n');
        }, 250);
    }

    // ============================================
    // VISUAL PULSES
    // ============================================

    function handleZoneEvent(e) {
        if (!hasEntered || reducedMotion) return;

        const type = e.detail && e.detail.type;
        if (type === 'thunder') {
            pulse('flash', 600);
        } else if (type === 'glass') {
            pulse('shake', 500);
        }
    }

    function pulse(className, duration) {
        soundSpace.classList.remove(className);
        void soundSpace.offsetWidth;  // restart the CSS animation
        soundSpace.classList.add(className);
        setTimeout(function() {
            soundSpace.classList.remove(className);
        }, duration);
    }

    // ============================================
    // ZONE LABEL (dwelling reveals where you are)
    // ============================================

    function updateZoneLabel() {
        if (!zoneLabel) return;

        if (!hasEntered || !RefugeAudio.isRunning()) {
            stillTime = 0;
            zoneLabel.classList.remove('visible');
            return;
        }

        if (RefugeInput.getVelocity() < STILLNESS_THRESHOLD) {
            stillTime += 0.5;
            if (stillTime >= LABEL_DELAY) {
                zoneLabel.textContent = RefugeAudio.getDominantZone() || '';
                zoneLabel.classList.add('visible');
            }
        } else {
            stillTime = 0;
            zoneLabel.classList.remove('visible');
        }
    }

    // ============================================
    // ENTER / LEAVE
    // ============================================

    function enter() {
        if (hasEntered || isExiting) return;
        hasEntered = true;

        // Start audio
        RefugeAudio.start();

        // Fade out entry screen
        entryScreen.classList.add('fade-out');

        // Show sound space after fade
        setTimeout(function() {
            entryScreen.style.display = 'none';
            soundSpace.classList.remove('hidden');

            // Activate input
            RefugeInput.activate();

            // Show hint
            showHint();
        }, 1000);
    }

    function leave() {
        if (!hasEntered || isExiting) return;
        isExiting = true;

        RefugeInput.deactivate();

        // Fade audio out but keep the context alive so
        // the piece can be entered again
        RefugeAudio.fadeOutAndStop(2).then(function() {
            soundSpace.classList.add('hidden');
            entryScreen.style.display = '';
            entryScreen.classList.remove('fade-out');

            hasEntered = false;
            isExiting = false;
        });
    }

    function showHint() {
        // First lesson: the space responds to movement
        setTimeout(function() {
            if (!hasEntered) return;
            hint.textContent = 'move';
            hint.classList.add('visible');

            setTimeout(function() {
                hint.classList.remove('visible');
            }, 4000);
        }, 2000);

        // Second lesson, once the space has been explored:
        // stillness reveals detail
        setTimeout(function() {
            if (!hasEntered) return;
            hint.textContent = 'or be still';
            hint.classList.add('visible');

            setTimeout(function() {
                hint.classList.remove('visible');
            }, 4000);
        }, 30000);
    }

    // Start when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
