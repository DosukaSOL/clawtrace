/**
 * Clawtrace — Node Activity Dashboard
 * ============================================================
 * Visualizes OpenClaw node activity across platforms:
 *   macOS, iOS, Android — device references, location, screen.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.NodeActivity = (function () {

    var S = Clawtrace.Sanitizer;
    var _container = null;

    var PLATFORMS = [
        { pattern: /macOS|mac\s*os|darwin/i, name: 'macOS', icon: '\u{1F4BB}' },
        { pattern: /iOS|iphone|ipad/i, name: 'iOS', icon: '\u{1F4F1}' },
        { pattern: /android/i, name: 'Android', icon: '\u{1F4F1}' },
        { pattern: /linux/i, name: 'Linux', icon: '\u{1F5A5}' },
        { pattern: /windows/i, name: 'Windows', icon: '\u{1F5A5}' }
    ];

    var NODE_FEATURES = [
        { pattern: /location\.get|gps|coordinates/i, type: 'location', label: 'Location', icon: '\u{1F4CD}' },
        { pattern: /camera\b|photo|capture/i, type: 'camera', label: 'Camera', icon: '\u{1F4F7}' },
        { pattern: /screen\.record|screencast/i, type: 'screen', label: 'Screen Recording', icon: '\u{1F3AC}' },
        { pattern: /system\.run|system\.notify/i, type: 'system', label: 'System Action', icon: '\u2699' },
        { pattern: /node\.invoke|remote\s*node/i, type: 'node', label: 'Node Invoke', icon: '\u{1F517}' },
        { pattern: /notification|notify/i, type: 'notify', label: 'Notification', icon: '\u{1F514}' }
    ];

    function init(container) { _container = container; }

    function render(traceData) {
        if (!_container || !traceData) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        var analysis = analyzeNodes(traceData);
        renderSummary(analysis);
        renderNodeMap(analysis);
        renderFeatureLog(analysis);
    }

    function analyzeNodes(traceData) {
        var detectedPlatforms = {};
        var features = [];
        var events = [];

        for (var i = 0; i < traceData.steps.length; i++) {
            var content = (traceData.steps[i].content || '');
            var lower = content.toLowerCase();

            // Detect platforms
            for (var p = 0; p < PLATFORMS.length; p++) {
                if (PLATFORMS[p].pattern.test(content)) {
                    detectedPlatforms[PLATFORMS[p].name] = PLATFORMS[p];
                }
            }

            // Detect node features
            for (var f = 0; f < NODE_FEATURES.length; f++) {
                if (NODE_FEATURES[f].pattern.test(content)) {
                    features.push({
                        step: i,
                        type: NODE_FEATURES[f].type,
                        label: NODE_FEATURES[f].label,
                        icon: NODE_FEATURES[f].icon,
                        content: content.substring(0, 200)
                    });
                }
            }
        }

        var platformList = [];
        for (var name in detectedPlatforms) {
            if (detectedPlatforms.hasOwnProperty(name)) {
                platformList.push(detectedPlatforms[name]);
            }
        }

        return {
            platforms: platformList,
            features: features,
            hasNodeActivity: platformList.length > 0 || features.length > 0
        };
    }

    function renderSummary(analysis) {
        var section = S.createElement('div', { 'class': 'na-summary' });
        var title = S.createElement('h3', { 'class': 'na-section-title' }, 'Node Activity');
        section.appendChild(title);

        if (!analysis.hasNodeActivity) {
            section.appendChild(S.createElement('div', { 'class': 'na-empty' },
                'No node-specific activity detected in this trace. OpenClaw runs on macOS, iOS, and Android devices. ' +
                'Node features include location.get, camera, screen.record, system.run, system.notify, and node.invoke ' +
                'for cross-device orchestration. Load a trace from a device session to see node activity.'));
            _container.appendChild(section);
            return;
        }

        var grid = S.createElement('div', { 'class': 'na-stat-grid' });
        var stats = [
            { label: 'Platforms', value: String(analysis.platforms.length) },
            { label: 'Node Features', value: String(analysis.features.length) }
        ];

        for (var i = 0; i < stats.length; i++) {
            var card = S.createElement('div', { 'class': 'na-stat-card' });
            card.appendChild(S.createElement('div', { 'class': 'na-stat-value' }, stats[i].value));
            card.appendChild(S.createElement('div', { 'class': 'na-stat-label' }, stats[i].label));
            grid.appendChild(card);
        }
        section.appendChild(grid);
        _container.appendChild(section);
    }

    function renderNodeMap(analysis) {
        if (analysis.platforms.length === 0) { return; }

        var section = S.createElement('div', { 'class': 'na-map' });
        var title = S.createElement('h3', { 'class': 'na-section-title' }, 'Detected Platforms');
        section.appendChild(title);

        var nodeGrid = S.createElement('div', { 'class': 'na-node-grid' });
        for (var i = 0; i < analysis.platforms.length; i++) {
            var plat = analysis.platforms[i];
            var node = S.createElement('div', { 'class': 'na-node-card' });
            node.appendChild(S.createElement('div', { 'class': 'na-node-icon' }, plat.icon));
            node.appendChild(S.createElement('div', { 'class': 'na-node-name' }, plat.name));
            nodeGrid.appendChild(node);
        }
        section.appendChild(nodeGrid);

        // Show node connections if multiple platforms
        if (analysis.platforms.length > 1) {
            var connNote = S.createElement('div', { 'class': 'na-conn-note' },
                'Multiple platforms detected. OpenClaw\'s Gateway (ws://127.0.0.1:18789) syncs sessions across all connected nodes.');
            section.appendChild(connNote);
        }

        _container.appendChild(section);
    }

    function renderFeatureLog(analysis) {
        if (analysis.features.length === 0) { return; }

        var section = S.createElement('div', { 'class': 'na-features' });
        var title = S.createElement('h3', { 'class': 'na-section-title' }, 'Device Feature Usage');
        section.appendChild(title);

        for (var i = 0; i < analysis.features.length; i++) {
            var feat = analysis.features[i];
            var item = S.createElement('div', { 'class': 'na-feat-item' });
            var header = S.createElement('div', { 'class': 'na-feat-header' });
            header.appendChild(S.createElement('span', { 'class': 'na-feat-icon' }, feat.icon));
            header.appendChild(S.createElement('span', { 'class': 'na-feat-label' }, feat.label));
            header.appendChild(S.createElement('span', { 'class': 'na-feat-step' }, 'Step ' + (feat.step + 1)));
            item.appendChild(header);
            item.appendChild(S.createElement('div', { 'class': 'na-feat-preview' }, feat.content.substring(0, 150)));
            section.appendChild(item);
        }

        _container.appendChild(section);
    }

    return { init: init, render: render };
})();
