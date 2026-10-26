import {validateUpload} from './custom-brief.js';
export function validateReferenceSelection(files) {
  if(files.length>1)return '一次只能解析一张参考图，请只选择或拖入一张图片。';
  return files.length ? validateUpload(files[0]) : '';
}
