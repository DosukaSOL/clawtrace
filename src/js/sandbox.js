/**
 * Clawtrace — Sandbox Boundary Inspector
 * ============================================================
 * Visualizes which tool calls ran on host vs Docker sandbox
 * in OpenClaw traces. Flags boundary crossings and security.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Sandbox = (function () {

    var S = Clawtrace.Sanitizer;
    var _container = null;

    // Tools typically allowed in sandbox
    var SANDBOX_ALLOWED = ['bash', 'process', 'read', 'write', 'edit', 'sessions_list', 'sessions_history', 'sessions_send', 'sessions_spawn'];
    // Tools typically denied in sandbox
    var SANDBOX_DENIED = ['browser', 'canvas', 'nodes', 'cron', 'discord', 'gateway', 'node.invoke', 'system.run', 'system.notify', 'camera', 'screen', 'location'];

    function init(container) { _container = container; }

    function render(traceData) {
        if (!_container || !traceData) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        var analysis = analyzeExecution(traceData);
        renderOverview(analysis);
        renderBoundaryMap(analysis);
        renderSecurityFlags(analysis);
    }

    function analyzeExecution(traceData) {
        var hostTools = [];
        var sandboxTools = [];
        var deniedAttempts = [];
        var isSandboxed = false;
        var allText = '';

        for (var i = 0; i < traceData.steps.length; i++) {
            var step = traceData.steps[i];
            var content = (step.content || '');
            var lower = content.toLowerCase();
            allText += lower + ' ';

            if (step.type === 'tool_call') {
                var toolName = extractToolName(content);
                var lowerTool = toolName.toLowerCase();

                var isDenied = false;
                for (var d = 0; d < SANDBOX_DENIED.length; d++) {
                    if (lowerTool.indexOf(SANDBOX_DENIED[d]) === 0) {
                        isDenied = true;
                        break;
                    }
                }

                var isAllowed = false;
                for (var a = 0; a < SANDBOX_ALLOWED.length; a++) {
                    if (lowerTool.indexOf(SANDBOX_ALLOWED[a]) === 0) {
                        isAllowed = true;
                        break;
                    }
                }

                // Check if error follows (possible sandbox denial)
                var nextStep = traceData.steps[i + 1];
                var wasDenied = nextStep && nextStep.type === 'error' &&
                    (nextStep.content || '').toLowerCase().indexOf('denied') > -1;

                if (wasDenied) {
                    deniedAttempts.push({ tool: toolName, step: i });
                } else if (isDenied) {
                    hostTools.push({ tool: toolName, step: i, risk: 'host-only' });
                } else if (isAllowed) {
                    sandboxTools.push({ tool: toolName, step: i });
                } else {
                    hostTools.push({ tool: toolName, step: i, risk: 'unknown' });
                }
            }
        }

        // Detect sandbox mode from config references
        isSandboxed = allText.indexOf('sandbox') > -1 && (
            allText.indexOf('non-main') > -1 || allText.indexOf('sandbox.mode') > -1
        );

        return {
            hostTools: hostTools,
            sandboxTools: sandboxTools,
            deniedAttempts: deniedAttempts,
            isSandboxed: isSandboxed,
            totalToolCalls: hostTools.length + sandboxTools.length + deniedAttempts.length
        };
    }

    function extractToolName(content) {
        var match = content.match(/^(\w[\w.]*)/);
        return match ? match[1] : 'unknown';
    }

    function renderOverview(analysis) {
        var section = S.createElement('div', { 'class': 'sb-overview' });
        var title = S.createElement('h3', { 'class': 'sb-section-title' }, 'Sandbox Analysis');
        section.appendChild(title);

        var grid = S.createElement('div', { 'class': 'sb-stat-grid' });
        var stats = [
            { label: 'Total Tool Calls', value: String(analysis.totalToolCalls) },
            { label: 'Host-Only Tools', value: String(analysis.hostTools.length) },
            { label: 'Sandbox-Safe Tools', value: String(analysis.sandboxTools.length) },
            { label: 'Denied Attempts', value: String(analysis.deniedAttempts.length) },
            { label: 'Sandbox Mode', value: analysis.isSandboxed ? 'Detected' : 'Not detected' }
        ];

        for (var i = 0; i < stats.length; i++) {
            var card = S.createElement('div', { 'class': 'sb-stat-card' });
            card.appendChild(S.createElement('div', { 'class': 'sb-stat-value' }, stats[i].value));
            card.appendChild(S.createElement('div', { 'class': 'sb-stat-label' }, stats[i].label));
            grid.appendChild(card);
        }
        section.appendChild(grid);
        _container.appendChild(section);
    }

    function renderBoundaryMap(analysis) {
        var section = S.createElement('div', { 'class': 'sb-boundary' });
        var title = S.createElement('h3', { 'class': 'sb-section-title' }, 'Execution Boundary Map');
        section.appendChild(title);

        var SVG_NS = 'http://www.w3.org/2000/svg';
        var width = 700;
        var height = 250;

        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svg.setAttribute('class', 'sb-map-svg');

        // Background
        var bg = document.createElementNS(SVG_NS, 'rect');
        bg.setAttribute('width', String(width));
        bg.setAttribute('height', String(height));
        bg.setAttribute('fill', 'rgba(13,17,23,0.5)');
        bg.setAttribute('rx', '8');
        svg.appendChild(bg);

        // Host zone (top)
        var hostZone = document.createElementNS(SVG_NS, 'rect');
        hostZone.setAttribute('x', '20');
        hostZone.setAttribute('y', '20');
        hostZone.setAttribute('width', String(width - 40));
        hostZone.setAttribute('height', '90');
        hostZone.setAttribute('fill', 'rgba(239,68,68,0.08)');
        hostZone.setAttribute('stroke', '#ef4444');
        hostZone.setAttribute('stroke-dasharray', '4,3');
        hostZone.setAttribute('rx', '8');
        svg.appendChild(hostZone);

        var hostLabel = document.createElementNS(SVG_NS, 'text');
        hostLabel.setAttribute('x', '35');
        hostLabel.setAttribute('y', '40');
        hostLabel.setAttribute('fill', '#ef4444');
        hostLabel.setAttribute('font-size', '12');
        hostLabel.setAttribute('font-weight', 'bold');
        hostLabel.textContent = 'HOST (' + analysis.hostTools.length + ' calls)';
        svg.appendChild(hostLabel);

        // Sandbox zone (bottom)
        var sbZone = document.createElementNS(SVG_NS, 'rect');
        sbZone.setAttribute('x', '20');
        sbZone.setAttribute('y', '130');
        sbZone.setAttribute('width', String(width - 40));
        sbZone.setAttribute('height', '90');
        sbZone.setAttribute('fill', 'rgba(34,197,94,0.08)');
        sbZone.setAttribute('stroke', '#22c55e');
        sbZone.setAttribute('stroke-dasharray', '4,3');
        sbZone.setAttribute('rx', '8');
        svg.appendChild(sbZone);

        var sbLabel = document.createElementNS(SVG_NS, 'text');
        sbLabel.setAttribute('x', '35');
        sbLabel.setAttribute('y', '150');
        sbLabel.setAttribute('fill', '#22c55e');
        sbLabel.setAttribute('font-size', '12');
        sbLabel.setAttribute('font-weight', 'bold');
        sbLabel.textContent = 'SANDBOX (' + analysis.sandboxTools.length + ' calls)';
        svg.appendChild(sbLabel);

        // Plot tool dots in host zone
        var hostLimit = Math.min(analysis.hostTools.length, 20);
        for (var h = 0; h < hostLimit; h++) {
            var hx = 50 + (h % 10) * 60;
            var hy = 55 + Math.floor(h / 10) * 25;
            var hDot = document.createElementNS(SVG_NS, 'circle');
            hDot.setAttribute('cx', String(hx));
            hDot.setAttribute('cy', String(hy));
            hDot.setAttribute('r', '8');
            hDot.setAttribute('fill', 'rgba(239,68,68,0.6)');
            svg.appendChild(hDot);

            var hTxt = document.createElementNS(SVG_NS, 'text');
            hTxt.setAttribute('x', String(hx));
            hTxt.setAttribute('y', String(hy + 20));
            hTxt.setAttribute('text-anchor', 'middle');
            hTxt.setAttribute('fill', '#8B949E');
            hTxt.setAttribute('font-size', '8');
            var htName = analysis.hostTools[h].tool;
            hTxt.textContent = htName.length > 8 ? htName.substring(0, 8) : htName;
            svg.appendChild(hTxt);
        }

        // Plot tool dots in sandbox zone
        var sbLimit = Math.min(analysis.sandboxTools.length, 20);
        for (var s = 0; s < sbLimit; s++) {
            var sx = 50 + (s % 10) * 60;
            var sy = 165 + Math.floor(s / 10) * 25;
            var sDot = document.createElementNS(SVG_NS, 'circle');
            sDot.setAttribute('cx', String(sx));
            sDot.setAttribute('cy', String(sy));
            sDot.setAttribute('r', '8');
            sDot.setAttribute('fill', 'rgba(34,197,94,0.6)');
            svg.appendChild(sDot);

            var sTxt = document.createElementNS(SVG_NS, 'text');
            sTxt.setAttribute('x', String(sx));
            sTxt.setAttribute('y', String(sy + 20));
            sTxt.setAttribute('text-anchor', 'middle');
            sTxt.setAttribute('fill', '#8B949E');
            sTxt.setAttribute('font-size', '8');
            var stName = analysis.sandboxTools[s].tool;
            sTxt.textContent = stName.length > 8 ? stName.substring(0, 8) : stName;
            svg.appendChild(sTxt);
        }

        section.appendChild(svg);
        _container.appendChild(section);
    }

    function renderSecurityFlags(analysis) {
        var section = S.createElement('div', { 'class': 'sb-security' });
        var title = S.createElement('h3', { 'class': 'sb-section-title' }, 'Security Observations');
        section.appendChild(title);

        var flags = [];

        if (analysis.hostTools.length > 0 && !analysis.isSandboxed) {
            flags.push({ level: 'info', text: analysis.hostTools.length + ' tool calls executed on host. For group/channel sessions, consider enabling sandbox: agents.defaults.sandbox.mode: "non-main"' });
        }

        if (analysis.deniedAttempts.length > 0) {
            flags.push({ level: 'warn', text: analysis.deniedAttempts.length + ' tool calls were denied by sandbox. The sandbox correctly blocked restricted tools.' });
        }

        if (analysis.hostTools.length === 0 && analysis.sandboxTools.length > 0) {
            flags.push({ level: 'ok', text: 'All tool calls used sandbox-safe tools. Good security posture.' });
        }

        if (flags.length === 0) {
            flags.push({ level: 'info', text: 'No sandbox-specific observations. Load a trace from a sandboxed OpenClaw session for detailed analysis.' });
        }

        for (var i = 0; i < flags.length; i++) {
            var item = S.createElement('div', { 'class': 'sb-flag sb-flag-' + flags[i].level });
            var icon = flags[i].level === 'ok' ? '\u2705' : flags[i].level === 'warn' ? '\u26A0' : '\u2139';
            item.appendChild(S.createElement('span', { 'class': 'sb-flag-icon' }, icon));
            item.appendChild(S.createElement('span', {}, flags[i].text));
            section.appendChild(item);
        }

        _container.appendChild(section);
    }

    return { init: init, render: render };
})();
