/**
 * Clawtrace — Trace Annotations Module (v2.1)
 * ============================================================
 * Attach free-text notes to individual trace steps.
 * Annotations persist in localStorage, keyed by trace + step.
 * Inline panel opens on each step via the 📝 icon button.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Annotations = (function () {

    var S           = Clawtrace.Sanitizer;
    var _container  = null;   // timeline container
    var _viewEl     = null;   // annotations view container
    var _traceData  = null;
    var _traceHash  = '';
    var _data       = {};     // { traceHash: { "stepIndex": [{id, text, createdAt}, ...] } }

    var STORAGE_KEY = 'clawtrace-annotations';

    /* ---- Public ---- */

    function init(timelineContainer, viewContainer) {
        _container = timelineContainer;
        _viewEl    = viewContainer;
        _loadFromStorage();
    }

    /**
     * Call after TL.render(traceData) — injects annotation icons
     * into every timeline step and renders the annotations view.
     */
    function render(traceData) {
        _traceData = traceData;
        _traceHash = _hash(traceData);
        _enhanceTimeline();
        _renderView();
    }

    /**
     * Add an annotation to a step.
     * @param {number} stepIndex
     * @param {string} text
     * @returns {Object} The saved note object
     */
    function addAnnotation(stepIndex, text) {
        var cleaned = (text || '').trim();
        if (!cleaned) { return null; }
        if (!_data[_traceHash])                    { _data[_traceHash] = {}; }
        var key = String(stepIndex);
        if (!_data[_traceHash][key])               { _data[_traceHash][key] = []; }
        var note = {
            id:        Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            text:      S.sanitizeString(cleaned, 1000),
            createdAt: new Date().toISOString()
        };
        _data[_traceHash][key].push(note);
        _saveToStorage();
        _renderView();
        return note;
    }

    /**
     * Delete a specific note from a step.
     */
    function deleteAnnotation(stepIndex, noteId) {
        var td = _data[_traceHash];
        if (!td) { return; }
        var key = String(stepIndex);
        if (!td[key]) { return; }
        td[key] = td[key].filter(function (n) { return n.id !== noteId; });
        if (td[key].length === 0) { delete td[key]; }
        _saveToStorage();
        _enhanceTimeline();
        _renderView();
    }

    /** Returns all annotations for the current trace. */
    function getAllAnnotations() {
        return _data[_traceHash] || {};
    }

    /* ---- Timeline Enhancement ---- */

    function _enhanceTimeline() {
        if (!_container) { return; }
        var traceAnns = _data[_traceHash] || {};
        var steps = _container.querySelectorAll('.timeline-step');

        for (var i = 0; i < steps.length; i++) {
            var stepEl = steps[i];
            var idxAttr = stepEl.getAttribute('data-index');
            if (idxAttr === null) { continue; }
            var idx = parseInt(idxAttr, 10);
            var key = String(idx);
            var hasNotes = !!(traceAnns[key] && traceAnns[key].length > 0);
            var noteCount = hasNotes ? traceAnns[key].length : 0;

            // Remove stale indicator
            var existing = stepEl.querySelector('.annotation-indicator');
            if (existing) { existing.parentNode.removeChild(existing); }

            var indicator = S.createElement('button', {
                'class':      'annotation-indicator' + (hasNotes ? ' has-annotations' : ''),
                'title':      hasNotes
                    ? 'View/edit annotations (' + noteCount + ')'
                    : 'Add annotation',
                'aria-label': 'Annotations for step ' + idx,
                'tabindex':   '0'
            }, hasNotes ? '\uD83D\uDCDD' + noteCount : '\uD83D\uDCDD');  // 📝

            (function (sidx, sEl, sInd) {
                sInd.addEventListener('click', function (e) {
                    e.stopPropagation();
                    // Toggle inline panel
                    var existPanel = sEl.querySelector('.annotation-inline-panel');
                    if (existPanel) {
                        sEl.removeChild(existPanel);
                    } else {
                        _buildInlinePanel(sidx, sEl);
                    }
                });
            })(idx, stepEl, indicator);

            var header = stepEl.querySelector('.step-header');
            if (header) {
                // Insert after bookmark button if present, else at start
                var bk = header.querySelector('.bookmark-btn');
                if (bk && bk.nextSibling) {
                    header.insertBefore(indicator, bk.nextSibling);
                } else if (bk) {
                    header.appendChild(indicator);
                } else {
                    header.insertBefore(indicator, header.firstChild);
                }
            }
        }
    }

    function _buildInlinePanel(stepIndex, stepEl) {
        var traceAnns = _data[_traceHash] || {};
        var key   = String(stepIndex);
        var notes = (traceAnns[key] || []).slice();

        var panel = S.createElement('div', { 'class': 'annotation-inline-panel' });

        // Existing notes list
        if (notes.length > 0) {
            var notesList = S.createElement('div', { 'class': 'annotation-notes-list' });
            for (var i = 0; i < notes.length; i++) {
                var note    = notes[i];
                var noteEl  = S.createElement('div', { 'class': 'annotation-note' });
                var noteText = S.createElement('p', { 'class': 'annotation-note-text' }, note.text);
                var noteMeta = S.createElement('div', { 'class': 'annotation-note-meta' });
                noteMeta.appendChild(S.createElement('span', { 'class': 'annotation-note-date' },
                    new Date(note.createdAt).toLocaleString()));

                var delBtn = S.createElement('button', {
                    'class':      'btn btn-ghost btn-sm',
                    'aria-label': 'Delete annotation'
                }, 'Delete');
                (function (nId, sIdx, sEl, pan) {
                    delBtn.addEventListener('click', function () {
                        deleteAnnotation(sIdx, nId);
                        if (pan.parentNode === sEl) { sEl.removeChild(pan); }
                        _buildInlinePanel(sIdx, sEl);
                    });
                })(note.id, stepIndex, stepEl, panel);

                noteMeta.appendChild(delBtn);
                noteEl.appendChild(noteText);
                noteEl.appendChild(noteMeta);
                notesList.appendChild(noteEl);
            }
            panel.appendChild(notesList);
        } else {
            panel.appendChild(S.createElement('p', { 'class': 'hint-text' }, 'No notes yet.'));
        }

        // Add-note form
        var form = S.createElement('div', { 'class': 'annotation-add-form' });
        var ta   = S.createElement('textarea', {
            'class': 'annotation-textarea',
            'rows':  '2',
            'maxlength': '1000',
            'aria-label': 'New annotation'
        });
        ta.placeholder = 'Add a note (Ctrl+Enter to save)…';

        var saveBtn = S.createElement('button', {
            'class':      'btn btn-primary btn-sm',
            'aria-label': 'Save annotation'
        }, 'Save');

        (function (sIdx, sEl, pan, textarea) {
            saveBtn.addEventListener('click', function () {
                var txt = textarea.value.trim();
                if (!txt) { return; }
                addAnnotation(sIdx, txt);
                textarea.value = '';
                if (pan.parentNode === sEl) { sEl.removeChild(pan); }
                _buildInlinePanel(sIdx, sEl);
            });
            textarea.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    saveBtn.click();
                }
            });
        })(stepIndex, stepEl, panel, ta);

        form.appendChild(ta);
        form.appendChild(saveBtn);
        panel.appendChild(form);

        stepEl.appendChild(panel);

        // Focus textarea
        setTimeout(function () { ta.focus(); }, 50);
    }

    /* ---- Annotations View ---- */

    function _renderView() {
        if (!_viewEl) { return; }
        while (_viewEl.firstChild) { _viewEl.removeChild(_viewEl.firstChild); }

        if (!_traceData) {
            _viewEl.appendChild(S.createElement('p', { 'class': 'no-data' }, 'No trace loaded.'));
            return;
        }

        var traceAnns = _data[_traceHash] || {};
        var keys = Object.keys(traceAnns);

        if (keys.length === 0) {
            var hint = S.createElement('div', { 'class': 'no-data' });
            hint.appendChild(S.createElement('p', {}, 'No annotations yet.'));
            hint.appendChild(S.createElement('p', { 'style': 'margin-top:8px;font-size:0.875rem;' },
                'Click the \uD83D\uDCDD icon on any Timeline step to add a note.'));
            _viewEl.appendChild(hint);
            return;
        }

        var total = 0;
        keys.forEach(function (k) { total += traceAnns[k].length; });

        _viewEl.appendChild(S.createElement('p', { 'class': 'hint-text' },
            total + ' annotation' + (total !== 1 ? 's' : '') + ' across ' +
            keys.length + ' step' + (keys.length !== 1 ? 's' : '') + '.'));

        var list   = S.createElement('div', { 'class': 'annotations-list-view' });
        var allSteps = (_traceData && _traceData.steps) || [];

        keys.sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });

        for (var i = 0; i < keys.length; i++) {
            var key    = keys[i];
            var notes  = traceAnns[key];
            var stepIdx = parseInt(key, 10);
            var step   = allSteps[stepIdx];
            if (!step) { continue; }

            var section = S.createElement('div', { 'class': 'annotation-section' });

            var secHeader = S.createElement('div', { 'class': 'annotation-section-header' });
            secHeader.appendChild(S.createElement('span', { 'class': 'step-index' }, '#' + step.index));
            secHeader.appendChild(S.createElement('span', { 'class': 'step-type'  }, step.type));

            var sumText = step.summary.length > 70
                ? step.summary.substring(0, 67) + '\u2026'
                : step.summary;
            secHeader.appendChild(S.createElement('span', {
                'class': 'hint-text',
                'style': 'margin-left:auto;font-size:0.8rem;'
            }, sumText));
            section.appendChild(secHeader);

            for (var j = 0; j < notes.length; j++) {
                var note   = notes[j];
                var noteEl = S.createElement('div', { 'class': 'annotation-note' });
                noteEl.appendChild(S.createElement('p', { 'class': 'annotation-note-text' }, note.text));

                var meta = S.createElement('div', { 'class': 'annotation-note-meta' });
                meta.appendChild(S.createElement('span', { 'class': 'annotation-note-date' },
                    new Date(note.createdAt).toLocaleString()));

                var delBtn = S.createElement('button', {
                    'class':      'btn btn-ghost btn-sm',
                    'aria-label': 'Delete note'
                }, 'Delete');
                (function (nId, sIdx) {
                    delBtn.addEventListener('click', function () { deleteAnnotation(sIdx, nId); });
                })(note.id, stepIdx);
                meta.appendChild(delBtn);

                noteEl.appendChild(meta);
                section.appendChild(noteEl);
            }

            list.appendChild(section);
        }

        _viewEl.appendChild(list);
    }

    /* ---- Persistence ---- */

    function _loadFromStorage() {
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                var parsed = JSON.parse(stored);
                if (parsed && typeof parsed === 'object') { _data = parsed; }
            }
        } catch (e) { _data = {}; }
    }

    function _saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
        } catch (e) {}
    }

    /* ---- Trace Hash ---- */

    function _hash(traceData) {
        if (!traceData || !traceData.steps) { return 'empty'; }
        var s   = traceData.steps;
        var sig = 'ann:' + s.length + ':' + (s[0] ? s[0].content.substring(0, 60) : '');
        var h   = 5381;
        for (var i = 0; i < sig.length; i++) {
            h = ((h << 5) + h) + sig.charCodeAt(i);
            h = h & h;
        }
        return 'a_' + Math.abs(h).toString(16);
    }

    /* ---- Public API ---- */
    return {
        init: init,
        render: render,
        addAnnotation: addAnnotation,
        deleteAnnotation: deleteAnnotation,
        getAllAnnotations: getAllAnnotations
    };

})();
