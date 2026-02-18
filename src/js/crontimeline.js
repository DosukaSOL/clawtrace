/**
 * Clawtrace — Cron & Automation Timeline
 * ============================================================
 * Visual timeline of OpenClaw cron jobs, webhook triggers,
 * and Gmail Pub/Sub events detected in traces.
 *   - Parse cron.create/list/delete/update
 *   - Webhook triggers
 *   - Execution traces and failures
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.CronTimeline = (function () {

    var S = Clawtrace.Sanitizer;
    var _container = null;

    var AUTOMATION_PATTERNS = [
        { pattern: /cron\.create/i, type: 'cron-create', label: 'Cron Create' },
        { pattern: /cron\.list/i, type: 'cron-list', label: 'Cron List' },
        { pattern: /cron\.delete/i, type: 'cron-delete', label: 'Cron Delete' },
        { pattern: /cron\.update/i, type: 'cron-update', label: 'Cron Update' },
        { pattern: /webhook/i, type: 'webhook', label: 'Webhook' },
        { pattern: /gmail|email.*pub\s*sub/i, type: 'gmail', label: 'Gmail Trigger' },
        { pattern: /schedule|scheduled/i, type: 'scheduled', label: 'Scheduled' },
        { pattern: /wakeup|wake_up/i, type: 'wakeup', label: 'Wakeup' }
    ];

    function init(container) { _container = container; }

    function render(traceData) {
        if (!_container || !traceData) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        var automation = analyzeAutomation(traceData);
        renderSummary(automation);
        renderTimeline(automation);
        renderCronJobs(automation);
    }

    function analyzeAutomation(traceData) {
        var events = [];
        var cronJobs = [];

        for (var i = 0; i < traceData.steps.length; i++) {
            var step = traceData.steps[i];
            var content = (step.content || '').toLowerCase();
            var raw = step.content || '';

            for (var p = 0; p < AUTOMATION_PATTERNS.length; p++) {
                var pat = AUTOMATION_PATTERNS[p];
                if (pat.pattern.test(content)) {
                    var isError = (step.type === 'error') || content.indexOf('error') > -1;
                    events.push({
                        step: i,
                        type: pat.type,
                        label: pat.label,
                        isError: isError,
                        content: raw.substring(0, 300)
                    });

                    // Extract cron details
                    if (pat.type === 'cron-create') {
                        var schedMatch = raw.match(/(?:schedule|cron|expression)\s*[:=]\s*["']?([^\s"']+)/i);
                        var nameMatch = raw.match(/(?:name|label|id)\s*[:=]\s*["']?([^\s"']+)/i);
                        cronJobs.push({
                            name: nameMatch ? nameMatch[1] : 'cron-' + cronJobs.length,
                            schedule: schedMatch ? schedMatch[1] : 'unknown',
                            step: i,
                            action: 'create'
                        });
                    }
                    break;
                }
            }
        }

        return {
            events: events,
            cronJobs: cronJobs,
            hasAutomation: events.length > 0
        };
    }

    function renderSummary(automation) {
        var section = S.createElement('div', { 'class': 'ct-summary' });
        var title = S.createElement('h3', { 'class': 'ct-section-title' }, 'Automation Overview');
        section.appendChild(title);

        if (!automation.hasAutomation) {
            section.appendChild(S.createElement('div', { 'class': 'ct-empty' },
                'No automation events detected in this trace. OpenClaw supports cron jobs (cron.create/list/delete/update), ' +
                'webhooks, and Gmail Pub/Sub triggers. Load a trace that uses these tools to see the automation timeline.'));
            _container.appendChild(section);
            return;
        }

        var grid = S.createElement('div', { 'class': 'ct-stat-grid' });
        var typeCounts = {};
        for (var i = 0; i < automation.events.length; i++) {
            var t = automation.events[i].type;
            typeCounts[t] = (typeCounts[t] || 0) + 1;
        }

        var stats = [
            { label: 'Total Events', value: String(automation.events.length) },
            { label: 'Cron Operations', value: String((typeCounts['cron-create'] || 0) + (typeCounts['cron-update'] || 0) + (typeCounts['cron-delete'] || 0) + (typeCounts['cron-list'] || 0)) },
            { label: 'Webhooks', value: String(typeCounts['webhook'] || 0) },
            { label: 'Errors', value: String(automation.events.filter(function (e) { return e.isError; }).length) }
        ];

        for (var s = 0; s < stats.length; s++) {
            var card = S.createElement('div', { 'class': 'ct-stat-card' });
            card.appendChild(S.createElement('div', { 'class': 'ct-stat-value' }, stats[s].value));
            card.appendChild(S.createElement('div', { 'class': 'ct-stat-label' }, stats[s].label));
            grid.appendChild(card);
        }
        section.appendChild(grid);
        _container.appendChild(section);
    }

    function renderTimeline(automation) {
        if (!automation.hasAutomation) { return; }

        var section = S.createElement('div', { 'class': 'ct-timeline' });
        var title = S.createElement('h3', { 'class': 'ct-section-title' }, 'Event Timeline');
        section.appendChild(title);

        var TYPE_COLORS = {
            'cron-create': '#22c55e', 'cron-update': '#f59e0b', 'cron-delete': '#ef4444',
            'cron-list': '#3b82f6', 'webhook': '#a78bfa', 'gmail': '#FF4500',
            'scheduled': '#06b6d4', 'wakeup': '#ec4899'
        };

        for (var i = 0; i < automation.events.length; i++) {
            var ev = automation.events[i];
            var item = S.createElement('div', { 'class': 'ct-event' + (ev.isError ? ' ct-event-error' : '') });

            var dot = S.createElement('div', { 'class': 'ct-event-dot' });
            dot.style.backgroundColor = TYPE_COLORS[ev.type] || '#8B949E';

            var body = S.createElement('div', { 'class': 'ct-event-body' });
            var header = S.createElement('div', { 'class': 'ct-event-header' });
            header.appendChild(S.createElement('span', { 'class': 'ct-event-type' }, ev.label));
            header.appendChild(S.createElement('span', { 'class': 'ct-event-step' }, 'Step ' + (ev.step + 1)));
            if (ev.isError) {
                header.appendChild(S.createElement('span', { 'class': 'ct-error-badge' }, 'ERROR'));
            }
            body.appendChild(header);

            var preview = S.createElement('div', { 'class': 'ct-event-preview' },
                ev.content.substring(0, 150) + (ev.content.length > 150 ? '...' : ''));
            body.appendChild(preview);

            item.appendChild(dot);
            item.appendChild(body);
            section.appendChild(item);
        }

        _container.appendChild(section);
    }

    function renderCronJobs(automation) {
        if (automation.cronJobs.length === 0) { return; }

        var section = S.createElement('div', { 'class': 'ct-cron-jobs' });
        var title = S.createElement('h3', { 'class': 'ct-section-title' }, 'Cron Jobs Detected');
        section.appendChild(title);

        for (var i = 0; i < automation.cronJobs.length; i++) {
            var job = automation.cronJobs[i];
            var card = S.createElement('div', { 'class': 'ct-cron-card' });
            card.appendChild(S.createElement('div', { 'class': 'ct-cron-name' }, job.name));
            card.appendChild(S.createElement('div', { 'class': 'ct-cron-schedule' }, 'Schedule: ' + job.schedule));
            card.appendChild(S.createElement('div', { 'class': 'ct-cron-step' }, 'Created at step ' + (job.step + 1)));
            section.appendChild(card);
        }

        _container.appendChild(section);
    }

    return { init: init, render: render };
})();
