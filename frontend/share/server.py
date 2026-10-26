"""Python 3 fallback for macOS/Linux; serves only the packaged www folder."""
import argparse,http.server,json,threading,webbrowser
from pathlib import Path
from urllib.parse import unquote,urlsplit
from urllib.request import urlopen
ROOT=Path(__file__).resolve().parent
WEB=(ROOT/'www').resolve()
INFO=json.loads((ROOT/'package-info.json').read_text(encoding='utf-8'))
ROUTES={'/','/bedroom','/party','/custom','/studio','/parse'}
class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map={**http.server.SimpleHTTPRequestHandler.extensions_map,'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.glb':'model/gltf-binary'}
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(WEB),**kw)
    def list_directory(self,path):self.send_error(404);return None
    def end_headers(self):self.send_header('Cache-Control','no-cache');self.send_header('X-Content-Type-Options','nosniff');super().end_headers()
    def send_head(self):
        if self.headers.get('Host') not in [f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}']:self.send_error(403);return None
        raw=unquote(urlsplit(self.path).path)
        if '\\' in raw or ':' in raw or '\0' in raw or any(p.startswith('.') for p in raw.split('/') if p):self.send_error(404);return None
        if raw=='/__jyxj_health':
            import io
            body=json.dumps({'app':'jyxj-share','packageId':INFO['packageId']}).encode()
            self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.end_headers();return io.BytesIO(body)
        if raw in ROUTES:self.path='/index.html'
        target=Path(self.translate_path(self.path)).resolve()
        try:target.relative_to(WEB)
        except ValueError:self.send_error(404);return None
        if not target.is_file():self.send_error(404);return None
        return super().send_head()
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=5266);p.add_argument('--no-open',action='store_true');a=p.parse_args()
    if not 1024<=a.port<=65525:raise SystemExit('Port must be between 1024 and 65525')
    server=None
    for port in range(a.port,a.port+11):
        try:server=http.server.ThreadingHTTPServer(('127.0.0.1',port),Handler);break
        except OSError:
            try:
                with urlopen(f'http://127.0.0.1:{port}/__jyxj_health',timeout=.7) as r:same=json.load(r).get('packageId')==INFO['packageId']
            except Exception:same=False
            if same:
                url=f'http://127.0.0.1:{port}/';print('This demo is already running: '+url)
                if not a.no_open:webbrowser.open(url)
                raise SystemExit(0)
    if server is None:raise SystemExit('No free local port; choose another --port')
    url=f'http://127.0.0.1:{server.server_port}/';print('家有新解: '+url,flush=True)
    if not a.no_open:threading.Timer(.5,lambda:webbrowser.open(url)).start()
    try:
        with server:server.serve_forever()
    except KeyboardInterrupt:pass
