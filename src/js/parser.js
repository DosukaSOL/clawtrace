/**
 * Clawtrace — Parser Module
 * ============================================================
 * Auto-detects input format (JSON, YAML-like, plain text) and
 * normalizes into a safe internal schema.
 *
 * Internal Schema (TraceData):
 * {
 *   meta: { format: string, inputSize: number, parsedAt: string },
 *   steps: [
 *     {
 *       index: number,
 *       type: 'user' | 'assistant' | 'tool_call' | 'reasoning' | 'error' | 'system',
 *       content: string,
 *       summary: string,
 *       raw: string,
 *       metadata: {}
 *     }
 *   ]
 * }
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Parser = (function () {

    var S = Clawtrace.Sanitizer;

    /* ---- Format Detection ---- */

    /**
     * Detects the likely format of the input string.
     *
     * @param {string} input - Raw input
     * @returns {'json'|'yaml'|'text'} Detected format
     */
    function detectFormat(input) {
        var trimmed = input.trim();

        // JSON: starts with { or [
        if ((trimmed.charAt(0) === '{' && trimmed.charAt(trimmed.length - 1) === '}') ||
            (trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']')) {
            try {
                JSON.parse(trimmed);
                return 'json';
            } catch (e) {
                // Might still be JSON-like but malformed; fall through
            }
        }

        // YAML-like: has key: value patterns on multiple lines
        var yamlPattern = /^[\w-]+\s*:\s*.+/m;
        var yamlDashPattern = /^-\s+\w+/m;
        if (yamlPattern.test(trimmed) || yamlDashPattern.test(trimmed)) {
            return 'yaml';
        }

        return 'text';
    }

    /* ---- JSON Parsing ---- */

    /**
     * Safely parses JSON with size and nesting validation.
     *
     * @param {string} input
     * @returns {Object} Parsed and sanitized object
     * @throws {Error} On parse failure
     */
    function safeJSONParse(input) {
        // Check for nesting depth before parsing (heuristic)
        var maxBracketDepth = 0;
        var currentDepth = 0;
        for (var i = 0; i < Math.min(input.length, 100000); i++) {
            var c = input.charAt(i);
            if (c === '{' || c === '[') {
                currentDepth++;
                if (currentDepth > maxBracketDepth) { maxBracketDepth = currentDepth; }
            } else if (c === '}' || c === ']') {
                currentDepth--;
            }
        }

        if (maxBracketDepth > 50) {
            throw new Error('JSON nesting depth exceeds safety limit.');
        }

        var parsed = JSON.parse(input);
        return S.sanitizeObject(parsed);
    }

    /**
     * Normalizes a JSON object into the internal TraceData schema.
     * Handles multiple common AI trace formats.
     *
     * @param {Object} data - Parsed JSON
     * @returns {Object} Normalized TraceData
     */
    function normalizeJSON(data) {
        var steps = [];

        // Format 1: Array of message objects (OpenAI-like)
        if (Array.isArray(data)) {
            steps = data.map(normalizeMessageObject);
        }
        // Format 2: { messages: [...] }
        else if (data.messages && Array.isArray(data.messages)) {
            steps = data.messages.map(normalizeMessageObject);
        }
        // Format 3: { steps: [...] }
        else if (data.steps && Array.isArray(data.steps)) {
            steps = data.steps.map(normalizeStepObject);
        }
        // Format 4: { trace: [...] }
        else if (data.trace && Array.isArray(data.trace)) {
            steps = data.trace.map(normalizeStepObject);
        }
        // Format 5: { events: [...] }
        else if (data.events && Array.isArray(data.events)) {
            steps = data.events.map(normalizeStepObject);
        }
        // Format 6: Single object — wrap in one step
        else {
            steps.push({
                index: 0,
                type: classifyType(data.role || data.type || 'system'),
                content: data.content || JSON.stringify(data, null, 2),
                summary: extractSummary(data.content || JSON.stringify(data)),
                raw: JSON.stringify(data, null, 2),
                metadata: extractMetadata(data)
            });
        }

        // Assign stable indices
        for (var i = 0; i < steps.length; i++) {
            steps[i].index = i;
        }

        // Enforce step limit
        if (steps.length > S.MAX_STEPS) {
            steps = steps.slice(0, S.MAX_STEPS);
        }

        return {
            meta: {
                format: 'json',
                stepCount: steps.length,
                parsedAt: new Date().toISOString()
            },
            steps: steps
        };
    }

    /**
     * Normalizes a single message object (OpenAI chat format).
     */
    function normalizeMessageObject(msg, idx) {
        if (!msg || typeof msg !== 'object') {
            return {
                index: idx,
                type: 'system',
                content: S.sanitizeString(String(msg)),
                summary: '[invalid entry]',
                raw: String(msg),
                metadata: {}
            };
        }

        var role = S.sanitizeString(msg.role || msg.type || 'unknown', 50);
        var content = '';

        if (typeof msg.content === 'string') {
            content = S.sanitizeString(msg.content);
        } else if (Array.isArray(msg.content)) {
            // Handle content arrays (multi-part messages)
            content = msg.content.map(function (part) {
                if (typeof part === 'string') { return S.sanitizeString(part); }
                if (part && part.text) { return S.sanitizeString(part.text); }
                if (part && part.type) { return '[' + S.sanitizeString(part.type, 50) + ']'; }
                return '';
            }).join('\n');
        } else if (msg.content && typeof msg.content === 'object') {
            content = JSON.stringify(msg.content, null, 2);
        }

        // Handle tool calls
        if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
            var toolContent = msg.tool_calls.map(function (tc) {
                var name = S.sanitizeString(tc.function && tc.function.name || tc.name || 'unknown', 100);
                var args = '';
                try {
                    args = typeof tc.function === 'object' && tc.function.arguments
                        ? S.sanitizeString(tc.function.arguments, 5000)
                        : '';
                } catch (e) { args = '[parse error]'; }
                return 'Tool: ' + name + (args ? '\nArgs: ' + args : '');
            }).join('\n---\n');
            content = content ? content + '\n\n' + toolContent : toolContent;
        }

        return {
            index: idx,
            type: classifyType(role),
            content: content,
            summary: extractSummary(content),
            raw: JSON.stringify(msg, null, 2),
            metadata: extractMetadata(msg)
        };
    }

    /**
     * Normalizes a step/event object from generic trace formats.
     */
    function normalizeStepObject(step, idx) {
        if (!step || typeof step !== 'object') {
            return {
                index: idx,
                type: 'system',
                content: S.sanitizeString(String(step)),
                summary: '[invalid step]',
                raw: String(step),
                metadata: {}
            };
        }

        var type = classifyType(
            step.type || step.role || step.kind || step.event_type || 'system'
        );
        var content = S.sanitizeString(
            step.content || step.text || step.message || step.output || step.data ||
            (typeof step === 'object' ? JSON.stringify(step, null, 2) : String(step))
        );

        return {
            index: idx,
            type: type,
            content: content,
            summary: extractSummary(content),
            raw: JSON.stringify(step, null, 2),
            metadata: extractMetadata(step)
        };
    }

    /* ---- YAML-like Parsing ---- */

    /**
     * Parses YAML-like plain text into steps.
     * This is a simplified key-value parser; not a full YAML parser.
     *
     * @param {string} input
     * @returns {Object} TraceData
     */
    function parseYAMLLike(input) {
        var lines = input.split('\n');
        var steps = [];
        var currentStep = null;
        var contentLines = [];

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var keyMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
            var dashMatch = line.match(/^-\s+(.+)$/);

            if (keyMatch) {
                // Save previous step
                if (currentStep) {
                    if (contentLines.length > 0) {
                        currentStep.content += '\n' + contentLines.join('\n');
                    }
                    currentStep.summary = extractSummary(currentStep.content);
                    steps.push(currentStep);
                    contentLines = [];
                }

                var key = S.sanitizeString(keyMatch[1], 100).toLowerCase();
                var val = S.sanitizeString(keyMatch[2], 5000);

                // Determine type from key
                var type = 'system';
                if (/role|type|kind/.test(key)) {
                    type = classifyType(val);
                    currentStep = {
                        index: steps.length,
                        type: type,
                        content: '',
                        summary: '',
                        raw: line,
                        metadata: {}
                    };
                } else if (/content|text|message|output/.test(key)) {
                    if (!currentStep) {
                        currentStep = {
                            index: steps.length,
                            type: 'system',
                            content: '',
                            summary: '',
                            raw: '',
                            metadata: {}
                        };
                    }
                    currentStep.content = val;
                    currentStep.raw += '\n' + line;
                } else {
                    if (!currentStep) {
                        currentStep = {
                            index: steps.length,
                            type: 'system',
                            content: key + ': ' + val,
                            summary: '',
                            raw: line,
                            metadata: {}
                        };
                    } else {
                        currentStep.metadata[key] = val;
                        currentStep.raw += '\n' + line;
                    }
                }
            } else if (dashMatch) {
                // List item — treat as new step if no current context
                if (currentStep && contentLines.length === 0) {
                    contentLines.push(S.sanitizeString(dashMatch[1], 5000));
                } else {
                    if (currentStep) {
                        currentStep.content += (contentLines.length ? '\n' + contentLines.join('\n') : '');
                        currentStep.summary = extractSummary(currentStep.content);
                        steps.push(currentStep);
                        contentLines = [];
                    }
                    currentStep = {
                        index: steps.length,
                        type: 'system',
                        content: S.sanitizeString(dashMatch[1], 5000),
                        summary: '',
                        raw: line,
                        metadata: {}
                    };
                }
            } else if (line.trim()) {
                contentLines.push(S.sanitizeString(line, 5000));
            }
        }

        // Flush last step
        if (currentStep) {
            if (contentLines.length > 0) {
                currentStep.content += '\n' + contentLines.join('\n');
            }
            currentStep.summary = extractSummary(currentStep.content);
            steps.push(currentStep);
        }

        // If no structured steps were found, treat whole input as one step
        if (steps.length === 0) {
            steps.push({
                index: 0,
                type: 'system',
                content: S.sanitizeString(input),
                summary: extractSummary(input),
                raw: input,
                metadata: {}
            });
        }

        // Re-index
        for (var j = 0; j < steps.length; j++) {
            steps[j].index = j;
        }

        if (steps.length > S.MAX_STEPS) {
            steps = steps.slice(0, S.MAX_STEPS);
        }

        return {
            meta: {
                format: 'yaml',
                stepCount: steps.length,
                parsedAt: new Date().toISOString()
            },
            steps: steps
        };
    }

    /* ---- Plain Text Parsing ---- */

    /**
     * Parses plain text into steps by splitting on common delimiters.
     *
     * @param {string} input
     * @returns {Object} TraceData
     */
    function parsePlainText(input) {
        var steps = [];

        // Try splitting on common separators
        var blocks;
        if (/^---+$/m.test(input)) {
            blocks = input.split(/^---+$/m);
        } else if (/^===+$/m.test(input)) {
            blocks = input.split(/^===+$/m);
        } else if (/\n\n\n/.test(input)) {
            blocks = input.split(/\n{3,}/);
        } else {
            // Try detecting conversation turns
            var turnPattern = /^(User|Assistant|System|Human|AI|Bot|Tool|Error)\s*[:\-]/im;
            if (turnPattern.test(input)) {
                blocks = input.split(/(?=^(?:User|Assistant|System|Human|AI|Bot|Tool|Error)\s*[:\-])/im);
            } else {
                // Single block
                blocks = [input];
            }
        }

        for (var i = 0; i < blocks.length; i++) {
            var block = blocks[i].trim();
            if (!block) { continue; }

            var sanitized = S.sanitizeString(block);
            var type = inferTypeFromContent(sanitized);

            steps.push({
                index: steps.length,
                type: type,
                content: sanitized,
                summary: extractSummary(sanitized),
                raw: block,
                metadata: {}
            });
        }

        if (steps.length === 0) {
            steps.push({
                index: 0,
                type: 'system',
                content: S.sanitizeString(input),
                summary: extractSummary(input),
                raw: input,
                metadata: {}
            });
        }

        if (steps.length > S.MAX_STEPS) {
            steps = steps.slice(0, S.MAX_STEPS);
        }

        return {
            meta: {
                format: 'text',
                stepCount: steps.length,
                parsedAt: new Date().toISOString()
            },
            steps: steps
        };
    }

    /* ---- Helpers ---- */

    /**
     * Classifies a role/type string into our internal type enum.
     */
    function classifyType(role) {
        var r = String(role).toLowerCase().trim();

        if (/^(user|human|customer|input)/.test(r)) return 'user';
        if (/^(assistant|ai|bot|model|gpt|claude|response|output)/.test(r)) return 'assistant';
        if (/^(tool|function|action|plugin|tool_call|tool_use)/.test(r)) return 'tool_call';
        if (/^(think|reason|chain|thought|cot|reflect)/.test(r)) return 'reasoning';
        if (/^(error|fail|exception|crash|bug)/.test(r)) return 'error';

        return 'system';
    }

    /**
     * Infers type from content text when no explicit role is given.
     */
    function inferTypeFromContent(text) {
        var lower = text.toLowerCase();
        if (/^user\s*[:\-]/i.test(lower)) return 'user';
        if (/^(assistant|ai|bot)\s*[:\-]/i.test(lower)) return 'assistant';
        if (/^(tool|function)\s*[:\-]/i.test(lower)) return 'tool_call';
        if (/^error\s*[:\-]/i.test(lower)) return 'error';
        if (/thinking|reasoning|chain.of.thought/i.test(lower)) return 'reasoning';
        return 'system';
    }

    /**
     * Extracts a short summary from content (first line, truncated).
     */
    function extractSummary(content) {
        if (!content) return '[empty]';
        var firstLine = content.split('\n')[0].trim();
        if (firstLine.length > 120) {
            return firstLine.substring(0, 117) + '...';
        }
        return firstLine || '[empty]';
    }

    /**
     * Extracts metadata from a message object.
     */
    function extractMetadata(obj) {
        if (!obj || typeof obj !== 'object') return {};
        var meta = {};
        var metaKeys = [
            'model', 'timestamp', 'tokens', 'usage', 'finish_reason',
            'tool_call_id', 'name', 'id', 'created', 'duration'
        ];

        for (var i = 0; i < metaKeys.length; i++) {
            var key = metaKeys[i];
            if (obj[key] !== undefined) {
                meta[key] = typeof obj[key] === 'object'
                    ? JSON.stringify(obj[key])
                    : S.sanitizeString(String(obj[key]), 500);
            }
        }

        return meta;
    }

    /* ---- Main Parse Function ---- */

    /**
     * Main entry point: parses raw input into TraceData.
     *
     * @param {string} input - Raw input text
     * @returns {{success: boolean, data: Object|null, error: string|null, format: string}}
     */
    function parse(input) {
        // Validate size first
        var sizeCheck = S.validateSize(input);
        if (!sizeCheck.valid) {
            return { success: false, data: null, error: sizeCheck.error, format: 'unknown' };
        }

        // Strip dangerous characters
        var cleaned = S.stripDangerousChars(input.trim());

        // Detect format
        var format = detectFormat(cleaned);

        try {
            var result;

            switch (format) {
                case 'json':
                    var parsed = safeJSONParse(cleaned);
                    result = normalizeJSON(parsed);
                    break;
                case 'yaml':
                    result = parseYAMLLike(cleaned);
                    break;
                default:
                    result = parsePlainText(cleaned);
                    break;
            }

            result.meta.inputSize = input.length;
            result.meta.format = format;

            return {
                success: true,
                data: result,
                error: null,
                format: format
            };
        } catch (e) {
            return {
                success: false,
                data: null,
                error: 'Parse error: ' + S.sanitizeString(e.message, 500),
                format: format
            };
        }
    }

    /* ---- Public API ---- */
    return {
        parse: parse,
        detectFormat: detectFormat,
        classifyType: classifyType,
        extractSummary: extractSummary
    };

})();
