// Explicit, hash-checked export of existing results. No model calls or source edits.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const project = path.resolve(__dirname, '..');
const source = path.resolve(process.argv[2] || path.join(project, '..', '02-参考图解析'));
const output = path.join(project, 'data/reference-pipeline/v1');
const sam = path.join(source, 'SAM3-全物件分割-20261025');
const plans = path.join(source, '平面图-20261025');
const products = JSON.parse(fs.readFileSync(path.join(sam, '白底单品图-imagegen-20261025/generation-progress.json'), 'utf8'));
const productById = new Map(products.objects.map(item => [item.id, item]));
const styles = ['原木清新','奶油法式','现代极简','意式轻奢','日式侘寂','北欧复古'];
const files = new Set();
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function copy(from, relative, expectedHash) {
  if (!path.resolve(from).startsWith(source + path.sep) || relative.split(/[\\/]/).includes('..') || !/\.(png|jpg|json)$/.test(relative)) throw Error('Asset outside approved source boundary');
  if (expectedHash && hash(from) !== expectedHash.toLowerCase()) throw Error('Source hash mismatch: ' + path.basename(from));
  const target = path.join(output, relative);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.copyFileSync(from, target); files.add(relative);
  return '/assets/reference-pipeline/v1/' + relative;
}
function write(relative, data) {
  fs.mkdirSync(path.dirname(path.join(output, relative)), {recursive: true});
  fs.writeFileSync(path.join(output, relative), JSON.stringify(data, null, 2) + '\n'); files.add(relative);
}
const cases = [];
for (let index = 0; index < styles.length; index++) {
  const id = 'L0' + (index + 1), style = styles[index];
  const sourceFile = path.join(source, `${index + 1}-${style}.png`);
  const data = JSON.parse(fs.readFileSync(path.join(sam, id, 'instances.json'), 'utf8'));
  if (hash(sourceFile) !== data.source.sha256) throw Error('Room photo differs from SAM3 input: ' + id);
  const candidates = fs.readdirSync(plans).filter(name => new RegExp(`^${index + 1}-${style}-平面图(-v\\d+)?\\.png$`).test(name));
  candidates.sort((a,b) => Number(b.match(/-v(\d+)/)?.[1] || 1) - Number(a.match(/-v(\d+)/)?.[1] || 1));
  const planFile = candidates[0];
  const furniture = data.objects.filter(item => item.group === 'furniture' && !item.is_part).map(item => {
    const product = productById.get(item.id);
    let white = null;
    if (product?.status === 'completed') {
      const relative = `${id}/products/${item.id}.png`, current = path.join(sam, product.image), pinned = path.join(output, relative);
      if (hash(current) === product.sha256) white = copy(current, relative, product.sha256);
      else if (fs.existsSync(pinned) && hash(pinned) === product.sha256) {
        files.add(relative); white = '/assets/reference-pipeline/v1/' + relative;
        console.log('Using previously verified product snapshot: ' + item.id);
      } else console.log('Product awaits matching generation record: ' + item.id);
    }
    return {
      id: item.id, label: item.label, category: item.key,
      bbox: item.bbox_xyxy_px, score: item.score, qualityFlags: item.quality_flags || [],
      mask: copy(path.join(sam, id, item.mask), `${id}/masks/${item.id}.png`, item.mask_sha256),
      cutout: copy(path.join(sam, id, item.cutout), `${id}/cutouts/${item.id}.png`),
      product: white, productInference: !!white, model: null,
    };
  });
  let layout = null;
  const graphFile = path.join(plans, `${index + 1}-${style}-中心点Graph.json`);
  if (fs.existsSync(graphFile)) {
    const graph = JSON.parse(fs.readFileSync(graphFile, 'utf8'));
    const png = fs.readFileSync(path.join(plans, planFile));
    if (png.readUInt32BE(16) !== graph.coordinateSystem.width || png.readUInt32BE(20) !== graph.coordinateSystem.height) throw Error('Plan annotations use a different raster size: ' + id);
    layout = {width: graph.coordinateSystem.width, height: graph.coordinateSystem.height,
      nodes: graph.nodes.map(({id,name,category,color,bbox,x,y}) => ({id,name,category,color,bbox,x,y})),
      edges: graph.edges.map(({source,target,distance}) => ({source,target,distance})),
      method: '人工位置标注 / 家具中心点最小生成树', unit: 'px'};
  }
  const result = {
    schema: 'jyxj.reference-parallel-demo.v1', id, style,
    source: {url: `/assets/reference-sources/${id}.png`, sha256: data.source.sha256, width: data.source.size_px[0], height: data.source.size_px[1]},
    mode: 'saved-results',
    plan: {image: copy(path.join(plans, planFile), `${id}/plan.png`), revision: planFile.match(/-v(\d+)/)?.[1] || '1', note: '已有 imagegen 平面示意，使用统一估算房间底图适配；家具尺寸及遮挡部分为推定。'},
    layout,
    segmentation: {image: copy(path.join(sam, id, '全物件叠加.jpg'), `${id}/segmentation.jpg`), totalObjects: data.objects.length, note: '已有 SAM 3 实例分割，含主体合并与技术细修；人工验收待确认。'},
    furniture,
    modelService: 'not-connected',
  };
  write(`${id}/case.json`, result);
  cases.push({id, style, furnitureCount: furniture.length, sourceSha256: data.source.sha256});
}
write('index.json', {schema: 'jyxj.reference-parallel-assets.v1', cases, files: [...files].concat('index.json').sort()});
require('./refresh-reference-graphs.cjs').refreshReferenceGraphs({project,source});
require('./import-reference-models.cjs').importReferenceModels({project,source});
console.log(JSON.stringify({cases: cases.length, furniture: cases.reduce((n,c) => n + c.furnitureCount, 0), files: JSON.parse(fs.readFileSync(path.join(output,'index.json'),'utf8')).files.length, output}));
