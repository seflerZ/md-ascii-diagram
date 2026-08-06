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
| AI img2img beautify integration | ✅ Comming soon | ❌ Not availble | ❌ Not available | ❌ Not available |

## ScreenShots

1. Prompt to AI to auto generate the diagram:
<img width="2232" height="1082" alt="image" src="https://github.com/user-attachments/assets/8991082c-d38c-45f0-87ed-30bed64cd527" />

2. Fine tune it within the build in editor (i18n comes later):
<img width="2112" height="1210" alt="image" src="https://github.com/user-attachments/assets/7218a824-220a-4403-8af5-ba5fafe2f9db" />

3. GPT Image-2 generated final results：
<table>
  <tr>
    <th width="500px">Light Style</th>
    <th width="500px">Black Metal Style</th>
  </tr>
  <tr>
    <td><img width="100%" alt="image" src="https://github.com/user-attachments/assets/6cc1a12f-4922-4bf1-97aa-02a564fcaa91" /></td>
    <td><img width="100%" alt="image" src="https://github.com/user-attachments/assets/cdd41ff8-21e6-4c7a-9225-2846eaf6ecef" />
</td>
  </tr>
  <tr>
    <td>
Prompts: <br/>
   1. Text must remain clear. The shapes of the arrow lines and the positions of the rectangles must not be altered.<br/>
   2. Add icons to each rectangle based on its content to aid comprehension (icons must be relevant to the content — they can be product-describing icons or illustrative diagrams), highlighting its role/function.<br/>
   3. Do not remove or cut any of the original text.<br/>
   4. Preserve the existing color scheme. Keep the background pure white, and do not apply additional coloring to the shapes (other elements are allowed).<br/>
   5. Use a tech-newsletter style (科技小报风).</td>
    <td>
    Prompts: <br/>
      1. Text must remain clear. The shapes of the arrow lines and the positions of the rectangles must not be altered.<br/>
      2. Add icons to each rectangle based on its content to aid comprehension (icons must be relevant to the content — they can be product-describing icons or illustrative diagrams), highlighting its role/function.<br/>
      3. Do not remove or cut any of the original text.<br/>
      4. Preserve the existing color scheme. Keep the background pure black, and do not apply additional coloring to the shapes (other elements are allowed).<br/>
      5. Adjust the color lightness appropriately to suit the dark background.<br/>
      6. Use a metallic tech style (金属科技风).<br/>
    </td>
  </tr>
</table>

> ⚠️ Note: GPT Image-2 or SeedDance is not included in this project, you must bring you own access.
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
