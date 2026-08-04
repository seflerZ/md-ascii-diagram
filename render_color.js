const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const url = require('url');

// 自定义形状库（shapes.json，与脚本同目录）
let shapes = {};
try {
  const shapesFile = path.join(__dirname, 'shapes.json');
  if (fs.existsSync(shapesFile)) shapes = JSON.parse(fs.readFileSync(shapesFile, 'utf8'));
} catch (e) { shapes = {}; }

// 技能包内字体（绝对 file:// 路径，供生成的独立 HTML 引用）
const FONT_DIR = path.join(__dirname, 'fonts');
const FONT_REG = url.pathToFileURL(path.join(FONT_DIR, 'sarasa-mono-sc-nerd-regular.ttf')).href;
const FONT_BOLD = url.pathToFileURL(path.join(FONT_DIR, 'sarasa-mono-sc-nerd-bold.ttf')).href;

// === CLI args ===
// Usage: node render_color.js <markdown-file> [output-dir] [--only=N1,N2,...]
const args = process.argv.slice(2);
const inputFile = args[0] && !args[0].startsWith('--') ? args[0] : null;
const OUT = (args[1] && !args[1].startsWith('--')) ? path.resolve(args[1]) : path.resolve('diagrams_out');

const onlyArg = args.find(a => a.startsWith('--only='));
let onlySet = null;
if (onlyArg) {
  onlySet = new Set(onlyArg.split('=')[1].split(',').map(s => {
    s = s.trim();
    return /^\d+$/.test(s) ? parseInt(s) : s;
  }));
}

if (!inputFile) {
  console.error('Usage: node render_color.js <markdown-file> [output-dir] [--only=p1,p2,18]');
  console.error('');
  console.error('Diagram sources:');
  console.error('  <pre id="X" style="display:none">...</pre>  → named diagram');
  console.error('  ```...``` code blocks → numbered d01, d02, ...');
  console.error('');
  console.error('Colors (place at box diagonal corners):');
  console.error('  y────┐ ... └────y  →  m=玫红 r=红 o=橙 y=黄 g=绿 c=淡蓝 b=蓝 p=紫 e=灰');
  process.exit(1);
}

const md = fs.readFileSync(inputFile, 'utf8');
const mdLines = md.split('\n');

const COLORS = {
  m: '#CC247C', r: '#E95351', o: '#F7A24F', y: '#FAE538',
  g: '#4EA660', c: '#79CAFB', b: '#5292F7', p: '#AA77E9', e: '#D9D1D1',
};

// HSL color utilities for saturation adjustment
// y1-y6: saturation levels with 10% intervals. y3 = default (original S reduced by 10%)
// y (no digit) = y3
function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}
function hslToHex({ h, s, l }) {
  h /= 360; s /= 100; l /= 100;
  const fn = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(fn(p, q, h + 1/3) * 255);
  const g = Math.round(fn(p, q, h) * 255);
  const b = Math.round(fn(p, q, h - 1/3) * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
// Adjust saturation: digit 1-6, 3 = default (original S × 0.9), each step ±10%
function adjustColor(hex, digit) {
  const hsl = hexToHsl(hex);
  const level = parseInt(digit) || 3;
  // y3 = L × 1.35 (candy effect), each level ±10%
  const factor = 1.35 + (level - 3) * 0.1;
  // Low-saturation (gray) colors: don't brighten — would become invisible white
  if (hsl.s < 10) {
	hsl.l = Math.min(85, Math.max(10, hsl.l * (1 + (level - 3) * 0.05)));
  } else {
	hsl.l = Math.min(85, Math.max(10, hsl.l * factor));
	hsl.s = Math.min(90, Math.max(10, hsl.s * 1.2));
  }
  return hslToHex(hsl);
}
// Cache adjusted colors per (hex, digit) pair
const colorCache = new Map();
function getAdjustedColor(hex, digit) {
  const key = hex + '|' + (digit || '3');
  if (!colorCache.has(key)) {
    colorCache.set(key, adjustColor(hex, digit));
  }
  return colorCache.get(key);
}

// Extract diagrams
const diagrams = [];

// 1. <!--diagram X ... --> comment blocks
const commentRe = /<!--\s*diagram\s+(\S+)\s*\n([\s\S]*?)-->/g;
let commentMatch;
while ((commentMatch = commentRe.exec(md)) !== null) {
  const id = commentMatch[1];
  const content = commentMatch[2].split('\n').map(l => l.replace(/\r$/, ''));
  while (content.length && content[0].trim() === '') content.shift();
  while (content.length && content[content.length - 1].trim() === '') content.pop();
  if (content.length > 3) {
    diagrams.push({ name: id, lines: content, source: 'comment' });
  }
}

// 2. <pre id="X" ...>...</pre>
const preRe = /<pre\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/pre>/g;
let preMatch;
while ((preMatch = preRe.exec(md)) !== null) {
  const id = preMatch[1];
  const content = preMatch[2].split('\n').map(l => l.replace(/\r$/, ''));
  while (content.length && content[0].trim() === '') content.shift();
  while (content.length && content[content.length - 1].trim() === '') content.pop();
  if (content.length > 3) {
    diagrams.push({ name: id, lines: content, source: 'pre' });
  }
}

// 3. ```code blocks``` (legacy)
let inCode = false, start = 0, codeIdx = 0;
for (let i = 0; i < mdLines.length; i++) {
  if (/^```/.test(mdLines[i].trim())) {
    if (!inCode) { inCode = true; start = i; }
    else {
      const content = mdLines.slice(start + 1, i);
      const text = content.join('\n');
      if (/[┌┐└┘├┤┬┴┼─│╔╗╚╝║═╠╣╦╩╬┏┓┛┗┣┫┳┻╋┃━]/.test(text) && content.length > 3) {
        codeIdx++;
        diagrams.push({ name: 'd' + String(codeIdx).padStart(2, '0'), lines: content.map(l => l.replace(/\r$/, '')), source: 'code' });
      }
      inCode = false;
    }
  }
}

// Emoji 字符判断（U+1F300-1F9FF）
function isEmojiChar(ch) {
  if (!ch) return false;
  const cp = ch.codePointAt(0);
  return cp >= 0x1F300 && cp <= 0x1F9FF;
}

// 检测形状框：框左下角有 d:N 标记（替换了 └），该框渲染时替换成形状 SVG
function detectShapeBoxes(lines, boxes) {
  const result = [];
  const BORDER = '─═━┬┴├┤┼▼▲│┃╫╪';
  for (let r = 0; r < lines.length; r++) {
    const m = lines[r].match(/d:([a-zA-Z0-9]{1,3})/);
    if (!m) continue;
    const id = m[1];
    const col = m.index;
    if (!shapes[id]) continue;
    // 底边右端（右下角）：从标记后扫 ─ 到 ┘/╯/色码
    const bottomCells = lineCells(lines[r]).cells;
    let toCol = -1;
    for (const cell of bottomCells) {
      if (cell.dispCol < col + m[0].length) continue;
      if (BORDER.includes(cell.char)) continue;
      if (cell.char === '┘' || cell.char === '╯' || 'mroygcbpe'.includes(cell.char)) { toCol = cell.dispCol; break; }
      break;
    }
    if (toCol < 0) continue;
    // 顶边：向上找 ┌/╭/色码 在标记列
    let fromRow = -1;
    for (let tr = r - 1; tr >= 0; tr--) {
      const c = lineCells(lines[tr]).cells.find(cell => cell.dispCol === col);
      if (c && (c.char === '┌' || c.char === '╭' || 'mroygcbpe'.includes(c.char))) { fromRow = tr; break; }
    }
    if (fromRow < 0) continue;
    // 确认右上角（fromRow 行 toCol 处是 ┐/╮/色码）
    const topRight = lineCells(lines[fromRow]).cells.find(cell => cell.dispCol === toCol);
    if (!topRight || !('┐╮'.includes(topRight.char) || 'mroygcbpe'.includes(topRight.char))) continue;
    const box = { fromRow, toRow: r, fromCol: col, toCol: toCol + 1 };
    // 提取框颜色：左上/右下角是色码 → 供 SVG 染色
    let hex = null;
    const tl = lineCells(lines[fromRow]).cells.find(c => c.dispCol === col);
    if (tl && 'mroygcbpe'.includes(tl.char)) hex = (COLORS[tl.char] && COLORS[tl.char].hex) || COLORS[tl.char];
    if (!hex) {
      const br = bottomCells.find(c => c.dispCol === toCol);
      if (br && 'mroygcbpe'.includes(br.char)) hex = (COLORS[br.char] && COLORS[br.char].hex) || COLORS[br.char];
    }
    if (hex) box.hex = hex;
    result.push({ id, box, svg: shapes[id] });
  }
  return result;
}

// 判断 hex 是否为亮色（WCAG 相对亮度，决定文字用深色/浅色）
function isLightColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.5;
}
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// 提取形状框内的文字（保留原位置），供叠加到 SVG 上
function extractShapeText(lines, box) {
  const texts = [];
  for (let r = box.fromRow + 1; r < box.toRow; r++) {
    const cells = lineCells(lines[r]).cells;
    let text = '', startDisp = -1;
    for (const cell of cells) {
      if (cell.dispCol <= box.fromCol || cell.dispCol >= box.toCol - 1) continue;
      if (cell.char && cell.char !== ' ') {
        if (text === '') startDisp = cell.dispCol;
        text += cell.char;
      } else {
        if (text) { texts.push({ r, dispCol: startDisp, text }); text = ''; }
      }
    }
    if (text) texts.push({ r, dispCol: startDisp, text });
  }
  return texts;
}

// Display width
function charWidth(c) {
  const cp = c.codePointAt(0);
  if (cp >= 0x4E00 && cp <= 0x9FFF) return 2;
  if (cp >= 0x3400 && cp <= 0x4DBF) return 2;
  if (cp >= 0x3000 && cp <= 0x303F) return 2;
  if (cp >= 0xFF01 && cp <= 0xFF60) return 2;
  if (cp >= 0x2460 && cp <= 0x24FF) return 1; // ①②③ 在新字体下为单宽
  
  if (cp === 0x2194) return 1;
  // →←↑↓↔▼▲◄►▽△◁▷—…… 在新字体下为单宽
  if (cp === 0x25BC || cp === 0x25B2 || cp === 0x25B6 || cp === 0x25C0 || cp === 0x25C4 || cp === 0x25BA || cp === 0x25BD || cp === 0x25B3 || cp === 0x25C1 || cp === 0x25B7) return 1;
  if (cp === 0x2014 || cp === 0x2015 || cp === 0x2026) return 1;
  if (cp >= 0x1F300 && cp <= 0x1F9FF) return 2; // Emoji
  if (cp >= 0x2600 && cp <= 0x27BF) return 1; // ☀★◆✓✗ 等在新字体下单宽
  if (cp >= 0x231A && cp <= 0x23FF) return 1; // ⌚⌛⏰ 等在新字体下单宽
  return 1;
}

function lineCells(line) {
  const cells = [];
  let dispCol = 0;
  const chars = Array.from(line);
  let afterZwj = false;  // 上一个字符是 ZWJ（零宽连接符）：后续 Emoji 并入序列不占位
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    let w = charWidth(c);
    if (c === '‍') { w = 0; afterZwj = true; }
    else if (afterZwj && isEmojiChar(c)) { w = 0; afterZwj = false; }
    else { afterZwj = false; }
    cells.push({ char: c, idx: i, dispCol, width: w });
    dispCol += w;
  }
  return { cells, totalWidth: dispCol };
}

// Find UNCOLORED boxes (corners still ┌┐└┘, not color codes) — uses raw lines
function findUncoloredBoxes(dl) {
  const boxes = [];
  const BORDER_CHARS = '─═━┬┴├┤┼▼▲┃╫╪';
  for (let r = 0; r < dl.length; r++) {
    const { cells } = lineCells(dl[r]);
    for (let ci = 0; ci < cells.length; ci++) {
      const cell = cells[ci];
      if (cell.char !== '┌' && cell.char !== '╭') continue;
      const nextCell = cells[ci + 1];
      if (!nextCell || nextCell.char !== '─') continue;
      const fromDispCol = cell.dispCol;
      let rightDispCol = -1;
      for (let i = ci + 1; i < cells.length; i++) {
        if (BORDER_CHARS.includes(cells[i].char)) continue;
        if (cells[i].char === '┐' || cells[i].char === '╮') { rightDispCol = cells[i].dispCol; break; }
        break;
      }
      if (rightDispCol < 0) continue;
      for (let r2 = r + 1; r2 < dl.length; r2++) {
        const { cells: bottomCells } = lineCells(dl[r2]);
        const leftChar = bottomCells.find(c => c.dispCol === fromDispCol);
        if (!leftChar || (leftChar.char !== '└' && leftChar.char !== '╰' && leftChar.char !== '╰')) continue;
        const rightStart = bottomCells.find(c => c.dispCol === rightDispCol);
        if (!rightStart || (rightStart.char !== '┘' && rightStart.char !== '╯')) continue;
        boxes.push({ fromRow: r, toRow: r2, fromCol: fromDispCol, toCol: rightDispCol + 1 });
        break;
      }
    }
  }
  return boxes;
}

// Find boxes via diagonal markers
function findBoxes(dl) {
  const boxes = [], cs = 'mroygcbpe';
  for (let r = 0; r < dl.length; r++) {
    const { cells } = lineCells(dl[r]);
    for (let ci = 0; ci < cells.length; ci++) {
      const cell = cells[ci];
      if (!cs.includes(cell.char)) continue;
      const nextCell = cells[ci + 1];
      let shadeDigit = '';
      let dashStartIdx = ci + 1;
      if (nextCell && ['1', '2', '3', '4', '5', '6'].includes(nextCell.char)) {
        shadeDigit = nextCell.char;
        dashStartIdx = ci + 2;
      }
      const dashCell = cells[dashStartIdx];
      if (!dashCell || dashCell.char !== '─') continue;
      const cl = cell.char;
      const fromDispCol = cell.dispCol;
      const markerWidth = shadeDigit ? 2 : 1;

      const BORDER_CHARS = '─═━┬┴├┤┼▼▲┃╫╪';
      let rightDispCol = -1;
      for (let i = dashStartIdx; i < cells.length; i++) {
        if (BORDER_CHARS.includes(cells[i].char)) continue;
        if (cells[i].char === '┐' || cells[i].char === '┛' || cells[i].char === '╗' || cells[i].char === '╮') {
          rightDispCol = cells[i].dispCol;
          break;
        }
        break;
      }
      if (rightDispCol < 0) continue;

      for (let r2 = r + 1; r2 < dl.length; r2++) {
        const bottomCells = lineCells(dl[r2]).cells;
        const leftChar = bottomCells.find(c => c.dispCol === fromDispCol);
        if (!leftChar || (leftChar.char !== '└' && leftChar.char !== '╰')) continue;
        const rightStart = bottomCells.find(c => c.char === cl && (c.dispCol === rightDispCol - markerWidth + 1 || c.dispCol === rightDispCol));
        if (!rightStart) continue;
        // 明度数字只看左上角 shadeDigit；右下角只需色码（位置灵活）
        boxes.push({
          color: cl,
          fromRow: r, toRow: r2,
          fromCol: fromDispCol, toCol: rightDispCol + 1,
	          hex: getAdjustedColor(COLORS[cl], shadeDigit)
        });
        break;
      }
    }
  }
  return boxes;
}

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  for (let idx = 0; idx < diagrams.length; idx++) {
    const diag = diagrams[idx];
    const name = diag.name;
    const raw = diag.lines;
    if (onlySet && !onlySet.has(name) && !onlySet.has(idx + 1)) continue;
    const boxes = findBoxes(raw);
    const uncoloredBoxes = findUncoloredBoxes(raw);

    if (boxes.length) {
      boxes.forEach(b => console.log(`  [${name}] box ${b.color}: rows ${b.fromRow}-${b.toRow}, dispCols ${b.fromCol}-${b.toCol-1}`));
    }

    // Clean: replace color markers at corners
    const BORDER = '─═━┬┴├┤┼▼▲│┃╫╪';
    let clean = raw.join('\n');
    clean = clean.replace(new RegExp(`([mroygcbpe])([1-6])([${BORDER}]*)([┐┛╗╮])`, 'g'), (m,c,s,d,r)=>((r==='╮'?'╭':'┌')+'─'+d+r));
    clean = clean.replace(new RegExp(`([mroygcbpe])([${BORDER}]*)([┐┛╗╮])`, 'g'), (m,c,d,r)=>((r==='╮'?'╭':'┌')+d+r));
    clean = clean.replace(new RegExp(`([└╚┗╰])([${BORDER}]*)([mroygcbpe])([1-6])`, 'g'), (m,l,d,c,s)=>((l==='╰'?'╰':l)+d+'─'+((l==='╰'?'╯':'┘'))));
    clean = clean.replace(new RegExp(`([└╚┗╰])([${BORDER}]*)([mroygcbpe])`, 'g'), (m,l,d,c)=>((l==='╰'?'╰':l)+d+((l==='╰'?'╯':'┘'))));
    const lines = clean.split('\n');
    const shapeBoxes = detectShapeBoxes(lines, boxes);

        // Build HTML: color all non-border content inside boxes with uniform background
    let html = '';
    for (let r = 0; r < lines.length; r++) {
      const { cells } = lineCells(lines[r]);
      const wallPositions = cells.filter(c => c.char === '│').map(c => c.dispCol);

      // Color/rainbow markup ranges (take priority over underline)
      const colorRanges = [];
      const rainbowRanges = [];
      const C_RE = /_([mroygcbpe])_(.+?)_\1_/g;
      let cm;
      while ((cm = C_RE.exec(lines[r])) !== null) colorRanges.push({ start: cm.index, end: cm.index + cm[0].length - 1, hex: COLORS[cm[1]] || '#ccc' });
      const R_RE = /_!_(.+?)_!_/g;
      while ((cm = R_RE.exec(lines[r])) !== null) rainbowRanges.push({ start: cm.index, end: cm.index + cm[0].length - 1 });

      // underline ranges (___text___)
      const ulRanges = [];
      const ulRe = /___(.+?)___/g;
      while ((cm = ulRe.exec(lines[r])) !== null) {
        ulRanges.push({ start: cm.index, end: cm.index + cm[0].length - 1 });
      }
      const isUlContent = (idx) => ulRanges.some(r => idx > r.start + 2 && idx < r.end - 2);
      const isUlMarker = (idx) => ulRanges.some(r => (idx >= r.start && idx <= r.start + 2) || (idx >= r.end - 2 && idx <= r.end));

      // Find *xxx* bold ranges in this line
      const boldRanges = [];
      const boldRe = /\*([^*]+)\*/g;
      while ((cm = boldRe.exec(lines[r])) !== null) {
        boldRanges.push({ start: cm.index, end: cm.index + cm[0].length - 1 });
      }
      const isBoldContent = (idx) => boldRanges.some(r => idx > r.start && idx < r.end);
      const isBoldMarker = (idx) => boldRanges.some(r => idx === r.start || idx === r.end);

      const RAINBOW_COLORS = ['#CC247C','#E95351','#F7A24F','#FAE538','#4EA660','#79CAFB','#5292F7','#AA77E9','#D9D1D1'];
      const inRanges = (idx, ranges) => ranges.some(r => idx >= r.start && idx <= r.end);
      const rangesContent = (idx, ranges) => ranges.some(r => idx > r.start + 2 && idx < r.end - 2);
      const isColorMarker = (idx) => !rangesContent(idx, colorRanges) && inRanges(idx, colorRanges);
      const isRainbowMarker = (idx) => !rangesContent(idx, rainbowRanges) && inRanges(idx, rainbowRanges);
      const isColorContent = (idx) => rangesContent(idx, colorRanges);
      const isRainbowContent = (idx) => rangesContent(idx, rainbowRanges);
      const getColor = (idx) => { for (const r of colorRanges) { if (idx > r.start + 2 && idx < r.end - 2) return r.hex; } return null; };
      const getRainbowColor = (idx) => { for (const r of rainbowRanges) { if (idx > r.start + 2 && idx < r.end - 2) return RAINBOW_COLORS[(idx - r.start - 3) % RAINBOW_COLORS.length]; } return null; };

      let line = '';

      let curBg = null;
      let curUl = false;
      let curBold = false;
      let curColor = null;
      let curRainbow = false;
      let curScale = null;       // 当前 span 的 emoji 缩放倍数
      let pendingScale = null;   // 上一格数字标记的 emoji 缩放
      for (let ci = 0; ci < cells.length; ci++) {
        const cell = cells[ci];
        const ch = cell.char;
        const emojiScale = pendingScale;  // 当前格（Emoji）由数字标记的缩放
        pendingScale = null;
        // 标记框：整个框替换成形状 SVG（空格占位，SVG 覆盖层统一叠加）
        const shapeBox = shapeBoxes.find(s => r >= s.box.fromRow && r <= s.box.toRow && cell.dispCol >= s.box.fromCol && cell.dispCol <= s.box.toCol);
        if (shapeBox) {
          if (curBg || curUl || curBold || curColor || curRainbow || curScale) { line += '</span>'; curBg = null; curUl = false; curBold = false; curColor = null; curRainbow = false; curScale = null; }
          line += ' ';
          continue;
        }
        // Find the SMALLEST box containing this display position (innermost wins for nested boxes)
        let cellBg = null;
        let cellBox = null;
        let leftWall = -1, rightWall = -1;
        let bestArea = Infinity;
        for (const b of boxes) {
          if (r > b.fromRow && r < b.toRow && cell.dispCol > b.fromCol && cell.dispCol < b.toCol - 1) {
            const area = (b.toRow - b.fromRow) * (b.toCol - b.fromCol);
            if (area < bestArea) {
              bestArea = area;
              cellBg = b.hex;
              cellBox = b;
              leftWall = b.fromCol;
              rightWall = b.toCol - 1;
            }
          }
        }

        // If a SMALLER uncolored box encloses this cell AND there's a colored outer box,
        // paint white (covers outer color). No colored outer box → stays null (transparent).
        if (cellBg) {
          let bestUncolored = null, bestUncoloredArea = Infinity;
          for (const u of uncoloredBoxes) {
            if (r > u.fromRow && r < u.toRow && cell.dispCol > u.fromCol && cell.dispCol < u.toCol - 1) {
              const uArea = (u.toRow - u.fromRow) * (u.toCol - u.fromCol);
              if (uArea < bestUncoloredArea) { bestUncoloredArea = uArea; bestUncolored = u; }
            }
          }
          if (bestUncolored && bestUncoloredArea < bestArea) {
            cellBg = '#ffffff'; cellBox = bestUncolored;
            leftWall = bestUncolored.fromCol; rightWall = bestUncolored.toCol - 1;
          }
        }

        const isWall = cell.dispCol === leftWall || cell.dispCol === rightWall;
        const insideBox = cellBg && !isWall;
        const needUl = isUlContent(cell.idx);
        const needBold = isBoldContent(cell.idx);
        const needColor = isColorContent(cell.idx);
        const needRainbow = isRainbowContent(cell.idx);
        const textColor = needColor ? getColor(cell.idx) : needRainbow ? getRainbowColor(cell.idx) : null;
        const isMarker = isUlMarker(cell.idx) || isBoldMarker(cell.idx) || isColorMarker(cell.idx) || isRainbowMarker(cell.idx);

        // Emoji 缩放标记：数字(2-9) + Emoji → Emoji 放大 0.5×数字 倍，数字格隐藏
        let isScaleMarker = false;
        if (emojiScale === null && ch >= '2' && ch <= '9') {
          const next = cells[ci + 1];
          if (next && isEmojiChar(next.char)) {
            pendingScale = 1 + (ch.charCodeAt(0) - 48) * 0.5;  // 基础1倍 + 0.5×数字
            isScaleMarker = true;
          }
        }
        // ZWJ 序列延续：Emoji(缩放) + ZWJ + Emoji... 整体缩放，避免序列被打断成多个 Emoji
        if (emojiScale !== null) {
          const next = cells[ci + 1];
          if (next && ((isEmojiChar(ch) && next.char === '‍') || (ch === '‍' && isEmojiChar(next.char)))) {
            pendingScale = emojiScale;
          }
        }

        // Escape HTML special chars, hide _ markers
        let outCh = ch;
        if (isScaleMarker) outCh = ' ';
        if (isMarker) outCh = ' ';
        else if (ch === '&') outCh = '&amp;';
        else if (ch === '<') outCh = '&lt;';
        else if (ch === '>') outCh = '&gt;';

        if (insideBox || needUl || needColor || needRainbow || emojiScale) {
          if (curBg !== cellBg || curUl !== needUl || curBold !== needBold || curColor !== textColor || curRainbow !== needRainbow || curScale !== emojiScale) {
            if (curBg || curUl || curBold || curColor || curRainbow || curScale) line += '</span>';
            let styles = [];
            if (cellBg) {
              let padding = '0';
              let zindex = 1;
              if (cellBox) {
                const firstRow = cellBox.fromRow + 1;
                const lastRow = cellBox.toRow - 1;
                if (r === firstRow) padding = '6px 0';
                else if (r === lastRow) padding = '0 0 6px 0';
                // Smaller (inner) boxes get higher z-index so their padding overhangs sit on top
                const area = (cellBox.toRow - cellBox.fromRow) * (cellBox.toCol - cellBox.fromCol);
                zindex = Math.max(1, 1000 - area);
              }
              styles.push(`background:${cellBg};padding:${padding};position:relative;z-index:${zindex}`);
            }
            if (needUl) styles.push('text-decoration:underline;text-decoration-color:red;text-decoration-thickness:1.5px;text-underline-offset:3px');
            if (needBold) styles.push('font-weight:bold');
            if (textColor) styles.push('color:' + textColor);
            if (emojiScale) styles.push(`display:inline-block;transform:scale(${emojiScale});transform-origin:center`);
            line += `<span style="${styles.join(';')}">`;
            curBg = cellBg;
            curUl = needUl;
            curBold = needBold;
            curColor = textColor;
            curRainbow = needRainbow;
            curScale = emojiScale;
          }
          line += outCh;
        } else {
          if (curBg || curUl || curBold || curColor || curRainbow || curScale) { line += '</span>'; curBg = null; curUl = false; curBold = false; curColor = null; curRainbow = false; curScale = null; }
          line += outCh;
        }
      }
      if (curBg || curUl || curBold || curColor || curRainbow || curScale) line += '</span>';
      line = line.replace(/\s+$/, '');
      html += line + '\n';
    }
    html = html.replace(/\n+$/, '');

    // 标记框的 SVG 覆盖层（绝对定位到框区域）
    const overlays = shapeBoxes.map(s => {
      const b = s.box;
      let svg = s.svg;
      if (b.hex) {
        // 填充用框色（fill="none" 或原本无 fill 的不强加，保持原样）
        svg = svg.replace(/fill="([^"]*)"/g, (m, c) => c === 'none' ? m : `fill="${b.hex}"`);
        if (svg.includes('stroke="')) svg = svg.replace(/stroke="[^"]*"/g, 'stroke="#000000"');
        // 描边类 ellipse（无 fill 或 fill="none"）移到末尾，避免下边框被后面 path 覆盖；有实际填充色的不动
        const ellipseLayers = [];
        svg = svg.replace(/<ellipse([^>]*?)\/>/g, (m, attrs) => {
          if (!/fill=/.test(attrs) || /fill="none"/.test(attrs)) { ellipseLayers.push(m); return ''; }
          return m;
        });
        if (ellipseLayers.length) svg = svg.replace(/<\/svg>/, ellipseLayers.join('') + '</svg>');
      }
      const wc = b.toCol - b.fromCol, hc = b.toRow - b.fromRow + 1;
      // 线宽不随框缩放：给所有图形元素加 vector-effect="non-scaling-stroke"
      svg = svg.replace(/<(path|ellipse|circle|rect|line|polygon|polyline)\b/gi, '<$1 vector-effect="non-scaling-stroke"');
      return svg.replace(/<svg/i, `<svg preserveAspectRatio="none" data-shape="${b.fromCol},${b.fromRow},${wc},${hc}" style="position:absolute;left:0;top:0;width:0;height:0"`);
    }).join('');

    // 形状框内的文字叠加层（显示在 SVG 上方，颜色按框色自动浅/深）
    const textOverlays = [];
    for (const s of shapeBoxes) {
      const color = s.box.hex ? (isLightColor(s.box.hex) ? '#1a1a1a' : '#ffffff') : '#1a1a1a';
      for (const t of extractShapeText(lines, s.box)) {
        textOverlays.push(`<span data-text="${t.dispCol},${t.r}" style="position:absolute;left:0;top:0;color:${color};font-size:16px;z-index:20;white-space:pre">${escapeHtml(t.text)}</span>`);
      }
    }

    const htmlPage = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
@font-face{font-family:'Sarasa Mono SC Nerd';src:url('${FONT_REG}') format('truetype');font-weight:normal;font-style:normal}
@font-face{font-family:'Sarasa Mono SC Nerd';src:url('${FONT_BOLD}') format('truetype');font-weight:bold;font-style:normal}
*{margin:0;padding:0}body{background:#fff;display:inline-block}
pre{font-family:'更纱终端书呆黑体-简','Sarasa Mono SC Nerd','Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji','Consolas','Courier New',monospace;font-size:16px;line-height:1.25;white-space:pre;margin:0;padding:20px;font-variant-ligatures:none;font-kerning:none}
pre span{padding:0}
</style>
</head><body><pre style="position:relative;display:inline-block">${html}${overlays}${textOverlays.join('')}</pre><script>
(function(){
  var pre=document.querySelector('pre');
  var probe=document.createElement('span');
  probe.style.cssText='font-family:inherit;font-size:16px;position:absolute;visibility:hidden;white-space:pre';
  probe.textContent='0';
  document.body.appendChild(probe);
  var cw=probe.getBoundingClientRect().width;
  document.body.removeChild(probe);
  var lh=parseFloat(getComputedStyle(pre).lineHeight)||20;
  document.querySelectorAll('svg[data-shape]').forEach(function(svg){
    var p=svg.getAttribute('data-shape').split(',');
    svg.style.left=(20+(+p[0])*cw)+'px';
    svg.style.top=(20+(+p[1])*lh)+'px';
    svg.style.width=(+p[2])*cw+'px';
    svg.style.height=(+p[3])*lh+'px';
  });
  document.querySelectorAll('span[data-text]').forEach(function(sp){
    var p=sp.getAttribute('data-text').split(',');
    sp.style.left=(20+(+p[0])*cw)+'px';
    sp.style.top=(20+(+p[1])*lh)+'px';
  });
})();
</script></body></html>`;

    const htmlPath = path.join(OUT, `${name}.html`);
    fs.writeFileSync(htmlPath, htmlPage, 'utf8');

    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
    await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    const pre = page.locator('pre');
    const box = await pre.boundingBox();
    if (box) {
      const pngPath = htmlPath.replace('.html', '.png');
      await page.screenshot({
        path: pngPath,
        clip: { x: Math.max(0, box.x - 5), y: Math.max(0, box.y - 5), width: box.width + 10, height: box.height + 10 },
      });
    }
    const ci = boxes.map(b => b.color).join(',');
    console.log(`${name}.png${ci ? ' [' + ci + ']' : ''}`);
    await page.close();
  }

  await browser.close();

  // Insert Markdown image after each diagram block
  const inputFileDir = path.dirname(path.resolve(inputFile));
  let updatedMd = md;
  let codeBlockIdx = 0;
  for (const diag of diagrams) {
    if (onlySet && !onlySet.has(diag.name)) continue;
    const pngAbs = path.join(OUT, `${diag.name}.png`);
    const relPath = path.relative(inputFileDir, pngAbs).replace(/\\/g, '/');
    const mdImg = `![${diag.name}](${relPath})`;
    const oldImgRe = new RegExp(`\\s*<img[^>]*id="${diag.name}-img"[^>]*/?>\\s*\\n?`, 'g');
    updatedMd = updatedMd.replace(oldImgRe, '\n');
    const oldMdImgRe = new RegExp(`\\s*!\\[${diag.name}\\]\\([^)]+\\)\\s*\\n?`, 'g');
    updatedMd = updatedMd.replace(oldMdImgRe, '\n');

    if (diag.source === 'comment') {
      const blockRe = new RegExp(`(<!--\\s*diagram\\s+${diag.name}\\s[\\s\\S]*?-->)`, 'g');
      updatedMd = updatedMd.replace(blockRe, `$1\n${mdImg}\n`);
    } else if (diag.source === 'code') {
      // Replace code block with comment + image, so the ASCII is kept for editing
      const diagText = diag.lines.join('\n');
      const escaped = diagText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const codeRe = new RegExp('```[^\\n]*\\n' + escaped + '\\n```', 'g');
      updatedMd = updatedMd.replace(codeRe, `<!--diagram ${diag.name}\n${diagText}\n-->\n${mdImg}\n`);
    } else if (diag.source === 'pre') {
      const blockRe = new RegExp(`(<pre\\s+id="${diag.name}"[^>]*>[\\s\\S]*?<\\/pre>)`, 'g');
      updatedMd = updatedMd.replace(blockRe, `$1\n${mdImg}\n`);
    }
  }
  if (updatedMd !== md) {
    fs.writeFileSync(inputFile, updatedMd, 'utf8');
    console.log('Updated image references in ' + inputFile);
  }
  console.log('Done!');
})();
