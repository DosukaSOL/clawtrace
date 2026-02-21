/**
 * Clawtrace — Sanitizer Module
 * ============================================================
 * Provides input sanitization, XSS prevention, and safe DOM
 * rendering utilities. This is the security foundation of the
 * entire application.
 *
 * Security principles:
 * - All user input is treated as untrusted
 * - No innerHTML with raw user content
 * - Strict size limits enforced
 * - All output is escaped before rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Sanitizer = (function () {

    /* ---- Constants ---- */
    var MAX_INPUT_SIZE = 5 * 1024 * 1024;   // 5 MB
    var MAX_STEPS = 10000;                    // max timeline steps
    var MAX_STRING_LENGTH = 1000000;          // max single string field
    var MAX_NESTING_DEPTH = 20;               // max JSON nesting
    var MAX_URL_LENGTH = 32000;               // max share URL length

    /* ---- HTML Entity Escaping ---- */

    /**
     * Escapes a string for safe insertion into HTML text content.
     * Prevents XSS via script injection, HTML injection, and
     * attribute breakout.
     *
     * @param {string} str - Raw input string
     * @returns {string} Escaped string safe for HTML text
     */
    function escapeHTML(str) {
        if (typeof str !== 'string') {
            return '';
        }
        // Use a lookup map for performance
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;',
            '`': '&#96;'
        };
        return str.replace(/[&<>"'/`]/g, function (char) {
            return map[char];
        });
    }

    /**
     * Creates a text node — the safest way to insert user content into DOM.
     *
     * @param {string} text - Text content
     * @returns {Text} DOM text node
     */
    function safeTextNode(text) {
        return document.createTextNode(typeof text === 'string' ? text : String(text));
    }

    /**
     * Safely sets text content of an element (no HTML parsing).
     *
     * @param {HTMLElement} el - Target element
     * @param {string} text - Text to set
     */
    function safeSetText(el, text) {
        if (el && typeof el.textContent !== 'undefined') {
            el.textContent = typeof text === 'string' ? text : String(text);
        }
    }

    /**
     * Creates an element with safe text content and optional attributes.
     * Attributes are restricted to a whitelist of safe names.
     *
     * @param {string} tag - HTML tag name
     * @param {Object} [attrs] - Safe attributes
     * @param {string} [textContent] - Text content
     * @returns {HTMLElement}
     */
    function createElement(tag, attrs, textContent) {
        // Whitelist of safe tags
        var safeTags = [
            'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'dl', 'dt', 'dd',
            'pre', 'code', 'kbd', 'em', 'strong', 'small',
            'section', 'article', 'header', 'footer', 'nav', 'main',
            'button', 'label', 'input', 'select', 'option', 'textarea',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'details', 'summary', 'a'
        ];

        var safeTag = String(tag).toLowerCase();
        if (safeTags.indexOf(safeTag) === -1) {
            safeTag = 'div'; // fallback to safe element
        }

        var el = document.createElement(safeTag);

        // Whitelist of safe attribute names
        var safeAttrs = [
            'class', 'id', 'role', 'aria-label', 'aria-labelledby',
            'aria-describedby', 'aria-expanded', 'aria-controls',
            'aria-current', 'aria-hidden', 'aria-live', 'aria-valuenow',
            'aria-valuemin', 'aria-valuemax',
            'title', 'tabindex', 'data-type', 'data-index', 'data-slot',
            'data-step', 'data-view', 'data-speed', 'data-format',
            'type', 'readonly', 'disabled',
            'for', 'name', 'value', 'rows', 'maxlength',
            'placeholder', 'checked',
            'style'
        ];

        if (attrs && typeof attrs === 'object') {
            var keys = Object.keys(attrs);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i].toLowerCase();
                // Reject event handlers and dangerous attributes
                if (key.indexOf('on') === 0) { continue; }
                if (key === 'href' || key === 'src' || key === 'action' || key === 'formaction') { continue; }
                if (safeAttrs.indexOf(key) !== -1) {
                    var val = String(attrs[keys[i]]);
                    // Extra safety: no javascript: in any attribute value
                    if (/javascript\s*:/i.test(val)) { continue; }
                    if (/data\s*:/i.test(val) && key !== 'style') { continue; }
                    el.setAttribute(key, val);
                }
            }
        }

        if (typeof textContent === 'string') {
            el.textContent = textContent;
        }

        return el;
    }

    /* ---- Input Validation ---- */

    /**
     * Validates raw input size.
     *
     * @param {string} input - Raw input string
     * @returns {{valid: boolean, error: string|null}}
     */
    function validateSize(input) {
        if (typeof input !== 'string') {
            return { valid: false, error: 'Input must be a string.' };
        }
        if (input.length === 0) {
            return { valid: false, error: 'Input is empty.' };
        }
        if (input.length > MAX_INPUT_SIZE) {
            return {
                valid: false,
                error: 'Input exceeds maximum size of ' +
                       (MAX_INPUT_SIZE / 1024 / 1024) + ' MB (' +
                       input.length.toLocaleString() + ' characters).'
            };
        }
        return { valid: true, error: null };
    }

    /**
     * Strips null bytes and other dangerous control characters.
     *
     * @param {string} input
     * @returns {string}
     */
    function stripDangerousChars(input) {
        if (typeof input !== 'string') { return ''; }
        // Remove null bytes, backspace, and other C0 control chars except \t, \n, \r
        return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }

    /**
     * Sanitizes a string field from parsed data.
     *
     * @param {*} value
     * @param {number} [maxLen]
     * @returns {string}
     */
    function sanitizeString(value, maxLen) {
        if (value === null || value === undefined) { return ''; }
        var str = String(value);
        str = stripDangerousChars(str);
        var limit = maxLen || MAX_STRING_LENGTH;
        if (str.length > limit) {
            str = str.substring(0, limit) + '… [truncated]';
        }
        return str;
    }

    /**
     * Deep-sanitizes a parsed JSON object, enforcing nesting limits
     * and string length limits. Prevents JSON bombs / deeply nested payloads.
     *
     * @param {*} obj - Parsed object
     * @param {number} [depth] - Current depth
     * @returns {*} Sanitized object
     */
    function sanitizeObject(obj, depth) {
        depth = depth || 0;
        if (depth > MAX_NESTING_DEPTH) {
            return '[max nesting depth exceeded]';
        }

        if (obj === null || obj === undefined) { return null; }

        var type = typeof obj;

        if (type === 'string') {
            return sanitizeString(obj);
        }

        if (type === 'number') {
            if (!isFinite(obj)) { return 0; }
            return obj;
        }

        if (type === 'boolean') {
            return obj;
        }

        if (Array.isArray(obj)) {
            // Limit array size
            var maxItems = MAX_STEPS;
            var arr = [];
            var len = Math.min(obj.length, maxItems);
            for (var i = 0; i < len; i++) {
                arr.push(sanitizeObject(obj[i], depth + 1));
            }
            return arr;
        }

        if (type === 'object') {
            var result = {};
            var keys = Object.keys(obj);
            // Limit number of keys
            var maxKeys = 1000;
            var keyLen = Math.min(keys.length, maxKeys);
            for (var k = 0; k < keyLen; k++) {
                var key = sanitizeString(keys[k], 200);
                // Block prototype pollution vectors
                if (key === '__proto__' || key === 'constructor' || key === 'prototype') { continue; }
                result[key] = sanitizeObject(obj[keys[k]], depth + 1);
            }
            return result;
        }

        // Anything else, convert to string
        return sanitizeString(String(obj));
    }

    /**
     * Validates a file before reading.
     *
     * @param {File} file
     * @returns {{valid: boolean, error: string|null}}
     */
    function validateFile(file) {
        if (!file) {
            return { valid: false, error: 'No file provided.' };
        }

        // Check file size
        if (file.size > MAX_INPUT_SIZE) {
            return {
                valid: false,
                error: 'File exceeds maximum size of ' +
                       (MAX_INPUT_SIZE / 1024 / 1024) + ' MB.'
            };
        }

        // Check extension
        var name = (file.name || '').toLowerCase();
        var validExtensions = ['.json', '.txt', '.yaml', '.yml', '.md', '.log'];
        var hasValidExt = validExtensions.some(function (ext) {
            return name.endsWith(ext);
        });

        if (!hasValidExt) {
            return {
                valid: false,
                error: 'Unsupported file type. Accepted: JSON, TXT, YAML, MD, LOG.'
            };
        }

        // Check MIME type (loose check — file MIME can be unreliable)
        var type = (file.type || '').toLowerCase();
        var dangerousTypes = [
            'application/x-executable',
            'application/x-msdos-program',
            'application/x-msdownload',
            'application/octet-stream'
        ];
        if (dangerousTypes.indexOf(type) !== -1 && !hasValidExt) {
            return { valid: false, error: 'Potentially unsafe file type.' };
        }

        return { valid: true, error: null };
    }

    /**
     * Validates URL length for share feature.
     *
     * @param {string} url
     * @returns {{valid: boolean, error: string|null}}
     */
    function validateShareURL(url) {
        if (typeof url !== 'string') {
            return { valid: false, error: 'Invalid URL.' };
        }
        if (url.length > MAX_URL_LENGTH) {
            return {
                valid: false,
                error: 'Share URL exceeds maximum length (' + MAX_URL_LENGTH + ' chars). ' +
                       'Try with smaller trace data.'
            };
        }
        return { valid: true, error: null };
    }

    /* ---- Public API ---- */
    return {
        MAX_INPUT_SIZE: MAX_INPUT_SIZE,
        MAX_STEPS: MAX_STEPS,
        MAX_STRING_LENGTH: MAX_STRING_LENGTH,
        MAX_URL_LENGTH: MAX_URL_LENGTH,
        escapeHTML: escapeHTML,
        safeTextNode: safeTextNode,
        safeSetText: safeSetText,
        createElement: createElement,
        validateSize: validateSize,
        stripDangerousChars: stripDangerousChars,
        sanitizeString: sanitizeString,
        sanitizeObject: sanitizeObject,
        validateFile: validateFile,
        validateShareURL: validateShareURL
    };

})();
