import optimized from './image-assets.generated.js';

// One switch restores all original URLs. Originals remain untouched and served.
export const USE_OPTIMIZED_IMAGES=true;
export function imageAsset(url,{exact=false,thumbnail=false}={}) {
  if(!USE_OPTIMIZED_IMAGES||typeof url!=='string')return url;
  const parts=/^([^?#]+)(.*)$/.exec(url),entry=parts&&optimized[parts[1]];
  if(!entry||(exact&&!entry.lossless))return url;
  return (thumbnail&&!exact&&entry.thumbnail?entry.thumbnail:entry.url)+parts[2];
}
