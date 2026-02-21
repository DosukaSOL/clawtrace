/**
 * Clawtrace — Plugin System (v2.1)
 * ============================================================
 * A lightweight plugin registry that lets external modules
 * register themselves as Clawtrace plugins.
 *
 * Built-in plugins (OTLP, Patterns, Custom Rules, Storage,
 * Annotations, Bookmarks) are auto-registered. Third-party
 * plugins can be registered from the browser console:
 *
 *   Clawtrace.Plugins.register({
 *     id:          'my-plugin',
 *     name:        'My Plugin',
 *     version:     '1.0.0',
 *     description: 'What it does.',
 *     author:      'You',
 *     category:    'Analysis',
 *     icon:        '🔌'
 *   });
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Plugins = (function () {

    var S = Clawtrace.Sanitizer;

    var _container = null;
    var _registry  = [];

    var BUILTIN_PLUGINS = [
        {
            id:          'otlp',
            name:        'OpenTelemetry Support',
            version:     '1.0.0',
            description: 'Parse OpenTelemetry (OTLP) JSON traces. Converts resourceSpans / ' +
                         'scopeSpans / spans into Clawtrace steps for analysis.',
            author:      'Clawtrace Core',
            category:    'Parser',
            icon:        '\uD83D\uDD0D',
            builtin:     true
        },
        {
            id:          'patterns',
            name:        'Community Pattern Library',
            version:     '1.0.0',
            description: 'Curated detection patterns (LLM behaviour, security, performance, ' +
                         'quality, OpenClaw-specific). Toggle patterns on/off per trace.',
            author:      'Clawtrace Community',
            category:    'Analysis',
            icon:        '\uD83C\uDFAF',
            builtin:     true
        },
        {
            id:          'customrules',
            name:        'Custom Analysis Rules',
            version:     '1.0.0',
            description: 'Write your own regex-based detection rules with custom severity ' +
                         'levels and categories. Rules persist in localStorage.',
            author:      'Clawtrace Core',
            category:    'Analysis',
            icon:        '\uD83D\uDD27',
            builtin:     true
        },
        {
            id:          'storage',
            name:        'Local Trace Storage',
            version:     '1.0.0',
            description: 'Opt-in IndexedDB storage for saving and reloading traces across ' +
                         'browser sessions. Nothing is ever uploaded.',
            author:      'Clawtrace Core',
            category:    'Storage',
            icon:        '\uD83D\uDCBE',
            builtin:     true
        },
        {
            id:          'annotations',
            name:        'Trace Annotations',
            version:     '1.0.0',
            description: 'Attach free-text notes to individual trace steps. ' +
                         'Notes persist in localStorage.',
            author:      'Clawtrace Core',
            category:    'Core',
            icon:        '\uD83D\uDCDD',
            builtin:     true
        },
        {
            id:          'bookmarks',
            name:        'Step Bookmarks',
            version:     '1.0.0',
            description: 'Star / bookmark trace steps for quick reference. ' +
                         'Bookmarks persist per-trace in localStorage.',
            author:      'Clawtrace Core',
            category:    'Core',
            icon:        '\u2605',
            builtin:     true
        },
        {
            id:          'wasmparser',
            name:        'Async Parser (WASM-ready)',
            version:     '1.0.0',
            description: 'Async chunked processing for traces \u2265\u00A0512\u00A0KB. ' +
                         'Architecture is WASM-ready for future near-native parse performance.',
            author:      'Clawtrace Core',
            category:    'Parser',
            icon:        '\u26A1',
            builtin:     true
        },
        {
            id:          'shortcuts',
            name:        'Keyboard Shortcut System',
            version:     '1.0.0',
            description: 'Global keyboard shortcuts for navigation and timeline control. ' +
                         'Press \u201C?\u201D to see the full list.',
            author:      'Clawtrace Core',
            category:    'Core',
            icon:        '\u2328\uFE0F',
            builtin:     true
        }
    ];

    /* ---- Public ---- */

    function init(container) {
        _container = container;
        BUILTIN_PLUGINS.forEach(register);
    }

    function render() {
        _renderView();
    }

    /**
     * Register a plugin. Duplicate IDs are ignored.
     * @param {Object} plugin
     * @returns {boolean} true if registered
     */
    function register(plugin) {
        if (!plugin || !plugin.id) { return false; }
        for (var i = 0; i < _registry.length; i++) {
            if (_registry[i].id === plugin.id) { return false; }
        }
        _registry.push(plugin);
        return true;
    }

    /** Returns all registered plugins. */
    function getAll() { return _registry.slice(); }

    /* ---- View ---- */

    function _renderView() {
        if (!_container) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        // Header
        var hdr = S.createElement('div', { 'class': 'analyzer-card full-width' });
        hdr.appendChild(S.createElement('h3', { 'class': 'card-title' }, 'Plugin Manager'));
        hdr.appendChild(S.createElement('p', { 'class': 'view-desc' },
            _registry.length + ' plugins registered (' +
            _registry.filter(function (p) { return p.builtin; }).length + ' built-in). ' +
            'All built-in plugins are always active. Third-party plugins can be ' +
            'registered via the console API below.'));
        _container.appendChild(hdr);

        // Group by category
        var groups = {};
        _registry.forEach(function (p) {
            var cat = p.category || 'Other';
            if (!groups[cat]) { groups[cat] = []; }
            groups[cat].push(p);
        });

        Object.keys(groups).sort().forEach(function (cat) {
            var card = S.createElement('div', { 'class': 'analyzer-card full-width' });
            card.appendChild(S.createElement('h3', { 'class': 'card-title' }, cat));
            var grid = S.createElement('div', { 'class': 'plugins-grid' });
            groups[cat].forEach(function (p) { grid.appendChild(_buildPluginCard(p)); });
            card.appendChild(grid);
            _container.appendChild(card);
        });

        // Console API reference
        var apiCard = S.createElement('div', { 'class': 'analyzer-card full-width' });
        apiCard.appendChild(S.createElement('h3', { 'class': 'card-title' }, 'Plugin API'));
        apiCard.appendChild(S.createElement('p', { 'class': 'hint-text' },
            'Register a community plugin from the browser DevTools console:'));
        var pre = S.createElement('pre', { 'class': 'plugin-code-example' });
        pre.textContent =
            'Clawtrace.Plugins.register({\n' +
            '  id:          "my-plugin",\n' +
            '  name:        "My Plugin",\n' +
            '  version:     "1.0.0",\n' +
            '  description: "What it does.",\n' +
            '  author:      "Your Name",\n' +
            '  category:    "Analysis",   // Parser | Analysis | Storage | Core | Other\n' +
            '  icon:        "\uD83E\uDDE9"            // emoji icon\n' +
            '});';
        apiCard.appendChild(pre);
        _container.appendChild(apiCard);
    }

    function _buildPluginCard(plugin) {
        var card = S.createElement('div', {
            'class': 'plugin-card' + (plugin.builtin ? ' plugin-builtin' : '')
        });

        var cardHdr = S.createElement('div', { 'class': 'plugin-card-header' });
        cardHdr.appendChild(S.createElement('span', {
            'class': 'plugin-icon', 'aria-hidden': 'true'
        }, plugin.icon || '\uD83E\uDDE9'));

        var nameWrap = S.createElement('div', { 'class': 'plugin-name-wrap' });
        nameWrap.appendChild(S.createElement('strong', { 'class': 'plugin-name' }, plugin.name));
        nameWrap.appendChild(S.createElement('span', {
            'class': 'plugin-version hint-text'
        }, 'v' + (plugin.version || '1.0.0')));
        cardHdr.appendChild(nameWrap);

        if (plugin.builtin) {
            cardHdr.appendChild(S.createElement('span', { 'class': 'plugin-builtin-badge' },
                'built-in'));
        }
        card.appendChild(cardHdr);

        card.appendChild(S.createElement('p', { 'class': 'plugin-desc hint-text' },
            plugin.description || ''));

        if (plugin.author) {
            card.appendChild(S.createElement('p', {
                'class': 'hint-text', 'style': 'font-size:0.7rem;margin-top:4px;'
            }, 'by ' + plugin.author));
        }

        return card;
    }

    /* ---- Public API ---- */
    return {
        init: init,
        render: render,
        register: register,
        getAll: getAll
    };

})();
