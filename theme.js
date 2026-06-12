/* Light / dark theme toggle — shared across all Lake Garda 2026 pages.
   The initial theme is applied by a tiny inline script in each page's <head>
   (to avoid a flash of the wrong theme). This file wires up the toggle
   button and keeps the choice in localStorage. */
(function () {
    'use strict';

    var STORAGE_KEY = 'theme';

    function currentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'dark'
            ? 'dark'
            : 'light';
    }

    function syncButtons(theme) {
        var isDark = theme === 'dark';
        var buttons = document.querySelectorAll('.theme-toggle');
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            // Show the icon for the mode you'd switch TO.
            btn.textContent = isDark ? '☀️' : '🌙';
            btn.setAttribute(
                'aria-label',
                isDark ? 'Switch to light mode' : 'Switch to dark mode'
            );
            btn.setAttribute('aria-pressed', String(isDark));
            btn.setAttribute('title', isDark ? 'Light mode' : 'Dark mode');
        }
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            /* storage unavailable — ignore */
        }
        syncButtons(theme);
    }

    function init() {
        syncButtons(currentTheme());

        var buttons = document.querySelectorAll('.theme-toggle');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener('click', function () {
                applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
            });
        }

        // Follow the OS preference only while the user hasn't chosen explicitly.
        if (window.matchMedia) {
            var mq = window.matchMedia('(prefers-color-scheme: dark)');
            var onChange = function (e) {
                var stored;
                try {
                    stored = localStorage.getItem(STORAGE_KEY);
                } catch (err) {
                    stored = null;
                }
                if (!stored) {
                    applyTheme(e.matches ? 'dark' : 'light');
                }
            };
            if (mq.addEventListener) {
                mq.addEventListener('change', onChange);
            } else if (mq.addListener) {
                mq.addListener(onChange);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/* Trip countdown — fills any [data-countdown] element (home page hero chip).
   Dates are local to the device; close enough for a countdown chip. */
(function () {
    'use strict';

    function initCountdown() {
        var el = document.querySelector('[data-countdown]');
        if (!el) {
            return;
        }
        var departure = new Date(2026, 5, 27);   // Sat 27 June 2026
        var home = new Date(2026, 6, 8);         // morning after return
        var now = new Date();
        if (now >= departure && now < home) {
            el.textContent = '🏖️ We’re here!';
        } else if (now < departure) {
            var days = Math.ceil((departure - now) / 86400000);
            el.textContent = '⏳ ' + days + (days === 1 ? ' day' : ' days') + ' to go';
        } else {
            el.textContent = '🇮🇹 Arrivederci, Garda!';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCountdown);
    } else {
        initCountdown();
    }
})();

/* Mobile side-menu (off-canvas drawer) toggle. Shared across all pages. */
(function () {
    'use strict';

    function initNav() {
        var toggle = document.querySelector('.nav-toggle');
        var backdrop = document.querySelector('.nav-backdrop');
        var drawer = document.getElementById('nav-links');
        if (!toggle || !drawer) {
            return;
        }

        function setOpen(open) {
            document.body.classList.toggle('nav-open', open);
            toggle.setAttribute('aria-expanded', String(open));
            if (backdrop) {
                backdrop.hidden = !open;
            }
        }

        toggle.addEventListener('click', function () {
            setOpen(!document.body.classList.contains('nav-open'));
        });

        if (backdrop) {
            backdrop.addEventListener('click', function () {
                setOpen(false);
            });
        }

        // Close when a link is tapped or Escape is pressed.
        drawer.addEventListener('click', function (e) {
            if (e.target.closest('a')) {
                setOpen(false);
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                setOpen(false);
            }
        });

        // Reset state if the viewport grows back to desktop width.
        if (window.matchMedia) {
            var mq = window.matchMedia('(min-width: 641px)');
            var onChange = function (e) {
                if (e.matches) {
                    setOpen(false);
                }
            };
            if (mq.addEventListener) {
                mq.addEventListener('change', onChange);
            } else if (mq.addListener) {
                mq.addListener(onChange);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNav);
    } else {
        initNav();
    }
})();
