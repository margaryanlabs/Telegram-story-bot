(() => {
  'use strict';
  // Portable user-owned Story project. NOT a private cloud backup and not
  // encrypted at rest: it contains an editable copy of the user's photograph.
  // Never upload or automatically persist this file in browser databases.
  const signature='VETO-STORY',version=1,maxFileBytes=8*1024*1024;
  const maxPhotoBytes=5*1024*1024,maxSide=2400;
  const num=(value,min,max,fallback)=>{
    const n=Number(value);
    return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
  };
  function normalize(input={}){
    const obj=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
    const enumOf=(v,choices,fallback)=>choices.includes(v)?v:fallback;
    return {
      brightness:num(obj.brightness,-40,40,0),
      contrast:num(obj.contrast,-40,60,10),
      saturation:num(obj.saturation,-80,70,-12),
      warmth:num(obj.warmth,-40,40,0),
      vignette:num(obj.vignette,0,80,22),
      zoom:num(obj.zoom,1,2.3,1),
      panX:num(obj.panX,-1,1,0),
      panY:num(obj.panY,-1,1,0),
      look:enumOf(obj.look,['editorial','cinematic','minimal','warm','original'],'editorial'),
      text:String(obj.text||'').slice(0,140),
      textPosition:enumOf(obj.textPosition,['top','center','bottom'],'bottom'),
      textTone:enumOf(obj.textTone,['light','dark'],'light'),
      textSize:num(obj.textSize,34,92,56),
      eyebrow:String(obj.eyebrow||'').slice(0,32),
      callToAction:String(obj.callToAction||'').slice(0,32),
      accent:/^#[0-9a-fA-F]{6}$/.test(String(obj.accent||''))
        ?String(obj.accent).toLowerCase():'#ffffff',
    };
  }
  function readBlobAsDataUrl(blob){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=()=>reject(Error('Не удалось прочитать фотографию проекта'));
      reader.readAsDataURL(blob);
    });
  }
  async function canvasJpeg(canvas,quality){
    return new Promise((resolve,reject)=>canvas.toBlob(
      blob=>blob?resolve(blob):reject(Error('Не удалось создать фото проекта')),
      'image/jpeg',quality,
    ));
  }
  async function projectPhoto(photo){
    if(!photo)throw Error('Выбери фотографию.');
    const width=photo.naturalWidth||photo.width,height=photo.naturalHeight||photo.height;
    if(!width||!height||width*height>36e6)
      throw Error('Размеры фотографии не поддерживаются');
    const scale=Math.min(1,maxSide/Math.max(width,height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width*scale));
    canvas.height=Math.max(1,Math.round(height*scale));
    const context=canvas.getContext('2d',{alpha:false});
    if(!context)throw Error('Canvas недоступен');
    context.fillStyle='#fff';
    context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(photo,0,0,canvas.width,canvas.height);
    let blob=await canvasJpeg(canvas,.85);
    if(blob.size>maxPhotoBytes)blob=await canvasJpeg(canvas,.7);
    canvas.width=0;canvas.height=0;
    if(blob.size>maxPhotoBytes)throw Error('Проект слишком большой для хранения на телефоне');
    const data=await readBlobAsDataUrl(blob);
    if(!/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(data))
      throw Error('Не удалось закодировать фото проекта');
    return data;
  }
  async function create(photo,settings){
    const photoData=await projectPhoto(photo);
    const serialized=JSON.stringify({
      signature,version,createdAt:new Date().toISOString(),
      photo:photoData,
      settings:normalize(settings),
      note:'Содержит фотографию. Храните этот файл в приватном месте.',
    });
    if(serialized.length>maxFileBytes)throw Error('Проект превышает допустимый размер');
    return new File([serialized],`veto-story-${Date.now()}.vetostory`,
      {type:'application/json'});
  }
  async function parse(file){
    if(!file||!Number.isFinite(file.size)||file.size<100||file.size>maxFileBytes)
      throw Error('Проект VETO слишком большой или повреждён');
    const value=JSON.parse(await file.text());
    if(value?.signature!==signature||value.version!==version)
      throw Error('Это не поддерживаемый проект VETO Story');
    const source=String(value.photo||'');
    if(source.length>maxFileBytes||!/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(source))
      throw Error('Проект содержит неподдерживаемое фото');
    const encoded=source.split(',')[1];
    const binary=atob(encoded);
    if(binary.length<40||binary.length>maxPhotoBytes||
      binary.charCodeAt(0)!==255||binary.charCodeAt(1)!==216||binary.charCodeAt(2)!==255)
      throw Error('Файл проекта содержит повреждённое изображение');
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    const photo=new File([bytes],'veto-project-photo.jpg',{type:'image/jpeg'});
    return {file:photo,settings:normalize(value.settings)};
  }
  window.VetoStoryProject=Object.freeze({
    normalize,create,parse,signature,version,maxFileBytes,
  });
})();