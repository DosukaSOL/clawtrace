/**
 * Clawtrace — Agent-to-Agent Flow Mapper
 * ============================================================
 * Visualizes multi-agent interactions via OpenClaw's
 * sessions_send / sessions_list / sessions_history tools.
 *   - Inter-agent communication graph
 *   - Ping-pong patterns & REPLY_SKIP / ANNOUNCE_SKIP flags
 *   - Cross-session data flow
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.AgentMap = (function () {

    var S = Clawtrace.Sanitizer;
    var _container = null;

    var SESSION_TOOL_PATTERNS = [
        { pattern: /sessions?_send/i, type: 'send' },
        { pattern: /sessions?_list/i, type: 'list' },
        { pattern: /sessions?_history/i, type: 'history' },
        { pattern: /sessions?_spawn/i, type: 'spawn' }
    ];

    function init(container) { _container = container; }

    function render(traceData) {
        if (!_container || !traceData) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        var interactions = extractInteractions(traceData);
        renderSummary(interactions);
        renderFlowGraph(interactions);
        renderInteractionList(interactions);
    }

    function extractInteractions(traceData) {
        var sessions = {};
        var messages = [];
        var spawns = [];
        var currentSession = 'main';

        for (var i = 0; i < traceData.steps.length; i++) {
            var step = traceData.steps[i];
            var content = (step.content || '').toLowerCase();
            var raw = step.raw || step.content || '';

            // Detect session references
            var sessionMatch = raw.match(/session[_\-]?(?:id|name)?\s*[:=]\s*["']?([a-zA-Z0-9_\-]+)/i);
            if (sessionMatch) {
                sessions[sessionMatch[1]] = true;
            }

            if (step.type === 'tool_call') {
                for (var p = 0; p < SESSION_TOOL_PATTERNS.length; p++) {
                    var pat = SESSION_TOOL_PATTERNS[p];
                    if (pat.pattern.test(content)) {
                        var target = extractTarget(raw);
                        var replySkip = /reply_skip|REPLY_SKIP/i.test(raw);
                        var announceSkip = /announce_skip|ANNOUNCE_SKIP/i.test(raw);

                        if (pat.type === 'send') {
                            messages.push({
                                from: currentSession,
                                to: target || 'unknown',
                                step: i,
                                replySkip: replySkip,
                                announceSkip: announceSkip,
                                content: raw.substring(0, 200)
                            });
                            if (target) { sessions[target] = true; }
                        } else if (pat.type === 'spawn') {
                            spawns.push({ from: currentSession, spawned: target || 'new_session', step: i });
                            if (target) { sessions[target] = true; }
                        } else if (pat.type === 'list') {
                            // Parse listed sessions from result
                            var nextStep = traceData.steps[i + 1];
                            if (nextStep) {
                                var listContent = nextStep.content || '';
                                var ids = listContent.match(/["']([a-zA-Z0-9_\-]+)["']/g);
                                if (ids) {
                                    for (var id = 0; id < ids.length; id++) {
                                        sessions[ids[id].replace(/["']/g, '')] = true;
                                    }
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }

        sessions[currentSession] = true;
        var sessionList = Object.keys(sessions);

        return {
            sessions: sessionList,
            messages: messages,
            spawns: spawns,
            isMultiAgent: messages.length > 0 || sessionList.length > 1
        };
    }

    function extractTarget(content) {
        var match = content.match(/(?:to|target|session)\s*[:=]\s*["']?([a-zA-Z0-9_\-]+)/i);
        return match ? match[1] : null;
    }

    function renderSummary(interactions) {
        var section = S.createElement('div', { 'class': 'am-summary' });
        var title = S.createElement('h3', { 'class': 'am-section-title' }, 'Agent Network Overview');
        section.appendChild(title);

        if (!interactions.isMultiAgent) {
            var msg = S.createElement('div', { 'class': 'am-single-agent' },
                'This trace appears to be a single-agent session. Multi-agent features (sessions_send, sessions_list, sessions_history, sessions_spawn) were not detected. ' +
                'OpenClaw supports multi-agent orchestration — load a trace that uses sessions_* tools to see the agent network graph.');
            section.appendChild(msg);
            _container.appendChild(section);
            return;
        }

        var grid = S.createElement('div', { 'class': 'am-stat-grid' });
        var stats = [
            { label: 'Active Sessions', value: String(interactions.sessions.length) },
            { label: 'Messages Sent', value: String(interactions.messages.length) },
            { label: 'Sessions Spawned', value: String(interactions.spawns.length) },
            { label: 'Reply Skip', value: String(interactions.messages.filter(function (m) { return m.replySkip; }).length) }
        ];

        for (var i = 0; i < stats.length; i++) {
            var card = S.createElement('div', { 'class': 'am-stat-card' });
            card.appendChild(S.createElement('div', { 'class': 'am-stat-value' }, stats[i].value));
            card.appendChild(S.createElement('div', { 'class': 'am-stat-label' }, stats[i].label));
            grid.appendChild(card);
        }
        section.appendChild(grid);
        _container.appendChild(section);
    }

    function renderFlowGraph(interactions) {
        if (!interactions.isMultiAgent) { return; }

        var section = S.createElement('div', { 'class': 'am-graph-section' });
        var title = S.createElement('h3', { 'class': 'am-section-title' }, 'Communication Flow');
        section.appendChild(title);

        var SVG_NS = 'http://www.w3.org/2000/svg';
        var nodeRadius = 40;
        var width = 700;
        var height = Math.max(300, interactions.sessions.length * 80);

        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svg.setAttribute('class', 'am-graph-svg');

        // Layout nodes in a circle
        var cx = width / 2;
        var cy = height / 2;
        var layoutRadius = Math.min(width, height) / 2 - nodeRadius - 30;
        var positions = {};

        for (var i = 0; i < interactions.sessions.length; i++) {
            var angle = (2 * Math.PI * i / interactions.sessions.length) - Math.PI / 2;
            positions[interactions.sessions[i]] = {
                x: cx + layoutRadius * Math.cos(angle),
                y: cy + layoutRadius * Math.sin(angle)
            };
        }

        // Draw message arrows
        for (var m = 0; m < interactions.messages.length; m++) {
            var msg = interactions.messages[m];
            var from = positions[msg.from];
            var to = positions[msg.to];
            if (!from || !to) { continue; }

            // Arrow line
            var line = document.createElementNS(SVG_NS, 'line');
            line.setAttribute('x1', String(from.x));
            line.setAttribute('y1', String(from.y));
            line.setAttribute('x2', String(to.x));
            line.setAttribute('y2', String(to.y));
            line.setAttribute('stroke', msg.replySkip ? '#f59e0b' : '#FF4500');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('marker-end', 'url(#arrowhead)');
            line.setAttribute('opacity', '0.7');
            svg.appendChild(line);
        }

        // Arrowhead marker
        var defs = document.createElementNS(SVG_NS, 'defs');
        var marker = document.createElementNS(SVG_NS, 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '10');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');
        var arrow = document.createElementNS(SVG_NS, 'polygon');
        arrow.setAttribute('points', '0 0, 10 3.5, 0 7');
        arrow.setAttribute('fill', '#FF4500');
        marker.appendChild(arrow);
        defs.appendChild(marker);
        svg.insertBefore(defs, svg.firstChild);

        // Draw session nodes
        for (var s = 0; s < interactions.sessions.length; s++) {
            var name = interactions.sessions[s];
            var pos = positions[name];

            var circle = document.createElementNS(SVG_NS, 'circle');
            circle.setAttribute('cx', String(pos.x));
            circle.setAttribute('cy', String(pos.y));
            circle.setAttribute('r', String(nodeRadius));
            circle.setAttribute('fill', name === 'main' ? 'rgba(255,69,0,0.2)' : 'rgba(139,148,158,0.15)');
            circle.setAttribute('stroke', name === 'main' ? '#FF4500' : '#8B949E');
            circle.setAttribute('stroke-width', '2');
            svg.appendChild(circle);

            var label = document.createElementNS(SVG_NS, 'text');
            label.setAttribute('x', String(pos.x));
            label.setAttribute('y', String(pos.y + 4));
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('fill', '#e2e8f0');
            label.setAttribute('font-size', '12');
            label.setAttribute('font-weight', name === 'main' ? 'bold' : 'normal');
            label.textContent = name.length > 10 ? name.substring(0, 10) + '..' : name;
            svg.appendChild(label);
        }

        section.appendChild(svg);
        _container.appendChild(section);
    }

    function renderInteractionList(interactions) {
        if (interactions.messages.length === 0 && interactions.spawns.length === 0) { return; }

        var section = S.createElement('div', { 'class': 'am-interaction-list' });
        var title = S.createElement('h3', { 'class': 'am-section-title' }, 'Interaction Log');
        section.appendChild(title);

        // Spawns
        for (var s = 0; s < interactions.spawns.length; s++) {
            var sp = interactions.spawns[s];
            var spEl = S.createElement('div', { 'class': 'am-interaction spawn' });
            spEl.appendChild(S.createElement('span', { 'class': 'am-badge spawn-badge' }, 'SPAWN'));
            spEl.appendChild(S.createElement('span', {}, sp.from + ' \u2192 ' + sp.spawned + ' (step ' + sp.step + ')'));
            section.appendChild(spEl);
        }

        // Messages
        for (var m = 0; m < interactions.messages.length; m++) {
            var msg = interactions.messages[m];
            var msgEl = S.createElement('div', { 'class': 'am-interaction message' });
            msgEl.appendChild(S.createElement('span', { 'class': 'am-badge msg-badge' }, 'SEND'));
            var flags = '';
            if (msg.replySkip) { flags += ' [REPLY_SKIP]'; }
            if (msg.announceSkip) { flags += ' [ANNOUNCE_SKIP]'; }
            msgEl.appendChild(S.createElement('span', {},
                msg.from + ' \u2192 ' + msg.to + ' (step ' + msg.step + ')' + flags));
            section.appendChild(msgEl);
        }

        _container.appendChild(section);
    }

    return { init: init, render: render };
})();
