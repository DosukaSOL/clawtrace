/**
 * Clawtrace — Chat Command Analyzer
 * ============================================================
 * Detects and analyzes OpenClaw chat commands in traces:
 *   /status, /new, /compact, /think, /verbose, /usage,
 *   /activation, /model, /help, etc.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.ChatCmd = (function () {

    var S = Clawtrace.Sanitizer;
    var _container = null;

    var COMMANDS = [
        { pattern: /\/status/i, name: '/status', desc: 'Show current agent status, model, and session info' },
        { pattern: /\/new/i, name: '/new', desc: 'Start a new session, clearing conversation history' },
        { pattern: /\/compact/i, name: '/compact', desc: 'Prune context window to reduce token usage' },
        { pattern: /\/think\b/i, name: '/think', desc: 'Set thinking level for extended reasoning' },
        { pattern: /\/verbose/i, name: '/verbose', desc: 'Toggle verbose output mode' },
        { pattern: /\/usage/i, name: '/usage', desc: 'Show token and cost usage for current session' },
        { pattern: /\/activation/i, name: '/activation', desc: 'Configure group chat activation (mention/always/auto)' },
        { pattern: /\/model\b/i, name: '/model', desc: 'Switch the active model mid-session' },
        { pattern: /\/help/i, name: '/help', desc: 'Show available commands and their descriptions' },
        { pattern: /\/doctor/i, name: '/doctor', desc: 'Run self-diagnostics for troubleshooting' },
        { pattern: /\/send\b/i, name: '/send', desc: 'Send message to another agent session' },
        { pattern: /\/install/i, name: '/install', desc: 'Install a skill from ClawHub' },
        { pattern: /\/skills?/i, name: '/skills', desc: 'List available skills and their status' }
    ];

    function init(container) { _container = container; }

    function render(traceData) {
        if (!_container || !traceData) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        var analysis = analyzeCommands(traceData);
        renderSummary(analysis);
        renderCommandList(analysis);
        renderCommandUsage(analysis);
    }

    function analyzeCommands(traceData) {
        var found = [];
        var commandCounts = {};

        for (var i = 0; i < traceData.steps.length; i++) {
            var step = traceData.steps[i];
            if (step.type !== 'user' && step.type !== 'system') { continue; }
            var content = step.content || '';

            for (var c = 0; c < COMMANDS.length; c++) {
                if (COMMANDS[c].pattern.test(content)) {
                    var name = COMMANDS[c].name;
                    commandCounts[name] = (commandCounts[name] || 0) + 1;
                    found.push({
                        step: i,
                        command: name,
                        desc: COMMANDS[c].desc,
                        context: content.substring(0, 200)
                    });
                }
            }
        }

        return {
            found: found,
            commandCounts: commandCounts,
            uniqueCommands: Object.keys(commandCounts).length,
            hasCommands: found.length > 0
        };
    }

    function renderSummary(analysis) {
        var section = S.createElement('div', { 'class': 'cc2-summary' });
        var title = S.createElement('h3', { 'class': 'cc2-section-title' }, 'Chat Command Analysis');
        section.appendChild(title);

        if (!analysis.hasCommands) {
            section.appendChild(S.createElement('div', { 'class': 'cc2-empty' },
                'No chat commands detected in this trace. OpenClaw supports commands like /status, /new, /compact, ' +
                '/think, /verbose, /usage, /activation, /model, /help, /doctor and more. Load a trace containing ' +
                'user commands to see the analysis.'));
            _container.appendChild(section);
            return;
        }

        var grid = S.createElement('div', { 'class': 'cc2-stat-grid' });
        var stats = [
            { label: 'Commands Used', value: String(analysis.found.length) },
            { label: 'Unique Commands', value: String(analysis.uniqueCommands) }
        ];

        for (var i = 0; i < stats.length; i++) {
            var card = S.createElement('div', { 'class': 'cc2-stat-card' });
            card.appendChild(S.createElement('div', { 'class': 'cc2-stat-value' }, stats[i].value));
            card.appendChild(S.createElement('div', { 'class': 'cc2-stat-label' }, stats[i].label));
            grid.appendChild(card);
        }
        section.appendChild(grid);
        _container.appendChild(section);
    }

    function renderCommandList(analysis) {
        if (!analysis.hasCommands) { return; }

        var section = S.createElement('div', { 'class': 'cc2-list' });
        var title = S.createElement('h3', { 'class': 'cc2-section-title' }, 'Commands Detected');
        section.appendChild(title);

        for (var i = 0; i < analysis.found.length; i++) {
            var cmd = analysis.found[i];
            var item = S.createElement('div', { 'class': 'cc2-cmd-item' });
            var header = S.createElement('div', { 'class': 'cc2-cmd-header' });
            header.appendChild(S.createElement('span', { 'class': 'cc2-cmd-name' }, cmd.command));
            header.appendChild(S.createElement('span', { 'class': 'cc2-cmd-step' }, 'Step ' + (cmd.step + 1)));
            item.appendChild(header);
            item.appendChild(S.createElement('div', { 'class': 'cc2-cmd-desc' }, cmd.desc));
            if (cmd.context.length > 0) {
                item.appendChild(S.createElement('div', { 'class': 'cc2-cmd-context' }, cmd.context.substring(0, 120)));
            }
            section.appendChild(item);
        }

        _container.appendChild(section);
    }

    function renderCommandUsage(analysis) {
        if (!analysis.hasCommands) { return; }

        var section = S.createElement('div', { 'class': 'cc2-usage' });
        var title = S.createElement('h3', { 'class': 'cc2-section-title' }, 'Command Frequency');
        section.appendChild(title);

        var maxCount = 0;
        for (var key in analysis.commandCounts) {
            if (analysis.commandCounts.hasOwnProperty(key) && analysis.commandCounts[key] > maxCount) {
                maxCount = analysis.commandCounts[key];
            }
        }

        for (var name in analysis.commandCounts) {
            if (!analysis.commandCounts.hasOwnProperty(name)) { continue; }
            var count = analysis.commandCounts[name];
            var row = S.createElement('div', { 'class': 'cc2-freq-row' });
            row.appendChild(S.createElement('span', { 'class': 'cc2-freq-name' }, name));
            var bar = S.createElement('div', { 'class': 'cc2-freq-bar' });
            var fill = S.createElement('div', { 'class': 'cc2-freq-fill' });
            fill.style.width = (maxCount > 0 ? (count / maxCount * 100) : 0) + '%';
            bar.appendChild(fill);
            row.appendChild(bar);
            row.appendChild(S.createElement('span', { 'class': 'cc2-freq-count' }, String(count)));
            section.appendChild(row);
        }

        _container.appendChild(section);
    }

    return { init: init, render: render };
})();
