/**
 * Clawtrace — Trace Replay Module
 * ============================================================
 * Animated step-by-step playback of AI traces.
 * Each step appears with typing animation, tool calls flash,
 * errors pulse. Play/pause/speed controls.
 *
 * "Watch the AI think in real-time."
 * ============================================================
 */
'use strict';

var Clawtrace = Clawtrace || {};

Clawtrace.Replay = (function () {

    var S = Clawtrace.Sanitizer;

    /* ---- State ---- */
    var _container = null;
    var _traceData = null;
    var _currentStep = -1;
    var _isPlaying = false;
    var _timer = null;
    var _typeTimer = null;
    var _speed = 1; // 0.5x, 1x, 2x, 4x
    var _onCompleteCallback = null;

    /* ---- Speed Map (ms per step) ---- */
    var SPEED_MAP = {
        0.5: 3000,
        1: 1500,
        2: 750,
        4: 350
    };

    /* ---- Type Colors ---- */
    var TYPE_COLORS = {
        user: '#3b82f6',
        assistant: '#6366f1',
        tool_call: '#f59e0b',
        reasoning: '#a78bfa',
        error: '#ef4444',
        system: '#64748b'
    };

    var TYPE_LABELS = {
        user: 'USER',
        assistant: 'ASSISTANT',
        tool_call: 'TOOL CALL',
        reasoning: 'REASONING',
        error: 'ERROR',
        system: 'SYSTEM'
    };

    /* ---- Initialize ---- */

    function init(container) {
        _container = container;
    }

    /* ---- Render Controls + Stage ---- */

    function render(traceData) {
        _traceData = traceData;
        _currentStep = -1;
        _isPlaying = false;

        if (!_container || !traceData || !traceData.steps) { return; }

        // Clear
        while (_container.firstChild) {
            _container.removeChild(_container.firstChild);
        }

        // Build replay UI
        var wrapper = S.createElement('div', { 'class': 'replay-wrapper' });

        // Progress bar
        var progressWrap = S.createElement('div', { 'class': 'replay-progress-wrap' });
        var progressBar = S.createElement('div', { 'class': 'replay-progress-bar' });
        var progressFill = S.createElement('div', { 'class': 'replay-progress-fill', 'id': 'replay-progress-fill' });
        progressBar.appendChild(progressFill);

        var progressText = S.createElement('span', { 'class': 'replay-progress-text', 'id': 'replay-progress-text' }, '0 / ' + traceData.steps.length + ' steps');
        progressWrap.appendChild(progressBar);
        progressWrap.appendChild(progressText);
        wrapper.appendChild(progressWrap);

        // Controls
        var controls = S.createElement('div', { 'class': 'replay-controls' });

        var btnRestart = S.createElement('button', { 'class': 'btn btn-sm replay-btn', 'id': 'replay-restart', 'aria-label': 'Restart' }, '\u23EE Restart');
        var btnBack = S.createElement('button', { 'class': 'btn btn-sm replay-btn', 'id': 'replay-back', 'aria-label': 'Previous step' }, '\u23EA Back');
        var btnPlay = S.createElement('button', { 'class': 'btn btn-primary replay-btn replay-play-btn', 'id': 'replay-play', 'aria-label': 'Play' }, '\u25B6 Play');
        var btnForward = S.createElement('button', { 'class': 'btn btn-sm replay-btn', 'id': 'replay-forward', 'aria-label': 'Next step' }, 'Next \u23E9');

        // Speed control
        var speedGroup = S.createElement('div', { 'class': 'replay-speed-group' });
        var speedLabel = S.createElement('span', { 'class': 'replay-speed-label' }, 'Speed:');
        speedGroup.appendChild(speedLabel);

        var speeds = [0.5, 1, 2, 4];
        for (var si = 0; si < speeds.length; si++) {
            var sb = S.createElement('button', {
                'class': 'btn btn-sm replay-speed-btn' + (speeds[si] === 1 ? ' active' : ''),
                'data-speed': String(speeds[si])
            }, speeds[si] + 'x');
            speedGroup.appendChild(sb);
        }

        controls.appendChild(btnRestart);
        controls.appendChild(btnBack);
        controls.appendChild(btnPlay);
        controls.appendChild(btnForward);
        controls.appendChild(speedGroup);
        wrapper.appendChild(controls);

        // Stage (where steps appear)
        var stage = S.createElement('div', { 'class': 'replay-stage', 'id': 'replay-stage', 'role': 'log', 'aria-label': 'Replay stage', 'aria-live': 'polite' });

        // Empty state
        var emptyMsg = S.createElement('div', { 'class': 'replay-empty' }, 'Press Play to watch the AI trace unfold step by step.');
        stage.appendChild(emptyMsg);

        wrapper.appendChild(stage);

        // Step counter
        var counter = S.createElement('div', { 'class': 'replay-counter', 'id': 'replay-counter' });
        wrapper.appendChild(counter);

        _container.appendChild(wrapper);

        // Bind events
        bindReplayEvents();
    }

    /* ---- Event Binding ---- */

    function bindReplayEvents() {
        var playBtn = document.getElementById('replay-play');
        var restartBtn = document.getElementById('replay-restart');
        var backBtn = document.getElementById('replay-back');
        var forwardBtn = document.getElementById('replay-forward');

        if (playBtn) {
            playBtn.addEventListener('click', function () {
                if (_isPlaying) {
                    pause();
                } else {
                    play();
                }
            });
        }

        if (restartBtn) {
            restartBtn.addEventListener('click', function () {
                restart();
            });
        }

        if (backBtn) {
            backBtn.addEventListener('click', function () {
                stepBack();
            });
        }

        if (forwardBtn) {
            forwardBtn.addEventListener('click', function () {
                stepForward();
            });
        }

        // Speed buttons
        var speedBtns = _container.querySelectorAll('.replay-speed-btn');
        for (var i = 0; i < speedBtns.length; i++) {
            speedBtns[i].addEventListener('click', function (e) {
                var s = parseFloat(e.currentTarget.getAttribute('data-speed'));
                if (s) { setSpeed(s); }

                // Update active class
                for (var j = 0; j < speedBtns.length; j++) {
                    speedBtns[j].classList.remove('active');
                }
                e.currentTarget.classList.add('active');
            });
        }
    }

    /* ---- Playback Controls ---- */

    function play() {
        if (!_traceData || !_traceData.steps) { return; }
        _isPlaying = true;
        updatePlayButton();
        scheduleNext();
    }

    function pause() {
        _isPlaying = false;
        if (_timer) { clearTimeout(_timer); _timer = null; }
        if (_typeTimer) { clearInterval(_typeTimer); _typeTimer = null; }
        updatePlayButton();
    }

    function restart() {
        pause();
        _currentStep = -1;

        var stage = document.getElementById('replay-stage');
        if (stage) {
            while (stage.firstChild) { stage.removeChild(stage.firstChild); }
            var emptyMsg = S.createElement('div', { 'class': 'replay-empty' }, 'Press Play to watch the AI trace unfold step by step.');
            stage.appendChild(emptyMsg);
        }

        updateProgress();
        updatePlayButton();
    }

    function stepForward() {
        if (!_traceData || _currentStep >= _traceData.steps.length - 1) { return; }
        _currentStep++;
        renderStep(_currentStep, false);
        updateProgress();
    }

    function stepBack() {
        if (_currentStep <= 0) { return; }
        // Re-render up to previous step
        var targetStep = _currentStep - 1;
        _currentStep = -1;

        var stage = document.getElementById('replay-stage');
        if (stage) {
            while (stage.firstChild) { stage.removeChild(stage.firstChild); }
        }

        for (var i = 0; i <= targetStep; i++) {
            _currentStep = i;
            renderStep(i, false);
        }

        updateProgress();
    }

    function setSpeed(s) {
        _speed = s;
        // If playing, restart the timer with new speed
        if (_isPlaying) {
            if (_timer) { clearTimeout(_timer); _timer = null; }
            scheduleNext();
        }
    }

    function scheduleNext() {
        if (!_isPlaying || !_traceData) { return; }
        if (_currentStep >= _traceData.steps.length - 1) {
            // Reached end
            _isPlaying = false;
            updatePlayButton();
            if (_onCompleteCallback) { _onCompleteCallback(); }
            return;
        }

        var delay = SPEED_MAP[_speed] || 1500;
        _timer = setTimeout(function () {
            _currentStep++;
            renderStep(_currentStep, true);
            updateProgress();
            scheduleNext();
        }, delay);
    }

    /* ---- Step Rendering ---- */

    function renderStep(index, animated) {
        var stage = document.getElementById('replay-stage');
        if (!stage || !_traceData) { return; }

        // Remove empty message
        var emptyMsg = stage.querySelector('.replay-empty');
        if (emptyMsg) { stage.removeChild(emptyMsg); }

        var step = _traceData.steps[index];
        if (!step) { return; }

        var stepType = step.type || 'system';
        var color = TYPE_COLORS[stepType] || TYPE_COLORS.system;
        var label = TYPE_LABELS[stepType] || 'STEP';

        // Step container
        var stepEl = S.createElement('div', {
            'class': 'replay-step replay-step-' + stepType + (animated ? ' replay-step-enter' : ''),
            'data-step-index': String(index)
        });

        // Header row
        var header = S.createElement('div', { 'class': 'replay-step-header' });

        // Pulse indicator
        var pulse = S.createElement('div', { 'class': 'replay-pulse replay-pulse-' + stepType });
        header.appendChild(pulse);

        // Step number
        var num = S.createElement('span', { 'class': 'replay-step-num' }, '#' + (index + 1));
        header.appendChild(num);

        // Type badge
        var badge = S.createElement('span', { 'class': 'replay-step-badge replay-badge-' + stepType }, label);
        header.appendChild(badge);

        // Timestamp (if available)
        if (step.metadata && step.metadata.timestamp) {
            var ts = S.createElement('span', { 'class': 'replay-step-time' }, step.metadata.timestamp);
            header.appendChild(ts);
        }

        stepEl.appendChild(header);

        // Content
        var content = S.createElement('div', { 'class': 'replay-step-content' });
        var contentText = step.content || step.summary || '';

        if (animated && contentText.length > 0 && contentText.length < 2000) {
            // Typing animation for animated steps
            typeWriter(content, contentText, stepType);
        } else {
            S.safeSetText(content, contentText.length > 500 ? contentText.substring(0, 500) + '...' : contentText);
        }

        stepEl.appendChild(content);

        // Tool call metadata
        if (stepType === 'tool_call' && step.metadata) {
            var meta = S.createElement('div', { 'class': 'replay-step-meta' });
            if (step.metadata.tool_name) {
                var toolName = S.createElement('span', { 'class': 'replay-meta-tag' }, '\u2699 ' + step.metadata.tool_name);
                meta.appendChild(toolName);
            }
            stepEl.appendChild(meta);
        }

        // Error flash
        if (stepType === 'error') {
            stepEl.classList.add('replay-error-flash');
        }

        stage.appendChild(stepEl);

        // Scroll to bottom
        stage.scrollTop = stage.scrollHeight;
    }

    /* ---- Typing Animation ---- */

    function typeWriter(element, text, stepType) {
        var i = 0;
        var displayText = text.length > 500 ? text.substring(0, 500) + '...' : text;
        var speed = Math.max(5, Math.min(30, 1500 / displayText.length));

        element.textContent = '';
        element.classList.add('replay-typing');

        _typeTimer = setInterval(function () {
            if (i < displayText.length) {
                element.textContent += displayText.charAt(i);
                i++;

                // Auto-scroll
                var stage = document.getElementById('replay-stage');
                if (stage) { stage.scrollTop = stage.scrollHeight; }
            } else {
                clearInterval(_typeTimer);
                _typeTimer = null;
                element.classList.remove('replay-typing');
            }
        }, speed);
    }

    /* ---- UI Updates ---- */

    function updatePlayButton() {
        var btn = document.getElementById('replay-play');
        if (!btn) { return; }

        if (_isPlaying) {
            S.safeSetText(btn, '\u23F8 Pause');
            btn.setAttribute('aria-label', 'Pause');
        } else {
            if (_currentStep >= (_traceData ? _traceData.steps.length - 1 : 0) && _currentStep >= 0) {
                S.safeSetText(btn, '\u21BB Replay');
                btn.setAttribute('aria-label', 'Replay');
            } else {
                S.safeSetText(btn, '\u25B6 Play');
                btn.setAttribute('aria-label', 'Play');
            }
        }
    }

    function updateProgress() {
        var fill = document.getElementById('replay-progress-fill');
        var text = document.getElementById('replay-progress-text');
        if (!_traceData || !fill || !text) { return; }

        var total = _traceData.steps.length;
        var current = _currentStep + 1;
        var pct = total > 0 ? (current / total) * 100 : 0;

        fill.style.width = pct + '%';
        S.safeSetText(text, current + ' / ' + total + ' steps');
    }

    /* ---- Public API ---- */

    return {
        init: init,
        render: render,
        play: play,
        pause: pause,
        restart: restart,
        isPlaying: function () { return _isPlaying; },
        getCurrentStep: function () { return _currentStep; }
    };

})();
