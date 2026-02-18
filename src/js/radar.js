/**
 * Clawtrace — Radar Chart Module
 * ============================================================
 * SVG spider/radar chart profiling AI behavior across 6 axes:
 * Verbosity, Confidence, Tool Reliance, Repetitiveness,
 * Hedging, Error Rate.
 *
 * Each trace gets a unique behavioral "shape."
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Radar = (function () {

    var S = Clawtrace.Sanitizer;

    /* ---- Dimensions ---- */
    var DIMENSIONS = [
        { key: 'verbosity', label: 'Verbosity', description: 'Average content length per step' },
        { key: 'confidence', label: 'Confidence', description: 'Inverse of uncertainty language density' },
        { key: 'toolReliance', label: 'Tool Reliance', description: 'Proportion of tool call steps' },
        { key: 'repetitiveness', label: 'Repetitiveness', description: 'Detected repetition patterns' },
        { key: 'hedging', label: 'Hedging', description: 'Frequency of hedging/probabilistic language' },
        { key: 'errorRate', label: 'Error Rate', description: 'Proportion of error steps' }
    ];

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var _container = null;

    /* ---- Initialize ---- */

    function init(container) {
        _container = container;
    }

    /* ---- Compute Profile ---- */

    function computeProfile(traceData, analysisResult) {
        if (!traceData || !traceData.steps || traceData.steps.length === 0) {
            return { verbosity: 0, confidence: 0, toolReliance: 0, repetitiveness: 0, hedging: 0, errorRate: 0 };
        }

        var steps = traceData.steps;
        var totalSteps = steps.length;

        // Verbosity: avg content length, normalized 0-100
        var totalLen = 0;
        for (var i = 0; i < steps.length; i++) {
            totalLen += (steps[i].content || '').length;
        }
        var avgLen = totalLen / totalSteps;
        var verbosity = Math.min(100, (avgLen / 500) * 100); // 500 chars = 100%

        // Confidence: from analyzer result
        var confidence = analysisResult ? analysisResult.confidenceScore || 50 : 50;

        // Tool Reliance: % of tool_call steps
        var toolCount = 0;
        var errorCount = 0;
        for (var j = 0; j < steps.length; j++) {
            if (steps[j].type === 'tool_call') { toolCount++; }
            if (steps[j].type === 'error') { errorCount++; }
        }
        var toolReliance = Math.min(100, (toolCount / totalSteps) * 200); // scaled

        // Repetitiveness: from analysis findings
        var repFindings = 0;
        if (analysisResult && analysisResult.findings) {
            for (var k = 0; k < analysisResult.findings.length; k++) {
                if (analysisResult.findings[k].category === 'Repetition') { repFindings++; }
            }
        }
        var repetitiveness = Math.min(100, repFindings * 20);

        // Hedging: count uncertainty patterns in all assistant content
        var hedgePatterns = [
            /\bi (think|believe|guess|suppose|assume)\b/gi,
            /\b(maybe|perhaps|possibly|probably|might|could be)\b/gi,
            /\b(approximately|roughly|around|estimated)\b/gi,
            /\bi('m| am) not (sure|certain|confident)\b/gi
        ];
        var hedgeCount = 0;
        var assistantSteps = 0;
        for (var h = 0; h < steps.length; h++) {
            if (steps[h].type === 'assistant') {
                assistantSteps++;
                var content = steps[h].content || '';
                for (var hp = 0; hp < hedgePatterns.length; hp++) {
                    var regex = new RegExp(hedgePatterns[hp].source, hedgePatterns[hp].flags);
                    var matches = content.match(regex);
                    if (matches) { hedgeCount += matches.length; }
                }
            }
        }
        var hedging = assistantSteps > 0 ? Math.min(100, (hedgeCount / assistantSteps) * 30) : 0;

        // Error Rate
        var errorRate = Math.min(100, (errorCount / totalSteps) * 300);

        return {
            verbosity: Math.round(verbosity),
            confidence: Math.round(confidence),
            toolReliance: Math.round(toolReliance),
            repetitiveness: Math.round(repetitiveness),
            hedging: Math.round(hedging),
            errorRate: Math.round(errorRate)
        };
    }

    /* ---- Render ---- */

    function render(traceData, analysisResult) {
        if (!_container) { return; }

        while (_container.firstChild) {
            _container.removeChild(_container.firstChild);
        }

        var profile = computeProfile(traceData, analysisResult);

        // Title
        var title = S.createElement('h3', { 'class': 'radar-title' }, 'AI Behavior Profile');
        _container.appendChild(title);

        // Description
        var desc = S.createElement('p', { 'class': 'radar-desc' }, 'Each axis represents a behavioral dimension scored 0\u2013100. The shape reveals the AI\'s behavioral fingerprint for this trace.');
        _container.appendChild(desc);

        // SVG Chart
        var chartWrap = S.createElement('div', { 'class': 'radar-chart-wrap' });
        var svg = buildRadarSVG(profile, 280, 280);
        chartWrap.appendChild(svg);
        _container.appendChild(chartWrap);

        // Dimension details
        var details = buildDimensionDetails(profile);
        _container.appendChild(details);
    }

    /* ---- Build SVG Radar ---- */

    function buildRadarSVG(profile, width, height) {
        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', 'auto');
        svg.setAttribute('class', 'radar-svg');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'AI Behavior Radar Chart');
        svg.style.maxWidth = width + 'px';

        var cx = width / 2;
        var cy = height / 2;
        var maxR = Math.min(cx, cy) - 50;
        var numAxes = DIMENSIONS.length;
        var angleStep = (2 * Math.PI) / numAxes;
        var startAngle = -Math.PI / 2; // Start at top

        // Background rings
        var rings = [0.25, 0.5, 0.75, 1.0];
        for (var r = 0; r < rings.length; r++) {
            var ringR = maxR * rings[r];
            var ringPoints = [];
            for (var ri = 0; ri < numAxes; ri++) {
                var rAngle = startAngle + ri * angleStep;
                ringPoints.push(cx + ringR * Math.cos(rAngle) + ',' + (cy + ringR * Math.sin(rAngle)));
            }
            var ringPoly = document.createElementNS(SVG_NS, 'polygon');
            ringPoly.setAttribute('points', ringPoints.join(' '));
            ringPoly.setAttribute('class', 'radar-ring');
            ringPoly.setAttribute('fill', 'none');
            ringPoly.setAttribute('stroke', 'rgba(148, 163, 184, 0.15)');
            ringPoly.setAttribute('stroke-width', '1');
            svg.appendChild(ringPoly);
        }

        // Axis lines and labels
        for (var a = 0; a < numAxes; a++) {
            var angle = startAngle + a * angleStep;
            var x2 = cx + maxR * Math.cos(angle);
            var y2 = cy + maxR * Math.sin(angle);

            // Axis line
            var line = document.createElementNS(SVG_NS, 'line');
            line.setAttribute('x1', String(cx));
            line.setAttribute('y1', String(cy));
            line.setAttribute('x2', String(x2));
            line.setAttribute('y2', String(y2));
            line.setAttribute('stroke', 'rgba(148, 163, 184, 0.2)');
            line.setAttribute('stroke-width', '1');
            svg.appendChild(line);

            // Label
            var labelR = maxR + 28;
            var lx = cx + labelR * Math.cos(angle);
            var ly = cy + labelR * Math.sin(angle);

            var text = document.createElementNS(SVG_NS, 'text');
            text.setAttribute('x', String(lx));
            text.setAttribute('y', String(ly));
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('class', 'radar-label');
            text.setAttribute('fill', '#94a3b8');
            text.setAttribute('font-size', '11');
            text.setAttribute('font-family', 'Inter, system-ui, sans-serif');
            text.textContent = DIMENSIONS[a].label;
            svg.appendChild(text);

            // Value label
            var value = profile[DIMENSIONS[a].key] || 0;
            var valR = maxR + 14;
            var vx = cx + valR * Math.cos(angle);
            var vy = cy + valR * Math.sin(angle) + 12;

            var valText = document.createElementNS(SVG_NS, 'text');
            valText.setAttribute('x', String(vx));
            valText.setAttribute('y', String(vy));
            valText.setAttribute('text-anchor', 'middle');
            valText.setAttribute('fill', '#6366f1');
            valText.setAttribute('font-size', '10');
            valText.setAttribute('font-weight', '600');
            valText.setAttribute('font-family', 'JetBrains Mono, monospace');
            valText.textContent = String(value);
            svg.appendChild(valText);
        }

        // Data polygon
        var dataPoints = [];
        for (var d = 0; d < numAxes; d++) {
            var dAngle = startAngle + d * angleStep;
            var value2 = (profile[DIMENSIONS[d].key] || 0) / 100;
            var dr = maxR * value2;
            dataPoints.push((cx + dr * Math.cos(dAngle)) + ',' + (cy + dr * Math.sin(dAngle)));
        }

        var dataPoly = document.createElementNS(SVG_NS, 'polygon');
        dataPoly.setAttribute('points', dataPoints.join(' '));
        dataPoly.setAttribute('class', 'radar-data');
        dataPoly.setAttribute('fill', 'rgba(99, 102, 241, 0.2)');
        dataPoly.setAttribute('stroke', '#6366f1');
        dataPoly.setAttribute('stroke-width', '2');
        svg.appendChild(dataPoly);

        // Data points (dots)
        for (var dp = 0; dp < numAxes; dp++) {
            var dpAngle = startAngle + dp * angleStep;
            var dpValue = (profile[DIMENSIONS[dp].key] || 0) / 100;
            var dpR = maxR * dpValue;
            var dotX = cx + dpR * Math.cos(dpAngle);
            var dotY = cy + dpR * Math.sin(dpAngle);

            var dot = document.createElementNS(SVG_NS, 'circle');
            dot.setAttribute('cx', String(dotX));
            dot.setAttribute('cy', String(dotY));
            dot.setAttribute('r', '4');
            dot.setAttribute('fill', '#6366f1');
            dot.setAttribute('stroke', '#ffffff');
            dot.setAttribute('stroke-width', '1.5');
            dot.setAttribute('class', 'radar-dot');
            svg.appendChild(dot);
        }

        return svg;
    }

    /* ---- Dimension Details ---- */

    function buildDimensionDetails(profile) {
        var grid = S.createElement('div', { 'class': 'radar-details' });

        for (var i = 0; i < DIMENSIONS.length; i++) {
            var dim = DIMENSIONS[i];
            var value = profile[dim.key] || 0;

            var card = S.createElement('div', { 'class': 'radar-detail-card' });

            var header = S.createElement('div', { 'class': 'radar-detail-header' });
            var label = S.createElement('span', { 'class': 'radar-detail-label' }, dim.label);
            var score = S.createElement('span', { 'class': 'radar-detail-score' }, value + '/100');
            header.appendChild(label);
            header.appendChild(score);

            var bar = S.createElement('div', { 'class': 'radar-detail-bar' });
            var fill = S.createElement('div', { 'class': 'radar-detail-fill' });
            fill.style.width = value + '%';

            // Color based on value
            if (value > 70) { fill.style.background = '#ef4444'; }
            else if (value > 40) { fill.style.background = '#f59e0b'; }
            else { fill.style.background = '#22c55e'; }

            bar.appendChild(fill);

            var descEl = S.createElement('div', { 'class': 'radar-detail-desc' }, dim.description);

            card.appendChild(header);
            card.appendChild(bar);
            card.appendChild(descEl);
            grid.appendChild(card);
        }

        return grid;
    }

    /* ---- Public API ---- */

    return {
        init: init,
        render: render,
        computeProfile: computeProfile
    };

})();
