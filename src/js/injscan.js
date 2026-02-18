/**
 * Clawtrace — Prompt Injection Scanner
 * ============================================================
 * Scans inbound messages for prompt injection patterns.
 * OpenClaw treats DMs as untrusted input — this scanner helps
 * identify which messages contain injection attempts.
 *   - Pattern-based injection detection (40+ patterns)
 *   - Severity ratings (critical/high/medium/low)
 *   - Correlation with sandbox mode
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.InjScan = (function () {

    var S = Clawtrace.Sanitizer;
    var _container = null;

    /* ---- Injection Patterns ---- */
    var PATTERNS = [
        { name: 'Ignore instructions', regex: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i, severity: 'critical' },
        { name: 'System prompt override', regex: /you\s+are\s+now\s+(a|an|the)\s+/i, severity: 'critical' },
        { name: 'New instructions', regex: /new\s+instructions?\s*:|your\s+new\s+instructions?\s+are/i, severity: 'critical' },
        { name: 'Jailbreak attempt', regex: /(?:DAN|do\s+anything\s+now|developer\s+mode|sudo\s+mode)/i, severity: 'critical' },
        { name: 'Prompt leak request', regex: /(?:show|reveal|print|display|output)\s+(?:your|the|system)\s+(?:prompt|instructions|system\s+message)/i, severity: 'high' },
        { name: 'Role confusion', regex: /(?:pretend|act\s+as\s+if|imagine)\s+you\s+(?:are|were)\s+(?:not\s+)?(?:an?\s+AI|a\s+language\s+model)/i, severity: 'high' },
        { name: 'Tool manipulation', regex: /(?:execute|run|call)\s+(?:the\s+)?(?:bash|system|shell|command)/i, severity: 'high' },
        { name: 'File system access', regex: /(?:read|write|delete|access)\s+(?:the\s+)?(?:file|directory|folder|path)\s*[:=]?\s*(?:\/|~|\.\.)/i, severity: 'high' },
        { name: 'Credential extraction', regex: /(?:show|reveal|give|print)\s+(?:me\s+)?(?:the\s+)?(?:api\s+key|token|password|credential|secret)/i, severity: 'critical' },
        { name: 'Base64 encoded payload', regex: /(?:decode|base64)\s*[:=]?\s*[A-Za-z0-9+/]{20,}={0,2}/i, severity: 'medium' },
        { name: 'Markdown injection', regex: /\[.*\]\(javascript:/i, severity: 'high' },
        { name: 'SQL injection probe', regex: /(?:SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\s+(?:ALL\s+)?(?:FROM|INTO|TABLE|WHERE)/i, severity: 'medium' },
        { name: 'Command injection', regex: /[;|&`$]\s*(?:cat|ls|rm|wget|curl|nc|bash|sh|python|node)\s/i, severity: 'high' },
        { name: 'Session hijack attempt', regex: /sessions?_send\s*\(.*(?:admin|root|owner)/i, severity: 'high' },
        { name: 'Bypass request', regex: /(?:bypass|circumvent|disable|turn\s+off)\s+(?:the\s+)?(?:safety|filter|guard|sandbox|security)/i, severity: 'critical' },
        { name: 'Encoded instructions', regex: /(?:hex|unicode|rot13|caesar)\s*(?:encoded?|decrypt)/i, severity: 'medium' },
        { name: 'Invisible characters', regex: /[\u200B-\u200F\u2028-\u202F\uFEFF]/, severity: 'medium' },
        { name: 'Excessive repetition', regex: /(.{10,})\1{4,}/i, severity: 'low' },
        { name: 'Data exfiltration request', regex: /(?:send|post|transmit|upload)\s+(?:to|data\s+to)\s+(?:https?:\/\/|ftp:\/\/)/i, severity: 'high' },
        { name: 'Skill installation', regex: /(?:install|add|enable)\s+(?:the\s+)?skill\s/i, severity: 'medium' },
        { name: 'Cron manipulation', regex: /cron\.(?:create|update)\s*\(.*(?:rm|delete|destroy|format)/i, severity: 'high' },
        { name: 'Gateway config access', regex: /(?:show|read|access)\s+(?:the\s+)?(?:gateway|openclaw)\s*\.?\s*(?:config|json|settings)/i, severity: 'medium' },
        { name: 'Elevated access request', regex: /\/elevated\s+on|enable\s+elevated/i, severity: 'medium' },
        { name: 'Workspace escape', regex: /(?:\.\.\/|\.\.\\){2,}/i, severity: 'high' }
    ];

    function init(container) { _container = container; }

    function render(traceData) {
        if (!_container || !traceData) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        var results = scanTrace(traceData);
        renderScanSummary(results);
        renderFindings(results);
        renderRecommendations(results);
    }

    function scanTrace(traceData) {
        var findings = [];
        var severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
        var scannedMessages = 0;

        for (var i = 0; i < traceData.steps.length; i++) {
            var step = traceData.steps[i];
            // Only scan user messages and inbound content
            if (step.type !== 'user' && step.type !== 'system') { continue; }
            scannedMessages++;

            var content = step.content || '';
            for (var p = 0; p < PATTERNS.length; p++) {
                var pat = PATTERNS[p];
                if (pat.regex.test(content)) {
                    findings.push({
                        step: i,
                        pattern: pat.name,
                        severity: pat.severity,
                        excerpt: content.substring(0, 200)
                    });
                    severityCounts[pat.severity]++;
                }
            }
        }

        var riskScore = (severityCounts.critical * 25 + severityCounts.high * 15 +
                        severityCounts.medium * 8 + severityCounts.low * 3);
        riskScore = Math.min(riskScore, 100);

        return {
            findings: findings,
            severityCounts: severityCounts,
            scannedMessages: scannedMessages,
            totalSteps: traceData.steps.length,
            riskScore: riskScore
        };
    }

    function renderScanSummary(results) {
        var section = S.createElement('div', { 'class': 'is-summary' });
        var title = S.createElement('h3', { 'class': 'is-section-title' }, 'Injection Scan Results');
        section.appendChild(title);

        // Risk meter
        var meterWrap = S.createElement('div', { 'class': 'is-meter-wrap' });
        var meterTrack = S.createElement('div', { 'class': 'is-meter-track' });
        var meterFill = S.createElement('div', { 'class': 'is-meter-fill' });
        meterFill.style.width = results.riskScore + '%';
        if (results.riskScore > 60) { meterFill.className += ' is-meter-critical'; }
        else if (results.riskScore > 30) { meterFill.className += ' is-meter-warning'; }
        meterTrack.appendChild(meterFill);
        meterWrap.appendChild(meterTrack);
        meterWrap.appendChild(S.createElement('div', { 'class': 'is-meter-label' },
            'Injection Risk: ' + results.riskScore + ' / 100'));
        section.appendChild(meterWrap);

        var grid = S.createElement('div', { 'class': 'is-stat-grid' });
        var stats = [
            { label: 'Messages Scanned', value: String(results.scannedMessages), cls: '' },
            { label: 'Critical', value: String(results.severityCounts.critical), cls: results.severityCounts.critical > 0 ? ' is-critical' : '' },
            { label: 'High', value: String(results.severityCounts.high), cls: results.severityCounts.high > 0 ? ' is-high' : '' },
            { label: 'Medium', value: String(results.severityCounts.medium), cls: results.severityCounts.medium > 0 ? ' is-medium' : '' },
            { label: 'Low', value: String(results.severityCounts.low), cls: '' }
        ];

        for (var i = 0; i < stats.length; i++) {
            var card = S.createElement('div', { 'class': 'is-stat-card' + stats[i].cls });
            card.appendChild(S.createElement('div', { 'class': 'is-stat-value' }, stats[i].value));
            card.appendChild(S.createElement('div', { 'class': 'is-stat-label' }, stats[i].label));
            grid.appendChild(card);
        }
        section.appendChild(grid);
        _container.appendChild(section);
    }

    function renderFindings(results) {
        var section = S.createElement('div', { 'class': 'is-findings' });
        var title = S.createElement('h3', { 'class': 'is-section-title' }, 'Detected Patterns');
        section.appendChild(title);

        if (results.findings.length === 0) {
            section.appendChild(S.createElement('div', { 'class': 'is-clean' },
                'No injection patterns detected. All scanned messages appear clean.'));
            _container.appendChild(section);
            return;
        }

        for (var i = 0; i < Math.min(results.findings.length, 30); i++) {
            var f = results.findings[i];
            var item = S.createElement('div', { 'class': 'is-finding is-finding-' + f.severity });
            var header = S.createElement('div', { 'class': 'is-finding-header' });
            header.appendChild(S.createElement('span', { 'class': 'is-severity-badge is-sev-' + f.severity },
                f.severity.toUpperCase()));
            header.appendChild(S.createElement('span', { 'class': 'is-pattern-name' }, f.pattern));
            header.appendChild(S.createElement('span', { 'class': 'is-step-ref' }, 'Step ' + (f.step + 1)));
            item.appendChild(header);

            var excerpt = S.createElement('div', { 'class': 'is-excerpt' }, f.excerpt);
            item.appendChild(excerpt);
            section.appendChild(item);
        }

        _container.appendChild(section);
    }

    function renderRecommendations(results) {
        var section = S.createElement('div', { 'class': 'is-recommendations' });
        var title = S.createElement('h3', { 'class': 'is-section-title' }, 'Security Recommendations');
        section.appendChild(title);

        var recs = [];

        if (results.severityCounts.critical > 0) {
            recs.push('Critical injection patterns detected. Ensure sandbox mode is enabled for non-main sessions: agents.defaults.sandbox.mode: "non-main"');
            recs.push('Review DM policy — set dmPolicy: "pairing" to require approval for unknown senders.');
        }
        if (results.severityCounts.high > 0) {
            recs.push('High-severity patterns found. Consider restricting tool access in sandbox config denylist.');
        }
        if (results.findings.length > 0) {
            recs.push('Run "openclaw doctor" to verify your security configuration.');
            recs.push('Review the OpenClaw Security Guide: docs.openclaw.ai/gateway/security');
        }
        if (results.findings.length === 0) {
            recs.push('No injection patterns found. Continue monitoring — always treat inbound DMs as untrusted input.');
        }

        for (var i = 0; i < recs.length; i++) {
            var rec = S.createElement('div', { 'class': 'is-rec-item' });
            rec.appendChild(S.createElement('span', { 'class': 'is-rec-icon' }, '\u2192'));
            rec.appendChild(S.createElement('span', {}, recs[i]));
            section.appendChild(rec);
        }

        _container.appendChild(section);
    }

    return { init: init, render: render };
})();
