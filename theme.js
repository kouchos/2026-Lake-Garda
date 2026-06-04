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
