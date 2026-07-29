// ============================================
// DWELL:REFUGE - Input Handler
// Mouse, touch, keyboard and gyroscope input
// with zone-based color response.
// Throttled for performance.
// ============================================

const RefugeInput = (function() {
    'use strict';

    let cursor = null;
    let glow = null;
    let soundSpace = null;
    let isActive = false;
    let lastPosition = { x: 0.5, y: 0.5 };
    let velocity = 0;
    let lastMoveTime = 0;

    // Throttling for audio updates (~30fps is enough for smooth audio)
    const AUDIO_THROTTLE_MS = 33;
    let lastAudioUpdate = 0;

    // Smoothing for velocity calculation
    const VELOCITY_SMOOTHING = 0.1;
    const VELOCITY_DECAY = 0.95;

    // Keyboard step per keydown (arrow keys)
    const KEY_STEP = 0.02;

    // Idle drift: after enough time without input, the weather
    // comes to you - position creeps toward the nearest hostile zone
    const IDLE_DELAY_MS = 90000;   // 90s of no input before drift starts
    const DRIFT_EASE = 0.0004;     // Per-frame easing (barely perceptible creep)
    const DRIFT_TARGETS = [
        { x: 0.1, y: 0.1 },  // storm
        { x: 0.9, y: 0.1 },  // heat
        { x: 0.1, y: 0.9 },  // flood
        { x: 0.9, y: 0.9 }   // drought
    ];
    let lastUserInputTime = performance.now();
    let driftTarget = null;

    // Velocity is pushed to the audio engine a few times a second
    let lastVelocityPush = 0;
    const VELOCITY_PUSH_MS = 200;

    // Full audio: when the lights go down, position stops painting
    // the background - the sound carries everything
    let visualFeedback = true;

    // Gyroscope state
    let useGyro = false;
    let gyroAvailable = false;
    let gyroButton = null;
    let gyroBase = null;       // Orientation captured when gyro starts
    const GYRO_RANGE = 30;     // Degrees of tilt from start = full travel

    // Zone colors (subtle tints based on climate zones)
    // Base is Heated brown #332b28 (51, 43, 40)
    const ZONE_COLORS = {
        topLeft:     { r: 51, g: 43, b: 48 },  // Storm #332b30 - blue-ish tint
        topRight:    { r: 58, g: 43, b: 40 },  // Heat #3a2b28 - red-ish tint
        bottomLeft:  { r: 43, g: 50, b: 48 },  // Flood #2b3230 - green-ish tint
        bottomRight: { r: 56, g: 50, b: 43 },  // Drought #38322b - yellow-ish tint
        center:      { r: 51, g: 43, b: 40 }   // Refuge #332b28 - neutral brown
    };

    // Interpolate color based on position
    function getZoneColor(x, y) {
        // Bilinear interpolation between corners
        const tl = ZONE_COLORS.topLeft;
        const tr = ZONE_COLORS.topRight;
        const bl = ZONE_COLORS.bottomLeft;
        const br = ZONE_COLORS.bottomRight;

        // Interpolate top edge
        const top = {
            r: tl.r + (tr.r - tl.r) * x,
            g: tl.g + (tr.g - tl.g) * x,
            b: tl.b + (tr.b - tl.b) * x
        };

        // Interpolate bottom edge
        const bottom = {
            r: bl.r + (br.r - bl.r) * x,
            g: bl.g + (br.g - bl.g) * x,
            b: bl.b + (br.b - bl.b) * x
        };

        // Interpolate between top and bottom
        const r = Math.round(top.r + (bottom.r - top.r) * y);
        const g = Math.round(top.g + (bottom.g - top.g) * y);
        const b = Math.round(top.b + (bottom.b - top.b) * y);

        return `rgb(${r}, ${g}, ${b})`;
    }

    function updateBackgroundColor(x, y) {
        if (!soundSpace) return;
        soundSpace.style.backgroundColor = getZoneColor(x, y);
    }

    function init() {
        cursor = document.querySelector('.cursor');
        if (!cursor) {
            cursor = document.createElement('div');
            cursor.className = 'cursor hidden';
            document.body.appendChild(cursor);
        }

        // Soft light that follows the listener's position
        glow = document.querySelector('.cursor-glow');
        if (!glow) {
            glow = document.createElement('div');
            glow.className = 'cursor-glow hidden';
            document.body.appendChild(glow);
        }

        soundSpace = document.getElementById('space');

        // Mouse events
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseenter', () => showCursor());
        document.addEventListener('mouseleave', () => hideCursor());

        // Touch events
        document.addEventListener('touchstart', handleTouch, { passive: true });
        document.addEventListener('touchmove', handleTouch, { passive: true });
        document.addEventListener('touchend', handleTouchEnd);

        // Keyboard navigation (arrow keys)
        document.addEventListener('keydown', handleKey);

        // Check for gyroscope availability
        checkGyroAvailability();

        // Start velocity decay loop
        requestAnimationFrame(updateVelocity);
    }

    function handleMove(e) {
        if (!isActive) return;

        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;

        updatePosition(x, y, e.clientX, e.clientY);
    }

    function handleTouch(e) {
        if (!isActive || !e.touches.length) return;

        const touch = e.touches[0];
        const x = touch.clientX / window.innerWidth;
        const y = touch.clientY / window.innerHeight;

        updatePosition(x, y, touch.clientX, touch.clientY);
    }

    function handleTouchEnd() {
        // Keep last position, just stop updating
    }

    function handleKey(e) {
        if (!isActive) return;

        let x = lastPosition.x;
        let y = lastPosition.y;

        switch (e.key) {
            case 'ArrowLeft':  x -= KEY_STEP; break;
            case 'ArrowRight': x += KEY_STEP; break;
            case 'ArrowUp':    y -= KEY_STEP; break;
            case 'ArrowDown':  y += KEY_STEP; break;
            default: return;
        }

        e.preventDefault();
        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));

        showCursor();
        updatePosition(x, y, x * window.innerWidth, y * window.innerHeight);
    }

    // ============================================
    // GYROSCOPE SUPPORT
    // ============================================

    function checkGyroAvailability() {
        if ('DeviceOrientationEvent' in window) {
            gyroAvailable = true;
        }
    }

    function createGyroButton() {
        if (gyroButton) return;

        gyroButton = document.createElement('button');
        gyroButton.className = 'gyro-button';
        gyroButton.textContent = 'use motion';
        gyroButton.addEventListener('click', requestGyroPermission);

        document.body.appendChild(gyroButton);
    }

    function removeGyroButton() {
        if (gyroButton) {
            gyroButton.remove();
            gyroButton = null;
        }
    }

    function requestGyroPermission() {
        // iOS 13+ requires explicit permission
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(function(permission) {
                    if (permission === 'granted') {
                        enableGyro();
                        removeGyroButton();
                    }
                })
                .catch(function(error) {
                    console.log('Gyro permission error:', error);
                });
        } else {
            // Android and older iOS
            enableGyro();
            removeGyroButton();
        }
    }

    function enableGyro() {
        useGyro = true;
        gyroBase = null;  // Recalibrate to however the device is held now
        window.addEventListener('deviceorientation', handleOrientation);

        // Hide the crosshair cursor; the glow shows position instead
        if (cursor) cursor.classList.add('hidden');
        if (glow) glow.classList.remove('hidden');
    }

    function disableGyro() {
        useGyro = false;
        gyroBase = null;
        window.removeEventListener('deviceorientation', handleOrientation);
    }

    function handleOrientation(e) {
        if (!useGyro || !isActive) return;
        if (e.beta === null || e.gamma === null) return;

        // Calibrate to the orientation the device is held in when
        // gyro starts, so it works flat on a table or held upright
        if (!gyroBase) {
            gyroBase = { beta: e.beta, gamma: e.gamma };
        }

        // ±GYRO_RANGE degrees of tilt from the start position = full travel
        let x = 0.5 + (e.gamma - gyroBase.gamma) / (GYRO_RANGE * 2);
        let y = 0.5 + (e.beta - gyroBase.beta) / (GYRO_RANGE * 2);

        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));

        updatePosition(x, y, x * window.innerWidth, y * window.innerHeight);
    }

    function isMobile() {
        return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    }

    // ============================================
    // POSITION UPDATE
    // ============================================

    function updatePosition(x, y, screenX, screenY, isUserInput = true) {
        const now = performance.now();

        if (isUserInput) {
            lastUserInputTime = now;
            driftTarget = null;  // User takes control back from idle drift
        }

        // Calculate velocity from movement
        const dx = x - lastPosition.x;
        const dy = y - lastPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const dt = now - lastMoveTime;

        if (dt > 0) {
            const instantVelocity = distance / (dt / 1000);
            velocity = velocity * (1 - VELOCITY_SMOOTHING) + instantVelocity * VELOCITY_SMOOTHING;
        }

        lastPosition.x = x;
        lastPosition.y = y;
        lastMoveTime = now;

        // Update cursor + glow position (every frame for smooth visuals)
        if (cursor) {
            cursor.style.left = screenX + 'px';
            cursor.style.top = screenY + 'px';
        }
        if (glow) {
            glow.style.left = screenX + 'px';
            glow.style.top = screenY + 'px';
        }

        // Throttle audio updates (~30fps is sufficient for smooth transitions)
        if (now - lastAudioUpdate >= AUDIO_THROTTLE_MS) {
            lastAudioUpdate = now;

            // Send to audio engine
            if (typeof RefugeAudio !== 'undefined') {
                RefugeAudio.setPosition(x, y);
            }

            // Update background color (unless the lights are down)
            if (visualFeedback) {
                updateBackgroundColor(x, y);
            }
        }
    }

    function updateVelocity() {
        // Decay velocity over time
        velocity *= VELOCITY_DECAY;

        const now = performance.now();

        // Keep the audio engine informed even when no events fire
        // (otherwise stillness would never register after stopping)
        if (now - lastVelocityPush >= VELOCITY_PUSH_MS) {
            lastVelocityPush = now;
            if (typeof RefugeAudio !== 'undefined') {
                RefugeAudio.setVelocity(velocity);
            }
        }

        updateIdleDrift(now);

        requestAnimationFrame(updateVelocity);
    }

    // ============================================
    // IDLE DRIFT - the weather comes to you
    // ============================================

    function updateIdleDrift(now) {
        if (!isActive ||
            typeof RefugeAudio === 'undefined' || !RefugeAudio.isRunning() ||
            now - lastUserInputTime < IDLE_DELAY_MS) {
            driftTarget = null;
            return;
        }

        if (!driftTarget) {
            // The nearest hostile zone encroaches
            let best = null;
            let bestDist = Infinity;
            DRIFT_TARGETS.forEach(t => {
                const d = Math.hypot(t.x - lastPosition.x, t.y - lastPosition.y);
                if (d < bestDist) {
                    bestDist = d;
                    best = t;
                }
            });
            driftTarget = best;
        }

        const x = lastPosition.x + (driftTarget.x - lastPosition.x) * DRIFT_EASE;
        const y = lastPosition.y + (driftTarget.y - lastPosition.y) * DRIFT_EASE;

        updatePosition(x, y, x * window.innerWidth, y * window.innerHeight, false);
    }

    function showCursor() {
        if (cursor && !useGyro) {
            cursor.classList.remove('hidden');
        }
        if (glow) {
            glow.classList.remove('hidden');
        }
    }

    function hideCursor() {
        if (cursor) {
            cursor.classList.add('hidden');
        }
        // Keep the glow while gyro drives position
        if (glow && !useGyro) {
            glow.classList.add('hidden');
        }
    }

    function activate() {
        isActive = true;
        visualFeedback = true;
        showCursor();

        // Show gyro button on mobile if available
        if (isMobile() && gyroAvailable && !useGyro) {
            createGyroButton();
        }
    }

    function deactivate() {
        isActive = false;
        disableGyro();
        hideCursor();
        removeGyroButton();
        if (glow) glow.classList.add('hidden');
    }

    return {
        init: init,
        activate: activate,
        deactivate: deactivate,
        getPosition: function() {
            return { ...lastPosition };
        },
        getVelocity: function() {
            return velocity;
        },
        isUsingGyro: function() {
            return useGyro;
        },
        setVisualFeedback: function(v) {
            visualFeedback = !!v;
        },
        hasGyro: function() {
            return gyroAvailable;
        }
    };
})();
