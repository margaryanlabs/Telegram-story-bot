(() => {
  'use strict';
  // Browser-only TURN relay proof: synthetic silent audio + one data channel
  // between two local RTCPeerConnections. Never requests microphone or
  // accesses chats; never logs credentials, ICE candidates, SDP or IPs.
  const button=document.getElementById('callTurnTest');
  const status=document.getElementById('callTurnTestStatus');
  const tg=window.Telegram?.WebApp;
  if(!button||!status)return;
  let active=null,generation=0;
  const show=(message,problem=false)=>{
    status.textContent=message;
    status.dataset.error=problem?'true':'false';
  };
  function selectedRelay(stats){
    let chosen;
    stats.forEach(s=>{
      if(s.type==='transport'&&s.selectedCandidatePairId)
        chosen=stats.get(s.selectedCandidatePairId)||chosen;
    });
    if(!chosen)stats.forEach(s=>{
      if(s.type==='candidate-pair'&&s.state==='succeeded'&&
        (s.selected===true||s.nominated===true))chosen=s;
    });
    if(!chosen||!chosen.localCandidateId)return false;
    return stats.get(chosen.localCandidateId)?.candidateType==='relay';
  }
  async function testRelay(){
    if(active)return;
    if(!tg?.initData){
      show('Открой VETO Calls в Telegram, чтобы получить временные TURN-данные.',true);
      return;
    }
    if(!window.RTCPeerConnection||!(window.AudioContext||window.webkitAudioContext)){
      show('WebRTC и WebAudio недоступны на устройстве.',true);return;
    }
    const myGeneration=++generation;
    button.disabled=true;
    show('Проверяю реальный TURN relay: доступ к серверу, ICE, аудио и ping/pong…');
    let left=null,right=null,ctx=null,osc=null,destination=null,timeout=0;
    let rejectPending=null,ended=false,turnConfig=null;
    const close=()=>{
      if(ended)return;
      ended=true;
      clearTimeout(timeout);
      rejectPending?.(Error('CANCELLED'));
      rejectPending=null;
      try{left?.close();}catch{}
      try{right?.close();}catch{}
      try{osc?.stop();}catch{}
      try{destination?.stream.getTracks().forEach(t=>t.stop());}catch{}
      try{ctx?.close();}catch{}
      turnConfig=null; // Do not retain credentials outside this test.
      if(active===close)active=null;
      if(myGeneration===generation)button.disabled=false;
    };
    active=close;
    try{
      const signed=String(tg.initData);
      const controller=new AbortController();
      const signalTimeout=setTimeout(()=>controller.abort(),7500);
      let ice;
      try{
        const reply=await fetch('/api/call-signal',{
          method:'POST',cache:'no-store',signal:controller.signal,
          headers:{'content-type':'application/json','x-telegram-init-data':signed},
          body:JSON.stringify({action:'ice'}),
        });
        const result=await reply.json().catch(()=>({}));
        if(!reply.ok||!result.ok)throw Error('Нет доступа к ICE API через Telegram');
        ice=result;
      }finally{clearTimeout(signalTimeout);}
      if(ended||myGeneration!==generation||
        signed!==String(tg?.initData||''))return;
      const servers=(ice.iceServers||[]).filter(server=>{
        const urls=Array.isArray(server.urls)?server.urls:[server.urls];
        return Boolean(server.username&&server.credential&&urls.length&&
          urls.every(u=>typeof u==='string'&&/^turns?:/.test(u)));
      });
      if(!ice.relayConfigured||!servers.length){
        show('TURN не настроен. Необходим сервер-реле и временные учётные данные. '+
          'Это не ошибка микрофона или Telegram.',true);
        return;
      }
      turnConfig={iceServers:servers,iceTransportPolicy:'relay'};
      const Context=window.AudioContext||window.webkitAudioContext;
      ctx=new Context();
      if(ctx.state==='suspended')await ctx.resume();
      if(ended||myGeneration!==generation)return;
      destination=ctx.createMediaStreamDestination();
      const volume=ctx.createGain();volume.gain.value=.0001;
      osc=ctx.createOscillator();osc.frequency.value=225;
      osc.connect(volume);volume.connect(destination);osc.start();
      left=new RTCPeerConnection(turnConfig);
      right=new RTCPeerConnection(turnConfig);
      const media=destination.stream.getAudioTracks();
      if(!media.length)throw Error('Не удалось создать безопасный тестовый аудиопоток');
      left.addTrack(media[0],destination.stream);
      const channel=left.createDataChannel('veto-turn-proof');
      let gotAudio=false,gotResponse=false;
      let resolveProof;
      const proof=new Promise(resolve=>{resolveProof=resolve;});
      const check=()=>{
        if(left.connectionState==='connected'&&
          right.connectionState==='connected'&&gotAudio&&gotResponse)resolveProof();
      };
      right.addEventListener('track',event=>{
        if(event.track.kind==='audio'){gotAudio=true;check();}
      });
      right.addEventListener('datachannel',event=>{
        if(event.channel.label!=='veto-turn-proof')return;
        event.channel.addEventListener('message',message=>{
          if(message.data==='proof-ping')event.channel.send('proof-pong');
        });
      });
      left.addEventListener('connectionstatechange',check);
      right.addEventListener('connectionstatechange',check);
      channel.addEventListener('open',()=>{channel.send('proof-ping');});
      channel.addEventListener('message',event=>{
        if(event.data==='proof-pong'){gotResponse=true;check();}
      });
      const deadline=new Promise((_,reject)=>{
        rejectPending=reject;
        timeout=setTimeout(()=>reject(Error('TURN relay не смог установить соединение')),40000);
      });
      // ICE gathering finishes before we exchange SDPs: no trickle, no
      // candidate/host address ever passes to VETO server or chat.
      const gather=peer=>new Promise((resolve,reject)=>{
        if(peer.iceGatheringState==='complete')return resolve();
        const changed=()=>{
          if(peer.iceGatheringState==='complete'){
            peer.removeEventListener('icegatheringstatechange',changed);
            resolve();
          }
          if(peer.signalingState==='closed'){
            peer.removeEventListener('icegatheringstatechange',changed);
            reject(Error('CANCELLED'));
          }
        };
        peer.addEventListener('icegatheringstatechange',changed);
        changed();
      });
      const negotiate=(async()=>{
        await left.setLocalDescription(await left.createOffer());
        await gather(left);
        if(ended)return;
        await right.setRemoteDescription(left.localDescription);
        await right.setLocalDescription(await right.createAnswer());
        await gather(right);
        if(ended)return;
        await left.setRemoteDescription(right.localDescription);
        await proof;
        if(ended||myGeneration!==generation)return;
        const [ls,rs]=await Promise.all([left.getStats(),right.getStats()]);
        if(!selectedRelay(ls)||!selectedRelay(rs))
          throw Error('WebRTC установился, но браузер не подтвердил relay-кандидаты');
        show('✓ TURN RELAY подтверждён на этом устройстве: реальный реле-маршрут, '+
          'зашифрованный WebRTC, синтетическое аудио и ping/pong.\n'+
          'Это всё ещё НЕ тест звонка между двумя телефонами.');
      })();
      await Promise.race([negotiate,deadline]);
    }catch(error){
      if(!ended&&myGeneration===generation){
        show('✕ '+(error?.name==='AbortError'
          ?'Сервер ICE не ответил':error?.message||'TURN-проверка не прошла')+
          '\nПроверь настройку TURN, сеть, UDP/TCP и поддержку WebRTC.',true);
      }
    }finally{close();}
  }
  const abandon=()=>{generation++;active?.();};
  window.addEventListener('veto:screen-changed',event=>{
    if(event.detail?.screen!=='calls')abandon();
  });
  window.addEventListener('pagehide',abandon);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)abandon();});
  button.addEventListener('click',testRelay);
})();