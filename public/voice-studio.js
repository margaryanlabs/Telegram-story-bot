(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const audioSupported=Boolean((window.AudioContext||window.webkitAudioContext)
    && navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  const presets={
    clean:{name:'Original',low:0,high:0,mid:0,robot:0,echo:0},
    deep:{name:'Deep',low:10,high:-5,mid:-1,robot:0,echo:0},
    cinematic:{name:'Cinematic',low:7,high:2,mid:3,robot:0,echo:.14},
    radio:{name:'Radio',low:-7,high:-8,mid:9,robot:0,echo:0},
    robot:{name:'Robot',low:1,high:-3,mid:2,robot:.48,echo:.06},
    space:{name:'Echo',low:2,high:0,mid:-1,robot:0,echo:.42},
  };
  const state={
    context:null,stream:null,source:null,nodes:null,oscillator:null,
    recorder:null,chunks:[],recordedBlob:null,recordedUrl:null,
    preset:'clean',morph:75,active:false,recording:false,
    startedAt:0,raf:0,monitor:false,opening:false,micEpoch:0,
  };
  const extFor=mime=>mime.includes('mp4')?'m4a':mime.includes('ogg')?'ogg':'webm';
  const toast=message=>{
    const el=$('voiceStatus');if(el){el.textContent=String(message);el.dataset.state='visible';}
  };
  function updateButtons(){
    $('voiceMicButton').disabled=!audioSupported||state.active||state.opening;
    $('voiceMicStop').disabled=!state.active;
    $('voiceRecord').disabled=!state.active||state.recording;
    $('voiceStopRecord').disabled=!state.recording;
    $('voiceShare').disabled=!state.recordedBlob;
    $('voiceDownload').disabled=!state.recordedBlob;
    $('voiceMorphValue').textContent=String(state.morph)+'%';
    $('voicePresetGrid')?.querySelectorAll('[data-voice-preset]').forEach(btn=>{
      const active=btn.dataset.voicePreset===state.preset;
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-pressed',String(active));
    });
    $('voiceMicState').textContent=state.recording?'● Запись':
      state.active?'● Микрофон включён':'◌ Микрофон выключен';
    $('voiceMicState').classList.toggle('live',state.active);
    $('voiceMicState').classList.toggle('recording',state.recording);
  }
  function setStrength(){
    const n=state.nodes;
    if(!n||!state.context)return;
    const profile=presets[state.preset]||presets.clean;
    const k=Math.max(0,Math.min(1,state.morph/100));
    const now=state.context.currentTime;
    const smooth=(param,value)=>param.setTargetAtTime(value,now,.07);
    smooth(n.low.gain,profile.low*k);
    smooth(n.mid.gain,profile.mid*k);
    smooth(n.high.gain,profile.high*k);
    smooth(n.robotGain.gain,profile.robot*k);
    smooth(n.tremolo.gain,1-profile.robot*k);
    smooth(n.wet.gain,profile.echo*k);
    smooth(n.feedback.gain,Math.min(.32,profile.echo*k*.65));
    smooth(n.output.gain,.9);
  }
  function draw(){
    const canvas=$('voiceSpectrum');
    if(!canvas)return;
    const ctx=canvas.getContext('2d');
    if(!ctx)return;
    const {width:w,height:h}=canvas;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#090d13';ctx.fillRect(0,0,w,h);
    const bins=new Uint8Array(state.nodes?.analyser?.frequencyBinCount||512);
    state.nodes?.analyser?.getByteTimeDomainData(bins);
    const hasAudio=state.active&&state.nodes?.analyser;
    const stride=w/90,center=h*.51;
    for(let i=0;i<90;i++){
      const value=hasAudio
        ?Math.abs((bins[Math.floor(i*bins.length/90)]||128)-128)/128
        :Math.abs(Math.sin((i*2.15)+(Date.now()/2500)))*.085;
      const height=5+Math.max(.06,value)*h*.68;
      const edge=Math.abs(i-44.5)/44.5;
      const alpha=.32+.55*(1-edge);
      ctx.fillStyle='rgba(186,210,237,'+alpha.toFixed(2)+')';
      ctx.fillRect(i*stride+2,center-height/2,Math.max(2,stride-3),height);
    }
    state.raf=requestAnimationFrame(draw);
  }
  function stopMonitor(){
    if(!state.nodes||!state.context)return;
    try{state.nodes.analyser.disconnect(state.context.destination)}catch{}
    state.monitor=false;
    if($('voiceMonitor'))$('voiceMonitor').checked=false;
  }
  function stopMic(){
    state.micEpoch++;state.opening=false;
    if(state.recording){try{state.recorder?.stop()}catch{};state.recording=false;}
    stopMonitor();
    if(state.oscillator){try{state.oscillator.stop()}catch{}}
    if(state.stream)state.stream.getTracks().forEach(track=>track.stop());
    if(state.source){try{state.source.disconnect()}catch{}}
    if(state.context){state.context.close().catch(()=>{});}
    state.context=null;state.stream=null;state.nodes=null;state.oscillator=null;
    state.recorder=null;state.source=null;state.active=false;
    cancelAnimationFrame(state.raf);state.raf=0;
    updateButtons();
  }
  async function startMic(){
    if(state.active||!audioSupported){
      if(!audioSupported)toast('В этом WebView запись пока недоступна. Открой VETO в актуальном Telegram на Android или iOS.');
      return;
    }
    if(state.opening||document.hidden)return;
    const epoch=++state.micEpoch;
    state.opening=true;
    $('voiceMicButton').disabled=true;
    toast('Запрашиваю разрешение на микрофон…');
    let stream=null,context=null,oscillator=null;
    try{
      // Only initiated by a real tap. Neither audio nor microphone data goes to our server.
      stream=await navigator.mediaDevices.getUserMedia({audio:{
        echoCancellation:true,noiseSuppression:true,autoGainControl:false,
        channelCount:1,
      },video:false});
      if(epoch!==state.micEpoch||document.hidden||
        document.querySelector('.screen.active')?.dataset?.screen!=='voice')
        throw Error('MIC_CANCELLED');
      const AudioContextClass=window.AudioContext||window.webkitAudioContext;
      context=new AudioContextClass();
      await context.resume();
      if(epoch!==state.micEpoch||document.hidden||
        document.querySelector('.screen.active')?.dataset?.screen!=='voice')
        throw Error('MIC_CANCELLED');
      const source=context.createMediaStreamSource(stream);
      const highpass=context.createBiquadFilter();highpass.type='highpass';highpass.frequency.value=75;
      const low=context.createBiquadFilter();low.type='lowshelf';low.frequency.value=250;
      const mid=context.createBiquadFilter();mid.type='peaking';mid.frequency.value=1850;mid.Q.value=1;
      const high=context.createBiquadFilter();high.type='highshelf';high.frequency.value=4200;
      const tremolo=context.createGain();tremolo.gain.value=1;
      oscillator=context.createOscillator();oscillator.type='sine';oscillator.frequency.value=35;
      const robotGain=context.createGain();robotGain.gain.value=0;
      oscillator.connect(robotGain);robotGain.connect(tremolo.gain);oscillator.start();
      const compressor=context.createDynamicsCompressor();
      compressor.threshold.value=-21;compressor.knee.value=23;compressor.ratio.value=2.8;
      compressor.attack.value=.003;compressor.release.value=.22;
      const output=context.createGain();output.gain.value=.9;
      const delay=context.createDelay(.75);delay.delayTime.value=.19;
      const feedback=context.createGain();feedback.gain.value=0;
      const wet=context.createGain();wet.gain.value=0;
      const analyser=context.createAnalyser();analyser.fftSize=1024;
      const destination=context.createMediaStreamDestination();
      source.connect(highpass);highpass.connect(low);low.connect(mid);mid.connect(high);
      high.connect(tremolo);tremolo.connect(compressor);compressor.connect(output);
      output.connect(analyser);compressor.connect(delay);
      delay.connect(feedback);feedback.connect(delay);delay.connect(wet);wet.connect(analyser);
      analyser.connect(destination);
      state.context=context;state.stream=stream;state.source=source;state.oscillator=oscillator;
      state.nodes={low,mid,high,tremolo,robotGain,compressor,delay,feedback,wet,output,analyser,destination};
      state.active=true;setStrength();
      toast('Микрофон включён. Выбери эффект и нажми «Начать запись». Звук обрабатывается на устройстве.');
      updateButtons();
      if(!state.raf)draw();
    }catch(error){
      stream?.getTracks()?.forEach(t=>t.stop());
      try{oscillator?.stop();}catch{}
      context?.close().catch(()=>{});
      if(error?.message==='MIC_CANCELLED')return;
      const denied=error?.name==='NotAllowedError'||error?.name==='PermissionDeniedError';
      toast(denied?'Telegram не разрешил доступ к микрофону. Разреши его в настройках приложения.':
        'Не удалось открыть микрофон. Проверь разрешения и попробуй ещё раз.');
      updateButtons();
    }finally{
      if(epoch===state.micEpoch){state.opening=false;updateButtons();}
    }
  }
  function releaseRecording(){
    if(state.recordedUrl)URL.revokeObjectURL(state.recordedUrl);
    state.recordedUrl=null;state.recordedBlob=null;
    $('voicePlayer').removeAttribute('src');
    $('voiceResult').hidden=true;
    updateButtons();
  }
  function startRecording(){
    if(!state.active||state.recording||!state.nodes)return;
    releaseRecording();
    const options=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus']
      .find(type=>window.MediaRecorder.isTypeSupported?.(type));
    let recorder;
    try{recorder=new MediaRecorder(state.nodes.destination.stream,options?{mimeType:options}:{});
    }catch{toast('Формат записи не поддерживается на этом телефоне');return;}
    const chunks=[];const started=Date.now();
    recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data);};
    recorder.onerror=()=>toast('Ошибка записи. Перезапусти микрофон и повтори.');
    recorder.onstop=()=>{
      const blob=new Blob(chunks,{type:recorder.mimeType||options||'audio/webm'});
      state.recorder=null;state.recording=false;
      if(blob.size){
        state.recordedBlob=blob;state.recordedUrl=URL.createObjectURL(blob);
        $('voicePlayer').src=state.recordedUrl;
        $('voiceResult').hidden=false;
        const seconds=Math.max(1,Math.round((Date.now()-started)/1000));
        $('voiceDuration').textContent=seconds+' с · '+Math.max(1,Math.round(blob.size/1024))+' КБ';
        toast('Запись готова. Прослушай, скачай или отправь через системное меню.');
      }else toast('Запись пустая. Повтори с включённым микрофоном.');
      updateButtons();
    };
    state.recorder=recorder;state.recording=true;state.startedAt=Date.now();
    recorder.start(250);
    toast('Идёт запись голоса с выбранным эффектом. Она остаётся только на этом устройстве.');
    updateButtons();
  }
  function stopRecording(){
    if(state.recording&&state.recorder?.state!=='inactive'){
      try{state.recorder.stop()}catch{}state.recording=false;
      updateButtons();
    }
  }
  function downloadRecording(){
    if(!state.recordedBlob||!state.recordedUrl)return;
    const a=document.createElement('a');
    a.href=state.recordedUrl;
    a.download='veto-voice-'+new Date().toISOString().slice(0,10)+'.'+extFor(state.recordedBlob.type);
    a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
  }
  async function shareRecording(){
    if(!state.recordedBlob)return;
    if(typeof File!=='function'){
      toast('Этот WebView не поддерживает отправку файлов. Используй «Скачать».');return;
    }
    const file=new File([state.recordedBlob],
      'veto-voice.'+extFor(state.recordedBlob.type),{type:state.recordedBlob.type});
    if(typeof navigator.share==='function'&&navigator.canShare?.({files:[file]})){
      try{await navigator.share({files:[file],title:'VETO · голосовое сообщение'});}
      catch(error){if(error?.name!=='AbortError')toast('Отправка недоступна. Скачай файл и прикрепи в Telegram.');}
    }else{
      toast('Системная отправка файлов недоступна в этом WebView. Скачай голосовое и прикрепи в Telegram.');
    }
  }
  $('voiceMicButton')?.addEventListener('click',startMic);
  $('voiceMicStop')?.addEventListener('click',()=>{
    stopMic();toast('Микрофон выключен. Никаких фоновых записей нет.');
  });
  $('voiceRecord')?.addEventListener('click',startRecording);
  $('voiceStopRecord')?.addEventListener('click',stopRecording);
  $('voiceShare')?.addEventListener('click',shareRecording);
  $('voiceDownload')?.addEventListener('click',downloadRecording);
  $('voicePresetGrid')?.addEventListener('click',event=>{
    const el=event.target.closest('[data-voice-preset]');
    const preset=el?.dataset.voicePreset;
    if(!Object.hasOwn(presets,preset))return;
    state.preset=preset;setStrength();updateButtons();
    toast(presets[preset].name+' · эффект готов'+(state.active?' · меняется в реальном времени':''));
  });
  $('voiceMorph')?.addEventListener('input',event=>{
    state.morph=Math.max(0,Math.min(100,Number(event.target.value||0)));
    setStrength();updateButtons();
  });
  $('voiceMonitor')?.addEventListener('change',event=>{
    if(!state.nodes||!state.context){
      event.target.checked=false;toast('Сначала включи микрофон.');return;
    }
    if(event.target.checked){
      state.nodes.analyser.connect(state.context.destination);state.monitor=true;
      toast('Мониторинг звука включён. Используй наушники, иначе будет эхо.');
    }else{stopMonitor();toast('Мониторинг выключен. Запись обработанного голоса доступна.');}
  });
  window.addEventListener('veto:screen-changed',event=>{
    if(event.detail?.screen!=='voice'&&(state.active||state.opening)){
      stopMic();
      toast('Микрофон выключен при выходе из Voice Studio.');
    }
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&(state.active||state.opening)){
      stopMic();
      toast('Telegram свернут. Микрофон отключён.');
    }
  });
  window.addEventListener('pagehide',()=>{
    stopMic();releaseRecording();cancelAnimationFrame(state.raf);state.raf=0;
  });
  updateButtons();
  if(!audioSupported)toast('Микрофон и запись в этом WebView не поддерживаются. Нужна актуальная версия Telegram.');
})();
