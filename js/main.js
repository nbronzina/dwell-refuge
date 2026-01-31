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

    // State
    let hasEntered = false;

    // Initialize
    function init() {
        RefugeInput.init();

        // Entry button
        enterBtn.addEventListener('click', enter);
        enterBtn.addEventListener('touchend', function(e) {
            e.preventDefault();
            enter();
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
    }

    function enter() {
        if (hasEntered) return;
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
        if (!hasEntered) return;

        // Stop audio
        RefugeAudio.stop();

        // Deactivate input
        RefugeInput.deactivate();

        // Reset UI
        soundSpace.classList.add('hidden');
        entryScreen.style.display = '';
        entryScreen.classList.remove('fade-out');

        hasEntered = false;
    }

    function showHint() {
        // Show hint after a moment
        setTimeout(function() {
            hint.classList.add('visible');

            // Fade hint after interaction
            setTimeout(function() {
                hint.classList.remove('visible');
                hint.classList.add('fade');
            }, 4000);
        }, 2000);
    }

    // Start when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
