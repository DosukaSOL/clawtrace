# Contributing to Clawtrace

Thank you for your interest in contributing to Clawtrace! This guide will help you get started.

---

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

---

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/DosukaSOL/clawtrace/issues) to avoid duplicates.
2. Open a new issue with:
   - Clear title describing the bug
   - Steps to reproduce
   - Expected vs. actual behavior
   - Browser and OS version
   - Screenshot or trace data (redact sensitive info!)

### Suggesting Features

1. Open an issue with the `feature` label.
2. Describe the use case and why it's valuable.
3. Be specific — mockups and examples help!

### Submitting Code

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-improvement`
3. Make your changes following the guidelines below.
4. Test thoroughly in multiple browsers (Chrome, Firefox, Safari).
5. Commit with clear messages: `git commit -m "Add timeline search filter"`
6. Push and open a Pull Request.

---

## Development Guidelines

### Architecture Rules (Non-Negotiable)

These rules exist for security and simplicity. PRs that violate them will be declined.

| Rule | Reason |
|------|--------|
| **No external dependencies** | Zero supply chain risk |
| **No build tools** | Must work by opening index.html |
| **No frameworks** | Vanilla JS only |
| **No inline JavaScript** | CSP blocks it |
| **No `innerHTML` with user data** | XSS prevention |
| **No `eval()` or `Function()`** | Code injection prevention |
| **No network calls** | Data never leaves the browser |
| **No tracking / analytics** | Privacy guarantee |

### Code Style

- **Vanilla JavaScript** — ES5 compatible (no `let`, `const`, arrow functions, template literals in shipped code)
- **Module pattern** — Use `Clawtrace.ModuleName = (function() { ... })()` IIFE pattern
- **`'use strict';`** at the top of every JS file
- **Named functions** — No anonymous functions except where trivial
- **Comments** — JSDoc for public functions, inline comments for non-obvious logic
- **No global pollution** — Everything lives under the `Clawtrace` namespace
- **Semicolons** — Always use them
- **4-space indentation** in JS and CSS
- **2-space indentation** in HTML

### Security Checklist (for every PR)

Before submitting a PR, verify:

- [ ] All user input passes through `Clawtrace.Sanitizer`
- [ ] DOM rendering uses `textContent` or `createElement` (never `innerHTML` with data)
- [ ] No new external resources, CDN links, or network calls
- [ ] No new inline event handlers or inline scripts
- [ ] File inputs are validated (type, size)
- [ ] String lengths are bounded
- [ ] No sensitive data (keys, tokens, credentials)

### Testing

Currently, Clawtrace uses manual testing. We plan to add automated tests in a future version.

For manual testing, verify:
1. Load the example trace and check all views
2. Test with a large trace (5000+ entries)
3. Test with malformed input (broken JSON, huge strings)
4. Test drag & drop, file picker, and paste
5. Test in Chrome, Firefox, and Safari
6. Test on mobile (responsive layout)
7. Test keyboard navigation
8. Test with a screen reader
9. Test dark and light themes
10. Test export and share features

---

## Project Structure

```
clawtrace/
├── index.html          # Entry point — edit carefully
├── src/
│   ├── css/
│   │   └── style.css   # All styles (design tokens, components)
│   └── js/
│       ├── sanitizer.js  # SECURITY: Edit with extreme care
│       ├── parser.js     # Input parsing & normalization
│       ├── timeline.js   # Timeline rendering
│       ├── analyzer.js   # Reasoning analysis
│       ├── comparison.js # Diff comparison
│       ├── export.js     # Export to JSON/MD/HTML
│       ├── share.js      # URL encoding/decoding
│       └── app.js        # Main app orchestrator
├── docs/               # Documentation
├── examples/           # Example trace files
└── assets/             # Static assets
```

### Module Dependencies

```
sanitizer.js  ← (no dependencies, loaded first)
parser.js     ← sanitizer.js
timeline.js   ← sanitizer.js
analyzer.js   ← sanitizer.js
comparison.js ← sanitizer.js, parser.js
export.js     ← sanitizer.js
share.js      ← sanitizer.js
app.js        ← ALL modules (loaded last)
```

---

## Commit Message Format

```
<type>: <short description>

<optional longer description>
```

Types:
- `feat:` — New feature
- `fix:` — Bug fix
- `security:` — Security improvement
- `docs:` — Documentation only
- `style:` — CSS / formatting changes
- `refactor:` — Code restructuring
- `perf:` — Performance improvement
- `a11y:` — Accessibility improvement

Example: `feat: add timeline text search with highlighting`

---

## Pull Request Guidelines

1. One feature or fix per PR
2. Include a clear description of what and why
3. Reference related issues
4. Include testing steps
5. Don't introduce warnings or errors
6. Make sure existing functionality still works

---

## Getting Help

- Open a [Discussion](https://github.com/DosukaSOL/clawtrace/discussions) for questions
- Open an [Issue](https://github.com/DosukaSOL/clawtrace/issues) for bugs/features
- See [SECURITY.md](SECURITY.md) for security reports

---

Thank you for helping make Clawtrace better! &#x2756;
