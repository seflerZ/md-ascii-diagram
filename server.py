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
import sys


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


class Handler(http.server.SimpleHTTPRequestHandler):

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
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/save':
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
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


if __name__ == '__main__':
    server = http.server.HTTPServer(('0.0.0.0', PORT), Handler)
    print(f'ASCII 编辑器服务器启动: http://localhost:{PORT}')
    print(f'打开编辑器: http://localhost:{PORT}/ascii-editor.html?file=文档路径')
    server.serve_forever()
