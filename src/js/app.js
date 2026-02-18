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
    var RPL = Clawtrace.Replay;
    var HM = Clawtrace.Heatmap;
    var RDR = Clawtrace.Radar;
    var CC = Clawtrace.CostCalc;
    var BR = Clawtrace.BugReport;
    var FG = Clawtrace.FlowGraph;
    var SES = Clawtrace.Session;
    var TP = Clawtrace.ToolProfiler;
    var AM = Clawtrace.AgentMap;
    var CHD = Clawtrace.ChannelDiff;
    var RT = Clawtrace.Routing;
    var CMD = Clawtrace.ChatCmd;
    var SKG = Clawtrace.SkillGraph;
    var CVR = Clawtrace.CanvasReplay;
    var VV = Clawtrace.VoiceView;
    var BRR = Clawtrace.BrowserReplay;
    var NA = Clawtrace.NodeActivity;
    var CRT = Clawtrace.CronTimeline;
    var INJ = Clawtrace.InjScan;
    var SBX = Clawtrace.Sandbox;
    var BEN = Clawtrace.Benchmark;
    var FO = Clawtrace.Failover;
    var CFG = Clawtrace.ConfigRec;
    var TI = Clawtrace.TraceIssue;
    var TS = Clawtrace.TraceShare;

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
        RPL.init(dom.replayContainer);
        HM.init(dom.heatmapContainer);
        RDR.init(dom.radarContainer);
        CC.init(dom.costcalcContainer);
        BR.init(dom.bugreportContainer);
        FG.init(dom.flowgraphContainer);
        SES.init(dom.sessionContainer);
        TP.init(dom.toolprofilerContainer);
        AM.init(dom.agentmapContainer);
        CHD.init(dom.channeldiffContainer);
        RT.init(dom.routingContainer);
        CMD.init(dom.chatcmdContainer);
        SKG.init(dom.skillgraphContainer);
        CVR.init(dom.canvasreplayContainer);
        VV.init(dom.voiceviewContainer);
        BRR.init(dom.browserreplayContainer);
        NA.init(dom.nodeactivityContainer);
        CRT.init(dom.crontimelineContainer);
        INJ.init(dom.injscanContainer);
        SBX.init(dom.sandboxContainer);
        BEN.init(dom.benchmarkContainer);
        FO.init(dom.failoverContainer);
        CFG.init(dom.configrecContainer);
        TI.init(dom.traceissueContainer);
        TS.init(dom.traceshareContainer);
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

        // v1.1 views
        dom.replayContainer = document.getElementById('replay-container');
        dom.heatmapContainer = document.getElementById('heatmap-container');
        dom.radarContainer = document.getElementById('radar-container');
        dom.costcalcContainer = document.getElementById('costcalc-container');
        dom.bugreportContainer = document.getElementById('bugreport-container');
        dom.flowgraphContainer = document.getElementById('flowgraph-container');

        // v2.0 views
        dom.sessionContainer = document.getElementById('session-container');
        dom.toolprofilerContainer = document.getElementById('toolprofiler-container');
        dom.agentmapContainer = document.getElementById('agentmap-container');
        dom.channeldiffContainer = document.getElementById('channeldiff-container');
        dom.routingContainer = document.getElementById('routing-container');
        dom.chatcmdContainer = document.getElementById('chatcmd-container');
        dom.skillgraphContainer = document.getElementById('skillgraph-container');
        dom.canvasreplayContainer = document.getElementById('canvasreplay-container');
        dom.voiceviewContainer = document.getElementById('voiceview-container');
        dom.browserreplayContainer = document.getElementById('browserreplay-container');
        dom.nodeactivityContainer = document.getElementById('nodeactivity-container');
        dom.crontimelineContainer = document.getElementById('crontimeline-container');
        dom.injscanContainer = document.getElementById('injscan-container');
        dom.sandboxContainer = document.getElementById('sandbox-container');
        dom.benchmarkContainer = document.getElementById('benchmark-container');
        dom.failoverContainer = document.getElementById('failover-container');
        dom.configrecContainer = document.getElementById('configrec-container');
        dom.traceissueContainer = document.getElementById('traceissue-container');
        dom.traceshareContainer = document.getElementById('traceshare-container');
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

                // Render new views
                RPL.render(_traceData);
                HM.render(_traceData, _analysisResult);
                RDR.render(_traceData, _analysisResult);
                CC.render(_traceData);
                BR.render(_traceData, _analysisResult);
                FG.render(_traceData);

                // v2.0 views
                SES.render(_traceData);
                TP.render(_traceData);
                AM.render(_traceData);
                CHD.render(_traceData, _analysisResult);
                RT.render(_traceData);
                CMD.render(_traceData);
                SKG.render(_traceData);
                CVR.render(_traceData);
                VV.render(_traceData);
                BRR.render(_traceData);
                NA.render(_traceData);
                CRT.render(_traceData);
                INJ.render(_traceData);
                SBX.render(_traceData);
                BEN.render(_traceData, _analysisResult);
                FO.render(_traceData);
                CFG.render(_traceData, _analysisResult);
                TI.render(_traceData, _analysisResult);
                TS.render(_traceData);

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

                // Render new views
                RPL.render(_traceData);
                HM.render(_traceData, _analysisResult);
                RDR.render(_traceData, _analysisResult);
                CC.render(_traceData);
                BR.render(_traceData, _analysisResult);
                FG.render(_traceData);

                // v2.0 views
                SES.render(_traceData);
                TP.render(_traceData);
                AM.render(_traceData);
                CHD.render(_traceData, _analysisResult);
                RT.render(_traceData);
                CMD.render(_traceData);
                SKG.render(_traceData);
                CVR.render(_traceData);
                VV.render(_traceData);
                BRR.render(_traceData);
                NA.render(_traceData);
                CRT.render(_traceData);
                INJ.render(_traceData);
                SBX.render(_traceData);
                BEN.render(_traceData, _analysisResult);
                FO.render(_traceData);
                CFG.render(_traceData, _analysisResult);
                TI.render(_traceData, _analysisResult);
                TS.render(_traceData);

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
                "content": "You are Pi, an OpenClaw AI agent. Connected via Gateway (ws://127.0.0.1:18789). Session: main. Model: claude-opus-4-6. Thinking: medium. Channels: WhatsApp, Telegram, Discord. Sandbox: non-main."
            },
            {
                "role": "user",
                "content": "/status"
            },
            {
                "role": "assistant",
                "content": "**Status Report**\n- Model: claude-opus-4-6\n- Session: main (elevated)\n- Thinking: medium\n- Verbose: off\n- Connected channels: WhatsApp, Telegram, Discord\n- Uptime: 4h 23m\n- Context: 18,432 / 200,000 tokens\n- Skills: 12 active (3 custom)\n- Nodes: macOS (primary), iOS (connected)"
            },
            {
                "role": "user",
                "content": "Can you check what cron jobs are running and then read my calendar for tomorrow?"
            },
            {
                "role": "assistant",
                "content": "I'll check your cron jobs and calendar. Let me use the tools.",
                "tool_calls": [
                    {
                        "function": {
                            "name": "cron.list",
                            "arguments": "{}"
                        }
                    }
                ]
            },
            {
                "role": "tool",
                "content": "Active cron jobs:\n1. daily-summary (0 9 * * *) - Generate daily briefing\n2. backup-notes (0 2 * * *) - Backup workspace notes\n3. weather-check (0 7 * * *) - Morning weather report",
                "name": "cron.list"
            },
            {
                "role": "assistant",
                "content": "Found 3 cron jobs. Now checking your calendar.",
                "tool_calls": [
                    {
                        "function": {
                            "name": "bash",
                            "arguments": "{\"command\": \"cat ~/.openclaw/workspace/skills/calendar/data.json | jq '.events[] | select(.date==\\\"2025-01-16\\\")'\"}"
                        }
                    }
                ]
            },
            {
                "role": "tool",
                "content": "{\"title\": \"Team standup\", \"time\": \"09:00\", \"duration\": \"30m\"}\n{\"title\": \"Design review\", \"time\": \"14:00\", \"duration\": \"1h\"}\n{\"title\": \"Gym\", \"time\": \"18:00\", \"duration\": \"1h\"}",
                "name": "bash"
            },
            {
                "role": "assistant",
                "content": "Here's your overview:\n\n**Cron Jobs (3 active)**:\n- Daily summary at 9 AM\n- Notes backup at 2 AM\n- Weather check at 7 AM\n\n**Tomorrow's Calendar**:\n- 09:00 — Team standup (30 min)\n- 14:00 — Design review (1 hour)\n- 18:00 — Gym (1 hour)\n\nYou have a clear morning after standup. Want me to schedule anything?"
            },
            {
                "role": "user",
                "content": "Send a message to my work-assistant session: prepare the design review notes"
            },
            {
                "role": "assistant",
                "content": "Sending to work-assistant session.",
                "tool_calls": [
                    {
                        "function": {
                            "name": "sessions_send",
                            "arguments": "{\"target\": \"work-assistant\", \"message\": \"Please prepare the design review notes for the 2 PM meeting tomorrow. Focus on the UI mockups and the feedback from last week.\", \"flags\": [\"REPLY_SKIP\"]}"
                        }
                    }
                ]
            },
            {
                "role": "tool",
                "content": "Message sent to session: work-assistant",
                "name": "sessions_send"
            },
            {
                "role": "assistant",
                "content": "Done! Message sent to your work-assistant session. It will prepare the design review notes and the results will be ready when you check that session.\n\nNote: The work-assistant session runs in sandbox mode (non-main), so it has limited tool access — no browser or cron, but it can read/write files in the workspace."
            },
            {
                "role": "user",
                "content": "/compact"
            },
            {
                "role": "assistant",
                "content": "Context compacted. Pruned 6,200 tokens of older conversation history. Current usage: 12,232 / 200,000 tokens."
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
