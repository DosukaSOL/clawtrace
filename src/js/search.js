/**
 * Clawtrace — Timeline Search Module (v2.1)
 * ============================================================
 * Text search across timeline steps with match highlighting,
 * step auto-expand, and next/prev match navigation.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Search = (function () {

    var S = Clawtrace.Sanitizer;

    var _container = null;   // timeline container
    var _query = '';
    var _matches = [];
    var _currentMatch = -1;

    /**
     * Initialises the search module.
     * @param {HTMLElement} timelineContainer
     */
    function init(container) {
        _container = container;
    }

    /**
     * Run a search against rendered timeline steps.
     * Hides non-matching steps and highlights matching ones.
     *
     * @param {string} query
     * @returns {{ query: string, count: number, current: number }}
     */
    function search(query) {
        _query = (query || '').trim();
        _matches = [];
        _currentMatch = -1;

        clearHighlights();

        if (!_query || !_container) { return getState(); }

        var lowerQuery = _query.toLowerCase();
        var steps = _container.querySelectorAll('.timeline-step');

        for (var i = 0; i < steps.length; i++) {
            var step = steps[i];
            var text = step.textContent || '';
            if (text.toLowerCase().indexOf(lowerQuery) !== -1) {
                step.classList.add('search-match');
                _matches.push(step);
            } else {
                step.classList.add('search-hidden');
            }
        }

        if (_matches.length > 0) {
            _activateMatch(0);
        }

        return getState();
    }

    /**
     * Advance to the next search match.
     */
    function nextMatch() {
        if (_matches.length === 0) { return getState(); }
        _activateMatch((_currentMatch + 1) % _matches.length);
        return getState();
    }

    /**
     * Go back to the previous search match.
     */
    function prevMatch() {
        if (_matches.length === 0) { return getState(); }
        _activateMatch((_currentMatch - 1 + _matches.length) % _matches.length);
        return getState();
    }

    /**
     * Clear all search highlighting and show all steps.
     */
    function clear() {
        _query = '';
        _matches = [];
        _currentMatch = -1;
        clearHighlights();
    }

    /** @returns {{ query: string, count: number, current: number }} */
    function getState() {
        return {
            query: _query,
            count: _matches.length,
            current: _matches.length > 0 ? _currentMatch + 1 : 0
        };
    }

    /* ---- Private ---- */

    function _activateMatch(idx) {
        for (var i = 0; i < _matches.length; i++) {
            _matches[i].classList.remove('search-current');
        }
        _currentMatch = idx;
        var el = _matches[idx];
        if (!el) { return; }
        el.classList.add('search-current');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Auto-expand the step body so the match is visible
        var body   = el.querySelector('.step-body');
        var header = el.querySelector('.step-header');
        var toggle = el.querySelector('.step-toggle');
        if (body && !body.classList.contains('open')) {
            body.classList.add('open');
            if (toggle) { toggle.classList.add('open'); }
            if (header) { header.setAttribute('aria-expanded', 'true'); }
        }
    }

    function clearHighlights() {
        if (!_container) { return; }
        var steps = _container.querySelectorAll('.timeline-step');
        for (var i = 0; i < steps.length; i++) {
            steps[i].classList.remove('search-match', 'search-hidden', 'search-current');
        }
    }

    /* ---- Public API ---- */
    return {
        init: init,
        search: search,
        nextMatch: nextMatch,
        prevMatch: prevMatch,
        clear: clear,
        getState: getState
    };

})();
