/**
 * Clawtrace — Main Application Module
 * ============================================================
 * Wires together all modules and handles:
 * - View navigation
 * - Input handling (drag & drop, paste, file picker)
 * - Analysis orchestration
 * - UI state management
 * - Theme toggling
 * - Share URL detection on load
 *
 * This is the application entry point. All other modules must
 * be loaded before this file.
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.App = (function () {

    var S = Clawtrace.Sanitizer;
    var P = Clawtrace.Parser;
    var TL = Clawtrace.Timeline;
    var AN = Clawtrace.Analyzer;
    var CMP = Clawtrace.Comparison;
    var EXP = Clawtrace.Export;
    var SHR = Clawtrace.Share;

    /* ---- State ---- */
    var _currentView = 'input';
    var _rawInput = '';
    var _traceData = null;
    var _analysisResult = null;

    /* ---- DOM References ---- */
    var dom = {};

    /* ---- Initialization ---- */

    /**
     * Initializes the application on DOMContentLoaded.
     */
    function init() {
        cacheDOMReferences();
        bindEventListeners();
        TL.init(dom.timelineContainer);
        applyStoredTheme();
        checkShareURL();
        setStatus('Ready — Load an AI interaction trace to begin.');
    }

    /**
     * Caches all DOM element references.
     */
    function cacheDOMReferences() {
        dom.navButtons = document.querySelectorAll('.nav-btn');
        dom.views = document.querySelectorAll('.view');
        dom.statusMessage = document.getElementById('status-message');

        // Input view
        dom.dropZone = document.getElementById('drop-zone');
        dom.fileInput = document.getElementById('file-input');
        dom.pasteArea = document.getElementById('paste-area');
        dom.btnParse = document.getElementById('btn-parse');
        dom.btnClear = document.getElementById('btn-clear-input');
        dom.btnLoadExample = document.getElementById('btn-load-example');
        dom.inputFeedback = document.getElementById('input-feedback');

        // Timeline view
        dom.timelineContainer = document.getElementById('timeline-container');
        dom.btnExpandAll = document.getElementById('btn-expand-all');
        dom.btnCollapseAll = document.getElementById('btn-collapse-all');
        dom.timelineFilter = document.getElementById('timeline-filter');

        // Analyzer view
        dom.meterFill = document.getElementById('meter-fill');
        dom.riskScoreText = document.getElementById('risk-score-text');
        dom.confidenceValue = document.getElementById('confidence-value');
        dom.statTotal = document.getElementById('stat-total');
        dom.statTools = document.getElementById('stat-tools');
        dom.statErrors = document.getElementById('stat-errors');
        dom.statTokens = document.getElementById('stat-tokens');
        dom.warningsContainer = document.getElementById('warnings-container');
        dom.findingsContainer = document.getElementById('findings-container');

        // Comparison view
        dom.compareA = document.getElementById('compare-a');
        dom.compareB = document.getElementById('compare-b');
        dom.compareFiles = document.querySelectorAll('.compare-file');
        dom.btnCompare = document.getElementById('btn-compare');
        dom.comparisonOutput = document.getElementById('comparison-output');

        // Export view
        dom.btnExportJSON = document.getElementById('btn-export-json');
        dom.btnExportMd = document.getElementById('btn-export-md');
        dom.btnExportHTML = document.getElementById('btn-export-html');
        dom.btnShare = document.getElementById('btn-share');
        dom.shareOutput = document.getElementById('share-output');
        dom.shareUrl = document.getElementById('share-url');
        dom.btnCopyShare = document.getElementById('btn-copy-share');
        dom.shareWarning = document.getElementById('share-warning');

        // Theme
        dom.btnThemeToggle = document.getElementById('btn-theme-toggle');
    }

    /**
     * Binds all event listeners.
     */
    function bindEventListeners() {
        // Navigation
        for (var i = 0; i < dom.navButtons.length; i++) {
            dom.navButtons[i].addEventListener('click', handleNavClick);
        }

        // Drop zone
        dom.dropZone.addEventListener('dragover', handleDragOver);
        dom.dropZone.addEventListener('dragleave', handleDragLeave);
        dom.dropZone.addEventListener('drop', handleDrop);
        dom.dropZone.addEventListener('click', function () {
            dom.fileInput.click();
        });
        dom.dropZone.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dom.fileInput.click();
            }
        });

        // File input
        dom.fileInput.addEventListener('change', handleFileSelect);

        // Paste area
        dom.pasteArea.addEventListener('input', handlePasteInput);

        // Input actions
        dom.btnParse.addEventListener('click', handleParse);
        dom.btnClear.addEventListener('click', handleClear);
        dom.btnLoadExample.addEventListener('click', handleLoadExample);

        // Timeline controls
        dom.btnExpandAll.addEventListener('click', function () { TL.expandAll(); });
        dom.btnCollapseAll.addEventListener('click', function () { TL.collapseAll(); });
        dom.timelineFilter.addEventListener('change', function () {
            TL.setFilter(dom.timelineFilter.value);
        });

        // Comparison
        dom.btnCompare.addEventListener('click', handleCompare);
        for (var cf = 0; cf < dom.compareFiles.length; cf++) {
            dom.compareFiles[cf].addEventListener('change', handleCompareFile);
        }

        // Export
        dom.btnExportJSON.addEventListener('click', function () {
            EXP.exportJSON(_traceData, _analysisResult);
        });
        dom.btnExportMd.addEventListener('click', function () {
            EXP.exportMarkdown(_traceData, _analysisResult);
        });
        dom.btnExportHTML.addEventListener('click', function () {
            EXP.exportHTML(_traceData, _analysisResult);
        });

        // Share
        dom.btnShare.addEventListener('click', handleShare);
        dom.btnCopyShare.addEventListener('click', handleCopyShare);

        // Theme
        dom.btnThemeToggle.addEventListener('click', toggleTheme);
    }

    /* ---- Navigation ---- */

    function handleNavClick(e) {
        var btn = e.currentTarget;
        var view = btn.getAttribute('data-view');
        if (view) {
            switchView(view);
        }
    }

    function switchView(viewName) {
        _currentView = viewName;

        // Update nav buttons
        for (var i = 0; i < dom.navButtons.length; i++) {
            var btn = dom.navButtons[i];
            if (btn.getAttribute('data-view') === viewName) {
                btn.classList.add('active');
                btn.setAttribute('aria-current', 'page');
            } else {
                btn.classList.remove('active');
                btn.removeAttribute('aria-current');
            }
        }

        // Update views
        for (var j = 0; j < dom.views.length; j++) {
            var v = dom.views[j];
            if (v.id === 'view-' + viewName) {
                v.classList.add('active');
                v.hidden = false;
            } else {
                v.classList.remove('active');
                v.hidden = true;
            }
        }
    }

    /* ---- Input Handling ---- */

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        dom.dropZone.classList.add('drag-over');
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        dom.dropZone.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        dom.dropZone.classList.remove('drag-over');

        var files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length > 0) {
            loadFile(files[0]);
        }
    }

    function handleFileSelect(e) {
        var files = e.target.files;
        if (files && files.length > 0) {
            loadFile(files[0]);
        }
    }

    function handlePasteInput() {
        _rawInput = dom.pasteArea.value;
        dom.btnParse.disabled = !_rawInput.trim();
        hideFeedback();
    }

    /**
     * Loads a file with validation.
     */
    function loadFile(file) {
        var validation = S.validateFile(file);
        if (!validation.valid) {
            showFeedback(validation.error, 'error');
            return;
        }

        setStatus('Reading file: ' + S.escapeHTML(file.name) + '...');

        var reader = new FileReader();

        reader.onload = function (e) {
            var content = e.target.result;
            var sizeCheck = S.validateSize(content);
            if (!sizeCheck.valid) {
                showFeedback(sizeCheck.error, 'error');
                setStatus('File too large.');
                return;
            }

            _rawInput = content;
            dom.pasteArea.value = content;
            dom.btnParse.disabled = false;
            setStatus('File loaded: ' + S.escapeHTML(file.name) + ' (' +
                      file.size.toLocaleString() + ' bytes)');
            showFeedback('File loaded successfully. Click "Parse & Analyze" to continue.', 'success');
        };

        reader.onerror = function () {
            showFeedback('Failed to read file.', 'error');
            setStatus('File read error.');
        };

        reader.readAsText(file);
    }

    /* ---- Parse & Analyze ---- */

    function handleParse() {
        _rawInput = dom.pasteArea.value;

        if (!_rawInput.trim()) {
            showFeedback('No input data. Paste text or load a file.', 'error');
            return;
        }

        setStatus('Parsing...');
        hideFeedback();

        // Use setTimeout to allow UI update
        setTimeout(function () {
            try {
                var result = P.parse(_rawInput);

                if (!result.success) {
                    showFeedback(result.error, 'error');
                    setStatus('Parse failed.');
                    return;
                }

                _traceData = result.data;

                // Analyze
                setStatus('Analyzing...');
                _analysisResult = AN.analyze(_traceData);

                // Render timeline
                TL.init(dom.timelineContainer);
                TL.render(_traceData);

                // Render analyzer
                renderAnalyzer(_analysisResult);

                // Enable export buttons
                dom.btnExportJSON.disabled = false;
                dom.btnExportMd.disabled = false;
                dom.btnExportHTML.disabled = false;
                dom.btnShare.disabled = false;

                var msg = 'Parsed ' + _traceData.steps.length + ' steps (' +
                          result.format + ' format). Risk: ' +
                          _analysisResult.riskScore + '/100, Confidence: ' +
                          _analysisResult.confidenceScore + '/100.';
                showFeedback(msg, 'success');
                setStatus(msg);

                // Auto-switch to timeline
                switchView('timeline');

            } catch (e) {
                showFeedback('Unexpected error: ' + S.sanitizeString(e.message, 200), 'error');
                setStatus('Error.');
            }
        }, 50);
    }

    function handleClear() {
        _rawInput = '';
        _traceData = null;
        _analysisResult = null;
        dom.pasteArea.value = '';
        dom.btnParse.disabled = true;
        dom.btnExportJSON.disabled = true;
        dom.btnExportMd.disabled = true;
        dom.btnExportHTML.disabled = true;
        dom.btnShare.disabled = true;
        hideFeedback();
        setStatus('Cleared. Ready for new input.');

        // Reset analyzer
        resetAnalyzer();

        // Clear timeline
        if (dom.timelineContainer) {
            while (dom.timelineContainer.firstChild) {
                dom.timelineContainer.removeChild(dom.timelineContainer.firstChild);
            }
        }

        // Reset share
        dom.shareOutput.hidden = true;
        dom.shareWarning.hidden = true;

        // Reset file input
        dom.fileInput.value = '';
    }

    function handleLoadExample() {
        var example = getExampleTrace();
        dom.pasteArea.value = example;
        _rawInput = example;
        dom.btnParse.disabled = false;
        showFeedback('Example trace loaded. Click "Parse & Analyze" to explore.', 'info');
        setStatus('Example trace loaded.');
    }

    /* ---- Analyzer Rendering ---- */

    function renderAnalyzer(result) {
        if (!result) { return; }

        // Risk meter
        dom.meterFill.style.width = result.riskScore + '%';
        dom.meterFill.setAttribute('aria-valuenow', result.riskScore);
        dom.meterFill.className = 'meter-fill';
        if (result.riskScore < 25) { dom.meterFill.classList.add('risk-low'); }
        else if (result.riskScore < 50) { dom.meterFill.classList.add('risk-medium'); }
        else if (result.riskScore < 75) { dom.meterFill.classList.add('risk-high'); }
        else { dom.meterFill.classList.add('risk-critical'); }

        S.safeSetText(dom.riskScoreText, result.riskScore + ' / 100');

        // Confidence
        S.safeSetText(dom.confidenceValue, String(result.confidenceScore));

        // Stats
        S.safeSetText(dom.statTotal, String(result.stats.total));
        S.safeSetText(dom.statTools, String(result.stats.byType.tool_call || 0));
        S.safeSetText(dom.statErrors, String(result.stats.byType.error || 0));
        S.safeSetText(dom.statTokens, result.stats.estimatedTokens.toLocaleString());

        // Warnings
        renderWarnings(result.warnings);

        // Findings
        renderFindings(result.findings);
    }

    function renderWarnings(warnings) {
        while (dom.warningsContainer.firstChild) {
            dom.warningsContainer.removeChild(dom.warningsContainer.firstChild);
        }

        if (!warnings || warnings.length === 0) {
            var none = S.createElement('p', { 'class': 'no-data' }, 'No warnings detected.');
            dom.warningsContainer.appendChild(none);
            return;
        }

        var icons = {
            critical: '\u26D4', // ⛔
            error: '\u26A0',    // ⚠
            warning: '\u25B2',  // ▲
            info: '\u2139'      // ℹ
        };

        for (var i = 0; i < warnings.length; i++) {
            var w = warnings[i];
            var flag = S.createElement('div', {
                'class': 'warning-flag level-' + (w.level || 'info'),
                'role': 'listitem'
            });

            var icon = S.createElement('span', { 'class': 'warning-icon', 'aria-hidden': 'true' },
                                       icons[w.level] || icons.info);
            var content = S.createElement('div', { 'class': 'warning-content' });
            var title = S.createElement('div', { 'class': 'warning-title' }, w.title || 'Notice');
            var detail = S.createElement('div', { 'class': 'warning-detail' }, w.detail || '');

            content.appendChild(title);
            content.appendChild(detail);
            flag.appendChild(icon);
            flag.appendChild(content);
            dom.warningsContainer.appendChild(flag);
        }
    }

    function renderFindings(findings) {
        while (dom.findingsContainer.firstChild) {
            dom.findingsContainer.removeChild(dom.findingsContainer.firstChild);
        }

        if (!findings || findings.length === 0) {
            var none = S.createElement('p', { 'class': 'no-data' }, 'No findings to display.');
            dom.findingsContainer.appendChild(none);
            return;
        }

        // Limit display to first 50 findings
        var limit = Math.min(findings.length, 50);
        for (var i = 0; i < limit; i++) {
            var f = findings[i];
            var item = S.createElement('div', {
                'class': 'finding-item',
                'role': 'listitem'
            });

            var cat = S.createElement('div', { 'class': 'finding-category' }, f.category || 'General');
            var text = S.createElement('div', { 'class': 'finding-text' }, f.text || '');

            item.appendChild(cat);
            item.appendChild(text);

            if (f.evidence) {
                var evidence = S.createElement('div', { 'class': 'finding-evidence' }, f.evidence);
                item.appendChild(evidence);
            }

            dom.findingsContainer.appendChild(item);
        }

        if (findings.length > limit) {
            var more = S.createElement('p', { 'class': 'no-data' },
                                       '... and ' + (findings.length - limit) + ' more findings.');
            dom.findingsContainer.appendChild(more);
        }
    }

    function resetAnalyzer() {
        dom.meterFill.style.width = '0%';
        dom.meterFill.setAttribute('aria-valuenow', '0');
        dom.meterFill.className = 'meter-fill';
        S.safeSetText(dom.riskScoreText, '\u2014');
        S.safeSetText(dom.confidenceValue, '\u2014');
        S.safeSetText(dom.statTotal, '\u2014');
        S.safeSetText(dom.statTools, '\u2014');
        S.safeSetText(dom.statErrors, '\u2014');
        S.safeSetText(dom.statTokens, '\u2014');

        while (dom.warningsContainer.firstChild) {
            dom.warningsContainer.removeChild(dom.warningsContainer.firstChild);
        }
        dom.warningsContainer.appendChild(
            S.createElement('p', { 'class': 'no-data' }, 'No data loaded.')
        );

        while (dom.findingsContainer.firstChild) {
            dom.findingsContainer.removeChild(dom.findingsContainer.firstChild);
        }
        dom.findingsContainer.appendChild(
            S.createElement('p', { 'class': 'no-data' }, 'No data loaded.')
        );
    }

    /* ---- Comparison ---- */

    function handleCompare() {
        var inputA = dom.compareA.value;
        var inputB = dom.compareB.value;

        if (!inputA.trim() || !inputB.trim()) {
            setStatus('Both Trace A and Trace B are required for comparison.');
            return;
        }

        setStatus('Comparing traces...');

        setTimeout(function () {
            try {
                var result = CMP.compare(inputA, inputB);

                if (!result.success) {
                    setStatus('Comparison error: ' + result.error);
                    return;
                }

                CMP.renderComparison(result.result, dom.comparisonOutput);
                setStatus('Comparison complete. ' +
                          result.result.diff.summary.changed + ' changed, ' +
                          result.result.diff.summary.added + ' added, ' +
                          result.result.diff.summary.removed + ' removed.');
            } catch (e) {
                setStatus('Comparison error: ' + S.sanitizeString(e.message, 200));
            }
        }, 50);
    }

    function handleCompareFile(e) {
        var input = e.target;
        var slot = input.getAttribute('data-slot');
        var files = input.files;

        if (!files || files.length === 0) { return; }

        var validation = S.validateFile(files[0]);
        if (!validation.valid) {
            setStatus(validation.error);
            return;
        }

        var reader = new FileReader();
        reader.onload = function (ev) {
            var content = ev.target.result;
            var sizeCheck = S.validateSize(content);
            if (!sizeCheck.valid) {
                setStatus(sizeCheck.error);
                return;
            }

            if (slot === 'a') {
                dom.compareA.value = content;
            } else {
                dom.compareB.value = content;
            }
            setStatus('Trace ' + slot.toUpperCase() + ' loaded.');
        };
        reader.onerror = function () {
            setStatus('Failed to read file.');
        };
        reader.readAsText(files[0]);
    }

    /* ---- Share ---- */

    function handleShare() {
        if (!_traceData) {
            setStatus('No trace data to share.');
            return;
        }

        var result = SHR.generateShareURL(_traceData);

        if (!result.success) {
            setStatus(result.error);
            dom.shareOutput.hidden = true;
            return;
        }

        dom.shareUrl.value = result.url;
        dom.shareOutput.hidden = false;

        if (result.warning) {
            S.safeSetText(dom.shareWarning, result.warning);
            dom.shareWarning.hidden = false;
        } else {
            dom.shareWarning.hidden = true;
        }

        setStatus('Share URL generated. Data is encoded in the URL fragment (not sent to any server).');
    }

    function handleCopyShare() {
        var url = dom.shareUrl.value;
        if (!url) { return; }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () {
                setStatus('Share URL copied to clipboard.');
            }).catch(function () {
                fallbackCopy(url);
            });
        } else {
            fallbackCopy(url);
        }
    }

    function fallbackCopy(text) {
        dom.shareUrl.select();
        try {
            document.execCommand('copy');
            setStatus('Share URL copied to clipboard.');
        } catch (e) {
            setStatus('Could not copy automatically. Please copy the URL manually.');
        }
    }

    /* ---- Share URL Detection ---- */

    function checkShareURL() {
        var hash = window.location.hash;
        if (hash && hash.indexOf('#ct1:') === 0) {
            setStatus('Detected shared trace URL. Decoding...');

            var result = SHR.decodeShareURL(hash);
            if (result.success) {
                _traceData = result.data;
                _analysisResult = AN.analyze(_traceData);

                TL.init(dom.timelineContainer);
                TL.render(_traceData);
                renderAnalyzer(_analysisResult);

                dom.btnExportJSON.disabled = false;
                dom.btnExportMd.disabled = false;
                dom.btnExportHTML.disabled = false;
                dom.btnShare.disabled = false;

                var msg = 'Loaded shared trace: ' + _traceData.steps.length + ' steps.';
                if (_traceData.meta.truncated) {
                    msg += ' (truncated)';
                }
                setStatus(msg);
                switchView('timeline');
            } else {
                setStatus('Failed to decode shared URL: ' + result.error);
            }

            // Clear hash to prevent re-loading
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', window.location.pathname);
            }
        }
    }

    /* ---- Theme ---- */

    function toggleTheme() {
        var html = document.documentElement;
        var current = html.getAttribute('data-theme');
        var next = current === 'light' ? 'dark' : 'light';
        html.setAttribute('data-theme', next);

        // Persist preference
        try {
            localStorage.setItem('clawtrace-theme', next);
        } catch (e) {
            // localStorage may not be available — ignore silently
        }

        updateThemeButton(next);
    }

    function applyStoredTheme() {
        try {
            var stored = localStorage.getItem('clawtrace-theme');
            if (stored === 'light' || stored === 'dark') {
                document.documentElement.setAttribute('data-theme', stored);
                updateThemeButton(stored);
                return;
            }
        } catch (e) {
            // ignore
        }

        // Default: dark, or respect system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            document.documentElement.setAttribute('data-theme', 'light');
            updateThemeButton('light');
        }
    }

    function updateThemeButton(theme) {
        var icon = theme === 'light' ? '\u2600' : '\u263E'; // ☀ / ☾
        S.safeSetText(dom.btnThemeToggle.querySelector('span') || dom.btnThemeToggle, icon);
    }

    /* ---- UI Helpers ---- */

    function setStatus(msg) {
        if (dom.statusMessage) {
            S.safeSetText(dom.statusMessage, msg);
        }
    }

    function showFeedback(msg, type) {
        if (!dom.inputFeedback) { return; }
        dom.inputFeedback.hidden = false;
        dom.inputFeedback.className = 'feedback-panel feedback-' + (type || 'info');
        S.safeSetText(dom.inputFeedback, msg);
    }

    function hideFeedback() {
        if (dom.inputFeedback) {
            dom.inputFeedback.hidden = true;
        }
    }

    /* ---- Example Trace ---- */

    function getExampleTrace() {
        return JSON.stringify([
            {
                "role": "system",
                "content": "You are a helpful coding assistant. Answer concisely and provide working code examples."
            },
            {
                "role": "user",
                "content": "How do I reverse a string in Python?"
            },
            {
                "role": "assistant",
                "content": "You can reverse a string in Python using slicing:\n\n```python\ntext = \"Hello, World!\"\nreversed_text = text[::-1]\nprint(reversed_text)  # Output: !dlroW ,olleH\n```\n\nAlternatively, you can use the `reversed()` function:\n\n```python\nreversed_text = ''.join(reversed(text))\n```"
            },
            {
                "role": "user",
                "content": "What about JavaScript?"
            },
            {
                "role": "assistant",
                "content": "In JavaScript, you can reverse a string by converting it to an array, reversing, and joining:\n\n```javascript\nconst text = \"Hello, World!\";\nconst reversed = text.split('').reverse().join('');\nconsole.log(reversed); // !dlroW ,olleH\n```\n\nNote: This doesn't handle Unicode characters properly. For Unicode-safe reversal:\n\n```javascript\nconst reversed = [...text].reverse().join('');\n```"
            },
            {
                "role": "user",
                "content": "Can you write a function that handles edge cases?"
            },
            {
                "role": "assistant",
                "content": "I think this should handle most cases, though I'm not entirely sure about all emoji combinations:\n\n```javascript\nfunction reverseString(str) {\n  if (typeof str !== 'string') return '';\n  if (str.length <= 1) return str;\n  return [...str].reverse().join('');\n}\n```\n\nActually, wait — let me correct that. The spread operator handles most Unicode but may still have issues with some complex emoji sequences using ZWJ (Zero Width Joiner). For production use, you might want a library like `grapheme-splitter`.",
                "tool_calls": [
                    {
                        "function": {
                            "name": "code_search",
                            "arguments": "{\"query\": \"Unicode-safe string reversal JavaScript\"}"
                        }
                    }
                ]
            },
            {
                "role": "tool",
                "content": "Found 3 results:\n1. MDN: String.prototype.split() - recommends Array.from() for Unicode\n2. Stack Overflow: Reversing Unicode strings - discusses grapheme clusters\n3. TC39 Proposal: Intl.Segmenter - native grapheme segmentation",
                "name": "code_search"
            },
            {
                "role": "assistant",
                "content": "Based on the search results, here's a more robust solution:\n\n```javascript\nfunction reverseString(str) {\n  if (typeof str !== 'string') return '';\n  if (str.length <= 1) return str;\n  \n  // Use Intl.Segmenter for proper grapheme handling\n  if (typeof Intl !== 'undefined' && Intl.Segmenter) {\n    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });\n    const segments = [...segmenter.segment(str)];\n    return segments.map(s => s.segment).reverse().join('');\n  }\n  \n  // Fallback for older browsers\n  return [...str].reverse().join('');\n}\n```\n\nThis handles emoji like 👨‍👩‍👧‍👦 correctly in modern browsers."
            },
            {
                "role": "user",
                "content": "That's great! How does performance compare?"
            },
            {
                "role": "assistant",
                "content": "Performance comparison for reversing a 10,000-character string:\n\n| Method | Operations/sec | Notes |\n|--------|---------------|-------|\n| split/reverse/join | ~150,000 | Fastest, not Unicode-safe |\n| [...spread].reverse | ~45,000 | Good Unicode support |\n| Intl.Segmenter | ~12,000 | Best Unicode support |\n| for loop (manual) | ~120,000 | Fast, not Unicode-safe |\n\nFor most applications, the spread operator approach offers the best balance of correctness and performance. The Intl.Segmenter approach is best when you need to handle complex emoji sequences correctly.\n\nNote: These are approximate benchmarks and may vary by environment."
            }
        ], null, 2);
    }

    /* ---- Bootstrap ---- */

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* ---- Public API (minimal, for testing) ---- */
    return {
        switchView: switchView,
        getTraceData: function () { return _traceData; },
        getAnalysis: function () { return _analysisResult; }
    };

})();
