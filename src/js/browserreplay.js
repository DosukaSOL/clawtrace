/**
 * Clawtrace — Browser Session Replay
 * ============================================================
 * Replays OpenClaw browser tool actions from traces:
 *   browser.navigate, browser.snapshot, browser.click,
 *   browser.type, browser.scroll, etc.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.BrowserReplay = (function () {

    var S = Clawtrace.Sanitizer;
    var _container = null;

    var BROWSER_OPS = [
        { pattern: /browser\.?navigate|browser.*url|goto|open\s+url/i, type: 'navigate', label: 'Navigate', icon: '\u{1F310}' },
        { pattern: /browser\.?snapshot|screenshot|page\s+capture/i, type: 'snapshot', label: 'Snapshot', icon: '\u{1F4F7}' },
        { pattern: /browser\.?click|click\s+(?:on|element)/i, type: 'click', label: 'Click', icon: '\u{1F5B1}' },
        { pattern: /browser\.?type|type\s+(?:text|into)|fill\s+(?:in|field)/i, type: 'type', label: 'Type', icon: '\u2328' },
        { pattern: /browser\.?scroll|scroll\s+(?:down|up|to)/i, type: 'scroll', label: 'Scroll', icon: '\u2195' },
        { pattern: /browser\.?upload|upload\s+file/i, type: 'upload', label: 'Upload', icon: '\u{1F4CE}' },
        { pattern: /browser\.?close|close\s+(?:tab|browser)/i, type: 'close', label: 'Close', icon: '\u2716' },
        { pattern: /browser/i, type: 'generic', label: 'Browser', icon: '\u{1F310}' }
    ];

    function init(container) { _container = container; }

    function render(traceData) {
        if (!_container || !traceData) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        var session = analyzeBrowser(traceData);
        renderSummary(session);
        renderActionSequence(session);
        renderURLHistory(session);
    }

    function analyzeBrowser(traceData) {
        var actions = [];
        var urls = [];

        for (var i = 0; i < traceData.steps.length; i++) {
            var step = traceData.steps[i];
            var content = step.content || '';

            for (var p = 0; p < BROWSER_OPS.length; p++) {
                if (BROWSER_OPS[p].pattern.test(content)) {
                    var action = {
                        step: i,
                        type: BROWSER_OPS[p].type,
                        label: BROWSER_OPS[p].label,
                        icon: BROWSER_OPS[p].icon,
                        content: content.substring(0, 400),
                        isError: step.type === 'error'
                    };

                    // Extract URL if navigate
                    if (action.type === 'navigate') {
                        var urlMatch = content.match(/(?:url|href|navigate|goto)\s*[:=]?\s*["']?(https?:\/\/[^\s"']+)/i);
                        if (urlMatch) {
                            action.url = urlMatch[1];
                            urls.push(urlMatch[1]);
                        }
                    }

                    actions.push(action);
                    break;
                }
            }
        }

        return {
            actions: actions,
            urls: urls,
            hasBrowser: actions.length > 0
        };
    }

    function renderSummary(session) {
        var section = S.createElement('div', { 'class': 'br2-summary' });
        var title = S.createElement('h3', { 'class': 'br2-section-title' }, 'Browser Activity');
        section.appendChild(title);

        if (!session.hasBrowser) {
            section.appendChild(S.createElement('div', { 'class': 'br2-empty' },
                'No browser tool actions detected. OpenClaw uses a dedicated Chromium instance with CDP control. ' +
                'Browser actions include navigate, snapshot, click, type, scroll, and upload. ' +
                'Load a trace that uses the browser tool to see the session replay.'));
            _container.appendChild(section);
            return;
        }

        var typeCounts = {};
        for (var i = 0; i < session.actions.length; i++) {
            typeCounts[session.actions[i].type] = (typeCounts[session.actions[i].type] || 0) + 1;
        }

        var grid = S.createElement('div', { 'class': 'br2-stat-grid' });
        var stats = [
            { label: 'Total Actions', value: String(session.actions.length) },
            { label: 'Navigations', value: String(typeCounts['navigate'] || 0) },
            { label: 'Snapshots', value: String(typeCounts['snapshot'] || 0) },
            { label: 'Interactions', value: String((typeCounts['click'] || 0) + (typeCounts['type'] || 0)) }
        ];

        for (var s = 0; s < stats.length; s++) {
            var card = S.createElement('div', { 'class': 'br2-stat-card' });
            card.appendChild(S.createElement('div', { 'class': 'br2-stat-value' }, stats[s].value));
            card.appendChild(S.createElement('div', { 'class': 'br2-stat-label' }, stats[s].label));
            grid.appendChild(card);
        }
        section.appendChild(grid);
        _container.appendChild(section);
    }

    function renderActionSequence(session) {
        if (session.actions.length === 0) { return; }

        var section = S.createElement('div', { 'class': 'br2-sequence' });
        var title = S.createElement('h3', { 'class': 'br2-section-title' }, 'Action Sequence');
        section.appendChild(title);

        for (var i = 0; i < session.actions.length; i++) {
            var action = session.actions[i];
            var item = S.createElement('div', { 'class': 'br2-action' + (action.isError ? ' br2-error' : '') });
            var header = S.createElement('div', { 'class': 'br2-action-header' });
            header.appendChild(S.createElement('span', { 'class': 'br2-action-icon' }, action.icon));
            header.appendChild(S.createElement('span', { 'class': 'br2-action-label' }, action.label));
            header.appendChild(S.createElement('span', { 'class': 'br2-action-step' }, 'Step ' + (action.step + 1)));
            if (action.url) {
                header.appendChild(S.createElement('span', { 'class': 'br2-action-url' }, action.url));
            }
            item.appendChild(header);

            var preview = S.createElement('div', { 'class': 'br2-action-preview' },
                action.content.substring(0, 200));
            item.appendChild(preview);
            section.appendChild(item);
        }

        _container.appendChild(section);
    }

    function renderURLHistory(session) {
        if (session.urls.length === 0) { return; }

        var section = S.createElement('div', { 'class': 'br2-urls' });
        var title = S.createElement('h3', { 'class': 'br2-section-title' }, 'URL History');
        section.appendChild(title);

        for (var i = 0; i < session.urls.length; i++) {
            var item = S.createElement('div', { 'class': 'br2-url-item' });
            item.appendChild(S.createElement('span', { 'class': 'br2-url-num' }, String(i + 1)));
            item.appendChild(S.createElement('span', { 'class': 'br2-url-text' }, session.urls[i]));
            section.appendChild(item);
        }

        _container.appendChild(section);
    }

    return { init: init, render: render };
})();
