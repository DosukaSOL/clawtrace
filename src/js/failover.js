/**
 * Clawtrace — Model Failover Analyzer
 * ============================================================
 * Tracks model switches, token rotations, and failover events
 * in OpenClaw traces. Compares model performance metrics.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Failover = (function () {

    var S = Clawtrace.Sanitizer;
    var _container = null;

    var MODEL_PATTERNS = [
        { regex: /claude[_\-]?opus[_\-]?4[._\-]?6/i, name: 'Claude Opus 4.6', provider: 'Anthropic' },
        { regex: /claude[_\-]?sonnet[_\-]?4/i, name: 'Claude Sonnet 4', provider: 'Anthropic' },
        { regex: /claude[_\-]?3[._\-]?5[._\-]?sonnet/i, name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
        { regex: /gpt[_\-]?5[._\-]?2/i, name: 'GPT-5.2', provider: 'OpenAI' },
        { regex: /gpt[_\-]?4o/i, name: 'GPT-4o', provider: 'OpenAI' },
        { regex: /gpt[_\-]?4[_\-]?turbo/i, name: 'GPT-4 Turbo', provider: 'OpenAI' },
        { regex: /o1[_\-]?mini/i, name: 'o1-mini', provider: 'OpenAI' },
        { regex: /\bo1\b/i, name: 'o1', provider: 'OpenAI' },
        { regex: /gemini[_\-]?1[._\-]?5[._\-]?pro/i, name: 'Gemini 1.5 Pro', provider: 'Google' },
        { regex: /gemini[_\-]?pro/i, name: 'Gemini Pro', provider: 'Google' },
        { regex: /deepseek/i, name: 'DeepSeek', provider: 'DeepSeek' },
        { regex: /llama/i, name: 'Llama', provider: 'Meta' }
    ];

    function init(container) { _container = container; }

    function render(traceData) {
        if (!_container || !traceData) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        var analysis = analyzeFailover(traceData);
        renderModelTimeline(analysis);
        renderFailoverEvents(analysis);
        renderModelComparison(analysis);
    }

    function analyzeFailover(traceData) {
        var models = [];
        var currentModel = null;
        var switches = [];
        var failovers = [];
        var modelStats = {};

        for (var i = 0; i < traceData.steps.length; i++) {
            var step = traceData.steps[i];
            var content = (step.content || '') + ' ' + (step.raw || '');
            var meta = step.metadata || {};

            // Detect model
            var detected = meta.model || detectModel(content);
            if (detected && detected !== currentModel) {
                if (currentModel) {
                    var isFailover = content.toLowerCase().indexOf('failover') > -1 ||
                                    content.toLowerCase().indexOf('fallback') > -1 ||
                                    content.toLowerCase().indexOf('retry') > -1 ||
                                    content.toLowerCase().indexOf('rate_limit') > -1;
                    switches.push({
                        from: currentModel,
                        to: detected,
                        step: i,
                        isFailover: isFailover
                    });
                    if (isFailover) { failovers.push(switches[switches.length - 1]); }
                }
                currentModel = detected;
                if (!models.includes(detected)) { models.push(detected); }
            }

            // Track per-model stats
            if (currentModel) {
                if (!modelStats[currentModel]) {
                    modelStats[currentModel] = { steps: 0, tokens: 0, errors: 0 };
                }
                modelStats[currentModel].steps++;
                modelStats[currentModel].tokens += Math.ceil((step.content || '').length / 4);
                if (step.type === 'error') { modelStats[currentModel].errors++; }
            }
        }

        return {
            models: models,
            switches: switches,
            failovers: failovers,
            modelStats: modelStats,
            hasMultiModel: models.length > 1
        };
    }

    function detectModel(content) {
        for (var i = 0; i < MODEL_PATTERNS.length; i++) {
            if (MODEL_PATTERNS[i].regex.test(content)) {
                return MODEL_PATTERNS[i].name;
            }
        }
        return null;
    }

    function getProvider(modelName) {
        for (var i = 0; i < MODEL_PATTERNS.length; i++) {
            if (MODEL_PATTERNS[i].name === modelName) { return MODEL_PATTERNS[i].provider; }
        }
        return 'Unknown';
    }

    function renderModelTimeline(analysis) {
        var section = S.createElement('div', { 'class': 'fo-timeline' });
        var title = S.createElement('h3', { 'class': 'fo-section-title' }, 'Model Usage');
        section.appendChild(title);

        if (analysis.models.length === 0) {
            section.appendChild(S.createElement('div', { 'class': 'fo-empty' },
                'No model information detected. OpenClaw supports multiple models with automatic failover. ' +
                'Load a trace with model metadata to see failover analysis.'));
            _container.appendChild(section);
            return;
        }

        var grid = S.createElement('div', { 'class': 'fo-stat-grid' });
        var stats = [
            { label: 'Models Detected', value: String(analysis.models.length) },
            { label: 'Model Switches', value: String(analysis.switches.length) },
            { label: 'Failover Events', value: String(analysis.failovers.length) },
            { label: 'Primary Model', value: analysis.models[0] || 'Unknown' }
        ];

        for (var i = 0; i < stats.length; i++) {
            var card = S.createElement('div', { 'class': 'fo-stat-card' });
            card.appendChild(S.createElement('div', { 'class': 'fo-stat-value' }, stats[i].value));
            card.appendChild(S.createElement('div', { 'class': 'fo-stat-label' }, stats[i].label));
            grid.appendChild(card);
        }
        section.appendChild(grid);
        _container.appendChild(section);
    }

    function renderFailoverEvents(analysis) {
        if (analysis.switches.length === 0) { return; }

        var section = S.createElement('div', { 'class': 'fo-events' });
        var title = S.createElement('h3', { 'class': 'fo-section-title' }, 'Model Switch Events');
        section.appendChild(title);

        for (var i = 0; i < analysis.switches.length; i++) {
            var sw = analysis.switches[i];
            var item = S.createElement('div', {
                'class': 'fo-event' + (sw.isFailover ? ' fo-event-failover' : '')
            });
            item.appendChild(S.createElement('span', { 'class': 'fo-event-badge' },
                sw.isFailover ? 'FAILOVER' : 'SWITCH'));
            item.appendChild(S.createElement('span', { 'class': 'fo-event-detail' },
                sw.from + ' \u2192 ' + sw.to));
            item.appendChild(S.createElement('span', { 'class': 'fo-event-step' },
                'Step ' + (sw.step + 1)));
            section.appendChild(item);
        }

        _container.appendChild(section);
    }

    function renderModelComparison(analysis) {
        if (analysis.models.length === 0) { return; }

        var section = S.createElement('div', { 'class': 'fo-comparison' });
        var title = S.createElement('h3', { 'class': 'fo-section-title' }, 'Model Performance Comparison');
        section.appendChild(title);

        var table = S.createElement('div', { 'class': 'fo-table' });
        var header = S.createElement('div', { 'class': 'fo-table-row fo-header' });
        var cols = ['Model', 'Provider', 'Steps', 'Est. Tokens', 'Errors'];
        for (var h = 0; h < cols.length; h++) {
            header.appendChild(S.createElement('div', { 'class': 'fo-table-cell' }, cols[h]));
        }
        table.appendChild(header);

        for (var m = 0; m < analysis.models.length; m++) {
            var model = analysis.models[m];
            var stats = analysis.modelStats[model] || { steps: 0, tokens: 0, errors: 0 };
            var row = S.createElement('div', { 'class': 'fo-table-row' });
            row.appendChild(S.createElement('div', { 'class': 'fo-table-cell fo-model-name' }, model));
            row.appendChild(S.createElement('div', { 'class': 'fo-table-cell' }, getProvider(model)));
            row.appendChild(S.createElement('div', { 'class': 'fo-table-cell' }, String(stats.steps)));
            row.appendChild(S.createElement('div', { 'class': 'fo-table-cell' }, stats.tokens.toLocaleString()));
            row.appendChild(S.createElement('div', {
                'class': 'fo-table-cell' + (stats.errors > 0 ? ' fo-error' : '')
            }, String(stats.errors)));
            table.appendChild(row);
        }

        section.appendChild(table);
        _container.appendChild(section);
    }

    return { init: init, render: render };
})();
