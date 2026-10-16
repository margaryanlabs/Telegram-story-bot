(() => {
  'use strict';
  // Browser-local transport exercise. Never touches microphone, Bot API,
  // Telegram accounts, call rooms, contacts, or external TURN services.
  // Passing does NOT establish that two separate networks can call each other.
  const button=document.getElementById('callSelfTest');
  const output=document.getElementById('callSelfTestStatus');
  if(!button||!output)return;
  let cleanupActive=null;
  let currentEpoch=0;
  const write=(value,bad=false)=>{
    output.textContent=value;
    output.dataset.error=bad?'true':'false';
  };
  async function runLocalTest(){
    if(cleanupActive)return;
    const epoch=++currentEpoch;
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!window.RTCPeerConnection||!Context){
      write('WebRTC или WebAudio недоступны в этом браузере.',true);return;
    }
    button.disabled=true;
    write('Проверяю локальный WebRTC: аудиопоток, ICE, DTLS и канал управления…');
    let caller=null,receiver=null,audio=null,osc=null,timeoutId=0;
    const disposables=[];
    let completed=false;
    const cleanup=()=>{
      if(completed)return;
      completed=true;
      clearTimeout(timeoutId);
      for(const dispose of disposables.splice(0)){
        try{dispose();}catch{}
      }
      try{caller?.close();}catch{}
      try{receiver?.close();}catch{}
      try{osc?.stop();}catch{}
      try{audio?.close();}catch{}
      if(cleanupActive===cleanup)cleanupActive=null;
      if(epoch===currentEpoch)button.disabled=false;
    };
    cleanupActive=cleanup;
    try{
      audio=new Context();
      if(audio.state==='suspended')await audio.resume();
      if(epoch!==currentEpoch||completed)return;
      const dest=audio.createMediaStreamDestination();
      const gain=audio.createGain();
      gain.gain.value=0.0001; // silent synthetic signal, never user microphone
      osc=audio.createOscillator();osc.frequency.value=260;
      osc.connect(gain);gain.connect(dest);osc.start();
      caller=new RTCPeerConnection({iceServers:[]});
      receiver=new RTCPeerConnection({iceServers:[]});
      const tracks=dest.stream.getAudioTracks();
      if(!tracks.length)throw Error('WebAudio не создал тестовый аудиопоток');
      caller.addTrack(tracks[0],dest.stream);
      const queues=[[],[]];
      let callerReady=false,receiverReady=false;
      const flush=async(target,queue)=>{
        if(!target.remoteDescription||!queue.length)return;
        const pending=queue.splice(0);
        await Promise.all(pending.map(candidate=>target.addIceCandidate(candidate)));
      };
      caller.addEventListener('icecandidate',event=>{
        if(!event.candidate)return;
        queues[0].push(event.candidate);
        void flush(receiver,queues[0]).catch(()=>{});
      });
      receiver.addEventListener('icecandidate',event=>{
        if(!event.candidate)return;
        queues[1].push(event.candidate);
        void flush(caller,queues[1]).catch(()=>{});
      });
      const data=caller.createDataChannel('veto-local-test');
      let remoteAudio=false,pong=false;
      let resolveDone, rejectDone;
      const received=new Promise((resolve,reject)=>{
        resolveDone=resolve;rejectDone=reject;
      });
      const maybeDone=()=>{
        callerReady=caller.connectionState==='connected';
        receiverReady=receiver.connectionState==='connected';
        if(pong&&remoteAudio&&callerReady&&receiverReady)resolveDone();
      };
      receiver.addEventListener('track',e=>{
        if(e.track.kind==='audio'){remoteAudio=true;maybeDone();}
      });
      receiver.addEventListener('datachannel',event=>{
        if(event.channel.label!=='veto-local-test')return;
        event.channel.addEventListener('message',e=>{
          if(e.data==='veto-ping')event.channel.send('veto-pong');
        });
      });
      caller.addEventListener('connectionstatechange',maybeDone);
      receiver.addEventListener('connectionstatechange',maybeDone);
      data.addEventListener('open',()=>{data.send('veto-ping');});
      data.addEventListener('message',event=>{
        if(event.data==='veto-pong'){pong=true;maybeDone();}
      });
      timeoutId=setTimeout(()=>rejectDone(Error('Локальное соединение не установилось за 15 секунд')),15000);
      const offer=await caller.createOffer();
      await caller.setLocalDescription(offer);
      await receiver.setRemoteDescription(caller.localDescription);
      await flush(receiver,queues[0]);
      await receiver.setLocalDescription(await receiver.createAnswer());
      await caller.setRemoteDescription(receiver.localDescription);
      await flush(caller,queues[1]);
      await received;
      if(epoch!==currentEpoch||completed)return;
      write('✓ Локальный WebRTC работает: синтетическое аудио, ICE, защищённое соединение и ping/pong.\n' +
        'Это НЕ тест звонка через интернет и НЕ проверка TURN, Telegram-приглашений или двух телефонов.');
    }catch(error){
      if(epoch===currentEpoch&&!completed)
        write('✕ '+(error?.message||'Локальный WebRTC не прошёл тест')+
          '\nПроверь актуальность Telegram/WebView и системные ограничения.',true);
    }finally{
      cleanup();
    }
  }
  const onLeave=event=>{
    if(event.detail?.screen==='calls')return;
    currentEpoch++;
    cleanupActive?.();
  };
  const onHidden=()=>{
    if(document.hidden){currentEpoch++;cleanupActive?.();}
  };
  window.addEventListener('veto:screen-changed',onLeave);
  window.addEventListener('pagehide',()=>{currentEpoch++;cleanupActive?.();});
  document.addEventListener('visibilitychange',onHidden);
  button.addEventListener('click',runLocalTest);
})();
