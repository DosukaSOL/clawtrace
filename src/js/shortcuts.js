/**
 * Clawtrace — Keyboard Shortcut System (v2.1)
 * ============================================================
 * Global keyboard shortcuts with an in-app reference panel.
 * Press '?' to toggle the panel. Shortcuts are disabled while
 * typing in any text field.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Shortcuts = (function () {

    var S = Clawtrace.Sanitizer;

    var _panel = null;
    var _switchViewFn = null;
    var _callbacks = {};

    var SHORTCUTS = [
        { key: '?',      desc: 'Show / hide this shortcuts panel' },
        { key: 'i',      desc: 'Go to Load Trace' },
        { key: 't',      desc: 'Go to Timeline' },
        { key: 'a',      desc: 'Go to Analyzer' },
        { key: 'r',      desc: 'Go to Replay' },
        { key: '/',      desc: 'Focus timeline search bar' },
        { key: ']',      desc: 'Expand all timeline steps' },
        { key: '[',      desc: 'Collapse all timeline steps' },
        { key: 'n',      desc: 'Jump to next search match' },
        { key: 'p',      desc: 'Jump to previous search match' },
        { key: 'b',      desc: 'Go to Bookmarks view' },
        { key: 'Escape', desc: 'Clear search · close this panel' }
    ];

    /**
     * Initialises the shortcut system.
     *
     * @param {Function} switchViewFn     - App's switchView(viewName) function
     * @param {Object}   callbacks        - Optional named callbacks:
     *   onFocusSearch, onExpandAll, onCollapseAll, onNextMatch, onPrevMatch, onEscape
     */
    function init(switchViewFn, callbacks) {
        _switchViewFn = switchViewFn || function () {};
        _callbacks = callbacks || {};
        _createPanel();
        document.addEventListener('keydown', _handleKeyDown);
    }

    /* ---- Panel ---- */

    function _createPanel() {
        _panel = S.createElement('div', {
            'id':         'shortcuts-panel',
            'class':      'shortcuts-panel',
            'role':       'dialog',
            'aria-label': 'Keyboard shortcuts reference',
            'aria-modal': 'false'
        });

        var header = S.createElement('div', { 'class': 'shortcuts-header' });
        var title  = S.createElement('h3',  { 'class': 'shortcuts-title' }, 'Keyboard Shortcuts');
        var close  = S.createElement('button', {
            'class':      'shortcuts-close icon-btn',
            'aria-label': 'Close shortcuts panel'
        }, '\u00D7');
        close.addEventListener('click', hidePanel);
        header.appendChild(title);
        header.appendChild(close);
        _panel.appendChild(header);

        var grid = S.createElement('div', { 'class': 'shortcuts-grid' });
        for (var i = 0; i < SHORTCUTS.length; i++) {
            var row  = S.createElement('div', { 'class': 'shortcut-row' });
            var key  = S.createElement('code', { 'class': 'shortcut-key' }, SHORTCUTS[i].key);
            var desc = S.createElement('span', { 'class': 'shortcut-desc'  }, SHORTCUTS[i].desc);
            row.appendChild(key);
            row.appendChild(desc);
            grid.appendChild(row);
        }
        _panel.appendChild(grid);

        _panel.appendChild(S.createElement('p', { 'class': 'shortcuts-hint' },
            'Shortcuts are disabled while typing in text fields.'));

        _panel.hidden = true;
        document.body.appendChild(_panel);
    }

    /* ---- Key Handler ---- */

    function _handleKeyDown(e) {
        var tag     = (e.target.tagName || '').toLowerCase();
        var isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

        // Escape always works
        if (e.key === 'Escape') {
            hidePanel();
            if (_callbacks.onEscape) { _callbacks.onEscape(); }
            return;
        }

        if (isInput) { return; }
        if (e.ctrlKey || e.metaKey || e.altKey) { return; }

        switch (e.key) {
            case '?':
                e.preventDefault();
                togglePanel();
                break;
            case '/':
                e.preventDefault();
                if (_callbacks.onFocusSearch) { _callbacks.onFocusSearch(); }
                break;
            case 'i': _switchViewFn('input');    break;
            case 't': _switchViewFn('timeline'); break;
            case 'a': _switchViewFn('analyzer'); break;
            case 'r': _switchViewFn('replay');   break;
            case 'b': _switchViewFn('bookmarks'); break;
            case ']':
                if (_callbacks.onExpandAll)   { _callbacks.onExpandAll(); }
                break;
            case '[':
                if (_callbacks.onCollapseAll) { _callbacks.onCollapseAll(); }
                break;
            case 'n':
                if (_callbacks.onNextMatch)   { _callbacks.onNextMatch(); }
                break;
            case 'p':
                if (_callbacks.onPrevMatch)   { _callbacks.onPrevMatch(); }
                break;
        }
    }

    /* ---- Public ---- */

    function togglePanel() {
        if (_panel) { _panel.hidden = !_panel.hidden; }
    }

    function hidePanel() {
        if (_panel) { _panel.hidden = true; }
    }

    return { init: init, togglePanel: togglePanel, hidePanel: hidePanel };

})();
