/**
 * Clawtrace — Token Cost Calculator Module
 * ============================================================
 * Estimates the cost of a trace across every major AI model.
 * Input/output token counting with per-model pricing.
 * Auto-detects model from metadata when available.
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.CostCalc = (function () {

    var S = Clawtrace.Sanitizer;

    /* ---- Model Pricing (per 1M tokens, USD) ---- */
    /* Prices as of early 2026 — easily updatable */

    var MODELS = [
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', input: 2.50, output: 10.00 },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', input: 0.15, output: 0.60 },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', input: 10.00, output: 30.00 },
        { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', input: 30.00, output: 60.00 },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', input: 0.50, output: 1.50 },
        { id: 'o1', name: 'o1', provider: 'OpenAI', input: 15.00, output: 60.00 },
        { id: 'o1-mini', name: 'o1 Mini', provider: 'OpenAI', input: 3.00, output: 12.00 },
        { id: 'claude-opus-4', name: 'Claude Opus 4', provider: 'Anthropic', input: 15.00, output: 75.00 },
        { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic', input: 3.00, output: 15.00 },
        { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', input: 3.00, output: 15.00 },
        { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic', input: 0.25, output: 1.25 },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google', input: 0.10, output: 0.40 },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', input: 1.25, output: 5.00 },
        { id: 'llama-3.1-405b', name: 'Llama 3.1 405B', provider: 'Meta (hosted)', input: 3.00, output: 3.00 },
        { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', provider: 'Meta (hosted)', input: 0.59, output: 0.79 },
        { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', provider: 'Meta (hosted)', input: 0.05, output: 0.08 },
        { id: 'mistral-large', name: 'Mistral Large', provider: 'Mistral', input: 2.00, output: 6.00 },
        { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', provider: 'Mistral', input: 0.24, output: 0.24 },
        { id: 'deepseek-v3', name: 'DeepSeek V3', provider: 'DeepSeek', input: 0.27, output: 1.10 },
        { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', input: 0.55, output: 2.19 }
    ];

    var _container = null;

    /* ---- Token Estimation ---- */

    /**
     * Rough token count estimate.
     * ~4 characters per token for English text (GPT-style tokenization).
     */
    function estimateTokens(text) {
        if (!text) { return 0; }
        return Math.ceil(text.length / 4);
    }

    /* ---- Compute Costs ---- */

    function computeCosts(traceData) {
        if (!traceData || !traceData.steps) {
            return { inputTokens: 0, outputTokens: 0, totalTokens: 0, costs: [], detectedModel: null };
        }

        var inputTokens = 0;
        var outputTokens = 0;
        var detectedModel = null;

        for (var i = 0; i < traceData.steps.length; i++) {
            var step = traceData.steps[i];
            var content = step.content || '';
            var tokens = estimateTokens(content);

            if (step.type === 'user' || step.type === 'system') {
                inputTokens += tokens;
            } else {
                outputTokens += tokens;
            }

            // Try to detect model from metadata
            if (!detectedModel && step.metadata) {
                var model = step.metadata.model || step.metadata.model_id || '';
                if (model) {
                    detectedModel = model;
                }
            }
        }

        var totalTokens = inputTokens + outputTokens;

        // Compute cost for each model
        var costs = [];
        for (var m = 0; m < MODELS.length; m++) {
            var mod = MODELS[m];
            var inputCost = (inputTokens / 1000000) * mod.input;
            var outputCost = (outputTokens / 1000000) * mod.output;
            var totalCost = inputCost + outputCost;

            costs.push({
                id: mod.id,
                name: mod.name,
                provider: mod.provider,
                inputCost: inputCost,
                outputCost: outputCost,
                totalCost: totalCost,
                isDetected: detectedModel ? mod.id.indexOf(detectedModel.toLowerCase()) !== -1 || detectedModel.toLowerCase().indexOf(mod.id) !== -1 : false
            });
        }

        // Sort by total cost
        costs.sort(function (a, b) { return a.totalCost - b.totalCost; });

        return {
            inputTokens: inputTokens,
            outputTokens: outputTokens,
            totalTokens: totalTokens,
            costs: costs,
            detectedModel: detectedModel
        };
    }

    /* ---- Initialize ---- */

    function init(container) {
        _container = container;
    }

    /* ---- Render ---- */

    function render(traceData) {
        if (!_container) { return; }

        while (_container.firstChild) {
            _container.removeChild(_container.firstChild);
        }

        var result = computeCosts(traceData);

        // Token summary
        var summary = S.createElement('div', { 'class': 'cost-summary' });

        var cards = [
            { label: 'Input Tokens', value: result.inputTokens.toLocaleString(), icon: '\u2B06' },
            { label: 'Output Tokens', value: result.outputTokens.toLocaleString(), icon: '\u2B07' },
            { label: 'Total Tokens', value: result.totalTokens.toLocaleString(), icon: '\u2211' }
        ];

        if (result.detectedModel) {
            cards.push({ label: 'Detected Model', value: result.detectedModel, icon: '\uD83E\uDD16' });
        }

        for (var c = 0; c < cards.length; c++) {
            var card = S.createElement('div', { 'class': 'cost-stat-card' });
            var icon = S.createElement('div', { 'class': 'cost-stat-icon' }, cards[c].icon);
            var val = S.createElement('div', { 'class': 'cost-stat-value' }, cards[c].value);
            var lbl = S.createElement('div', { 'class': 'cost-stat-label' }, cards[c].label);
            card.appendChild(icon);
            card.appendChild(val);
            card.appendChild(lbl);
            summary.appendChild(card);
        }

        _container.appendChild(summary);

        // Info note
        var note = S.createElement('p', { 'class': 'cost-note' }, 'Token counts are estimates (~4 chars/token). Actual costs depend on your model, provider, and contract. Prices are approximate as of early 2026.');
        _container.appendChild(note);

        // Cost comparison table
        var tableWrap = S.createElement('div', { 'class': 'cost-table-wrap' });
        var table = S.createElement('table', { 'class': 'cost-table' });

        // Header
        var thead = S.createElement('thead');
        var headerRow = S.createElement('tr');
        var headers = ['Model', 'Provider', 'Input Cost', 'Output Cost', 'Total Cost'];
        for (var h = 0; h < headers.length; h++) {
            var th = S.createElement('th', {}, headers[h]);
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        var tbody = S.createElement('tbody');
        for (var r = 0; r < result.costs.length; r++) {
            var cost = result.costs[r];
            var row = S.createElement('tr', { 'class': cost.isDetected ? 'cost-detected' : '' });

            var tdName = S.createElement('td', { 'class': 'cost-model-name' });
            S.safeSetText(tdName, cost.name);
            if (cost.isDetected) {
                var detected = S.createElement('span', { 'class': 'cost-detected-badge' }, 'DETECTED');
                tdName.appendChild(document.createTextNode(' '));
                tdName.appendChild(detected);
            }

            var tdProvider = S.createElement('td', {}, cost.provider);
            var tdInput = S.createElement('td', { 'class': 'cost-cell-money' }, '$' + formatCost(cost.inputCost));
            var tdOutput = S.createElement('td', { 'class': 'cost-cell-money' }, '$' + formatCost(cost.outputCost));
            var tdTotal = S.createElement('td', { 'class': 'cost-cell-money cost-cell-total' }, '$' + formatCost(cost.totalCost));

            row.appendChild(tdName);
            row.appendChild(tdProvider);
            row.appendChild(tdInput);
            row.appendChild(tdOutput);
            row.appendChild(tdTotal);

            tbody.appendChild(row);
        }

        table.appendChild(tbody);
        tableWrap.appendChild(table);
        _container.appendChild(tableWrap);

        // Cheapest & most expensive callout
        if (result.costs.length >= 2) {
            var callout = S.createElement('div', { 'class': 'cost-callout' });
            var cheapest = result.costs[0];
            var mostExpensive = result.costs[result.costs.length - 1];

            var cheapEl = S.createElement('div', { 'class': 'cost-callout-item cost-callout-cheap' });
            var cheapLabel = S.createElement('div', { 'class': 'cost-callout-label' }, '\u2705 Cheapest');
            var cheapVal = S.createElement('div', { 'class': 'cost-callout-value' }, cheapest.name + ' \u2014 $' + formatCost(cheapest.totalCost));
            cheapEl.appendChild(cheapLabel);
            cheapEl.appendChild(cheapVal);

            var expEl = S.createElement('div', { 'class': 'cost-callout-item cost-callout-expensive' });
            var expLabel = S.createElement('div', { 'class': 'cost-callout-label' }, '\u26A0 Most Expensive');
            var expVal = S.createElement('div', { 'class': 'cost-callout-value' }, mostExpensive.name + ' \u2014 $' + formatCost(mostExpensive.totalCost));
            expEl.appendChild(expLabel);
            expEl.appendChild(expVal);

            callout.appendChild(cheapEl);
            callout.appendChild(expEl);
            _container.appendChild(callout);
        }
    }

    /* ---- Helpers ---- */

    function formatCost(cost) {
        if (cost < 0.001) { return cost.toFixed(6); }
        if (cost < 0.01) { return cost.toFixed(5); }
        if (cost < 1) { return cost.toFixed(4); }
        return cost.toFixed(2);
    }

    /* ---- Public API ---- */

    return {
        init: init,
        render: render,
        computeCosts: computeCosts,
        estimateTokens: estimateTokens
    };

})();
