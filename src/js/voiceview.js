/**
 * Clawtrace — Voice Interaction Viewer
 * ============================================================
 * Specialized viewer for OpenClaw Voice Wake / Talk Mode traces.
 *   - Speech-to-text transcription display
 *   - Response generation pipeline
 *   - Audio/TTS segments
 *   - Voice latency waterfall
 *
 * 100% offline · zero dependencies · safe DOM rendering
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.VoiceView = (function () {

    var S = Clawtrace.Sanitizer;
    var _container = null;

    var VOICE_PATTERNS = [
        { pattern: /voice[_\-]?wake|voicewake|wake\s*word/i, type: 'wake', label: 'Voice Wake' },
        { pattern: /talk[_\-]?mode|push[_\-]?to[_\-]?talk|ptt/i, type: 'talk', label: 'Talk Mode' },
        { pattern: /transcri(?:be|ption)|speech[_\-]?to[_\-]?text|stt|whisper/i, type: 'stt', label: 'Speech-to-Text' },
        { pattern: /text[_\-]?to[_\-]?speech|tts|elevenlabs|audio[_\-]?(?:output|response)/i, type: 'tts', label: 'Text-to-Speech' },
        { pattern: /audio|voice|speak|listen/i, type: 'audio', label: 'Audio' },
        { pattern: /microphone|mic/i, type: 'mic', label: 'Microphone' }
    ];

    function init(container) { _container = container; }

    function render(traceData) {
        if (!_container || !traceData) { return; }
        while (_container.firstChild) { _container.removeChild(_container.firstChild); }

        var voice = analyzeVoice(traceData);
        renderSummary(voice);
        renderPipeline(voice);
        renderVoiceEvents(voice);
    }

    function analyzeVoice(traceData) {
        var events = [];
        var hasVoice = false;

        for (var i = 0; i < traceData.steps.length; i++) {
            var step = traceData.steps[i];
            var content = step.content || '';

            for (var p = 0; p < VOICE_PATTERNS.length; p++) {
                if (VOICE_PATTERNS[p].pattern.test(content)) {
                    hasVoice = true;
                    events.push({
                        step: i,
                        type: VOICE_PATTERNS[p].type,
                        label: VOICE_PATTERNS[p].label,
                        content: content.substring(0, 300),
                        stepType: step.type
                    });
                    break;
                }
            }
        }

        var typeCounts = {};
        for (var e = 0; e < events.length; e++) {
            typeCounts[events[e].type] = (typeCounts[events[e].type] || 0) + 1;
        }

        return { events: events, hasVoice: hasVoice, typeCounts: typeCounts };
    }

    function renderSummary(voice) {
        var section = S.createElement('div', { 'class': 'vv-summary' });
        var title = S.createElement('h3', { 'class': 'vv-section-title' }, 'Voice Interaction Analysis');
        section.appendChild(title);

        if (!voice.hasVoice) {
            section.appendChild(S.createElement('div', { 'class': 'vv-empty' },
                'No voice interactions detected in this trace. OpenClaw supports Voice Wake (always-on wake word detection), ' +
                'Talk Mode (continuous conversation), and Text-to-Speech via ElevenLabs on macOS, iOS, and Android. ' +
                'Load a voice-enabled trace to see the interaction pipeline.'));
            _container.appendChild(section);
            return;
        }

        var grid = S.createElement('div', { 'class': 'vv-stat-grid' });
        var stats = [
            { label: 'Voice Events', value: String(voice.events.length) },
            { label: 'Wake Events', value: String(voice.typeCounts['wake'] || 0) },
            { label: 'STT Events', value: String(voice.typeCounts['stt'] || 0) },
            { label: 'TTS Events', value: String(voice.typeCounts['tts'] || 0) }
        ];

        for (var i = 0; i < stats.length; i++) {
            var card = S.createElement('div', { 'class': 'vv-stat-card' });
            card.appendChild(S.createElement('div', { 'class': 'vv-stat-value' }, stats[i].value));
            card.appendChild(S.createElement('div', { 'class': 'vv-stat-label' }, stats[i].label));
            grid.appendChild(card);
        }
        section.appendChild(grid);
        _container.appendChild(section);
    }

    function renderPipeline(voice) {
        if (!voice.hasVoice) { return; }

        var section = S.createElement('div', { 'class': 'vv-pipeline' });
        var title = S.createElement('h3', { 'class': 'vv-section-title' }, 'Voice Pipeline');
        section.appendChild(title);

        var pipe = S.createElement('div', { 'class': 'vv-pipe-flow' });
        var stages = [
            { label: 'Wake Word', icon: '\u{1F3A4}', active: (voice.typeCounts['wake'] || 0) > 0 },
            { label: 'Record', icon: '\u23FA', active: (voice.typeCounts['mic'] || 0) > 0 || (voice.typeCounts['stt'] || 0) > 0 },
            { label: 'Transcribe', icon: '\u{1F4DD}', active: (voice.typeCounts['stt'] || 0) > 0 },
            { label: 'Process', icon: '\u2699', active: true },
            { label: 'Synthesize', icon: '\u{1F50A}', active: (voice.typeCounts['tts'] || 0) > 0 },
            { label: 'Playback', icon: '\u25B6', active: (voice.typeCounts['tts'] || 0) > 0 }
        ];

        for (var i = 0; i < stages.length; i++) {
            if (i > 0) {
                pipe.appendChild(S.createElement('span', { 'class': 'vv-pipe-arrow' }, '\u2192'));
            }
            var stage = S.createElement('div', {
                'class': 'vv-pipe-stage' + (stages[i].active ? ' vv-pipe-active' : '')
            });
            stage.appendChild(S.createElement('div', { 'class': 'vv-pipe-icon' }, stages[i].icon));
            stage.appendChild(S.createElement('div', { 'class': 'vv-pipe-label' }, stages[i].label));
            pipe.appendChild(stage);
        }

        section.appendChild(pipe);
        _container.appendChild(section);
    }

    function renderVoiceEvents(voice) {
        if (voice.events.length === 0) { return; }

        var section = S.createElement('div', { 'class': 'vv-events' });
        var title = S.createElement('h3', { 'class': 'vv-section-title' }, 'Voice Event Log');
        section.appendChild(title);

        var TYPE_COLORS = { wake: '#FF4500', talk: '#22c55e', stt: '#3b82f6', tts: '#a78bfa', audio: '#f59e0b', mic: '#06b6d4' };

        for (var i = 0; i < voice.events.length; i++) {
            var ev = voice.events[i];
            var item = S.createElement('div', { 'class': 'vv-event' });
            var badge = S.createElement('span', { 'class': 'vv-event-badge' }, ev.label);
            badge.style.borderColor = TYPE_COLORS[ev.type] || '#8B949E';
            item.appendChild(badge);
            item.appendChild(S.createElement('span', { 'class': 'vv-event-step' }, 'Step ' + (ev.step + 1)));
            item.appendChild(S.createElement('div', { 'class': 'vv-event-preview' },
                ev.content.substring(0, 150)));
            section.appendChild(item);
        }

        _container.appendChild(section);
    }

    return { init: init, render: render };
})();
