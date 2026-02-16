/**
 * Clawtrace — Analyzer Module
 * ============================================================
 * Performs reasoning analysis on parsed trace data to detect:
 * - Infinite loops / repetition
 * - Hallucination indicators
 * - Contradictions
 * - Uncertainty language
 * - Error patterns
 *
 * Produces:
 * - Risk score (0–100)
 * - Confidence score (0–100)
 * - Warning flags
 * - Detailed findings
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Analyzer = (function () {

    var S = Clawtrace.Sanitizer;

    /* ---- Analysis Configuration ---- */

    /**
     * Patterns for detecting uncertainty language.
     * Each entry has a regex pattern and a weight (0–1).
     */
    var UNCERTAINTY_PATTERNS = [
        { pattern: /\bi('m| am) not (sure|certain|confident)\b/gi, weight: 0.7, label: 'Expressed lack of certainty' },
        { pattern: /\bi (think|believe|guess|suppose|assume)\b/gi, weight: 0.3, label: 'Hedging language' },
        { pattern: /\b(maybe|perhaps|possibly|probably|might|could be)\b/gi, weight: 0.3, label: 'Probabilistic language' },
        { pattern: /\b(not sure|unclear|uncertain|don't know|cannot determine)\b/gi, weight: 0.6, label: 'Uncertainty admission' },
        { pattern: /\b(if i (recall|remember)|as far as i know)\b/gi, weight: 0.5, label: 'Memory hedging' },
        { pattern: /\b(approximately|roughly|around|about|estimated)\b/gi, weight: 0.2, label: 'Imprecise quantities' },
        { pattern: /\b(however|but|although|on the other hand|alternatively)\b/gi, weight: 0.1, label: 'Qualification language' }
    ];

    /**
     * Patterns for detecting hallucination indicators.
     */
    var HALLUCINATION_PATTERNS = [
        { pattern: /\b(as of my (last |knowledge )?(?:cutoff|training|update))\b/gi, weight: 0.5, label: 'Knowledge cutoff reference' },
        { pattern: /\b(i (cannot|can't) (browse|access|search|visit|view) (the )?(internet|web|url|link|site))\b/gi, weight: 0.3, label: 'Capability limitation reference' },
        { pattern: /\b(hallucin|confabulat|fabricat|made.up|invented)\b/gi, weight: 0.8, label: 'Self-identified hallucination' },
        { pattern: /\b(let me (correct|fix|revise|update) (that|this|my|myself))\b/gi, weight: 0.4, label: 'Self-correction' },
        { pattern: /\b(i (apologize|was wrong|made an? (error|mistake)))\b/gi, weight: 0.5, label: 'Error acknowledgment' },
        { pattern: /\b(actually|wait|correction|upon (further |closer )?(review|reflection|thought))\b/gi, weight: 0.3, label: 'Mid-stream correction' }
    ];

    /**
     * Patterns for detecting contradictions.
     */
    var CONTRADICTION_PATTERNS = [
        { pattern: /\b(previously i said|earlier i (mentioned|stated|said)|as i said before)\b/gi, weight: 0.4, label: 'Self-reference to prior statement' },
        { pattern: /\b(this contradicts|inconsistent with|does not match|conflicts with)\b/gi, weight: 0.7, label: 'Explicit contradiction marker' },
        { pattern: /\b(on (the )?contrary|conversely|in contrast|the opposite)\b/gi, weight: 0.3, label: 'Contrasting statement' }
    ];

    /**
     * Patterns for detecting potential loops or repetition.
     */
    var REPETITION_THRESHOLD = 0.7; // Jaccard similarity threshold

    /* ---- Core Analysis ---- */

    /**
     * Performs full analysis on trace data.
     *
     * @param {Object} traceData - Parsed TraceData
     * @returns {Object} Analysis results
     */
    function analyze(traceData) {
        if (!traceData || !traceData.steps || traceData.steps.length === 0) {
            return emptyResult();
        }

        var steps = traceData.steps;
        var findings = [];
        var warnings = [];

        // 1. Basic stats
        var stats = computeStats(steps);

        // 2. Repetition / loop detection
        var repetition = detectRepetition(steps);
        findings = findings.concat(repetition.findings);
        warnings = warnings.concat(repetition.warnings);

        // 3. Uncertainty analysis
        var uncertainty = detectPatterns(steps, UNCERTAINTY_PATTERNS, 'Uncertainty');
        findings = findings.concat(uncertainty.findings);

        // 4. Hallucination indicator detection
        var hallucination = detectPatterns(steps, HALLUCINATION_PATTERNS, 'Hallucination Indicator');
        findings = findings.concat(hallucination.findings);

        // 5. Contradiction detection
        var contradiction = detectPatterns(steps, CONTRADICTION_PATTERNS, 'Contradiction');
        findings = findings.concat(contradiction.findings);

        // 6. Error analysis
        var errors = analyzeErrors(steps);
        findings = findings.concat(errors.findings);
        warnings = warnings.concat(errors.warnings);

        // 7. Compute scores
        var riskScore = computeRiskScore(repetition, uncertainty, hallucination, contradiction, errors, stats);
        var confidenceScore = Math.max(0, 100 - riskScore);

        // 8. Generate warning flags
        warnings = warnings.concat(generateWarnings(riskScore, repetition, uncertainty, hallucination, contradiction, errors));

        // Sort warnings by severity
        var severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
        warnings.sort(function (a, b) {
            return (severityOrder[a.level] || 3) - (severityOrder[b.level] || 3);
        });

        return {
            stats: stats,
            riskScore: Math.round(riskScore),
            confidenceScore: Math.round(confidenceScore),
            warnings: warnings,
            findings: findings,
            repetition: repetition,
            uncertainty: uncertainty,
            hallucination: hallucination,
            contradiction: contradiction,
            errors: errors
        };
    }

    /**
     * Returns an empty analysis result.
     */
    function emptyResult() {
        return {
            stats: { total: 0, byType: {}, estimatedTokens: 0 },
            riskScore: 0,
            confidenceScore: 100,
            warnings: [],
            findings: [],
            repetition: { score: 0, findings: [], warnings: [] },
            uncertainty: { score: 0, findings: [] },
            hallucination: { score: 0, findings: [] },
            contradiction: { score: 0, findings: [] },
            errors: { count: 0, findings: [], warnings: [] }
        };
    }

    /* ---- Stats ---- */

    /**
     * Computes basic trace statistics.
     */
    function computeStats(steps) {
        var byType = {};
        var totalChars = 0;

        for (var i = 0; i < steps.length; i++) {
            var type = steps[i].type || 'unknown';
            byType[type] = (byType[type] || 0) + 1;
            totalChars += (steps[i].content || '').length;
        }

        // Rough token estimate (1 token ≈ 4 chars for English)
        var estimatedTokens = Math.round(totalChars / 4);

        return {
            total: steps.length,
            byType: byType,
            totalChars: totalChars,
            estimatedTokens: estimatedTokens
        };
    }

    /* ---- Repetition Detection ---- */

    /**
     * Detects repeated or near-duplicate steps (potential loops).
     */
    function detectRepetition(steps) {
        var findings = [];
        var warnings = [];
        var duplicateGroups = {};
        var score = 0;

        // Compare each step to subsequent steps looking for near-duplicates
        // Only check assistant and tool_call steps (most likely to loop)
        var relevantSteps = steps.filter(function (s) {
            return s.type === 'assistant' || s.type === 'tool_call';
        });

        for (var i = 0; i < relevantSteps.length && i < 500; i++) {
            for (var j = i + 1; j < relevantSteps.length && j < i + 50; j++) {
                var similarity = computeSimilarity(
                    relevantSteps[i].content,
                    relevantSteps[j].content
                );

                if (similarity > REPETITION_THRESHOLD) {
                    var key = relevantSteps[i].index + ':' + relevantSteps[j].index;
                    if (!duplicateGroups[key]) {
                        duplicateGroups[key] = true;
                        findings.push({
                            category: 'Repetition',
                            text: 'Steps #' + relevantSteps[i].index + ' and #' +
                                  relevantSteps[j].index + ' are ' +
                                  Math.round(similarity * 100) + '% similar',
                            evidence: truncateForDisplay(relevantSteps[i].content, 200)
                        });
                    }
                }
            }
        }

        var duplicateCount = Object.keys(duplicateGroups).length;
        score = Math.min(1, duplicateCount / 5); // Normalize: 5+ duplicates = max

        if (duplicateCount > 3) {
            warnings.push({
                level: 'error',
                title: 'Potential Infinite Loop',
                detail: duplicateCount + ' near-duplicate step pairs detected. ' +
                        'The AI may be stuck in a loop.'
            });
        } else if (duplicateCount > 0) {
            warnings.push({
                level: 'warning',
                title: 'Repetitive Patterns',
                detail: duplicateCount + ' near-duplicate step pairs detected.'
            });
        }

        return { score: score, findings: findings, warnings: warnings, count: duplicateCount };
    }

    /**
     * Computes Jaccard-like similarity between two strings.
     * Uses word-level comparison for efficiency.
     */
    function computeSimilarity(a, b) {
        if (!a || !b) return 0;
        if (a === b) return 1;

        // Truncate for performance
        var maxLen = 2000;
        var aStr = a.length > maxLen ? a.substring(0, maxLen) : a;
        var bStr = b.length > maxLen ? b.substring(0, maxLen) : b;

        var aWords = aStr.toLowerCase().split(/\s+/);
        var bWords = bStr.toLowerCase().split(/\s+/);

        if (aWords.length === 0 || bWords.length === 0) return 0;

        var aSet = {};
        var bSet = {};
        var union = {};
        var intersectionCount = 0;

        for (var i = 0; i < aWords.length; i++) {
            aSet[aWords[i]] = true;
            union[aWords[i]] = true;
        }
        for (var j = 0; j < bWords.length; j++) {
            bSet[bWords[j]] = true;
            union[bWords[j]] = true;
        }

        var unionKeys = Object.keys(union);
        for (var k = 0; k < unionKeys.length; k++) {
            if (aSet[unionKeys[k]] && bSet[unionKeys[k]]) {
                intersectionCount++;
            }
        }

        return intersectionCount / unionKeys.length;
    }

    /* ---- Pattern Detection ---- */

    /**
     * Detects pattern matches across all steps.
     */
    function detectPatterns(steps, patterns, category) {
        var findings = [];
        var totalMatches = 0;
        var weightedScore = 0;

        for (var i = 0; i < steps.length; i++) {
            var content = steps[i].content || '';
            if (!content) { continue; }

            for (var p = 0; p < patterns.length; p++) {
                var pat = patterns[p];
                // Reset lastIndex for global regex
                pat.pattern.lastIndex = 0;
                var matches = content.match(pat.pattern);

                if (matches && matches.length > 0) {
                    totalMatches += matches.length;
                    weightedScore += pat.weight * matches.length;

                    // Only log first few matches per pattern per step
                    if (findings.length < 50) {
                        findings.push({
                            category: category,
                            text: pat.label + ' (step #' + steps[i].index + ', ' +
                                  matches.length + ' match' + (matches.length > 1 ? 'es' : '') + ')',
                            evidence: truncateForDisplay(matches.slice(0, 3).join(', '), 200)
                        });
                    }
                }
            }
        }

        // Normalize score: 0–1 range
        var maxExpected = steps.length * 2;
        var score = Math.min(1, weightedScore / Math.max(1, maxExpected));

        return { score: score, findings: findings, totalMatches: totalMatches };
    }

    /* ---- Error Analysis ---- */

    /**
     * Analyzes error steps and error patterns.
     */
    function analyzeErrors(steps) {
        var errorSteps = steps.filter(function (s) { return s.type === 'error'; });
        var findings = [];
        var warnings = [];

        for (var i = 0; i < errorSteps.length; i++) {
            findings.push({
                category: 'Error',
                text: 'Error at step #' + errorSteps[i].index,
                evidence: truncateForDisplay(errorSteps[i].content, 300)
            });
        }

        if (errorSteps.length > 5) {
            warnings.push({
                level: 'error',
                title: 'High Error Rate',
                detail: errorSteps.length + ' error steps detected (' +
                        Math.round(errorSteps.length / steps.length * 100) + '% of all steps).'
            });
        } else if (errorSteps.length > 0) {
            warnings.push({
                level: 'warning',
                title: 'Errors Detected',
                detail: errorSteps.length + ' error step(s) found in the trace.'
            });
        }

        return {
            count: errorSteps.length,
            findings: findings,
            warnings: warnings,
            rate: steps.length > 0 ? errorSteps.length / steps.length : 0
        };
    }

    /* ---- Score Computation ---- */

    /**
     * Computes overall risk score (0–100).
     */
    function computeRiskScore(repetition, uncertainty, hallucination, contradiction, errors, stats) {
        // Weighted components
        var weights = {
            repetition: 30,
            hallucination: 25,
            contradiction: 20,
            errors: 15,
            uncertainty: 10
        };

        var score =
            repetition.score * weights.repetition +
            hallucination.score * weights.hallucination +
            contradiction.score * weights.contradiction +
            (errors.rate || 0) * weights.errors +
            uncertainty.score * weights.uncertainty;

        return Math.min(100, Math.max(0, score));
    }

    /**
     * Generates high-level warning flags based on analysis.
     */
    function generateWarnings(riskScore, repetition, uncertainty, hallucination, contradiction, errors) {
        var warnings = [];

        if (riskScore >= 75) {
            warnings.push({
                level: 'critical',
                title: 'Critical Risk Level',
                detail: 'Overall risk score is ' + Math.round(riskScore) +
                        '/100. This trace shows significant quality concerns.'
            });
        } else if (riskScore >= 50) {
            warnings.push({
                level: 'error',
                title: 'High Risk Level',
                detail: 'Overall risk score is ' + Math.round(riskScore) +
                        '/100. Review findings carefully.'
            });
        } else if (riskScore >= 25) {
            warnings.push({
                level: 'warning',
                title: 'Moderate Risk',
                detail: 'Overall risk score is ' + Math.round(riskScore) +
                        '/100. Minor concerns detected.'
            });
        } else if (riskScore > 0) {
            warnings.push({
                level: 'info',
                title: 'Low Risk',
                detail: 'Overall risk score is ' + Math.round(riskScore) +
                        '/100. Trace appears healthy.'
            });
        }

        if (hallucination.totalMatches > 3) {
            warnings.push({
                level: 'warning',
                title: 'Hallucination Indicators',
                detail: hallucination.totalMatches + ' potential hallucination markers found.'
            });
        }

        if (uncertainty.totalMatches > 10) {
            warnings.push({
                level: 'info',
                title: 'High Uncertainty Language',
                detail: uncertainty.totalMatches + ' uncertainty markers found. ' +
                        'The AI expressed significant doubt.'
            });
        }

        return warnings;
    }

    /* ---- Helpers ---- */

    /**
     * Truncates a string for display.
     */
    function truncateForDisplay(str, maxLen) {
        if (!str) return '';
        var s = S.sanitizeString(str, maxLen + 10);
        if (s.length > maxLen) {
            return s.substring(0, maxLen - 3) + '...';
        }
        return s;
    }

    /* ---- Public API ---- */
    return {
        analyze: analyze,
        computeStats: computeStats
    };

})();
