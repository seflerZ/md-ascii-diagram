# MD ASCII Diagram

[English](README.md) | [简体中文](README.zh-CN.md)

## 工作原理

AI 模型缺乏空间感知，因此用 `draw.io` 这类可视化原生工具难以生成好的图表。事实上，如今的 AI 都是「字符原生」的，所以最佳实践是：

1. 将原始 ASCII 图保留在 Markdown 的注释块中（这样 AI 仍然可以编辑它）
2. 自动将其渲染为漂亮的彩色 PNG 图片
3. 用内置编辑器人工精细调整
4. 在文档中把图片引用直接嵌在图表旁边
5. 用图片生成 AI（如 GPT Image-2、SeedDance）做最终美化

结果就是：AI 可以编辑图表，而你分享文档或上传到服务器时，图始终看起来完美。

## 对比

| | md-ascii-diagram | next-ai-drawio | draw.io | Mermaid |
|---- | ---- | ---- | ---- | ---- |
| 面向 AI、基于字符的草稿 | ✅ 字符原生，AI 直接写 ASCII | ⚠️ AI 生成 XML，非原生 | ❌ 手动拖拽 | ✅ 文本语法，AI 友好 |
| 内置编辑器人工精细调整 | ✅ 内置编辑器 | ✅ draw.io 编辑器 | ✅ 功能完善的编辑器 | ⚠️ 只能改文本，无法控制空间与关系 |
| 以技能集成进 AI 工具，改后自动重渲染 | ✅ 作为 Claude Code skill 安装——AI 改完 PNG 自动重新渲染 | ⚠️ 靠 MCP 胶水 | ❌ 无 AI 工作流 | ⚠️ 仅 Markdown 渲染器 |
| AI 图生图，任意风格美化 | ✅ GPT Image / SeedDance，任意风格 | ❌ 单一风格 | ❌ 单一风格 | ❌ 单一风格 |

> 说明：风格指渲染方式，而非颜色，例如手写风、技术金属风等。

## 截图

<img width="642" height="642" alt="image" src="https://github.com/user-attachments/assets/c04dd6b7-bd50-481e-9db1-fb216a095f5f" />

## 如何安装

只需让 Claude Code 或你的代码工具读取本页，它就能自动安装好全部组件和依赖。

### 1. 作为 Claude Code skill 安装

```bash
mkdir -p ~/.claude/skills
git clone git@github.com:seflerZ/md-ascii-diagram.git ~/.claude/skills/md-ascii-diagram
```

然后在 Claude Code 会话中使用：

- `/md-ascii-diagram edit <文件.md>` — 打开可视化编辑器
- `/md-ascii-diagram gen <文件.md>` — 将所有图表渲染为 PNG

### 2. 安装依赖

```bash
# 需要 Python 来运行 HTTP 服务器（macOS/Linux 自带）
# 需要 Node.js 和 Playwright 来渲染 PNG
npm install playwright
npx playwright install msedge  # 或 chromium / firefox
```

### 3. 可选：安装推荐的字体

**等宽（固定宽度）字体是 ASCII 图表正确对齐的硬性要求。** 每个字形必须占据相同的宽度，盒子绘制符、箭头和嵌套形状才能落在同一个网格上——这正是「用字符画画」实现视觉布局所依赖的基础。如果使用比例字体，字符宽度不一，行会逐渐漂移，图表即使文字看起来正常，视觉上也会散架。

推荐的字体：

- **所有用户**：安装任意**等宽 Nerd 字体**——Nerd Fonts 补全了普通等宽字体常缺的额外字形（盒子绘制符、箭头、powerline、图标）。
- **中文用户**：推荐 [**Sarasa Terminal SC Nerd（更纱终端书呆黑体-简）**](https://github.com/laishulu/Sarasa-Term-SC-Nerd)——一款终端等宽字体，ASCII 与 CJK 字形和谐统一，中英混排的标签也能保持完美对齐。

下载 `.ttf` 文件并放入 `~/.claude/skills/md-ascii-diagram/fonts/`。编辑器会自动加载它们。如果缺少字体，会回退到 Consolas / Courier New——图表仍然可以工作，但部分箭头字符可能错位。
