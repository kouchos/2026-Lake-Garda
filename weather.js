/* Weather for the Lake Garda 2026 planner.
   Pulls a 7-day forecast for the accommodation (Del Garda Village & Camping,
   Peschiera del Garda) from Open-Meteo — a free, key-less, CORS-enabled API,
   which suits a static GitHub-Pages site with no server to hold secrets.

   The same script powers two surfaces and only renders what it finds:
     • the home page — a compact "today" card (#weather-home)
     • weather.html  — current conditions, today's hourly strip, tomorrow split
                        into morning/afternoon/evening/night, and one card per
                        day out to 7 days, plus derived severe-weather warnings.

   Offline-friendly: the last successful response is saved to localStorage and
   shown instantly on load (and whenever the network is unavailable), then
   refreshed in the background when online. The service worker also caches the
   API request, so installed/offline apps still have a forecast to fall back on. */
(function () {
    'use strict';

    /* Del Garda Village & Camping, Via Marzan 92, Peschiera del Garda. */
    var LAT = 45.4339;
    var LON = 10.6866;
    var TZ = 'Europe/Rome';

    var CACHE_KEY = 'garda-weather-cache-v1';
    var NAAS_CACHE_KEY = 'garda-weather-naas-v1';
    var MAX_AGE_MS = 30 * 60 * 1000;   /* consider data "fresh" for 30 min */

    /* Naas, Co. Kildare, Ireland — a subtle "comparison with home" shown only
       on the weather page (never on the home card). Requested in the resort
       timezone so its hourly/daily arrays line up, by time-string, with the
       resort's (same instant in time). */
    var NAAS_LAT = 53.2158;
    var NAAS_LON = -6.6669;

    /* Lookup maps for the Naas comparison, populated once its data lands. */
    var naasMaps = null;

    function buildUrl(lat, lon) {
        return 'https://api.open-meteo.com/v1/forecast'
            + '?latitude=' + lat + '&longitude=' + lon
            + '&timezone=' + encodeURIComponent(TZ)
            + '&forecast_days=7'
            + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,'
            + 'is_day,weather_code,wind_speed_10m'
            + '&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,'
            + 'precipitation_probability,precipitation,weather_code,wind_speed_10m,is_day'
            + '&daily=weather_code,temperature_2m_max,temperature_2m_min,'
            + 'apparent_temperature_max,precipitation_sum,precipitation_probability_max,'
            + 'wind_speed_10m_max,uv_index_max';
    }

    var API_URL = buildUrl(LAT, LON);
    var NAAS_URL = buildUrl(NAAS_LAT, NAAS_LON);

    /* ---- WMO weather-code → emoji + label ----------------------------------
       Clear/partly-cloudy codes get a night variant so hourly cells and the
       "current" card read correctly after dark. */
    function describe(code, isDay) {
        var day = isDay !== 0;
        switch (code) {
            case 0:  return { emoji: day ? '☀️' : '🌙', label: 'Clear sky' };
            case 1:  return { emoji: day ? '🌤️' : '🌙', label: 'Mainly clear' };
            case 2:  return { emoji: day ? '⛅' : '☁️', label: 'Partly cloudy' };
            case 3:  return { emoji: '☁️', label: 'Overcast' };
            case 45: case 48: return { emoji: '🌫️', label: 'Fog' };
            case 51: return { emoji: '🌦️', label: 'Light drizzle' };
            case 53: return { emoji: '🌦️', label: 'Drizzle' };
            case 55: return { emoji: '🌧️', label: 'Heavy drizzle' };
            case 56: case 57: return { emoji: '🌧️', label: 'Freezing drizzle' };
            case 61: return { emoji: '🌦️', label: 'Light rain' };
            case 63: return { emoji: '🌧️', label: 'Rain' };
            case 65: return { emoji: '🌧️', label: 'Heavy rain' };
            case 66: case 67: return { emoji: '🌧️', label: 'Freezing rain' };
            case 71: return { emoji: '🌨️', label: 'Light snow' };
            case 73: return { emoji: '🌨️', label: 'Snow' };
            case 75: return { emoji: '❄️', label: 'Heavy snow' };
            case 77: return { emoji: '🌨️', label: 'Snow grains' };
            case 80: return { emoji: '🌦️', label: 'Light showers' };
            case 81: return { emoji: '🌧️', label: 'Showers' };
            case 82: return { emoji: '⛈️', label: 'Violent showers' };
            case 85: case 86: return { emoji: '🌨️', label: 'Snow showers' };
            case 95: return { emoji: '⛈️', label: 'Thunderstorm' };
            case 96: case 99: return { emoji: '⛈️', label: 'Thunderstorm & hail' };
            default: return { emoji: '🌡️', label: 'Unknown' };
        }
    }

    function isThunder(code) {
        return code === 95 || code === 96 || code === 99 || code === 82;
    }

    /* Banded colour class for a temperature, used to tint the big numbers. */
    function tempClass(t) {
        if (t == null || isNaN(t)) { return ''; }
        if (t < 5)  { return 't-cold'; }
        if (t < 15) { return 't-cool'; }
        if (t < 23) { return 't-mild'; }
        if (t < 28) { return 't-warm'; }
        if (t < 33) { return 't-hot'; }
        return 't-scorch';
    }

    function round(n) { return Math.round(n); }
    function temp(n)  { return (n == null || isNaN(n)) ? '–' : round(n) + '°'; }

    /* The API returns wall-clock strings for the resort timezone
       ("2026-06-27T14:00"). Parse the parts directly so we never re-interpret
       them in the device's own timezone. */
    function parseTime(s) {
        return {
            date: s.slice(0, 10),
            hour: parseInt(s.slice(11, 13), 10),
            hhmm: s.slice(11, 16)
        };
    }

    var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function dayName(dateStr) {
        var p = dateStr.split('-');
        var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        return WEEKDAYS[d.getDay()];
    }

    function dayLong(dateStr) {
        var p = dateStr.split('-');
        var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        return WEEKDAYS[d.getDay()] + ' ' + Number(p[2]) + ' ' + MONTHS[d.getMonth()];
    }

    function humidityBar(pct) {
        var v = (pct == null || isNaN(pct)) ? 0 : Math.max(0, Math.min(100, pct));
        return '<span class="hum-bar" aria-hidden="true"><span class="hum-fill" '
            + 'style="width:' + v + '%"></span></span>';
    }

    /* ---- Caching ----------------------------------------------------------- */
    function loadJSON(key) {
        try {
            var raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function saveJSON(key, data) {
        try {
            localStorage.setItem(key,
                JSON.stringify({ savedAt: Date.now(), data: data }));
        } catch (e) { /* storage full / unavailable — ignore */ }
    }

    /* Build fast lookups for the Naas comparison: temperature by hour-string,
       and high/low/code by date. */
    function buildNaasMaps(payload) {
        if (!payload || !payload.hourly || !payload.daily) { return null; }
        var h = {};
        for (var i = 0; i < payload.hourly.time.length; i++) {
            h[payload.hourly.time[i]] = payload.hourly.temperature_2m[i];
        }
        var dc = {};
        for (var j = 0; j < payload.daily.time.length; j++) {
            dc[payload.daily.time[j]] = {
                max: payload.daily.temperature_2m_max[j],
                min: payload.daily.temperature_2m_min[j],
                code: payload.daily.weather_code[j]
            };
        }
        return { h: h, dc: dc, cur: payload.current };
    }

    function agoLabel(ts) {
        var mins = Math.round((Date.now() - ts) / 60000);
        if (mins < 1)  { return 'just now'; }
        if (mins < 60) { return mins + ' min ago'; }
        var hrs = Math.round(mins / 60);
        if (hrs < 24)  { return hrs + (hrs === 1 ? ' hour ago' : ' hours ago'); }
        var days = Math.round(hrs / 24);
        return days + (days === 1 ? ' day ago' : ' days ago');
    }

    /* ---- Severe-weather warnings ------------------------------------------
       Open-Meteo's free forecast has no official alerts feed, so we derive
       practical heat / rain / lightning flags from the 7-day daily data and
       label them clearly as forecast-based. */
    function buildWarnings(daily) {
        var out = [];
        var n = daily.time.length;
        var i;

        var hotDays = [], scorchDays = [];
        for (i = 0; i < n; i++) {
            var mx = daily.temperature_2m_max[i];
            if (mx >= 36) { scorchDays.push(daily.time[i]); }
            else if (mx >= 32) { hotDays.push(daily.time[i]); }
        }
        if (scorchDays.length) {
            out.push({ level: 'severe', icon: '🔥', title: 'Extreme heat',
                detail: 'Highs at or above 36° on ' + listDays(scorchDays)
                    + '. Keep the kids hydrated and shaded, avoid midday sun.' });
        } else if (hotDays.length) {
            out.push({ level: 'warning', icon: '🥵', title: 'High heat',
                detail: 'Highs of 32°+ on ' + listDays(hotDays)
                    + '. Plan water/shade and an indoor or pool break midday.' });
        }

        var heavyRain = [], wetDays = [];
        for (i = 0; i < n; i++) {
            var sum = daily.precipitation_sum[i];
            var prob = daily.precipitation_probability_max[i];
            if (sum >= 25) { heavyRain.push(daily.time[i]); }
            else if (sum >= 8 || prob >= 70) { wetDays.push(daily.time[i]); }
        }
        if (heavyRain.length) {
            out.push({ level: 'severe', icon: '🌊', title: 'Heavy rain',
                detail: 'Significant rain expected on ' + listDays(heavyRain)
                    + '. Have a wet-weather plan ready.' });
        } else if (wetDays.length) {
            out.push({ level: 'warning', icon: '🌧️', title: 'Rain likely',
                detail: 'A good chance of rain on ' + listDays(wetDays) + '.' });
        }

        var stormDays = [];
        for (i = 0; i < n; i++) {
            if (isThunder(daily.weather_code[i])) { stormDays.push(daily.time[i]); }
        }
        if (stormDays.length) {
            out.push({ level: 'severe', icon: '⚡', title: 'Thunderstorms',
                detail: 'Lightning possible on ' + listDays(stormDays)
                    + '. Stay off the lake and away from open ground if storms roll in.' });
        }

        return out;
    }

    function listDays(dates) {
        var names = dates.map(dayName);
        if (names.length === 1) { return names[0]; }
        if (names.length === 2) { return names[0] + ' & ' + names[1]; }
        return names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];
    }

    /* ---- Per-day humidity (mean of that date's hourly values) -------------- */
    function humidityByDate(hourly) {
        var sums = {}, counts = {};
        for (var i = 0; i < hourly.time.length; i++) {
            var d = hourly.time[i].slice(0, 10);
            var h = hourly.relative_humidity_2m[i];
            if (h == null) { continue; }
            sums[d] = (sums[d] || 0) + h;
            counts[d] = (counts[d] || 0) + 1;
        }
        var out = {};
        for (var k in sums) {
            if (sums.hasOwnProperty(k)) { out[k] = Math.round(sums[k] / counts[k]); }
        }
        return out;
    }

    /* =======================================================================
       Rendering
       ======================================================================= */

    /* Home page — compact "today" card. */
    function renderHome(data, meta) {
        var host = document.getElementById('weather-home');
        if (!host) { return; }
        var c = data.current;
        var d = describe(c.weather_code, c.is_day);
        var warnings = buildWarnings(data.daily);

        var warnHtml = '';
        if (warnings.length) {
            var w = warnings[0];
            warnHtml = '<p class="wh-warn ' + w.level + '">'
                + '<span aria-hidden="true">' + w.icon + '</span> '
                + '<strong>' + w.title + '</strong> — see the forecast</p>';
        }

        host.innerHTML =
            '<a class="weather-home-card" href="weather.html">'
            +   '<span class="wh-icon" aria-hidden="true">' + d.emoji + '</span>'
            +   '<span class="wh-main">'
            +     '<span class="wh-temp ' + tempClass(c.temperature_2m) + '">'
            +        temp(c.temperature_2m) + '</span>'
            +     '<span class="wh-label">' + d.label
            +        ' · feels ' + temp(c.apparent_temperature) + '</span>'
            +     '<span class="wh-meta">💧 ' + round(c.relative_humidity_2m) + '%'
            +        '  ·  💨 ' + round(c.wind_speed_10m) + ' km/h</span>'
            +   '</span>'
            +   '<span class="wh-cta">7-day forecast →</span>'
            + '</a>'
            + warnHtml
            + '<p class="wh-updated">' + meta + '</p>';
        host.hidden = false;
    }

    /* weather.html — full forecast. */
    function renderPage(data, meta) {
        if (!document.getElementById('wx-current')) { return; }
        setStatus(meta);
        renderWarnings(buildWarnings(data.daily));
        renderCurrent(data.current);
        renderHourly(data);
        renderTomorrow(data);
        renderDays(data);
    }

    function setStatus(meta) {
        var el = document.getElementById('weather-status');
        if (el) { el.querySelector('.ws-text').textContent = meta; }
    }

    function renderWarnings(warnings) {
        var host = document.getElementById('wx-warnings');
        if (!host) { return; }
        if (!warnings.length) {
            host.innerHTML = '<div class="wx-warn ok">'
                + '<span class="wx-warn-icon" aria-hidden="true">✅</span>'
                + '<div><strong>No severe weather expected</strong>'
                + '<p>No heat, heavy-rain or lightning flags in the next 7 days.</p></div>'
                + '</div>';
            return;
        }
        host.innerHTML = warnings.map(function (w) {
            return '<div class="wx-warn ' + w.level + '">'
                + '<span class="wx-warn-icon" aria-hidden="true">' + w.icon + '</span>'
                + '<div><strong>' + w.title
                + ' <span class="wx-warn-tag">' + w.level + '</span></strong>'
                + '<p>' + w.detail + '</p></div>'
                + '</div>';
        }).join('');
    }

    /* A muted "vs Naas" line for the current card, e.g.
       "☘️ Naas now 24° · Clear sky (3° cooler)". Empty if Naas isn't loaded. */
    function naasCurrentLine(c) {
        if (!naasMaps || !naasMaps.cur) { return ''; }
        var nc = naasMaps.cur;
        var nd = describe(nc.weather_code, nc.is_day);
        var delta = round(nc.temperature_2m) - round(c.temperature_2m);
        var deltaTxt = delta === 0 ? 'about the same'
            : Math.abs(delta) + '° ' + (delta < 0 ? 'cooler' : 'warmer');
        return '<div class="wx-naas wx-cur-naas">☘️ Naas now ' + temp(nc.temperature_2m)
            + ' · ' + nd.label + ' (' + deltaTxt + ')</div>';
    }

    function renderCurrent(c) {
        var host = document.getElementById('wx-current');
        if (!host) { return; }
        var d = describe(c.weather_code, c.is_day);
        host.innerHTML =
            '<div class="wx-cur-icon" aria-hidden="true">' + d.emoji + '</div>'
            + '<div class="wx-cur-body">'
            +   '<div class="wx-cur-temp ' + tempClass(c.temperature_2m) + '">'
            +      temp(c.temperature_2m) + '</div>'
            +   '<div class="wx-cur-label">' + d.label + '</div>'
            +   '<div class="wx-cur-stats">'
            +     '<span>🌡️ Feels ' + temp(c.apparent_temperature) + '</span>'
            +     '<span>💧 ' + round(c.relative_humidity_2m) + '%</span>'
            +     '<span>💨 ' + round(c.wind_speed_10m) + ' km/h</span>'
            +   '</div>'
            +   naasCurrentLine(c)
            + '</div>';
    }

    function renderHourly(data) {
        var host = document.getElementById('wx-hourly');
        if (!host) { return; }
        var h = data.hourly;
        var today = data.daily.time[0];
        var nowHour = parseTime(data.current.time).hour;
        var cells = '';
        var nowIndex = -1, shown = 0;
        for (var i = 0; i < h.time.length; i++) {
            var t = parseTime(h.time[i]);
            if (t.date !== today) { continue; }
            var d = describe(h.weather_code[i], h.is_day[i]);
            var cls = 'wx-hour';
            if (t.hour < nowHour) { cls += ' is-past'; }
            if (t.hour === nowHour) { cls += ' is-now'; nowIndex = shown; }
            var prob = h.precipitation_probability[i];
            var naasT = naasMaps && naasMaps.h ? naasMaps.h[h.time[i]] : null;
            var naasCell = (naasT == null) ? ''
                : '<div class="wx-naas">☘️ ' + temp(naasT) + '</div>';
            cells +=
                '<div class="' + cls + '">'
                + '<div class="wx-hour-time">' + (t.hour === nowHour ? 'Now' : t.hhmm) + '</div>'
                + '<div class="wx-hour-icon" aria-hidden="true">' + d.emoji + '</div>'
                + '<div class="wx-hour-temp ' + tempClass(h.temperature_2m[i]) + '">'
                +    temp(h.temperature_2m[i]) + '</div>'
                + '<div class="wx-hour-rain' + (prob >= 30 ? ' on' : '') + '">💧'
                +    (prob == null ? 0 : round(prob)) + '%</div>'
                + '<div class="wx-hour-hum">' + round(h.relative_humidity_2m[i]) + '%</div>'
                + naasCell
                + '</div>';
            shown++;
        }
        host.innerHTML = cells;
        /* nudge the strip so "Now" is in view on load */
        if (nowIndex > 0) {
            var cell = host.children[nowIndex];
            if (cell) { host.scrollLeft = Math.max(0, cell.offsetLeft - 12); }
        }
    }

    /* Tomorrow split into four parts. Each part summarises its hours:
       average temp/humidity, peak rain chance, and the "worst" weather code
       in the window (higher WMO codes ≈ more disruptive — handy for planning). */
    var PARTS = [
        { key: 'Morning',   emoji: '🌅', from: 6,  to: 12 },
        { key: 'Afternoon', emoji: '☀️', from: 12, to: 18 },
        { key: 'Evening',   emoji: '🌆', from: 18, to: 24 },
        { key: 'Night',     emoji: '🌙', from: 0,  to: 6 }
    ];

    function renderTomorrow(data) {
        var host = document.getElementById('wx-tomorrow');
        if (!host) { return; }
        var tomorrow = data.daily.time[1];
        if (!tomorrow) { host.innerHTML = ''; return; }
        var h = data.hourly;

        host.innerHTML = PARTS.map(function (part) {
            var temps = [], hums = [], codes = [], naasTemps = [], rain = 0;
            for (var i = 0; i < h.time.length; i++) {
                var t = parseTime(h.time[i]);
                if (t.date !== tomorrow) { continue; }
                if (t.hour < part.from || t.hour >= part.to) { continue; }
                temps.push(h.temperature_2m[i]);
                hums.push(h.relative_humidity_2m[i]);
                codes.push(h.weather_code[i]);
                if (naasMaps && naasMaps.h) {
                    var nt = naasMaps.h[h.time[i]];
                    if (nt != null) { naasTemps.push(nt); }
                }
                var p = h.precipitation_probability[i];
                if (p != null && p > rain) { rain = p; }
            }
            if (!temps.length) { return ''; }
            var avgT = temps.reduce(add, 0) / temps.length;
            var avgH = Math.round(hums.reduce(add, 0) / hums.length);
            var worst = codes.reduce(function (a, b) { return Math.max(a, b); }, 0);
            /* Night uses the moon regardless of the daytime icon. */
            var d = describe(worst, part.key === 'Night' ? 0 : 1);
            var naasLine = naasTemps.length
                ? '<div class="wx-naas">☘️ Naas ' + temp(naasTemps.reduce(add, 0) / naasTemps.length) + '</div>'
                : '';
            return '<div class="wx-part">'
                + '<div class="wx-part-head"><span aria-hidden="true">' + part.emoji
                +    '</span> ' + part.key + '</div>'
                + '<div class="wx-part-icon" aria-hidden="true">' + d.emoji + '</div>'
                + '<div class="wx-part-temp ' + tempClass(avgT) + '">' + temp(avgT) + '</div>'
                + '<div class="wx-part-label">' + d.label + '</div>'
                + '<div class="wx-part-stats">'
                +   '<span class="' + (rain >= 30 ? 'on' : '') + '">💧 ' + round(rain) + '% rain</span>'
                +   '<span>💦 ' + avgH + '% hum</span>'
                + '</div>'
                + humidityBar(avgH)
                + naasLine
                + '</div>';
        }).join('');
    }

    function add(a, b) { return a + b; }

    /* Days 3–7: one summary card each. */
    function renderDays(data) {
        var host = document.getElementById('wx-daily');
        if (!host) { return; }
        var dy = data.daily;
        var hums = humidityByDate(data.hourly);
        var html = '';
        for (var i = 2; i < dy.time.length; i++) {
            var date = dy.time[i];
            var d = describe(dy.weather_code[i], 1);
            var hum = hums[date];
            var nd = naasMaps && naasMaps.dc ? naasMaps.dc[date] : null;
            var naasChip = nd
                ? '<span class="wx-naas">☘️ ' + temp(nd.max) + '/' + temp(nd.min) + '</span>'
                : '';
            html += '<div class="wx-day">'
                + '<div class="wx-day-name">' + dayLong(date) + '</div>'
                + '<div class="wx-day-icon" aria-hidden="true">' + d.emoji + '</div>'
                + '<div class="wx-day-label">' + d.label + '</div>'
                + '<div class="wx-day-temps">'
                +   '<span class="wx-hi ' + tempClass(dy.temperature_2m_max[i]) + '">'
                +      temp(dy.temperature_2m_max[i]) + '</span>'
                +   '<span class="wx-lo">' + temp(dy.temperature_2m_min[i]) + '</span>'
                + '</div>'
                + '<div class="wx-day-stats">'
                +   '<span class="' + (dy.precipitation_probability_max[i] >= 30 ? 'on' : '') + '">'
                +      '💧 ' + round(dy.precipitation_probability_max[i] || 0) + '%</span>'
                +   '<span>💦 ' + (hum == null ? '–' : hum + '%') + '</span>'
                +   '<span>☀️ UV ' + round(dy.uv_index_max[i] || 0) + '</span>'
                +   '<span>💨 ' + round(dy.wind_speed_10m_max[i] || 0) + '</span>'
                +   naasChip
                + '</div>'
                + '</div>';
        }
        host.innerHTML = html;
    }

    /* =======================================================================
       Load + refresh
       ======================================================================= */
    /* Latest resort forecast + its status label, kept so we can repaint when
       the (best-effort) Naas comparison arrives a moment later. */
    var state = { data: null, meta: '' };

    function paint() {
        if (!state.data) { return; }
        renderHome(state.data, state.meta);
        renderPage(state.data, state.meta);
    }

    function render(data, meta) {
        state.data = data;
        state.meta = meta;
        paint();
    }

    function fetchJSON(url) {
        return fetch(url, { cache: 'no-store' }).then(function (r) {
            if (!r.ok) { throw new Error('HTTP ' + r.status); }
            return r.json();
        });
    }

    function markRendered() {
        var home = document.getElementById('weather-home');
        if (home) { home.dataset.rendered = '1'; }
    }

    /* Best-effort Naas comparison: fetch, cache and repaint when it lands.
       A failure here never blocks or disturbs the main forecast. */
    function loadNaas() {
        fetchJSON(NAAS_URL).then(function (d) {
            saveJSON(NAAS_CACHE_KEY, d);
            naasMaps = buildNaasMaps(d);
            paint();
        }).catch(function () { /* keep any cached Naas data we already showed */ });
    }

    function showError() {
        var el = document.getElementById('weather-status');
        if (el) { el.querySelector('.ws-text').textContent =
            'Weather unavailable — connect to the internet to load the forecast.'; }
        var home = document.getElementById('weather-home');
        if (home && !home.dataset.rendered) {
            home.innerHTML = '<p class="wh-offline">🌐 Weather will appear here once online.</p>';
            home.hidden = false;
        }
    }

    function init() {
        var onWeatherPage = !!document.getElementById('wx-current');
        var hasSurface = document.getElementById('weather-home') || onWeatherPage;
        if (!hasSurface) { return; }

        var cached = loadJSON(CACHE_KEY);
        var naasCached = loadJSON(NAAS_CACHE_KEY);
        if (naasCached && naasCached.data) { naasMaps = buildNaasMaps(naasCached.data); }

        if (cached && cached.data) {
            render(cached.data, 'Updated ' + agoLabel(cached.savedAt));
            markRendered();
        } else {
            setStatus('Loading forecast…');
        }

        /* Skip the network call if we just refreshed and we're offline — but
           always try when the cache is missing or stale. */
        var fresh = cached && (Date.now() - cached.savedAt) < MAX_AGE_MS;
        if (fresh && !navigator.onLine) { return; }

        fetchJSON(API_URL).then(function (data) {
            saveJSON(CACHE_KEY, data);
            render(data, 'Updated just now');
            markRendered();
        }).catch(function () {
            if (!cached) { showError(); }
            /* else keep showing the cached forecast with its "x ago" label */
        });

        /* The Naas comparison only appears on the dedicated weather page. */
        if (onWeatherPage) { loadNaas(); }
    }

    /* Manual refresh button on the weather page. */
    function wireRefresh() {
        var btn = document.getElementById('weather-refresh');
        if (!btn) { return; }
        btn.addEventListener('click', function () {
            setStatus('Refreshing…');
            fetchJSON(API_URL).then(function (data) {
                saveJSON(CACHE_KEY, data);
                render(data, 'Updated just now');
            }).catch(function () {
                setStatus('Refresh failed — still offline?');
            });
            loadNaas();
        });
    }

    function start() { init(); wireRefresh(); }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
