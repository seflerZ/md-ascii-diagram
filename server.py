"""
ASCII 编辑器 HTTP 服务器
- 静态文件服务（提供编辑器 HTML）
- GET /?file=<path>  读取 Markdown 文件
- POST /save         将编辑后的图写回 Markdown 文件（支持 index 定位）

用法：
  python server.py [端口]
  默认端口 8000
"""

import http.server
import urllib.parse
import json
import re
import sys, os, subprocess, shutil, threading, time, uuid

def find_all_diagrams(md):
    """返回 Markdown 中所有 ASCII 图的位置列表（按出现顺序）。
    每项: {type, name, start, end}
    - type: 'comment' 注释块、'code' 代码块
    - name: 注释块有名字，代码块为 None
    """
    diagrams = []
    # 1. 注释块  <!--diagram NAME...-->
    for m in re.finditer(r'<!--\s*diagram\s+(\S+)\s*\n[\s\S]*?-->', md):
        diagrams.append({'type': 'comment', 'name': m.group(1), 'start': m.start(), 'end': m.end()})
    # 2. 代码块 ```...``` 含框线字符
    for m in re.finditer(r'```[^\n]*\n[\s\S]*?```', md):
        if re.search(r'[┌┐└┘├┤┬┴┼─│]', m.group()):
            diagrams.append({'type': 'code', 'name': None, 'start': m.start(), 'end': m.end()})
    diagrams.sort(key=lambda d: d['start'])
    return diagrams

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

# 自定义形状库（贴纸），与 server.py 同目录
SHAPES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shapes.json')
SHAPES_DEFAULT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shapes.default.json')

# ---------- 美化任务队列（异步长任务） ----------
# 任务: {id, status: queued|running|done|error, stage, pct, png, output, stdout, stderr, error}
BEAUTIFY_TASKS = {}
BEAUTIFY_LOCK = threading.Lock()

def _beautify_worker(task_id, filepath, name, content, style, prompt=None):
    """后台线程：保存注释块 -> 渲染 PNG -> beautify.js 美化 -> 更新任务状态。"""
    def upd(**kw):
        with BEAUTIFY_LOCK:
            BEAUTIFY_TASKS[task_id].update(kw)
    try:
        upd(status='running', stage='save', pct=10)
        script_dir = os.path.dirname(os.path.abspath(__file__))

        # 1. 先把当前内容保存到文件（与 /generate 一致）
        with open(filepath, 'r', encoding='utf-8') as f:
            md = f.read()
        new_block = f'<!--diagram {name}\n{content}\n-->'
        pattern = r'(<!--\s*diagram\s+' + re.escape(name) + r'\s*\n)[\s\S]*?(-->)'
        if re.search(pattern, md):
            new_md = re.sub(pattern, lambda m: m.group(1) + content + '\n' + m.group(2), md)
        else:
            new_md = md.rstrip() + '\n\n' + new_block + '\n'
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_md)

        # 2. 渲染彩色 PNG（复用 render_color.js）
        upd(stage='render', pct=35)
        render_js = os.path.join(script_dir, 'render_color.js')
        file_dir = os.path.dirname(os.path.abspath(filepath))
        out_dir = os.path.join(file_dir, 'diagrams_out')
        render = subprocess.run(
            ['node', render_js, filepath, out_dir, '--only=' + name],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60, cwd=script_dir
        )
        if render.returncode != 0:
            raise RuntimeError('渲染失败: ' + (render.stderr or render.stdout))

        # 定位渲染出的 PNG
        png = os.path.join(out_dir, name + '.png')
        if not os.path.exists(png):
            cands = [f for f in os.listdir(out_dir) if f.startswith(name) and f.endswith('.png')] if os.path.isdir(out_dir) else []
            if not cands:
                raise RuntimeError('渲染后未找到 PNG: ' + png)
            png = os.path.join(out_dir, sorted(cands)[0])
        upd(png=png, stage='beautify', pct=65)

        # 3. 图生图美化（beautify.js，自动序号去重，从 OUTPUT: 行取实际路径）
        beautify_js = os.path.join(script_dir, 'beautify.js')
        beautify = subprocess.run(
            ['node', beautify_js, png, '--style=' + style] + (['--prompt-stdin'] if (prompt and prompt.strip()) else []),
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300, cwd=script_dir,
            input=prompt if (prompt and prompt.strip()) else None
        )

        out_png = None
        if beautify.returncode == 0:
            for line in beautify.stdout.splitlines():
                if line.startswith('OUTPUT:'):
                    out_png = line[len('OUTPUT:'):].strip()
            if not out_png:
                out_png = os.path.join(out_dir, name + '.beautified-' + style + '.png')
        upd(stage='done', pct=100, output=out_png, stdout=beautify.stdout, stderr=beautify.stderr,
            status='done' if out_png else 'error',
            error=None if out_png else ((beautify.stderr or '').strip() or 'beautify.js 未生成输出（请检查 API Key 与风格配置）'))

    except Exception as e:
        upd(status='error', stage='failed', error=str(e))

class Handler(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        # 所有响应统一加防缓存头：避免浏览器缓存旧版 ascii-editor.html / shapes.json
        # 导致改完代码后主人浏览器仍在用旧版（功能莫名失效）
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        if parsed.path == '/' and 'file' in params:
            filepath = params['file'][0]
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/markdown; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content.encode('utf-8'))
            except Exception as e:
                self.send_error(500, f'读取文件失败: {e}')
        elif parsed.path == '/shapes':
            # 读取自定义形状库（shapes.json）
            # 首次访问时，若 shapes.json 不存在，从 shapes.default.json 复制一份作为种子
            content = '{}'
            try:
                if not os.path.exists(SHAPES_FILE) and os.path.exists(SHAPES_DEFAULT):
                    shutil.copy2(SHAPES_DEFAULT, SHAPES_FILE)
                if os.path.exists(SHAPES_FILE):
                    with open(SHAPES_FILE, 'r', encoding='utf-8') as f:
                        content = f.read()
            except Exception:
                content = '{}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.end_headers()
            self.wfile.write(content.encode('utf-8'))
        elif parsed.path == '/fonts':
            # 读取字体配置（fonts.json），供编辑器动态填充字体下拉
            content = '{"fonts": []}'
            try:
                script_dir = os.path.dirname(os.path.abspath(__file__))
                fonts_file = os.path.join(script_dir, 'fonts.json')
                fonts_dir = os.path.join(script_dir, 'fonts')
                if os.path.exists(fonts_file):
                    cfg = json.load(open(fonts_file, encoding='utf-8'))
                    fonts = cfg.get('fonts', [])
                    # 只保留实际存在的字体文件，避免前端 @font-face 请求 404
                    for f in fonts:
                        if f.get('ttf') and not os.path.exists(os.path.join(fonts_dir, f['ttf'])):
                            f.pop('ttf', None)
                        if f.get('ttfBold') and not os.path.exists(os.path.join(fonts_dir, f['ttfBold'])):
                            f.pop('ttfBold', None)
                    content = json.dumps({'fonts': fonts}, ensure_ascii=False)
            except Exception:
                content = '{"fonts": []}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.end_headers()
            self.wfile.write(content.encode('utf-8'))
        elif parsed.path == '/beautify/styles':
            # 列出可用美化风格（styles/ 目录下含 style.json 的子目录）
            script_dir = os.path.dirname(os.path.abspath(__file__))
            styles_dir = os.path.join(script_dir, 'styles')
            styles = []
            if os.path.isdir(styles_dir):
                for dname in sorted(os.listdir(styles_dir)):
                    d = os.path.join(styles_dir, dname)
                    if os.path.isdir(d) and os.path.exists(os.path.join(d, 'style.json')):
                        styles.append(dname)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'styles': styles}).encode('utf-8'))
        elif parsed.path == '/beautify/check':
            # 预检：检查 AI 美化后端配置是否就绪（provider/model/base-url/api-key）
            # 与 beautify.js 的环境变量读取逻辑保持一致
            provider = os.environ.get('BEAUTIFY_PROVIDER', 'openai')
            model = os.environ.get('BEAUTIFY_MODEL', 'gpt-image-2')
            default_base = 'https://www.yuntts.com/api/v1' if provider == 'yuntts' else 'https://api.openai.com/v1'
            base_url = os.environ.get('BEAUTIFY_BASE_URL', default_base)
            api_key = os.environ.get('BEAUTIFY_API_KEY') or os.environ.get('OPENAI_API_KEY')

            has_key = bool(api_key)
            has_base = bool(base_url)
            has_model = bool(model)
            has_provider = bool(provider)

            issues = []
            if not has_key:
                issues.append('缺少 API Key（需设置 BEAUTIFY_API_KEY 或 OPENAI_API_KEY）')
            if not has_base:
                issues.append('缺少 Base URL（需设置 BEAUTIFY_BASE_URL）')
            if not has_model:
                issues.append('缺少 Model（需设置 BEAUTIFY_MODEL）')
            if provider not in ('openai', 'yuntts'):
                issues.append('未知 Provider：%s（应为 openai 或 yuntts）' % provider)

            ready = has_key and has_base and has_model and provider in ('openai', 'yuntts')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'ready': ready,
                'has_api_key': has_key,
                'provider': provider,
                'model': model,
                'base_url': base_url,
                'issues': issues,
            }).encode('utf-8'))
        elif parsed.path == '/beautify/status':
            # 轮询任务状态（GET）
            task_id = (params.get('id') or [''])[0]
            with BEAUTIFY_LOCK:
                task = dict(BEAUTIFY_TASKS.get(task_id, {}))
            if not task:
                task = {'status': 'notfound'}
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(task).encode('utf-8'))
        elif parsed.path == '/beautify/file':
            # 按绝对路径返回图片/文件（美化结果预览，路径在文档目录下，不在 server 根目录内）
            fp = (params.get('path') or [''])[0]
            if not fp:
                self.send_error(400, '缺少 path 参数')
                return
            try:
                with open(fp, 'rb') as f:
                    data = f.read()
                ext = os.path.splitext(fp)[1].lower()
                ctype = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif', 'webp': 'image/webp'}.get(ext.lstrip('.'), 'application/octet-stream')
                self.send_response(200)
                self.send_header('Content-Type', ctype)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                self.send_error(404, '文件不存在: %s' % e)
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/shapes':
            # 保存自定义形状库（shapes.json）
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            try:
                shapes = json.loads(body)
                with open(SHAPES_FILE, 'w', encoding='utf-8') as f:
                    json.dump(shapes, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True}).encode('utf-8'))
            except Exception as e:
                self.send_error(500, f'shapes 保存失败: {e}')
        elif self.path == '/save':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            data = json.loads(body)
            filepath = data.get('file')
            name = data.get('name')
            content = data.get('content')
            index = data.get('index')
            if not filepath or not name:
                self.send_error(400, '缺少 file 或 name 参数')
                return
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    md = f.read()

                new_block = f'<!--diagram {name}\n{content}\n-->'
                new_md = None

                # 1. 如果带了 index，按位置替换，保持原格式
                if index is not None:
                    diagrams = find_all_diagrams(md)
                    if 0 <= index < len(diagrams):
                        d = diagrams[index]
                        if d['type'] == 'code':
                            # 原代码块 → 保存为代码块格式
                            new_block = f'```\n{content}\n```'
                        else:
                            # 原注释块 → 保存为注释格式
                            new_block = f'<!--diagram {name}\n{content}\n-->'
                        new_md = md[:d['start']] + new_block + md[d['end']:]
                    # index 无效 → fallthrough 到下方 fallback

                # 2. 按 name 匹配注释块替换
                if new_md is None:
                    pattern = r'(<!--\s*diagram\s+' + re.escape(name) + r'\s*\n)[\s\S]*?(-->)'
                    if re.search(pattern, md):
                        new_md = re.sub(pattern, lambda m: m.group(1) + content + '\n' + m.group(2), md)

                # 3. Fallback：追加到文档末尾
                if new_md is None:
                    new_md = md.rstrip() + '\n\n' + new_block + '\n'

                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_md)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True}).encode('utf-8'))
            except Exception as e:
                self.send_error(500, f'保存失败: {e}')
        elif self.path == '/generate':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            data = json.loads(body)
            filepath = data.get('file')
            name = data.get('name')
            content = data.get('content')
            if not filepath or not name:
                self.send_error(400, '缺少 file 或 name 参数')
                return
            try:
                # 1. 先把当前内容保存到文件
                with open(filepath, 'r', encoding='utf-8') as f:
                    md = f.read()
                new_block = f'<!--diagram {name}\n{content}\n-->'
                pattern = r'(<!--\s*diagram\s+' + re.escape(name) + r'\s*\n)[\s\S]*?(-->)'
                if re.search(pattern, md):
                    new_md = re.sub(pattern, lambda m: m.group(1) + content + '\n' + m.group(2), md)
                else:
                    new_md = md.rstrip() + '\n\n' + new_block + '\n'
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_md)

                # 2. 运行 render_color.js 生成 PNG
                script_dir = os.path.dirname(os.path.abspath(__file__))
                render_js = os.path.join(script_dir, 'render_color.js')
                file_dir = os.path.dirname(os.path.abspath(filepath))
                out_dir = os.path.join(file_dir, 'diagrams_out')
                result = subprocess.run(
                    ['node', render_js, filepath, out_dir, '--only=' + name],
                    capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60,
                    cwd=script_dir
                )
                ok = result.returncode == 0
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                resp = {'ok': ok, 'output': result.stdout, 'error': result.stderr if result.stderr else None}
                self.wfile.write(json.dumps(resp).encode('utf-8'))
            except Exception as e:
                self.send_error(500, f'生成失败: {e}')
        elif self.path == '/beautify/start':
            # 启动异步美化任务，立即返回 task_id，后台线程执行
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            data = json.loads(body)
            filepath = data.get('file')
            name = data.get('name')
            content = data.get('content')
            style = data.get('style', 'black-metal')
            prompt = data.get('prompt')  # 可选：用户编辑后的风格提示词（每行一条），为空则 beautify.js 用默认
            if not filepath or not name:
                self.send_error(400, '缺少 file 或 name 参数')
                return
            task_id = uuid.uuid4().hex[:12]
            with BEAUTIFY_LOCK:
                BEAUTIFY_TASKS[task_id] = {'id': task_id, 'status': 'queued', 'stage': 'queued', 'pct': 0}
            t = threading.Thread(target=_beautify_worker, args=(task_id, filepath, name, content, style, prompt), daemon=True)
            t.start()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'task_id': task_id}).encode('utf-8'))

        elif self.path == '/beautify/insert':
            # 用户确认后：把美化图引用写入文档（![](...)）
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            data = json.loads(body)
            filepath = data.get('file')
            name = data.get('name')
            output = data.get('output')
            if not filepath or not name or not output:
                self.send_error(400, '缺少 file/name/output 参数')
                return
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    md_now = f.read()
                file_dir = os.path.dirname(os.path.abspath(filepath))
                rel_beautified = os.path.relpath(output, file_dir).replace('\\', '/')
                md_img_beautified = f'![{name}]({rel_beautified})'
                img_re = re.compile(r'!\[%s\]\([^)]*\)' % re.escape(name))
                md_now, cnt = img_re.subn(lambda m: md_img_beautified, md_now)
                if cnt == 0:
                    md_now = md_now.rstrip() + '\n\n' + md_img_beautified + '\n'
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(md_now)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True}).encode('utf-8'))
            except Exception as e:
                self.send_error(500, f'插入失败: {e}')
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == '__main__':
    server = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    print(f'ASCII 编辑器服务器启动: http://localhost:{PORT}')
    print(f'打开编辑器: http://localhost:{PORT}/ascii-editor.html?file=文档路径')
    server.serve_forever()
