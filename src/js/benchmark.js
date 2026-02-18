/**
 * Clawtrace — Performance Benchmark Mode
 * ============================================================
 * Compare traces with different configurations to benchmark
 * model performance. Response times, token usage, quality.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Benchmark = (function () {

    var S = Clawtrace.Sanitizer;
    var P = Clawtrace.Parser;
    var _container = null;

    function init(container) { _container = container; }

    function render(traceData, analysisResult) {
        if (!_container || !traceData) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        var metrics = computeMetrics(traceData, analysisResult);
        renderMetrics(metrics);
        renderBenchmarkInput();
        renderOptimizationTips(metrics);
    }

    function computeMetrics(traceData, analysisResult) {
        var steps = traceData.steps;
        var totalTokens = 0;
        var stepLengths = [];
        var toolCalls = 0;
        var reasoningSteps = 0;
        var errors = 0;
        var maxLength = 0;

        for (var i = 0; i < steps.length; i++) {
            var len = (steps[i].content || '').length;
            var tokens = Math.ceil(len / 4);
            totalTokens += tokens;
            stepLengths.push(tokens);
            if (len > maxLength) { maxLength = len; }

            if (steps[i].type === 'tool_call') { toolCalls++; }
            if (steps[i].type === 'reasoning') { reasoningSteps++; }
            if (steps[i].type === 'error') { errors++; }
        }

        var avgTokens = steps.length > 0 ? Math.round(totalTokens / steps.length) : 0;
        var toolRatio = steps.length > 0 ? (toolCalls / steps.length * 100).toFixed(1) : '0';
        var errorRate = steps.length > 0 ? (errors / steps.length * 100).toFixed(1) : '0';
        var reasoningRatio = steps.length > 0 ? (reasoningSteps / steps.length * 100).toFixed(1) : '0';

        // Efficiency score: lower tokens + fewer errors = better
        var efficiency = 100;
        efficiency -= Math.min(errors * 10, 40);
        efficiency -= Math.min(Math.max(totalTokens / 5000 - 1, 0) * 5, 30);
        if (toolCalls > steps.length * 0.6) { efficiency -= 10; }
        efficiency = Math.max(0, Math.min(100, Math.round(efficiency)));

        return {
            totalSteps: steps.length,
            totalTokens: totalTokens,
            avgTokensPerStep: avgTokens,
            maxStepLength: maxLength,
            toolCalls: toolCalls,
            toolRatio: toolRatio,
            reasoningSteps: reasoningSteps,
            reasoningRatio: reasoningRatio,
            errors: errors,
            errorRate: errorRate,
            efficiency: efficiency,
            riskScore: analysisResult ? analysisResult.riskScore : 0,
            confidenceScore: analysisResult ? analysisResult.confidenceScore : 0
        };
    }

    function renderMetrics(metrics) {
        var section = S.createElement('div', { 'class': 'bm-metrics' });
        var title = S.createElement('h3', { 'class': 'bm-section-title' }, 'Performance Metrics');
        section.appendChild(title);

        // Efficiency gauge
        var gauge = S.createElement('div', { 'class': 'bm-gauge-wrap' });
        var gaugeLabel = S.createElement('div', { 'class': 'bm-gauge-label' }, 'Efficiency Score');
        var gaugeBar = S.createElement('div', { 'class': 'bm-gauge-track' });
        var gaugeFill = S.createElement('div', { 'class': 'bm-gauge-fill' });
        gaugeFill.style.width = metrics.efficiency + '%';
        if (metrics.efficiency > 70) { gaugeFill.className += ' bm-gauge-good'; }
        else if (metrics.efficiency > 40) { gaugeFill.className += ' bm-gauge-ok'; }
        else { gaugeFill.className += ' bm-gauge-bad'; }
        gaugeBar.appendChild(gaugeFill);
        gauge.appendChild(gaugeLabel);
        gauge.appendChild(gaugeBar);
        gauge.appendChild(S.createElement('div', { 'class': 'bm-gauge-value' }, metrics.efficiency + ' / 100'));
        section.appendChild(gauge);

        var grid = S.createElement('div', { 'class': 'bm-stat-grid' });
        var stats = [
            { label: 'Total Steps', value: String(metrics.totalSteps) },
            { label: 'Total Tokens', value: metrics.totalTokens.toLocaleString() },
            { label: 'Avg Tokens/Step', value: String(metrics.avgTokensPerStep) },
            { label: 'Max Step Size', value: (metrics.maxStepLength / 1000).toFixed(1) + 'K chars' },
            { label: 'Tool Calls', value: metrics.toolCalls + ' (' + metrics.toolRatio + '%)' },
            { label: 'Reasoning Steps', value: metrics.reasoningSteps + ' (' + metrics.reasoningRatio + '%)' },
            { label: 'Errors', value: metrics.errors + ' (' + metrics.errorRate + '%)' },
            { label: 'Risk Score', value: String(metrics.riskScore) },
            { label: 'Confidence', value: String(metrics.confidenceScore) }
        ];

        for (var i = 0; i < stats.length; i++) {
            var card = S.createElement('div', { 'class': 'bm-stat-card' });
            card.appendChild(S.createElement('div', { 'class': 'bm-stat-value' }, stats[i].value));
            card.appendChild(S.createElement('div', { 'class': 'bm-stat-label' }, stats[i].label));
            grid.appendChild(card);
        }
        section.appendChild(grid);
        _container.appendChild(section);
    }

    function renderBenchmarkInput() {
        var section = S.createElement('div', { 'class': 'bm-compare' });
        var title = S.createElement('h3', { 'class': 'bm-section-title' }, 'Compare Traces');
        section.appendChild(title);

        section.appendChild(S.createElement('p', { 'class': 'bm-compare-desc' },
            'To benchmark across model configurations, load different traces from the same prompt using different OpenClaw settings ' +
            '(e.g., different models, thinking levels, or verbose modes) and compare them using the Compare view. ' +
            'The metrics above serve as the baseline for this trace.'));

        _container.appendChild(section);
    }

    function renderOptimizationTips(metrics) {
        var section = S.createElement('div', { 'class': 'bm-tips' });
        var title = S.createElement('h3', { 'class': 'bm-section-title' }, 'Optimization Tips');
        section.appendChild(title);

        var tips = [];

        if (parseFloat(metrics.errorRate) > 10) {
            tips.push('High error rate (' + metrics.errorRate + '%). Check tool permissions and configuration.');
        }
        if (metrics.totalTokens > 50000) {
            tips.push('High token usage (' + metrics.totalTokens.toLocaleString() + '). Consider using /compact more frequently or reducing verbose output.');
        }
        if (parseFloat(metrics.toolRatio) > 50) {
            tips.push('Tool-heavy trace (' + metrics.toolRatio + '% tool calls). The agent may be over-relying on tools. Consider skills that combine multiple operations.');
        }
        if (metrics.maxStepLength > 20000) {
            tips.push('Very long response detected (' + (metrics.maxStepLength / 1000).toFixed(0) + 'K chars). This could cause chunking issues on Discord (2K limit) and Telegram (4K limit).');
        }
        if (metrics.efficiency > 80) {
            tips.push('Excellent efficiency score! This trace is well-optimized.');
        }
        if (tips.length === 0) {
            tips.push('No major optimization issues found. Trace performance looks good.');
        }

        for (var i = 0; i < tips.length; i++) {
            var tip = S.createElement('div', { 'class': 'bm-tip' });
            tip.appendChild(S.createElement('span', { 'class': 'bm-tip-icon' }, '\u2192'));
            tip.appendChild(S.createElement('span', {}, tips[i]));
            section.appendChild(tip);
        }

        _container.appendChild(section);
    }

    return { init: init, render: render };
})();
