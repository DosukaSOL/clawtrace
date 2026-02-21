/**
 * Clawtrace — Local IndexedDB Storage (v2.1)
 * ============================================================
 * Opt-in persistent storage for saving and reloading traces
 * between browser sessions. Uses IndexedDB — 100% local,
 * nothing is ever uploaded.
 *
 * The feature is disabled by default. Users must toggle it on.
 * Preference is stored in localStorage. All trace data stays
 * in the browser's IndexedDB.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Storage = (function () {

    var S           = Clawtrace.Sanitizer;
    var _container  = null;
    var _traceData  = null;
    var _onLoad     = null;   // callback(traceData) when user loads a saved trace
    var _db         = null;
    var _enabled    = false;

    var DB_NAME     = 'clawtrace-db';
    var DB_VERSION  = 1;
    var STORE_NAME  = 'traces';
    var OPT_IN_KEY  = 'clawtrace-storage-enabled';

    /* ---- Public ---- */

    function init(container, onLoadCallback) {
        _container = container;
        _onLoad    = onLoadCallback || function () {};
        try { _enabled = localStorage.getItem(OPT_IN_KEY) === 'true'; } catch (e) {}
    }

    function render(traceData) {
        _traceData = traceData;
        _renderView();
    }

    /** Programmatically save the current trace with a label. */
    function saveTrace(label, callback) {
        if (!_traceData) {
            if (callback) { callback('No trace to save.'); }
            return;
        }
        _getDB(function (db, err) {
            if (err) { if (callback) { callback(err); } return; }
            try {
                var record = {
                    label:     S.sanitizeString(label || 'Untitled', 100),
                    savedAt:   new Date().toISOString(),
                    stepCount: _traceData.steps.length,
                    format:    (_traceData.meta && _traceData.meta.format) || 'unknown',
                    data:      JSON.stringify(_traceData).substring(0, 5 * 1024 * 1024)
                };
                var tx  = db.transaction([STORE_NAME], 'readwrite');
                var req = tx.objectStore(STORE_NAME).add(record);
                req.onsuccess = function () { if (callback) { callback(null); } };
                req.onerror   = function () { if (callback) { callback('Write failed.'); } };
            } catch (e) { if (callback) { callback(String(e)); } }
        });
    }

    /* ---- View ---- */

    function _renderView() {
        if (!_container) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        // ── Privacy notice / opt-in ──
        var noticeCard = S.createElement('div', { 'class': 'analyzer-card full-width' });
        noticeCard.appendChild(S.createElement('h3', { 'class': 'card-title' },
            '\uD83D\uDCBE  Local Trace Storage'));

        var desc = S.createElement('p', { 'class': 'view-desc' });
        desc.textContent =
            'Opt-in feature. Stores traces in your browser\'s IndexedDB — ' +
            '100% local, never uploaded, persists between sessions. ' +
            'You can delete saved traces or disable storage at any time.';
        noticeCard.appendChild(desc);

        // Toggle row
        var toggleRow = S.createElement('div', { 'class': 'storage-toggle-row' });
        var togLabel  = S.createElement('label', { 'for': 'storage-opt-in', 'class': 'toggle-label' },
            'Enable local trace storage');
        var togInput  = S.createElement('input', {
            'type': 'checkbox', 'id': 'storage-opt-in', 'class': 'toggle-checkbox',
            'aria-label': 'Enable local trace storage'
        });
        togInput.checked = _enabled;
        togInput.addEventListener('change', function () {
            _enabled = togInput.checked;
            try { localStorage.setItem(OPT_IN_KEY, String(_enabled)); } catch (e) {}
            _renderView();
        });
        toggleRow.appendChild(togInput);
        toggleRow.appendChild(togLabel);
        noticeCard.appendChild(toggleRow);

        if (!_enabled) {
            noticeCard.appendChild(S.createElement('p', { 'class': 'hint-text' },
                'Enable storage above to save and reload traces across browser sessions.'));
            _container.appendChild(noticeCard);
            return;
        }
        _container.appendChild(noticeCard);

        // ── Save current trace ──
        if (_traceData) {
            var saveCard = S.createElement('div', { 'class': 'analyzer-card full-width' });
            saveCard.appendChild(S.createElement('h3', { 'class': 'card-title' },
                'Save Current Trace'));
            var saveForm = S.createElement('div', { 'class': 'customrules-form' });

            var nameInput = S.createElement('input', {
                'type': 'text', 'id': 'storage-label',
                'class': 'form-input', 'maxlength': '100'
            });
            nameInput.placeholder = 'Label for this trace…';
            saveForm.appendChild(nameInput);

            var fb = S.createElement('p', { 'class': 'feedback-panel' });
            fb.hidden = true;

            var saveBtn = S.createElement('button', { 'class': 'btn btn-primary' }, 'Save Trace');
            saveBtn.addEventListener('click', function () {
                var label = nameInput.value.trim() || ('Trace — ' + new Date().toLocaleString());
                saveTrace(label, function (err) {
                    fb.hidden    = false;
                    if (err) {
                        fb.className = 'feedback-panel feedback-error';
                        S.safeSetText(fb, '\u274C ' + err);
                    } else {
                        fb.className = 'feedback-panel feedback-success';
                        S.safeSetText(fb, '\u2713 Saved successfully.');
                        nameInput.value = '';
                        _refreshList(listBody);
                    }
                });
            });
            saveForm.appendChild(fb);
            saveForm.appendChild(saveBtn);
            saveCard.appendChild(saveForm);
            _container.appendChild(saveCard);
        }

        // ── Saved traces list ──
        var listCard = S.createElement('div', { 'class': 'analyzer-card full-width' });
        listCard.appendChild(S.createElement('h3', { 'class': 'card-title' }, 'Saved Traces'));
        var listBody = S.createElement('div', { 'class': 'storage-list' });
        listBody.appendChild(S.createElement('p', { 'class': 'hint-text' }, 'Loading\u2026'));
        listCard.appendChild(listBody);
        _container.appendChild(listCard);

        _refreshList(listBody);
    }

    function _refreshList(listBody) {
        while (listBody.firstChild) { listBody.removeChild(listBody.firstChild); }
        listBody.appendChild(S.createElement('p', { 'class': 'hint-text' }, 'Loading\u2026'));

        _listTraces(function (records, err) {
            while (listBody.firstChild) { listBody.removeChild(listBody.firstChild); }
            if (err) {
                listBody.appendChild(S.createElement('p', { 'class': 'no-data' },
                    'Could not access IndexedDB: ' + err));
                return;
            }
            if (!records || records.length === 0) {
                listBody.appendChild(S.createElement('p', { 'class': 'no-data' },
                    'No saved traces yet.'));
                return;
            }
            for (var i = 0; i < records.length; i++) {
                listBody.appendChild(_buildRow(records[i], listBody));
            }
        });
    }

    function _buildRow(rec, listBody) {
        var row  = S.createElement('div', { 'class': 'storage-trace-row' });
        var info = S.createElement('div', { 'class': 'storage-trace-info' });
        info.appendChild(S.createElement('strong', {}, rec.label));
        info.appendChild(S.createElement('span', { 'class': 'hint-text' },
            new Date(rec.savedAt).toLocaleString() + '  \u00B7  ' +
            rec.stepCount + ' steps  \u00B7  ' + rec.format));
        row.appendChild(info);

        var acts = S.createElement('div', { 'class': 'rule-actions' });

        var loadBtn = S.createElement('button', { 'class': 'btn btn-primary btn-sm' }, 'Load');
        (function (rId) {
            loadBtn.addEventListener('click', function () {
                _loadTrace(rId, function (traceData, err) {
                    if (err || !traceData) { return; }
                    if (_onLoad) { _onLoad(traceData); }
                });
            });
        })(rec.id);

        var delBtn = S.createElement('button', { 'class': 'btn btn-ghost btn-sm' }, 'Delete');
        (function (rId) {
            delBtn.addEventListener('click', function () {
                _deleteTrace(rId, function () { _refreshList(listBody); });
            });
        })(rec.id);

        acts.appendChild(loadBtn);
        acts.appendChild(delBtn);
        row.appendChild(acts);
        return row;
    }

    /* ---- IndexedDB helpers ---- */

    function _getDB(callback) {
        if (_db) { callback(_db, null); return; }
        if (!window.indexedDB) { callback(null, 'IndexedDB not supported.'); return; }
        try {
            var req = window.indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = function (e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    var os = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    os.createIndex('savedAt', 'savedAt', { unique: false });
                }
            };
            req.onsuccess = function (e) {
                _db = e.target.result;
                callback(_db, null);
            };
            req.onerror = function () { callback(null, 'DB open error.'); };
        } catch (e) { callback(null, String(e)); }
    }

    function _listTraces(callback) {
        _getDB(function (db, err) {
            if (err) { callback(null, err); return; }
            try {
                var tx    = db.transaction([STORE_NAME], 'readonly');
                var store = tx.objectStore(STORE_NAME);
                var req   = store.getAll ? store.getAll() : null;

                if (!req) {
                    // Cursor fallback for older browsers
                    var results = [];
                    var cursor = store.openCursor(null, 'prev');
                    cursor.onsuccess = function (e) {
                        var c = e.target.result;
                        if (c) {
                            results.push({ id: c.primaryKey, label: c.value.label,
                                savedAt: c.value.savedAt, stepCount: c.value.stepCount,
                                format: c.value.format });
                            c.continue();
                        } else { callback(results, null); }
                    };
                    cursor.onerror = function () { callback(null, 'Cursor error.'); };
                    return;
                }
                req.onsuccess = function (e) {
                    var all = (e.target.result || []).map(function (r) {
                        return { id: r.id, label: r.label, savedAt: r.savedAt,
                                 stepCount: r.stepCount, format: r.format };
                    }).sort(function (a, b) { return a.savedAt < b.savedAt ? 1 : -1; });
                    callback(all, null);
                };
                req.onerror = function () { callback(null, 'Read error.'); };
            } catch (e) { callback(null, String(e)); }
        });
    }

    function _loadTrace(id, callback) {
        _getDB(function (db, err) {
            if (err) { callback(null, err); return; }
            try {
                var tx  = db.transaction([STORE_NAME], 'readonly');
                var req = tx.objectStore(STORE_NAME).get(id);
                req.onsuccess = function (e) {
                    try {
                        var rec = e.target.result;
                        if (!rec) { callback(null, 'Not found.'); return; }
                        callback(JSON.parse(rec.data), null);
                    } catch (pe) { callback(null, 'Parse error.'); }
                };
                req.onerror = function () { callback(null, 'Load error.'); };
            } catch (e) { callback(null, String(e)); }
        });
    }

    function _deleteTrace(id, callback) {
        _getDB(function (db, err) {
            if (err) { if (callback) { callback(); } return; }
            try {
                var tx  = db.transaction([STORE_NAME], 'readwrite');
                var req = tx.objectStore(STORE_NAME).delete(id);
                req.onsuccess = function () { if (callback) { callback(); } };
                req.onerror   = function () { if (callback) { callback(); } };
            } catch (e) { if (callback) { callback(); } }
        });
    }

    /* ---- Public API ---- */
    return {
        init: init,
        render: render,
        saveTrace: saveTrace
    };

})();
