/* Vetogram Play: opt-in developer proposal composer, never an automatic upload. */
(() => {
  'use strict';
  const root = document.querySelector('.screen[data-screen="play"]');
  if (!root) return;
  const $ = selector => root.querySelector(selector);
  const form = $('#vpDeveloperForm');
  const output = $('#vpDeveloperDraftLink');
  const status = $('#vpDeveloperStatus');
  if (!form || !output) return;
  const setStatus = message => { if(status)status.textContent=message; };
  const clean = (value,max) => String(value||'').trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max);
  function buildIssue(values) {
    const name=clean(values.name,70);
    const description=clean(values.description,400);
    const sourceText=clean(values.source,250);
    const mode=clean(values.mode,30);
    if(name.length<2 || description.length<15)throw new Error('Укажи название и описание игры.');
    if(!['solo','local-multiplayer','remote-multiplayer'].includes(mode))throw new Error('Неподдерживаемый режим.');
    let source;
    try { source = new URL(sourceText); } catch { throw new Error('Укажи действительную HTTPS-ссылку.'); }
    if(source.protocol!=='https:' || !source.hostname || source.username || source.password || source.hash){
      throw new Error('Нужна публичная HTTPS-ссылка без логина, пароля или фрагмента.');
    }
    if(source.hostname==='localhost' || source.hostname.endsWith('.local') || /^127\./.test(source.hostname)){
      throw new Error('Локальные адреса не подходят для заявок.');
    }
    const issue = new URL('https://github.com/margaryanlabs/Telegram-story-bot/issues/new');
    issue.searchParams.set('title','[Play] '+name);
    issue.searchParams.set('body',[
      '## Vetogram Play — предложение игры',
      '',
      '**Название:** '+name,
      '**Ссылка на код или демо:** '+source.toString(),
      '**Режим:** '+mode,
      '',
      '### Геймплей, права на ассеты и использование данных',
      description,
      '',
      '### Перед публикацией',
      '- [ ] Подтверждаю право использовать код и ассеты.',
      '- [ ] Укажу все внешние SDK, аналитику, сетевые обращения и необходимые разрешения.',
      '- [ ] Понимаю, что публикация возможна только после проверки и одобрения.'
    ].join('\n'));
    return issue.toString();
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    output.hidden=true;
    output.removeAttribute('href');
    try {
      const url=buildIssue({
        name:$('#vpDeveloperName')?.value,
        source:$('#vpDeveloperRepo')?.value,
        mode:$('#vpDeveloperMode')?.value,
        description:$('#vpDeveloperPitch')?.value,
      });
      output.href=url;
      output.hidden=false;
      setStatus('Заявка подготовлена локально. Проверь поля и открой GitHub по ссылке. Ничего не отправлено.');
    } catch(error){
      setStatus(error instanceof Error?error.message:'Не удалось подготовить заявку.');
    }
  });
  form.addEventListener('input',()=>{
    output.hidden=true;
    output.removeAttribute('href');
    setStatus('');
  });
})();
