/**
 * Clawtrace — Community Pattern Library (v2.1)
 * ============================================================
 * 22 curated detection patterns across 5 categories:
 *   LLM Behaviour · Security · Performance · Quality · OpenClaw
 *
 * Each pattern can be toggled on/off. Active patterns are run
 * against the loaded trace and displayed with match counts.
 * Toggle state persists in localStorage.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Patterns = (function () {

    var S = Clawtrace.Sanitizer;

    var _container = null;
    var _traceData = null;
    var _active    = {};  // { patternId: boolean }

    var STORAGE_KEY = 'clawtrace-patterns-active';

    /* ----  Pattern definitions  ---- */
    var LIBRARY = [
        /* ── LLM Behaviour ── */
        {
            id: 'llm-refusal',    category: 'LLM Behavior', severity: 'medium',
            name: 'Model Refusal',
            pattern: /\b(i (cannot|can't|am not able to|am unable to)|(i (won't|will not) (help|assist|do|complete|provide)))\b/gi,
            desc: 'The model declines to fulfil the request.'
        },
        {
            id: 'llm-apology',    category: 'LLM Behavior', severity: 'low',
            name: 'Excessive Apology',
            pattern: /\b(i('m| am) so sorry|i (deeply|sincerely) apologize|my sincere apologies)\b/gi,
            desc: 'Flags over-apologetic language.'
        },
        {
            id: 'llm-sycophancy', category: 'LLM Behavior', severity: 'low',
            name: 'Sycophantic Opener',
            pattern: /\b(great (question|point|idea)|excellent (question|point|observation)|what a (great|wonderful|fantastic) question)\b/gi,
            desc: 'Sycophantic response opener detected.'
        },
        {
            id: 'llm-loop',       category: 'LLM Behavior', severity: 'critical',
            name: 'Possible Agent Loop',
            pattern: /\b(let me try (again|that again)|i('ll| will) (retry|attempt) (this|that|again)|retrying( the)? (same|previous|last))\b/gi,
            desc: 'Model language indicating a potential infinite retry loop.'
        },
        {
            id: 'llm-confusion',  category: 'LLM Behavior', severity: 'medium',
            name: 'Model Confusion',
            pattern: /\b(i('m| am) (confused|not sure what you|unclear about)|i don't understand (what you mean|your request|the question))\b/gi,
            desc: 'Model expresses confusion about the request.'
        },

        /* ── Security ── */
        {
            id: 'sec-sys-leak', category: 'Security', severity: 'critical',
            name: 'System Prompt Leak',
            pattern: /\b(my (system|initial|original) (prompt|instructions|directive)|the instructions i was given|as (per|specified in) my (instructions|prompt|config))\b/gi,
            desc: 'Potential system prompt disclosure in response.'
        },
        {
            id: 'sec-creds',    category: 'Security', severity: 'critical',
            name: 'Credential Exposure',
            pattern: /\b(api[_\-]?key|bearer[_\-]?token|access[_\-]?token|private[_\-]?key|client[_\-]?secret)\s*[=:]\s*\S{8,}/gi,
            desc: 'Possible credential or token embedded in trace.'
        },
        {
            id: 'sec-pii-email', category: 'Security', severity: 'high',
            name: 'PII: Email Address',
            pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
            desc: 'Email address found in trace content.'
        },
        {
            id: 'sec-injection', category: 'Security', severity: 'critical',
            name: 'Prompt Injection Attempt',
            pattern: /\b(ignore (all |previous |your )(instructions?|directives?|prompt)|disregard (your|all) (training|instructions)|you are now|new role:|forget (what you were told|your instructions))\b/gi,
            desc: 'Classic prompt injection patterns detected.'
        },
        {
            id: 'sec-jailbreak', category: 'Security', severity: 'critical',
            name: 'Jailbreak Attempt',
            pattern: /\b(DAN|do anything now|jailbreak|unrestricted mode|developer mode|god mode|bypass (safety|filter|restriction))\b/gi,
            desc: 'Common jailbreak terminology detected.'
        },

        /* ── Performance ── */
        {
            id: 'perf-tokens',   category: 'Performance', severity: 'medium',
            name: 'Token Limit Concern',
            pattern: /\b(context (window|limit|full|overflow|running out)|too many tokens?|token (limit|cap|budget|quota))\b/gi,
            desc: 'References to token or context window limits.'
        },
        {
            id: 'perf-redundant', category: 'Performance', severity: 'low',
            name: 'Redundant Tool Call',
            pattern: /\b(calling (the )?(same|identical) (tool|function|action) (again|twice|multiple times))\b/gi,
            desc: 'Model acknowledges making redundant tool calls.'
        },
        {
            id: 'perf-slowtool', category: 'Performance', severity: 'low',
            name: 'Slow Tool Reference',
            pattern: /\b(tool (is |was )?(slow|timed? ?out|unresponsive)|waiting for (the )?(tool|response|result))\b/gi,
            desc: 'References to tool slowness or timeouts.'
        },

        /* ── Quality ── */
        {
            id: 'qual-contradict', category: 'Quality', severity: 'high',
            name: 'Self-Contradiction',
            pattern: /\b(actually,? (no|that('s| is) (wrong|incorrect|not right))|let me (clarify|correct|revise) (that|this|myself)|i (misspoke|was wrong|made a mistake))\b/gi,
            desc: 'Model contradicts or corrects a prior statement.'
        },
        {
            id: 'qual-outdated', category: 'Quality', severity: 'medium',
            name: 'Outdated Information',
            pattern: /\b(as of my (knowledge |training )?cutoff|my knowledge (is |has a )?cut(off|s) (at|in|around)|my training data)\b/gi,
            desc: 'Model references its knowledge cutoff date.'
        },
        {
            id: 'qual-confab',   category: 'Quality', severity: 'high',
            name: 'Possible Confabulation',
            pattern: /\b(i('m| am) (making|coming) up|i fabricated|for the sake of (this|the) example|hypothetically (speaking|if ))\b/gi,
            desc: 'Model may be fabricating information.'
        },
        {
            id: 'qual-hedging',  category: 'Quality', severity: 'low',
            name: 'Excessive Hedging',
            pattern: /\b(i (think|believe|assume|suppose)|maybe|perhaps|possibly|probably|might be|could be|not 100%)\b/gi,
            desc: 'Heavy uncertainty language — low confidence output.'
        },

        /* ── OpenClaw ── */
        {
            id: 'oc-compact',    category: 'OpenClaw', severity: 'medium',
            name: '/compact Recommended',
            pattern: /\b(context (is |getting )?(full|large|heavy|near|approaching)|compressing context|\/compact)\b/gi,
            desc: 'Signals that /compact may be needed.'
        },
        {
            id: 'oc-elevated',   category: 'OpenClaw', severity: 'high',
            name: 'Elevated Session Action',
            pattern: /\b(elevated (session|mode|permissions?|access)|requires? elevation|running with elevated|in elevated mode)\b/gi,
            desc: 'The agent is using elevated permissions.'
        },
        {
            id: 'oc-skill-fail', category: 'OpenClaw', severity: 'high',
            name: 'Skill Failure',
            pattern: /\b(skill (failed|error|not found|unavailable|timeout)|could not (execute|run|invoke) (the |this )?skill)\b/gi,
            desc: 'An OpenClaw skill execution failure detected.'
        },
        {
            id: 'oc-sandbox',    category: 'OpenClaw', severity: 'medium',
            name: 'Sandbox Restriction Hit',
            pattern: /\b(sandbox (mode|restriction|denied|block)|access denied (in|by) sandbox|not allowed in (non-main|sandboxed) (session|mode))\b/gi,
            desc: 'Tool call blocked by sandbox policy.'
        },
        {
            id: 'oc-session-send', category: 'OpenClaw', severity: 'low',
            name: 'Multi-Agent Message Sent',
            pattern: /\bsessions_send\b/gi,
            desc: 'Sessions_send (multi-agent dispatch) detected.'
        }
    ];

    /* ---- Public ---- */

    function init(container) {
        _container = container;
        _loadActive();
        // Default all patterns to active
        LIBRARY.forEach(function (p) {
            if (_active[p.id] === undefined) { _active[p.id] = true; }
        });
    }

    function render(traceData) {
        _traceData = traceData;
        _renderView();
    }

    /**
     * Run all active patterns against traceData.
     * @param {Object} traceData
     * @returns {Array} matches
     */
    function runActivePatterns(traceData) {
        return _run(traceData || _traceData);
    }

    function getPatternLibrary() { return LIBRARY.slice(); }

    /* ---- View ---- */

    function _renderView() {
        if (!_container) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        // Summary card
        var sumCard = S.createElement('div', { 'class': 'analyzer-card full-width' });
        var activeCount = LIBRARY.filter(function (p) { return _active[p.id]; }).length;
        sumCard.appendChild(S.createElement('h3', { 'class': 'card-title' },
            'Community Pattern Library'));
        sumCard.appendChild(S.createElement('p', { 'class': 'view-desc' },
            LIBRARY.length + ' curated patterns across ' + _categoryCount() + ' categories. ' +
            activeCount + ' active. Toggle patterns on/off; results update instantly.'));
        _container.appendChild(sumCard);

        // Pattern groups
        var groups = _groupByCategory();
        Object.keys(groups).sort().forEach(function (cat) {
            var card = S.createElement('div', { 'class': 'analyzer-card full-width' });
            var catHdr = S.createElement('div', { 'class': 'patterns-cat-header' });
            catHdr.appendChild(S.createElement('h3', { 'class': 'card-title' }, cat));
            var cnt = groups[cat].filter(function (p) { return _active[p.id]; }).length;
            catHdr.appendChild(S.createElement('span', { 'class': 'hint-text' },
                cnt + '/' + groups[cat].length + ' active'));
            card.appendChild(catHdr);

            var grid = S.createElement('div', { 'class': 'patterns-grid' });
            groups[cat].forEach(function (p) { grid.appendChild(_buildPatternCard(p)); });
            card.appendChild(grid);
            _container.appendChild(card);
        });

        // Results
        if (_traceData) {
            var results  = _run(_traceData);
            var resCard  = S.createElement('div', { 'class': 'analyzer-card full-width' });
            resCard.appendChild(S.createElement('h3', { 'class': 'card-title' },
                'Pattern Matches \u2014 ' + results.length + ' match' +
                (results.length !== 1 ? 'es' : '')));
            if (results.length === 0) {
                resCard.appendChild(S.createElement('p', { 'class': 'no-data' },
                    'No active patterns matched the current trace.'));
            } else {
                var cap = Math.min(results.length, 100);
                for (var i = 0; i < cap; i++) { resCard.appendChild(_buildResult(results[i])); }
                if (results.length > cap) {
                    resCard.appendChild(S.createElement('p', { 'class': 'no-data' },
                        '\u2026 and ' + (results.length - cap) + ' more.'));
                }
            }
            _container.appendChild(resCard);
        }
    }

    function _buildPatternCard(p) {
        var card = S.createElement('div', { 'class': 'pattern-card severity-' + p.severity });

        var hdr = S.createElement('div', { 'class': 'pattern-card-header' });

        var togWrap = S.createElement('label', {
            'class': 'pattern-toggle-label',
            'for':   'pt-' + p.id,
            'title': _active[p.id] ? 'Disable pattern' : 'Enable pattern'
        });
        var tog = S.createElement('input', {
            'type': 'checkbox', 'id': 'pt-' + p.id,
            'class': 'toggle-checkbox', 'aria-label': p.name
        });
        tog.checked = !!_active[p.id];
        (function (pid) {
            tog.addEventListener('change', function () {
                _active[pid] = tog.checked;
                _saveActive();
                _renderView();
            });
        })(p.id);
        togWrap.appendChild(tog);
        hdr.appendChild(togWrap);

        hdr.appendChild(S.createElement('strong', { 'class': 'pattern-name' }, p.name));
        hdr.appendChild(S.createElement('span', {
            'class': 'severity-badge severity-' + p.severity
        }, p.severity));
        card.appendChild(hdr);
        card.appendChild(S.createElement('p', { 'class': 'pattern-desc hint-text' }, p.desc));
        return card;
    }

    function _buildResult(match) {
        var item = S.createElement('div', { 'class': 'finding-item' });
        item.appendChild(S.createElement('div', { 'class': 'finding-category' },
            match.pattern.name + '  \u00B7  [' + match.pattern.severity + ']  \u00B7  Step #' +
            match.step.index));
        item.appendChild(S.createElement('div', { 'class': 'finding-text' }, match.pattern.desc));
        var ev = S.createElement('div', { 'class': 'finding-evidence' });
        ev.textContent = match.step.summary;
        item.appendChild(ev);
        return item;
    }

    /* ---- Engine ---- */

    function _run(td) {
        if (!td || !td.steps) { return []; }
        var results = [];
        for (var pi = 0; pi < LIBRARY.length; pi++) {
            var p = LIBRARY[pi];
            if (!_active[p.id]) { continue; }
            for (var si = 0; si < td.steps.length; si++) {
                var text = td.steps[si].content || '';
                try {
                    // Re-create to reset lastIndex
                    var rx = new RegExp(p.pattern.source, p.pattern.flags || 'gi');
                    if (rx.test(text)) {
                        results.push({ pattern: p, step: td.steps[si] });
                    }
                } catch (e) { /* skip bad pattern */ }
            }
        }
        return results;
    }

    /* ---- Helpers ---- */

    function _groupByCategory() {
        var g = {};
        LIBRARY.forEach(function (p) {
            if (!g[p.category]) { g[p.category] = []; }
            g[p.category].push(p);
        });
        return g;
    }

    function _categoryCount() { return Object.keys(_groupByCategory()).length; }

    /* ---- Persistence ---- */

    function _loadActive() {
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                var parsed = JSON.parse(stored);
                if (parsed && typeof parsed === 'object') { _active = parsed; }
            }
        } catch (e) { _active = {}; }
    }

    function _saveActive() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_active)); } catch (e) {}
    }

    /* ---- Public API ---- */
    return {
        init: init,
        render: render,
        runActivePatterns: runActivePatterns,
        getPatternLibrary: getPatternLibrary
    };

})();
