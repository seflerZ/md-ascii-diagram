# Markdown ASCII Diagram

一个 Markdown 内嵌 ASCII 图的**可视化编辑器** + **彩色 PNG 渲染器**工具包。

---

## 功能

- **可视化网格编辑器**（`ascii-editor.html`） — 在浏览器中编辑 ASCII 图，支持多种绘图工具、颜色着色、撤销重做等
- **批量 PNG 渲染**（`render_color.js`） — 将 Markdown 文档中的 ASCII 图渲染为高分辨率彩色 PNG
- **HTTP 服务器**（`server.py`） — 提供静态文件服务和 Markdown 文件读写接口

## 安装为 Claude Code 技能

将项目安装为 Claude Code skill，可在对话中通过 `/md-ascii-diagram edit` 和 `/md-ascii-diagram gen` 直接调用。

```bash
# 克隆到技能目录
mkdir -p ~/.claude/skills
git clone git@github.com:seflerZ/markdown-ascii-diagram.git ~/.claude/skills/md-ascii-diagram
```

安装完成后，在 Claude Code 对话中：

| 命令 | 功能 |
|------|------|
| `/md-ascii-diagram edit <文档.md>` | 打开编辑器编辑文档中的 ASCII 图 |
| `/md-ascii-diagram gen <文档.md>` | 批量渲染所有图为彩色 PNG |

> **字体**：建议安装 [Sarasa Mono SC Nerd](https://github.com/be5invis/Sarasa-Gothic) 以获得最佳显示效果。
> 字体文件可放入 `~/.claude/skills/md-ascii-diagram/fonts/` 目录自动加载。

## 快速开始

### 前置依赖

- Python 3（运行服务器）
- Node.js 16+（运行渲染脚本）
- Playwright（渲染 PNG 用）
  ```bash
  npm install playwright
  npx playwright install msedge
  ```

### 启动编辑器

```bash
# 启动服务器
cd markdown-ascii-diagram
python server.py

# 在浏览器打开
# http://localhost:8000/ascii-editor.html?file=你的文档.md
```

编辑器支持通过 `?file=` 参数加载 Markdown 文档，编辑后可保存回原文件。

### 渲染彩色 PNG

```bash
node render_color.js <文档路径> [输出目录]
```

脚本会自动：
1. 扫描文档中所有 ASCII 图（`<!--diagram NAME-->` 注释块和 ``` 代码块）
2. 识别框的颜色标记（对角线颜色码）
3. 用 Playwright 截图生成高分辨率 PNG
4. 在文档中自动插入图片引用

## 颜色码

| 码 | 颜色 | 色值 |
|----|------|------|
| `m` | 玫红 | `#CC247C` |
| `r` | 红 | `#E95351` |
| `o` | 橙 | `#F7A24F` |
| `y` | 黄 | `#FAE538` |
| `g` | 绿 | `#4EA660` |
| `c` | 淡蓝 | `#79CAFB` |
| `b` | 蓝 | `#5292F7` |
| `p` | 紫 | `#AA77E9` |
| `e` | 灰 | `#D9D1D1` |

### 着色用法

在框的左上角和右下角放颜色码：

```
┌──────────────┐         g──────────────┐
│  Platform CI  │    →    │  Platform CI  │
└──────────────┘         └──────────────g
```

- 左上角：颜色码替换 `┌`（如 `g`）
- 右下角：颜色码替换 `┘`（如 `g`）
- 加明度：`g3──────────┐`（数字 1-6，默认 3）

### 文字颜色标记

| 语法 | 效果 |
|------|------|
| `___文字___` | 红色波浪下划线 |
| `_g_文字_g_` | 绿色文字（色码 m/r/o/y/g/c/b/p/e） |
| `_!_文字_!_` | 彩虹色（9 色循环） |
| `*文字*` | 粗体 |

## 快捷键

| 键 | 功能 |
|------|------|
| `V` | 选择 |
| `F` | 自由绘制 |
| `L` | 直线 |
| `B` | 矩形框 |
| `R` | 圆角矩形 |
| `Ctrl+R` | 圆角化当前框 |
| `A` | 箭头连线 |
| `T` | 文字输入 |
| `W` | 梳子理线 |
| `E` | 擦除 |
| `I` | 插入列（全画面） |
| `Shift+I` | 插入行 |
| `Space` | 插入空格，右侧右移 |
| `Backspace` | 删除前一个格子，右侧左移 |
| `Delete` | 清空当前格子 |
| `框选 + Delete/Backspace` | 对框选行删 C 列 |
| `框选 + Space` | 对框选行插 C 列 |
| `Shift+Delete` | 删除列 |
| `Ctrl+Delete` | 删除行 |
| `Ctrl+S` | 保存 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+C/X/V` | 复制/剪切/粘贴 |
| `Shift+色码` | 着色光标所在框 |

## 字体

编辑器默认使用 **Sarasa Mono SC Nerd**（等宽中文字体）。
如未安装，fallback 到 Consolas / Courier New，但 Ambiguous 宽度字符（如 `→←↑↓↔◄►`）可能显示错位。

建议在 VSCode 中设置：
```json
"editor.fontFamily": "'Sarasa Mono SC Nerd', Consolas, monospace"
```

## 文件结构

```
markdown-ascii-diagram/
├── ascii-editor.html    # 可视化编辑器（单 HTML 文件）
├── render_color.js      # 批量 PNG 渲染脚本
├── server.py             # HTTP 服务器
└── SKILL.md              # 技能文档（Claude Code 集成用）
```
