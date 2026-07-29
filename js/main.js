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

    // ?walk runs the canonical traversal and exports the recording
    const walkMode = window.location.search.indexOf('walk') !== -1;

    // Full audio: the visuals are onboarding only. This long after
    // entering, the lights go down and the piece is sound alone.
    const LIGHTS_DOWN_MS = 90000;
    let lightsDownTimer = null;

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

        // Start fetching field recordings while the visitor reads
        // the intro - by enter time they're usually decoded.
        // Missing files are fine: synthesis covers every slot.
        if (typeof Samples !== 'undefined') {
            Samples.load();
        }

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

        // Playback profile toggle: laptop speakers lose the quiet
        // details - the engine compensates when told
        const profileToggle = document.getElementById('profileToggle');
        if (profileToggle) {
            const stored = localStorage.getItem('refuge-profile');
            if (stored === 'speakers') {
                RefugeAudio.setPlaybackProfile('speakers');
                profileToggle.textContent = 'speakers';
            }
            const flip = function() {
                const next = RefugeAudio.getPlaybackProfile() === 'speakers'
                    ? 'headphones' : 'speakers';
                RefugeAudio.setPlaybackProfile(next);
                localStorage.setItem('refuge-profile', next);
                profileToggle.textContent = next;
            };
            profileToggle.addEventListener('click', flip);
            profileToggle.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    flip();
                }
            });
        }

        // Tuning overlay: append ?debug to the URL
        if (window.location.search.indexOf('debug') !== -1) {
            initDebugOverlay();
        }
    }

    // ============================================
    // CANONICAL WALK (?walk)
    // An automated traversal of the whole house, recorded from the
    // master bus and downloaded - the album export, and a review
    // tool: if the walk doesn't hold up linearly, the space isn't
    // composed yet.
    // ============================================

    function runCanonicalWalk() {
        if (!RefugeAudio.startRecording()) {
            console.log('dwell:refuge - recording unavailable in this browser');
            return;
        }
        console.log('dwell:refuge - canonical walk recording (~10 min)');

        const path = [
            { x: 0.5, y: 0.5, dwell: 60 },    // the refuge, first
            { x: 0.16, y: 0.16, dwell: 75 },  // storm
            { x: 0.5, y: 0.16, dwell: 25 },   // the north corridor
            { x: 0.84, y: 0.16, dwell: 75 },  // heat
            { x: 0.84, y: 0.84, dwell: 75 },  // drought
            { x: 0.5, y: 0.84, dwell: 25 },   // the south corridor
            { x: 0.16, y: 0.84, dwell: 75 },  // flood
            { x: 0.5, y: 0.5, dwell: 90 }     // home again
        ];
        const TRAVEL = 12;
        let seg = 0;
        let phase = 'dwell';
        let t0 = performance.now();

        RefugeAudio.setPosition(path[0].x, path[0].y);

        const iv = setInterval(function() {
            const el = (performance.now() - t0) / 1000;
            const cur = path[seg];

            if (phase === 'dwell') {
                if (el >= cur.dwell) {
                    if (seg === path.length - 1) {
                        clearInterval(iv);
                        RefugeAudio.stopRecording().then(saveWalk);
                        return;
                    }
                    phase = 'travel';
                    t0 = performance.now();
                }
            } else {
                const nxt = path[seg + 1];
                const k = Math.min(1, el / TRAVEL);
                const e = k * k * (3 - 2 * k);
                RefugeAudio.setPosition(
                    cur.x + (nxt.x - cur.x) * e,
                    cur.y + (nxt.y - cur.y) * e
                );
                if (k >= 1) {
                    seg++;
                    phase = 'dwell';
                    t0 = performance.now();
                }
            }
        }, 200);
    }

    function saveWalk(blob) {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'dwell-refuge-walk.webm';
        a.click();
        console.log('dwell:refuge - walk exported');
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
                'samples: ' + (typeof Samples !== 'undefined' ? Samples.status() : 'n/a'),
                'profile: ' + s.profile + '  day: ' + (s.dayness !== undefined ? s.dayness.toFixed(2) : '-'),
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

    // ============================================
    // LIGHTS DOWN (full audio)
    // ============================================

    function lightsDown() {
        document.body.classList.add('audio-only');
        RefugeInput.setVisualFeedback(false);
        // Release the inline tint so the CSS base brown takes over
        soundSpace.style.backgroundColor = '';
    }

    function lightsUp() {
        document.body.classList.remove('audio-only');
        RefugeInput.setVisualFeedback(true);
    }

    function handleZoneEvent(e) {
        if (!hasEntered || reducedMotion) return;
        if (document.body.classList.contains('audio-only')) return;

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

            if (walkMode) {
                // The walk drives the position; input stays off
                runCanonicalWalk();
            } else {
                RefugeInput.activate();
                showHint();
            }

            // After onboarding, the house turns its lights off
            lightsDownTimer = setTimeout(lightsDown, LIGHTS_DOWN_MS);
        }, 1000);
    }

    function leave() {
        if (!hasEntered || isExiting) return;
        isExiting = true;

        if (lightsDownTimer) {
            clearTimeout(lightsDownTimer);
            lightsDownTimer = null;
        }
        lightsUp();

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
