import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {encodeGif,rgbaToIndexed,MAX_DIMENSION,MAX_FRAMES} from '../public/vetogram-v9-gif-core.js';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const frame=(w,h,seed)=>{
  const data=new Uint8Array(w*h*4);
  for(let i=0;i<w*h;i++){
    data[i*4]=(i*3+seed*29)%256;
    data[i*4+1]=(i*7+seed*17)%256;
    data[i*4+2]=(i*11+seed*19)%256;
    data[i*4+3]=255;
  }
  return data;
};
test('GIF89a exports real multi-frame binary with a loop extension',()=>{
  const bytes=encodeGif({width:16,height:16,frames:[frame(16,16,1),frame(16,16,2),frame(16,16,3)],delayCs:10});
  assert.equal(Buffer.from(bytes.subarray(0,6)).toString(),'GIF89a');
  assert.equal(bytes[6],16);assert.equal(bytes[8],16);
  assert.ok(Buffer.from(bytes).includes(Buffer.from('NETSCAPE2.0')));
  assert.equal(bytes.at(-1),0x3b);
  assert.ok(bytes.length>800);
});
test('GIF encoder rejects malformed, excessive or empty user input',()=>{
  assert.equal(MAX_DIMENSION,320);assert.equal(MAX_FRAMES,24);
  assert.throws(()=>encodeGif({width:321,height:1,frames:[frame(1,1,1),frame(1,1,2)]}),RangeError);
  assert.throws(()=>encodeGif({width:1,height:1,frames:[frame(1,1,1)]}),RangeError);
  assert.throws(()=>encodeGif({width:2,height:2,frames:[frame(1,1,1),frame(2,2,2)]}),TypeError);
  assert.throws(()=>encodeGif({width:2,height:2,frames:[frame(2,2,1),frame(2,2,2)],delayCs:1}),RangeError);
});
test('transparent pixels are composited, not advertised as unsupported alpha',()=>{
  const indexed=rgbaToIndexed(Uint8Array.from([255,255,255,0,255,255,255,255]));
  assert.notEqual(indexed[0],indexed[1]);
});
test('GIF can encode twelve 256px frames within a bounded output',()=>{
  const w=256,h=256,frames=Array.from({length:12},(_,i)=>frame(w,h,i));
  const bytes=encodeGif({width:w,height:h,frames,delayCs:10});
  assert.ok(bytes.length>1024);assert.ok(bytes.length<8*1024*1024);
});
test('Creator screen mounts real offline GIF controls and module once',()=>{
  const html=read('studio.html');
  for(const id of ['v9GifCanvas','v9GifInput','v9GifUpload','v9GifExport','v9GifStatus','v9GifCaption','v9GifToStickers']){
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  }
  assert.equal((html.match(/src="\/vetogram-v9-gif-maker\.js/g)||[]).length,1);
  assert.match(html,/type="module" src="\/vetogram-v9-gif-maker\.js/);
  assert.match(html,/href="\/vetogram-v9-gif-maker\.css/);
});
test('Maker uses only local image data and a real downloadable GIF, not a Telegram sticker claim',()=>{
  const js=read('vetogram-v9-gif-maker.js');
  assert.match(js,/import \{encodeGif\}/);
  assert.match(js,/new Blob\(\[bytes\],\{type:'image\/gif'\}\)/);
  assert.match(js,/a\.download='vetogram-motion\.gif'/);
  assert.match(js,/URL\.revokeObjectURL/);
  assert.match(js,/image\/png','image\/jpeg','image\/webp/);
  assert.match(js,/GIF в пакет напрямую не отправляется/);
  assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|navigator\.sendBeacon/);
});
test('Maker controls are responsive, keyboard-visible, monochrome and reduced-motion safe',()=>{
  const css=read('vetogram-v9-gif-maker.css');
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/focus-visible/);
  assert.match(css,/max-width:650px/);
  assert.match(css,/data-universe-theme="pearl"/);
  assert.doesNotMatch(css,/#(?:7b66ff|5369ff|4f46e5)/i);
  assert.match(read('vetogram-v9-gif-maker.js'),/reduced\?\.matches/);
});
