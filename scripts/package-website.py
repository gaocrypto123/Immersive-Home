"""Build a relocatable website ZIP, with an isolated Node runtime for Windows."""
import argparse,hashlib,json,os,shutil,subprocess,sys,uuid,zipfile
from pathlib import Path
from datetime import datetime,timezone,timedelta

ROOT=Path(__file__).resolve().parents[1]
FRONT=ROOT/'frontend'
SHA=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()

README='''家有新解 · 网站分享包

Windows 10/11 x64：
1. 把整个 ZIP 解压到普通文件夹，不要在 ZIP 内直接运行。
2. 双击“启动网站.cmd”。已内置 Node，无需另外安装开发依赖、Python 或 Blender。
3. 浏览器会自动打开首页，默认 http://127.0.0.1:5266/ 。如果端口被占用，会自动选择后面的空闲端口，以启动窗口显示的地址为准。
4. 保持启动窗口开启；结束时按 Ctrl+C 或关闭该窗口。同一分享包重复启动会复用已有服务。
不要直接打开 www/index.html：网页模块与模型通过本机服务加载。

Mac / Linux：
已安装 Node 18+ 或 Python 3.9+ 时，在包目录运行：
  sh ./启动网站.command
也可直接运行 node server.mjs 或 python3 server.py。
runtime/node.exe 是 Windows x64 专用程序。

包含内容：
- 最新首页：只保留“自定义场景”入口，已移除首页卧室预设及独立平面图解析入口。
- 自定义页从上到下显示三个步骤：平面图解析、参考图解析、最终布局生成。
- 平面图解析：三张示例平面图，卡片展开与拖放、尺寸定标、轮廓描摹、门窗解析与3D空房升墙动画；默认房高2.8m，可暂停、回看和重播。
- 参考图步骤：本地上传、预览、移除；识别服务明确标注“待接入”。
- 最终布局步骤：显示当前空房与参考图输入状态，生成服务明确标注“待接入”，不提前显示生成结果。
- 既有卧室、聚会、三维工作台及P04/P03模型页面与资源保留，首页不再列为预设入口。旧/parse地址兼容新三步骤页。

演示范围：
平面图标注位置、轮廓和门窗采用人工校对的示例数据，比例尺及实际二维/三维几何由本机计算，并非实时OCR或任意上传户型识别。第三张图的前墙位置是假设；房高默认2.8m，尺寸为估算。参考图识别及最终布局生成服务尚未接入。旧示例的家具、价格、尺寸与活动通路均为演示数据。Blender重算和Python建模工作流不在本网站分享包内。

个人数据：
本包不包含 .env、密钥、Git 历史、开发缓存、日志、你的浏览器保存记录或上传文件。对方的方案保存在对方自己的浏览器。需要分享某个编辑方案时，请在网页里导出 JSON，让对方导入。自定义文件只在当前页面会话中预览，不会由此服务上传到外部。

文件说明：
www/：完整生产网页与本地素材，可由支持 SPA 回退的静态服务器托管。
runtime/：Windows x64 Node 运行程序及其许可证。
server.mjs / server.py：只监听 127.0.0.1 的本机启动服务。
licenses/：前端第三方依赖许可证。
THIRD_PARTY_NOTICES.txt：原素材与项目的来源说明。
manifest.json：逐文件 SHA-256 清单。
verify-package.py：可选；有 Python 时运行 python verify-package.py 校验包内文件。

默认端口也可以显式指定：
  runtime\\node.exe server.mjs --port 5288
浏览器地址随端口变化；浏览器本地保存的数据按地址区分。
'''

VERIFY='''import hashlib,json,sys
from pathlib import Path
r=Path(__file__).resolve().parent
m=json.loads((r/'manifest.json').read_text(encoding='utf-8'))
bad=[]
for name,expected in m['files'].items():
 p=(r/name).resolve()
 try:p.relative_to(r)
 except ValueError:bad.append(name);continue
 if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=expected:bad.append(name)
print('FAILED: '+str(bad) if bad else 'OK: '+str(len(m['files']))+' packaged files match SHA-256.')
sys.exit(bool(bad))
'''

def main():
    p=argparse.ArgumentParser();p.add_argument('--output-dir',type=Path,default=ROOT.parent/'分享包');p.add_argument('--skip-build',action='store_true');p.add_argument('--node',type=Path,help='Licensed Windows x64 Node executable');a=p.parse_args()
    stamp=datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=8))).strftime('%Y%m%d-%H%M%S')
    output=a.output_dir.resolve();output.mkdir(parents=True,exist_ok=True)
    package_id='jia-you-xin-jie-web-'+stamp+'-'+uuid.uuid4().hex[:6]
    stage=output/package_id;stage.mkdir()
    executable=(a.node or Path(shutil.which('node') or '')).resolve()
    if not executable.is_file():raise SystemExit('Node executable not found')
    if subprocess.check_output([str(executable),'-p','process.platform+"/"+process.arch'],text=True).strip()!='win32/x64':raise SystemExit('Windows x64 Node runtime required')
    if not a.skip_build:
        env={**os.environ,'VITE_SHARE_MODE':'1','PYTHONUTF8':'1'}
        subprocess.run([str(executable),str(FRONT/'scripts/sync-assets.mjs')],cwd=FRONT,env=env,check=True)
        subprocess.run([str(executable),str(FRONT/'node_modules/vite/bin/vite.js'),'build'],cwd=FRONT,env=env,check=True)
    dist=FRONT/'dist'
    if not (dist/'index.html').is_file():raise SystemExit('Build output is missing.')
    for source in dist.rglob('*'):
        if source.is_symlink():raise ValueError('Symlink in build output: '+str(source.relative_to(dist)))
        if source.is_file() and (source.name.startswith('.') or source.suffix in {'.key','.pem','.p12','.log'}):raise ValueError('Unexpected private file in build output.')
    shutil.copytree(dist,stage/'www')
    runtime=stage/'runtime';runtime.mkdir()
    license_file=executable.parent/'LICENSE'
    if not license_file.is_file():raise SystemExit('Node LICENSE not found next to executable')
    shutil.copy2(executable,runtime/'node.exe');shutil.copy2(license_file,runtime/'LICENSE-node.txt')
    version=subprocess.check_output([str(executable),'--version'],text=True).strip()
    (runtime/'VERSION.txt').write_text(version+'\nWindows x64\n',encoding='utf-8')
    for name in ['server.mjs','server.py']:shutil.copy2(FRONT/'share'/name,stage/name)
    (stage/'启动网站.cmd').write_bytes(('@echo off\r\nsetlocal\r\nchcp 65001 >nul\r\ncd /d "%~dp0"\r\n"%~dp0runtime\\node.exe" "%~dp0server.mjs" %*\r\nif errorlevel 1 pause\r\n').encode('ascii'))
    (stage/'启动网站.command').write_text('#!/bin/sh\ncd "$(dirname "$0")" || exit 1\nif command -v node >/dev/null 2>&1; then\n  exec node server.mjs "$@"\nelif command -v python3 >/dev/null 2>&1; then\n  exec python3 server.py "$@"\nelse\n  echo "Install Node 18+ or Python 3.9+ first. Windows users: run the .cmd launcher."\n  exit 1\nfi\n',encoding='utf-8',newline='\n')
    (stage/'使用说明.txt').write_text(README,encoding='utf-8-sig')
    (stage/'verify-package.py').write_text(VERIFY,encoding='utf-8')
    shutil.copy2(ROOT/'THIRD_PARTY_NOTICES.txt',stage/'THIRD_PARTY_NOTICES.txt')
    licenses=stage/'licenses';licenses.mkdir()
    for name in ['react','react-dom','three','lucide-react']:
        shutil.copy2(FRONT/'node_modules'/name/'LICENSE',licenses/(name+'-LICENSE.txt'))
    info={'format':1,'app':'家有新解','packageId':package_id,'createdAtBeijing':datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=8))).isoformat(),'runtime':{'nodeVersion':version,'platform':'Windows x64'},'entryPort':5266,'loopbackOnly':True,'websiteIndexSha256':SHA(stage/'www/index.html'),'scope':['首页单一自定义入口','平面图解析与3D空房','参考图本地上传预览','最终布局空状态（生成待接入）','保留既有演示路由与素材'],'sourceCredentialsIncluded':False}
    (stage/'package-info.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf-8')
    files={str(f.relative_to(stage)).replace('\\','/'):SHA(f) for f in sorted(stage.rglob('*')) if f.is_file()}
    (stage/'manifest.json').write_text(json.dumps({'format':1,'packageId':package_id,'algorithm':'SHA-256','files':files},ensure_ascii=False,indent=2),encoding='utf-8')
    archive=output/('家有新解-网站分享包-'+stamp+'.zip')
    with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for f in sorted(stage.rglob('*')):
            if not f.is_file():continue
            name=package_id+'/'+str(f.relative_to(stage)).replace('\\','/')
            entry=zipfile.ZipInfo.from_file(f,name)
            if f.suffix=='.command':entry.create_system=3;entry.external_attr=(0o100755<<16)
            entry.compress_type=zipfile.ZIP_DEFLATED
            z.writestr(entry,f.read_bytes(),compresslevel=6)
    result={'packageId':package_id,'folder':str(stage),'archive':str(archive),'bytes':archive.stat().st_size,'sha256':SHA(archive),'manifestFileCount':len(files)}
    (output/(archive.stem+'.sha256.txt')).write_text(result['sha256']+'  '+archive.name+'\n',encoding='utf-8')
    record=ROOT/'artifacts'/'website-share-latest.json';record.parent.mkdir(exist_ok=True)
    record.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
