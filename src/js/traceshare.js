/**
 * Clawtrace — Anonymized Trace Export (Trace Share)
 * ============================================================
 * Exports traces with PII redaction for safe sharing.
 * Removes names, emails, IPs, session IDs, tokens.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.TraceShare = (function () {

    var S = Clawtrace.Sanitizer;
    var _container = null;
    var _traceData = null;

    var PII_PATTERNS = [
        { pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, label: 'Email', replace: '[EMAIL_REDACTED]' },
        { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, label: 'IP Address', replace: '[IP_REDACTED]' },
        { pattern: /\b(?:sk|pk|api|key|token|secret)[_\-]?[a-zA-Z0-9]{16,}\b/gi, label: 'API Key', replace: '[KEY_REDACTED]' },
        { pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, label: 'UUID', replace: '[UUID_REDACTED]' },
        { pattern: /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/g, label: 'Bearer Token', replace: '[TOKEN_REDACTED]' },
        { pattern: /password\s*[:=]\s*["']?[^\s"']{3,}/gi, label: 'Password', replace: '[PASSWORD_REDACTED]' },
        { pattern: /\b(?:\/Users\/|\/home\/|C:\\Users\\)[^\s"']+/g, label: 'File Path', replace: '[PATH_REDACTED]' },
        { pattern: /\+?1?\s*\(?[0-9]{3}\)?[\s.\-]?[0-9]{3}[\s.\-]?[0-9]{4}\b/g, label: 'Phone', replace: '[PHONE_REDACTED]' }
    ];

    function init(container) { _container = container; }

    function render(traceData) {
        if (!_container || !traceData) { return; }
        _traceData = traceData;
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        var analysis = analyzePII(traceData);
        renderSummary(analysis);
        renderFindings(analysis);
        renderExportControls(analysis);
    }

    function analyzePII(traceData) {
        var findings = [];
        var typeCounts = {};
        var totalRedacted = 0;

        for (var i = 0; i < traceData.steps.length; i++) {
            var content = traceData.steps[i].content || '';

            for (var p = 0; p < PII_PATTERNS.length; p++) {
                var pattern = new RegExp(PII_PATTERNS[p].pattern.source, PII_PATTERNS[p].pattern.flags);
                var matches = content.match(pattern);
                if (matches && matches.length > 0) {
                    typeCounts[PII_PATTERNS[p].label] = (typeCounts[PII_PATTERNS[p].label] || 0) + matches.length;
                    totalRedacted += matches.length;

                    for (var m = 0; m < Math.min(matches.length, 3); m++) {
                        findings.push({
                            step: i + 1,
                            type: PII_PATTERNS[p].label,
                            masked: maskValue(matches[m]),
                            replace: PII_PATTERNS[p].replace
                        });
                    }
                }
            }
        }

        return {
            findings: findings,
            typeCounts: typeCounts,
            totalRedacted: totalRedacted,
            hasPII: totalRedacted > 0
        };
    }

    function maskValue(val) {
        if (val.length <= 4) { return '****'; }
        return val.substring(0, 2) + '***' + val.substring(val.length - 2);
    }

    function redactTrace(traceData) {
        var redacted = JSON.parse(JSON.stringify(traceData));

        // Redact meta
        if (redacted.meta) {
            if (redacted.meta.sessionId) { redacted.meta.sessionId = '[SESSION_REDACTED]'; }
            if (redacted.meta.userId) { redacted.meta.userId = '[USER_REDACTED]'; }
        }

        // Redact step contents
        for (var i = 0; i < redacted.steps.length; i++) {
            var content = redacted.steps[i].content || '';
            for (var p = 0; p < PII_PATTERNS.length; p++) {
                var pattern = new RegExp(PII_PATTERNS[p].pattern.source, PII_PATTERNS[p].pattern.flags);
                content = content.replace(pattern, PII_PATTERNS[p].replace);
            }
            redacted.steps[i].content = content;
        }

        return redacted;
    }

    function renderSummary(analysis) {
        var section = S.createElement('div', { 'class': 'ts-summary' });
        var title = S.createElement('h3', { 'class': 'ts-section-title' }, 'Trace Anonymization');
        section.appendChild(title);

        var grid = S.createElement('div', { 'class': 'ts-stat-grid' });
        var stats = [
            { label: 'PII Items Found', value: String(analysis.totalRedacted) },
            { label: 'PII Types', value: String(Object.keys(analysis.typeCounts).length) },
            { label: 'Status', value: analysis.hasPII ? 'Needs Redaction' : 'Clean' }
        ];

        for (var i = 0; i < stats.length; i++) {
            var card = S.createElement('div', { 'class': 'ts-stat-card' + (stats[i].label === 'Status' && analysis.hasPII ? ' ts-stat-warn' : '') });
            card.appendChild(S.createElement('div', { 'class': 'ts-stat-value' }, stats[i].value));
            card.appendChild(S.createElement('div', { 'class': 'ts-stat-label' }, stats[i].label));
            grid.appendChild(card);
        }
        section.appendChild(grid);
        _container.appendChild(section);
    }

    function renderFindings(analysis) {
        if (!analysis.hasPII) {
            var section = S.createElement('div', { 'class': 'ts-findings' });
            section.appendChild(S.createElement('div', { 'class': 'ts-clean' },
                'No PII detected. This trace appears safe to share. You can still export an anonymized copy for extra safety.'));
            _container.appendChild(section);
            return;
        }

        var section = S.createElement('div', { 'class': 'ts-findings' });
        var title = S.createElement('h3', { 'class': 'ts-section-title' }, 'PII Detections');
        section.appendChild(title);

        for (var i = 0; i < Math.min(analysis.findings.length, 20); i++) {
            var f = analysis.findings[i];
            var item = S.createElement('div', { 'class': 'ts-finding' });
            item.appendChild(S.createElement('span', { 'class': 'ts-finding-type' }, f.type));
            item.appendChild(S.createElement('span', { 'class': 'ts-finding-step' }, 'Step ' + f.step));
            item.appendChild(S.createElement('span', { 'class': 'ts-finding-masked' }, f.masked));
            item.appendChild(S.createElement('span', { 'class': 'ts-finding-arrow' }, '\u2192'));
            item.appendChild(S.createElement('span', { 'class': 'ts-finding-replace' }, f.replace));
            section.appendChild(item);
        }

        if (analysis.findings.length > 20) {
            section.appendChild(S.createElement('div', { 'class': 'ts-more' },
                '... and ' + (analysis.findings.length - 20) + ' more'));
        }

        _container.appendChild(section);
    }

    function renderExportControls(analysis) {
        var section = S.createElement('div', { 'class': 'ts-export' });
        var title = S.createElement('h3', { 'class': 'ts-section-title' }, 'Export Anonymized Trace');
        section.appendChild(title);

        section.appendChild(S.createElement('p', { 'class': 'ts-export-desc' },
            'Export a copy of this trace with all detected PII redacted. The redacted trace can be safely shared ' +
            'on GitHub issues, Discord, or other public channels without exposing personal information.'));

        var exportBtn = S.createElement('button', { 'class': 'ts-export-btn' }, 'Download Anonymized JSON');
        exportBtn.addEventListener('click', function () {
            if (!_traceData) { return; }
            var redacted = redactTrace(_traceData);
            var blob = new Blob([JSON.stringify(redacted, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = S.createElement('a', { href: url, download: 'clawtrace-anonymized.json' });
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            S.safeSetText(exportBtn, 'Downloaded!');
            setTimeout(function () { S.safeSetText(exportBtn, 'Download Anonymized JSON'); }, 2000);
        });

        section.appendChild(exportBtn);
        _container.appendChild(section);
    }

    return { init: init, render: render };
})();
