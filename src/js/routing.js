/**
 * Clawtrace — Channel Routing Visualizer
 * ============================================================
 * Interactive flow diagram showing OpenClaw's messaging path:
 *   Channel → Gateway → Agent Routing → Tools → Response → Delivery
 *   - dmPolicy, allowFrom, group rules
 *   - Mention gating, activation modes
 *   - Multi-agent routing paths
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Routing = (function () {

    var S = Clawtrace.Sanitizer;
    var _container = null;

    function init(container) { _container = container; }

    function render(traceData) {
        if (!_container || !traceData) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        var routing = analyzeRouting(traceData);
        renderRoutingDiagram(routing);
        renderRoutingDetails(routing);
        renderSecurityOverview(routing);
    }

    function analyzeRouting(traceData) {
        var channels = {};
        var tools = {};
        var agents = { 'main': true };
        var policies = {};
        var steps = traceData.steps;

        var allText = '';
        for (var i = 0; i < steps.length; i++) {
            var content = (steps[i].content || '') + ' ' + (steps[i].raw || '');
            var meta = steps[i].metadata || {};
            allText += content + ' ';

            if (meta.channel) { channels[meta.channel] = true; }
            if (meta.agent) { agents[meta.agent] = true; }

            if (steps[i].type === 'tool_call') {
                var toolName = extractToolName(content);
                tools[toolName] = (tools[toolName] || 0) + 1;
            }

            // Detect policies
            var dmMatch = content.match(/dm[_\-]?policy\s*[:=]\s*["']?(\w+)/i);
            if (dmMatch) { policies.dmPolicy = dmMatch[1]; }
            var actMatch = content.match(/activation\s*[:=]\s*["']?(mention|always)/i);
            if (actMatch) { policies.activation = actMatch[1]; }
            var allowMatch = content.match(/allow[_\-]?from\s*[:=]\s*["']?([^\s"']+)/i);
            if (allowMatch) { policies.allowFrom = allowMatch[1]; }
        }

        // Detect channels from mentions
        var channelNames = ['whatsapp', 'telegram', 'slack', 'discord', 'signal', 'imessage', 'bluebubbles', 'teams', 'msteams', 'googlechat', 'matrix', 'webchat', 'zalo'];
        for (var c = 0; c < channelNames.length; c++) {
            if (allText.toLowerCase().indexOf(channelNames[c]) > -1) {
                channels[channelNames[c]] = true;
            }
        }

        return {
            channels: Object.keys(channels),
            tools: tools,
            agents: Object.keys(agents),
            policies: policies,
            stepCount: steps.length,
            userMessages: steps.filter(function (s) { return s.type === 'user'; }).length,
            assistantMessages: steps.filter(function (s) { return s.type === 'assistant'; }).length,
            toolCalls: steps.filter(function (s) { return s.type === 'tool_call'; }).length
        };
    }

    function extractToolName(content) {
        var match = content.match(/^(\w[\w.]*)/);
        return match ? match[1] : 'unknown';
    }

    function renderRoutingDiagram(routing) {
        var section = S.createElement('div', { 'class': 'rt-diagram' });
        var title = S.createElement('h3', { 'class': 'rt-section-title' }, 'Message Routing Flow');
        section.appendChild(title);

        var SVG_NS = 'http://www.w3.org/2000/svg';
        var width = 750;
        var height = 400;

        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svg.setAttribute('class', 'rt-svg');

        // Background
        var bg = document.createElementNS(SVG_NS, 'rect');
        bg.setAttribute('width', String(width));
        bg.setAttribute('height', String(height));
        bg.setAttribute('fill', 'rgba(13,17,23,0.5)');
        bg.setAttribute('rx', '10');
        svg.appendChild(bg);

        // Layer layout: Channels (left) → Gateway (center-left) → Agent (center) → Tools (center-right) → Response (right)
        var layers = [
            { x: 60, label: 'Channels', items: routing.channels.length > 0 ? routing.channels : ['(none detected)'], color: '#3b82f6' },
            { x: 230, label: 'Gateway', items: ['ws://127.0.0.1:18789'], color: '#FF4500' },
            { x: 400, label: 'Agent', items: routing.agents, color: '#22c55e' },
            { x: 570, label: 'Tools', items: getTopTools(routing.tools, 5), color: '#f59e0b' }
        ];

        // Draw layer labels
        for (var l = 0; l < layers.length; l++) {
            var layer = layers[l];
            var labelEl = document.createElementNS(SVG_NS, 'text');
            labelEl.setAttribute('x', String(layer.x));
            labelEl.setAttribute('y', '25');
            labelEl.setAttribute('text-anchor', 'middle');
            labelEl.setAttribute('fill', layer.color);
            labelEl.setAttribute('font-size', '13');
            labelEl.setAttribute('font-weight', 'bold');
            labelEl.textContent = layer.label;
            svg.appendChild(labelEl);

            // Draw items
            var startY = 55;
            var itemH = 30;
            var maxItems = Math.min(layer.items.length, 8);
            for (var it = 0; it < maxItems; it++) {
                var itemY = startY + it * (itemH + 6);

                var rect = document.createElementNS(SVG_NS, 'rect');
                rect.setAttribute('x', String(layer.x - 55));
                rect.setAttribute('y', String(itemY));
                rect.setAttribute('width', '110');
                rect.setAttribute('height', String(itemH));
                rect.setAttribute('fill', 'rgba(255,255,255,0.05)');
                rect.setAttribute('stroke', layer.color);
                rect.setAttribute('stroke-width', '1');
                rect.setAttribute('rx', '6');
                svg.appendChild(rect);

                var txt = document.createElementNS(SVG_NS, 'text');
                txt.setAttribute('x', String(layer.x));
                txt.setAttribute('y', String(itemY + itemH / 2 + 4));
                txt.setAttribute('text-anchor', 'middle');
                txt.setAttribute('fill', '#e2e8f0');
                txt.setAttribute('font-size', '10');
                var itemText = layer.items[it];
                txt.textContent = itemText.length > 14 ? itemText.substring(0, 14) + '..' : itemText;
                svg.appendChild(txt);
            }

            // Draw flow arrows between layers
            if (l < layers.length - 1) {
                var nextLayer = layers[l + 1];
                var arrowX1 = layer.x + 55;
                var arrowX2 = nextLayer.x - 55;
                var arrowY = startY + (maxItems * (itemH + 6)) / 2;

                var arrowLine = document.createElementNS(SVG_NS, 'line');
                arrowLine.setAttribute('x1', String(arrowX1));
                arrowLine.setAttribute('y1', String(arrowY));
                arrowLine.setAttribute('x2', String(arrowX2));
                arrowLine.setAttribute('y2', String(arrowY));
                arrowLine.setAttribute('stroke', '#8B949E');
                arrowLine.setAttribute('stroke-width', '1.5');
                arrowLine.setAttribute('stroke-dasharray', '5,3');
                svg.appendChild(arrowLine);

                // Arrow tip
                var tipSize = 6;
                var tip = document.createElementNS(SVG_NS, 'polygon');
                tip.setAttribute('points',
                    (arrowX2 - tipSize) + ',' + (arrowY - tipSize / 2) + ' ' +
                    arrowX2 + ',' + arrowY + ' ' +
                    (arrowX2 - tipSize) + ',' + (arrowY + tipSize / 2));
                tip.setAttribute('fill', '#8B949E');
                svg.appendChild(tip);
            }
        }

        // Stats bar at bottom
        var statsY = 360;
        var statsItems = [
            'Inbound: ' + routing.userMessages,
            'Outbound: ' + routing.assistantMessages,
            'Tool Calls: ' + routing.toolCalls,
            'Steps: ' + routing.stepCount
        ];
        for (var si = 0; si < statsItems.length; si++) {
            var stxt = document.createElementNS(SVG_NS, 'text');
            stxt.setAttribute('x', String(80 + si * 170));
            stxt.setAttribute('y', String(statsY));
            stxt.setAttribute('fill', '#8B949E');
            stxt.setAttribute('font-size', '11');
            stxt.textContent = statsItems[si];
            svg.appendChild(stxt);
        }

        section.appendChild(svg);
        _container.appendChild(section);
    }

    function getTopTools(toolMap, limit) {
        var list = [];
        for (var t in toolMap) {
            if (toolMap.hasOwnProperty(t)) { list.push(t); }
        }
        list.sort(function (a, b) { return toolMap[b] - toolMap[a]; });
        return list.slice(0, limit);
    }

    function renderRoutingDetails(routing) {
        var section = S.createElement('div', { 'class': 'rt-details' });
        var title = S.createElement('h3', { 'class': 'rt-section-title' }, 'Routing Configuration');
        section.appendChild(title);

        var grid = S.createElement('div', { 'class': 'rt-detail-grid' });
        var items = [
            { label: 'DM Policy', value: routing.policies.dmPolicy || 'pairing (default)' },
            { label: 'Activation Mode', value: routing.policies.activation || 'Not detected' },
            { label: 'Allow From', value: routing.policies.allowFrom || 'Not detected' },
            { label: 'Active Channels', value: routing.channels.length > 0 ? routing.channels.join(', ') : 'None detected' },
            { label: 'Active Agents', value: routing.agents.join(', ') },
            { label: 'Tool Categories', value: String(Object.keys(routing.tools).length) + ' unique tools' }
        ];

        for (var i = 0; i < items.length; i++) {
            var card = S.createElement('div', { 'class': 'rt-detail-card' });
            card.appendChild(S.createElement('div', { 'class': 'rt-detail-label' }, items[i].label));
            card.appendChild(S.createElement('div', { 'class': 'rt-detail-value' }, items[i].value));
            grid.appendChild(card);
        }
        section.appendChild(grid);
        _container.appendChild(section);
    }

    function renderSecurityOverview(routing) {
        var section = S.createElement('div', { 'class': 'rt-security' });
        var title = S.createElement('h3', { 'class': 'rt-section-title' }, 'Security Posture');
        section.appendChild(title);

        var checks = [];
        if (routing.policies.dmPolicy === 'open') {
            checks.push({ status: 'warn', text: 'DM policy is "open" — unknown senders can message the agent. Consider "pairing" for production.' });
        } else {
            checks.push({ status: 'ok', text: 'DM policy uses pairing or is not set (default: pairing). Unknown senders require approval.' });
        }

        if (routing.policies.allowFrom === '*') {
            checks.push({ status: 'warn', text: 'allowFrom includes wildcard "*" — all senders are permitted.' });
        }

        if (routing.agents.length > 1) {
            checks.push({ status: 'info', text: 'Multi-agent routing detected (' + routing.agents.length + ' agents). Ensure per-agent sandboxing is configured.' });
        }

        checks.push({ status: 'info', text: 'Run "openclaw doctor" to get a full security diagnostic of your Gateway configuration.' });

        for (var i = 0; i < checks.length; i++) {
            var item = S.createElement('div', { 'class': 'rt-check rt-check-' + checks[i].status });
            var icon = checks[i].status === 'ok' ? '\u2705' : checks[i].status === 'warn' ? '\u26A0' : '\u2139';
            item.appendChild(S.createElement('span', { 'class': 'rt-check-icon' }, icon));
            item.appendChild(S.createElement('span', { 'class': 'rt-check-text' }, checks[i].text));
            section.appendChild(item);
        }

        _container.appendChild(section);
    }

    return { init: init, render: render };
})();
