---
name: md-ascii-diagram
description: "Markdown ASCII diagram tool. Usage: /md-ascii-diagram edit <doc.md> opens the editor to edit the diagrams in a document; /md-ascii-diagram gen <doc.md> batch-renders every diagram into a colored PNG. Supports 9 colors, 6 shade levels, nested boxes, auto-merged connectors, and continuous-wall detection."
metadata:
  type: skill
  version: "2.1.0"
---

# md-ascii-diagram — Markdown ASCII Diagram Editor & Renderer

## Overview

This skill provides two tools:
1. **Visual Editor** — grid-based editing of ASCII diagrams: box selection, lines, boxes, arrows, coloring, line-tidying, and more
2. **Batch Renderer** — renders the ASCII diagrams in a Markdown document into colored PNG images while keeping the original comment blocks editable

---

## File Manifest

Skill package path: `~/.claude/skills/md-ascii-diagram/`

| File | Description |
|------|------|
| `ascii-editor.html` | Visual editor (single HTML file, opens directly in a browser) |
| `render_color.js` | Batch renderer (Node.js + Playwright) |
| `beautify.js` | Image-to-image beautifier (Node.js, OpenAI-compatible `/images` API) |
| `beautify-cmd.js` | Document-level beautify command (render + beautify + update references) |
| `convert.js` | Converts code-block style diagrams to comment-block style |
| `styles/` | Style config directory: each style = a reference image set + a prompt set |
| `server.py` | HTTP server + `/save` `/generate` `/beautify/start\|status\|insert\|check` APIs (Python 3) |

---

## Command 1: md-ascii-diagram-edit

Opens the editor, loads the ASCII diagrams from a Markdown document for editing, and saves them straight back.

### Start the server

The editor must run through an HTTP server so it can read and write Markdown files:

```bash
# Bash
cd ~/.claude/skills/md-ascii-diagram/
python3 server.py [port]
# default port 8000
```

```powershell
# PowerShell
cd ~\.claude\skills\md-ascii-diagram\
python server.py [port]
```

### Connect a Markdown document

Once the server is running, open in a browser:

```
http://localhost:8000/ascii-editor.html?file=C:/path/to/DESIGN.md
```

### Interface language

The editor supports a **Chinese / English** bilingual UI:

- On first load it auto-detects the browser language (`zh*` → Chinese, otherwise English)
- The **EN / 中** button on the right of the toolbar switches manually; the choice is remembered (`localStorage`) and kept after refresh

The editor automatically:
1. `fetch`es the Markdown content (via the `/?file=` API)
2. Extracts all ASCII diagrams (`<!--diagram NAME-->` comment blocks and ``` code blocks)
3. Pops up a diagram list to pick from
4. Loads the selection into the grid for editing

### Edit & Save

- **Done editing** → click **💿 Save** → writes back to the original Markdown file via the `POST /save` API
- Diagrams that already have a name → updates the `<!--diagram NAME-->` comment block in the document
- New diagrams → appended to the end of the document
- After saving, VSCode detects the file change automatically, no manual copy-paste needed
- Also supports **💾 Export** to copy the `<!--diagram NAME-->` format to the clipboard (for manual paste)

### Supported diagram formats

| Format | Example | Name |
|------|------|------|
| Comment block | `<!--diagram p1\n...\n-->` | Has a name (e.g. p1) |
| Code block | ``` ``` ``` | No name (must be named before export) |

### Color codes

| Code | Name | Hex |
|----|------|------|
| `m` | Rose | `#CC247C` |
| `r` | Red | `#E95351` |
| `o` | Orange | `#F7A24F` |
| `y` | Yellow | `#FAE538` |
| `g` | Green | `#4EA660` |
| `c` | Light Blue | `#79CAFB` |
| `b` | Blue | `#5292F7` |
| `p` | Purple | `#AA77E9` |
| `e` | Gray | `#D9D1D1` |

### Text color markers

Wrap text with markers to color it or add an underline; supported in preview and PNG rendering:

| Syntax | Effect |
|------|------|
| `___text___` | Red wavy underline |
| `_g_text_g_` | Green text (color code m/r/o/y/g/c/b/p/e) |
| `_!_text_!_` | Rainbow text (9-color cycle) |

Examples: `___important___` underline, `_r_error_r_` red, `_!_congrats_!_` rainbow

### Custom shape library

- Use the **🧩 Shapes** toolbar button to manage stickers: paste an SVG + fill in a **description**, stored in `shapes.json`
- Storage format: `{"id": {"svg": "<svg>…</svg>", "desc": "semantic description"}}`, compatible with the old plain-string format
- The **description is meant for the AI** — when the AI reads `desc` it knows what that shape id represents (e.g. `db` = database)
- Usage: write `d:id` at the box's **bottom-left corner** (or use `Ctrl+Shift+B` and pick from a dialog); at render time the box is replaced by the shape SVG
- **IDs are limited to 1-3 characters** (letters/digits), e.g. `d:db`, `d:mp`, `d:act`
- At render time the shape SVG is strictly clipped to the **original box area** (`overflow:hidden`); no graphic ever exceeds the box boundary

### Keyboard shortcuts

#### Tools

| Shortcut | Function |
|--------|------|
| `v` | Select tool; press again to enter/exit Visual mode |
| `f` | Freehand draw (horizontal ─ / vertical │) |
| `l` | Line (supports L-shaped turns) |
| `r` | Box |
| `a` | Arrow connector (L-shaped + directional arrowhead) |
| `i` | Text input (Vim insert mode) |
| `w` | Comb / line-tidying (aligns scattered horizontal/vertical lines) |
| `m` | Move tool |
| `e` | Erase |
| `Esc` | Back to Normal mode (cancel Visual, switch back to Select tool) |

> **Rounded box**: no shortcut — pick it in the toolbar; once drawn you can toggle round⇄square corners with `Ctrl+Shift+R`.
> **Keyboard drawing**: under the `l` line / `r` box / `a` arrow / `k` thick-arrow tools, use the **arrow keys** to extend the path (start is fixed), **Enter** to confirm, **Esc** to cancel and redraw — same as mouse dragging.

#### Visual mode (activated with `v`)

| Action | Effect |
|------|------|
| Arrow keys / mouse drag | Extend the selection |
| Drag inside the selection | Move the selected content (auto-switches to Move) |
| `x` / `X` | Delete current / previous cell |
| `dd` | Delete current row |
| `yy` / `p` | Copy row / paste |
| `0` / `$` | Line start / line end |

#### Editing

| Shortcut | Function |
|--------|------|
| `Space` | Insert a space, shift content right |
| `Backspace` | Delete previous cell, shift left |
| `Delete` | Clear current cell |
| `Select + Delete/Backspace` | Delete C column across selected rows, shift left |
| `Select + Space` | Insert a C column of spaces across selected rows, shift right |
| `Shift+V` | Insert column (V = vertical) |
| `Shift+H` | Insert row (H = horizontal) |
| `Ctrl+Shift+V` | Delete column (whole canvas) |
| `Ctrl+Shift+H` | Delete row |
| `Insert` | Toggle insert / overwrite text mode |

#### Vim-style

| Shortcut | Function |
|--------|------|
| `u` | Undo |
| `Ctrl+r` | Redo |
| `Ctrl+Z` | Undo (fallback) |
| `Ctrl+C/X/V` | Copy / cut / paste |
| `Shift+color-code` (e.g. `Shift+G`) | Colorize the box under the cursor |
| `Ctrl+Shift+D` | Toggle solid⇄dashed on the box/rounded-box under the cursor |
| `Ctrl+Shift+R` | Toggle round⇄square corners on the box under the cursor (cycles) |
| `Ctrl+Shift+B` | Replace the box/rounded-box under the cursor with a custom shape (pick from a dialog; writes `d:id` at the bottom-left corner) |
| `Ctrl+[` / `Ctrl+]` | Previous diagram / next diagram |
| Original-color button (None) | Restore a colorized box to its uncolored state |

---

## Command 2: md-ascii-diagram-gen

Batch-renders all ASCII diagrams in a document into colored PNG images.

### Syntax

```powershell
# PowerShell
cd ~/.claude/skills/md-ascii-diagram/
node render_color.js <doc-path> <output-dir>
```

```bash
# Bash
cd ~/.claude/skills/md-ascii-diagram/
node render_color.js <doc-path> <output-dir>
```

### Arguments

| Argument | Description |
|------|------|
| `<doc-path>` | Markdown document path (e.g. `../DESIGN.md`) |
| `<output-dir>` | PNG output directory (default `./diagrams_out`) |
| `--only=name` | Process only the given diagrams (comma-separated) |

### Examples

```bash
# Generate everything
node render_color.js DESIGN.md diagrams_out

# Generate only p1 and d17
node render_color.js DESIGN.md diagrams_out --only=p1,d17

# Preview the result of one diagram
node render_color.js DESIGN.md diagrams_out --only=p1
```

### Concurrent generation (when >5 diagrams)

When there are many diagrams, use concurrency to speed things up — at most 5 diagrams per batch, up to 4 batches in parallel:

```powershell
# PowerShell example: 21 diagrams in 4+4+4+4+5 concurrent batches
$md = "C:\path\to\DESIGN.md"
$out = "diagrams_out"
$script = "$env:USERPROFILE\.claude\skills\md-ascii-diagram\render_color.js"
$batches = @("1,2,3,4,5", "6,7,8,9,10", "11,12,13,14,15", "16,17,18,19,20,21")
$batches | ForEach-Object -Parallel {
  node $using:script $using:md $using:out --only=$_
} -ThrottleLimit 4
```

```bash
# Same logic in Bash
md="/path/to/DESIGN.md"
out="diagrams_out"
script="$HOME/.claude/skills/md-ascii-diagram/render_color.js"
for batch in "1,2,3,4,5" "6,7,8,9,10" "11,12,13,14,15" "16,17,18,19,20,21"; do
  node "$script" "$md" "$out" --only="$batch" &
done
wait
```

### Workflow

1. The script scans the document and extracts all ASCII diagrams (comment blocks and code blocks)
2. For each diagram:
   - Detects the box's color markers (corner color codes)
   - Takes a high-resolution screenshot with Playwright + Edge to generate the PNG
3. Automatically inserts a `![name](diagrams_out/name.png)` reference after each diagram in the document
4. The original ASCII diagram stays as a comment block (`<!--diagram NAME-->`), so it can be re-rendered after edits in the editor

### Writing color markers

Put color codes in the top-left and bottom-right corners of a box:

```diff
-┌──────────────┐
+g──────────────┐
│  Platform CI  │
└──────────────g
```

- Top-left corner: the color code replaces `┌` (e.g. `g`)
- Bottom-right corner: the color code replaces `┘` (e.g. `g`)
- To add a shade: `g3──────────┐` (3 = shade level, 1-6, default 3)

### Fonts

Rendering uses the **Sarasa Mono SC Nerd** font (monospace CJK font).
If it isn't installed, the script falls back to Consolas / Courier New.
It is recommended to install [Sarasa Mono SC Nerd](https://github.com/be5invis/Sarasa-Gothic), or drop the `.ttf` into the `fonts/` directory for automatic loading.

---

## Command 3: md-ascii-diagram-beautify

Image-to-image overall beautification of a rendered PNG (workflow step 5): feeds the **original image + style reference image(s) + a preset prompt** to an image-generation model and outputs a styled result.

### Syntax

```bash
cd ~/.claude/skills/md-ascii-diagram/
node beautify.js <input.png> [--style=light|black-metal] [--model=gpt-image-2] [--base-url=https://api.openai.com/v1] [--out=<output.png>]
```

### Arguments

| Argument | Description |
|------|------|
| `<input.png>` | The rendered PNG (output of render_color.js) |
| `--style=<name>` | Beautify style: `light` / `black-metal`, or a custom one defined in `styles.json` |
| `--model=<model>` | Image-generation model, default `gpt-image-2` |
| `--base-url=<URL>` | OpenAI-compatible service URL; default official; can point to a domestic aggregator/proxy for multi-model support |
| `--ref=<ref-image>` | Manually append a reference image (in addition to the style's own refs) |
| `--quality=<low\|medium\|high>` | Generation quality, default `high` |
| `--out=<output.png>` | Output path, default `<input-name>.beautified-<style>.png` |

### API Key

Never stored on disk; read in this priority order:

1. `--api-key=sk-xxx`
2. Environment variable `OPENAI_API_KEY` or `BEAUTIFY_API_KEY`

### Supported providers

| provider | Description | Usage |
|----------|------|------|
| `openai` (default) | Any OpenAI-compatible image API: official / domestic aggregator / proxy | `--provider=openai` + `--base-url` + `--model` (e.g. gpt-image-2) |
| `yuntts` | Yuntone GPT Image 2, direct domestic access (tested & working) | `--provider=yuntts` |

Switching example:

```bash
# Official / compatible service
node beautify.js diagram.png --provider=openai --base-url=https://api.openai.com/v1 --model=gpt-image-2
# Domestic direct access (yuntts)
node beautify.js diagram.png --provider=yuntts
```

### Style configuration

Each style = **a set of prompts + a set of reference images**:

- Built-in `light` (tech-newspaper style), `black-metal` (metal-tech style)
- Reference images live in `styles/<style-name>/`; register `refs` in the `STYLES` object inside `beautify.js` or in the external `styles.json`
- With no reference image it automatically falls back to single-image mode (`/images/edits`) and still produces a result

### Server integration

`server.py` provides `POST /beautify` (async task): save comment block → render PNG → `beautify.js` beautify → return the output path; the editor's **✨ Beautify** button calls it.

### Editor "✨ AI Beautify" configuration (four items)

When the editor clicks **✨ AI Beautify**, `server.py` calls `beautify.js` passing only `--style`; the other four items are **all read from environment variables** (same logic as beautify.js):

| Config | Environment variable | Default | Description |
|------|---------|--------|------|
| Provider | `BEAUTIFY_PROVIDER` | `openai` | `openai` (official/compatible/proxy) or `yuntts` (domestic direct) |
| Model | `BEAUTIFY_MODEL` | `gpt-image-2` | Image-generation model name |
| Base URL | `BEAUTIFY_BASE_URL` | by provider: openai→`https://api.openai.com/v1`, yuntts→`https://www.yuntts.com/api/v1` | Service URL; usually needs to change together with the provider |
| API Key | `BEAUTIFY_API_KEY` or `OPENAI_API_KEY` | none (required) | Provider key, never stored on disk |

**How to set it (Windows/PowerShell):**
```powershell
# One-off (current session)
$env:BEAUTIFY_PROVIDER = "yuntts"
$env:BEAUTIFY_MODEL = "gpt-image-2"
$env:BEAUTIFY_API_KEY = "sk-xxx"
# Persistent (writes to the user environment; takes effect in new terminals)
[Environment]::SetEnvironmentVariable("BEAUTIFY_PROVIDER", "yuntts", "User")
[Environment]::SetEnvironmentVariable("BEAUTIFY_API_KEY", "sk-xxx", "User")
```

**Common combinations:**
```powershell
# Official OpenAI
$env:BEAUTIFY_API_KEY = "sk-xxx"          # just the key; everything else defaults (provider=openai)
# Domestic direct access (yuntts, tested & working)
$env:BEAUTIFY_PROVIDER = "yuntts"
$env:BEAUTIFY_API_KEY = "sk-yuntts-key"   # yuntts key (base-url switches to yuntts automatically)
```

### Config self-check (troubleshooting)

When the editor clicks **✨ AI Beautify** it first requests `GET /beautify/check` for an automatic preflight; if not ready it pops up exactly what's missing. Manual check:

```bash
curl http://localhost:<port>/beautify/check
# example response:
# {"ready":false,"has_api_key":true,"provider":"yuntts","model":"gpt-image-2",
#  "base_url":"https://www.yuntts.com/api/v1","issues":["Missing API Key (set BEAUTIFY_API_KEY or OPENAI_API_KEY)"]}
```

**Criterion: only `ready: true` means beautify will work.** If `false`, look at the items listed in `issues` and set the corresponding environment variables per the table above, then restart server.py. After changing environment variables you **must restart the server** for them to take effect (they are read once at process startup).

---

## Command 4: md-ascii-diagram-convert

Converts "code-block style" ASCII diagrams in a document to "comment-block style" (`<!--diagram NAME-->`), so they can later be edited, rendered, and beautified by name.

### Syntax

```bash
cd ~/.claude/skills/md-ascii-diagram/
node convert.js <doc.md> [--index=N] [--name=NAME] [--dry-run]
```

### Arguments

| Argument | Description |
|------|------|
| `<doc.md>` | Markdown document |
| `--index=N` | Convert only the Nth code-block diagram (in document order, starting at 1) |
| `--name=NAME` | Assign a name (default auto-names p1/p2...; automatically avoids existing names) |
| `--dry-run` | Preview only, no file write |

### Examples

```bash
# Convert all code-block diagrams (auto-named)
node convert.js DESIGN.md

# Convert only the 2nd one and name it d17
node convert.js DESIGN.md --index=2 --name=d17
```

---

## Command 5: md-ascii-diagram-beautify-doc

Document-level beautify: beautifies the specified diagrams in a document, completing the "render PNG → beautify.js → update image reference" loop automatically.

### Syntax

```bash
cd ~/.claude/skills/md-ascii-diagram/
node beautify-cmd.js <doc.md> --list-styles
node beautify-cmd.js <doc.md> --name=<diagram-name> --style=<style>
node beautify-cmd.js <doc.md> --all --style=<style>
```

### Arguments

| Argument | Description |
|------|------|
| `--list-styles` | List all available styles (from `styles/*/style.json`) |
| `--name=<diagram-name>` | Beautify a single named diagram (comment-block name) |
| `--all` | Beautify all diagrams in the document |
| `--style=<style>` | Beautify style, default `black-metal` |
| `--provider=<provider>` | Default `yuntts` |

### Environment variables

Requires `OPENAI_API_KEY` or `BEAUTIFY_API_KEY` (read automatically by beautify.js, never stored on disk).

### Examples

```bash
# List available styles
node beautify-cmd.js DESIGN.md --list-styles

# Beautify a single diagram
node beautify-cmd.js DESIGN.md --name=p1 --style=black-metal
```
