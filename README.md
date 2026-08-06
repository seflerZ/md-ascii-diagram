# MD ASCII Diagram

[English](README.md) | [简体中文](README.zh-CN.md)

## How it works

AI models are space-unaware, so they can't produce good diagrams with visual-native tools like `draw.io`. In fact, all AI today are character-native, so the best practice is:

1. Keep the original ASCII diagram as a comment block in Markdown (so AI can still edit it)
2. Automatically render it into a beautiful colored PNG image
3. Fine-tune it with the built-in editor
4. Embed the image reference right next to the diagram in the document
5. Beautify it with image-generation AI such as GPT Image-2 or SeedDance

The result: AI can edit the diagram, and when you share the document or upload it to a server, the diagram always looks perfect.

## Compares

| | md-ascii-diagram | next-ai-drawio | draw.io | Mermaid |
|---- | ---- | ---- | ---- | ---- |
| AI-native, text-based drafting | ✅ Char-native — AI writes ASCII directly | ⚠️ AI emits XML, not native | ❌ Manual drag & drop | ✅ Text-based, AI-friendly |
| Fine-tune with a built-in editor | ✅ Built-in editor | ✅ draw.io editor | ✅ Full-featured editor | ⚠️ Text-only edits, can't control space and relations |
| Skill integration into AI tools, auto re-render on edit | ✅ Install as a Claude Code skill — AI edits, PNG re-renders automatically | ⚠️ Via MCP/tool glue | ❌ No AI workflow | ⚠️ Markdown viewers only |
| AI img2img beautify → any style | ✅ GPT Image / SeedDance, any style | ❌ Single style | ❌ Single style | ❌ Single style |

> Note: Style is about the rendering, not colors. Such as hand writing, technique metal, and more.

## ScreenShots

<img width="642" height="642" alt="image" src="https://github.com/user-attachments/assets/c04dd6b7-bd50-481e-9db1-fb216a095f5f" />


## How to install

Just tell ClaudeCode or you code tools to read this page and it should be able to install all it and all the dependencies.

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

- **For global users**: install any **monospace Nerd Font** family — Nerd Fonts bundle the extra glyphs (box-drawing, arrows, powerline, icons) that plain monospace fonts often lack.
- **For Chinese users**: we recommend [**Sarasa Terminal SC Nerd** (更纱终端书呆黑体-简)](https://github.com/laishulu/Sarasa-Term-SC-Nerd) — a monospaced terminal font that harmonizes ASCII with CJK glyphs, so mixed Chinese/English labels stay perfectly aligned.

Download the `.ttf` files and place them into `~/.claude/skills/md-ascii-diagram/fonts/`. The editor will load them automatically. If the font is missing, it falls back to Consolas / Courier New — diagrams will still work but some arrow characters may misalign.
