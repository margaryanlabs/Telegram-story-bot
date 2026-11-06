/* Vetogram GIF89a encoder: local-only, no external services or media rights bypass.
 * Inputs are opaque RGBA frames from a user-owned canvas, 256-colour 3-3-2 palette.
 */
'use strict';
export const MAX_DIMENSION=320;
export const MAX_FRAMES=24;
function validate(width,height,frames,delayCs){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>MAX_DIMENSION||height>MAX_DIMENSION)
    throw new RangeError('GIF: размер должен быть от 1 до 320 пикселей');
  if(!Array.isArray(frames)||frames.length<2||frames.length>MAX_FRAMES)
    throw new RangeError('GIF: требуется 2–24 кадра');
  if(!Number.isInteger(delayCs)||delayCs<2||delayCs>500)
    throw new RangeError('GIF: задержка кадра должна быть 2–500 сотых секунды');
  for(const frame of frames){
    if(!(frame instanceof Uint8Array)||frame.length!==width*height*4)
      throw new TypeError('GIF: каждый кадр должен содержать RGBA пиксели');
  }
}
export function rgbaToIndexed(rgba){
  const pixels=new Uint8Array(rgba.length/4);
  for(let i=0,j=0;i<rgba.length;i+=4,j++){
    // GIF cannot store smooth alpha: composite onto near-black first.
    const a=rgba[i+3]/255;
    const r=Math.round(rgba[i]*a+7*(1-a));
    const g=Math.round(rgba[i+1]*a+7*(1-a));
    const b=Math.round(rgba[i+2]*a+7*(1-a));
    pixels[j]=(r&0xe0)|((g&0xe0)>>3)|(b>>6);
  }
  return pixels;
}
function lzwEncode(pixels){
  const CLEAR=256,END=257,MAX=4096;
  const data=[];
  let bitBuffer=0,bitCount=0,codeSize=9,nextCode=258;
  let dictionary=new Map();
  function write(code){
    bitBuffer|=code<<bitCount;
    bitCount+=codeSize;
    while(bitCount>=8){data.push(bitBuffer&255);bitBuffer>>>=8;bitCount-=8;}
  }
  function reset(){dictionary=new Map();codeSize=9;nextCode=258;}
  write(CLEAR);
  let prefix=pixels[0];
  for(let i=1;i<pixels.length;i++){
    const symbol=pixels[i],key=prefix*256+symbol;
    const found=dictionary.get(key);
    if(found!==undefined){prefix=found;continue;}
    write(prefix);
    if(nextCode<MAX){
      dictionary.set(key,nextCode++);
      // GIF decoder's dictionary is one symbol behind the encoder.
      if(nextCode>(1<<codeSize)&&codeSize<12)codeSize++;
    }else{write(CLEAR);reset();}
    prefix=symbol;
  }
  write(prefix);write(END);
  if(bitCount>0)data.push(bitBuffer&255);
  return Uint8Array.from(data);
}
export function encodeGif({width,height,frames,delayCs=10,loop=0}){
  validate(width,height,frames,delayCs);
  if(!Number.isInteger(loop)||loop<0||loop>65535)throw new RangeError('GIF: неверное число повторений');
  const out=[];
  const bytes=(...items)=>out.push(...items);
  const word=value=>bytes(value&255,(value>>8)&255);
  for(const char of 'GIF89a')out.push(char.charCodeAt(0));
  word(width);word(height);bytes(0xf7,0,0);
  for(let i=0;i<256;i++)bytes(Math.round(((i>>5)&7)*255/7),Math.round(((i>>2)&7)*255/7),Math.round((i&3)*255/3));
  bytes(0x21,0xff,0x0b);
  for(const char of 'NETSCAPE2.0')out.push(char.charCodeAt(0));
  bytes(3,1);word(loop);bytes(0);
  for(const rgba of frames){
    bytes(0x21,0xf9,4,0x08);word(delayCs);bytes(0,0);
    bytes(0x2c);word(0);word(0);word(width);word(height);bytes(0);
    bytes(8);
    const packed=lzwEncode(rgbaToIndexed(rgba));
    for(let at=0;at<packed.length;at+=255){
      const end=Math.min(packed.length,at+255);
      bytes(end-at);for(let j=at;j<end;j++)out.push(packed[j]);
    }
    bytes(0);
  }
  bytes(0x3b);
  return Uint8Array.from(out);
}
