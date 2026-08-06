#!/usr/bin/env node
/**
 * beautify.js — 图生图美化：把渲染好的 PNG 投喂给图像生成模型，输出风格化成品
 *
 * 用法:
 *   node beautify.js <input.png> [--style=light|black-metal]
 *     [--model=gpt-image-2] [--base-url=https://api.openai.com/v1]
 *     [--api-key=sk-xxx] [--api-key-env=OPENAI_API_KEY]
 *     [--ref=<style.png>] [--quality=high] [--out=<output.png>]
 *
 * 通用性:
 *   - --base-url 可切任何 OpenAI 兼容服务（官方 / 国内聚合 / 中转）
 *   - --model 可切 gpt-image-2 / gpt-image-1 / 国产兼容模型
 *   - --provider=openai（默认）: 无参考图 → images/edits；带参考图 → chat/completions 多模态
 *   - --provider=yuntts: 云音工坊 GPT Image 2 自定义接口（/api/v1/gpt-image2/generate + status 轮询）
 *
 * API Key 不落盘：优先 --api-key，其次环境变量（见 main 内解析顺序）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

/* ============ 提示词模板 ============ */

// 结构锁定规则（默认）：任何风格都强制带上，保证文字清晰、布局结构不变
// 可由外部 styles.json 的 "structure" 覆盖；风格提示词存放在 styles/<名>/style.json
let STRUCTURE_RULES = [
  'Text must remain clear. The shapes of the arrow lines and the positions of the rectangles must not be altered.',
  'Add icons to each rectangle based on its content to aid comprehension (icons must be relevant to the content - they can be product-describing icons or illustrative diagrams), highlighting its role/function.',
  'Do not remove or cut any of the original text.',
  'Preserve the existing color scheme.',
];

// 风格注册表：运行时从 styles/<名>/style.json + 外部 styles.json 加载
const STYLES = {};

function loadStyleConfig() {
  // 1. 全局 styles.json：可覆盖结构规则 structure + 补充风格
  const cfgPath = path.join(__dirname, 'styles.json');
  if (fs.existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      if (Array.isArray(cfg.structure)) STRUCTURE_RULES = cfg.structure;
      for (const [k, v] of Object.entries(cfg.styles || {})) {
        if (v && typeof v === 'object') STYLES[k] = { ...(STYLES[k] || {}), ...v };
      }
    } catch (e) {
      console.warn('⚠️ styles.json 解析失败，用内置默认: ' + e.message);
    }
  }

  // 2. 扫描 styles/<名>/style.json —— 每个风格目录自带提示词配置，便于编辑
  const stylesDir = path.join(__dirname, 'styles');
  if (fs.existsSync(stylesDir) && fs.statSync(stylesDir).isDirectory()) {
    for (const entry of fs.readdirSync(stylesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sf = path.join(stylesDir, entry.name, 'style.json');
      if (!fs.existsSync(sf)) continue;
      try {
        const s = JSON.parse(fs.readFileSync(sf, 'utf-8'));
        if (s && typeof s === 'object') {
          // 参考图相对本风格目录 → 转成相对脚本目录路径（styles/<名>/<file>）
          if (Array.isArray(s.refs)) s.refs = s.refs.map(r => `styles/${entry.name}/${r}`);
          STYLES[entry.name] = { ...(STYLES[entry.name] || {}), ...s };
        }
      } catch (e) {
        console.warn(`⚠️ styles/${entry.name}/style.json 解析失败: ${e.message}`);
      }
    }
  }
}

function buildPrompt(style) {
  const s = STYLES[style] || STYLES['light'];
  return [...STRUCTURE_RULES, ...s.rules].map((r, i) => `${i + 1}. ${r}`).join('\n');
}

/* ============ 参数解析 ============ */

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
    } else {
      args.positionals.push(a);
    }
  }
  return args;
}

/* ============ HTTP 工具 ============ */

function requestRaw(url, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, buffer: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function requestJson(url, { method = 'POST', headers = {}, body = null } = {}) {
  const res = await requestRaw(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });
  const text = res.buffer.toString('utf-8');
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON 响应 */ }
  return { status: res.status, json, text };
}

// multipart/form-data 构造
function buildMultipart(fields) {
  const boundary = '----md-ascii-beautify-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value && typeof value === 'object' && value.buffer) {
      // 文件字段
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${value.filename}"\r\n` +
        `Content-Type: ${value.contentType}\r\n\r\n`
      ));
      parts.push(value.buffer);
      parts.push(Buffer.from('\r\n'));
    } else {
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
      ));
    }
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { boundary, body: Buffer.concat(parts) };
}

/* ============ Provider 适配器 ============ */

// 适配器 1：images/edits（单输入图，OpenAI 官方标准）
async function imagesEdits({ apiKey, baseUrl, model, inputImage, prompt, size, quality }) {
  const fields = {
    model,
    image: inputImage,
    prompt,
    quality: quality || 'high',
    response_format: 'b64_json',
  };
  if (size) fields.size = size; // 不传则保持输入图尺寸
  const { boundary, body } = buildMultipart(fields);
  const res = await requestRaw(`${baseUrl}/images/edits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
  const json = (() => { try { return JSON.parse(res.buffer.toString('utf-8')); } catch { return null; } })();
  if (res.status >= 400 || !json || !json.data) {
    throw new Error(`images/edits 失败(${res.status}): ${JSON.stringify(json || res.buffer.toString('utf-8'))}`);
  }
  const item = json.data[0];
  if (item.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item.url) return (await requestRaw(item.url)).buffer;
  throw new Error('响应里没有 b64_json / url');
}

// 适配器 2：chat/completions 多模态（原图 + 参考图）
async function chatMulti({ apiKey, baseUrl, model, inputImages, prompt }) {
  const content = [
    { type: 'text', text: prompt },
    ...inputImages.map((img) => ({
      type: 'image_url',
      image_url: { url: `data:${img.contentType};base64,${img.buffer.toString('base64')}` },
    })),
  ];
  const res = await requestJson(`${baseUrl}/chat/completions`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content }] }),
  });
  if (res.status >= 400) throw new Error(`chat/completions 失败(${res.status}): ${res.text}`);
  const msg = res.json && res.json.choices && res.json.choices[0] && res.json.choices[0].message;
  // 图像输出：message.content[] 里 image_url，或顶层 data[].b64_json
  if (Array.isArray(msg && msg.content)) {
    for (const c of msg.content) {
      if (c.type === 'image_url' && c.image_url && c.image_url.url) {
        const m = c.image_url.url.match(/^data:[^;]+;base64,(.+)$/);
        if (m) return Buffer.from(m[1], 'base64');
        return (await requestRaw(c.image_url.url)).buffer;
      }
    }
  }
  if (res.json && res.json.data && res.json.data[0] && res.json.data[0].b64_json) {
    return Buffer.from(res.json.data[0].b64_json, 'base64');
  }
  throw new Error(`chat 响应里没找到图像输出: ${JSON.stringify(res.json).slice(0, 500)}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 适配器 3：yuntts（云音工坊）GPT Image 2 —— 自定义 JSON 接口 + 任务轮询
// 文档: POST {base}/api/v1/gpt-image2/generate + /api/v1/gpt-image2/status（779.html）
// ⚠️ reference_images 必须是公网 URL：传入的 refs 里 url 直接用，本地图转 data URI（可能不被平台接受）
async function yunttsGenerate({ apiKey, baseUrl, prompt, refs, aspectRatio }) {
  const refUrls = refs.map(img => img.url || `data:${img.contentType};base64,${img.buffer.toString('base64')}`);

  const gen = await requestJson(`${baseUrl}/gpt-image2/generate`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      prompt,
      aspect_ratio: aspectRatio || '1:1',
      reference_images: refUrls,
      x_channel: 'default',
    }),
  });
  if (gen.status >= 400) throw new Error(`yuntts generate 失败(${gen.status}): ${gen.text}`);
  const gdata = gen.json && gen.json.data;
  const taskId = gdata && gdata.task_id;
  if (!taskId) throw new Error(`yuntts generate 响应里没有 task_id: ${gen.text}`);

  // 轮询任务状态（最多 60 次 × 3s = 180s）
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const st = await requestJson(`${baseUrl}/gpt-image2/status`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ task_id: taskId }),
    });
    const d = st.json && st.json.data;
    const status = d && d.status;   // pending / submitted / processing / completed / failed
    if (status === 'completed') {
      // 实测: 实际返回是 result_images[] 数组（文档写的 result_image_url 是旧格式）
      const imgUrl = (d.result_images && d.result_images[0]) || d.result_image_url || d.image_url || d.url;
      if (imgUrl) return (await requestRaw(imgUrl)).buffer;
      throw new Error(`yuntts 任务完成但未找到图片: ${JSON.stringify(d)}`);
    }
    if (status === 'failed') {
      throw new Error(`yuntts 任务失败: ${(d && d.error_message) || JSON.stringify(d)}`);
    }
  }
  throw new Error('yuntts 任务超时(180s)');
}

/* ============ 图片工具 ============ */

function readImage(p) {
  const buf = fs.readFileSync(p);
  const ext = path.extname(p).toLowerCase();
  const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : ext === '.webp' ? 'image/webp'
    : 'image/png';
  return { buffer: buf, filename: path.basename(p), contentType };
}

// 默认输出路径：同名已存在时自动加序号（.1 .2 ...），保留每次抽卡结果，不覆盖
function defaultOut(inputPath, style) {
  const ext = path.extname(inputPath);
  const base = inputPath.slice(0, -ext.length);
  let out = `${base}.beautified-${style}${ext}`;
  let n = 1;
  while (fs.existsSync(out)) {
    out = `${base}.beautified-${style}.${n}${ext}`;
    n++;
  }
  return out;
}

/* ============ 主流程 ============ */

async function main() {
  loadStyleConfig();
  const { positionals, kv } = parseArgs(process.argv.slice(2));

  // --list-styles：列出所有可用风格后退出（供 beautify-cmd.js 与用户使用）
  if (kv['list-styles']) {
    for (const [k, v] of Object.entries(STYLES)) {
      console.log(`${k}: ${(v && v.label) || ''}`);
    }
    process.exit(0);
  }

  const inputPath = positionals[0];
  if (!inputPath) {
    console.error(
      '用法: node beautify.js <input.png> [--style=light|black-metal] ' +
      '[--model=gpt-image-2] [--base-url=...] [--api-key=...] [--ref=<style.png>] [--out=...] [--list-styles]'
    );
    process.exit(1);
  }
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ 找不到输入图: ${inputPath}`);
    process.exit(1);
  }

  const style = kv.style || 'black-metal';
  const model = kv.model || process.env.BEAUTIFY_MODEL || 'gpt-image-2';
  const provider = kv.provider || process.env.BEAUTIFY_PROVIDER || 'openai';
  const defaultBase = provider === 'yuntts' ? 'https://www.yuntts.com/api/v1' : 'https://api.openai.com/v1';
  const baseUrl = (kv['base-url'] || process.env.BEAUTIFY_BASE_URL || defaultBase).replace(/\/+$/, '');
  const apiKey =
    kv['api-key'] ||
    (kv['api-key-env'] ? process.env[kv['api-key-env']] : undefined) ||
    process.env.BEAUTIFY_API_KEY ||
    process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ 缺少 API Key：设置环境变量 OPENAI_API_KEY / BEAUTIFY_API_KEY，或 --api-key=...');
    process.exit(1);
  }

  const inputImage = readImage(inputPath);
  const prompt = buildPrompt(style);
  const outPath = kv.out || defaultOut(inputPath, style);

  console.log(`🎨 美化中: ${inputPath} -> ${outPath}`);
  console.log(`   model=${model}  style=${style}  base-url=${baseUrl}`);

  // 参考图：风格自带 refs + 命令行 --ref 追加；有参考图走多模态，否则单图 edits
  const styleCfg = STYLES[style] || STYLES['light'];
  const refPaths = [...(styleCfg.refs || []), ...(kv.ref ? [kv.ref] : [])];
  const refImages = [];
  for (const rp of refPaths) {
    const p = path.isAbsolute(rp) ? rp : path.join(__dirname, rp);
    if (fs.existsSync(p)) refImages.push(readImage(p));
    else console.warn(`⚠️ 参考图不存在，已跳过: ${p}`);
  }

  let result;
  if (provider === 'yuntts') {
    // yuntts 需要公网 URL：输入图 --input-url 优先，否则本地转 data URI（可能不被接受）
    const refs = [];
    if (kv['input-url']) refs.push({ url: kv['input-url'] });
    else refs.push(inputImage);
    for (const u of ((STYLES[style] || {}).refsUrl || [])) refs.push({ url: u });
    for (const rp of refPaths) {
      if (/^https?:\/\//.test(rp)) refs.push({ url: rp });
      else { const p = path.isAbsolute(rp) ? rp : path.join(__dirname, rp); if (fs.existsSync(p)) refs.push(readImage(p)); }
    }
    result = await yunttsGenerate({ apiKey, baseUrl, prompt, refs, aspectRatio: kv['aspect-ratio'] });
  } else if (refImages.length) {
    result = await chatMulti({ apiKey, baseUrl, model, inputImages: [inputImage, ...refImages], prompt });
  } else {
    result = await imagesEdits({
      apiKey, baseUrl, model, inputImage, prompt,
      size: kv.size, quality: kv.quality,
    });
  }

  fs.writeFileSync(outPath, result);
  console.log(`OUTPUT:${outPath}`);
  console.log(`✅ 美化完成 (${style}): ${outPath}`);
}

main().catch((e) => {
  console.error('❌ ' + (e && e.message ? e.message : e));
  process.exit(1);
});
