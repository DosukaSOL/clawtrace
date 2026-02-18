<div align="center">

<img src="assets/clawtrace-logo.png" alt="Clawtrace Logo" width="600">

<br><br>

### AI Interaction & Reasoning Explorer

**See what your AI is *really* doing — now with Trace Replay, Hallucination Heatmaps, and more.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Security](https://img.shields.io/badge/Security-Audited-green.svg)](SECURITY.md)
[![No Dependencies](https://img.shields.io/badge/Dependencies-Zero-orange.svg)](#-tech-stack)
[![Offline First](https://img.shields.io/badge/Works-100%25%20Offline-purple.svg)](#-privacy-guarantee)

---

*A free, open-source, zero-dependency web tool that lets you load, explore, replay, analyze, and understand AI interaction traces — entirely in your browser, with absolute privacy.*

**Built for [OpenClaw](https://github.com/openclaw/openclaw) agents and any AI system.**

[**Get Started**](#-quick-start) · [**What's New in v1.1**](#-whats-new-in-v11) · [**Features**](#-features) · [**Security**](#-security-philosophy) · [**How to Use**](#-how-to-use) · [**Roadmap**](#-roadmap)

</div>

---

## 🧠 What is Clawtrace?

**Clawtrace** is a powerful browser-based tool that transforms raw AI interaction traces into interactive, visual explorations.

You feed it the raw logs from any AI system — OpenAI, Anthropic, local agents, custom tool chains — and it instantly gives you:

- A **cinematic trace replay** that plays back every AI step like a movie
- A **color-coded timeline** of every step the AI took
- A **hallucination heatmap** that highlights uncertainty word-by-word
- A **behavior radar chart** profiling the AI's personality
- A **reasoning analyzer** that catches loops, hallucinations, contradictions, and uncertainty
- A **token cost calculator** comparing 20+ models side-by-side
- A **one-click bug report generator** for GitHub Issues and Jira
- An **interactive reasoning flow graph** showing the AI's decision chain
- A **risk score** and **confidence score** at a glance
- **Side-by-side comparison** of two different traces
- **Exports** to Markdown, JSON, and printable HTML
- **Shareable URLs** — no server needed

Everything runs **100% in your browser**. Nothing is uploaded. Nothing is tracked. Nothing phones home.

---

## 🔥 The Problem

You just ran a complex AI interaction — an agent loop, a chain-of-thought session, a multi-tool orchestration. The output *looks* right. But:

- Did the AI get stuck in a **loop**?
- Did it **contradict** itself halfway through?
- Were there **hallucination** signals you missed?
- Which **tool calls** actually succeeded?
- Was the reasoning **confident** or full of hedging?

Most people never look at the raw trace data. And when they do, it's an unreadable wall of JSON.

**You deserve better tools. That's why we built Clawtrace.**

---

## 💡 The Solution

Drop in a trace file and Clawtrace does the rest:

| What You Get | How It Helps |
|-------------|-------------|
| � **Trace Replay Mode** | Watch every AI step unfold in real-time with typing animations, speed control, and play/pause — like a movie of your AI's brain |
| 🎯 **Interactive Timeline** | See every step — user, assistant, tool call, error — with color coding and expand/collapse |
| 🔥 **Hallucination Heatmap** | Word-level severity highlighting of uncertainty, contradictions, and hallucination patterns |
| 🕸️ **AI Behavior Radar** | Spider chart profiling 6 behavioral dimensions: verbosity, confidence, tool reliance, repetitiveness, hedging, error rate |
| 🔍 **Reasoning Analyzer** | Auto-detects loops, repetition, hallucination markers, contradictions, uncertainty |
| 💰 **Token Cost Calculator** | Estimate costs across 20 major models (GPT-4o, Claude Opus 4, Gemini, Llama, etc.) with auto-detection |
| 📋 **Bug Report Generator** | One-click formatted reports for GitHub Issues, Jira, or plain text — ready to paste |
| 🌊 **Reasoning Flow Graph** | Interactive SVG node graph of the AI's decision chain with zoom, pan, and loop detection |
| 📊 **Risk & Confidence Scores** | Instant 0–100 assessment of trace quality |
| ⚠️ **Warning Flags** | Critical/Error/Warning/Info severity levels with evidence |
| 🔄 **Comparison Mode** | Side-by-side diff of two traces with change highlighting |
| 📤 **Multi-Format Export** | JSON, Markdown, and self-contained HTML reports |
| 🔗 **Share via URL** | Encode trace data into a URL — no server, no storage |

---

## 🦞 Built for OpenClaw

[**OpenClaw**](https://openclaw.ai/) is the open-source personal AI assistant with 207k+ GitHub stars, created by [Peter Steinberger](https://steipete.me/) and an incredible community. It runs on your own devices and connects to WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Microsoft Teams, and more — all through a local Gateway control plane.

OpenClaw agents use models like Claude Opus 4, GPT-4o, and others to execute complex multi-step tasks: browsing the web, running shell commands, managing files, sending messages, and orchestrating sub-agents. These interactions generate rich traces — and that's where Clawtrace comes in.

**Clawtrace is the trace explorer for OpenClaw agents.** It helps you:

- **Debug agent loops** — OpenClaw's Pi agent runtime runs multi-step agent loops. Clawtrace replays them step by step.
- **Inspect tool calls** — See every `browser`, `bash`, `canvas`, `cron`, and skill execution in the chain.
- **Analyze reasoning quality** — Catch hallucinations, contradictions, and uncertainty in your agent's responses.
- **Compare sessions** — Side-by-side diff two OpenClaw sessions to see what changed.
- **Estimate costs** — Track token spending across models your OpenClaw is using.
- **Generate bug reports** — One-click reports from agent traces, ready for GitHub Issues.

Clawtrace also works with any AI system — OpenAI, Anthropic, LangChain, custom agents — but it's designed with the OpenClaw workflow in mind.

> **Disclaimer:** Clawtrace is an **independent community project**. It is not made by, affiliated with, or endorsed by the OpenClaw team. We're simply contributing to the ecosystem because we believe OpenClaw users deserve great debugging tools.

> **Links:** [OpenClaw Website](https://openclaw.ai/) · [OpenClaw GitHub](https://github.com/openclaw/openclaw) · [OpenClaw Docs](https://docs.openclaw.ai/) · [OpenClaw Discord](https://discord.gg/clawd) · [@openclaw on X](https://x.com/openclaw)

---

## 🆕 What's New in v1.1

**Clawtrace v1.1** ships 6 major new features designed for virality, debuggability, and AI transparency:

### 🎬 Trace Replay Mode — *The Wow Feature*
Watch your AI trace play back in real-time. Every step appears with a typing animation, color-coded pulses, and auto-scrolling — like watching the AI think. Use play/pause, step forward/back, and speed controls (0.5x–4x).

### 🔥 Hallucination Heatmap
Every word in the trace is scanned against 13 hallucination/uncertainty patterns across 4 severity levels. The result: a color-coded heatmap that lights up contradictions, hedging, self-corrections, and confidence-gaps at a glance.

### 🕸️ AI Behavior Radar Chart
An SVG spider chart profiling 6 behavioral dimensions — Verbosity, Confidence, Tool Reliance, Repetitiveness, Hedging, and Error Rate. See the AI's "personality fingerprint" for any trace.

### 💰 Token Cost Calculator
Estimates input/output/total token costs across 20 major models — GPT-4o, Claude Opus 4, Gemini 2.0, Llama 3.1, Mistral, DeepSeek, and more. Auto-detects which model was used and highlights it.

### 📋 One-Click Bug Report Generator
Generates a formatted bug report from the trace analysis — ready to paste into GitHub Issues (Markdown), Jira (markup), or plain text. Includes summary, errors, warnings, tool calls, and a trace snippet.

### 🌊 Reasoning Flow Graph
An interactive SVG node graph showing the AI's decision chain. Left-to-right layout with zoom, pan, mouse wheel support, color-coded nodes, loop detection (dashed red edges), and up to 100 visible nodes.

---

## 👥 Who It's For

| Role | Use Case |
|------|----------|
| **OpenClaw Users** | Debug your assistant's agent loops, inspect skill executions, replay multi-channel sessions, catch when Molty gets stuck |
| **AI Engineers** | Debug agent loops, inspect tool call sequences, catch infinite recursion |
| **Prompt Engineers** | Analyze how prompt changes affect reasoning quality and confidence |
| **QA Teams** | Review AI traces for production incidents and regressions |
| **Researchers** | Study AI reasoning patterns, hallucination rates, and failure modes |
| **Security Auditors** | Inspect AI behavior for unsafe patterns or data leakage |
| **Educators** | Teach AI concepts with real, interactive trace visualizations |
| **Curious Users** | Understand what happens "under the hood" of AI conversations |

---

## ✨ Features

### 📥 Multi-Format Input
- **Drag & drop** any trace file
- **Paste** directly into the editor
- **File picker** for JSON, TXT, YAML-like, MD, and LOG files
- Auto-detect format (JSON, YAML-like, plain text)
- Supports OpenAI, Anthropic, and generic message formats

### 🧩 Smart Parser
- Auto-detection of conversation turns, tool calls, errors
- Normalizes diverse formats into a clean internal schema
- Input validation with size limits (5 MB max)
- Safe handling of malformed data

### 📋 Interactive Timeline
- Color-coded steps: User, Assistant, Tool Call, Reasoning, Error, System
- Expandable/collapsible step bodies
- Filter by step type
- Step metadata display
- Keyboard accessible

### 🧠 Reasoning Analyzer
Automatically detects:
- **Infinite loops** — near-duplicate steps suggesting the AI is stuck
- **Repetition patterns** — Jaccard similarity analysis across steps
- **Hallucination indicators** — self-corrections, knowledge cutoff references, capability disclaimers
- **Contradictions** — self-referencing prior statements, explicit contradiction markers
- **Uncertainty language** — hedging, probabilistic language, doubt expressions

Displayed as:
- **Risk meter** (0–100) with color-coded levels
- **Confidence score** (0–100)
- **Warning flags** with severity levels (Critical, Error, Warning, Info)
- **Detailed findings** with evidence excerpts

### 🔄 Comparison Mode
- Side-by-side diff view of two traces
- Step-level alignment
- Change highlighting (same, changed, added, removed)
- Summary statistics

### 📤 Export
- **JSON** — Full trace + analysis data
- **Markdown** — Human-readable report with tables
- **HTML** — Self-contained, printable report with embedded styling

### 🔗 Share Mode
- Generate encoded URLs with trace data in the fragment
- No server, no storage — data is embedded in the URL
- Automatic detection and loading of shared URLs
- Size-aware truncation with warnings

### 🎬 Trace Replay Mode
- Animated step-by-step playback of the entire trace
- Play, pause, restart, step forward, step back controls
- Speed control: 0.5x, 1x, 2x, 4x
- Typing animation for step content
- Color-coded pulse indicators per step type
- Progress bar and step counter
- Auto-scroll to keep the current step in view
- Accessible: ARIA live region, keyboard navigation

### 🔥 Hallucination Heatmap
- Word-level severity highlighting: Critical, High, Medium, Low
- 13 regex patterns detecting hallucination, uncertainty, contradiction, hedging
- Automatic overlap resolution (highest severity wins)
- Summary cards with total counts per severity level
- Per-step breakdown with highlighted content
- Color legend for quick reference

### 🕸️ AI Behavior Radar Chart
- SVG spider chart with 6 axes: Verbosity, Confidence, Tool Reliance, Repetitiveness, Hedging, Error Rate
- Background rings at 25%, 50%, 75%, 100%
- Filled polygon data shape with interactive dots
- Detailed score cards with horizontal bar fills
- Score descriptions explaining each dimension

### 💰 Token Cost Calculator
- Token estimation (~4 chars per token) for input and output
- 20 models across 7 providers: OpenAI, Anthropic, Google, Meta, Mistral, DeepSeek, OpenAI (o-series)
- Auto-detection of model used in trace
- Summary cards: total tokens, cheapest model, most expensive
- Sortable comparison table with cost breakdown
- Callout cards for cheapest and priciest options

### 📋 Bug Report Generator
- One-click generation in 3 formats: GitHub Issue (Markdown), Jira (markup), Plain Text
- Includes: summary table, error list, critical warnings, tool calls, trace snippet
- Copy-to-clipboard with visual feedback
- Environment info auto-populated
- Format switching with live preview

### 🌊 Reasoning Flow Graph
- Interactive SVG node graph of AI decision flow
- Left-to-right layout with branching for tool calls
- Loop detection via content similarity (dashed red edges)
- Zoom in/out/reset controls + mouse wheel zoom
- Click-and-drag panning
- Color-coded nodes by step type
- Arrow markers showing direction
- Node limit (100) with warning
- Color legend for step types

### 🎨 UI/UX
- Dark mode default with light mode toggle
- Terminal + glassmorphism hybrid aesthetic
- Fully responsive (desktop, tablet, mobile)
- Reduced-motion support
- Print stylesheet
- Skip-to-content link
- ARIA labels and roles throughout

---

## 🚀 Quick Start

### Option 1: Open Directly

```bash
git clone https://github.com/DosukaSOL/clawtrace.git
# Clawtrace repo is hosted under DosukaSOL
cd clawtrace
open index.html    # macOS
# or
xdg-open index.html  # Linux
# or just double-click index.html
```

That's it. No install. No build. No npm. No configuration.

### Option 2: Serve Locally (recommended for Share URLs)

```bash
# Python 3
cd clawtrace
python3 -m http.server 8080

# Then open http://localhost:8080
```

### Option 3: Deploy to Static Hosting

Upload the entire `clawtrace/` folder to any static hosting provider:
- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages
- Any web server (Apache, Nginx, etc.)

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions with recommended security headers.

---

## 📖 How to Use

### Step 1: Load Trace Data

| Method | How |
|--------|-----|
| **Paste** | Copy your AI trace JSON/text and paste into the text area |
| **File** | Click "Choose File" or drag & drop a `.json`/`.txt`/`.yaml` file |
| **Example** | Click "Load Example" to explore with built-in sample data |

### Step 2: Parse & Analyze

Click **"Parse & Analyze"**. Clawtrace will:
1. Auto-detect the format (JSON, YAML, plain text)
2. Parse and normalize the data into a clean schema
3. Run the full reasoning analyzer
4. Render the interactive timeline
5. Switch you to the Timeline view automatically

### Step 3: Explore the Views

| View | What You'll See |
|------|----------------|
| **Timeline** | Every step with color coding. Click to expand. Use filters to focus. |
| **Analyzer** | Risk score, confidence score, warning flags, detailed findings with evidence. |
| **Compare** | Paste two traces. Click Compare. See side-by-side diff. |
| **Export** | Download JSON/Markdown/HTML. Generate shareable URL. |
| **Replay** | Cinematic playback of the trace with typing animations and speed control. |
| **Heatmap** | Word-level hallucination highlighting with severity colors. |
| **Radar** | Spider chart showing the AI's behavioral fingerprint. |
| **Cost** | Token cost comparison across 20 models. |
| **Bug Report** | One-click formatted reports for GitHub, Jira, or text. |
| **Flow** | Interactive node graph of the AI's reasoning chain. |

### Step 4: Share (Optional)

In the **Export** view, click **"Generate Share URL"**. The trace data is encoded directly into the URL fragment — no server involved. Copy and share with anyone.

---

## 📂 Supported Formats

### JSON (Auto-detected)

```json
[
  { "role": "user", "content": "Hello" },
  { "role": "assistant", "content": "Hi! How can I help?" }
]
```

Also supports:
- `{ "messages": [...] }`
- `{ "steps": [...] }`
- `{ "trace": [...] }`
- `{ "events": [...] }`
- Messages with `tool_calls` arrays (OpenAI, OpenClaw)
- Multi-part content arrays
- OpenClaw agent traces with `bash`, `browser`, `write`, `cron.create`, and other tool calls
- OpenClaw `sessions_send` / `sessions_list` / `sessions_history` traces

### YAML-like (Auto-detected)

```yaml
role: user
content: Hello

role: assistant
content: Hi! How can I help?
```

### Plain Text (Fallback)

```
User: Hello
Assistant: Hi! How can I help?

User: What's 2+2?
Assistant: 4
```

---

## 🏗️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Markup | HTML5, semantic elements |
| Styling | CSS3, custom properties, media queries |
| Logic | Vanilla JavaScript (ES5 compatible) |
| Dependencies | **Zero** |
| Build tools | **None** |
| External APIs | **None** |
| Tracking | **None** |
| Frameworks | **None** |

The entire application is ~230 KB of hand-written code. It loads instantly and works forever.

---

## 🛡️ Security Philosophy

Clawtrace is built with a **security-first** mindset. We believe developer tools should be **safe by default**.

### Core Principles

1. **Zero Network Calls** — No data ever leaves your browser. No fetch, no XHR, no WebSocket, no beacon, no image pixel tracking. Verified by Content Security Policy with `connect-src 'none'`.

2. **No External Dependencies** — No npm packages, no CDN scripts, no third-party code. Every line of code is auditable in this repository.

3. **Input Sanitization** — All user input is treated as untrusted. Content is escaped before rendering. DOM manipulation uses `textContent` and `createElement` — never `innerHTML` with user data.

4. **Content Security Policy** — Strict CSP meta tag blocks inline scripts, external resources, iframes, and form submissions.

5. **Size & Depth Limits** — Input is limited to 5 MB. JSON nesting is limited to 20 levels. Arrays are capped at 10,000 elements. These prevent denial-of-service via resource exhaustion.

6. **Safe File Handling** — File type validation by extension and MIME type. File size validation before reading.

7. **No Secrets** — This codebase contains zero API keys, tokens, credentials, endpoints, or sensitive data.

See [SECURITY.md](SECURITY.md) for the full threat model, audit report, and responsible disclosure policy.

---

## 🔒 Privacy Guarantee

- Your trace data **never leaves your browser**
- There are **no analytics** of any kind
- There is **no telemetry**
- There are **no cookies** (theme preference uses `localStorage` only)
- Share URLs encode data in the **URL fragment** (hash), which [browsers do not send to servers](https://developer.mozilla.org/en-US/docs/Web/API/URL/hash)
- The application works **completely offline** after the initial page load

**We don't want your data. We can't see your data. That's the point.**

---

## 📁 Project Structure

```
clawtrace/
├── index.html              # Application entry point
├── src/
│   ├── css/
│   │   └── style.css       # Complete design system (~1800 lines)
│   └── js/
│       ├── sanitizer.js    # Security foundation: escaping, validation
│       ├── parser.js       # Multi-format parser with auto-detection
│       ├── timeline.js     # Interactive timeline renderer
│       ├── analyzer.js     # Reasoning analysis engine
│       ├── comparison.js   # Side-by-side diff engine
│       ├── export.js       # Multi-format export (JSON, MD, HTML)
│       ├── share.js        # URL-based sharing (no server)
│       ├── replay.js       # 🆕 Trace replay with typing animation
│       ├── heatmap.js      # 🆕 Hallucination heatmap engine
│       ├── radar.js        # 🆕 AI behavior radar chart (SVG)
│       ├── costcalc.js     # 🆕 Token cost calculator (20 models)
│       ├── bugreport.js    # 🆕 One-click bug report generator
│       ├── flowgraph.js    # 🆕 Reasoning flow graph (SVG)
│       └── app.js          # Main application orchestrator
├── assets/
│   └── clawtrace-logo.png  # Logo
├── docs/
│   ├── DEPLOYMENT.md       # Deployment guide with security headers
│   └── AUDIT.md            # Security audit report
├── examples/
│   ├── basic-chat.json     # Simple conversation trace
│   ├── agent-loop.json     # Multi-step agent with tool calls
│   └── openclaw-agent.json # OpenClaw agent trace (calendar, skills, cron)
├── README.md               # This file
├── SECURITY.md             # Security policy & threat model
├── CONTRIBUTING.md         # Contribution guidelines
├── CODE_OF_CONDUCT.md      # Code of conduct
└── LICENSE                 # MIT License
```

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines.

**Key rules:**
- No external dependencies, ever
- All DOM rendering must use safe methods (`textContent` / `createElement`)
- All input must be sanitized through the `Sanitizer` module
- No inline JavaScript or event handlers
- No network calls

---

## 🗺️ Roadmap

### v1.0
- [x] Multi-format input (JSON, YAML-like, text)
- [x] Interactive timeline with filtering
- [x] Reasoning analyzer with risk/confidence scores
- [x] Loop/repetition detection
- [x] Hallucination indicator detection
- [x] Uncertainty language analysis
- [x] Contradiction detection
- [x] Side-by-side comparison
- [x] Multi-format export
- [x] URL-based sharing
- [x] Dark/light theme
- [x] Full accessibility
- [x] Security audit

### v1.1 (Current)
- [x] 🎬 Trace Replay Mode with typing animation and speed control
- [x] 🔥 Hallucination Heatmap with word-level severity highlighting
- [x] 🕸️ AI Behavior Radar Chart (SVG spider chart, 6 dimensions)
- [x] 💰 Token Cost Calculator (20 models, 7 providers)
- [x] 📋 One-Click Bug Report Generator (GitHub, Jira, text)
- [x] 🌊 Reasoning Flow Graph (interactive SVG node graph)

### v1.2 (Planned)
- [ ] Timeline search/text filter
- [ ] Bookmarkable steps
- [ ] Keyboard shortcuts
- [ ] Custom analysis rules
- [ ] Multi-trace session management
- [ ] Local IndexedDB storage (opt-in)
- [ ] Trace annotation/comments

### v2.0 (Vision)
- [ ] WebAssembly parser for massive traces
- [ ] Custom theme builder
- [ ] Plugin system for custom analyzers
- [ ] OpenTelemetry trace format support
- [ ] LangSmith/LangFuse trace import
- [ ] Community pattern library

---

## Why Open Source?

AI tools should be transparent. If a tool analyzes AI behavior, you should be able to analyze *the tool itself*. Every line of Clawtrace is open, auditable, and yours to inspect.

We chose MIT because we believe utility tools should be free to use, modify, and distribute without restriction.

---

## ❓ FAQ

**Q: Does this send my data anywhere?**
A: No. Never. The CSP meta tag enforces `connect-src 'none'`, which blocks all network requests. There are zero external calls in the code.

**Q: Can I use this with any AI provider?**
A: Yes. Clawtrace accepts any JSON message array, YAML-like key-value data, or plain text conversation. It auto-detects the format.

**Q: How do I use this with OpenClaw?**
A: Export your OpenClaw agent session history (via `sessions_history` or the Gateway logs), paste or drop the JSON into Clawtrace, and click Parse & Analyze. Clawtrace understands OpenClaw's tool call format — `bash`, `browser`, `write`, `cron.create`, skill executions, and multi-agent `sessions_send` traces all render correctly. There's also a built-in example at `examples/openclaw-agent.json`.

**Q: Is the share URL secure?**
A: The data is base64-encoded (not encrypted) and placed in the URL fragment. Browsers do not send fragments to servers. However, the URL is readable by anyone who has it. Do not share URLs containing sensitive data.

**Q: Why no React/Vue/Svelte?**
A: Deliberately. Zero dependencies means zero supply chain attacks, instant loading, no build step, and the code runs forever without maintenance. This is a tool, not a framework demo.

**Q: Can I embed this in my app?**
A: Yes. MIT licensed. Copy the files, serve them. No attribution required (but appreciated).

---

## 📄 License

[MIT License](LICENSE) — free to use, modify, and distribute.

---

<div align="center">

<img src="assets/clawtrace-logo.png" alt="Clawtrace" width="200">

**Clawtrace** — See what your AI is *really* doing.

[Get Started](#-quick-start) · [Report a Bug](https://github.com/DosukaSOL/clawtrace/issues) · [Request a Feature](https://github.com/DosukaSOL/clawtrace/issues)

MIT License · Made with &#x2756; by [DosukaSOL](https://github.com/DosukaSOL)

Independent community project · Not affiliated with or endorsed by the [OpenClaw](https://openclaw.ai/) team 🦞

</div>
