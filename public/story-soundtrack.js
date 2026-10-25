// Local sound preview and a short canvas clip. No microphone or network access.
export function setupStorySoundtrack({paint, scope, isCurrent, notify}) {
  const $ = id => document.getElementById(id);
  const player = $('seMusicPlayer');
  let url = null, recording = null, epoch = 0, controller = null;
  function stop() {
    epoch++;
    if (controller) controller.cancelled = true;
    if (recording?.state === 'recording') recording.stop();
    player.pause();
    $('seMusicExport').disabled = !url;
  }
  function clear() {
    stop();
    if (url) URL.revokeObjectURL(url);
    url = null; player.removeAttribute('src'); player.load(); player.hidden = true;
    $('seMusicExport').disabled = true; $('seMusicName').textContent = 'Звук не выбран';
    $('seMusicFile').value = '';
  }
  $('seMusicPick').addEventListener('click', () => $('seMusicFile').click());
  $('seMusicClear').addEventListener('click', clear);
  $('seMusicFile').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    clear();
    if (!/^audio\//.test(file.type) || file.size > 15 * 1024 * 1024) {
      notify('Выбери аудиофайл до 15 МБ.', true); return;
    }
    url = URL.createObjectURL(file); player.src = url; player.hidden = false;
    $('seMusicName').textContent = file.name;
    $('seMusicExport').disabled = false;
    notify('Звук выбран локально. Прослушай или скачай короткий клип. В JPEG звука нет.');
  });
  player.addEventListener('error', () => { stop(); notify('Этот аудиоформат не поддерживается устройством.', true); });
  $('seMusicExport').addEventListener('click', async () => {
    const active = scope();
    if (!url || recording?.state === 'recording' || !isCurrent(active)) return;
    const output = document.createElement('canvas'); output.width = 720; output.height = 1280;
    const Audio = window.AudioContext || window.webkitAudioContext;
    const mime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus']
      .find(type => window.MediaRecorder?.isTypeSupported?.(type));
    if (!mime || !output.captureStream || !Audio) {
      notify('Экспорт видео со звуком недоступен в этом браузере. JPEG и предпросмотр остаются доступны.', true); return;
    }
    const job = {cancelled: false}; controller = job;
    const run = ++epoch; let context, stream, timeout, recorder, source;
    $('seMusicExport').disabled = true;
    try {
      paint(output);
      context = new Audio(); await context.resume();
      if (run !== epoch || !isCurrent(active)) return;
      // A separate audio element permits a new MediaElementSource on each export.
      source = new window.Audio(url); source.preload = 'auto';
      const node = context.createMediaElementSource(source);
      const destination = context.createMediaStreamDestination(); node.connect(destination);
      stream = output.captureStream(15);
      for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
      recorder = new MediaRecorder(stream, {mimeType: mime, videoBitsPerSecond: 2500000});
      recording = recorder;
      const chunks = [];
      const completed = new Promise((resolve, reject) => {
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onstop = resolve; recorder.onerror = () => reject(Error('Не удалось записать клип.'));
      });
      source.addEventListener('ended', () => { if (recorder.state === 'recording') recorder.stop(); }, {once: true});
      recorder.start(250); await source.play();
      if (run !== epoch || !isCurrent(active)) { job.cancelled = true; if (recorder.state === 'recording') recorder.stop(); }
      notify('Записываем клип до 8 секунд. Оставайся на этом экране.');
      timeout = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 8000);
      await completed;
      if (job.cancelled || run !== epoch || !isCurrent(active)) return;
      const blob = new Blob(chunks, {type: recorder.mimeType});
      if (!blob.size) throw Error('Клип не записан. Попробуй другой аудиофайл.');
      const result = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = result;
      link.download = mime.startsWith('video/mp4') ? 'vetogram-story.mp4' : 'vetogram-story.webm'; link.click();
      setTimeout(() => URL.revokeObjectURL(result), 5000);
      notify('Клип скачан. Отправь его в Telegram вручную; этот редактор передаёт в публикацию только JPEG.');
    } catch (error) {
      if (run === epoch && isCurrent(active)) notify(error.message || 'Экспорт видео недоступен.', true);
    } finally {
      clearTimeout(timeout);
      if (recorder?.state === 'recording') recorder.stop();
      source?.pause(); stream?.getTracks().forEach(track => track.stop());
      try { await context?.close(); } catch {}
      if (run === epoch) { recording = null; controller = null; $('seMusicExport').disabled = !url; }
    }
  });
  window.addEventListener('veto:screen-changed', event => { if (event.detail?.screen !== 'story-engine') stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', clear);
  return {clear};
}
