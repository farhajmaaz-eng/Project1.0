/* Generates Tessera PNG icons (192/512) — four rounded tiles, iris dot.
   Pure node: raw RGBA buffer -> zlib -> PNG chunks. */
import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(width, height, rgba) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0); ihdr.writeUInt32BE(height,4);
  ihdr[8]=8; ihdr[9]=6; // 8-bit RGBA
  const stride = width*4;
  const raw = Buffer.alloc((stride+1)*height);
  for (let y=0;y<height;y++) rgba.copy(raw, y*(stride+1)+1, y*stride, (y+1)*stride);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// signed distance for rounded rect
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px-cx)-hw+r, qy = Math.abs(py-cy)-hh+r;
  return Math.min(Math.max(qx,qy),0) + Math.hypot(Math.max(qx,0), Math.max(qy,0)) - r;
}
const cov = (d) => Math.max(0, Math.min(1, 0.5 - d));

function draw(size) {
  const img = Buffer.alloc(size*size*4);
  const s = size/32;
  const tiles = [
    [3,3,12,12,3.5,'#E4E0D1',0.55],
    [17,3,12,12,3.5,'#E4E0D1',0.75],
    [3,17,12,12,3.5,'#E4E0D1',0.35],
  ];
  for (let y=0;y<size;y++){
    for (let x=0;x<size;x++){
      const px=(x+0.5)/s, py=(y+0.5)/s;
      let r=0,g=0,b=0,a=0;
      // background: dark rounded square, full-bleed for maskable safety
      const bgD = sdRoundRect(px,py,16,16,15.2,15.2,7.5);
      const bgA = cov(bgD-0.4);
      if (bgA>0){ r=0x14;g=0x20;b=0x1B;a=bgA; }
      for (const [tx,ty,tw,th,tr,col,op] of tiles){
        const d = sdRoundRect(px,py,tx+tw/2,ty+th/2,tw/2,tr);
        const ca = cov(d)*op*a;
        if (ca>0){
          const cr=parseInt(col.slice(1,3),16), cg=parseInt(col.slice(3,5),16), cb=parseInt(col.slice(5,7),16);
          r = r*(1-ca)+cr*ca; g = g*(1-ca)+cg*ca; b = b*(1-ca)+cb*ca; a = Math.max(a, ca);
        }
      }
      // iris circle tile
      const cd = Math.hypot(px-23,py-23)-6;
      const ca = cov(cd)*a;
      if (ca>0){ r=r*(1-ca)+0xC1*ca; g=g*(1-ca)+0x73*ca; b=b*(1-ca)+0x38*ca; a=Math.max(a,ca); }
      const i=(y*size+x)*4;
      img[i]=Math.round(r); img[i+1]=Math.round(g); img[i+2]=Math.round(b); img[i+3]=Math.round(a*255);
    }
  }
  return png(size,size,img);
}

mkdirSync('/root/Project1.0/icons', {recursive:true});
writeFileSync('/root/Project1.0/icons/icon-192.png', draw(192));
writeFileSync('/root/Project1.0/icons/icon-512.png', draw(512));
console.log('icons written');
