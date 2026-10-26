// Transparency 100% -> 0% is opacity 0 -> 1 for the entire mask layer.
// The photo underneath never inherits this alpha and is never clipped.
export function maskLayerOpacity(progress) {
  return Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0;
}
export function furnitureMaskNumber(item,index=0) {
  return `主${String(item.primaryNumber||index+1).padStart(2,'0')}`;
}
export function maskLabelPosition(bbox,width,height) {
  const [x1,y1,x2,y2]=bbox;
  return {left:Math.min(92,Math.max(8,(x1+x2)/2/width*100)),top:Math.min(90,Math.max(10,(y1+y2)/2/height*100))};
}
