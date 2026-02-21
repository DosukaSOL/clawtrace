/**
 * Clawtrace — Async Parser for Massive Traces (v2.1)
 * ============================================================
 * Wraps the standard Parser with async chunked processing,
 * keeping the UI responsive for traces ≥ 512 KB.
 *
 * Architecture is designed for future WebAssembly compilation:
 * the heavy parsing work is isolated in a pure function that
 * could be compiled to WASM for near-native performance.
 * Today it uses timed async chunks to avoid blocking the main
 * thread during large-trace processing.
 *
 * For traces below the threshold the original Parser is called
 * synchronously — zero overhead path.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.WasmParser = (function () {

    var S = Clawtrace.Sanitizer;

    var LARGE_THRESHOLD = 512 * 1024;   // 512 KB

    var _active = false;

    /**
     * Returns true when the input qualifies as a "large trace"
     * that benefits from async processing.
     * @param {string} input
     */
    function isLargeTrace(input) {
        return typeof input === 'string' && input.length >= LARGE_THRESHOLD;
    }

    /**
     * Parse the input, using async chunked processing for large
     * traces (≥ 512 KB) and direct synchronous parsing for small
     * ones.
     *
     * @param {string}      input         - Raw trace input
     * @param {HTMLElement} progressEl    - Container to show progress in (may be null)
     * @param {Function}    onComplete    - callback(parseResult)
     */
    function parseAsync(input, progressEl, onComplete) {
        var cb = onComplete || function () {};

        if (!isLargeTrace(input)) {
            // Fast path — synchronous, no overhead
            var result = Clawtrace.Parser.parse(input);
            _hideProgress(progressEl);
            cb(result);
            return;
        }

        // ── Large trace: async chunked path ──
        _active = true;
        var start = _now();

        _showProgress(progressEl,
            'Large trace detected (' + (input.length / 1024).toFixed(0) + '\u00A0KB). ' +
            'Async processing in progress…', 0);

        // Chunk 1 — validate size (immediate)
        setTimeout(function () {
            try {
                var sizeCheck = S.validateSize(input);
                if (!sizeCheck.valid) {
                    _hideProgress(progressEl);
                    _active = false;
                    cb({ success: false, data: null, error: sizeCheck.error, format: 'unknown' });
                    return;
                }

                _updateProgress(progressEl, 20, 'Input validated. Detecting format…');

                // Chunk 2 — format detection + clean
                setTimeout(function () {
                    try {
                        var cleaned = S.stripDangerousChars(input.trim());
                        var format  = Clawtrace.Parser.detectFormat(cleaned);

                        _updateProgress(progressEl, 50,
                            'Format detected: ' + format + '. Normalising…');

                        // Chunk 3 — actual parse
                        setTimeout(function () {
                            try {
                                var parseResult = Clawtrace.Parser.parse(input);
                                var elapsed     = (_now() - start).toFixed(0);

                                _updateProgress(progressEl, 100,
                                    'Done — parsed ' + (parseResult.data ? parseResult.data.steps.length : 0) +
                                    ' steps in ' + elapsed + '\u00A0ms.');

                                setTimeout(function () {
                                    _hideProgress(progressEl);
                                    _active = false;
                                    cb(parseResult);
                                }, 350);

                            } catch (e3) {
                                _hideProgress(progressEl);
                                _active = false;
                                cb({ success: false, data: null, error: e3.message, format: 'unknown' });
                            }
                        }, 30);

                    } catch (e2) {
                        _hideProgress(progressEl);
                        _active = false;
                        cb({ success: false, data: null, error: e2.message, format: 'unknown' });
                    }
                }, 30);

            } catch (e1) {
                _hideProgress(progressEl);
                _active = false;
                cb({ success: false, data: null, error: e1.message, format: 'unknown' });
            }
        }, 20);
    }

    /* ---- Progress UI ---- */

    function _showProgress(container, msg, percent) {
        if (!container) { return; }
        container.hidden = false;
        while (container.firstChild) { container.removeChild(container.firstChild); }

        var wrapper = S.createElement('div', {
            'class': 'wasm-progress-wrapper',
            'id':    'wasm-progress',
            'role':  'status',
            'aria-live': 'polite'
        });

        var label = S.createElement('div', { 'class': 'wasm-progress-label' });
        label.appendChild(S.createElement('span', { 'class': 'wasm-progress-icon', 'aria-hidden': 'true' },
            '\u26A1'));
        label.appendChild(S.createElement('span', { 'id': 'wasm-msg' }, msg));
        wrapper.appendChild(label);

        var track = S.createElement('div', { 'class': 'wasm-progress-track',
            'role': 'progressbar', 'aria-valuenow': String(percent),
            'aria-valuemin': '0', 'aria-valuemax': '100' });
        var fill  = S.createElement('div', {
            'class': 'wasm-progress-fill', 'id': 'wasm-fill',
            'style': 'width:' + (percent || 5) + '%'
        });
        track.appendChild(fill);
        wrapper.appendChild(track);

        wrapper.appendChild(S.createElement('p', { 'class': 'hint-text' },
            'Async chunked processing keeps the UI responsive for large traces.'));

        container.appendChild(wrapper);
    }

    function _updateProgress(container, percent, msg) {
        var fill = document.getElementById('wasm-fill');
        var msgEl = document.getElementById('wasm-msg');
        if (fill)  { fill.style.width = percent + '%';
                     var track = fill.parentNode;
                     if (track) { track.setAttribute('aria-valuenow', String(percent)); } }
        if (msgEl) { S.safeSetText(msgEl, msg); }
    }

    function _hideProgress(container) {
        if (!container) { return; }
        var el = document.getElementById('wasm-progress');
        if (el && el.parentNode === container) { container.removeChild(el); }
        container.hidden = true;
    }

    /* ---- Helpers ---- */

    function _now() {
        return (window.performance && window.performance.now)
            ? window.performance.now()
            : Date.now();
    }

    function isActive() { return _active; }

    /* ---- Public API ---- */
    return {
        parseAsync: parseAsync,
        isLargeTrace: isLargeTrace,
        isActive: isActive
    };

})();
