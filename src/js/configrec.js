/**
 * Clawtrace — Config Recommendation Engine
 * ============================================================
 * Analyzes trace patterns and generates openclaw.json
 * configuration suggestions for optimization.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.ConfigRec = (function () {

    var S = Clawtrace.Sanitizer;
    var _container = null;

    function init(container) { _container = container; }

    function render(traceData, analysisResult) {
        if (!_container || !traceData) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        var recs = generateRecommendations(traceData, analysisResult);
        renderOverview(recs);
        renderConfigSuggestions(recs);
        renderGeneratedConfig(recs);
    }

    function generateRecommendations(traceData, analysisResult) {
        var steps = traceData.steps;
        var recs = [];
        var config = {};

        // Analyze token usage
        var totalTokens = 0;
        var toolCalls = 0;
        var errors = 0;
        var reasoningSteps = 0;
        var longestResponse = 0;
        var detectedModel = null;
        var hasMultiAgent = false;
        var hasBrowser = false;
        var hasCron = false;
        var hasCanvas = false;

        for (var i = 0; i < steps.length; i++) {
            var content = (steps[i].content || '');
            var lower = content.toLowerCase();
            totalTokens += Math.ceil(content.length / 4);

            if (steps[i].type === 'tool_call') { toolCalls++; }
            if (steps[i].type === 'error') { errors++; }
            if (steps[i].type === 'reasoning') { reasoningSteps++; }
            if (steps[i].type === 'assistant' && content.length > longestResponse) {
                longestResponse = content.length;
            }

            // Detect features
            if (/sessions?_send|sessions?_list/i.test(lower)) { hasMultiAgent = true; }
            if (/browser/i.test(lower)) { hasBrowser = true; }
            if (/cron\./i.test(lower)) { hasCron = true; }
            if (/canvas\./i.test(lower)) { hasCanvas = true; }

            // Detect model
            var meta = steps[i].metadata || {};
            if (meta.model) { detectedModel = meta.model; }
        }

        // Model recommendation
        if (!detectedModel) {
            recs.push({
                category: 'Model',
                title: 'Use Claude Opus 4.6 for complex tasks',
                detail: 'OpenClaw recommends Anthropic Pro/Max (100/200) + Opus 4.6 for long-context strength and better prompt-injection resistance.',
                config: { 'agent.model': 'anthropic/claude-opus-4-6' }
            });
            config['agent'] = { model: 'anthropic/claude-opus-4-6' };
        }

        // Token management
        if (totalTokens > 30000) {
            recs.push({
                category: 'Context',
                title: 'Enable session pruning',
                detail: 'Trace uses ' + totalTokens.toLocaleString() + ' tokens. Consider configuring session pruning to manage context window.',
                config: { 'agent.sessionPruning': 'auto' }
            });
        }

        // Error handling
        if (errors > 0) {
            var errorRate = (errors / steps.length * 100).toFixed(0);
            recs.push({
                category: 'Reliability',
                title: 'Configure model failover',
                detail: 'Error rate: ' + errorRate + '%. Set up failover models for automatic retries.',
                config: { 'agent.modelFallback': ['anthropic/claude-sonnet-4', 'openai/gpt-4o'] }
            });
        }

        // Security
        if (hasMultiAgent) {
            recs.push({
                category: 'Security',
                title: 'Enable sandbox for non-main sessions',
                detail: 'Multi-agent routing detected. Sandbox non-main sessions to isolate untrusted input.',
                config: { 'agents.defaults.sandbox.mode': 'non-main' }
            });
        }

        // Browser
        if (hasBrowser) {
            recs.push({
                category: 'Browser',
                title: 'Configure browser settings',
                detail: 'Browser tool detected. Ensure a dedicated Chromium profile is configured.',
                config: { 'browser.enabled': true }
            });
        }

        // Verbose
        if (longestResponse > 8000) {
            recs.push({
                category: 'Performance',
                title: 'Consider reducing verbosity',
                detail: 'Longest response: ' + (longestResponse / 1000).toFixed(1) + 'K chars. Verbose output increases token cost and may cause channel chunking.',
                config: {}
            });
        }

        // Thinking
        if (reasoningSteps > steps.length * 0.3) {
            recs.push({
                category: 'Thinking',
                title: 'Optimize thinking level',
                detail: reasoningSteps + ' reasoning steps (' + Math.round(reasoningSteps / steps.length * 100) + '%). Consider lower thinking for routine tasks.',
                config: {}
            });
        }

        return {
            recommendations: recs,
            config: config,
            detectedModel: detectedModel,
            totalTokens: totalTokens,
            toolCalls: toolCalls,
            errors: errors
        };
    }

    function renderOverview(recs) {
        var section = S.createElement('div', { 'class': 'cf-overview' });
        var title = S.createElement('h3', { 'class': 'cf-section-title' }, 'Configuration Recommendations');
        section.appendChild(title);

        var grid = S.createElement('div', { 'class': 'cf-stat-grid' });
        var stats = [
            { label: 'Suggestions', value: String(recs.recommendations.length) },
            { label: 'Detected Model', value: recs.detectedModel || 'Not detected' },
            { label: 'Total Tokens', value: recs.totalTokens.toLocaleString() },
            { label: 'Error Count', value: String(recs.errors) }
        ];

        for (var i = 0; i < stats.length; i++) {
            var card = S.createElement('div', { 'class': 'cf-stat-card' });
            card.appendChild(S.createElement('div', { 'class': 'cf-stat-value' }, stats[i].value));
            card.appendChild(S.createElement('div', { 'class': 'cf-stat-label' }, stats[i].label));
            grid.appendChild(card);
        }
        section.appendChild(grid);
        _container.appendChild(section);
    }

    function renderConfigSuggestions(recs) {
        if (recs.recommendations.length === 0) {
            var section = S.createElement('div', { 'class': 'cf-suggestions' });
            section.appendChild(S.createElement('div', { 'class': 'cf-good' },
                'No configuration improvements detected. Your OpenClaw setup appears well-configured for this trace.'));
            _container.appendChild(section);
            return;
        }

        var section = S.createElement('div', { 'class': 'cf-suggestions' });
        var title = S.createElement('h3', { 'class': 'cf-section-title' }, 'Suggestions');
        section.appendChild(title);

        for (var i = 0; i < recs.recommendations.length; i++) {
            var rec = recs.recommendations[i];
            var card = S.createElement('div', { 'class': 'cf-rec-card' });
            var header = S.createElement('div', { 'class': 'cf-rec-header' });
            header.appendChild(S.createElement('span', { 'class': 'cf-rec-category' }, rec.category));
            header.appendChild(S.createElement('span', { 'class': 'cf-rec-title' }, rec.title));
            card.appendChild(header);
            card.appendChild(S.createElement('div', { 'class': 'cf-rec-detail' }, rec.detail));
            section.appendChild(card);
        }

        _container.appendChild(section);
    }

    function renderGeneratedConfig(recs) {
        var section = S.createElement('div', { 'class': 'cf-generated' });
        var title = S.createElement('h3', { 'class': 'cf-section-title' }, 'Suggested openclaw.json');
        section.appendChild(title);

        section.appendChild(S.createElement('p', { 'class': 'cf-config-desc' },
            'Based on the trace analysis, here is a suggested configuration. Copy relevant sections to your ~/.openclaw/openclaw.json file.'));

        var configObj = {};
        for (var i = 0; i < recs.recommendations.length; i++) {
            var recConfig = recs.recommendations[i].config;
            for (var key in recConfig) {
                if (recConfig.hasOwnProperty(key)) {
                    configObj[key] = recConfig[key];
                }
            }
        }

        var configText = JSON.stringify(configObj, null, 2);
        var codeBlock = S.createElement('pre', { 'class': 'cf-code-block' });
        var code = S.createElement('code', {}, configText);
        codeBlock.appendChild(code);
        section.appendChild(codeBlock);

        _container.appendChild(section);
    }

    return { init: init, render: render };
})();
