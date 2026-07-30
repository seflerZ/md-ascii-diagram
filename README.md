# MD ASCII Diagram

When writing technical proposals in Markdown with Claude Code, it can generate ASCII diagrams. However, when sharing these documents with others, the ASCII art often gets misaligned due to different fonts, editors, or platforms.

This tool solves the problem by:

1. Keeping the original ASCII diagram as a comment block in Markdown (so AI can still edit it)
2. Automatically rendering it into a beautiful colored PNG image
3. Embedding the image reference right next to the diagram in the document

The result: AI can edit the diagram, and when you share the document or upload it to a server, the diagram always looks perfect.

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

Download [Sarasa Mono SC Nerd](https://github.com/be5invis/Sarasa-Gothic) and place the `.ttf` files into `~/.claude/skills/md-ascii-diagram/fonts/`. The editor will load them automatically. If the font is missing, it falls back to Consolas / Courier New — diagrams will still work but some arrow characters may misalign.
