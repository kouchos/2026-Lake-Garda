/* Progressive-web-app glue — shared across all Lake Garda 2026 pages.
   Registers the offline service worker and offers an "Install app" button
   in the nav when the browser says the site is installable and it isn't
   already installed (running standalone). The button is injected by JS so
   browsers without install support never show a dead control. */
(function () {
    'use strict';

    if ('serviceWorker' in navigator) {
        /* When a freshly-deployed worker takes control, reload once so the
           page shows the new content instead of the previously cached copy.
           Only do this for real updates — the first install also claims the
           page (no prior controller), and that shouldn't trigger a reload. */
        var hadController = !!navigator.serviceWorker.controller;
        var reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
            if (reloading || !hadController) {
                return;
            }
            reloading = true;
            window.location.reload();
        });

        window.addEventListener('load', function () {
            navigator.serviceWorker.register('sw.js').then(function (reg) {
                /* Check for an updated worker each time the app is opened, so
                   content refreshes whenever the device is back online. */
                reg.update();
                reg.addEventListener('updatefound', function () {
                    var sw = reg.installing;
                    if (!sw) {
                        return;
                    }
                    sw.addEventListener('statechange', function () {
                        /* A new worker has installed while an old one controls
                           the page — activate it immediately. */
                        if (sw.state === 'installed' &&
                            navigator.serviceWorker.controller) {
                            sw.postMessage('skip-waiting');
                        }
                    });
                });
            }).catch(function () {
                /* offline support is progressive enhancement — ignore */
            });
        });
    }

    function isStandalone() {
        return (window.matchMedia &&
                window.matchMedia('(display-mode: standalone)').matches) ||
            window.navigator.standalone === true;
    }

    var deferredPrompt = null;
    var installBtn = null;

    function ensureButton() {
        if (installBtn) {
            return installBtn;
        }
        var nav = document.getElementById('site-nav');
        var themeToggle = nav && nav.querySelector('.theme-toggle');
        if (!nav || !themeToggle) {
            return null;
        }
        installBtn = document.createElement('button');
        installBtn.type = 'button';
        installBtn.className = 'install-btn';
        installBtn.innerHTML = '<span aria-hidden="true">📲</span> Install app';
        installBtn.addEventListener('click', function () {
            if (!deferredPrompt) {
                return;
            }
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function (choice) {
                if (choice && choice.outcome === 'accepted') {
                    installBtn.hidden = true;
                }
                deferredPrompt = null;
            });
        });
        nav.insertBefore(installBtn, themeToggle);
        return installBtn;
    }

    window.addEventListener('beforeinstallprompt', function (event) {
        event.preventDefault();
        if (isStandalone()) {
            return;
        }
        deferredPrompt = event;
        var btn = ensureButton();
        if (btn) {
            btn.hidden = false;
        }
    });

    window.addEventListener('appinstalled', function () {
        deferredPrompt = null;
        if (installBtn) {
            installBtn.hidden = true;
        }
    });
})();
