(() => {
  'use strict';
  // VETO Calls experimental P2P: browser-native WebRTC with manual signaling.
  // No signaling database, server audio relay, Telegram call interception or recording.
  const $=id=>document.getElementById(id);
  const supported=Boolean(window.RTCPeerConnection && navigator.mediaDevices?.getUserMedia
    && (window.AudioContext||window.webkitAudioContext) && window.crypto?.getRandomValues);
  const state={
    peer:null,mic:null,audio:null,processed:null,oscillator:null,nodes:null,
    room:null,role:null,muted:false,connectedAt:0,timer:0,phase:'idle',epoch:0,
  };
  const presets={
    original:{low:0,mid:0,high:0,robot:0},
    deep:{low:10,mid:-2,high:-5,robot:0}, // warm EQ, not a real pitch shift
    cinematic:{low:7,mid:3,high:2,robot:0},
    radio:{low:-7,mid:9,high:-8,robot:0},
    robot:{low:0,mid:2,high:-3,robot:.5},
  };
  const STUN=[{urls:'stun:stun.l.google.com:19302'}];
  function report(message,problem=false){
    const el=$('callStatus');if(el){el.textContent=message;el.dataset.error=problem?'true':'false';}
  }
  function update(){
    const busy=state.phase!=='idle';
    $('callCreate').disabled=busy||!supported;
    $('callJoin').disabled=busy||!supported;
    $('callApplyAnswer').disabled=!state.peer||state.role!=='caller'||state.phase!=='offer-ready';
    $('callHangup').disabled=!busy;
    $('callMute').disabled=!busy;
    $('callMute').textContent=state.muted?'◌ Включить микрофон':'◉ Выключить микрофон';
    $('callState').textContent=state.phase==='connected'?'LIVE · ENCRYPTED':
      state.phase==='idle'?'OFFLINE':state.phase==='connecting'?'СОЕДИНЕНИЕ':'ОЖИДАНИЕ';
    $('callState').dataset.state=state.phase;
    $('callCodeSection').hidden=state.phase==='idle';
    $('callMorphValue').textContent=$('callMorph').value+'%';
  }
  function stop(){
    state.epoch++;
    clearInterval(state.timer);state.timer=0;
    try{state.peer?.close();}catch{}
    try{state.oscillator?.stop();}catch{}
    try{state.oscillator?.disconnect();}catch{}
    try{state.mic?.getTracks().forEach(t=>t.stop());}catch{}
    try{state.processed?.getTracks().forEach(t=>t.stop());}catch{}
    try{state.audio?.close();}catch{}
    state.peer=null;state.oscillator=null;state.mic=null;state.processed=null;
    state.audio=null;state.nodes=null;state.room=null;state.role=null;
    state.muted=false;state.connectedAt=0;state.phase='idle';
    const player=$('callRemoteAudio');
    if(player){player.pause();player.srcObject=null;}
    $('callOutgoing').value='';$('callIncoming').value='';
    $('callElapsed').textContent='00:00';
    update();
  }
  function morph(){
    const n=state.nodes;if(!n||!state.audio)return;
    const preset=presets[$('callPreset').value]||presets.original;
    const strength=Number($('callMorph').value)/100;
    const now=state.audio.currentTime;
    const change=(param,val)=>param.setTargetAtTime(val,now,.06);
    change(n.low.gain,preset.low*strength);
    change(n.mid.gain,preset.mid*strength);
    change(n.high.gain,preset.high*strength);
    change(n.modulation.gain,preset.robot*strength);
    change(n.volume.gain,1);
    update();
  }
  async function microphone(epoch){
    const stream=await navigator.mediaDevices.getUserMedia({audio:{
      echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1,
    },video:false});
    if(epoch!==state.epoch){stream.getTracks().forEach(t=>t.stop());throw Error('CANCELLED');}
    let context;
    try{
      context=new (window.AudioContext||window.webkitAudioContext)();
      await context.resume();
      if(epoch!==state.epoch)throw Error('CANCELLED');
      const input=context.createMediaStreamSource(stream);
      const low=context.createBiquadFilter();low.type='lowshelf';low.frequency.value=250;
      const mid=context.createBiquadFilter();mid.type='peaking';mid.frequency.value=1850;mid.Q.value=1;
      const high=context.createBiquadFilter();high.type='highshelf';high.frequency.value=4200;
      const volume=context.createGain();
      const modulation=context.createGain();modulation.gain.value=0;
      const oscillator=context.createOscillator();oscillator.type='sine';oscillator.frequency.value=34;
      const tremolo=context.createGain();tremolo.gain.value=1;
      oscillator.connect(modulation);modulation.connect(tremolo.gain);
      const limiter=context.createDynamicsCompressor();
      const destination=context.createMediaStreamDestination();
      input.connect(low);low.connect(mid);mid.connect(high);high.connect(tremolo);
      tremolo.connect(limiter);limiter.connect(volume);volume.connect(destination);
      oscillator.start();
      state.mic=stream;state.audio=context;state.processed=destination.stream;
      state.oscillator=oscillator;state.nodes={low,mid,high,volume,modulation};
      morph();
      return destination.stream;
    }catch(error){
      stream.getTracks().forEach(t=>t.stop());
      if(context)await context.close().catch(()=>{});
      throw error;
    }
  }
  function newRoom(){
    const arr=new Uint8Array(16);crypto.getRandomValues(arr);
    return Array.from(arr,x=>x.toString(16).padStart(2,'0')).join('');
  }
  function pack(desc,room){
    const payload=JSON.stringify({v:1,room,at:Date.now(),type:desc.type,sdp:desc.sdp});
    const binary=new TextEncoder().encode(payload);
    let str='';for(const byte of binary)str+=String.fromCharCode(byte);
    return 'VETO1:'+btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function unpack(raw,expectedType){
    const text=String(raw||'').trim();
    if(!/^VETO1:[a-zA-Z0-9_-]{80,50000}$/.test(text))throw Error('Некорректный код вызова');
    let payload;
    try{
      const encoded=text.slice(6).replace(/-/g,'+').replace(/_/g,'/');
      const binary=atob(encoded.padEnd(Math.ceil(encoded.length/4)*4,'='));
      const bytes=Uint8Array.from(binary,x=>x.charCodeAt(0));
      payload=JSON.parse(new TextDecoder().decode(bytes));
    }catch{throw Error('Повреждённый код. Скопируй его целиком.');}
    if(payload?.v!==1||payload.type!==expectedType||
       !/^[a-f0-9]{32}$/.test(String(payload.room||''))||
       typeof payload.sdp!=='string'||payload.sdp.length<50||
       payload.sdp.length>30000||!payload.sdp.startsWith('v=0\r\n')||
       !Number.isFinite(payload.at)||Math.abs(Date.now()-payload.at)>20*60*1000)
      throw Error('Код не подходит, устарел или содержит некорректные данные');
    return payload;
  }
  function iceDone(peer,epoch){
    if(peer.iceGatheringState==='complete')return Promise.resolve(true);
    return new Promise((resolve,reject)=>{
      const finish=completed=>{
        clearTimeout(timeout);
        peer.removeEventListener('icegatheringstatechange',change);
        if(epoch!==state.epoch)return reject(Error('CANCELLED'));
        resolve(completed);
      };
      const change=()=>{if(peer.iceGatheringState==='complete')finish(true);};
      const timeout=setTimeout(()=>finish(false),12000);
      peer.addEventListener('icegatheringstatechange',change);
      change();
    });
  }
  async function establish(role,epoch){
    const stream=await microphone(epoch);
    if(epoch!==state.epoch)throw Error('CANCELLED');
    const peer=new RTCPeerConnection({iceServers:STUN,iceCandidatePoolSize:1});
    state.peer=peer;state.role=role;
    stream.getAudioTracks().forEach(track=>peer.addTrack(track,stream));
    peer.addEventListener('track',event=>{
      if(epoch!==state.epoch)return;
      const player=$('callRemoteAudio');
      if(player){
        player.srcObject=event.streams[0]||new MediaStream([event.track]);
        player.play().catch(()=>report('Звук заблокирован WebView. Нажми «Включить звук».'));
      }
    });
    peer.addEventListener('connectionstatechange',()=>{
      if(epoch!==state.epoch)return;
      const current=peer.connectionState;
      if(current==='connected'){
        state.phase='connected';state.connectedAt=Date.now();
        $('callOutgoing').value='';$('callIncoming').value='';
        clearInterval(state.timer);
        state.timer=setInterval(()=>{
          const sec=Math.floor((Date.now()-state.connectedAt)/1000);
          $('callElapsed').textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+
            String(sec%60).padStart(2,'0');
        },1000);
        report('Собственный WebRTC-звонок активен. Звук шифруется WebRTC DTLS-SRTP.');
      }else if(current==='failed'){
        report('Соединение не удалось — возможно, нужен TURN-сервер. Заверши вызов и попробуй ещё раз.',true);
      }else if(current==='disconnected'){
        report('Связь прервана. Проверяю восстановление…',true);
      }
      update();
    });
    return peer;
  }
  function failed(error,epoch){
    if(epoch!==state.epoch)return;
    const message=error?.name==='NotAllowedError'?'Разреши микрофон в настройках Telegram.':
      error?.name==='NotFoundError'?'На устройстве нет доступного микрофона.':
      error?.message||'Ошибка WebRTC на этом устройстве.';
    stop();report(message,true);
  }
  async function create(){
    if(state.phase!=='idle'||!supported)return;
    const epoch=++state.epoch;
    state.room=newRoom();state.phase='preparing';update();
    report('Включаю микрофон и подготавливаю зашифрованный канал…');
    try{
      const peer=await establish('caller',epoch);
      await peer.setLocalDescription(await peer.createOffer());
      const complete=await iceDone(peer,epoch);
      if(epoch!==state.epoch)return;
      $('callOutgoing').value=pack(peer.localDescription,state.room);
      state.phase='offer-ready';update();
      report(complete?'Код приглашения готов. Передай его только доверенному человеку.':
        'Код создан, но сбор сетевых адресов не завершён. Соединение может не установиться.');
    }catch(error){failed(error,epoch);}
  }
  async function join(){
    if(state.phase!=='idle'||!supported)return;
    let offer;
    try{offer=unpack($('callIncoming').value,'offer');}
    catch(error){report(error.message,true);return;}
    const epoch=++state.epoch;
    state.room=offer.room;state.phase='preparing';update();
    report('Запрашиваю микрофон и формирую ответ…');
    try{
      const peer=await establish('callee',epoch);
      await peer.setRemoteDescription({type:'offer',sdp:offer.sdp});
      await peer.setLocalDescription(await peer.createAnswer());
      const complete=await iceDone(peer,epoch);
      if(epoch!==state.epoch)return;
      $('callIncoming').value='';
      $('callOutgoing').value=pack(peer.localDescription,state.room);
      state.phase='answer-ready';update();
      report(complete?'Ответ готов. Отправь его инициатору разговора.':
        'Ответ сформирован, но сбор сетевых адресов не завершён.');
    }catch(error){failed(error,epoch);}
  }
  async function applyAnswer(){
    if(state.role!=='caller'||state.phase!=='offer-ready'||!state.peer)return;
    let answer;
    try{
      answer=unpack($('callIncoming').value,'answer');
      if(answer.room!==state.room)throw Error('Этот ответ относится к другому звонку');
    }catch(error){report(error.message,true);return;}
    try{
      await state.peer.setRemoteDescription({type:'answer',sdp:answer.sdp});
      $('callIncoming').value='';$('callOutgoing').value='';
      state.phase='connecting';update();
      report('Согласование завершено. Ожидаю защищённое соединение…');
    }catch(error){report('Не удалось применить ответ: '+error.message,true);}
  }
  async function copy(){
    const text=$('callOutgoing').value;
    if(!text){report('Сначала сформируй код приглашения или ответа.');return;}
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else {
        $('callOutgoing').focus();$('callOutgoing').select();
        if(!document.execCommand('copy'))throw Error('unsupported');
      }
      report('Код скопирован. Отправь его собеседнику приватным способом.');
    }catch{
      $('callOutgoing').focus();$('callOutgoing').select();
      report('Копирование запрещено браузером. Выдели код и скопируй вручную.');
    }
  }
  $('callCreate')?.addEventListener('click',create);
  $('callJoin')?.addEventListener('click',join);
  $('callApplyAnswer')?.addEventListener('click',applyAnswer);
  $('callCopy')?.addEventListener('click',copy);
  $('callHangup')?.addEventListener('click',()=>{stop();report('Вызов завершён. Микрофон отключён.');});
  $('callMute')?.addEventListener('click',()=>{
    if(!state.processed)return;
    state.muted=!state.muted;
    state.processed.getAudioTracks().forEach(track=>{track.enabled=!state.muted;});
    update();
  });
  $('callPreset')?.addEventListener('change',morph);
  $('callMorph')?.addEventListener('input',morph);
  $('callListen')?.addEventListener('click',()=>{
    $('callRemoteAudio').play().catch(()=>report('Разреши воспроизведение звука в WebView.',true));
  });
  window.addEventListener('veto:screen-changed',event=>{
    if(event.detail?.screen!=='calls'&&state.phase!=='idle'){
      stop();report('Звонок завершён при выходе из Calls. Микрофон отключён.');
    }
  });
  // Mobile Telegram can background a WebView without firing pagehide.
  // Do not retain an active microphone or connected media when it is hidden.
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&state.phase!=='idle'){
      stop();report('Звонок завершён: приложение свёрнуто. Микрофон отключён.');
    }
  });
  window.addEventListener('pagehide',()=>stop());
  if(!supported)report('WebRTC или микрофон недоступны в этом Telegram WebView. Попробуй актуальную версию Telegram.',true);
  update();
})();
