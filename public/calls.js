(() => {
  'use strict';
  // VETO Calls: browser-native WebRTC + optional short-code signaling.
  // No Telegram call interception, cloud audio recording or server-side audio processing.
  const $=id=>document.getElementById(id);
  const tg=window.Telegram?.WebApp;
  const supported=Boolean(window.RTCPeerConnection && navigator.mediaDevices?.getUserMedia
    && (window.AudioContext||window.webkitAudioContext) && window.crypto?.getRandomValues);
  const state={
    peer:null,mic:null,audio:null,processed:null,oscillator:null,nodes:null,
    room:null,role:null,muted:false,connectedAt:0,timer:0,phase:'idle',epoch:0,
    mode:'manual',signalRoom:null,signalPollTimer:0,signalPollFailures:0,
    sessionTimer:0,connectionTimer:0,iceMode:'stun',waveRaf:0,qualityTimer:0,
    inviteShareUrl:'',ownerFingerprint:String(tg?.initData||''),
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
    $('callCreateAssisted').disabled=busy||!supported||!tg?.initData;
    $('callJoinAssisted').disabled=busy||!supported||!tg?.initData;
    $('callApplyAnswer').disabled=!state.peer||state.role!=='caller'||state.phase!=='offer-ready';
    $('callHangup').disabled=!busy;
    $('callMute').disabled=!busy;
    $('callMute').textContent=state.muted?'◌ Включить микрофон':'◉ Выключить микрофон';
    $('callState').textContent=state.phase==='connected'?'LIVE · ENCRYPTED':
      state.phase==='idle'?'OFFLINE':state.phase==='connecting'?'СОЕДИНЕНИЕ':'ОЖИДАНИЕ';
    $('callState').dataset.state=state.phase;
    $('callCodeSection').hidden=state.phase==='idle';
    if($('callInviteShare'))$('callInviteShare').hidden=!state.inviteShareUrl;
    $('callMorphValue').textContent=$('callMorph').value+'%';
    if($('callTransport'))$('callTransport').textContent=state.iceMode==='turn'? 'ICE · TURN ДОСТУПЕН':'ICE · STUN ONLY';
  }
  function stop(skipEnd=false){
    // Cleanup is best-effort: the database also deletes abandoned offers by TTL.
    const oldRoom=state.signalRoom;
    if(!skipEnd&&oldRoom&&tg?.initData&&
      state.ownerFingerprint===String(tg.initData)){
      void signalRequest('end',{roomId:oldRoom}).catch(()=>{});
    }
    clearTimeout(state.signalPollTimer);state.signalPollTimer=0;
    clearTimeout(state.sessionTimer);state.sessionTimer=0;
    clearTimeout(state.connectionTimer);state.connectionTimer=0;
    clearInterval(state.qualityTimer);state.qualityTimer=0;
    cancelAnimationFrame(state.waveRaf);state.waveRaf=0;
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
    state.mode='manual';state.signalRoom=null;state.signalPollFailures=0;
    state.iceMode='stun';state.inviteShareUrl='';
    const player=$('callRemoteAudio');
    if(player){player.pause();player.srcObject=null;}
    $('callOutgoing').value='';$('callIncoming').value='';
    $('callElapsed').textContent='00:00';
    if($('callPreflight'))$('callPreflight').disabled=false;
    if($('callDiagnostics'))$('callDiagnostics').textContent='Диагностика ещё не запускалась.';
    if($('callQuality'))$('callQuality').textContent='СОЕДИНЕНИЕ НЕ УСТАНОВЛЕНО';
    const wave=$('callWaveform');if(wave)wave.getContext('2d')?.clearRect(0,0,wave.width,wave.height);
    update();
  }
  function guardOwner(){
    const current=String(tg?.initData||'');
    if(state.ownerFingerprint===current)return true;
    // Never retain a previous Telegram user's codes, call UI, stream or tracks
    // in an already-open Mini App WebView. Avoid using B's credentials to close
    // A's room: the short-lived TTL takes care of abandoned A state.
    stop(true);
    state.ownerFingerprint=current;
    report('Telegram-аккаунт изменился. Прошлый вызов и его данные очищены.');
    return false;
  }
  async function checkCallReadiness(){
    if(!guardOwner())return;
    const button=$('callPreflight');
    const output=$('callDiagnostics');
    if(!output)return;
    button.disabled=true;
    const facts=[
      (window.isSecureContext?'✓ HTTPS / безопасный контекст':'✕ Нет HTTPS'),
      (window.RTCPeerConnection?'✓ WebRTC':'✕ WebRTC недоступен'),
      (navigator.mediaDevices?.getUserMedia?'✓ API микрофона':'✕ API микрофона недоступен'),
      (window.AudioContext||window.webkitAudioContext?'✓ Обработка звука':'✕ Web Audio недоступен'),
      (tg?.initData?'✓ Telegram Mini App':'✕ Открой приложение из Telegram'),
    ];
    if(navigator.permissions?.query){
      try{
        const status=await navigator.permissions.query({name:'microphone'});
        if(!guardOwner())return;
        const label={granted:'разрешён',prompt:'потребует подтверждения',denied:'заблокирован'};
        facts.push('Микрофон: '+(label[status.state]||'неизвестно'));
      }catch{facts.push('Разрешение микрофона проверяется при начале вызова');}
    }
    if(tg?.initData){
      try{
        const config=await signalRequest('ice');
        if(!guardOwner())return;
        facts.push(config.relayConfigured?
          '✓ TURN-конфигурация получена — соединение через реле ещё не проверено':
          '○ TURN не настроен — только STUN, мобильные сети могут блокировать звонок');
      }catch{
        facts.push('✕ Сервер ICE не отвечает или Telegram сессия недействительна');
      }
    }
    output.textContent=facts.join('\n');
    button.disabled=false;
    report('Диагностика завершена. Реальный звонок проверяется только между двумя устройствами.');
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
      const analyser=context.createAnalyser();analyser.fftSize=1024;
      const destination=context.createMediaStreamDestination();
      input.connect(low);low.connect(mid);mid.connect(high);high.connect(tremolo);
      tremolo.connect(limiter);limiter.connect(volume);volume.connect(destination);
      volume.connect(analyser); // Visualize locally; no audio transmitted by analyser.
      oscillator.start();
      state.mic=stream;state.audio=context;state.processed=destination.stream;
      state.oscillator=oscillator;state.nodes={low,mid,high,volume,modulation,analyser};
      morph();
      if(!state.waveRaf)drawWave(epoch);
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
  function drawWave(epoch){
    if(epoch!==state.epoch||!state.mic||!state.nodes?.analyser)return;
    const canvas=$('callWaveform'),ctx=canvas?.getContext('2d');
    if(!ctx)return;
    const {width,height}=canvas;
    const buf=new Uint8Array(state.nodes.analyser.frequencyBinCount);
    state.nodes.analyser.getByteTimeDomainData(buf);
    ctx.clearRect(0,0,width,height);
    const bars=58,step=width/bars,mid=height/2;
    for(let i=0;i<bars;i++){
      const n=Math.floor(i*buf.length/bars);
      const value=Math.abs((buf[n]??128)-128)/128;
      const amplitude=Math.min(height*.86,3+value*height*1.1);
      ctx.fillStyle='rgba(199,214,230,'+(0.28+0.66*(1-Math.abs(i-29)/29)).toFixed(2)+')';
      ctx.fillRect(i*step+2,mid-amplitude/2,Math.max(2,step-3),amplitude);
    }
    state.waveRaf=requestAnimationFrame(()=>drawWave(epoch));
  }
  async function updateQuality(epoch,peer){
    if(epoch!==state.epoch||peer.connectionState!=='connected'||!peer.getStats)return;
    try{
      const report=await peer.getStats();
      if(epoch!==state.epoch||peer!==state.peer)return;
      let selected=null;
      report.forEach(stat=>{
        if(stat.type==='candidate-pair'&&
           (stat.selected===true||(stat.nominated&&stat.state==='succeeded')))selected=stat;
      });
      if(!selected)return;
      const candidate=selected.localCandidateId?report.get(selected.localCandidateId):null;
      const kind=candidate?.candidateType==='relay'?'TURN RELAY':'P2P';
      const ms=Number.isFinite(selected.currentRoundTripTime)
        ?Math.max(0,Math.round(selected.currentRoundTripTime*1000)):null;
      if($('callQuality'))$('callQuality').textContent=
        kind+(ms===null?'':' · RTT '+ms+' мс');
    }catch{} // Browser WebRTC stats support varies. Never log SDP/IP.
  }
  function armConnectionWatchdog(epoch){
    // A WebRTC peer may become connected before setRemoteDescription settles.
    if(epoch!==state.epoch||state.phase==='connected'||
      state.peer?.connectionState==='connected')return;
    clearTimeout(state.connectionTimer);
    state.connectionTimer=setTimeout(()=>{
      if(epoch!==state.epoch||state.phase==='connected'||state.phase==='idle')return;
      failed(Error('Нет аудиосвязи за 45 секунд. Проверь сеть или настрой TURN-сервер.'),epoch);
    },45000);
  }
  async function establish(role,epoch){
    const stream=await microphone(epoch);
    if(epoch!==state.epoch)throw Error('CANCELLED');
    // No TURN credentials are stored on device beyond this session.
    let servers=STUN;state.iceMode='stun';
    if(tg?.initData){
      try{
        const config=await signalRequest('ice');
        if(epoch!==state.epoch)throw Error('CANCELLED');
        if(Array.isArray(config?.iceServers)&&config.iceServers.length){
          servers=config.iceServers;
          state.iceMode=config.relayConfigured?'turn':'stun';
        }
      }catch(error){
        if(epoch!==state.epoch)throw Error('CANCELLED');
        // Fail to STUN rather than leaving the microphone waiting on backend.
        report('TURN недоступен — пробую прямое соединение STUN.');
      }
    }
    const peer=new RTCPeerConnection({iceServers:servers,iceCandidatePoolSize:1});
    state.peer=peer;state.role=role;
    stream.getAudioTracks().forEach(track=>{
      peer.addTrack(track,stream);
      track.addEventListener('ended',()=>{
        if(epoch===state.epoch&&state.phase!=='idle'){
          failed(Error('Микрофон отключён системой. Звонок завершён.'),epoch);
        }
      });
    });
    state.sessionTimer=setTimeout(()=>{
      if(epoch!==state.epoch||state.phase==='connected'||state.phase==='idle')return;
      failed(Error('Время ожидания ответа истекло. Микрофон выключен.'),epoch);
    },9*60*1000);
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
        clearTimeout(state.connectionTimer);state.connectionTimer=0;
        clearTimeout(state.sessionTimer);state.sessionTimer=0;
        clearInterval(state.qualityTimer);state.qualityTimer=0;
        state.qualityTimer=setInterval(()=>{void updateQuality(epoch,peer);},5000);
        void updateQuality(epoch,peer);
        state.phase='connected';state.connectedAt=Date.now();
        clearTimeout(state.signalPollTimer);state.signalPollTimer=0;
        // SDP is no longer needed once ICE/DTLS is established.
        if(state.signalRoom){
          const roomId=state.signalRoom;state.signalRoom=null;
          void signalRequest('end',{roomId}).catch(()=>{});
        }
        $('callOutgoing').value='';$('callIncoming').value='';
        clearInterval(state.timer);
        state.timer=setInterval(()=>{
          const sec=Math.floor((Date.now()-state.connectedAt)/1000);
          $('callElapsed').textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+
            String(sec%60).padStart(2,'0');
        },1000);
        report('Собственный WebRTC-звонок активен. Звук шифруется WebRTC DTLS-SRTP.');
      }else if(current==='failed'){
        failed(Error('WebRTC-соединение не удалось. Нужен TURN или другая сеть.'),epoch);
        return;
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
  async function signalRequest(action,payload={}){
    const signed=String(tg?.initData||'');
    if(signed!==state.ownerFingerprint)throw Error('TELEGRAM_ACCOUNT_CHANGED');
    if(!signed)throw Error('Открой VETO Calls внутри Telegram.');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),11000);
    try{
      const res=await fetch('/api/call-signal',{
        method:'POST',
        headers:{'content-type':'application/json','x-telegram-init-data':signed},
        cache:'no-store',signal:controller.signal,
        body:JSON.stringify({action,...payload}),
      });
      const json=await res.json().catch(()=>({}));
      if(signed!==String(tg?.initData||''))throw Error('TELEGRAM_ACCOUNT_CHANGED');
      if(!res.ok||!json.ok)throw Error(json.error||'Сигнальный сервер недоступен');
      return json;
    }catch(error){
      if(error?.name==='AbortError')throw Error('Нет ответа сигнального сервера');
      throw error;
    }finally{clearTimeout(timeout);}
  }
  function pollAssisted(epoch){
    if(epoch!==state.epoch||state.mode!=='assisted'||state.role!=='caller'||
      state.phase!=='invite-ready'||!state.signalRoom)return;
    const roomId=state.signalRoom;
    void signalRequest('poll',{roomId}).then(async data=>{
      if(epoch!==state.epoch||state.signalRoom!==roomId)return;
      state.signalPollFailures=0;
      if(data.status==='expired'){
        failed(Error('Время приглашения истекло. Создай новый вызов.'),epoch);
        return;
      }
      if(data.status==='answered'){
        if(!data.answerSdp||!state.peer)throw Error('Ответ собеседника недоступен');
        await state.peer.setRemoteDescription({type:'answer',sdp:data.answerSdp});
        if(epoch!==state.epoch)return;
        if(state.phase!=='connected'){
          state.phase='connecting';update();armConnectionWatchdog(epoch);
        }
        report('Собеседник принял приглашение. Устанавливаю WebRTC-соединение…');
      }
    }).catch(error=>{
      if(epoch!==state.epoch)return;
      state.signalPollFailures++;
      if(state.signalPollFailures>=3){
        failed(Error('Связь с сигнальным сервером потеряна. '+error.message),epoch);
      }
    }).finally(()=>{
      if(epoch!==state.epoch||state.phase!=='invite-ready')return;
      state.signalPollTimer=setTimeout(()=>pollAssisted(epoch),3000);
    });
  }
  async function createAssisted(){
    if(!guardOwner())return;
    if(state.phase!=='idle'||!supported)return;
    if(!tg?.initData){report('Открой VETO Calls внутри Telegram.',true);return;}
    const epoch=++state.epoch;
    state.mode='assisted';state.phase='preparing';update();
    report('Готовлю аудио и короткое приглашение для собеседника…');
    try{
      const peer=await establish('caller',epoch);
      await peer.setLocalDescription(await peer.createOffer());
      const complete=await iceDone(peer,epoch);
      if(epoch!==state.epoch)return;
      if(!complete)throw Error('Не удалось завершить подготовку сетевых адресов. Попробуй ещё раз.');
      const created=await signalRequest('create',{sdp:peer.localDescription.sdp});
      if(epoch!==state.epoch){
        void signalRequest('end',{roomId:created.roomId}).catch(()=>{});
        return;
      }
      state.signalRoom=created.roomId;
      state.inviteShareUrl=String(created.shareUrl||'').startsWith('https://t.me/')
        ?String(created.shareUrl):'';
      state.phase='invite-ready';update();
      $('callOutgoing').value=created.invite;
      report('Короткое приглашение готово. Отправь код второму Telegram пользователю. '+
        'Он вводит его в VETO Calls — ответ подключится автоматически (до 8 минут).');
      pollAssisted(epoch);
    }catch(error){failed(error,epoch);}
  }
  async function joinAssisted(){
    if(!guardOwner())return;
    if(state.phase!=='idle'||!supported)return;
    if(!tg?.initData){report('Открой VETO Calls внутри Telegram.',true);return;}
    const invite=String($('callIncoming').value||'').trim();
    if(!/^VETOR1:[a-f0-9]{32}\.[a-f0-9]{48}$/.test(invite)){
      report('Вставь короткий код VETOR1, полученный от инициатора.',true);return;
    }
    const epoch=++state.epoch;
    state.mode='assisted';state.phase='preparing';update();
    report('Проверяю приглашение и подключаю микрофон…');
    try{
      const room=await signalRequest('inspect',{invite});
      if(epoch!==state.epoch)return;
      state.room=room.roomId;state.signalRoom=room.roomId;
      const peer=await establish('callee',epoch);
      await peer.setRemoteDescription({type:'offer',sdp:room.offerSdp});
      await peer.setLocalDescription(await peer.createAnswer());
      const complete=await iceDone(peer,epoch);
      if(epoch!==state.epoch)return;
      if(!complete)throw Error('Не удалось завершить подготовку сетевых адресов.');
      await signalRequest('answer',{invite,sdp:peer.localDescription.sdp});
      if(epoch!==state.epoch)return;
      $('callIncoming').value='';
      if(state.phase!=='connected'){
        state.phase='connecting';update();armConnectionWatchdog(epoch);
      }
      report('Ответ отправлен. Ожидаю защищённое соединение…');
    }catch(error){failed(error,epoch);}
  }

  async function create(){
    if(!guardOwner())return;
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
    if(!guardOwner())return;
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
    if(!guardOwner())return;
    if(state.role!=='caller'||state.phase!=='offer-ready'||!state.peer)return;
    let answer;
    try{
      answer=unpack($('callIncoming').value,'answer');
      if(answer.room!==state.room)throw Error('Этот ответ относится к другому звонку');
    }catch(error){report(error.message,true);return;}
    try{
      await state.peer.setRemoteDescription({type:'answer',sdp:answer.sdp});
      $('callIncoming').value='';$('callOutgoing').value='';
      if(state.phase!=='connected'){
        state.phase='connecting';update();armConnectionWatchdog(state.epoch);
      }
      report('Согласование завершено. Ожидаю защищённое соединение…');
    }catch(error){report('Не удалось применить ответ: '+error.message,true);}
  }
  function prefillDeepLink(){
    // start_param is not authorization and is never forwarded as a Telegram
    // identity. Only the signed initData is used for the signaling API.
    const raw=String(tg?.initDataUnsafe?.start_param||
      new URLSearchParams(location.search).get('tgWebAppStartParam')||'');
    if(!/^vc_[A-Za-z0-9_-]{54}$/.test(raw))return;
    try{
      const code=raw.slice(3).replace(/-/g,'+').replace(/_/g,'/');
      const decoded=atob(code.padEnd(56,'='));
      if(decoded.length!==40)return;
      const hex=Array.from(decoded,ch=>ch.charCodeAt(0).toString(16).padStart(2,'0')).join('');
      $('callIncoming').value='VETOR1:'+hex.slice(0,32)+'.'+hex.slice(32);
      report('Приглашение получено. Проверь собеседника и нажми «Присоединиться по короткому коду».');
    }catch{}
  }
  async function copyInviteLink(){
    if(!guardOwner())return;
    if(!state.inviteShareUrl)return;
    try{
      if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');
      await navigator.clipboard.writeText(state.inviteShareUrl);
      report('Ссылка скопирована. Отправь её доверенному человеку. При переключении приложений текущий вызов завершится.');
    }catch{
      report('Не удалось скопировать ссылку. Используй короткий код приглашения.',true);
    }
  }
  async function copy(){
    if(!guardOwner())return;
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
  $('callPreflight')?.addEventListener('click',checkCallReadiness);
  $('callCreate')?.addEventListener('click',create);
  $('callCreateAssisted')?.addEventListener('click',createAssisted);
  $('callJoinAssisted')?.addEventListener('click',joinAssisted);
  $('callJoin')?.addEventListener('click',join);
  $('callApplyAnswer')?.addEventListener('click',applyAnswer);
  $('callCopy')?.addEventListener('click',copy);
  $('callInviteShare')?.addEventListener('click',copyInviteLink);
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
    if(!document.hidden){guardOwner();return;}
    if(document.hidden&&state.phase!=='idle'){
      stop();report('Звонок завершён: приложение свёрнуто. Микрофон отключён.');
    }
  });
  window.addEventListener('focus',guardOwner);
  window.addEventListener('pageshow',guardOwner);
  window.addEventListener('pagehide',()=>stop());
  if(!supported)report('WebRTC или микрофон недоступны в этом Telegram WebView. Попробуй актуальную версию Telegram.',true);
  prefillDeepLink();
  update();
})();
