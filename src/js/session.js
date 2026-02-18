/**
 * Clawtrace — Gateway Session Inspector
 * ============================================================
 * Parses OpenClaw session metadata from traces:
 *   - Session IDs, model selection, thinking level
 *   - Verbose mode, sendPolicy, groupActivation
 *   - Context window usage analysis (session pruning advisor)
 *   - Token accumulation curves
 *   - Compact recommendations
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Session = (function () {

    var S = Clawtrace.Sanitizer;
    var _container = null;

    /* ---- OpenClaw Session Patterns ---- */
    var SESSION_PATTERNS = {
        sessionId: /session[_\-]?id\s*[:=]\s*["']?([a-zA-Z0-9_\-]+)/i,
        model: /model\s*[:=]\s*["']?([a-zA-Z0-9/._\-]+)/i,
        thinkingLevel: /think(?:ing)?[_\-]?level\s*[:=]\s*["']?(off|minimal|low|medium|high|xhigh)/i,
        verbose: /verbose\s*[:=]\s*["']?(on|off|true|false)/i,
        sendPolicy: /send[_\-]?policy\s*[:=]\s*["']?([a-zA-Z_]+)/i,
        groupActivation: /(?:group[_\-]?)?activation\s*[:=]\s*["']?(mention|always)/i,
        elevated: /elevated\s*[:=]\s*["']?(on|off|true|false)/i,
        sessionType: /session[_\-]?type\s*[:=]\s*["']?(main|group|channel)/i,
        workspace: /workspace\s*[:=]\s*["']?([^\s"']+)/i,
        agentName: /agent[_\-]?(?:name|id)\s*[:=]\s*["']?([^\s"']+)/i
    };

    var MODEL_CONTEXT_WINDOWS = {
        'claude-opus-4-6': 200000,
        'claude-sonnet-4': 200000,
        'claude-3.5-sonnet': 200000,
        'claude-3-opus': 200000,
        'gpt-4o': 128000,
        'gpt-4-turbo': 128000,
        'gpt-4': 8192,
        'gpt-3.5-turbo': 16385,
        'gpt-5.2': 200000,
        'o1': 200000,
        'o1-mini': 128000,
        'gemini-pro': 1000000,
        'gemini-1.5-pro': 2000000,
        'default': 128000
    };

    /* ---- Public API ---- */

    function init(container) {
        _container = container;
    }

    function render(traceData, analysisResult) {
        if (!_container || !traceData) { return; }

        while (_container.firstChild) {
            _container.removeChild(_container.firstChild);
        }

        var session = extractSessionInfo(traceData);
        var pruning = analyzePruning(traceData, session, analysisResult);

        renderSessionOverview(session);
        renderContextUsage(pruning, session);
        renderTokenCurve(traceData, session);
        renderRecommendations(pruning, session);
    }

    /* ---- Extraction ---- */

    function extractSessionInfo(traceData) {
        var info = {
            sessionId: null,
            model: null,
            thinkingLevel: null,
            verbose: null,
            sendPolicy: null,
            groupActivation: null,
            elevated: null,
            sessionType: null,
            workspace: null,
            agentName: null,
            channels: [],
            toolsUsed: [],
            totalTokens: 0,
            stepCount: traceData.steps.length
        };

        var allText = '';
        var channelSet = {};
        var toolSet = {};

        for (var i = 0; i < traceData.steps.length; i++) {
            var step = traceData.steps[i];
            var content = step.content || '';
            var raw = step.raw || '';
            var meta = step.metadata || {};
            allText += content + ' ' + raw + ' ';

            // Extract from metadata
            if (meta.model) { info.model = meta.model; }
            if (meta.session_id) { info.sessionId = meta.session_id; }
            if (meta.sessionId) { info.sessionId = meta.sessionId; }
            if (meta.channel) { channelSet[meta.channel] = true; }
            if (meta.thinking_level) { info.thinkingLevel = meta.thinking_level; }
            if (meta.agent) { info.agentName = meta.agent; }

            // Detect channels from content
            var channelPatterns = ['whatsapp', 'telegram', 'slack', 'discord', 'signal', 'imessage', 'bluebubbles', 'teams', 'matrix', 'webchat', 'googlechat', 'zalo'];
            for (var c = 0; c < channelPatterns.length; c++) {
                if (content.toLowerCase().indexOf(channelPatterns[c]) > -1 ||
                    raw.toLowerCase().indexOf(channelPatterns[c]) > -1) {
                    channelSet[channelPatterns[c]] = true;
                }
            }

            // Collect tools
            if (step.type === 'tool_call') {
                var toolName = extractToolName(content);
                if (toolName) { toolSet[toolName] = (toolSet[toolName] || 0) + 1; }
            }

            // Estimate tokens
            info.totalTokens += Math.ceil((content.length || 0) / 4);
        }

        // Extract patterns from full text
        for (var key in SESSION_PATTERNS) {
            if (SESSION_PATTERNS.hasOwnProperty(key) && !info[key]) {
                var match = allText.match(SESSION_PATTERNS[key]);
                if (match) { info[key] = match[1]; }
            }
        }

        info.channels = Object.keys(channelSet);
        info.toolsUsed = [];
        for (var t in toolSet) {
            if (toolSet.hasOwnProperty(t)) {
                info.toolsUsed.push({ name: t, count: toolSet[t] });
            }
        }
        info.toolsUsed.sort(function (a, b) { return b.count - a.count; });

        return info;
    }

    function extractToolName(content) {
        var match = content.match(/^(\w[\w.]*)\s*\(/);
        if (match) { return match[1]; }
        match = content.match(/^(?:tool|function|call):\s*(\w[\w.]*)/i);
        if (match) { return match[1]; }
        match = content.match(/^(\w[\w.]*)/);
        if (match && match[1].length < 50) { return match[1]; }
        return null;
    }

    /* ---- Pruning Analysis ---- */

    function analyzePruning(traceData, session, analysisResult) {
        var model = (session.model || 'default').toLowerCase();
        var contextWindow = MODEL_CONTEXT_WINDOWS['default'];
        for (var m in MODEL_CONTEXT_WINDOWS) {
            if (MODEL_CONTEXT_WINDOWS.hasOwnProperty(m) && model.indexOf(m) > -1) {
                contextWindow = MODEL_CONTEXT_WINDOWS[m];
                break;
            }
        }

        var tokenAccum = [];
        var runningTotal = 0;
        for (var i = 0; i < traceData.steps.length; i++) {
            var tokens = Math.ceil((traceData.steps[i].content || '').length / 4);
            runningTotal += tokens;
            tokenAccum.push(runningTotal);
        }

        var utilization = contextWindow > 0 ? (runningTotal / contextWindow) * 100 : 0;
        var compactThreshold = 0.7;
        var shouldCompact = utilization > compactThreshold * 100;
        var recommendations = [];

        if (shouldCompact) {
            recommendations.push({
                type: 'compact',
                text: 'Context window is ' + Math.round(utilization) + '% utilized. Send /compact to summarize and free context.',
                severity: utilization > 90 ? 'critical' : 'warning'
            });
        }

        if (session.thinkingLevel === 'high' || session.thinkingLevel === 'xhigh') {
            recommendations.push({
                type: 'thinking',
                text: 'Thinking level is "' + session.thinkingLevel + '". This uses more tokens. Consider "medium" for routine tasks.',
                severity: 'info'
            });
        }

        var longSteps = 0;
        for (var j = 0; j < traceData.steps.length; j++) {
            if ((traceData.steps[j].content || '').length > 4000) { longSteps++; }
        }
        if (longSteps > 3) {
            recommendations.push({
                type: 'verbose',
                text: longSteps + ' steps exceed 4000 characters. Consider /verbose off for shorter responses.',
                severity: 'info'
            });
        }

        var errorRate = analysisResult ? (analysisResult.stats.byType.error || 0) / Math.max(traceData.steps.length, 1) : 0;
        if (errorRate > 0.1) {
            recommendations.push({
                type: 'errors',
                text: 'Error rate is ' + Math.round(errorRate * 100) + '%. Check tool configurations and permissions.',
                severity: 'warning'
            });
        }

        return {
            contextWindow: contextWindow,
            totalTokens: runningTotal,
            utilization: utilization,
            tokenAccum: tokenAccum,
            shouldCompact: shouldCompact,
            recommendations: recommendations
        };
    }

    /* ---- Rendering ---- */

    function renderSessionOverview(session) {
        var section = S.createElement('div', { 'class': 'session-overview' });

        var title = S.createElement('h3', { 'class': 'session-section-title' }, 'Session Properties');
        section.appendChild(title);

        var grid = S.createElement('div', { 'class': 'session-grid' });

        var props = [
            { label: 'Session ID', value: session.sessionId || 'Not detected' },
            { label: 'Model', value: session.model || 'Not detected' },
            { label: 'Agent', value: session.agentName || 'Default' },
            { label: 'Session Type', value: session.sessionType || 'main' },
            { label: 'Thinking Level', value: session.thinkingLevel || 'Not set' },
            { label: 'Verbose', value: session.verbose || 'Default' },
            { label: 'Send Policy', value: session.sendPolicy || 'Default' },
            { label: 'Group Activation', value: session.groupActivation || 'Default' },
            { label: 'Elevated', value: session.elevated || 'off' },
            { label: 'Workspace', value: session.workspace || '~/.openclaw/workspace' },
            { label: 'Steps', value: String(session.stepCount) },
            { label: 'Est. Tokens', value: session.totalTokens.toLocaleString() }
        ];

        for (var i = 0; i < props.length; i++) {
            var card = S.createElement('div', { 'class': 'session-prop-card' });
            var lbl = S.createElement('div', { 'class': 'session-prop-label' }, props[i].label);
            var val = S.createElement('div', { 'class': 'session-prop-value' }, props[i].value);
            card.appendChild(lbl);
            card.appendChild(val);
            grid.appendChild(card);
        }
        section.appendChild(grid);

        // Channels detected
        if (session.channels.length > 0) {
            var chSection = S.createElement('div', { 'class': 'session-channels' });
            var chTitle = S.createElement('h4', { 'class': 'session-sub-title' }, 'Channels Detected');
            chSection.appendChild(chTitle);
            var chList = S.createElement('div', { 'class': 'session-tag-list' });
            for (var c = 0; c < session.channels.length; c++) {
                var tag = S.createElement('span', { 'class': 'session-tag channel-tag' }, session.channels[c]);
                chList.appendChild(tag);
            }
            chSection.appendChild(chList);
            section.appendChild(chSection);
        }

        // Top tools
        if (session.toolsUsed.length > 0) {
            var tSection = S.createElement('div', { 'class': 'session-tools-summary' });
            var tTitle = S.createElement('h4', { 'class': 'session-sub-title' }, 'Tools Used (' + session.toolsUsed.length + ')');
            tSection.appendChild(tTitle);
            var tList = S.createElement('div', { 'class': 'session-tag-list' });
            var limit = Math.min(session.toolsUsed.length, 15);
            for (var t = 0; t < limit; t++) {
                var tTag = S.createElement('span', { 'class': 'session-tag tool-tag' },
                    session.toolsUsed[t].name + ' (' + session.toolsUsed[t].count + ')');
                tList.appendChild(tTag);
            }
            tSection.appendChild(tList);
            section.appendChild(tSection);
        }

        _container.appendChild(section);
    }

    function renderContextUsage(pruning, session) {
        var section = S.createElement('div', { 'class': 'session-context' });
        var title = S.createElement('h3', { 'class': 'session-section-title' }, 'Context Window Usage');
        section.appendChild(title);

        var barWrap = S.createElement('div', { 'class': 'context-bar-wrap' });
        var barTrack = S.createElement('div', { 'class': 'context-bar-track' });
        var barFill = S.createElement('div', { 'class': 'context-bar-fill' });

        var pct = Math.min(pruning.utilization, 100);
        barFill.style.width = pct + '%';
        if (pct > 90) { barFill.className += ' context-critical'; }
        else if (pct > 70) { barFill.className += ' context-warning'; }

        barTrack.appendChild(barFill);
        barWrap.appendChild(barTrack);

        var barLabel = S.createElement('div', { 'class': 'context-bar-label' },
            pruning.totalTokens.toLocaleString() + ' / ' +
            pruning.contextWindow.toLocaleString() + ' tokens (' +
            Math.round(pct) + '%)');
        barWrap.appendChild(barLabel);
        section.appendChild(barWrap);

        var modelNote = S.createElement('div', { 'class': 'context-model-note' },
            'Model: ' + (session.model || 'unknown') +
            ' | Context window: ' + pruning.contextWindow.toLocaleString() + ' tokens');
        section.appendChild(modelNote);

        _container.appendChild(section);
    }

    function renderTokenCurve(traceData, session) {
        var section = S.createElement('div', { 'class': 'session-token-curve' });
        var title = S.createElement('h3', { 'class': 'session-section-title' }, 'Token Accumulation');
        section.appendChild(title);

        var SVG_NS = 'http://www.w3.org/2000/svg';
        var width = 700;
        var height = 200;
        var padding = 40;

        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svg.setAttribute('class', 'token-curve-svg');

        // Background
        var bg = document.createElementNS(SVG_NS, 'rect');
        bg.setAttribute('width', String(width));
        bg.setAttribute('height', String(height));
        bg.setAttribute('fill', 'rgba(17,24,39,0.5)');
        bg.setAttribute('rx', '8');
        svg.appendChild(bg);

        if (traceData.steps.length > 1) {
            var tokens = [];
            var running = 0;
            for (var i = 0; i < traceData.steps.length; i++) {
                running += Math.ceil((traceData.steps[i].content || '').length / 4);
                tokens.push(running);
            }

            var maxTokens = tokens[tokens.length - 1] || 1;
            var plotW = width - padding * 2;
            var plotH = height - padding * 2;

            var points = [];
            for (var j = 0; j < tokens.length; j++) {
                var x = padding + (j / (tokens.length - 1)) * plotW;
                var y = padding + plotH - (tokens[j] / maxTokens) * plotH;
                points.push(Math.round(x) + ',' + Math.round(y));
            }

            // Area fill
            var areaPath = document.createElementNS(SVG_NS, 'polygon');
            var areaPoints = (padding + ',' + (padding + plotH)) + ' ' +
                             points.join(' ') + ' ' +
                             (padding + plotW) + ',' + (padding + plotH);
            areaPath.setAttribute('points', areaPoints);
            areaPath.setAttribute('fill', 'rgba(255,69,0,0.15)');
            svg.appendChild(areaPath);

            // Line
            var line = document.createElementNS(SVG_NS, 'polyline');
            line.setAttribute('points', points.join(' '));
            line.setAttribute('fill', 'none');
            line.setAttribute('stroke', '#FF4500');
            line.setAttribute('stroke-width', '2');
            svg.appendChild(line);

            // Axis labels
            var xLabel = document.createElementNS(SVG_NS, 'text');
            xLabel.setAttribute('x', String(width / 2));
            xLabel.setAttribute('y', String(height - 5));
            xLabel.setAttribute('text-anchor', 'middle');
            xLabel.setAttribute('fill', '#8B949E');
            xLabel.setAttribute('font-size', '11');
            xLabel.textContent = 'Steps (1-' + tokens.length + ')';
            svg.appendChild(xLabel);

            var yLabel = document.createElementNS(SVG_NS, 'text');
            yLabel.setAttribute('x', String(padding - 5));
            yLabel.setAttribute('y', String(padding));
            yLabel.setAttribute('text-anchor', 'end');
            yLabel.setAttribute('fill', '#8B949E');
            yLabel.setAttribute('font-size', '10');
            yLabel.textContent = maxTokens.toLocaleString();
            svg.appendChild(yLabel);
        }

        section.appendChild(svg);
        _container.appendChild(section);
    }

    function renderRecommendations(pruning, session) {
        var section = S.createElement('div', { 'class': 'session-recommendations' });
        var title = S.createElement('h3', { 'class': 'session-section-title' }, 'Session Optimization');
        section.appendChild(title);

        if (pruning.recommendations.length === 0) {
            var good = S.createElement('div', { 'class': 'session-rec-good' },
                'Session looks healthy. No optimization needed.');
            section.appendChild(good);
        } else {
            for (var i = 0; i < pruning.recommendations.length; i++) {
                var rec = pruning.recommendations[i];
                var card = S.createElement('div', {
                    'class': 'session-rec-card rec-' + rec.severity
                });
                var icon = S.createElement('span', { 'class': 'session-rec-icon' },
                    rec.severity === 'critical' ? '\u26D4' :
                    rec.severity === 'warning' ? '\u26A0' : '\u2139');
                var text = S.createElement('span', { 'class': 'session-rec-text' }, rec.text);
                card.appendChild(icon);
                card.appendChild(text);
                section.appendChild(card);
            }
        }

        _container.appendChild(section);
    }

    /* ---- Public ---- */
    return {
        init: init,
        render: render
    };
})();
