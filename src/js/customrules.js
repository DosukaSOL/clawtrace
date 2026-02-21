/**
 * Clawtrace — Custom Analysis Rules (v2.1)
 * ============================================================
 * Build regex-based detection rules that run alongside the
 * built-in analyzer. Rules are saved to localStorage and can
 * be organised by severity and category.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.CustomRules = (function () {

    var S = Clawtrace.Sanitizer;

    var _container = null;
    var _traceData = null;
    var _rules     = [];

    var STORAGE_KEY  = 'clawtrace-customrules';
    var SEVERITIES   = ['critical', 'high', 'medium', 'low'];
    var CATEGORIES   = ['Custom', 'Security', 'Performance', 'Quality', 'Domain'];

    /* ---- Public ---- */

    function init(container) {
        _container = container;
        _loadFromStorage();
    }

    function render(traceData) {
        _traceData = traceData;
        _renderView();
    }

    /** Returns a copy of the current rules array. */
    function getRules() { return _rules.slice(); }

    /**
     * Run all enabled rules against a trace and return match objects.
     * @param {Object} [traceData]
     * @returns {Array}
     */
    function runRulesOnTrace(traceData) {
        return _runRules(traceData || _traceData);
    }

    /* ---- View ---- */

    function _renderView() {
        if (!_container) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        var intro = S.createElement('div', { 'class': 'analyzer-card full-width' });
        intro.appendChild(S.createElement('h3', { 'class': 'card-title' }, 'Custom Analysis Rules'));
        intro.appendChild(S.createElement('p', { 'class': 'view-desc' },
            'Write regex patterns to detect domain-specific signals in your traces. ' +
            'Rules run alongside the built-in analyzer whenever a trace is loaded.'));
        _container.appendChild(intro);

        // ── Add-rule form ──
        var formCard = S.createElement('div', { 'class': 'analyzer-card full-width' });
        formCard.appendChild(S.createElement('h3', { 'class': 'card-title' }, 'Add New Rule'));
        formCard.appendChild(_buildForm());
        _container.appendChild(formCard);

        // ── Rule list ──
        var listCard = S.createElement('div', { 'class': 'analyzer-card full-width' });
        var listTitle = 'Saved Rules (' + _rules.length + ')';
        listCard.appendChild(S.createElement('h3', { 'class': 'card-title' }, listTitle));
        if (_rules.length === 0) {
            listCard.appendChild(S.createElement('p', { 'class': 'no-data' },
                'No custom rules yet. Add one above.'));
        } else {
            var ruleList = S.createElement('div', { 'class': 'customrules-list' });
            for (var i = 0; i < _rules.length; i++) {
                ruleList.appendChild(_buildRuleCard(_rules[i]));
            }
            listCard.appendChild(ruleList);
        }
        _container.appendChild(listCard);

        // ── Results ──
        if (_traceData && _rules.length > 0) {
            var results  = _runRules(_traceData);
            var resCard  = S.createElement('div', { 'class': 'analyzer-card full-width' });
            resCard.appendChild(S.createElement('h3', { 'class': 'card-title' },
                'Rule Results — ' + results.length + ' match' + (results.length !== 1 ? 'es' : '')));
            if (results.length === 0) {
                resCard.appendChild(S.createElement('p', { 'class': 'no-data' },
                    'No matches found in the current trace.'));
            } else {
                var resLimit = Math.min(results.length, 100);
                for (var j = 0; j < resLimit; j++) {
                    resCard.appendChild(_buildResult(results[j]));
                }
                if (results.length > resLimit) {
                    resCard.appendChild(S.createElement('p', { 'class': 'no-data' },
                        '\u2026 and ' + (results.length - resLimit) + ' more.'));
                }
            }
            _container.appendChild(resCard);
        }
    }

    /* ---- Form ---- */

    function _buildForm() {
        var form = S.createElement('div', { 'class': 'customrules-form' });

        // Name
        var nameWrap = S.createElement('div', { 'class': 'form-field' });
        nameWrap.appendChild(S.createElement('label', { 'for': 'cr-name', 'class': 'form-label' },
            'Rule Name'));
        var nameInput = S.createElement('input', {
            'type': 'text', 'id': 'cr-name',
            'class': 'form-input', 'maxlength': '100'
        });
        nameInput.placeholder = 'e.g. "Forbidden word check"';
        nameWrap.appendChild(nameInput);
        form.appendChild(nameWrap);

        // Pattern
        var patWrap = S.createElement('div', { 'class': 'form-field' });
        patWrap.appendChild(S.createElement('label', { 'for': 'cr-pattern', 'class': 'form-label' },
            'Regex Pattern'));
        var patInput = S.createElement('input', {
            'type': 'text', 'id': 'cr-pattern',
            'class': 'form-input form-input-mono', 'maxlength': '500'
        });
        patInput.placeholder = 'e.g. \\bpassword\\b|\\bsecret\\b';
        patWrap.appendChild(patInput);
        patWrap.appendChild(S.createElement('span', { 'class': 'hint-text' },
            'JavaScript regex. Flags "gi" are applied automatically.'));
        form.appendChild(patWrap);

        // Description
        var descWrap = S.createElement('div', { 'class': 'form-field' });
        descWrap.appendChild(S.createElement('label', { 'for': 'cr-desc', 'class': 'form-label' },
            'Description (optional)'));
        var descInput = S.createElement('input', {
            'type': 'text', 'id': 'cr-desc',
            'class': 'form-input', 'maxlength': '200'
        });
        descInput.placeholder = 'What does this rule detect?';
        descWrap.appendChild(descInput);
        form.appendChild(descWrap);

        // Severity + Category row
        var row = S.createElement('div', { 'class': 'form-row' });

        var sevWrap = S.createElement('div', { 'class': 'form-field' });
        sevWrap.appendChild(S.createElement('label', { 'for': 'cr-sev', 'class': 'form-label' },
            'Severity'));
        var sevSel = S.createElement('select', { 'id': 'cr-sev', 'class': 'select-sm' });
        for (var s = 0; s < SEVERITIES.length; s++) {
            var sOpt = S.createElement('option', { 'value': SEVERITIES[s] },
                SEVERITIES[s].charAt(0).toUpperCase() + SEVERITIES[s].slice(1));
            sevSel.appendChild(sOpt);
        }
        sevWrap.appendChild(sevSel);
        row.appendChild(sevWrap);

        var catWrap = S.createElement('div', { 'class': 'form-field' });
        catWrap.appendChild(S.createElement('label', { 'for': 'cr-cat', 'class': 'form-label' },
            'Category'));
        var catSel = S.createElement('select', { 'id': 'cr-cat', 'class': 'select-sm' });
        for (var c = 0; c < CATEGORIES.length; c++) {
            var cOpt = S.createElement('option', { 'value': CATEGORIES[c] }, CATEGORIES[c]);
            catSel.appendChild(cOpt);
        }
        catWrap.appendChild(catSel);
        row.appendChild(catWrap);

        form.appendChild(row);

        // Feedback
        var feedback = S.createElement('p', { 'class': 'feedback-panel' });
        feedback.hidden = true;

        // Submit
        var addBtn = S.createElement('button', { 'class': 'btn btn-primary', 'id': 'cr-add-btn' },
            'Add Rule');

        addBtn.addEventListener('click', function () {
            var name    = nameInput.value.trim();
            var pattern = patInput.value.trim();
            var desc    = descInput.value.trim();
            var sev     = sevSel.value;
            var cat     = catSel.value;

            if (!name || !pattern) {
                feedback.hidden    = false;
                feedback.className = 'feedback-panel feedback-error';
                S.safeSetText(feedback, 'Rule name and pattern are required.');
                return;
            }

            try { new RegExp(pattern, 'gi'); } catch (re) {
                feedback.hidden    = false;
                feedback.className = 'feedback-panel feedback-error';
                S.safeSetText(feedback, 'Invalid regex: ' + re.message);
                return;
            }

            _rules.push({
                id:          Date.now().toString(36),
                name:        S.sanitizeString(name, 100),
                pattern:     S.sanitizeString(pattern, 500),
                description: S.sanitizeString(desc, 200),
                severity:    sev,
                category:    cat,
                enabled:     true,
                createdAt:   new Date().toISOString()
            });

            _saveToStorage();
            nameInput.value = '';
            patInput.value  = '';
            descInput.value = '';
            feedback.hidden = true;
            _renderView();
        });

        form.appendChild(feedback);
        form.appendChild(addBtn);
        return form;
    }

    /* ---- Rule card ---- */

    function _buildRuleCard(rule) {
        var card = S.createElement('div', {
            'class': 'rule-card rule-severity-' + rule.severity
        });

        var info = S.createElement('div', { 'class': 'rule-info' });
        info.appendChild(S.createElement('strong', {}, rule.name));

        var patCode = S.createElement('code', { 'class': 'rule-pattern' });
        patCode.textContent = rule.pattern;
        info.appendChild(patCode);

        if (rule.description) {
            info.appendChild(S.createElement('span', { 'class': 'hint-text' }, rule.description));
        }

        var tags = S.createElement('div', { 'class': 'rule-tags' });
        tags.appendChild(S.createElement('span', {
            'class': 'severity-badge severity-' + rule.severity
        }, rule.severity));
        tags.appendChild(S.createElement('span', { 'class': 'category-badge' }, rule.category));
        info.appendChild(tags);
        card.appendChild(info);

        var actions = S.createElement('div', { 'class': 'rule-actions' });
        var delBtn  = S.createElement('button', {
            'class':      'btn btn-ghost btn-sm',
            'aria-label': 'Delete rule ' + rule.name
        }, 'Delete');
        (function (rId) {
            delBtn.addEventListener('click', function () {
                _rules = _rules.filter(function (r) { return r.id !== rId; });
                _saveToStorage();
                _renderView();
            });
        })(rule.id);
        actions.appendChild(delBtn);
        card.appendChild(actions);
        return card;
    }

    /* ---- Results ---- */

    function _buildResult(match) {
        var item = S.createElement('div', { 'class': 'finding-item' });
        item.appendChild(S.createElement('div', { 'class': 'finding-category' },
            match.rule.name + '  \u00B7  Step #' + match.step.index +
            '  \u00B7  ' + match.matchCount + ' match' + (match.matchCount !== 1 ? 'es' : '')));
        if (match.rule.description) {
            item.appendChild(S.createElement('div', { 'class': 'finding-text' },
                match.rule.description));
        }
        var ev = S.createElement('div', { 'class': 'finding-evidence' });
        ev.textContent = match.step.content.substring(0, 300);
        item.appendChild(ev);
        return item;
    }

    /* ---- Engine ---- */

    function _runRules(td) {
        if (!td || !td.steps) { return []; }
        var out = [];
        for (var r = 0; r < _rules.length; r++) {
            var rule = _rules[r];
            if (!rule.enabled) { continue; }
            var rx;
            try { rx = new RegExp(rule.pattern, 'gi'); } catch (e) { continue; }

            for (var s = 0; s < td.steps.length; s++) {
                var text = td.steps[s].content || '';
                var m    = text.match(rx);
                if (m && m.length > 0) {
                    out.push({ rule: rule, step: td.steps[s], matchCount: m.length });
                }
            }
        }
        return out;
    }

    /* ---- Persistence ---- */

    function _loadFromStorage() {
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                var parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) { _rules = parsed; }
            }
        } catch (e) { _rules = []; }
    }

    function _saveToStorage() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_rules)); } catch (e) {}
    }

    /* ---- Public API ---- */
    return {
        init: init,
        render: render,
        getRules: getRules,
        runRulesOnTrace: runRulesOnTrace
    };

})();
