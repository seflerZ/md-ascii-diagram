#!/usr/bin/env node
/**
 * beautify-cmd.js — 文档级美化命令：对文档中指定图形做图生图美化
 *
 * 用法:
 *   node beautify-cmd.js <文档.md> --list-styles            # 列出可用风格
 *   node beautify-cmd.js <文档.md> --name=p1 --style=black-metal   # 美化指定单图
 *   node beautify-cmd.js <文档.md> --all --style=light      # 美化文档所有图
 *
 * 每个图的流程: render_color.js 渲染 PNG → beautify.js 美化 → 更新文档图片引用
 * 需要环境变量: OPENAI_API_KEY 或 BEAUTIFY_API_KEY（beautify.js 自动读取）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT_DIR = __dirname;
const RENDER_JS = path.join(SCRIPT_DIR, 'render_color.js');
const BEAUTIFY_JS = path.join(SCRIPT_DIR, 'beautify.js');

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

// 提取文档中所有注释块图名（<!--diagram NAME-->）
function collectNames(md) {
  const names = [];
  const re = /<!--\s*diagram\s+(\S+)/g;
  let m;
  while ((m = re.exec(md)) !== null) names.push(m[1]);
  return names;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: SCRIPT_DIR, encoding: 'utf-8' });
  if (r.error) throw r.error;
  return r;
}

// 更新文档中指向该图的图片引用为美化图（与 server.py 方案 B 同款逻辑）
function updateRef(mdPath, name, outPng) {
  let md = fs.readFileSync(mdPath, 'utf-8');
  const rel = path.relative(path.dirname(mdPath), outPng).replace(/\\/g, '/');
  const mdImg = `![${name}](${rel})`;
  const re = new RegExp(`!\\[${name}\\]\\([^)]*\\)`, 'g');
  let cnt = 0;
  md = md.replace(re, () => { cnt++; return mdImg; });
  if (cnt === 0) md = md.trimEnd() + '\n\n' + mdImg + '\n';
  fs.writeFileSync(mdPath, md);
  return cnt;
}

async function main() {
  const { positionals, kv } = parseArgs(process.argv.slice(2));
  const mdPath = positionals[0];

  // --list-styles：列出可用风格
  if (kv['list-styles']) {
    const r = run('node', [BEAUTIFY_JS, '--list-styles']);
    if (r.status !== 0) { console.error('❌ 获取风格失败: ' + r.stderr); process.exit(1); }
    console.log('可用风格:');
    console.log(r.stdout.trim());
    return;
  }

  if (!mdPath || !fs.existsSync(mdPath)) { console.error('❌ 需要存在的文档路径'); process.exit(1); }
  const mdAbs = path.resolve(mdPath);
  const mdDir = path.dirname(mdAbs);
  const outDir = path.join(mdDir, 'diagrams_out');
  const style = kv.style || 'black-metal';
  const provider = kv.provider || 'yuntts';

  // 确定要美化的图名列表
  const names = kv.name ? [kv.name] : (kv.all ? collectNames(fs.readFileSync(mdAbs, 'utf-8')) : []);
  if (names.length === 0) {
    console.error('❌ 需要 --name=<图名> 或 --all（文档里没有注释块图？）');
    process.exit(1);
  }

  for (const name of names) {
    // 1. 渲染 PNG
    const render = run('node', [RENDER_JS, mdAbs, outDir, '--only=' + name]);
    if (render.status !== 0) { console.error(`❌ 渲染 ${name} 失败: ${render.stderr}`); continue; }
    const png = path.join(outDir, name + '.png');
    if (!fs.existsSync(png)) { console.error(`❌ 渲染后未找到 ${png}`); continue; }

    // 2. 美化
    console.log(`🎨 美化 ${name} (${style})...`);
    const beaut = run('node', [BEAUTIFY_JS, png, '--style=' + style, '--provider=' + provider]);
    if (beaut.status !== 0) { console.error(`❌ 美化 ${name} 失败: ${beaut.stderr}`); continue; }
    const outPng = (beaut.stdout.match(/^OUTPUT:(.+)$/m) || [])[1];
    if (!outPng) { console.error(`❌ 未解析到美化输出路径:\n${beaut.stdout}`); continue; }

    // 3. 更新文档引用
    const cnt = updateRef(mdAbs, name, outPng);
    console.log(`✅ ${name} 美化完成: ${outPng}${cnt ? `（更新 ${cnt} 处引用）` : '（文档无原引用，已追加）'}`);
  }
}

main().catch((e) => { console.error('❌ ' + (e && e.message || e)); process.exit(1); });
