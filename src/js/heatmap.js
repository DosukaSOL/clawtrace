/**
 * Clawtrace — Hallucination Heatmap Module
 * ============================================================
 * Word-level and sentence-level color highlighting on
 * conversation text. Each phrase that triggered a hallucination
 * signal, uncertainty marker, or contradiction gets painted
 * with a severity-graded color.
 *
 * Visual X-ray of AI reliability.
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Heatmap = (function () {

    var S = Clawtrace.Sanitizer;

    /* ---- Pattern Definitions ---- */

    var PATTERNS = [
        // Hallucination indicators (high severity)
        { regex: /\b(hallucin\w*|confabulat\w*|fabricat\w*|made[\s-]?up|invented)\b/gi, severity: 'critical', label: 'Hallucination signal' },
        { regex: /\b(i (apologize|was wrong|made an? (error|mistake)))\b/gi, severity: 'high', label: 'Error acknowledgment' },
        { regex: /\b(let me (correct|fix|revise|update) (that|this|my|myself))\b/gi, severity: 'high', label: 'Self-correction' },
        { regex: /\b(actually|wait|correction)[,.]?\s/gi, severity: 'medium', label: 'Mid-stream correction' },
        { regex: /\b(as of my (last |knowledge )?(?:cutoff|training|update))\b/gi, severity: 'medium', label: 'Knowledge cutoff' },

        // Contradiction indicators
        { regex: /\b(this contradicts|inconsistent with|does not match|conflicts with)\b/gi, severity: 'high', label: 'Contradiction' },
        { regex: /\b(previously i said|earlier i (mentioned|stated|said))\b/gi, severity: 'medium', label: 'Self-reference' },
        { regex: /\b(on the contrary|conversely|in contrast|the opposite)\b/gi, severity: 'low', label: 'Contrasting statement' },

        // Uncertainty indicators
        { regex: /\bi('m| am) not (sure|certain|confident)\b/gi, severity: 'medium', label: 'Uncertainty admission' },
        { regex: /\b(not sure|unclear|uncertain|don't know|cannot determine)\b/gi, severity: 'medium', label: 'Uncertainty' },
        { regex: /\bi (think|believe|guess|suppose|assume)\b/gi, severity: 'low', label: 'Hedging' },
        { regex: /\b(maybe|perhaps|possibly|probably|might|could be)\b/gi, severity: 'low', label: 'Probabilistic' },
        { regex: /\b(approximately|roughly|around|estimated)\b/gi, severity: 'low', label: 'Imprecise' }
    ];

    var SEVERITY_COLORS = {
        critical: { bg: 'rgba(220, 38, 38, 0.3)', border: '#dc2626', text: '#fca5a5' },
        high:     { bg: 'rgba(239, 68, 68, 0.25)', border: '#ef4444', text: '#fca5a5' },
        medium:   { bg: 'rgba(245, 158, 11, 0.2)', border: '#f59e0b', text: '#fde68a' },
        low:      { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', text: '#86efac' }
    };

    var _container = null;

    /* ---- Initialize ---- */

    function init(container) {
        _container = container;
    }

    /* ---- Render Heatmap ---- */

    function render(traceData, analysisResult) {
        if (!_container || !traceData || !traceData.steps) { return; }

        while (_container.firstChild) {
            _container.removeChild(_container.firstChild);
        }

        // Legend
        var legend = buildLegend();
        _container.appendChild(legend);

        // Summary stats
        var stats = computeHeatmapStats(traceData);
        var summary = buildSummary(stats);
        _container.appendChild(summary);

        // Heatmap for each step
        for (var i = 0; i < traceData.steps.length; i++) {
            var step = traceData.steps[i];
            if (!step.content || step.content.trim().length === 0) { continue; }

            var stepEl = buildStepHeatmap(step, i);
            _container.appendChild(stepEl);
        }

        if (traceData.steps.length === 0) {
            var empty = S.createElement('p', { 'class': 'no-data' }, 'No trace data to visualize.');
            _container.appendChild(empty);
        }
    }

    /* ---- Build Legend ---- */

    function buildLegend() {
        var legend = S.createElement('div', { 'class': 'heatmap-legend' });
        var title = S.createElement('span', { 'class': 'heatmap-legend-title' }, 'Severity Legend:');
        legend.appendChild(title);

        var levels = ['critical', 'high', 'medium', 'low'];
        var labels = ['Critical', 'High', 'Medium', 'Low'];

        for (var i = 0; i < levels.length; i++) {
            var item = S.createElement('span', { 'class': 'heatmap-legend-item heatmap-severity-' + levels[i] }, labels[i]);
            legend.appendChild(item);
        }

        return legend;
    }

    /* ---- Compute Stats ---- */

    function computeHeatmapStats(traceData) {
        var counts = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };

        for (var i = 0; i < traceData.steps.length; i++) {
            var content = traceData.steps[i].content || '';
            for (var p = 0; p < PATTERNS.length; p++) {
                var pat = PATTERNS[p];
                var regex = new RegExp(pat.regex.source, pat.regex.flags);
                var matches = content.match(regex);
                if (matches) {
                    counts[pat.severity] += matches.length;
                    counts.total += matches.length;
                }
            }
        }

        return counts;
    }

    /* ---- Build Summary ---- */

    function buildSummary(stats) {
        var summary = S.createElement('div', { 'class': 'heatmap-summary' });

        var items = [
            { label: 'Total Flags', value: stats.total, cls: '' },
            { label: 'Critical', value: stats.critical, cls: 'heatmap-severity-critical' },
            { label: 'High', value: stats.high, cls: 'heatmap-severity-high' },
            { label: 'Medium', value: stats.medium, cls: 'heatmap-severity-medium' },
            { label: 'Low', value: stats.low, cls: 'heatmap-severity-low' }
        ];

        for (var i = 0; i < items.length; i++) {
            var card = S.createElement('div', { 'class': 'heatmap-stat-card ' + items[i].cls });
            var val = S.createElement('div', { 'class': 'heatmap-stat-value' }, String(items[i].value));
            var lbl = S.createElement('div', { 'class': 'heatmap-stat-label' }, items[i].label);
            card.appendChild(val);
            card.appendChild(lbl);
            summary.appendChild(card);
        }

        return summary;
    }

    /* ---- Build Step Heatmap ---- */

    function buildStepHeatmap(step, index) {
        var wrapper = S.createElement('div', { 'class': 'heatmap-step' });

        // Header
        var header = S.createElement('div', { 'class': 'heatmap-step-header' });
        var num = S.createElement('span', { 'class': 'heatmap-step-num' }, '#' + (index + 1));
        var type = S.createElement('span', { 'class': 'heatmap-step-type heatmap-type-' + (step.type || 'system') }, (step.type || 'system').toUpperCase());
        header.appendChild(num);
        header.appendChild(type);
        wrapper.appendChild(header);

        // Content with highlights
        var contentDiv = S.createElement('div', { 'class': 'heatmap-step-content' });
        var highlighted = highlightText(step.content || '');
        contentDiv.appendChild(highlighted);
        wrapper.appendChild(contentDiv);

        return wrapper;
    }

    /* ---- Text Highlighting Engine ---- */

    function highlightText(text) {
        // Find all matches with their positions
        var marks = [];

        for (var p = 0; p < PATTERNS.length; p++) {
            var pat = PATTERNS[p];
            var regex = new RegExp(pat.regex.source, pat.regex.flags);
            var match;

            while ((match = regex.exec(text)) !== null) {
                marks.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    severity: pat.severity,
                    label: pat.label,
                    text: match[0]
                });
            }
        }

        // Sort by position
        marks.sort(function (a, b) { return a.start - b.start; });

        // Remove overlaps (keep higher severity)
        var filtered = [];
        var SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

        for (var i = 0; i < marks.length; i++) {
            var current = marks[i];
            var dominated = false;

            for (var j = 0; j < filtered.length; j++) {
                var existing = filtered[j];
                // Check overlap
                if (current.start < existing.end && current.end > existing.start) {
                    // Overlap — keep higher severity
                    if (SEVERITY_RANK[current.severity] <= SEVERITY_RANK[existing.severity]) {
                        dominated = true;
                        break;
                    } else {
                        filtered.splice(j, 1);
                        j--;
                    }
                }
            }

            if (!dominated) {
                filtered.push(current);
            }
        }

        // Build DOM fragment
        var fragment = document.createDocumentFragment();
        var pos = 0;
        var truncatedText = text.length > 3000 ? text.substring(0, 3000) : text;

        for (var m = 0; m < filtered.length; m++) {
            var mark = filtered[m];
            if (mark.start > truncatedText.length) { break; }

            // Text before this mark
            if (mark.start > pos) {
                var beforeText = truncatedText.substring(pos, mark.start);
                fragment.appendChild(document.createTextNode(beforeText));
            }

            // Highlighted span
            var span = document.createElement('span');
            span.className = 'heatmap-highlight heatmap-severity-' + mark.severity;
            span.setAttribute('title', mark.label);
            span.setAttribute('data-severity', mark.severity);
            span.textContent = truncatedText.substring(mark.start, Math.min(mark.end, truncatedText.length));
            fragment.appendChild(span);

            pos = Math.min(mark.end, truncatedText.length);
        }

        // Remaining text
        if (pos < truncatedText.length) {
            fragment.appendChild(document.createTextNode(truncatedText.substring(pos)));
        }

        if (text.length > 3000) {
            fragment.appendChild(document.createTextNode('\n... [truncated for display]'));
        }

        return fragment;
    }

    /* ---- Public API ---- */

    return {
        init: init,
        render: render
    };

})();
