/**
 * Clawtrace — Share Module
 * ============================================================
 * Generates shareable URLs with trace data encoded in the URL
 * fragment (hash). Uses base64 encoding with compression.
 *
 * SECURITY: Data never leaves the browser. The URL fragment
 * (after #) is NOT sent to any server by browsers. Data is
 * encoded, not encrypted — this is by design for simplicity.
 * The user is warned about this.
 *
 * URL format: index.html#ct1:<base64-encoded-data>
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Share = (function () {

    var S = Clawtrace.Sanitizer;

    var SHARE_PREFIX = 'ct1:'; // Version prefix for future compatibility
    var MAX_SHARE_SIZE = 30000; // Max size before base64 encoding

    /**
     * Generates a share URL from trace data.
     *
     * @param {Object} traceData - Parsed trace data
     * @returns {{success: boolean, url: string|null, error: string|null, warning: string|null}}
     */
    function generateShareURL(traceData) {
        if (!traceData || !traceData.steps) {
            return { success: false, url: null, error: 'No trace data to share.', warning: null };
        }

        try {
            // Create a compact representation
            var compact = {
                m: {
                    f: traceData.meta.format,
                    c: traceData.steps.length
                },
                s: traceData.steps.map(function (step) {
                    return {
                        t: step.type,
                        c: step.content ? step.content.substring(0, 2000) : '',
                        u: step.summary
                    };
                })
            };

            var json = JSON.stringify(compact);

            // Check size before encoding
            if (json.length > MAX_SHARE_SIZE) {
                // Truncate steps to fit
                var maxSteps = Math.floor(MAX_SHARE_SIZE / (json.length / compact.s.length));
                maxSteps = Math.max(1, Math.min(maxSteps, compact.s.length));
                compact.s = compact.s.slice(0, maxSteps);
                compact.m.c = maxSteps;
                compact.m.truncated = true;
                json = JSON.stringify(compact);
            }

            // Base64 encode (using built-in btoa with UTF-8 handling)
            var encoded = safeBase64Encode(json);

            // Build URL
            var base = getBaseURL();
            var shareURL = base + '#' + SHARE_PREFIX + encoded;

            // Validate URL length
            var urlCheck = S.validateShareURL(shareURL);
            if (!urlCheck.valid) {
                return { success: false, url: null, error: urlCheck.error, warning: null };
            }

            var warning = null;
            if (compact.m.truncated) {
                warning = 'Trace was truncated to ' + compact.s.length +
                          ' steps to fit URL size limits.';
            }

            warning = (warning ? warning + ' ' : '') +
                      'Note: Data is encoded but NOT encrypted. ' +
                      'Do not share URLs containing sensitive information.';

            return { success: true, url: shareURL, error: null, warning: warning };

        } catch (e) {
            return {
                success: false,
                url: null,
                error: 'Failed to generate share URL: ' + S.sanitizeString(e.message, 200),
                warning: null
            };
        }
    }

    /**
     * Decodes trace data from a share URL fragment.
     *
     * @param {string} hash - URL hash (without #)
     * @returns {{success: boolean, data: Object|null, error: string|null}}
     */
    function decodeShareURL(hash) {
        if (!hash || typeof hash !== 'string') {
            return { success: false, data: null, error: 'No share data found.' };
        }

        // Remove # if present
        if (hash.charAt(0) === '#') {
            hash = hash.substring(1);
        }

        // Check prefix
        if (hash.indexOf(SHARE_PREFIX) !== 0) {
            return { success: false, data: null, error: 'Invalid share URL format.' };
        }

        var encoded = hash.substring(SHARE_PREFIX.length);

        // Validate encoded data length
        if (encoded.length > S.MAX_URL_LENGTH) {
            return { success: false, data: null, error: 'Share data exceeds size limit.' };
        }

        try {
            var json = safeBase64Decode(encoded);
            var compact = JSON.parse(json);

            // Reconstruct trace data
            if (!compact || !compact.s || !Array.isArray(compact.s)) {
                return { success: false, data: null, error: 'Invalid share data structure.' };
            }

            var steps = compact.s.map(function (step, idx) {
                return {
                    index: idx,
                    type: S.sanitizeString(step.t, 50),
                    content: S.sanitizeString(step.c),
                    summary: S.sanitizeString(step.u, 200),
                    raw: '',
                    metadata: {}
                };
            });

            // Enforce step limit
            if (steps.length > S.MAX_STEPS) {
                steps = steps.slice(0, S.MAX_STEPS);
            }

            var traceData = {
                meta: {
                    format: S.sanitizeString((compact.m && compact.m.f) || 'shared', 50),
                    stepCount: steps.length,
                    parsedAt: new Date().toISOString(),
                    shared: true,
                    truncated: !!(compact.m && compact.m.truncated)
                },
                steps: steps
            };

            return { success: true, data: traceData, error: null };

        } catch (e) {
            return {
                success: false,
                data: null,
                error: 'Failed to decode share URL: ' + S.sanitizeString(e.message, 200)
            };
        }
    }

    /* ---- Base64 Utilities ---- */

    /**
     * Encodes a UTF-8 string to base64 safely.
     */
    function safeBase64Encode(str) {
        // Handle UTF-8 characters
        var utf8 = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (_, p1) {
            return String.fromCharCode(parseInt(p1, 16));
        });
        return btoa(utf8);
    }

    /**
     * Decodes a base64 string to UTF-8 safely.
     */
    function safeBase64Decode(encoded) {
        // Validate base64 characters
        if (!/^[A-Za-z0-9+/=]+$/.test(encoded)) {
            throw new Error('Invalid base64 characters.');
        }
        var decoded = atob(encoded);
        return decodeURIComponent(
            decoded.split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join('')
        );
    }

    /**
     * Gets the base URL for share links.
     */
    function getBaseURL() {
        var loc = window.location;
        return loc.protocol + '//' + loc.host + loc.pathname;
    }

    /* ---- Public API ---- */
    return {
        generateShareURL: generateShareURL,
        decodeShareURL: decodeShareURL
    };

})();
