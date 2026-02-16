/**
 * Clawtrace — Timeline Module
 * ============================================================
 * Renders the interaction timeline with expandable steps,
 * color coding, filtering, and safe DOM rendering.
 *
 * All content is rendered via textContent / createElement —
 * never innerHTML with user data.
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Timeline = (function () {

    var S = Clawtrace.Sanitizer;

    /* ---- State ---- */
    var _container = null;
    var _traceData = null;
    var _filter = 'all';

    /* ---- Type Display Config ---- */
    var TYPE_LABELS = {
        user: 'User',
        assistant: 'Assistant',
        tool_call: 'Tool Call',
        reasoning: 'Reasoning',
        error: 'Error',
        system: 'System'
    };

    var TYPE_ICONS = {
        user: '\u25B6',       // ▶
        assistant: '\u2726',  // ✦
        tool_call: '\u2699',  // ⚙
        reasoning: '\u2731',  // ✱
        error: '\u26A0',      // ⚠
        system: '\u2588'      // █
    };

    /* ---- Rendering ---- */

    /**
     * Initializes the timeline module.
     *
     * @param {HTMLElement} container - The #timeline-container element
     */
    function init(container) {
        _container = container;
    }

    /**
     * Renders the full timeline from parsed trace data.
     *
     * @param {Object} traceData - Parsed TraceData object
     */
    function render(traceData) {
        if (!_container) { return; }
        _traceData = traceData;
        _filter = 'all';

        renderSteps();
    }

    /**
     * Renders steps according to current filter.
     */
    function renderSteps() {
        if (!_container || !_traceData) { return; }

        // Clear container safely
        while (_container.firstChild) {
            _container.removeChild(_container.firstChild);
        }

        var steps = _traceData.steps || [];
        var renderedCount = 0;

        for (var i = 0; i < steps.length; i++) {
            var step = steps[i];

            // Apply filter
            if (_filter !== 'all' && step.type !== _filter) {
                continue;
            }

            var stepEl = buildStepElement(step);
            _container.appendChild(stepEl);
            renderedCount++;
        }

        if (renderedCount === 0) {
            var empty = S.createElement('p', { 'class': 'no-data' }, 'No steps match the current filter.');
            _container.appendChild(empty);
        }
    }

    /**
     * Builds a single timeline step element.
     *
     * @param {Object} step - Step data
     * @returns {HTMLElement}
     */
    function buildStepElement(step) {
        var wrapper = S.createElement('div', {
            'class': 'timeline-step',
            'role': 'listitem',
            'data-index': String(step.index),
            'data-type': step.type
        });

        // Header (clickable to expand)
        var header = S.createElement('div', {
            'class': 'step-header',
            'tabindex': '0',
            'role': 'button',
            'aria-expanded': 'false',
            'aria-controls': 'step-body-' + step.index
        });

        // Indicator dot
        var indicator = S.createElement('span', {
            'class': 'step-indicator type-' + step.type,
            'title': TYPE_LABELS[step.type] || 'Unknown'
        });

        // Step index
        var indexEl = S.createElement('span', { 'class': 'step-index' }, '#' + step.index);

        // Type badge
        var typeEl = S.createElement('span', { 'class': 'step-type' });
        typeEl.textContent = (TYPE_ICONS[step.type] || '') + ' ' + (TYPE_LABELS[step.type] || step.type);

        // Summary
        var summaryEl = S.createElement('span', { 'class': 'step-summary' }, step.summary);

        // Toggle icon
        var toggleEl = S.createElement('span', {
            'class': 'step-toggle',
            'aria-hidden': 'true'
        }, '\u25B6'); // ▶

        header.appendChild(indicator);
        header.appendChild(indexEl);
        header.appendChild(typeEl);
        header.appendChild(summaryEl);
        header.appendChild(toggleEl);

        // Body (expandable)
        var body = S.createElement('div', {
            'class': 'step-body',
            'id': 'step-body-' + step.index
        });

        // Render content as safe text
        body.textContent = step.content;

        // Add metadata if available
        if (step.metadata && Object.keys(step.metadata).length > 0) {
            var metaSeparator = S.createElement('div', {
                'style': 'margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 0.75rem; color: var(--text-muted);'
            });
            metaSeparator.textContent = '— Metadata —';
            body.appendChild(metaSeparator);

            var keys = Object.keys(step.metadata);
            for (var k = 0; k < keys.length; k++) {
                var metaLine = S.createElement('div', {
                    'style': 'font-size: 0.75rem; color: var(--text-muted);'
                });
                metaLine.textContent = keys[k] + ': ' + step.metadata[keys[k]];
                body.appendChild(metaLine);
            }
        }

        // Toggle handler
        header.addEventListener('click', function () {
            toggleStep(header, body, toggleEl);
        });
        header.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleStep(header, body, toggleEl);
            }
        });

        wrapper.appendChild(header);
        wrapper.appendChild(body);

        return wrapper;
    }

    /**
     * Toggles the expanded state of a step.
     */
    function toggleStep(header, body, toggleEl) {
        var isOpen = body.classList.contains('open');

        if (isOpen) {
            body.classList.remove('open');
            toggleEl.classList.remove('open');
            header.setAttribute('aria-expanded', 'false');
        } else {
            body.classList.add('open');
            toggleEl.classList.add('open');
            header.setAttribute('aria-expanded', 'true');
        }
    }

    /**
     * Sets the filter and re-renders.
     *
     * @param {string} filterType
     */
    function setFilter(filterType) {
        _filter = filterType || 'all';
        renderSteps();
    }

    /**
     * Expands all steps.
     */
    function expandAll() {
        if (!_container) { return; }
        var bodies = _container.querySelectorAll('.step-body');
        var toggles = _container.querySelectorAll('.step-toggle');
        var headers = _container.querySelectorAll('.step-header');

        for (var i = 0; i < bodies.length; i++) {
            bodies[i].classList.add('open');
        }
        for (var j = 0; j < toggles.length; j++) {
            toggles[j].classList.add('open');
        }
        for (var h = 0; h < headers.length; h++) {
            headers[h].setAttribute('aria-expanded', 'true');
        }
    }

    /**
     * Collapses all steps.
     */
    function collapseAll() {
        if (!_container) { return; }
        var bodies = _container.querySelectorAll('.step-body');
        var toggles = _container.querySelectorAll('.step-toggle');
        var headers = _container.querySelectorAll('.step-header');

        for (var i = 0; i < bodies.length; i++) {
            bodies[i].classList.remove('open');
        }
        for (var j = 0; j < toggles.length; j++) {
            toggles[j].classList.remove('open');
        }
        for (var h = 0; h < headers.length; h++) {
            headers[h].setAttribute('aria-expanded', 'false');
        }
    }

    /**
     * Returns the current trace data (for export).
     */
    function getData() {
        return _traceData;
    }

    /* ---- Public API ---- */
    return {
        init: init,
        render: render,
        setFilter: setFilter,
        expandAll: expandAll,
        collapseAll: collapseAll,
        getData: getData
    };

})();
