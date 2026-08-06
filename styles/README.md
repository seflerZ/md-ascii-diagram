# 风格目录

每个风格一个子目录，**风格定义全部配置化**（提示词、参考图、标签都放在这里，方便编辑，不写死在代码里）。

```
styles/
├── styles.json              # 全局配置：结构锁定提示词（所有风格强制带上）
├── light/
│   ├── style.json           # Light Style 定义（提示词 + 参考图 + 标签）
│   └── ref-1.png            # 参考图
└── black-metal/
    ├── style.json           # Black Metal Style 定义
    └── ref-1.png
```

## 全局 `styles.json`（beautify.js 同目录）

结构锁定规则——保证文字清晰、布局结构不变的公共提示词：

```json
{
  "structure": [
    "Text must remain clear. The shapes of the arrow lines and the positions of the rectangles must not be altered.",
    "Add icons to each rectangle based on its content to aid comprehension ...",
    "Do not remove or cut any of the original text.",
    "Preserve the existing color scheme."
  ]
}
```

## 风格定义 `styles/<名>/style.json`

```json
{
  "label": "Black Metal Style (金属科技风)",
  "refs": ["ref-1.png"],
  "refsUrl": ["https://github.com/user-attachments/assets/..."],
  "rules": [
    "Keep the background pure black, ...",
    "Use a metallic tech style (金属科技风)."
  ]
}
```

| 字段 | 说明 |
|------|------|
| `label` | 风格显示名 |
| `refs` | 本地参考图文件名（相对本风格目录） |
| `refsUrl` | 公网参考图 URL（供需要 URL 的 provider，如 yuntts） |
| `rules` | 该风格的提示词（与全局 structure 合并后发给模型） |

## 添加新风格

1. 建目录 `styles/新风格名/`
2. 写 `style.json`（label / refs / refsUrl / rules）
3. 放入参考图
4. 调用：`node beautify.js 图.png --style=新风格名`

## 修改提示词

直接编辑对应 `style.json` 的 `rules`（或 `styles.json` 的 `structure`）即可，无需改代码。
