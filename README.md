# MD ASCII Diagram

[English](README.md) | [简体中文](README.zh-CN.md)

## Motivation

When writing technical proposals in Markdown with Claude Code, it can generate ASCII diagrams. However, when sharing these documents with others, the ASCII art often gets misaligned due to different fonts, editors, or platforms.

This tool solves the problem by:

1. Keeping the original ASCII diagram as a comment block in Markdown (so AI can still edit it)
2. Automatically rendering it into a beautiful colored PNG image
3. Embedding the image reference right next to the diagram in the document

The result: AI can edit the diagram, and when you share the document or upload it to a server, the diagram always looks perfect.

<img width="642" height="642" alt="image" src="https://github.com/user-attachments/assets/c04dd6b7-bd50-481e-9db1-fb216a095f5f" />


## How to install

### 1. Install as a Claude Code skill

```bash
mkdir -p ~/.claude/skills
git clone git@github.com:seflerZ/md-ascii-diagram.git ~/.claude/skills/md-ascii-diagram
```

Then in a Claude Code session, use:

- `/md-ascii-diagram edit <file.md>` — open the visual editor
- `/md-ascii-diagram gen <file.md>` — render all diagrams to PNG

### 2. Install dependencies

```bash
# Python is required for the HTTP server (pre-installed on macOS/Linux)
# Node.js and Playwright for PNG rendering
npm install playwright
npx playwright install msedge  # or chromium / firefox
```

### 3. Optional: Install the recommended font

**A monospace (fixed-width) font is a hard requirement for ASCII art to align correctly.** Every glyph must advance the same width so that box-drawing characters, arrows, and nested shapes land on a shared grid — this is exactly what "drawing by characters" relies on for visual layout. With a proportional font, characters sit at different widths, rows drift, and the diagram visually falls apart even though the text looks fine.

Recommended fonts:

- **For all users**: install any **monospace Nerd Font** family — Nerd Fonts bundle the extra glyphs (box-drawing, arrows, powerline, icons) that plain monospace fonts often lack.
- **For Chinese users**: we recommend [**Sarasa Terminal SC Nerd** (更纱终端书呆黑体-简)](https://github.com/laishulu/Sarasa-Term-SC-Nerd) — a monospaced terminal font that harmonizes ASCII with CJK glyphs, so mixed Chinese/English labels stay perfectly aligned.

Download the `.ttf` files and place them into `~/.claude/skills/md-ascii-diagram/fonts/`. The editor will load them automatically. If the font is missing, it falls back to Consolas / Courier New — diagrams will still work but some arrow characters may misalign.
