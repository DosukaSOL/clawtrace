/**
 * Clawtrace — Tool Call Profiler
 * ============================================================
 * Deep analysis of every OpenClaw tool call in a trace:
 *   - bash, browser, read, write, edit, canvas.*, cron.*,
 *     sessions_send/list/history, node.invoke, screen.record,
 *     camera.*, location.get, skills
 *   - Success/fail rates, frequency heatmaps
 *   - Tool chains and dependency patterns
 *   - Timing estimates
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.ToolProfiler = (function () {

    var S = Clawtrace.Sanitizer;
    var _container = null;

    /* ---- OpenClaw Tool Categories ---- */
    var TOOL_CATEGORIES = {
        'bash': 'execution',
        'process': 'execution',
        'read': 'filesystem',
        'write': 'filesystem',
        'edit': 'filesystem',
        'browser': 'browser',
        'browser.navigate': 'browser',
        'browser.snapshot': 'browser',
        'browser.click': 'browser',
        'browser.type': 'browser',
        'canvas.push': 'canvas',
        'canvas.reset': 'canvas',
        'canvas.eval': 'canvas',
        'canvas.snapshot': 'canvas',
        'cron.create': 'automation',
        'cron.list': 'automation',
        'cron.delete': 'automation',
        'cron.update': 'automation',
        'sessions_send': 'multi-agent',
        'sessions_list': 'multi-agent',
        'sessions_history': 'multi-agent',
        'sessions_spawn': 'multi-agent',
        'node.invoke': 'device',
        'system.run': 'device',
        'system.notify': 'device',
        'camera.snap': 'device',
        'camera.clip': 'device',
        'screen.record': 'device',
        'location.get': 'device',
        'discord': 'channel-action',
        'slack': 'channel-action',
        'gateway': 'gateway',
        'skills': 'skills',
        'search': 'search',
        'code_search': 'search',
        'web_search': 'search'
    };

    var CATEGORY_COLORS = {
        'execution': '#F97316',
        'filesystem': '#22c55e',
        'browser': '#3b82f6',
        'canvas': '#a78bfa',
        'automation': '#f59e0b',
        'multi-agent': '#FF4500',
        'device': '#06b6d4',
        'channel-action': '#ec4899',
        'gateway': '#8B949E',
        'skills': '#10b981',
        'search': '#818cf8',
        'unknown': '#64748b'
    };

    function init(container) {
        _container = container;
    }

    function render(traceData) {
        if (!_container || !traceData) { return; }

        while (_container.firstChild) {
            _container.removeChild(_container.firstChild);
        }

        var profile = profileTools(traceData);
        renderSummaryStats(profile);
        renderCategoryBreakdown(profile);
        renderToolTable(profile);
        renderToolChains(profile);
        renderFrequencyMap(profile);
    }

    /* ---- Profiling ---- */

    function profileTools(traceData) {
        var tools = {};
        var chains = [];
        var currentChain = [];
        var totalCalls = 0;
        var errors = 0;
        var categories = {};

        for (var i = 0; i < traceData.steps.length; i++) {
            var step = traceData.steps[i];

            if (step.type === 'tool_call') {
                var name = extractToolName(step.content || '');
                var isError = detectError(step, traceData.steps[i + 1]);

                if (!tools[name]) {
                    tools[name] = { name: name, calls: 0, errors: 0, category: categorize(name), positions: [] };
                }

                tools[name].calls++;
                tools[name].positions.push(i);
                if (isError) { tools[name].errors++; errors++; }
                totalCalls++;

                var cat = tools[name].category;
                categories[cat] = (categories[cat] || 0) + 1;

                currentChain.push(name);
            } else {
                if (currentChain.length > 1) {
                    chains.push(currentChain.slice());
                }
                currentChain = [];
            }
        }
        if (currentChain.length > 1) { chains.push(currentChain); }

        var toolList = [];
        for (var t in tools) {
            if (tools.hasOwnProperty(t)) { toolList.push(tools[t]); }
        }
        toolList.sort(function (a, b) { return b.calls - a.calls; });

        return {
            tools: toolList,
            totalCalls: totalCalls,
            errors: errors,
            categories: categories,
            chains: chains,
            stepCount: traceData.steps.length
        };
    }

    function extractToolName(content) {
        var match = content.match(/^(\w[\w.]*)\s*\(/);
        if (match) { return match[1]; }
        match = content.match(/^(?:tool|function|call|name):\s*["']?(\w[\w.]*)/i);
        if (match) { return match[1]; }
        match = content.match(/^(\w[\w.]*)/);
        if (match && match[1].length < 60) { return match[1]; }
        return 'unknown_tool';
    }

    function categorize(name) {
        var lower = name.toLowerCase();
        for (var key in TOOL_CATEGORIES) {
            if (TOOL_CATEGORIES.hasOwnProperty(key)) {
                if (lower === key || lower.indexOf(key) === 0) {
                    return TOOL_CATEGORIES[key];
                }
            }
        }
        return 'unknown';
    }

    function detectError(toolStep, nextStep) {
        if (!nextStep) { return false; }
        if (nextStep.type === 'error') { return true; }
        var content = (nextStep.content || '').toLowerCase();
        return content.indexOf('error') > -1 && content.indexOf('error') < 50;
    }

    /* ---- Rendering ---- */

    function renderSummaryStats(profile) {
        var section = S.createElement('div', { 'class': 'tp-summary' });
        var title = S.createElement('h3', { 'class': 'tp-section-title' }, 'Tool Call Summary');
        section.appendChild(title);

        var grid = S.createElement('div', { 'class': 'tp-stat-grid' });
        var stats = [
            { label: 'Total Tool Calls', value: String(profile.totalCalls) },
            { label: 'Unique Tools', value: String(profile.tools.length) },
            { label: 'Failed Calls', value: String(profile.errors) },
            { label: 'Success Rate', value: profile.totalCalls > 0 ? Math.round(((profile.totalCalls - profile.errors) / profile.totalCalls) * 100) + '%' : 'N/A' },
            { label: 'Tool Chains', value: String(profile.chains.length) },
            { label: 'Tool Density', value: profile.stepCount > 0 ? Math.round((profile.totalCalls / profile.stepCount) * 100) + '%' : '0%' }
        ];

        for (var i = 0; i < stats.length; i++) {
            var card = S.createElement('div', { 'class': 'tp-stat-card' });
            var val = S.createElement('div', { 'class': 'tp-stat-value' }, stats[i].value);
            var lbl = S.createElement('div', { 'class': 'tp-stat-label' }, stats[i].label);
            card.appendChild(val);
            card.appendChild(lbl);
            grid.appendChild(card);
        }
        section.appendChild(grid);
        _container.appendChild(section);
    }

    function renderCategoryBreakdown(profile) {
        var section = S.createElement('div', { 'class': 'tp-categories' });
        var title = S.createElement('h3', { 'class': 'tp-section-title' }, 'Category Breakdown');
        section.appendChild(title);

        var catList = [];
        for (var c in profile.categories) {
            if (profile.categories.hasOwnProperty(c)) {
                catList.push({ name: c, count: profile.categories[c] });
            }
        }
        catList.sort(function (a, b) { return b.count - a.count; });

        if (catList.length === 0) {
            section.appendChild(S.createElement('p', { 'class': 'tp-empty' }, 'No tool calls detected in this trace.'));
            _container.appendChild(section);
            return;
        }

        var barContainer = S.createElement('div', { 'class': 'tp-cat-bars' });
        for (var i = 0; i < catList.length; i++) {
            var row = S.createElement('div', { 'class': 'tp-cat-row' });
            var label = S.createElement('div', { 'class': 'tp-cat-label' }, catList[i].name);
            var barWrap = S.createElement('div', { 'class': 'tp-cat-bar-wrap' });
            var bar = S.createElement('div', { 'class': 'tp-cat-bar' });
            var pct = profile.totalCalls > 0 ? (catList[i].count / profile.totalCalls) * 100 : 0;
            bar.style.width = pct + '%';
            bar.style.backgroundColor = CATEGORY_COLORS[catList[i].name] || CATEGORY_COLORS['unknown'];
            barWrap.appendChild(bar);
            var count = S.createElement('div', { 'class': 'tp-cat-count' }, catList[i].count + ' (' + Math.round(pct) + '%)');
            row.appendChild(label);
            row.appendChild(barWrap);
            row.appendChild(count);
            barContainer.appendChild(row);
        }
        section.appendChild(barContainer);
        _container.appendChild(section);
    }

    function renderToolTable(profile) {
        var section = S.createElement('div', { 'class': 'tp-table-section' });
        var title = S.createElement('h3', { 'class': 'tp-section-title' }, 'Tool Details');
        section.appendChild(title);

        if (profile.tools.length === 0) {
            section.appendChild(S.createElement('p', { 'class': 'tp-empty' }, 'No tool calls found.'));
            _container.appendChild(section);
            return;
        }

        var table = S.createElement('div', { 'class': 'tp-table' });
        var header = S.createElement('div', { 'class': 'tp-table-header' });
        var cols = ['Tool Name', 'Category', 'Calls', 'Errors', 'Success Rate'];
        for (var h = 0; h < cols.length; h++) {
            header.appendChild(S.createElement('div', { 'class': 'tp-table-cell tp-header-cell' }, cols[h]));
        }
        table.appendChild(header);

        var limit = Math.min(profile.tools.length, 30);
        for (var i = 0; i < limit; i++) {
            var tool = profile.tools[i];
            var row = S.createElement('div', { 'class': 'tp-table-row' });
            row.appendChild(S.createElement('div', { 'class': 'tp-table-cell tp-tool-name' }, tool.name));
            var catCell = S.createElement('div', { 'class': 'tp-table-cell' });
            var catBadge = S.createElement('span', { 'class': 'tp-cat-badge' }, tool.category);
            catBadge.style.backgroundColor = CATEGORY_COLORS[tool.category] || CATEGORY_COLORS['unknown'];
            catCell.appendChild(catBadge);
            row.appendChild(catCell);
            row.appendChild(S.createElement('div', { 'class': 'tp-table-cell' }, String(tool.calls)));
            row.appendChild(S.createElement('div', { 'class': 'tp-table-cell' + (tool.errors > 0 ? ' tp-error-cell' : '') }, String(tool.errors)));
            var rate = tool.calls > 0 ? Math.round(((tool.calls - tool.errors) / tool.calls) * 100) : 100;
            row.appendChild(S.createElement('div', { 'class': 'tp-table-cell' }, rate + '%'));
            table.appendChild(row);
        }
        section.appendChild(table);
        _container.appendChild(section);
    }

    function renderToolChains(profile) {
        if (profile.chains.length === 0) { return; }

        var section = S.createElement('div', { 'class': 'tp-chains' });
        var title = S.createElement('h3', { 'class': 'tp-section-title' }, 'Tool Chains (Sequential Calls)');
        section.appendChild(title);

        var limit = Math.min(profile.chains.length, 10);
        for (var i = 0; i < limit; i++) {
            var chain = profile.chains[i];
            var chainEl = S.createElement('div', { 'class': 'tp-chain' });
            for (var j = 0; j < chain.length; j++) {
                if (j > 0) {
                    chainEl.appendChild(S.createElement('span', { 'class': 'tp-chain-arrow' }, '\u2192'));
                }
                var badge = S.createElement('span', { 'class': 'tp-chain-tool' }, chain[j]);
                var cat = categorize(chain[j]);
                badge.style.borderColor = CATEGORY_COLORS[cat] || CATEGORY_COLORS['unknown'];
                chainEl.appendChild(badge);
            }
            section.appendChild(chainEl);
        }
        _container.appendChild(section);
    }

    function renderFrequencyMap(profile) {
        if (profile.tools.length === 0) { return; }

        var section = S.createElement('div', { 'class': 'tp-frequency' });
        var title = S.createElement('h3', { 'class': 'tp-section-title' }, 'Call Frequency Map');
        section.appendChild(title);

        var SVG_NS = 'http://www.w3.org/2000/svg';
        var barHeight = 24;
        var barGap = 4;
        var labelWidth = 140;
        var maxBarWidth = 500;
        var limit = Math.min(profile.tools.length, 15);
        var svgHeight = limit * (barHeight + barGap) + 20;
        var svgWidth = labelWidth + maxBarWidth + 60;

        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + svgWidth + ' ' + svgHeight);
        svg.setAttribute('class', 'tp-freq-svg');

        var maxCalls = profile.tools[0].calls || 1;

        for (var i = 0; i < limit; i++) {
            var tool = profile.tools[i];
            var y = i * (barHeight + barGap);
            var barW = (tool.calls / maxCalls) * maxBarWidth;
            var color = CATEGORY_COLORS[tool.category] || CATEGORY_COLORS['unknown'];

            var rect = document.createElementNS(SVG_NS, 'rect');
            rect.setAttribute('x', String(labelWidth));
            rect.setAttribute('y', String(y));
            rect.setAttribute('width', String(Math.max(barW, 2)));
            rect.setAttribute('height', String(barHeight));
            rect.setAttribute('fill', color);
            rect.setAttribute('rx', '3');
            svg.appendChild(rect);

            var label = document.createElementNS(SVG_NS, 'text');
            label.setAttribute('x', String(labelWidth - 8));
            label.setAttribute('y', String(y + barHeight / 2 + 4));
            label.setAttribute('text-anchor', 'end');
            label.setAttribute('fill', '#e2e8f0');
            label.setAttribute('font-size', '11');
            label.textContent = tool.name.length > 18 ? tool.name.substring(0, 18) + '..' : tool.name;
            svg.appendChild(label);

            var countLabel = document.createElementNS(SVG_NS, 'text');
            countLabel.setAttribute('x', String(labelWidth + barW + 6));
            countLabel.setAttribute('y', String(y + barHeight / 2 + 4));
            countLabel.setAttribute('fill', '#8B949E');
            countLabel.setAttribute('font-size', '11');
            countLabel.textContent = String(tool.calls);
            svg.appendChild(countLabel);
        }
        section.appendChild(svg);
        _container.appendChild(section);
    }

    return {
        init: init,
        render: render
    };
})();
