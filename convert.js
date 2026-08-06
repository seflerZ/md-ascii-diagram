#!/usr/bin/env node
/**
 * convert.js — 把文档中「代码块风格」的 ASCII 图转成「注释块风格」（<!--diagram NAME-->）
 *
 * 用法:
 *   node convert.js <文档.md>                 # 转换所有代码块图，自动命名 p1/p2...
 *   node convert.js <文档.md> --index=2       # 只转第 2 个代码块图（按文档顺序，1 起）
 *   node convert.js <文档.md> --index=2 --name=p5   # 转第 2 个并命名为 p5
 *   node convert.js <文档.md> --dry-run       # 只预览，不写文件
 */

'use strict';

const fs = require('fs');

// 代码块 + 框线字符检测（与 server.py find_all_diagrams 一致）
const CODE_RE = /```[^\n]*\n([\s\S]*?)```/g;
const BOX_RE = /[┌┐└┘├┤┬┴┼─│]/;
const DIAGRAM_NAME_RE = /<!--\s*diagram\s+(\S+)/g;

function parseArgs(argv) {
  const args = { positionals: [], kv: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) {
        args.kv[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        // 布尔 flag：下一个参数不是 -- 开头才当值，否则设为 true
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) { args.kv[a.slice(2)] = next; i++; }
        else { args.kv[a.slice(2)] = true; }
      }
    } else { args.positionals.push(a); }
  }
  return args;
}

function collectExistingNames(md) {
  const names = new Set();
  let m;
  DIAGRAM_NAME_RE.lastIndex = 0;
  while ((m = DIAGRAM_NAME_RE.exec(md)) !== null) names.add(m[1]);
  return names;
}

// 自动命名：取已有 p 编号最大值 +1；冲突时继续递增
function nextName(existing, preferred) {
  if (preferred) {
    if (existing.has(preferred)) throw new Error(`名字 "${preferred}" 已存在`);
    return preferred;
  }
  let maxN = 0;
  for (const n of existing) { const mm = /^p(\d+)$/.exec(n); if (mm) maxN = Math.max(maxN, +mm[1]); }
  let name = 'p' + (maxN + 1);
  while (existing.has(name)) name = 'p' + (++maxN + 1);
  return name;
}

async function main() {
  const { positionals, kv } = parseArgs(process.argv.slice(2));
  const mdPath = positionals[0];
  if (!mdPath) {
    console.error('用法: node convert.js <文档.md> [--index=N] [--name=NAME] [--dry-run]');
    process.exit(1);
  }
  if (!fs.existsSync(mdPath)) { console.error(`❌ 找不到文档: ${mdPath}`); process.exit(1); }

  const md = fs.readFileSync(mdPath, 'utf-8');
  const matches = [];
  let m;
  CODE_RE.lastIndex = 0;
  while ((m = CODE_RE.exec(md)) !== null) {
    if (BOX_RE.test(m[1])) matches.push({ full: m[0], content: m[1].trim(), index: m.index });
  }
  if (matches.length === 0) { console.log('ℹ️ 文档里没有代码块风格的 ASCII 图'); process.exit(0); }

  // 选择要转换的图
  let toConvert;
  if (kv.index) {
    const idx = parseInt(kv.index, 10);
    if (!matches[idx - 1]) { console.error(`❌ 没有第 ${idx} 个代码块图（共 ${matches.length} 个）`); process.exit(1); }
    toConvert = [matches[idx - 1]];
  } else {
    toConvert = matches;
  }

  // 生成名字（按文档顺序）
  const existing = collectExistingNames(md);
  for (const item of toConvert) {
    try { item.name = nextName(existing, kv.name); } catch (e) { console.error('❌ ' + e.message); process.exit(1); }
    existing.add(item.name);
  }

  // 从后往前替换，避免 index 偏移
  let result = md;
  for (const item of toConvert.slice().reverse()) {
    const newBlock = `<!--diagram ${item.name}\n${item.content}\n-->`;
    result = result.slice(0, item.index) + newBlock + result.slice(item.index + item.full.length);
  }

  if (kv['dry-run']) {
    console.log('=== 预览（--dry-run）===');
    console.log(result);
  } else {
    fs.writeFileSync(mdPath, result);
    for (const item of toConvert) console.log(`✅ 已转换: ${item.name}`);
    console.log(`共转换 ${toConvert.length} 个代码块图 → 注释块`);
  }
}

main().catch((e) => { console.error('❌ ' + (e && e.message || e)); process.exit(1); });
