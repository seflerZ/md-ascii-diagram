// ═══════════════════════════════════════════════════════════════
// md-ascii-diagram 编辑器功能测试
// 覆盖：梳子对齐 / Vim 快捷键 / 箭头三类型 / 连接合并 / 双宽删除
//
// 运行：
//   node tests/editor.test.js
// 说明：自动检测 8000 端口，若未启动则自动拉起 python server.py
// ═══════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const BASE = 'http://127.0.0.1:8000/ascii-editor.html';
const ROOT = path.resolve(__dirname, '..');

// ── 工具 ──
function isPortOpen(port) {
  return new Promise((resolve) => {
    const sock = net.connect(port, '127.0.0.1');
    sock.once('connect', () => { sock.end(); resolve(true); });
    sock.once('error', () => resolve(false));
  });
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function ensureServer() {
  if (await isPortOpen(8000)) return null;
  const child = spawn('python', ['server.py', '8000'], { cwd: ROOT, stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    if (await isPortOpen(8000)) return child;
  }
  child.kill();
  throw new Error('无法启动 python server.py（请确认 python 在 PATH 中）');
}

// ── 测试套件 ──
const SUITES = [

  // ═══════ 梳子对齐（magicAlign）═══════
  {
    name: '梳子对齐',
    fn: () => {
      const results = [];
      const setStr = (r, str) => { for (let c = 0; c < str.length; c++) grid[r][c] = str[c]; };

      // 横线 + 错位箭头 → 拉齐且保留箭头
      initGrid(); setStr(0, '──────'); grid[1][6] = '→'; renderGrid();
      selStart = { r: 0, c: 0, dispCol: 0 }; selEnd = { r: 1, c: 6, dispCol: 6 }; magicAlign();
      results.push({ name: '横线+错位箭头拉齐', ok: grid[0][6] === '→' && (grid[1][6] === '' || grid[1][6] === undefined) });

      // 竖线 + 错列下箭头 → 保留
      initGrid(); grid[0][3] = '│'; grid[1][3] = '│'; grid[2][2] = '↓'; renderGrid();
      selStart = { r: 0, c: 0, dispCol: 0 }; selEnd = { r: 2, c: 4, dispCol: 4 }; magicAlign();
      results.push({ name: '竖线+错列下箭头', ok: grid[2][3] === '↓' && (grid[2][2] === '' || grid[2][2] === undefined) });

      // 粗线散落 → 补断点（错位的 ━ 移到基准行空位）
      initGrid(); setStr(0, '━━ ━━'); grid[1][2] = '━'; renderGrid();  // r0: ━━ ━━, r1 c2 错位
      selStart = { r: 0, c: 0, dispCol: 0 }; selEnd = { r: 1, c: 4, dispCol: 4 }; magicAlign();
      results.push({ name: '粗线散落拉齐', ok: grid[0][0] === '━' && grid[0][2] === '━' && grid[0][3] === '━' && (grid[1][2] === '' || grid[1][2] === undefined) });

      return results;
    },
  },

  // ═══════ Vim 快捷键（y/d/x/p/dd/yy）═══════
  {
    name: 'Vim快捷键',
    fn: () => {
      const results = [];
      const dispatchKey = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      const setStr = (r, str) => { for (let c = 0; c < str.length; c++) grid[r][c] = str[c]; };

      // Visual y 复制选区
      initGrid(); setStr(0, 'AB'); setStr(1, 'CD'); renderGrid();
      isVisual = true; selStart = { r: 0, c: 0, dispCol: 0 }; selEnd = { r: 1, c: 1, dispCol: 1 }; updateSelection();
      dispatchKey('y');
      results.push({ name: 'Visual y 复制选区', ok: clipboard && clipboard[0][0] && clipboard[0][0].char === 'A' && clipboard[1][1] && clipboard[1][1].char === 'D' });

      // Visual d 删选区 + 左移
      initGrid(); setStr(0, 'ABCD'); setStr(1, 'EFGH'); renderGrid();
      isVisual = true; selStart = { r: 0, c: 1, dispCol: 1 }; selEnd = { r: 1, c: 2, dispCol: 2 }; updateSelection();
      dispatchKey('d');
      results.push({ name: 'Visual d 删选区+左移', ok: grid[0][1] === 'D' && grid[1][1] === 'H' });

      // Visual x 只删选区
      initGrid(); setStr(0, 'ABCD'); renderGrid();
      isVisual = true; selStart = { r: 0, c: 1, dispCol: 1 }; selEnd = { r: 0, c: 2, dispCol: 2 }; updateSelection();
      dispatchKey('x');
      results.push({ name: 'Visual x 只删选区', ok: (grid[0][1] === '' || grid[0][1] === undefined) && grid[0][3] === 'D' });

      // Visual p 粘贴
      initGrid(); renderGrid(); clipboard = [[{char:'M',width:1},{char:'N',width:1}]]; cursorR = 1; cursorC = 1;
      isVisual = true; selStart = { r: 1, c: 1, dispCol: 1 }; selEnd = { r: 1, c: 1, dispCol: 1 }; updateSelection();
      dispatchKey('p');
      results.push({ name: 'Visual p 粘贴', ok: grid[1][1] === 'M' && grid[1][2] === 'N' });

      // 普通 d 删光标 + 左移
      initGrid(); setStr(0, 'ABC'); renderGrid();
      cursorR = 0; cursorC = 1; isVisual = false; dispatchKey('d');
      results.push({ name: '普通 d 删+左移', ok: grid[0][1] === 'C' && (grid[0][2] === '' || grid[0][2] === undefined) });

      // 普通 x 只删
      initGrid(); setStr(0, 'ABC'); renderGrid();
      cursorR = 0; cursorC = 1; isVisual = false; dispatchKey('x');
      results.push({ name: '普通 x 只删', ok: (grid[0][1] === '' || grid[0][1] === undefined) && grid[0][2] === 'C' });

      // yy 复制行回归
      initGrid(); setStr(0, 'XYZ'); renderGrid();
      cursorR = 0; isVisual = false; dispatchKey('y'); dispatchKey('y');
      results.push({ name: 'yy 复制行回归', ok: clipboard && clipboard[0][0] && clipboard[0][0].char === 'X' && clipboard[0][2] && clipboard[0][2].char === 'Z' });

      // y 单按复制当前格
      initGrid(); grid[0][5] = 'X'; renderGrid();
      cursorR = 0; cursorC = 5; isVisual = false; dispatchKey('y');
      results.push({ name: 'y 复制当前格', ok: clipboard && clipboard[0][0] && clipboard[0][0].char === 'X' && clipboard[0].length === 1 });

      // Ctrl+C 无选区复制光标格
      initGrid(); grid[0][7] = 'Y'; renderGrid();
      cursorR = 0; cursorC = 7; isVisual = false;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true }));
      results.push({ name: 'Ctrl+C无选区复制格', ok: clipboard && clipboard[0][0] && clipboard[0][0].char === 'Y' && clipboard[0].length === 1 });

      // u 撤销回归
      initGrid(); setStr(0, 'AB'); renderGrid(); saveHistory(); setCell(0, 0, 'X'); saveHistory();
      isVisual = false; dispatchKey('u');
      results.push({ name: 'u 撤销回归', ok: grid[0][0] === 'A' });

      // Delete 框选删列左移回归
      initGrid(); setStr(0, 'ABCD'); setStr(1, 'EFGH'); renderGrid();
      selStart = { r: 0, c: 1, dispCol: 1 }; selEnd = { r: 1, c: 2, dispCol: 2 }; updateSelection();
      dispatchKey('Delete');
      results.push({ name: 'Delete 框选删列左移', ok: grid[0][1] === 'D' && grid[1][1] === 'H' });

      return results;
    },
  },

  // ═══════ 箭头三类型（细/实心/空心 × 四方向）═══════
  {
    name: '箭头三类型',
    fn: () => {
      const results = [];
      const dispatchKey = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      const headHas = (r1, d1, r2, d2, exp) => {
        selStart = { r: r1, c: d1, dispCol: d1 }; selEnd = { r: r2, c: d2, dispCol: d2 };
        return computeArrowPath().some(p => p.ch === exp);
      };
      const dirs = [['右', 0, 0, 0, 3], ['左', 0, 3, 0, 0], ['下', 0, 1, 3, 1], ['上', 3, 1, 0, 1]];
      const types = [
        { n: 1, map: { 右: '→', 左: '←', 下: '↓', 上: '↑' } },
        { n: 2, map: { 右: '▶', 左: '◀', 下: '▼', 上: '▲' } },
        { n: 3, map: { 右: '▷', 左: '◁', 下: '▽', 上: '△' } },
      ];
      for (const t of types) {
        arrowType = t.n;
        let allOk = true;
        for (const [name, r1, d1, r2, d2] of dirs) if (!headHas(r1, d1, r2, d2, t.map[name])) allOk = false;
        results.push({ name: `类型${t.n} 四方向`, ok: allOk });
      }
      // 快捷键 1/2/3
      setTool('arrow'); dispatchKey('2');
      results.push({ name: '快捷键2→实心', ok: arrowType === 2 && document.getElementById('tool-arrow').textContent.includes('▶') });
      dispatchKey('3');
      results.push({ name: '快捷键3→空心', ok: arrowType === 3 });
      dispatchKey('1');
      results.push({ name: '快捷键1→细', ok: arrowType === 1 });
      // 下拉切换
      document.querySelector('.arrow-opt[data-type="2"]').click();
      results.push({ name: '下拉切换实心', ok: arrowType === 2 });
      // 实际绘制
      initGrid(); renderGrid(); arrowType = 2;
      selStart = { r: 0, c: 0, dispCol: 0 }; selEnd = { r: 0, c: 3, dispCol: 3 }; drawArrow();
      results.push({ name: '绘制实心箭头', ok: grid[0][3] === '▶' });
      return results;
    },
  },

  // ═══════ 连接合并（free/L/圆角/色码/ASCII/转角/文字）═══════
  {
    name: '连接合并',
    fn: () => {
      const results = [];
      const fire = (r, c, type) => {
        const el = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        if (el) el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
      };
      const drawBox = (rounded) => {
        initGrid();
        const [tl, tr, bl, br] = rounded ? ['╭', '╮', '╰', '╯'] : ['┌', '┐', '└', '┘'];
        grid[2][1] = tl; grid[2][2] = '─'; grid[2][3] = '─'; grid[2][4] = '─'; grid[2][5] = '─'; grid[2][6] = '─'; grid[2][7] = tr;
        grid[3][1] = '│'; grid[3][7] = '│';
        grid[4][1] = bl; grid[4][2] = '─'; grid[4][3] = '─'; grid[4][4] = '─'; grid[4][5] = '─'; grid[4][6] = '─'; grid[4][7] = br;
        renderGrid();
      };
      const drawLineBetween = (r1, d1, r2, d2) => { selStart = { r: r1, c: d1, dispCol: d1 }; selEnd = { r: r2, c: d2, dispCol: d2 }; drawLine(); };

      // L 工具竖线接圆角框顶边
      drawBox(true); drawLineBetween(0, 4, 2, 4);
      results.push({ name: 'L竖线接圆角框顶边', ok: grid[2][4] === '┴' });
      // L 工具竖线接直角框顶边
      drawBox(false); drawLineBetween(0, 4, 2, 4);
      results.push({ name: 'L竖线接直角框顶边', ok: grid[2][4] === '┴' });
      // free 竖线接顶边
      drawBox(false); setTool('free');
      fire(0, 4, 'mousedown'); fire(1, 4, 'mousemove'); fire(2, 4, 'mousemove'); fire(2, 4, 'mouseup');
      results.push({ name: 'free竖线接顶边', ok: grid[2][4] === '┴' });
      // free 横线接圆角框竖边
      drawBox(true); setTool('free');
      fire(3, 0, 'mousedown'); fire(3, 1, 'mousemove'); fire(3, 1, 'mouseup');
      results.push({ name: 'free横线接圆角框竖边', ok: grid[3][1] === '┤' });
      // L 横线接直角框竖边
      drawBox(false); drawLineBetween(3, 0, 3, 1);
      results.push({ name: 'L横线接直角框竖边', ok: grid[3][1] === '┤' });
      // 竖线接圆角角
      drawBox(true); drawLineBetween(0, 1, 2, 1);
      results.push({ name: '竖线接圆角角', ok: grid[2][1] === '├' });
      // 色码左邻居合并
      initGrid();
      grid[0][2] = '│'; grid[1][1] = 'g'; grid[1][2] = '─'; grid[1][3] = '─'; grid[1][4] = '─'; grid[1][5] = '─'; grid[1][6] = '─'; grid[1][7] = '┐';
      grid[2][1] = '│'; grid[2][7] = '│';
      grid[3][1] = '└'; grid[3][2] = '─'; grid[3][3] = '─'; grid[3][4] = '─'; grid[3][5] = '─'; grid[3][6] = '─'; grid[3][7] = '┘';
      renderGrid(); drawLineBetween(0, 2, 1, 2);
      results.push({ name: '色码左邻居合并', ok: grid[1][2] === '┴' });
      // ASCII | 邻居合并
      initGrid();
      grid[0][5] = '┐'; grid[1][4] = '─'; grid[1][5] = '─'; grid[1][6] = '─'; grid[2][5] = '|';
      renderGrid(); drawLineBetween(1, 4, 1, 6);
      results.push({ name: 'ASCII|邻居合并', ok: grid[1][5] === '┼' });
      // 文字邻居不误连
      initGrid();
      grid[0][2] = 'A'; grid[1][0] = '─'; grid[1][1] = '─'; grid[1][2] = '─'; grid[1][3] = '─'; grid[2][2] = '│';
      renderGrid(); drawLineBetween(2, 2, 1, 2);
      results.push({ name: '文字邻居不误连', ok: grid[1][2] === '┬' });
      // 竖线接底边（右邻色码）
      initGrid();
      grid[2][1] = '┌'; grid[2][2] = '─'; grid[2][3] = '─'; grid[2][4] = '─'; grid[2][5] = '─'; grid[2][6] = '─'; grid[2][7] = '┐';
      grid[3][1] = '│'; grid[3][7] = '│';
      grid[4][1] = '└'; grid[4][2] = '─'; grid[4][3] = '─'; grid[4][4] = '─'; grid[4][5] = '─'; grid[4][6] = '─'; grid[4][7] = 'g';
      grid[5][6] = '│';
      renderGrid(); drawLineBetween(5, 6, 4, 6);
      results.push({ name: '竖线接底边(右邻色码)', ok: grid[4][6] === '┬' });

      return results;
    },
  },

  // ═══════ 双宽字符删除（x/X/Delete dispCol 重算）═══════
  {
    name: '双宽删除',
    fn: () => {
      const results = [];
      const dispatchKey = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      const dispColOf = (r, c) => {
        const el = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        return el ? parseInt(el.dataset.dispCol) : null;
      };
      // x 删双宽
      initGrid(); grid[0][0] = 'A'; grid[0][1] = '中'; grid[0][2] = 'B'; renderGrid();
      cursorR = 0; cursorC = 1; isVisual = false; dispatchKey('x');
      results.push({ name: 'x删双宽dispCol重算', ok: grid[0][1] === '' && grid[0][2] === 'B' && dispColOf(0, 2) === 2 });
      // Delete 删双宽
      initGrid(); grid[0][0] = 'A'; grid[0][1] = '中'; grid[0][2] = 'B'; renderGrid();
      cursorR = 0; cursorC = 1; isVisual = false; dispatchKey('Delete');
      results.push({ name: 'Delete删双宽', ok: grid[0][1] === '' && dispColOf(0, 2) === 2 });
      // X 删前双宽
      initGrid(); grid[0][0] = '中'; grid[0][1] = 'B'; renderGrid();
      cursorR = 0; cursorC = 1; isVisual = false; dispatchKey('X');
      results.push({ name: 'X删前双宽', ok: grid[0][0] === '' && grid[0][1] === 'B' && dispColOf(0, 1) === 1 });
      // d 左移回归
      initGrid(); grid[0][0] = 'A'; grid[0][1] = 'B'; grid[0][2] = 'C'; renderGrid();
      cursorR = 0; cursorC = 1; isVisual = false; dispatchKey('d');
      results.push({ name: 'd左移回归', ok: grid[0][1] === 'C' });

      return results;
    },
  },

  // ═══════ Emoji 缩放（数字前缀 2-9 → 0.5×n 倍，不占空间）═══════
  {
    name: 'Emoji缩放',
    fn: () => {
      const results = [];
      const render = () => renderPreview(getGridText());

      initGrid(); grid[0][0] = '4'; grid[0][1] = '📦'; grid[0][2] = 'A'; renderGrid();
      let html = render();
      results.push({ name: '4📦→scale(3)', ok: html.includes('transform:scale(3)') && html.includes('📦') && !/>4</.test(html) });

      initGrid(); grid[0][0] = '2'; grid[0][1] = '📦'; renderGrid();
      html = render();
      results.push({ name: '2📦→scale(2)', ok: html.includes('transform:scale(2)') });

      initGrid(); grid[0][0] = '6'; grid[0][1] = '📦'; renderGrid();
      html = render();
      results.push({ name: '6📦→scale(4)', ok: html.includes('transform:scale(4)') });

      initGrid(); grid[0][0] = '9'; grid[0][1] = '📦'; renderGrid();
      html = render();
      results.push({ name: '9📦→scale(5.5)', ok: html.includes('transform:scale(5.5)') });

      initGrid(); grid[0][0] = '4'; grid[0][1] = 'A'; renderGrid();
      html = render();
      results.push({ name: '4A不触发', ok: html.includes('4') && !html.includes('transform:scale') });

      initGrid(); grid[0][0] = '4'; grid[0][1] = '中'; renderGrid();
      html = render();
      results.push({ name: '4中不触发', ok: html.includes('4') && !html.includes('transform:scale') });

      initGrid(); grid[0][0] = '📦'; renderGrid();
      html = render();
      results.push({ name: '裸Emoji不缩放', ok: html.includes('📦') && !html.includes('transform:scale') });

      // ZWJ 序列（如 👩‍🦰）整体缩放，不打断成多个 Emoji
      initGrid(); grid[0][0] = '2'; grid[0][1] = '👩'; grid[0][2] = '‍'; grid[0][3] = '🦰'; renderGrid();
      html = render();
      const iW = html.indexOf('👩'), iR = html.indexOf('🦰');
      const between = iW >= 0 && iR >= 0 ? html.slice(iW, iR + 1) : '';
      results.push({ name: '2👩ZWJ🦰 序列不打断', ok: html.includes('transform:scale(2)') && between.includes('‍') && !between.includes('</span>') });

      return results;
    },
  },

  // ═══════ 形状替换（框左下角 d:N 标记 → SVG 贴纸）═══════
  {
    name: '形状替换',
    fn: () => {
      const results = [];
      const S = '<svg viewBox="0 0 1024 1024"><path d="M512 0L1024 512 512 1024 0 512Z" fill="#272636"></path></svg>';
      shapes[1] = S;

      // 标记框（左下角 d:1）→ 替换成 SVG（框线/标记隐藏，覆盖层生成）
      initGrid();
      grid[0][0]='┌'; for (let c=1;c<=6;c++) grid[0][c]='─'; grid[0][7]='┐';
      grid[1][0]='│'; grid[1][7]='│';
      grid[2][0]='d'; grid[2][1]=':'; grid[2][2]='1'; for (let c=3;c<=6;c++) grid[2][c]='─'; grid[2][7]='┘';
      renderGrid();
      let html = renderPreview(getGridText());
      results.push({ name: '标记框→SVG替换', ok: html.includes('position:absolute') && !html.includes('d:1') && !html.includes('┌') });

      // 自定义名字标记 d:a（≤3字符）
      shapes['a'] = S;
      initGrid();
      grid[0][0]='┌'; for (let c=1;c<=6;c++) grid[0][c]='─'; grid[0][7]='┐';
      grid[1][0]='│'; grid[1][7]='│';
      grid[2][0]='d'; grid[2][1]=':'; grid[2][2]='a'; for (let c=3;c<=6;c++) grid[2][c]='─'; grid[2][7]='┘';
      renderGrid();
      html = renderPreview(getGridText());
      results.push({ name: '自定义名字 d:a', ok: html.includes('position:absolute') && !html.includes('d:a') });

      // 着色框（左上g右下g，左下d:1）→ SVG 染成框色
      initGrid();
      grid[0][0]='g'; for (let c=1;c<=6;c++) grid[0][c]='─'; grid[0][7]='┐';
      grid[1][0]='│'; grid[1][7]='│';
      grid[2][0]='d'; grid[2][1]=':'; grid[2][2]='1'; for (let c=3;c<=6;c++) grid[2][c]='─'; grid[2][7]='g';
      renderGrid();
      html = renderPreview(getGridText());
      const ov = html.match(/<path[^>]*fill="([^"]*)"/);
      results.push({ name: '着色框SVG染色', ok: !!ov && ov[1] === '#4EA660' });

      // 描边图标（fill="none"）→ 保持空心不强制填充，描边纯黑
      shapes[1] = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="10" cy="5" rx="7" ry="2.5"/></svg>';
      initGrid();
      grid[0][0]='g'; for (let c=1;c<=6;c++) grid[0][c]='─'; grid[0][7]='┐';
      grid[1][0]='│'; grid[1][7]='│';
      grid[2][0]='d'; grid[2][1]=':'; grid[2][2]='1'; for (let c=3;c<=6;c++) grid[2][c]='─'; grid[2][7]='g';
      renderGrid();
      html = renderPreview(getGridText());
      results.push({ name: '描边图标fill none保持', ok: html.includes('fill="none"') && html.includes('stroke="#000000"') && !html.includes('fill="#4EA660"') });

      // 形状框内文字叠加到 SVG 上 + 颜色判断（无着色 → 深字）
      initGrid();
      grid[0][0]='┌'; for (let c=1;c<=6;c++) grid[0][c]='─'; grid[0][7]='┐';
      grid[1][0]='│'; grid[1][2]='标'; grid[1][3]='签'; grid[1][7]='│';
      grid[2][0]='d'; grid[2][1]=':'; grid[2][2]='1'; for (let c=3;c<=6;c++) grid[2][c]='─'; grid[2][7]='┘';
      renderGrid();
      html = renderPreview(getGridText());
      const ts = html.match(/<span style="position:absolute[^>]*color:([^;"]*)[^>]*z-index:20[^>]*>([^<]*)<\/span>/);
      results.push({ name: '框内文字叠加', ok: !!ts && ts[2] === '标签' && ts[1] === '#1a1a1a' });

      // 绿色框 → 白字（深背景）
      initGrid();
      grid[0][0]='g'; for (let c=1;c<=6;c++) grid[0][c]='─'; grid[0][7]='┐';
      grid[1][0]='│'; grid[1][2]='标'; grid[1][3]='签'; grid[1][7]='│';
      grid[2][0]='d'; grid[2][1]=':'; grid[2][2]='1'; for (let c=3;c<=6;c++) grid[2][c]='─'; grid[2][7]='g';
      renderGrid();
      html = renderPreview(getGridText());
      const ts2 = html.match(/<span style="position:absolute[^>]*color:([^;"]*)[^>]*z-index:20[^>]*>/);
      results.push({ name: '绿色框白字', ok: !!ts2 && ts2[1] === '#ffffff' });

      // 无标记框正常渲染
      initGrid();
      grid[0][0]='┌'; grid[0][1]='─'; grid[0][2]='┐';
      grid[1][0]='│'; grid[1][2]='│';
      grid[2][0]='└'; grid[2][1]='─'; grid[2][2]='┘';
      renderGrid();
      html = renderPreview(getGridText());
      results.push({ name: '无标记框正常', ok: html.includes('┌') && !html.includes('position:absolute') });

      // 形状不存在（d:99）→ 不替换
      initGrid();
      grid[0][0]='┌'; for (let c=1;c<=6;c++) grid[0][c]='─'; grid[0][7]='┐';
      grid[1][0]='│'; grid[1][7]='│';
      grid[2][0]='d'; grid[2][1]=':'; grid[2][2]='9'; grid[2][3]='9'; for (let c=4;c<=6;c++) grid[2][c]='─'; grid[2][7]='┘';
      renderGrid();
      html = renderPreview(getGridText());
      results.push({ name: '形状不存在不替换', ok: !html.includes('position:absolute') && html.includes('┌') });

      return results;
    },
  },

  // ═══════ 键盘绘制（箭头/直线：方向键扩展 + Enter 确认 + Esc 取消）═══════
  {
    name: '键盘绘制',
    fn: () => {
      const results = [];
      const dispatchKey = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      const textAt = (r, c) => {
        const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        return cell ? cell.textContent : '(none)';
      };

      // 1. 箭头工具：右→下→Enter → L 形箭头（起点固定，终点扩展）
      arrowType = 1;  // 细箭头，避免前套件残留类型
      initGrid(); renderGrid(); setTool('arrow');
      cursorR = 2; cursorC = 2;
      dispatchKey('ArrowRight'); dispatchKey('ArrowDown'); dispatchKey('Enter');
      results.push({
        name: '箭头 右→下→Enter L形',
        ok: textAt(2,2) === '─' && textAt(2,3) === '┐' && textAt(3,3) === '↓',
      });

      // 2. 直线工具：右×3→Enter → 水平线
      initGrid(); renderGrid(); setTool('line');
      cursorR = 5; cursorC = 1;
      dispatchKey('ArrowRight'); dispatchKey('ArrowRight'); dispatchKey('ArrowRight'); dispatchKey('Enter');
      results.push({
        name: '直线 右×3→Enter 水平线',
        ok: textAt(5,1) === '─' && textAt(5,2) === '─' && textAt(5,3) === '─' && textAt(5,4) === '─',
      });

      // 3. Esc 取消路径：光标回到起点，留在工具可重画
      arrowType = 1;
      initGrid(); renderGrid(); setTool('arrow');
      cursorR = 7; cursorC = 1;
      dispatchKey('ArrowRight'); dispatchKey('ArrowRight');
      const hasPreview = document.querySelectorAll('.preview').length > 0;
      dispatchKey('Escape');
      const cursorReset = cursorR === 7 && cursorC === 1;
      const stillArrow = activeTool === 'arrow';
      dispatchKey('ArrowDown'); dispatchKey('ArrowDown'); dispatchKey('Enter');
      results.push({
        name: 'Esc取消→光标回起点→重画竖线',
        ok: hasPreview && cursorReset && stillArrow && textAt(8,1) === '│' && textAt(9,1) === '↓',
      });

      return results;
    },
  },

  // ═══════ 移动工具（宽字符 dispCol 安全）═══════
  {
    name: '移动工具',
    fn: () => {
      const results = [];
      const dispColOf = (r, c) => {
        const el = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        return el ? parseInt(el.dataset.dispCol) : null;
      };

      // Bug1 核心：多行宽字符框下移一格。旧实现按 grid 列切片/清空，
      //   maxC-minC+1(6) < maxD-minD+1(8) → r0 残留 ──、r1 框顶缺 ── → 整体乱。
      initGrid();
      grid[0][0] = '┌'; for (let c = 1; c <= 7; c++) grid[0][c] = '─'; grid[0][8] = '┐';
      grid[1][0] = '│'; grid[1][1] = '中'; grid[1][2] = '文'; grid[1][3] = 'A'; grid[1][4] = 'B'; grid[1][5] = '│';
      renderGrid();
      selStart = { r: 0, c: 0, dispCol: 0 }; selEnd = { r: 1, c: 5, dispCol: 7 };
      moveContentByGrid(getSelectionBounds(), 1, 0);
      results.push({ name: '宽字符框下移-原区域清空无残留', ok:
        grid[0][0] === '' && grid[0][6] === '' && grid[0][7] === '' });
      results.push({ name: '宽字符框下移-选区外右角保留', ok: grid[0][8] === '┐' });
      results.push({ name: '宽字符框下移-框顶完整下移', ok:
        grid[1][0] === '┌' && grid[1][6] === '─' && grid[1][7] === '─' });
      results.push({ name: '宽字符框下移-宽字符行保真', ok:
        grid[2][0] === '│' && grid[2][1] === '中' && grid[2][2] === '文' &&
        grid[2][3] === 'A' && grid[2][4] === 'B' && grid[2][5] === '│' });
      results.push({ name: '宽字符框下移-dispCol对齐', ok:
        dispColOf(2, 1) === 1 && dispColOf(2, 2) === 3 });

      // Bug2：宽字符行右移一格，dc(dispCol偏移)不能当 grid 列偏移用
      initGrid();
      grid[0][0] = '│'; grid[0][1] = '中'; grid[0][2] = '│';
      renderGrid();
      selStart = { r: 0, c: 0, dispCol: 0 }; selEnd = { r: 0, c: 2, dispCol: 3 };
      moveContentByGrid(getSelectionBounds(), 0, 1);
      results.push({ name: '宽字符行右移一格保真', ok:
        grid[0][0] === '' && grid[0][1] === '│' && grid[0][2] === '中' && grid[0][3] === '│' &&
        dispColOf(0, 2) === 2 });

      // 回归：纯 ASCII 下移不能因改范式而坏
      initGrid();
      grid[0][0] = 'A'; grid[0][1] = 'B'; grid[0][2] = 'C';
      renderGrid();
      selStart = { r: 0, c: 0, dispCol: 0 }; selEnd = { r: 0, c: 2, dispCol: 2 };
      moveContentByGrid(getSelectionBounds(), 1, 0);
      results.push({ name: '纯ASCII下移回归', ok:
        grid[0][0] === '' && grid[1][0] === 'A' && grid[1][1] === 'B' && grid[1][2] === 'C' });

      // 移动后选区外汉字保留：向下箭头(行0-6)移到行5，行5原本的「中文」dispCol2..5
      // 在选区外，move 重建时必须按原 dispCol 钉住（曾经被 w2 误跳过 → 汉字消失）
      initGrid();
      selStart = { r:0, c:8, dispCol:8 }; selEnd = { r:6, c:8, dispCol:8 };
      thickAxis = null; thickSign = 0; thickLocked = false;
      drawThick();
      grid[5][2] = '中'; grid[5][4] = '文'; renderGrid();
      selStart = { r:0, c:8, dispCol:8 }; selEnd = { r:6, c:13, dispCol:13 };
      thickAxis = null; thickSign = 0; thickLocked = false;
      moveContentByGrid(getSelectionBounds(), 1, 0); renderGrid();
      results.push({ name: '移动后选区外汉字保留', ok:
        grid[5][2] === '中' && grid[5][4] === '文' });

      // d26 真实场景：22 视觉宽框，各行右墙 grid 列不同但 dispCol=21（宽字符撑开）
      // 框选「向」到「B」下移一格，墙必须钉在原 dispCol，不能因源收缩/目标撑开而漂移
      initGrid();
      grid[0][0]='e'; for (let c=1;c<=20;c++) grid[0][c]='─'; grid[0][21]='╮';
      grid[1][0]='│'; grid[1][1]=' '; grid[1][2]='向'; grid[1][3]='量'; grid[1][4]='库';
      for (let c=5;c<=17;c++) grid[1][c]=' '; grid[1][18]='│';
      const s='pgvector / LanceDB'; for (let i=0;i<s.length;i++) grid[2][2+i]=s[i];
      grid[2][0]='│'; grid[2][1]=' '; grid[2][20]=' '; grid[2][21]='│';
      grid[3][0]='│'; for (let c=1;c<=20;c++) grid[3][c]=' '; grid[3][21]='│';
      grid[4][0]='╰'; for (let c=1;c<=20;c++) grid[4][c]='─'; grid[4][21]='e';
      renderGrid();
      selStart = { r:1, c:2, dispCol:2 }; selEnd = { r:2, c:19, dispCol:19 };
      moveContentByGrid(getSelectionBounds(), 1, 0);
      // 三行右墙 dispCol 全钉 d21（grid 列因撑开不同：r1/r3 在 c21，r2 在 c18，但视觉对齐）
      const wallAt = (r, d) => { const cc = findCellByDispColAny(r, d); return cc >= 0 ? grid[r][cc] : null; };
      results.push({ name: 'd26框选向→B下移-三行右墙全钉d21', ok:
        wallAt(1, 21) === '│' && wallAt(2, 21) === '│' && wallAt(3, 21) === '│' });
      results.push({ name: 'd26框选向→B下移-向量库到r2', ok:
        grid[2][2] === '向' && grid[2][3] === '量' && grid[2][4] === '库' });
      results.push({ name: 'd26框选向→B下移-pgvector到r3', ok: grid[3][2] === 'p' });

      // 键盘 move 后选区/光标跟随：选区起点不在宽字符起始格（旧实现会扩选区、光标不跟）
      initGrid();
      grid[0][0]='│'; grid[0][2]='向'; grid[0][3]='量'; grid[0][4]='库'; grid[0][21]='│';
      renderGrid();
      setTool('move');
      // 选区从 c5(d8，空格) 到 c21(d22，右墙) —— 起点不在宽字符起始格
      selStart = { r:0, c:5, dispCol:8 }; selEnd = { r:0, c:21, dispCol:22 };
      isVisual = true; cursorR = 0; cursorC = 21; updateSelection();
      document.dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowDown', bubbles:true, cancelable:true }));
      const b2 = getSelectionBounds();
      results.push({ name: '键盘move下移-选区不扩大', ok:
        b2.minD === 8 && b2.maxD === 22 && b2.minR === 1 && b2.maxR === 1 });
      results.push({ name: '键盘move下移-光标跟到selEnd', ok:
        cursorR === 1 && parseInt(document.querySelector(`.cell[data-r="${cursorR}"][data-c="${cursorC}"]`).dataset.dispCol) === 22 });

      // 键盘 move 横向：选区平移不扩大，光标跟到新 selEnd
      initGrid();
      grid[0][0]='│'; grid[0][2]='向'; grid[0][3]='量'; grid[0][4]='库'; grid[0][6]='│';
      renderGrid(); setTool('move');
      selStart = { r:0, c:0, dispCol:0 }; selEnd = { r:0, c:6, dispCol:6 };
      isVisual = true; cursorR = 0; cursorC = 6; updateSelection();
      document.dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowRight', bubbles:true, cancelable:true }));
      const b3 = getSelectionBounds();
      results.push({ name: '键盘move右移-选区平移不扩大', ok: b3.minD === 1 && b3.maxD === 7 });
      results.push({ name: '键盘move右移-光标跟到selEnd', ok:
        cursorR === 0 && parseInt(document.querySelector(`.cell[data-r="${cursorR}"][data-c="${cursorC}"]`).dataset.dispCol) === 7 });

      return results;
    },
  },

  // ═══════ 粗箭头（thick arrow，四方向固定头+可变杆）═══════
  {
    name: '粗箭头',
    fn: () => {
      const results = [];
      // 单宽网格 c===dispCol，直接设 {r,c,dispCol:c}
      const sel = (r1, d1, r2, d2) => {
        selStart = { r:r1, c:d1, dispCol:d1 }; selEnd = { r:r2, c:d2, dispCol:d2 };
        thickAxis = null; thickSign = 0; _thickLastR1 = undefined; _thickLastD1 = undefined;  // fresh drag
      };

      // ── 水平 ──
      // 向右 N=3：杆 ─×3 + ┘\ / ┐/
      initGrid(); renderGrid(); sel(0, 0, 0, 5);
      const pathR = computeThickPath();
      results.push({ name: '向右N=3尖在右', ok: pathR.some(p => p.ch === '\\' && p.r === 0 && p.d === 5) && pathR.some(p => p.ch === '/' && p.r === 1 && p.d === 5) });
      results.push({ name: '向右N=3折角', ok: pathR.some(p => p.ch === '┘' && p.r === 0 && p.d === 4) && pathR.some(p => p.ch === '┐' && p.r === 1 && p.d === 4) });
      results.push({ name: '向右N=3杆数', ok: pathR.filter(p => p.ch === '─').length === 8 }); // 4行杆×2列

      // 落格后验证 grid
      initGrid(); renderGrid(); sel(0, 0, 0, 5); drawThick();
      results.push({ name: '向右落格折角不变', ok: grid[0][4] === '┘' && grid[1][4] === '┐' });
      results.push({ name: '向右落格尖不变', ok: grid[0][5] === '\\' && grid[1][5] === '/' });

      // 向左 N=3：尖在左
      initGrid(); renderGrid(); sel(0, 5, 0, 0);
      const pathL = computeThickPath();
      results.push({ name: '向左N=3尖在左', ok: pathL.some(p => p.ch === '/' && p.r === 0 && p.d === 0) && pathL.some(p => p.ch === '\\' && p.r === 1 && p.d === 0) });
      results.push({ name: '向左N=3折角', ok: pathL.some(p => p.ch === '└' && p.r === 0 && p.d === 1) && pathL.some(p => p.ch === '┌' && p.r === 1 && p.d === 1) });

      // 最小水平 N=0（头+折角，无杆）：sel(0,0,0,1)
      initGrid(); renderGrid(); sel(0, 0, 0, 1); drawThick();
      results.push({ name: '最小水平纯头', ok: grid[0][1] === '\\' && grid[1][1] === '/' && grid[0][0] === '┘' && grid[1][0] === '┐' });

      // ── 垂直 ──
      // 向下：sel(0,1,6,1)，a=1 b=4，hi-lo=6≥2
      initGrid(); renderGrid(); sel(0, 1, 6, 1);
      const pathD = computeThickPath();
      results.push({ name: '向下尖在底', ok: pathD.some(p => p.ch === '\\' && p.r === 6 && p.d === 2) && pathD.some(p => p.ch === '/' && p.r === 6 && p.d === 3) });
      results.push({ name: '向下折角', ok: pathD.some(p => p.ch === '┘' && p.r === 4 && p.d === 1) && pathD.some(p => p.ch === '└' && p.r === 4 && p.d === 4) });
      results.push({ name: '向下杆数', ok: pathD.filter(p => p.ch === '│').length === 8 });

      // 落格
      initGrid(); renderGrid(); sel(0, 1, 6, 1); drawThick();
      results.push({ name: '向下落格尖保真', ok: grid[6][2] === '\\' && grid[6][3] === '/' });
      results.push({ name: '向下落格折角保真', ok: grid[4][1] === '┘' && grid[4][4] === '└' });

      // 向上：sel(6,1,0,1)
      initGrid(); renderGrid(); sel(6, 1, 0, 1);
      const pathU = computeThickPath();
      results.push({ name: '向上尖在顶', ok: pathU.some(p => p.ch === '/' && p.r === 0 && p.d === 2) && pathU.some(p => p.ch === '\\' && p.r === 0 && p.d === 3) });
      results.push({ name: '向上折角', ok: pathU.some(p => p.ch === '┐' && p.r === 2 && p.d === 1) && pathU.some(p => p.ch === '┌' && p.r === 2 && p.d === 4) });

      // ── 边界 ──
      initGrid(); renderGrid(); sel(0, 0, 0, 0);
      results.push({ name: '空选区返空', ok: computeThickPath().length === 0 });

      // autoConnect 不吞头/角：画完后角格仍为折角
      initGrid(); renderGrid(); sel(0, 0, 0, 5); drawThick();
      results.push({ name: 'autoConnect不吞折角', ok: grid[0][4] === '┘' && grid[1][4] === '┐' });
      results.push({ name: 'autoConnect不吞斜线', ok: grid[0][5] === '\\' && grid[1][5] === '/' });
      // 杆被归一为 ─
      results.push({ name: '横杆autoConnect归一为─', ok: grid[0][0] === '─' && grid[1][0] === '─' });

      // 跨轴变头深：先锁定向右（3格），再加垂直偏移 dr=3 → H=3
      // （手动控锁，模拟同一拖拽中继续移动）
      initGrid(); renderGrid();
      selStart = { r:0, c:0, dispCol:0 }; selEnd = { r:0, c:3, dispCol:3 };
      thickAxis = null; thickSign = 0; _thickLastR1 = undefined; _thickLastD1 = undefined;
      computeThickPath();                    // step1: lock right
      selEnd = { r:3, c:10, dispCol:10 };    // step2: widen head via dr=3 (keep lock)
      const pathBig = computeThickPath();
      const bigRows = new Set(pathBig.map(p => p.r)).size;
      results.push({ name: '锁定向右后dr=3头深H≥3', ok: bigRows >= 6 }); // 2H rows, H>=3
      results.push({ name: '锁定向右后dr=3尖收拢', ok:
        pathBig.some(p => p.ch === '\\' && p.r > 0 && p.d === 10) &&
        pathBig.some(p => p.ch === '/' && p.r > 0 && p.d === 10) });
      // 纯水平 dr=0 → H=1 不变（锁定向右后不加垂直偏移）
      initGrid(); renderGrid();
      selStart = { r:0, c:0, dispCol:0 }; selEnd = { r:0, c:10, dispCol:10 };
      thickAxis = null; thickSign = 0; _thickLastR1 = undefined; _thickLastD1 = undefined;
      computeThickPath();                   // lock right
      const pathH1 = computeThickPath();     // same drag, still pure horizontal
      results.push({ name: '纯水平dr=0头深H=1', ok: new Set(pathH1.map(p => p.r)).size === 2 });

      // 前6格可调方向：先右1格，再大幅向上 → 方向跟随增量改向上（未锁）
      initGrid(); renderGrid();
      selStart = { r:5, c:0, dispCol:0 }; selEnd = { r:5, c:1, dispCol:1 };   // step1: 1 right
      computeThickPath();
      selEnd = { r:0, c:1, dispCol:1 };                                       // step2: drag up 5 (still <6)
      const pathFollow = computeThickPath();
      results.push({ name: '前6格-增量改方向即时响应', ok:
        pathFollow.some(p => p.ch === '│') && pathFollow.some(p => p.ch === '/' && p.r === 0) });
      // 锁定后方向永不变：锁定向右(6格)后大幅向下 → 仍向右
      initGrid(); renderGrid();
      selStart = { r:3, c:0, dispCol:0 }; selEnd = { r:3, c:6, dispCol:6 };   // step1: 6 right → LOCK right
      computeThickPath();
      selEnd = { r:5, c:6, dispCol:6 };                                       // step2: drag down 2 → head widens
      const pathWiden = computeThickPath();
      results.push({ name: '锁定向右(6格)后向下拖不翻', ok:
        pathWiden.some(p => p.ch === '─') && !pathWiden.some(p => p.ch === '│') });
      // 头确实变宽：跨轴偏移2 → H=2（4行高）
      initGrid(); renderGrid();
      selStart = { r:3, c:0, dispCol:0 }; selEnd = { r:3, c:6, dispCol:6 };
      computeThickPath();
      selEnd = { r:5, c:6, dispCol:6 };
      results.push({ name: '锁定向右(6格)后向下拖头变宽', ok:
        new Set(computeThickPath().map(p => p.r)).size >= 4 }); // 2H rows, H=2

      // ── 快捷键 ──
      const dispatchKey = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles:true, cancelable:true }));
      setTool('select'); dispatchKey('k');
      results.push({ name: '快捷键k→粗箭头', ok: activeTool === 'thick' });

      // ── 键盘绘制 ──
      initGrid(); renderGrid(); setTool('thick');
      cursorR = 2; cursorC = 2;
      dispatchKey('ArrowRight'); dispatchKey('ArrowRight'); dispatchKey('ArrowRight');
      dispatchKey('Enter');
      results.push({ name: '键盘右×3+Enter落格', ok: grid[2][5] === '\\' && grid[3][5] === '/' && grid[2][4] === '┘' && grid[3][4] === '┐' });

      return results;
    },
  },
];

// ── 主流程 ──
async function main() {
  const serverProc = await ensureServer();
  let passed = 0, failed = 0;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.waitForSelector('#canvas .cell', { timeout: 5000 });
    for (const suite of SUITES) {
      console.log(`\n== ${suite.name} ==`);
      const results = await page.evaluate(suite.fn);
      for (const r of results) {
        if (r.ok) { passed++; console.log(`  ✅ ${r.name}`); }
        else { failed++; console.log(`  ❌ ${r.name}  ${JSON.stringify(r)}`); }
      }
    }
  } finally {
    await browser.close();
    if (serverProc) serverProc.kill();
  }
  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('测试异常:', e); process.exit(1); });
