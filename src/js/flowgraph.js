/**
 * Clawtrace — Flow Graph Module
 * ============================================================
 * Interactive SVG node graph visualizing the AI's decision chain.
 * Steps are nodes, tool calls branch, errors are dead ends,
 * loops are visible as cycles.
 *
 * Draggable nodes, zoom, pan.
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.FlowGraph = (function () {

    var S = Clawtrace.Sanitizer;
    var SVG_NS = 'http://www.w3.org/2000/svg';

    /* ---- Type Configuration ---- */

    var TYPE_CONFIG = {
        user:      { color: '#3b82f6', shape: 'rect',    label: 'USER' },
        assistant: { color: '#6366f1', shape: 'rect',    label: 'ASST' },
        tool_call: { color: '#f59e0b', shape: 'diamond', label: 'TOOL' },
        reasoning: { color: '#a78bfa', shape: 'rect',    label: 'RSNG' },
        error:     { color: '#ef4444', shape: 'octagon', label: 'ERR' },
        system:    { color: '#64748b', shape: 'rect',    label: 'SYS' }
    };

    var NODE_W = 160;
    var NODE_H = 60;
    var H_GAP = 40;
    var V_GAP = 30;
    var PADDING = 60;

    var _container = null;
    var _svgEl = null;
    var _viewBox = { x: 0, y: 0, w: 1000, h: 600 };
    var _isDragging = false;
    var _dragStart = { x: 0, y: 0 };
    var _isPanning = false;
    var _panStart = { x: 0, y: 0, vbx: 0, vby: 0 };

    /* ---- Initialize ---- */

    function init(container) {
        _container = container;
    }

    /* ---- Layout Engine ---- */

    function computeLayout(steps) {
        var nodes = [];
        var edges = [];
        var columns = []; // nodes[columnIndex] = array of node indices

        // Simple left-to-right layout with branching for tool calls
        var col = 0;
        var row = 0;
        var mainTrack = []; // indices on the main flow
        var branchStack = [];

        for (var i = 0; i < steps.length; i++) {
            var step = steps[i];
            var type = step.type || 'system';

            // Determine position
            var x, y;

            if (type === 'tool_call' && i > 0 && steps[i - 1].type !== 'tool_call') {
                // Branch down from main flow
                row++;
                x = PADDING + col * (NODE_W + H_GAP);
                y = PADDING + row * (NODE_H + V_GAP);
                branchStack.push(i);
            } else if (branchStack.length > 0 && type !== 'tool_call') {
                // Return to main track after tool calls
                row = 0;
                col++;
                x = PADDING + col * (NODE_W + H_GAP);
                y = PADDING + row * (NODE_H + V_GAP);
                branchStack = [];
            } else {
                x = PADDING + col * (NODE_W + H_GAP);
                y = PADDING + row * (NODE_H + V_GAP);
                if (type === 'tool_call') {
                    row++;
                } else {
                    col++;
                }
            }

            var node = {
                index: i,
                x: x,
                y: y,
                type: type,
                label: '#' + (i + 1) + ' ' + (TYPE_CONFIG[type] ? TYPE_CONFIG[type].label : 'STEP'),
                summary: (step.summary || step.content || '').substring(0, 40),
                config: TYPE_CONFIG[type] || TYPE_CONFIG.system
            };

            nodes.push(node);

            // Edge to previous node
            if (i > 0) {
                edges.push({ from: i - 1, to: i });
            }
        }

        // Detect loops (same content = back edge)
        for (var li = 0; li < steps.length; li++) {
            for (var lj = li + 2; lj < Math.min(li + 10, steps.length); lj++) {
                if (steps[li].content && steps[lj].content &&
                    steps[li].content.length > 20 &&
                    steps[li].content === steps[lj].content) {
                    edges.push({ from: lj, to: li, isLoop: true });
                }
            }
        }

        // Compute total dimensions
        var maxX = 0;
        var maxY = 0;
        for (var n = 0; n < nodes.length; n++) {
            if (nodes[n].x + NODE_W > maxX) { maxX = nodes[n].x + NODE_W; }
            if (nodes[n].y + NODE_H > maxY) { maxY = nodes[n].y + NODE_H; }
        }

        return {
            nodes: nodes,
            edges: edges,
            width: maxX + PADDING,
            height: maxY + PADDING
        };
    }

    /* ---- Render ---- */

    function render(traceData) {
        if (!_container || !traceData || !traceData.steps) { return; }

        while (_container.firstChild) {
            _container.removeChild(_container.firstChild);
        }

        if (traceData.steps.length === 0) {
            var empty = S.createElement('p', { 'class': 'no-data' }, 'No trace data to visualize.');
            _container.appendChild(empty);
            return;
        }

        // Limit nodes for performance
        var maxNodes = Math.min(traceData.steps.length, 100);
        var limitedSteps = traceData.steps.slice(0, maxNodes);

        // Controls
        var controls = S.createElement('div', { 'class': 'flow-controls' });
        var zoomIn = S.createElement('button', { 'class': 'btn btn-sm', 'id': 'flow-zoom-in' }, '+ Zoom In');
        var zoomOut = S.createElement('button', { 'class': 'btn btn-sm', 'id': 'flow-zoom-out' }, '- Zoom Out');
        var zoomReset = S.createElement('button', { 'class': 'btn btn-sm', 'id': 'flow-zoom-reset' }, '\u21BB Reset');
        controls.appendChild(zoomIn);
        controls.appendChild(zoomOut);
        controls.appendChild(zoomReset);

        if (traceData.steps.length > maxNodes) {
            var warn = S.createElement('span', { 'class': 'flow-limit-warn' }, 'Showing first ' + maxNodes + ' of ' + traceData.steps.length + ' steps');
            controls.appendChild(warn);
        }

        _container.appendChild(controls);

        // Legend
        var legend = buildLegend();
        _container.appendChild(legend);

        // Layout
        var layout = computeLayout(limitedSteps);

        // SVG
        _viewBox = { x: 0, y: 0, w: layout.width, h: layout.height };

        var svgWrap = S.createElement('div', { 'class': 'flow-svg-wrap' });
        _svgEl = document.createElementNS(SVG_NS, 'svg');
        _svgEl.setAttribute('viewBox', _viewBox.x + ' ' + _viewBox.y + ' ' + _viewBox.w + ' ' + _viewBox.h);
        _svgEl.setAttribute('width', '100%');
        _svgEl.setAttribute('height', Math.min(layout.height, 500) + 'px');
        _svgEl.setAttribute('class', 'flow-svg');
        _svgEl.setAttribute('role', 'img');
        _svgEl.setAttribute('aria-label', 'Reasoning Flow Graph');

        // Defs for arrow markers
        var defs = document.createElementNS(SVG_NS, 'defs');

        var marker = document.createElementNS(SVG_NS, 'marker');
        marker.setAttribute('id', 'flow-arrow');
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '10');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '8');
        marker.setAttribute('markerHeight', '8');
        marker.setAttribute('orient', 'auto-start-reverse');

        var arrowPath = document.createElementNS(SVG_NS, 'path');
        arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        arrowPath.setAttribute('fill', '#64748b');
        marker.appendChild(arrowPath);
        defs.appendChild(marker);

        var loopMarker = document.createElementNS(SVG_NS, 'marker');
        loopMarker.setAttribute('id', 'flow-loop-arrow');
        loopMarker.setAttribute('viewBox', '0 0 10 10');
        loopMarker.setAttribute('refX', '10');
        loopMarker.setAttribute('refY', '5');
        loopMarker.setAttribute('markerWidth', '8');
        loopMarker.setAttribute('markerHeight', '8');
        loopMarker.setAttribute('orient', 'auto-start-reverse');

        var loopArrowPath = document.createElementNS(SVG_NS, 'path');
        loopArrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        loopArrowPath.setAttribute('fill', '#ef4444');
        loopMarker.appendChild(loopArrowPath);
        defs.appendChild(loopMarker);

        _svgEl.appendChild(defs);

        // Render edges
        for (var e = 0; e < layout.edges.length; e++) {
            var edge = layout.edges[e];
            var fromNode = layout.nodes[edge.from];
            var toNode = layout.nodes[edge.to];

            if (!fromNode || !toNode) { continue; }

            var path = document.createElementNS(SVG_NS, 'path');
            var fromX = fromNode.x + NODE_W;
            var fromY = fromNode.y + NODE_H / 2;
            var toX = toNode.x;
            var toY = toNode.y + NODE_H / 2;

            if (edge.isLoop) {
                // Loop: curved path going above
                var midY = Math.min(fromNode.y, toNode.y) - 40;
                var d = 'M ' + (fromNode.x + NODE_W / 2) + ' ' + fromNode.y +
                        ' C ' + (fromNode.x + NODE_W / 2) + ' ' + midY + ', ' +
                        (toNode.x + NODE_W / 2) + ' ' + midY + ', ' +
                        (toNode.x + NODE_W / 2) + ' ' + toNode.y;
                path.setAttribute('d', d);
                path.setAttribute('stroke', '#ef4444');
                path.setAttribute('stroke-dasharray', '5,5');
                path.setAttribute('marker-end', 'url(#flow-loop-arrow)');
            } else if (fromNode.y !== toNode.y) {
                // Branching edge (vertical then horizontal)
                var cpx = (fromX + toX) / 2;
                var d2 = 'M ' + fromX + ' ' + fromY +
                          ' C ' + cpx + ' ' + fromY + ', ' + cpx + ' ' + toY + ', ' + toX + ' ' + toY;
                path.setAttribute('d', d2);
                path.setAttribute('stroke', '#64748b');
                path.setAttribute('marker-end', 'url(#flow-arrow)');
            } else {
                // Straight horizontal
                var d3 = 'M ' + fromX + ' ' + fromY + ' L ' + toX + ' ' + toY;
                path.setAttribute('d', d3);
                path.setAttribute('stroke', '#64748b');
                path.setAttribute('marker-end', 'url(#flow-arrow)');
            }

            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-width', '2');
            _svgEl.appendChild(path);
        }

        // Render nodes
        for (var ni = 0; ni < layout.nodes.length; ni++) {
            var node = layout.nodes[ni];
            renderNode(_svgEl, node);
        }

        svgWrap.appendChild(_svgEl);
        _container.appendChild(svgWrap);

        // Bind zoom/pan
        bindZoomPan();
    }

    /* ---- Render Single Node ---- */

    function renderNode(svg, node) {
        var g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'flow-node');
        g.setAttribute('transform', 'translate(' + node.x + ',' + node.y + ')');

        // Background rect
        var rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('width', String(NODE_W));
        rect.setAttribute('height', String(NODE_H));
        rect.setAttribute('rx', node.type === 'error' ? '2' : '8');
        rect.setAttribute('ry', node.type === 'error' ? '2' : '8');
        rect.setAttribute('fill', 'rgba(17, 24, 39, 0.9)');
        rect.setAttribute('stroke', node.config.color);
        rect.setAttribute('stroke-width', '2');
        g.appendChild(rect);

        // Color stripe on left
        var stripe = document.createElementNS(SVG_NS, 'rect');
        stripe.setAttribute('width', '4');
        stripe.setAttribute('height', String(NODE_H));
        stripe.setAttribute('rx', '2');
        stripe.setAttribute('fill', node.config.color);
        g.appendChild(stripe);

        // Label
        var labelText = document.createElementNS(SVG_NS, 'text');
        labelText.setAttribute('x', '12');
        labelText.setAttribute('y', '20');
        labelText.setAttribute('fill', node.config.color);
        labelText.setAttribute('font-size', '11');
        labelText.setAttribute('font-weight', '700');
        labelText.setAttribute('font-family', 'JetBrains Mono, monospace');
        labelText.textContent = node.label;
        g.appendChild(labelText);

        // Summary (truncated)
        var summaryText = document.createElementNS(SVG_NS, 'text');
        summaryText.setAttribute('x', '12');
        summaryText.setAttribute('y', '42');
        summaryText.setAttribute('fill', '#94a3b8');
        summaryText.setAttribute('font-size', '9');
        summaryText.setAttribute('font-family', 'Inter, system-ui, sans-serif');
        summaryText.textContent = node.summary.length > 22 ? node.summary.substring(0, 22) + '...' : node.summary;
        g.appendChild(summaryText);

        svg.appendChild(g);
    }

    /* ---- Legend ---- */

    function buildLegend() {
        var legend = S.createElement('div', { 'class': 'flow-legend' });

        var types = ['user', 'assistant', 'tool_call', 'reasoning', 'error', 'system'];
        for (var i = 0; i < types.length; i++) {
            var config = TYPE_CONFIG[types[i]];
            var item = S.createElement('span', { 'class': 'flow-legend-item' });

            var dot = S.createElement('span', { 'class': 'flow-legend-dot' });
            dot.style.background = config.color;
            item.appendChild(dot);

            var label = S.createElement('span', {}, config.label);
            item.appendChild(label);

            legend.appendChild(item);
        }

        // Loop indicator
        var loopItem = S.createElement('span', { 'class': 'flow-legend-item' });
        var loopLine = S.createElement('span', { 'class': 'flow-legend-loop' }, '---');
        loopItem.appendChild(loopLine);
        var loopLabel = S.createElement('span', {}, 'Loop');
        loopItem.appendChild(loopLabel);
        legend.appendChild(loopItem);

        return legend;
    }

    /* ---- Zoom & Pan ---- */

    function bindZoomPan() {
        var zoomIn = document.getElementById('flow-zoom-in');
        var zoomOut = document.getElementById('flow-zoom-out');
        var zoomReset = document.getElementById('flow-zoom-reset');

        if (zoomIn) {
            zoomIn.addEventListener('click', function () {
                zoom(0.8);
            });
        }

        if (zoomOut) {
            zoomOut.addEventListener('click', function () {
                zoom(1.25);
            });
        }

        if (zoomReset) {
            zoomReset.addEventListener('click', function () {
                if (_svgEl && _traceLayout) {
                    _viewBox = { x: 0, y: 0, w: _traceLayout.width, h: _traceLayout.height };
                    updateViewBox();
                }
            });
        }

        // Mouse wheel zoom
        if (_svgEl) {
            _svgEl.addEventListener('wheel', function (e) {
                e.preventDefault();
                var factor = e.deltaY > 0 ? 1.1 : 0.9;
                zoom(factor);
            }, { passive: false });

            // Pan with mouse drag
            _svgEl.addEventListener('mousedown', function (e) {
                _isPanning = true;
                _panStart = { x: e.clientX, y: e.clientY, vbx: _viewBox.x, vby: _viewBox.y };
                _svgEl.style.cursor = 'grabbing';
            });

            _svgEl.addEventListener('mousemove', function (e) {
                if (!_isPanning) { return; }
                var dx = (e.clientX - _panStart.x) * (_viewBox.w / _svgEl.clientWidth);
                var dy = (e.clientY - _panStart.y) * (_viewBox.h / _svgEl.clientHeight);
                _viewBox.x = _panStart.vbx - dx;
                _viewBox.y = _panStart.vby - dy;
                updateViewBox();
            });

            _svgEl.addEventListener('mouseup', function () {
                _isPanning = false;
                _svgEl.style.cursor = 'grab';
            });

            _svgEl.addEventListener('mouseleave', function () {
                _isPanning = false;
                _svgEl.style.cursor = 'grab';
            });

            _svgEl.style.cursor = 'grab';
        }
    }

    var _traceLayout = null;

    function zoom(factor) {
        var cx = _viewBox.x + _viewBox.w / 2;
        var cy = _viewBox.y + _viewBox.h / 2;

        _viewBox.w *= factor;
        _viewBox.h *= factor;
        _viewBox.x = cx - _viewBox.w / 2;
        _viewBox.y = cy - _viewBox.h / 2;

        updateViewBox();
    }

    function updateViewBox() {
        if (_svgEl) {
            _svgEl.setAttribute('viewBox', _viewBox.x + ' ' + _viewBox.y + ' ' + _viewBox.w + ' ' + _viewBox.h);
        }
    }

    /* ---- Override render to save layout ---- */

    var _originalRender = render;

    render = function (traceData) {
        if (traceData && traceData.steps) {
            var maxNodes = Math.min(traceData.steps.length, 100);
            _traceLayout = computeLayout(traceData.steps.slice(0, maxNodes));
        }
        _originalRender(traceData);
    };

    /* ---- Public API ---- */

    return {
        init: init,
        render: render
    };

})();
