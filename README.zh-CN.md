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
| AI 图生图美化集成 | ✅ 即将推出 | ❌ 不支持 | ❌ 不支持 | ❌ 不支持 |

## 美化后端服务商

最后的美化步骤支持可插拔的图像生成后端：

| 后端 | 说明 | 用法 | 特点 |
|---|---|---|---|
| `openai`（默认） | 任意 OpenAI 兼容图像接口——官方、国内聚合或中转 | `--provider=openai` + `--base-url=<地址>` + `--model=gpt-image-2` | 无参考图走 `/images/edits`；带参考图走 `/chat/completions` |
| `yuntts` | 云音工坊（云声配音）GPT Image 2，国内直连 | `--provider=yuntts` | 参考图编辑模式 + 任务轮询；约 0.2 元/张（1K 默认通道） |

API Key 从环境变量 `OPENAI_API_KEY` / `BEAUTIFY_API_KEY` 或 `--api-key=<key>` 读取，不落盘。风格（提示词 + 参考图）存放在 `styles/`，详见 `styles/README.md`。

## 截图

1. 提示 AI 自动生成图表：
<img width="2232" height="1082" alt="image" src="https://github.com/user-attachments/assets/8991082c-d38c-45f0-87ed-30bed64cd527" />

2. 在内置编辑器中精细调整（i18n 稍后推出）：
<img width="2112" height="1210" alt="image" src="https://github.com/user-attachments/assets/7218a824-220a-4403-8af5-ba5fafe2f9db" />

3. GPT Image-2 生成的最终效果：
<table>
  <tr>
    <th width="500px">明亮风格</th>
    <th>黑金金属风格</th>
  </tr>
  <tr>
    <td><img width="100%" alt="image" src="https://github.com/user-attachments/assets/6cc1a12f-4922-4bf1-97aa-02a564fcaa91" /></td>
    <td><img width="100%" alt="image" src="https://github.com/user-attachments/assets/cdd41ff8-21e6-4c7a-9225-2846eaf6ecef" />
</td>
  </tr>
  <tr>
    <td>
    提示词： <br/>
   1. 文字必须保持清晰，箭头线的形状和矩形的位置不得改动。<br/>
   2. 根据每个矩形的内容添加图标以辅助理解（图标必须与内容相关——可以是产品描述性图标或示意图），突出其作用/功能。<br/>
   3. 不要删除或截断任何原始文字。<br/>
   4. 保留现有配色方案。背景保持纯白，不要给形状添加额外着色（其他元素允许）。<br/>
   5. 使用科技小报风格。</td>
    <td>
    提示词： <br/>
      1. 文字必须保持清晰，箭头线的形状和矩形的位置不得改动。<br/>
      2. 根据每个矩形的内容添加图标以辅助理解（图标必须与内容相关——可以是产品描述性图标或示意图），突出其作用/功能。<br/>
      3. 不要删除或截断任何原始文字。<br/>
      4. 保留现有配色方案。背景保持纯黑，不要给形状添加额外着色（其他元素允许）。<br/>
      5. 适当调整颜色明度以适配深色背景。<br/>
      6. 使用金属科技风格。<br/>
    </td>
  </tr>
</table>

> ⚠️ 注意：GPT Image-2 或 SeedDance 不包含在本项目中，你需要自备访问权限。

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
