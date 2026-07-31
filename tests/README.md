# 编辑器功能测试

`md-ascii-diagram` 可视化编辑器的功能测试套件，基于 **Playwright + 无头 Edge**。

## 运行

```bash
node tests/editor.test.js
```

脚本会自动检测 `8000` 端口，若未启动则自动拉起 `python server.py 8000`，测试结束后自动关闭自己启动的服务（不影响已存在的服务）。

**前置依赖**：
- Python 3（`server.py`）
- Node.js + Playwright（`npm install playwright` 或全局安装）
- Microsoft Edge（`channel: 'msedge'`）

## 覆盖范围（34 项）

| 套件 | 覆盖 |
|------|------|
| **梳子对齐** | 横线+错位箭头拉齐、竖线+错列箭头、粗线散落拉齐 |
| **Vim 快捷键** | Visual 模式 `y`/`d`/`x`/`p`、普通 `d`/`x`、`yy`/`u`/`Delete` 回归 |
| **箭头三类型** | 细/实心/空心 × 四方向、快捷键 1/2/3、下拉切换、实际绘制 |
| **连接合并** | L/free 工具接框边、圆角角、色码邻居、ASCII 线、转角、文字不误连、底边连接 |
| **双宽删除** | `x`/`X`/`Delete` 删除双宽字符后 dispCol 重算、`d` 左移回归 |

## 说明

- 每个套件在浏览器页面上下文中执行，直接操作 `grid` 并断言结果
- 测试失败时进程以非零退出码结束，方便 CI 接入
