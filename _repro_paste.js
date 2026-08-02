// 复现：Visual/选择状态下按 p 粘贴
const { chromium } = require('playwright');

const TEST_SCRIPT = () => {
  const results = [];
  const dispatchKey = (key) => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  };

  // 场景1：Visual 模式 y 复制 → 移动光标 → p 粘贴
  initGrid();
  grid[0][1]='A'; grid[0][2]='B';
  renderGrid();
  isVisual=true;
  selStart={r:0,c:1,dispCol:1}; selEnd={r:0,c:2,dispCol:2};
  updateSelection();
  dispatchKey('y');
  const afterY = { clipboard: clipboard && clipboard[0], isVisual };
  cursorR=2; cursorC=2;
  dispatchKey('p');
  results.push({
    name: '场景1 y复制后p粘贴',
    afterY,
    g22: grid[2][2], g23: grid[2][3],
    ok: grid[2][2]==='A' && grid[2][3]==='B',
  });

  // 场景2：Visual 模式直接 p（clipboard 预设）
  initGrid();
  renderGrid();
  clipboard=[['X','Y']];
  cursorR=1; cursorC=1;
  isVisual=true;
  selStart={r:1,c:1,dispCol:1}; selEnd={r:1,c:1,dispCol:1};
  updateSelection();
  dispatchKey('p');
  results.push({
    name: '场景2 Visual直接p',
    g11: grid[1][1], g12: grid[1][2],
    ok: grid[1][1]==='X' && grid[1][2]==='Y',
  });

  // 场景3：普通模式有选区（非Visual）p
  initGrid();
  renderGrid();
  clipboard=[['M','N']];
  cursorR=3; cursorC=3;
  isVisual=false;
  selStart={r:0,c:0,dispCol:0}; selEnd={r:0,c:1,dispCol:1};  // 有选区但非Visual
  updateSelection();
  dispatchKey('p');
  results.push({
    name: '场景3 普通模式有选区p',
    g33: grid[3][3], g34: grid[3][4],
    ok: grid[3][3]==='M' && grid[3][4]==='N',
  });

  return results;
};

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:8000/ascii-editor.html');
    await page.waitForSelector('#canvas .cell', { timeout: 5000 });
    const out = await page.evaluate(TEST_SCRIPT);
    console.log(JSON.stringify(out, null, 1));
  } finally {
    await browser.close();
  }
})();
