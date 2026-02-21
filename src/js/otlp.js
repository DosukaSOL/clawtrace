/**
 * Clawtrace — OpenTelemetry (OTLP) Format Support (v2.1)
 * ============================================================
 * Detects and converts OpenTelemetry JSON export format to
 * Clawtrace's internal TraceData schema.
 *
 * Supports:
 *   - OTLP/JSON: { resourceSpans: [...] }
 *   - Wrapped:   { data: { resourceSpans: [...] } }
 *   - resourceSpans > scopeSpans > spans  (OTLP v0.9+)
 *   - resourceSpans > instrumentationLibrarySpans > spans  (OTLP legacy)
 *
 * Span attributes are decoded from OTLP's AnyValue structure.
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.OTLP = (function () {

    var S = Clawtrace.Sanitizer;

    /* ---- Detection ---- */

    /**
     * Returns true if the parsed JSON object looks like an
     * OTLP trace export.
     * @param {*} data
     */
    function detect(data) {
        if (!data || typeof data !== 'object') { return false; }
        if (Array.isArray(data.resourceSpans) && data.resourceSpans.length > 0) { return true; }
        if (data.data && Array.isArray(data.data.resourceSpans)) { return true; }
        return false;
    }

    /* ---- Conversion ---- */

    /**
     * Converts an OTLP JSON object to a Clawtrace TraceData object.
     *
     * @param {Object} data - Parsed OTLP JSON
     * @returns {Object}   - Clawtrace TraceData
     */
    function convert(data) {
        var resourceSpans = data.resourceSpans
            || (data.data && data.data.resourceSpans)
            || [];

        var steps    = [];
        var services = {};

        for (var r = 0; r < resourceSpans.length; r++) {
            var rs          = resourceSpans[r];
            var serviceName = _attr(rs.resource && rs.resource.attributes,
                                   'service.name') || 'unknown-service';
            services[serviceName] = true;

            // Support both OTLP v0.9+ (scopeSpans) and legacy (instrumentationLibrarySpans)
            var scopeSpans = rs.scopeSpans || rs.instrumentationLibrarySpans || [];

            for (var sc = 0; sc < scopeSpans.length; sc++) {
                var ss      = scopeSpans[sc];
                var libName = (ss.scope && ss.scope.name) ||
                              (ss.instrumentationLibrary && ss.instrumentationLibrary.name) || '';
                var spans   = ss.spans || [];

                for (var sp = 0; sp < spans.length; sp++) {
                    steps.push(_convertSpan(spans[sp], serviceName, libName, steps.length));
                }
            }
        }

        // Sort by start time (nano-seconds as strings — lexicographic works here)
        steps.sort(function (a, b) {
            var ta = (a.metadata && a.metadata.startNano) || '';
            var tb = (b.metadata && b.metadata.startNano) || '';
            if (ta < tb) { return -1; }
            if (ta > tb) { return 1; }
            return 0;
        });

        // Re-index after sort
        for (var i = 0; i < steps.length; i++) { steps[i].index = i; }

        if (steps.length > S.MAX_STEPS) { steps = steps.slice(0, S.MAX_STEPS); }

        return {
            meta: {
                format:    'otlp',
                stepCount: steps.length,
                parsedAt:  new Date().toISOString(),
                services:  Object.keys(services).join(', '),
                otlp:      true
            },
            steps: steps
        };
    }

    /* ---- Span → Step ---- */

    function _convertSpan(span, serviceName, libName, idx) {
        if (!span || typeof span !== 'object') {
            return {
                index: idx, type: 'system',
                content: '[invalid span]', summary: '[invalid span]',
                raw: '', metadata: {}
            };
        }

        var name     = S.sanitizeString(span.name || 'unnamed', 200);
        var statusCode = span.status && span.status.code;
        var isError  = (statusCode === 2 ||
                        statusCode === 'STATUS_CODE_ERROR' ||
                        String(statusCode) === '2');
        var isRoot   = !span.parentSpanId;

        // Infer Clawtrace step type from span name / kind
        var type = 'tool_call';
        if (isRoot) { type = 'system'; }
        if (isError) { type = 'error'; }
        if (/^(llm|ai|model|chat|completion|inference)/i.test(name)) { type = 'assistant'; }
        if (/^(user|input|prompt)/i.test(name)) { type = 'user'; }
        if (/^(think|reason|chain)/i.test(name)) { type = 'reasoning'; }

        // Build readable content
        var parts = [];
        parts.push('Service: ' + serviceName);
        if (libName) { parts.push('Instrumentation: ' + libName); }
        parts.push('Operation: ' + name);

        if (span.traceId)      { parts.push('TraceID: ' + S.sanitizeString(span.traceId, 64)); }
        if (span.spanId)       { parts.push('SpanID: '  + S.sanitizeString(span.spanId, 32)); }
        if (span.parentSpanId) { parts.push('Parent: '  + S.sanitizeString(span.parentSpanId, 32)); }

        // Duration
        if (span.startTimeUnixNano && span.endTimeUnixNano) {
            var durMs = (Number(span.endTimeUnixNano) - Number(span.startTimeUnixNano)) / 1e6;
            if (!isNaN(durMs)) { parts.push('Duration: ' + durMs.toFixed(2) + '\u00A0ms'); }
        }

        // Attributes
        var attrs = span.attributes || [];
        var attrLines = [];
        for (var a = 0; a < Math.min(attrs.length, 30); a++) {
            if (attrs[a].key) {
                attrLines.push(
                    S.sanitizeString(attrs[a].key, 100) + ': ' +
                    S.sanitizeString(String(_attrVal(attrs[a].value)), 300)
                );
            }
        }
        if (attrLines.length > 0) {
            parts.push('Attributes:\n  ' + attrLines.join('\n  '));
        }

        // Events
        var events = span.events || [];
        if (events.length > 0) {
            parts.push('Events: ' + events
                .slice(0, 10)
                .map(function (ev) { return S.sanitizeString(ev.name || 'event', 80); })
                .join(', '));
        }

        // Status
        if (span.status) {
            var statusMsg = span.status.message
                ? ': ' + S.sanitizeString(span.status.message, 200)
                : '';
            parts.push('Status: ' + (isError ? '\u26A0 ERROR' : '\u2713 OK') + statusMsg);
        }

        var content = parts.join('\n');

        return {
            index:   idx,
            type:    type,
            content: content,
            summary: serviceName + ' \u203A ' + name + (isError ? ' \u26A0' : ''),
            raw:     JSON.stringify(span, null, 2),
            metadata: {
                service:    serviceName,
                library:    libName,
                traceId:    S.sanitizeString(span.traceId    || '', 64),
                spanId:     S.sanitizeString(span.spanId     || '', 32),
                parentSpanId: S.sanitizeString(span.parentSpanId || '', 32),
                startNano:  S.sanitizeString(String(span.startTimeUnixNano || ''), 30),
                isRoot:     String(isRoot),
                isError:    String(isError)
            }
        };
    }

    /* ---- Attribute helpers ---- */

    function _attr(attributes, key) {
        if (!Array.isArray(attributes)) { return null; }
        for (var i = 0; i < attributes.length; i++) {
            if (attributes[i].key === key) { return _attrVal(attributes[i].value); }
        }
        return null;
    }

    function _attrVal(value) {
        if (!value) { return ''; }
        if (typeof value.stringValue === 'string') { return value.stringValue; }
        if (value.intValue    !== undefined) { return String(value.intValue);    }
        if (value.doubleValue !== undefined) { return String(value.doubleValue); }
        if (value.boolValue   !== undefined) { return String(value.boolValue);   }
        if (value.arrayValue)  { return '[array]'; }
        if (value.kvlistValue) { return '[map]';   }
        return String(value);
    }

    /* ---- Public API ---- */
    return {
        detect: detect,
        convert: convert
    };

})();
