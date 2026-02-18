/**
 * Clawtrace — Multi-Channel Trace Diff
 * ============================================================
 * Compares how an OpenClaw agent responds across different
 * messaging channels (WhatsApp, Telegram, Slack, Discord, etc.)
 *   - Detects channel-specific formatting
 *   - Compares response chunking across channels
 *   - Shows media handling differences
 *   - Message length analysis per channel
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.ChannelDiff = (function () {

    var S = Clawtrace.Sanitizer;
    var _container = null;

    var CHANNELS = [
        { id: 'whatsapp', label: 'WhatsApp', color: '#25D366', maxMsg: 65536 },
        { id: 'telegram', label: 'Telegram', color: '#0088cc', maxMsg: 4096 },
        { id: 'slack', label: 'Slack', color: '#4A154B', maxMsg: 40000 },
        { id: 'discord', label: 'Discord', color: '#5865F2', maxMsg: 2000 },
        { id: 'signal', label: 'Signal', color: '#3A76F0', maxMsg: 64000 },
        { id: 'imessage', label: 'iMessage', color: '#34C759', maxMsg: 20000 },
        { id: 'bluebubbles', label: 'BlueBubbles', color: '#34C759', maxMsg: 20000 },
        { id: 'teams', label: 'MS Teams', color: '#6264A7', maxMsg: 28000 },
        { id: 'msteams', label: 'MS Teams', color: '#6264A7', maxMsg: 28000 },
        { id: 'googlechat', label: 'Google Chat', color: '#00AC47', maxMsg: 28000 },
        { id: 'matrix', label: 'Matrix', color: '#0DBD8B', maxMsg: 65536 },
        { id: 'webchat', label: 'WebChat', color: '#FF4500', maxMsg: 100000 },
        { id: 'zalo', label: 'Zalo', color: '#0068FF', maxMsg: 5000 }
    ];

    function init(container) { _container = container; }

    function render(traceData) {
        if (!_container || !traceData) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        var analysis = analyzeChannels(traceData);
        renderChannelDetection(analysis);
        renderChunkingAnalysis(analysis, traceData);
        renderFormattingIssues(analysis, traceData);
        renderChannelMatrix(traceData);
    }

    function analyzeChannels(traceData) {
        var detected = {};
        var allText = '';

        for (var i = 0; i < traceData.steps.length; i++) {
            var step = traceData.steps[i];
            var content = (step.content || '') + ' ' + (step.raw || '');
            var meta = step.metadata || {};
            allText += content + ' ';

            if (meta.channel) {
                detected[meta.channel.toLowerCase()] = true;
            }
        }

        // Detect channels from content mentions
        for (var c = 0; c < CHANNELS.length; c++) {
            if (allText.toLowerCase().indexOf(CHANNELS[c].id) > -1) {
                detected[CHANNELS[c].id] = true;
            }
        }

        var channelList = [];
        for (var ch in detected) {
            if (detected.hasOwnProperty(ch)) {
                var info = findChannel(ch);
                if (info) { channelList.push(info); }
            }
        }

        return { detected: channelList, allText: allText };
    }

    function findChannel(id) {
        for (var i = 0; i < CHANNELS.length; i++) {
            if (CHANNELS[i].id === id) { return CHANNELS[i]; }
        }
        return { id: id, label: id, color: '#8B949E', maxMsg: 4096 };
    }

    function renderChannelDetection(analysis) {
        var section = S.createElement('div', { 'class': 'cd-detection' });
        var title = S.createElement('h3', { 'class': 'cd-section-title' }, 'Channels Detected');
        section.appendChild(title);

        if (analysis.detected.length === 0) {
            section.appendChild(S.createElement('div', { 'class': 'cd-info' },
                'No specific channels detected in this trace. OpenClaw supports 16+ channels. ' +
                'Load a multi-channel trace to see channel-specific analysis.'));
            _container.appendChild(section);
            return;
        }

        var tags = S.createElement('div', { 'class': 'cd-channel-tags' });
        for (var i = 0; i < analysis.detected.length; i++) {
            var ch = analysis.detected[i];
            var tag = S.createElement('span', { 'class': 'cd-channel-tag' }, ch.label);
            tag.style.borderColor = ch.color;
            tag.style.color = ch.color;
            tags.appendChild(tag);
        }
        section.appendChild(tags);
        _container.appendChild(section);
    }

    function renderChunkingAnalysis(analysis, traceData) {
        var section = S.createElement('div', { 'class': 'cd-chunking' });
        var title = S.createElement('h3', { 'class': 'cd-section-title' }, 'Message Chunking Analysis');
        section.appendChild(title);

        var desc = S.createElement('p', { 'class': 'cd-desc' },
            'OpenClaw automatically chunks responses for channels with message length limits. ' +
            'This analysis shows which responses would need chunking per channel.');
        section.appendChild(desc);

        // Analyze assistant responses
        var responses = [];
        for (var i = 0; i < traceData.steps.length; i++) {
            if (traceData.steps[i].type === 'assistant') {
                responses.push({
                    index: i,
                    length: (traceData.steps[i].content || '').length
                });
            }
        }

        if (responses.length === 0) {
            section.appendChild(S.createElement('p', { 'class': 'cd-empty' }, 'No assistant responses to analyze.'));
            _container.appendChild(section);
            return;
        }

        var table = S.createElement('div', { 'class': 'cd-chunk-table' });

        // Header
        var header = S.createElement('div', { 'class': 'cd-chunk-header' });
        header.appendChild(S.createElement('div', { 'class': 'cd-chunk-cell cd-cell-channel' }, 'Channel'));
        header.appendChild(S.createElement('div', { 'class': 'cd-chunk-cell' }, 'Max Length'));
        header.appendChild(S.createElement('div', { 'class': 'cd-chunk-cell' }, 'Would Chunk'));
        header.appendChild(S.createElement('div', { 'class': 'cd-chunk-cell' }, 'Max Chunks'));
        table.appendChild(header);

        var channelList = analysis.detected.length > 0 ? analysis.detected : CHANNELS.slice(0, 8);

        for (var c = 0; c < channelList.length; c++) {
            var ch = channelList[c];
            var wouldChunk = 0;
            var maxChunks = 1;

            for (var r = 0; r < responses.length; r++) {
                if (responses[r].length > ch.maxMsg) {
                    wouldChunk++;
                    var chunks = Math.ceil(responses[r].length / ch.maxMsg);
                    if (chunks > maxChunks) { maxChunks = chunks; }
                }
            }

            var row = S.createElement('div', { 'class': 'cd-chunk-row' });
            var chCell = S.createElement('div', { 'class': 'cd-chunk-cell cd-cell-channel' }, ch.label);
            chCell.style.color = ch.color;
            row.appendChild(chCell);
            row.appendChild(S.createElement('div', { 'class': 'cd-chunk-cell' }, ch.maxMsg.toLocaleString()));
            row.appendChild(S.createElement('div', {
                'class': 'cd-chunk-cell' + (wouldChunk > 0 ? ' cd-chunk-warn' : '')
            }, wouldChunk + ' / ' + responses.length));
            row.appendChild(S.createElement('div', { 'class': 'cd-chunk-cell' }, String(maxChunks)));
            table.appendChild(row);
        }

        section.appendChild(table);
        _container.appendChild(section);
    }

    function renderFormattingIssues(analysis, traceData) {
        var section = S.createElement('div', { 'class': 'cd-formatting' });
        var title = S.createElement('h3', { 'class': 'cd-section-title' }, 'Formatting Compatibility');
        section.appendChild(title);

        var issues = [];

        for (var i = 0; i < traceData.steps.length; i++) {
            var step = traceData.steps[i];
            if (step.type !== 'assistant') { continue; }
            var content = step.content || '';

            // Check for Markdown tables (not supported in WhatsApp/Telegram)
            if (/\|[\s\-]+\|/.test(content)) {
                issues.push({ step: i, issue: 'Markdown table detected', channels: 'WhatsApp, Telegram (no native table support)' });
            }
            // Check for code blocks
            if (/```[\s\S]*```/.test(content)) {
                issues.push({ step: i, issue: 'Code block detected', channels: 'WhatsApp (limited formatting), SMS' });
            }
            // Check for HTML
            if (/<[a-z][\s\S]*>/i.test(content)) {
                issues.push({ step: i, issue: 'HTML tags detected', channels: 'Most channels strip HTML' });
            }
            // Check for long single lines
            if (content.split('\n').some(function (line) { return line.length > 500; })) {
                issues.push({ step: i, issue: 'Very long line (>500 chars)', channels: 'Mobile channels (readability)' });
            }
        }

        if (issues.length === 0) {
            section.appendChild(S.createElement('div', { 'class': 'cd-good' },
                'No channel formatting issues detected. Responses appear compatible across all channels.'));
        } else {
            for (var j = 0; j < Math.min(issues.length, 15); j++) {
                var item = S.createElement('div', { 'class': 'cd-issue-item' });
                item.appendChild(S.createElement('span', { 'class': 'cd-issue-badge' }, 'Step ' + (issues[j].step + 1)));
                item.appendChild(S.createElement('span', { 'class': 'cd-issue-text' }, issues[j].issue));
                item.appendChild(S.createElement('span', { 'class': 'cd-issue-channels' }, issues[j].channels));
                section.appendChild(item);
            }
        }

        _container.appendChild(section);
    }

    function renderChannelMatrix(traceData) {
        var section = S.createElement('div', { 'class': 'cd-matrix' });
        var title = S.createElement('h3', { 'class': 'cd-section-title' }, 'Response Length Distribution');
        section.appendChild(title);

        var lengths = [];
        for (var i = 0; i < traceData.steps.length; i++) {
            if (traceData.steps[i].type === 'assistant') {
                lengths.push((traceData.steps[i].content || '').length);
            }
        }

        if (lengths.length === 0) {
            section.appendChild(S.createElement('p', { 'class': 'cd-empty' }, 'No responses to analyze.'));
            _container.appendChild(section);
            return;
        }

        var avg = Math.round(lengths.reduce(function (a, b) { return a + b; }, 0) / lengths.length);
        var max = Math.max.apply(null, lengths);
        var min = Math.min.apply(null, lengths);

        var stats = S.createElement('div', { 'class': 'cd-length-stats' });
        stats.appendChild(createStat('Min Length', min.toLocaleString() + ' chars'));
        stats.appendChild(createStat('Avg Length', avg.toLocaleString() + ' chars'));
        stats.appendChild(createStat('Max Length', max.toLocaleString() + ' chars'));
        stats.appendChild(createStat('Responses', String(lengths.length)));
        section.appendChild(stats);

        _container.appendChild(section);
    }

    function createStat(label, value) {
        var el = S.createElement('div', { 'class': 'cd-stat' });
        el.appendChild(S.createElement('div', { 'class': 'cd-stat-value' }, value));
        el.appendChild(S.createElement('div', { 'class': 'cd-stat-label' }, label));
        return el;
    }

    return { init: init, render: render };
})();
