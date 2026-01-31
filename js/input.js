// ============================================
// DWELL:REFUGE - Input Handler
// Cursor tracking with zone-based color response
// ============================================

const RefugeInput = (function() {
    'use strict';

    let cursor = null;
    let soundSpace = null;
    let isActive = false;
    let lastPosition = { x: 0.5, y: 0.5 };
    let velocity = 0;
    let lastMoveTime = 0;

    // Smoothing for velocity calculation
    const VELOCITY_SMOOTHING = 0.1;
    const VELOCITY_DECAY = 0.95;

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

        soundSpace = document.getElementById('space');

        // Mouse events
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseenter', () => showCursor());
        document.addEventListener('mouseleave', () => hideCursor());

        // Touch events
        document.addEventListener('touchstart', handleTouch, { passive: true });
        document.addEventListener('touchmove', handleTouch, { passive: true });
        document.addEventListener('touchend', handleTouchEnd);

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

    function updatePosition(x, y, screenX, screenY) {
        // Calculate velocity from movement
        const dx = x - lastPosition.x;
        const dy = y - lastPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const now = performance.now();
        const dt = now - lastMoveTime;

        if (dt > 0) {
            const instantVelocity = distance / (dt / 1000);
            velocity = velocity * (1 - VELOCITY_SMOOTHING) + instantVelocity * VELOCITY_SMOOTHING;
        }

        lastPosition.x = x;
        lastPosition.y = y;
        lastMoveTime = now;

        // Update cursor position
        if (cursor) {
            cursor.style.left = screenX + 'px';
            cursor.style.top = screenY + 'px';
        }

        // Send to audio engine
        if (typeof RefugeAudio !== 'undefined') {
            RefugeAudio.setPosition(x, y);
        }

        // Update background color
        updateBackgroundColor(x, y);
    }

    function updateVelocity() {
        // Decay velocity over time
        velocity *= VELOCITY_DECAY;
        requestAnimationFrame(updateVelocity);
    }

    function showCursor() {
        if (cursor) {
            cursor.classList.remove('hidden');
        }
    }

    function hideCursor() {
        if (cursor) {
            cursor.classList.add('hidden');
        }
    }

    function activate() {
        isActive = true;
        showCursor();
    }

    function deactivate() {
        isActive = false;
        hideCursor();
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
        }
    };
})();
