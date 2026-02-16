<div align="center">

<img src="assets/clawtrace-logo.png" alt="Clawtrace Logo" width="600">

<br><br>

### AI Interaction & Reasoning Explorer

**See what your AI is *really* doing.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Security](https://img.shields.io/badge/Security-Audited-green.svg)](SECURITY.md)
[![No Dependencies](https://img.shields.io/badge/Dependencies-Zero-orange.svg)](#-tech-stack)
[![Offline First](https://img.shields.io/badge/Works-100%25%20Offline-purple.svg)](#-privacy-guarantee)

---

*A free, open-source, zero-dependency web tool that lets you load, explore, analyze, and understand AI interaction traces — entirely in your browser, with absolute privacy.*

**Part of the [OpenClaw](https://github.com/DosukaSOL) ecosystem.**

[**Get Started**](#-quick-start) · [**Features**](#-features) · [**Security**](#-security-philosophy) · [**How to Use**](#-how-to-use) · [**Roadmap**](#-roadmap)

</div>

---

## 🧠 What is Clawtrace?

**Clawtrace** is a powerful browser-based tool that transforms raw AI interaction traces into interactive, visual explorations.

You feed it the raw logs from any AI system — OpenAI, Anthropic, local agents, custom tool chains — and it instantly gives you:

- A **color-coded timeline** of every step the AI took
- A **reasoning analyzer** that catches loops, hallucinations, contradictions, and uncertainty
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
| 🎯 **Interactive Timeline** | See every step — user, assistant, tool call, error — with color coding and expand/collapse |
| 🔍 **Reasoning Analyzer** | Auto-detects loops, repetition, hallucination markers, contradictions, uncertainty |
| 📊 **Risk & Confidence Scores** | Instant 0–100 assessment of trace quality |
| ⚠️ **Warning Flags** | Critical/Error/Warning/Info severity levels with evidence |
| 🔄 **Comparison Mode** | Side-by-side diff of two traces with change highlighting |
| 📤 **Multi-Format Export** | JSON, Markdown, and self-contained HTML reports |
| 🔗 **Share via URL** | Encode trace data into a URL — no server, no storage |

---

## 🌐 The OpenClaw Ecosystem

Clawtrace is part of **OpenClaw** — a growing collection of open-source tools for AI transparency, debugging, and safety. We believe AI tools should be:

- **Open** — fully auditable, no black boxes
- **Private** — your data stays yours
- **Free** — no paywalls, no "premium" tiers
- **Secure** — security-first by design

Clawtrace is the first tool in this ecosystem. More are coming.

---

## 👥 Who It's For

| Role | Use Case |
|------|----------|
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
- Messages with `tool_calls` arrays
- Multi-part content arrays

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
│   │   └── style.css       # Complete design system (~700 lines)
│   └── js/
│       ├── sanitizer.js    # Security foundation: escaping, validation
│       ├── parser.js       # Multi-format parser with auto-detection
│       ├── timeline.js     # Interactive timeline renderer
│       ├── analyzer.js     # Reasoning analysis engine
│       ├── comparison.js   # Side-by-side diff engine
│       ├── export.js       # Multi-format export (JSON, MD, HTML)
│       ├── share.js        # URL-based sharing (no server)
│       └── app.js          # Main application orchestrator
├── assets/
│   └── clawtrace-logo.png  # Logo
├── docs/
│   ├── DEPLOYMENT.md       # Deployment guide with security headers
│   └── AUDIT.md            # Security audit report
├── examples/
│   ├── basic-chat.json     # Simple conversation trace
│   └── agent-loop.json     # Multi-step agent with tool calls
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

### v1.0 (Current)
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

### v1.1 (Planned)
- [ ] Token cost estimation by model
- [ ] Timeline search/text filter
- [ ] Step-to-step navigation
- [ ] Bookmarkable steps
- [ ] Keyboard shortcuts
- [ ] Custom analysis rules
- [ ] SVG logo & mascot

### v1.2 (Planned)
- [ ] Multi-trace session management
- [ ] Local IndexedDB storage (opt-in)
- [ ] Trace annotation/comments
- [ ] Custom theme builder
- [ ] Plugin system for custom analyzers

### v2.0 (Vision)
- [ ] WebAssembly parser for massive traces
- [ ] Visual graph view of tool call chains
- [ ] Diff replay (animated step-through)
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

MIT License · Made with &#x2756; by [OpenClaw](https://github.com/DosukaSOL)

</div>
