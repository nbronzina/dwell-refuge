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
    const backLink = document.querySelector('.back-link');

    // State
    let hasEntered = false;
    let isExiting = false;

    // Initialize
    function init() {
        RefugeInput.init();

        // Entry button
        enterBtn.addEventListener('click', enter);
        enterBtn.addEventListener('touchend', function(e) {
            e.preventDefault();
            enter();
        });

        // Back link with graceful exit
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

        // Graceful exit on page unload
        window.addEventListener('beforeunload', function() {
            if (hasEntered) {
                RefugeAudio.gracefulExit();
            }
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
        if (!hasEntered || isExiting) return;
        isExiting = true;

        // Graceful audio fade out
        RefugeAudio.gracefulExit().then(function() {
            // Deactivate input
            RefugeInput.deactivate();

            // Reset UI
            soundSpace.classList.add('hidden');
            entryScreen.style.display = '';
            entryScreen.classList.remove('fade-out');

            hasEntered = false;
            isExiting = false;
        });
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
