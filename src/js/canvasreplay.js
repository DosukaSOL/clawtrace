/**
 * Clawtrace — Canvas/A2UI Action Replay
 * ============================================================
 * Visual replay of OpenClaw Canvas operations:
 *   canvas.push, canvas.reset, canvas.eval, canvas.snapshot
 * Step-through replay of what the user's Canvas showed.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.CanvasReplay = (function () {

    var S = Clawtrace.Sanitizer;
    var _container = null;

    var CANVAS_OPS = [
        { pattern: /canvas\.push/i, type: 'push', label: 'Canvas Push', icon: '\u25B6', color: '#a78bfa' },
        { pattern: /canvas\.reset/i, type: 'reset', label: 'Canvas Reset', icon: '\u21BA', color: '#ef4444' },
        { pattern: /canvas\.eval/i, type: 'eval', label: 'Canvas Eval', icon: '\u2699', color: '#f59e0b' },
        { pattern: /canvas\.snapshot/i, type: 'snapshot', label: 'Canvas Snapshot', icon: '\u{1F4F7}', color: '#3b82f6' },
        { pattern: /a2ui/i, type: 'a2ui', label: 'A2UI Render', icon: '\u2756', color: '#FF4500' }
    ];

    function init(container) { _container = container; }

    function render(traceData) {
        if (!_container || !traceData) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        var ops = extractCanvasOps(traceData);
        renderSummary(ops);
        renderOpTimeline(ops);
        renderCanvasState(ops);
    }

    function extractCanvasOps(traceData) {
        var operations = [];

        for (var i = 0; i < traceData.steps.length; i++) {
            var step = traceData.steps[i];
            var content = step.content || '';

            for (var p = 0; p < CANVAS_OPS.length; p++) {
                if (CANVAS_OPS[p].pattern.test(content)) {
                    operations.push({
                        step: i,
                        type: CANVAS_OPS[p].type,
                        label: CANVAS_OPS[p].label,
                        icon: CANVAS_OPS[p].icon,
                        color: CANVAS_OPS[p].color,
                        content: content.substring(0, 500),
                        payload: extractPayload(content)
                    });
                    break;
                }
            }
        }

        return operations;
    }

    function extractPayload(content) {
        // Try to extract the data/HTML/code being pushed
        var match = content.match(/(?:html|content|data|code)\s*[:=]\s*["']?([\s\S]{0,300})/i);
        return match ? match[1] : null;
    }

    function renderSummary(ops) {
        var section = S.createElement('div', { 'class': 'cr-summary' });
        var title = S.createElement('h3', { 'class': 'cr-section-title' }, 'Canvas Operations');
        section.appendChild(title);

        if (ops.length === 0) {
            section.appendChild(S.createElement('div', { 'class': 'cr-empty' },
                'No Canvas/A2UI operations detected in this trace. OpenClaw\'s Canvas is an agent-driven visual workspace. ' +
                'Operations include canvas.push (render content), canvas.reset (clear), canvas.eval (run JS), and canvas.snapshot (capture). ' +
                'Load a trace from an OpenClaw session that uses Canvas to see the replay.'));
            _container.appendChild(section);
            return;
        }

        var typeCounts = {};
        for (var i = 0; i < ops.length; i++) {
            typeCounts[ops[i].type] = (typeCounts[ops[i].type] || 0) + 1;
        }

        var grid = S.createElement('div', { 'class': 'cr-stat-grid' });
        var stats = [
            { label: 'Total Operations', value: String(ops.length) },
            { label: 'Push', value: String(typeCounts['push'] || 0) },
            { label: 'Reset', value: String(typeCounts['reset'] || 0) },
            { label: 'Eval/Snapshot', value: String((typeCounts['eval'] || 0) + (typeCounts['snapshot'] || 0)) }
        ];

        for (var s = 0; s < stats.length; s++) {
            var card = S.createElement('div', { 'class': 'cr-stat-card' });
            card.appendChild(S.createElement('div', { 'class': 'cr-stat-value' }, stats[s].value));
            card.appendChild(S.createElement('div', { 'class': 'cr-stat-label' }, stats[s].label));
            grid.appendChild(card);
        }
        section.appendChild(grid);
        _container.appendChild(section);
    }

    function renderOpTimeline(ops) {
        if (ops.length === 0) { return; }

        var section = S.createElement('div', { 'class': 'cr-timeline' });
        var title = S.createElement('h3', { 'class': 'cr-section-title' }, 'Operation Sequence');
        section.appendChild(title);

        for (var i = 0; i < ops.length; i++) {
            var op = ops[i];
            var item = S.createElement('div', { 'class': 'cr-op-item' });

            var dot = S.createElement('div', { 'class': 'cr-op-dot' });
            dot.style.backgroundColor = op.color;

            var body = S.createElement('div', { 'class': 'cr-op-body' });
            var header = S.createElement('div', { 'class': 'cr-op-header' });
            header.appendChild(S.createElement('span', { 'class': 'cr-op-icon' }, op.icon));
            header.appendChild(S.createElement('span', { 'class': 'cr-op-label' }, op.label));
            header.appendChild(S.createElement('span', { 'class': 'cr-op-step' }, 'Step ' + (op.step + 1)));
            body.appendChild(header);

            if (op.payload) {
                var preview = S.createElement('div', { 'class': 'cr-op-payload' }, op.payload.substring(0, 200));
                body.appendChild(preview);
            }

            item.appendChild(dot);
            item.appendChild(body);
            section.appendChild(item);
        }

        _container.appendChild(section);
    }

    function renderCanvasState(ops) {
        if (ops.length === 0) { return; }

        var section = S.createElement('div', { 'class': 'cr-state' });
        var title = S.createElement('h3', { 'class': 'cr-section-title' }, 'Canvas State Transitions');
        section.appendChild(title);

        var states = [];
        var currentState = 'empty';

        for (var i = 0; i < ops.length; i++) {
            var op = ops[i];
            var prevState = currentState;

            if (op.type === 'push' || op.type === 'a2ui') {
                currentState = 'content';
            } else if (op.type === 'reset') {
                currentState = 'empty';
            } else if (op.type === 'eval') {
                currentState = 'modified';
            }

            states.push({
                op: op.label,
                from: prevState,
                to: currentState,
                step: op.step
            });
        }

        for (var j = 0; j < states.length; j++) {
            var state = states[j];
            var row = S.createElement('div', { 'class': 'cr-state-row' });
            row.appendChild(S.createElement('span', { 'class': 'cr-state-badge cr-state-' + state.from }, state.from));
            row.appendChild(S.createElement('span', { 'class': 'cr-state-arrow' }, '\u2192'));
            row.appendChild(S.createElement('span', { 'class': 'cr-state-op' }, state.op));
            row.appendChild(S.createElement('span', { 'class': 'cr-state-arrow' }, '\u2192'));
            row.appendChild(S.createElement('span', { 'class': 'cr-state-badge cr-state-' + state.to }, state.to));
            section.appendChild(row);
        }

        _container.appendChild(section);
    }

    return { init: init, render: render };
})();
