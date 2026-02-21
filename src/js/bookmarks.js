/**
 * Clawtrace — Step Bookmarks Module (v2.1)
 * ============================================================
 * Bookmark individual trace steps for quick reference.
 * Bookmarks persist in localStorage, keyed by a content-based
 * trace hash so they survive page reloads.
 *
 * Usage: after TL.render(), call BK.enhance(container) to
 * inject bookmark buttons into every step element.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Bookmarks = (function () {

    var S            = Clawtrace.Sanitizer;
    var _container   = null;  // timeline-container
    var _viewEl      = null;  // bookmarks view container
    var _traceData   = null;
    var _traceHash   = '';
    var _bookmarks   = {};    // { traceHash: [stepIndex, ...] }

    var STORAGE_KEY  = 'clawtrace-bookmarks';

    /* ---- Public ---- */

    function init(timelineContainer, viewContainer) {
        _container = timelineContainer;
        _viewEl    = viewContainer;
        _loadFromStorage();
    }

    /**
     * Call after TL.render(traceData) — enhances steps AND renders the bookmarks view.
     * @param {Object} traceData
     */
    function render(traceData) {
        _traceData  = traceData;
        _traceHash  = _hash(traceData);
        _enhanceTimeline();
        _renderView();
    }

    /**
     * Returns true if the given step index is bookmarked in
     * the current trace.
     */
    function isBookmarked(stepIndex) {
        var indices = _bookmarks[_traceHash] || [];
        return indices.indexOf(stepIndex) !== -1;
    }

    /**
     * Toggle bookmark for a step. Returns true if now bookmarked.
     */
    function toggleBookmark(stepIndex) {
        if (!_bookmarks[_traceHash]) { _bookmarks[_traceHash] = []; }
        var arr = _bookmarks[_traceHash];
        var pos = arr.indexOf(stepIndex);
        if (pos !== -1) {
            arr.splice(pos, 1);
        } else {
            arr.push(stepIndex);
            arr.sort(function (a, b) { return a - b; });
        }
        _saveToStorage();
        _renderView();
        return pos === -1;
    }

    /** Returns bookmarked step objects for the current trace. */
    function getBookmarkedSteps() {
        if (!_traceData) { return []; }
        var indices = _bookmarks[_traceHash] || [];
        return indices.map(function (i) { return _traceData.steps[i]; }).filter(Boolean);
    }

    /* ---- Timeline Enhancement ---- */

    function _enhanceTimeline() {
        if (!_container) { return; }
        var steps = _container.querySelectorAll('.timeline-step');

        for (var i = 0; i < steps.length; i++) {
            var stepEl = steps[i];
            var idxAttr = stepEl.getAttribute('data-index');
            if (idxAttr === null) { continue; }
            var idx = parseInt(idxAttr, 10);

            // Remove stale bookmark button
            var existing = stepEl.querySelector('.bookmark-btn');
            if (existing) { existing.parentNode.removeChild(existing); }

            var bookmarked = isBookmarked(idx);
            var btn = S.createElement('button', {
                'class':      'bookmark-btn' + (bookmarked ? ' bookmarked' : ''),
                'title':      bookmarked ? 'Remove bookmark' : 'Bookmark this step',
                'aria-label': bookmarked ? 'Remove bookmark' : 'Bookmark step ' + idx,
                'tabindex':   '0'
            }, bookmarked ? '\u2605' : '\u2606');  // ★ / ☆

            if (bookmarked) { stepEl.classList.add('step-bookmarked'); }

            (function (sidx, sStep, sBtn) {
                sBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var now = toggleBookmark(sidx);
                    sBtn.textContent = now ? '\u2605' : '\u2606';
                    sBtn.classList.toggle('bookmarked', now);
                    sBtn.title = now ? 'Remove bookmark' : 'Bookmark this step';
                    sBtn.setAttribute('aria-label', now ? 'Remove bookmark' : 'Bookmark step ' + sidx);
                    sStep.classList.toggle('step-bookmarked', now);
                });
            })(idx, stepEl, btn);

            var header = stepEl.querySelector('.step-header');
            if (header) { header.insertBefore(btn, header.firstChild); }
        }
    }

    /* ---- Bookmarks View ---- */

    function _renderView() {
        if (!_viewEl) { return; }
        while (_viewEl.firstChild) { _viewEl.removeChild(_viewEl.firstChild); }

        if (!_traceData) {
            _viewEl.appendChild(S.createElement('p', { 'class': 'no-data' }, 'No trace loaded.'));
            return;
        }

        var indices = _bookmarks[_traceHash] || [];

        if (indices.length === 0) {
            var hint = S.createElement('div', { 'class': 'no-data bookmarks-hint' });
            hint.appendChild(S.createElement('p', {}, 'No bookmarks yet for this trace.'));
            hint.appendChild(S.createElement('p', { 'style': 'margin-top:8px;font-size:0.875rem;' },
                'Click the \u2606 icon on any Timeline step to bookmark it.'));
            _viewEl.appendChild(hint);
            return;
        }

        var meta = S.createElement('div', { 'class': 'bookmarks-meta' });
        var count = S.createElement('p', { 'class': 'hint-text' },
            indices.length + ' bookmarked step' + (indices.length !== 1 ? 's' : '') + '.');
        var clearBtn = S.createElement('button', { 'class': 'btn btn-ghost btn-sm' }, 'Clear All');
        clearBtn.addEventListener('click', function () {
            _bookmarks[_traceHash] = [];
            _saveToStorage();
            _enhanceTimeline();
            _renderView();
        });
        meta.appendChild(count);
        meta.appendChild(clearBtn);
        _viewEl.appendChild(meta);

        var list = S.createElement('div', { 'class': 'bookmarks-list' });
        var allSteps = _traceData.steps || [];

        for (var j = 0; j < indices.length; j++) {
            var stepData = allSteps[indices[j]];
            if (!stepData) { continue; }

            var card = S.createElement('div', { 'class': 'bookmark-card' });

            var cardMeta = S.createElement('div', { 'class': 'bookmark-card-meta' });
            cardMeta.appendChild(S.createElement('span', { 'class': 'step-index' }, '#' + stepData.index));
            cardMeta.appendChild(S.createElement('span', { 'class': 'step-type' }, stepData.type));

            var removeBtn = S.createElement('button', {
                'class':      'btn btn-ghost btn-sm',
                'aria-label': 'Remove bookmark for step ' + stepData.index
            }, '\u00D7');
            (function (sidx) {
                removeBtn.addEventListener('click', function () {
                    toggleBookmark(sidx);
                    _enhanceTimeline();
                });
            })(indices[j]);
            cardMeta.appendChild(removeBtn);
            card.appendChild(cardMeta);

            card.appendChild(S.createElement('div', { 'class': 'bookmark-summary' }, stepData.summary));

            var preview = S.createElement('div', { 'class': 'bookmark-content' });
            var contentText = stepData.content || '';
            preview.textContent = contentText.length > 250
                ? contentText.substring(0, 250) + '\u2026'
                : contentText;
            card.appendChild(preview);

            list.appendChild(card);
        }

        _viewEl.appendChild(list);
    }

    /* ---- Persistence ---- */

    function _loadFromStorage() {
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                var parsed = JSON.parse(stored);
                if (parsed && typeof parsed === 'object') { _bookmarks = parsed; }
            }
        } catch (e) { _bookmarks = {}; }
    }

    function _saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(_bookmarks));
        } catch (e) { /* quota / private mode */ }
    }

    /* ---- Trace Hash ---- */

    function _hash(traceData) {
        if (!traceData || !traceData.steps) { return 'empty'; }
        var s = traceData.steps;
        var sig = s.length + ':' +
            (s[0]              ? s[0].content.substring(0, 60)              : '') + ':' +
            (s[s.length - 1]   ? s[s.length - 1].content.substring(0, 60)  : '');
        var h = 5381;
        for (var i = 0; i < sig.length; i++) {
            h = ((h << 5) + h) + sig.charCodeAt(i);
            h = h & h;
        }
        return 'tr_' + Math.abs(h).toString(16);
    }

    /* ---- Public API ---- */
    return {
        init: init,
        render: render,
        isBookmarked: isBookmarked,
        toggleBookmark: toggleBookmark,
        getBookmarkedSteps: getBookmarkedSteps
    };

})();
