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
| `beautify.js` | 图生图美化脚本（Node.js，OpenAI 兼容 /images 接口） |
| `beautify-cmd.js` | 文档级美化命令（渲染 + 美化 + 更新引用） |
| `convert.js` | 代码块风格 → 注释块风格转换脚本 |
| `styles/` | 风格配置目录：每种风格 = 参考图组 + 提示词组 |
| `server.py` | HTTP 服务器 + `/save` `/generate` `/beautify/start\|status\|insert\|check` API（Python3） |

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

### 自定义形状库

- 工具栏「🧩 形状」管理贴纸：粘贴 SVG + 填**描述**，存到 `shapes.json`
- 存储格式：`{"编号": {"svg": "<svg>…</svg>", "desc": "语义描述"}}`，兼容旧纯字符串格式
- **描述字段供大模型阅读**——AI 读到 `desc` 即知该编号形状代表什么（如 `db` = 数据库）
- 使用：在框**左下角**写 `d:编号`（或 `Ctrl+Shift+B` 弹窗选择），渲染时该框替换成形状 SVG
- **编号限 1-3 个字符**（字母/数字），如 `d:db`、`d:mp`、`d:act`
- 渲染时形状 SVG 严格贴合**原框区域**（`overflow:hidden`），任何图形都不会超出原框边界

### 快捷键

#### 工具

| 快捷键 | 功能 |
|--------|------|
| `v` | 选择工具，再次按进入/退出 Visual 模式 |
| `f` | 自由绘制（横─竖│） |
| `l` | 直线（支持 L 型拐弯） |
| `r` | 矩形框 |
| `a` | 箭头连线（L 型 + 方向箭头） |
| `i` | 文字输入（Vim 进入插入模式） |
| `w` | 梳子理线（对齐散落的横线/竖线） |
| `m` | 移动工具 |
| `e` | 擦除 |
| `Esc` | 回到 Normal 模式（取消 Visual，切回选择工具） |

> **圆角矩形**：不设快捷键，工具栏选择；画好后可用 `Ctrl+Shift+R` 圆角⇄方角转换。
> **键盘绘制**：`l` 直线 / `r` 矩形 / `a` 箭头 / `k` 粗箭头 工具下，用**方向键**扩展路径（起点固定），**Enter** 确认绘制，**Esc** 取消重画——与鼠标拖拽一致。

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
| `Shift+V` | 插入列（V=纵向） |
| `Shift+H` | 插入行（H=横向） |
| `Ctrl+Shift+V` | 删除列（全画面） |
| `Ctrl+Shift+H` | 删除行 |
| `Insert` | 切换文字插入/覆盖模式 |

#### Vim 风格

| 快捷键 | 功能 |
|--------|------|
| `u` | 撤销 |
| `Ctrl+r` | 重做 |
| `Ctrl+Z` | 撤销（备用） |
| `Ctrl+C/X/V` | 复制/剪切/粘贴 |
| `Shift+色码`（如 `Shift+G`） | 着色光标所在框 |
| `Ctrl+Shift+D` | 光标所在矩形/圆角框 实线⇄虚线转换 |
| `Ctrl+Shift+R` | 光标所在矩形框 圆角⇄方角转换（循环） |
| `Ctrl+Shift+B` | 光标所在矩形/圆角框 → 替换成自定义形状（弹窗选择，左下角写 `d:编号`） |
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

---

## 命令三：md-ascii-diagram-beautify

对渲染好的 PNG 做图生图整体美化（流程第 5 步）：把**原图 + 风格参考图 + 既定提示词**投喂给图像生成模型，输出风格化成品。

### 语法

```bash
cd ~/.claude/skills/md-ascii-diagram/
node beautify.js <输入.png> [--style=light|black-metal] [--model=gpt-image-2] [--base-url=https://api.openai.com/v1] [--out=<输出.png>]
```

### 参数

| 参数 | 说明 |
|------|------|
| `<输入.png>` | 渲染好的 PNG（render_color.js 产物） |
| `--style=<名>` | 美化风格：`light` / `black-metal`，或 `styles.json` 里自定义 |
| `--model=<模型>` | 图像生成模型，默认 `gpt-image-2` |
| `--base-url=<URL>` | OpenAI 兼容服务地址，默认官方；可切国内聚合/中转，实现多模型通用 |
| `--ref=<参考图>` | 手动追加参考图（在风格自带 refs 之外） |
| `--quality=<low\|medium\|high>` | 生成质量，默认 `high` |
| `--out=<输出.png>` | 输出路径，默认 `输入名.beautified-风格.png` |

### API Key

不落盘，按以下优先级读取：

1. `--api-key=sk-xxx`
2. 环境变量 `OPENAI_API_KEY` 或 `BEAUTIFY_API_KEY`

### 支持的服务商（provider）

| provider | 说明 | 用法 |
|----------|------|------|
| `openai`（默认） | 任意 OpenAI 兼容图像接口：官方 / 国内聚合 / 中转 | `--provider=openai` + `--base-url` + `--model`（如 gpt-image-2） |
| `yuntts` | 云音工坊 GPT Image 2，国内直连（已实测跑通） | `--provider=yuntts` |

切换示例：

```bash
# 官方/兼容服务
node beautify.js 图.png --provider=openai --base-url=https://api.openai.com/v1 --model=gpt-image-2
# 国内直连（yuntts）
node beautify.js 图.png --provider=yuntts
```

### 风格配置

每个风格 = **一组提示词 + 一组参考图**：

- 内置 `light`（科技小报风）、`black-metal`（金属科技风）
- 参考图放 `styles/<风格名>/` 目录，在 `beautify.js` 的 `STYLES` 或外部 `styles.json` 里登记 `refs`
- 无参考图时自动降级为单图模式（`/images/edits`），也能出图

### 与服务器集成

`server.py` 提供 `POST /beautify`（异步任务）：保存注释块 → 渲染 PNG → `beautify.js` 美化 → 返回输出路径，编辑器「✨ 美化」按钮调用。

### 编辑器「✨ AI 美化」配置（四项）

编辑器点「✨ AI 美化」时，`server.py` 调 `beautify.js` 只传 `--style`，其余四项**全部从环境变量读取**（与 beautify.js 同逻辑）：

| 配置 | 环境变量 | 默认值 | 说明 |
|------|---------|--------|------|
| Provider | `BEAUTIFY_PROVIDER` | `openai` | `openai`（官方/兼容/中转）或 `yuntts`（国内直连） |
| Model | `BEAUTIFY_MODEL` | `gpt-image-2` | 图像生成模型名 |
| Base URL | `BEAUTIFY_BASE_URL` | 按 provider：openai→`https://api.openai.com/v1`，yuntts→`https://www.yuntts.com/api/v1` | 服务地址，改 provider 时通常需同步 |
| API Key | `BEAUTIFY_API_KEY` 或 `OPENAI_API_KEY` | 无（必配） | 服务商密钥，不落盘 |

**设置方法（Windows/PowerShell）：**
```powershell
# 一次性（当前会话）
$env:BEAUTIFY_PROVIDER = "yuntts"
$env:BEAUTIFY_MODEL = "gpt-image-2"
$env:BEAUTIFY_API_KEY = "sk-xxx"
# 持久化（写入用户环境变量，重开终端生效）
[Environment]::SetEnvironmentVariable("BEAUTIFY_PROVIDER", "yuntts", "User")
[Environment]::SetEnvironmentVariable("BEAUTIFY_API_KEY", "sk-xxx", "User")
```

**常见组合示例：**
```powershell
# 官方 OpenAI
$env:BEAUTIFY_API_KEY = "sk-xxx"          # 只配 key，其余用默认（provider=openai）
# 国内直连（yuntts，已实测跑通）
$env:BEAUTIFY_PROVIDER = "yuntts"
$env:BEAUTIFY_API_KEY = "sk-yuntts-key"   # yuntts 的 key（base-url 自动切到 yuntts）
```

### 配置自检（问题排查）

编辑器点「✨ AI 美化」时会先请求 `GET /beautify/check` 自动预检，未就绪会弹出具体缺哪项。人工排查：

```bash
curl http://localhost:<端口>/beautify/check
# 返回示例：
# {"ready":false,"has_api_key":true,"provider":"yuntts","model":"gpt-image-2",
#  "base_url":"https://www.yuntts.com/api/v1","issues":["缺少 API Key（需设置 BEAUTIFY_API_KEY 或 OPENAI_API_KEY）"]}
```

**判断标准：`ready: true` 才可正常美化。** 若 `false`，看 `issues` 列出的缺项，按上表补对应环境变量后重启 server.py。改环境变量后**必须重启 server** 才生效（进程启动时读取一次）。

---

## 命令四：md-ascii-diagram-convert

把文档中「代码块风格」的 ASCII 图转成「注释块风格」（`<!--diagram NAME-->`），便于后续按名字编辑、渲染、美化。

### 语法

```bash
cd ~/.claude/skills/md-ascii-diagram/
node convert.js <文档.md> [--index=N] [--name=NAME] [--dry-run]
```

### 参数

| 参数 | 说明 |
|------|------|
| `<文档.md>` | Markdown 文档 |
| `--index=N` | 只转第 N 个代码块图（按文档顺序，1 起） |
| `--name=NAME` | 指定图名（默认自动命名 p1/p2...，自动避开已存在的名字） |
| `--dry-run` | 只预览，不写文件 |

### 示例

```bash
# 转换所有代码块图（自动命名）
node convert.js DESIGN.md

# 只转第 2 个并命名为 d17
node convert.js DESIGN.md --index=2 --name=d17
```

---

## 命令五：md-ascii-diagram-beautify-doc

文档级美化：对文档中指定图形做图生图美化，自动完成「渲染 PNG → beautify.js 美化 → 更新文档图片引用」闭环。

### 语法

```bash
cd ~/.claude/skills/md-ascii-diagram/
node beautify-cmd.js <文档.md> --list-styles
node beautify-cmd.js <文档.md> --name=<图名> --style=<风格>
node beautify-cmd.js <文档.md> --all --style=<风格>
```

### 参数

| 参数 | 说明 |
|------|------|
| `--list-styles` | 列出所有可用风格（来自 `styles/*/style.json`） |
| `--name=<图名>` | 美化指定单图（注释块名字） |
| `--all` | 美化文档所有图 |
| `--style=<风格>` | 美化风格，默认 `black-metal` |
| `--provider=<provider>` | 默认 `yuntts` |

### 环境变量

需要 `OPENAI_API_KEY` 或 `BEAUTIFY_API_KEY`（beautify.js 自动读取，不落盘）。

### 示例

```bash
# 列出可用风格
node beautify-cmd.js DESIGN.md --list-styles

# 美化单个图
node beautify-cmd.js DESIGN.md --name=p1 --style=black-metal
```
