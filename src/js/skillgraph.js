/**
 * Clawtrace — Skill Dependency Graph
 * ============================================================
 * Maps OpenClaw skills to the tools they invoke
 * and shows interaction patterns.
 *   - Detect skills from trace content
 *   - Map skill → tool relationships
 *   - Interactive SVG graph
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.SkillGraph = (function () {

    var S = Clawtrace.Sanitizer;
    var _container = null;

    var BUILTIN_SKILLS = [
        'memory', 'calendar', 'contacts', 'notes', 'reminders',
        'weather', 'news', 'web-search', 'code-runner', 'translator',
        'summarizer', 'image-gen', 'math', 'file-manager', 'git'
    ];

    function init(container) { _container = container; }

    function render(traceData) {
        if (!_container || !traceData) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        var graph = buildGraph(traceData);
        renderSummary(graph);
        renderSkillMap(graph);
        renderSkillDetails(graph);
    }

    function buildGraph(traceData) {
        var skills = {};
        var toolToSkill = {};
        var allTools = [];

        for (var i = 0; i < traceData.steps.length; i++) {
            var step = traceData.steps[i];
            var content = (step.content || '');
            var lower = content.toLowerCase();
            var meta = step.metadata || {};

            // Detect skills
            var skillMatch = lower.match(/skill[s]?\s*[:=]\s*["']?([a-zA-Z0-9_\-]+)/i) ||
                            lower.match(/SKILL\.md|skills\/([a-zA-Z0-9_\-]+)/i);
            if (skillMatch) {
                var skillName = skillMatch[1] || 'unknown-skill';
                if (!skills[skillName]) {
                    skills[skillName] = { name: skillName, tools: {}, steps: [], isBuiltin: BUILTIN_SKILLS.indexOf(skillName) > -1 };
                }
                skills[skillName].steps.push(i);
            }

            // Check for builtin skill references
            for (var b = 0; b < BUILTIN_SKILLS.length; b++) {
                if (lower.indexOf(BUILTIN_SKILLS[b]) > -1 && step.type === 'tool_call') {
                    if (!skills[BUILTIN_SKILLS[b]]) {
                        skills[BUILTIN_SKILLS[b]] = { name: BUILTIN_SKILLS[b], tools: {}, steps: [], isBuiltin: true };
                    }
                }
            }

            // Track tools
            if (step.type === 'tool_call') {
                var toolName = extractToolName(content);
                allTools.push({ name: toolName, step: i });

                // Try to associate tool with most recent skill context
                for (var sk in skills) {
                    if (skills.hasOwnProperty(sk)) {
                        var lastSkillStep = skills[sk].steps.length > 0 ?
                            skills[sk].steps[skills[sk].steps.length - 1] : -1;
                        if (lastSkillStep >= 0 && i - lastSkillStep <= 5) {
                            skills[sk].tools[toolName] = (skills[sk].tools[toolName] || 0) + 1;
                        }
                    }
                }
            }

            // Detect skill from metadata
            if (meta.skill) {
                if (!skills[meta.skill]) {
                    skills[meta.skill] = { name: meta.skill, tools: {}, steps: [], isBuiltin: false };
                }
                skills[meta.skill].steps.push(i);
            }
        }

        var skillList = [];
        for (var s in skills) {
            if (skills.hasOwnProperty(s)) { skillList.push(skills[s]); }
        }
        skillList.sort(function (a, b) { return b.steps.length - a.steps.length; });

        return {
            skills: skillList,
            allTools: allTools,
            hasSkills: skillList.length > 0
        };
    }

    function extractToolName(content) {
        var match = content.match(/^(\w[\w.]*)/);
        return match ? match[1] : 'unknown';
    }

    function renderSummary(graph) {
        var section = S.createElement('div', { 'class': 'sg-summary' });
        var title = S.createElement('h3', { 'class': 'sg-section-title' }, 'Skills Overview');
        section.appendChild(title);

        if (!graph.hasSkills) {
            section.appendChild(S.createElement('div', { 'class': 'sg-empty' },
                'No skills detected in this trace. OpenClaw skills live in ~/.openclaw/workspace/skills/ and are registered via SKILL.md files. ' +
                'ClawHub (clawhub.com) provides a skill registry. Load a trace that invokes skills to see the dependency graph.'));
            _container.appendChild(section);
            return;
        }

        var grid = S.createElement('div', { 'class': 'sg-stat-grid' });
        var builtinCount = graph.skills.filter(function (s) { return s.isBuiltin; }).length;
        var customCount = graph.skills.length - builtinCount;

        var stats = [
            { label: 'Total Skills', value: String(graph.skills.length) },
            { label: 'Bundled', value: String(builtinCount) },
            { label: 'Custom/Managed', value: String(customCount) },
            { label: 'Tool Calls', value: String(graph.allTools.length) }
        ];

        for (var i = 0; i < stats.length; i++) {
            var card = S.createElement('div', { 'class': 'sg-stat-card' });
            card.appendChild(S.createElement('div', { 'class': 'sg-stat-value' }, stats[i].value));
            card.appendChild(S.createElement('div', { 'class': 'sg-stat-label' }, stats[i].label));
            grid.appendChild(card);
        }
        section.appendChild(grid);
        _container.appendChild(section);
    }

    function renderSkillMap(graph) {
        if (!graph.hasSkills) { return; }

        var section = S.createElement('div', { 'class': 'sg-map' });
        var title = S.createElement('h3', { 'class': 'sg-section-title' }, 'Skill \u2192 Tool Map');
        section.appendChild(title);

        var SVG_NS = 'http://www.w3.org/2000/svg';
        var limit = Math.min(graph.skills.length, 8);
        var width = 700;
        var rowHeight = 70;
        var height = limit * rowHeight + 40;

        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svg.setAttribute('class', 'sg-map-svg');

        var bg = document.createElementNS(SVG_NS, 'rect');
        bg.setAttribute('width', String(width));
        bg.setAttribute('height', String(height));
        bg.setAttribute('fill', 'rgba(13,17,23,0.5)');
        bg.setAttribute('rx', '8');
        svg.appendChild(bg);

        for (var i = 0; i < limit; i++) {
            var skill = graph.skills[i];
            var y = 20 + i * rowHeight;

            // Skill node
            var skillRect = document.createElementNS(SVG_NS, 'rect');
            skillRect.setAttribute('x', '10');
            skillRect.setAttribute('y', String(y));
            skillRect.setAttribute('width', '140');
            skillRect.setAttribute('height', '40');
            skillRect.setAttribute('fill', skill.isBuiltin ? 'rgba(255,69,0,0.15)' : 'rgba(34,197,94,0.15)');
            skillRect.setAttribute('stroke', skill.isBuiltin ? '#FF4500' : '#22c55e');
            skillRect.setAttribute('rx', '8');
            svg.appendChild(skillRect);

            var skillLabel = document.createElementNS(SVG_NS, 'text');
            skillLabel.setAttribute('x', '80');
            skillLabel.setAttribute('y', String(y + 25));
            skillLabel.setAttribute('text-anchor', 'middle');
            skillLabel.setAttribute('fill', '#e2e8f0');
            skillLabel.setAttribute('font-size', '11');
            skillLabel.textContent = skill.name.length > 16 ? skill.name.substring(0, 16) + '..' : skill.name;
            svg.appendChild(skillLabel);

            // Tool connections
            var toolNames = Object.keys(skill.tools);
            var toolLimit = Math.min(toolNames.length, 4);
            for (var t = 0; t < toolLimit; t++) {
                var tx = 200 + t * 130;

                var line = document.createElementNS(SVG_NS, 'line');
                line.setAttribute('x1', '150');
                line.setAttribute('y1', String(y + 20));
                line.setAttribute('x2', String(tx));
                line.setAttribute('y2', String(y + 20));
                line.setAttribute('stroke', '#8B949E');
                line.setAttribute('stroke-width', '1');
                line.setAttribute('stroke-dasharray', '3,2');
                svg.appendChild(line);

                var toolRect = document.createElementNS(SVG_NS, 'rect');
                toolRect.setAttribute('x', String(tx));
                toolRect.setAttribute('y', String(y + 5));
                toolRect.setAttribute('width', '110');
                toolRect.setAttribute('height', '30');
                toolRect.setAttribute('fill', 'rgba(139,148,158,0.1)');
                toolRect.setAttribute('stroke', '#8B949E');
                toolRect.setAttribute('rx', '4');
                svg.appendChild(toolRect);

                var toolLabel = document.createElementNS(SVG_NS, 'text');
                toolLabel.setAttribute('x', String(tx + 55));
                toolLabel.setAttribute('y', String(y + 24));
                toolLabel.setAttribute('text-anchor', 'middle');
                toolLabel.setAttribute('fill', '#8B949E');
                toolLabel.setAttribute('font-size', '10');
                var tn = toolNames[t];
                toolLabel.textContent = tn.length > 14 ? tn.substring(0, 14) + '..' : tn;
                svg.appendChild(toolLabel);
            }
        }

        section.appendChild(svg);
        _container.appendChild(section);
    }

    function renderSkillDetails(graph) {
        if (!graph.hasSkills) { return; }

        var section = S.createElement('div', { 'class': 'sg-details' });
        var title = S.createElement('h3', { 'class': 'sg-section-title' }, 'Skill Details');
        section.appendChild(title);

        for (var i = 0; i < graph.skills.length; i++) {
            var skill = graph.skills[i];
            var card = S.createElement('div', { 'class': 'sg-skill-card' });

            var header = S.createElement('div', { 'class': 'sg-skill-header' });
            header.appendChild(S.createElement('span', { 'class': 'sg-skill-name' }, skill.name));
            header.appendChild(S.createElement('span', {
                'class': 'sg-skill-badge ' + (skill.isBuiltin ? 'sg-builtin' : 'sg-custom')
            }, skill.isBuiltin ? 'Bundled' : 'Custom'));
            card.appendChild(header);

            var toolList = Object.keys(skill.tools);
            if (toolList.length > 0) {
                var tags = S.createElement('div', { 'class': 'sg-tool-tags' });
                for (var t = 0; t < toolList.length; t++) {
                    tags.appendChild(S.createElement('span', { 'class': 'sg-tool-tag' },
                        toolList[t] + ' (' + skill.tools[toolList[t]] + ')'));
                }
                card.appendChild(tags);
            }

            card.appendChild(S.createElement('div', { 'class': 'sg-skill-steps' },
                'Referenced in ' + skill.steps.length + ' step(s)'));
            section.appendChild(card);
        }

        _container.appendChild(section);
    }

    return { init: init, render: render };
})();
