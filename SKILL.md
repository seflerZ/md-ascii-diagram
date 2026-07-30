---
name: md-ascii-diagram
description: "Markdown ASCII 图表工具。用法: /md-ascii-diagram edit <文档.md>  打开编辑器编辑文档中的图；/md-ascii-diagram gen <文档.md>  批量渲染所有图为彩色 PNG。支持 9 种颜色、6 级明度、嵌套框、连接符自动合并、四边墙连续性检测。"
metadata:
  type: skill
  version: "2.1.0"
---

# md-ascii-diagram — Markdown ASCII 图表编辑器与渲染

## 概述

本技能包含两个工具：
1. **可视化编辑器** — 网格化编辑 ASCII 图，支持框选、画线、画框、箭头、着色、线条理顺等
2. **批量渲染器** — 将 Markdown 文档中的 ASCII 图渲染为彩色 PNG 图片，保留注释格式供后续修改

---

## 文件清单

技能包路径：`~/.claude/skills/md-ascii-diagram/`

| 文件 | 说明 |
|------|------|
| `ascii-editor.html` | 可视化编辑器（单 HTML 文件，浏览器直接打开） |
| `render_color.js` | 批量渲染脚本（Node.js + Playwright） |
| `server.py` | HTTP 服务器 + `/save` API（Python3） |

---

## 命令一：md-ascii-diagram-edit

打开编辑器，加载 Markdown 文档中的 ASCII 图进行编辑，编辑后可直接保存回文档。

### 启动服务器

编辑器必须通过 HTTP 服务器运行，才能读取和写入 Markdown 文件：

```bash
# Bash
cd ~/.claude/skills/md-ascii-diagram/
python3 server.py [端口]
# 默认端口 8000
```

```powershell
# PowerShell
cd ~\.claude\skills\md-ascii-diagram\
python server.py [端口]
```

### 连接 Markdown 文档

服务器启动后，在浏览器打开：

```
http://localhost:8000/ascii-editor.html?file=C:/path/to/DESIGN.md
```

编辑器会自动：
1. `fetch` Markdown 文件内容（通过 `/?file=` API）
2. 提取所有 ASCII 图（`<!--diagram NAME-->` 注释块 和 ``` 代码块）
3. 弹出图列表供选择
4. 选择后加载到网格编辑

### 编辑与保存

- **编辑完成** → 点击 **💿 保存** → 通过 `POST /save` API 写回原 Markdown 文件
- 已有名字的图 → 在文档中更新 `<!--diagram NAME-->` 注释块内容
- 新图 → 追加到文档末尾
- 保存后 VSCode 自动检测文件变化，无需手动复制粘贴
- 也支持 **💾 导出** 复制 `<!--diagram NAME-->` 格式到剪贴板（手动粘贴）

### 支持的图格式

| 格式 | 示例 | 名称 |
|------|------|------|
| 注释块 | `<!--diagram p1\n...\n-->` | 有名字（如 p1） |
| 代码块 | ``` ``` ``` | 无名字（需取名后导出） |

### 颜色码

| 码 | 名称 | 色值 |
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

### 文字颜色标记

在文字前后加标记可以给文字上色或加下划线，支持预览和 PNG 渲染：

| 语法 | 效果 |
|------|------|
| `___文字___` | 红色波浪下划线 |
| `_g_文字_g_` | 绿色文字（色码 m/r/o/y/g/c/b/p/e） |
| `_!_文字_!_` | 彩虹色文字（9 色循环） |

示例：`___重要___` 下划线，`_r_错误_r_` 红色，`_!_恭喜_!_` 彩虹

### 快捷键

#### 工具

| 快捷键 | 功能 |
|--------|------|
| `v` | 选择工具，再次按进入/退出 Visual 模式 |
| `f` | 自由绘制（横─竖│） |
| `l` | 直线（支持 L 型拐弯） |
| `b` | 矩形框 |
| `r` | 圆角矩形 |
| `a` | 箭头连线（L 型 + 方向箭头） |
| `i` | 文字输入（Vim 进入插入模式） |
| `w` | 梳子理线（对齐散落的横线/竖线） |
| `m` | 移动工具 |
| `e` | 擦除 |
| `Esc` | 回到 Normal 模式（取消 Visual，切回选择工具） |

#### Visual 模式（`v` 激活）

| 操作 | 效果 |
|------|------|
| 方向键 / 鼠标拖拽 | 扩展选区 |
| 拖拽选区内部 | 移动选区内容（自动切移动） |
| `x` / `X` | 删当前/前一个格子 |
| `dd` | 删当前行 |
| `yy` / `p` | 复制行 / 粘贴 |
| `0` / `$` | 行首 / 行尾 |

#### 编辑

| 快捷键 | 功能 |
|--------|------|
| `Space` | 插入空格，右侧右移 |
| `Backspace` | 删除前一个格子，右侧左移 |
| `Delete` | 清空当前格子 |
| `框选 + Delete/Backspace` | 对框选行删 C 列，右侧左移 |
| `框选 + Space` | 对框选行插 C 列空格，右侧右移 |
| `I` / `Shift+I` | 插入列 |
| `Ctrl+Shift+I` | 插入行 |
| `Shift+Delete` | 删除列（全画面） |
| `Ctrl+Delete` | 删除行 |
| `Insert` | 切换文字插入/覆盖模式 |

#### Vim 风格

| 快捷键 | 功能 |
|--------|------|
| `u` | 撤销 |
| `Ctrl+r` | 重做 |
| `Ctrl+Z` | 撤销（备用） |
| `Ctrl+C/X/V` | 复制/剪切/粘贴 |
| `Shift+色码`（如 `Shift+G`） | 着色光标所在框 |
| `Ctrl+Shift+R` | 圆角化当前矩形框 |
| `Ctrl+[` / `Ctrl+]` | 上一张图 / 下一张图 |
| 原色按钮（原） | 还原着色为未着色状态 |

---

## 命令二：md-ascii-diagram-gen

批量渲染文档中所有 ASCII 图为彩色 PNG 图片。

### 语法

```powershell
# PowerShell
cd ~/.claude/skills/md-ascii-diagram/
node render_color.js <文档路径> <输出目录>
```

```bash
# Bash
cd ~/.claude/skills/md-ascii-diagram/
node render_color.js <文档路径> <输出目录>
```

### 参数

| 参数 | 说明 |
|------|------|
| `<文档路径>` | Markdown 文档路径（如 `../DESIGN.md`） |
| `<输出目录>` | PNG 输出目录（默认 `./diagrams_out`） |
| `--only=名称` | 只处理指定图（逗号分隔） |

### 示例

```bash
# 全部生成
node render_color.js DESIGN.md diagrams_out

# 只生成 p1 和 d17
node render_color.js DESIGN.md diagrams_out --only=p1,d17

# 预览生成结果
node render_color.js DESIGN.md diagrams_out --only=p1
```

### 并发生成（>5 张时）

图多时用并发加速，每批最多 5 张，最多 4 批同时进行：

```powershell
# PowerShell 示例：21 张图分 4+4+4+4+5 批并发
$md = "C:\path\to\DESIGN.md"
$out = "diagrams_out"
$script = "$env:USERPROFILE\.claude\skills\md-ascii-diagram\render_color.js"
$batches = @("1,2,3,4,5", "6,7,8,9,10", "11,12,13,14,15", "16,17,18,19,20,21")
$batches | ForEach-Object -Parallel {
  node $using:script $using:md $using:out --only=$_
} -ThrottleLimit 4
```

```bash
# Bash 同样逻辑
md="/path/to/DESIGN.md"
out="diagrams_out"
script="$HOME/.claude/skills/md-ascii-diagram/render_color.js"
for batch in "1,2,3,4,5" "6,7,8,9,10" "11,12,13,14,15" "16,17,18,19,20,21"; do
  node "$script" "$md" "$out" --only="$batch" &
done
wait
```

### 工作流程

1. 脚本扫描文档，提取所有 ASCII 图（注释块和代码块）
2. 对每张图：
   - 检测框的颜色标记（对角线颜色码）
   - 用 Playwright + Edge 截图生成高分辨率 PNG
3. 在文档中每张图后自动插入 `![名称](diagrams_out/名称.png)` 引用
4. 原始 ASCII 图的注释格式保留（`<!--diagram NAME-->`），可在编辑器中修改后重新渲染

### 颜色标记书写

在框的左上角和右下角放颜色码：

```diff
-┌──────────────┐
+g──────────────┐
│  Platform CI  │
└──────────────g
```

- 左上角：颜色码替换 `┌`（如 `g`）
- 右下角：颜色码替换 `┘`（如 `g`）
- 加明度：`g3──────────┐`（3=明度，1-6，默认3）

### 字体说明

渲染使用 **Sarasa Mono SC Nerd** 字体（等宽中文字体）。
如未安装，脚本 fallback 到 Consolas / Courier New。
建议安装 [Sarasa Mono SC Nerd](https://github.com/be5invis/Sarasa-Gothic)，或将 `.ttf` 放入 `fonts/` 目录自动加载。
