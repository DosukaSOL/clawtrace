/**
 * Clawtrace — Comparison Module
 * ============================================================
 * Provides side-by-side trace comparison with diff highlighting.
 * Compares parsed trace data at the step level.
 *
 * All rendering uses safe DOM methods (textContent, createElement).
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Comparison = (function () {

    var S = Clawtrace.Sanitizer;
    var P = Clawtrace.Parser;

    /**
     * Compares two raw trace inputs and returns a diff result.
     *
     * @param {string} inputA - Raw trace A
     * @param {string} inputB - Raw trace B
     * @returns {{success: boolean, error: string|null, result: Object|null}}
     */
    function compare(inputA, inputB) {
        // Parse both
        var resultA = P.parse(inputA);
        var resultB = P.parse(inputB);

        if (!resultA.success) {
            return { success: false, error: 'Trace A: ' + resultA.error, result: null };
        }
        if (!resultB.success) {
            return { success: false, error: 'Trace B: ' + resultB.error, result: null };
        }

        var stepsA = resultA.data.steps;
        var stepsB = resultB.data.steps;

        // Compute diff at step level
        var diff = computeStepDiff(stepsA, stepsB);

        return {
            success: true,
            error: null,
            result: {
                traceA: resultA.data,
                traceB: resultB.data,
                diff: diff
            }
        };
    }

    /**
     * Computes a step-level diff between two step arrays.
     * Uses a simple alignment algorithm (not full LCS for performance).
     *
     * @param {Array} stepsA
     * @param {Array} stepsB
     * @returns {Object} Diff result
     */
    function computeStepDiff(stepsA, stepsB) {
        var maxSteps = Math.max(stepsA.length, stepsB.length);
        var diffSteps = [];
        var addedCount = 0;
        var removedCount = 0;
        var changedCount = 0;
        var sameCount = 0;

        for (var i = 0; i < maxSteps; i++) {
            var a = i < stepsA.length ? stepsA[i] : null;
            var b = i < stepsB.length ? stepsB[i] : null;

            if (a && b) {
                // Both exist at this index — compare
                if (a.type === b.type && a.content === b.content) {
                    diffSteps.push({
                        index: i,
                        status: 'same',
                        stepA: a,
                        stepB: b
                    });
                    sameCount++;
                } else {
                    diffSteps.push({
                        index: i,
                        status: 'changed',
                        stepA: a,
                        stepB: b,
                        changes: describeChanges(a, b)
                    });
                    changedCount++;
                }
            } else if (a && !b) {
                diffSteps.push({
                    index: i,
                    status: 'removed',
                    stepA: a,
                    stepB: null
                });
                removedCount++;
            } else if (!a && b) {
                diffSteps.push({
                    index: i,
                    status: 'added',
                    stepA: null,
                    stepB: b
                });
                addedCount++;
            }
        }

        return {
            steps: diffSteps,
            summary: {
                totalA: stepsA.length,
                totalB: stepsB.length,
                same: sameCount,
                changed: changedCount,
                added: addedCount,
                removed: removedCount
            }
        };
    }

    /**
     * Describes the differences between two steps.
     */
    function describeChanges(a, b) {
        var changes = [];

        if (a.type !== b.type) {
            changes.push('Type: ' + a.type + ' → ' + b.type);
        }

        if (a.content !== b.content) {
            // Compute rough content difference
            var aLen = (a.content || '').length;
            var bLen = (b.content || '').length;
            var lenDiff = bLen - aLen;
            changes.push('Content changed (' +
                (lenDiff > 0 ? '+' : '') + lenDiff + ' chars)');
        }

        return changes;
    }

    /**
     * Renders the comparison results to the output container.
     *
     * @param {Object} result - Comparison result
     * @param {HTMLElement} container - Output container
     */
    function renderComparison(result, container) {
        if (!container) { return; }

        // Clear
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        var diff = result.diff;
        var summary = diff.summary;

        // Summary bar
        var summaryEl = S.createElement('div', { 'class': 'diff-summary' });
        var summaryTitle = S.createElement('h4', {}, 'Comparison Summary');
        summaryEl.appendChild(summaryTitle);

        var statRow = S.createElement('div', { 'class': 'diff-stat' });

        var statItems = [
            { label: 'Trace A', value: summary.totalA + ' steps', color: '' },
            { label: 'Trace B', value: summary.totalB + ' steps', color: '' },
            { label: 'Same', value: String(summary.same), color: 'var(--text-secondary)' },
            { label: 'Changed', value: String(summary.changed), color: 'var(--warning)' },
            { label: 'Added', value: String(summary.added), color: 'var(--success)' },
            { label: 'Removed', value: String(summary.removed), color: 'var(--error)' }
        ];

        for (var s = 0; s < statItems.length; s++) {
            var item = S.createElement('span', { 'class': 'diff-stat-item' });
            var label = S.createElement('span', {}, statItems[s].label + ': ');
            var val = S.createElement('strong', {
                'style': statItems[s].color ? 'color: ' + statItems[s].color : ''
            }, statItems[s].value);
            item.appendChild(label);
            item.appendChild(val);
            statRow.appendChild(item);
        }

        summaryEl.appendChild(statRow);
        container.appendChild(summaryEl);

        // Side-by-side diff panels
        var diffContainer = S.createElement('div', { 'class': 'diff-container' });

        var panelA = S.createElement('div', { 'class': 'diff-panel' });
        var panelATitle = S.createElement('h4', {}, 'Trace A');
        panelA.appendChild(panelATitle);

        var panelB = S.createElement('div', { 'class': 'diff-panel' });
        var panelBTitle = S.createElement('h4', {}, 'Trace B');
        panelB.appendChild(panelBTitle);

        for (var i = 0; i < diff.steps.length; i++) {
            var d = diff.steps[i];

            // Panel A step
            var stepAEl = S.createElement('div', {
                'class': 'diff-step diff-' + d.status
            });
            if (d.stepA) {
                stepAEl.textContent = '#' + d.index + ' [' + d.stepA.type + '] ' +
                                      truncate(d.stepA.summary, 100);
            } else {
                stepAEl.textContent = '#' + d.index + ' [not present]';
            }
            panelA.appendChild(stepAEl);

            // Panel B step
            var stepBEl = S.createElement('div', {
                'class': 'diff-step diff-' + d.status
            });
            if (d.stepB) {
                stepBEl.textContent = '#' + d.index + ' [' + d.stepB.type + '] ' +
                                      truncate(d.stepB.summary, 100);
            } else {
                stepBEl.textContent = '#' + d.index + ' [not present]';
            }
            panelB.appendChild(stepBEl);
        }

        diffContainer.appendChild(panelA);
        diffContainer.appendChild(panelB);
        container.appendChild(diffContainer);

        container.hidden = false;
    }

    /**
     * Simple string truncation helper.
     */
    function truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.substring(0, len - 3) + '...' : str;
    }

    /* ---- Public API ---- */
    return {
        compare: compare,
        renderComparison: renderComparison
    };

})();
