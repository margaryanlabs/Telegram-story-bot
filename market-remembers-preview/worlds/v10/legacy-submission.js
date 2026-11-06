window.MarketV10 = window.MarketV10 || {};
window.MarketV10.legacy = (() => {
  // Deliberately unavailable until a real service confirms persistence,
  // moderation, publication consent, stable URLs and authenticated deletion.
  const publication = Object.freeze({
    available:false,
    async submit(){throw new Error('Публичный архив пока не подключён. История не опубликована.');}
  });
  function mount(api) {
    const esc=api.escape;
    const field=(id,label,max,placeholder,min=12)=>`<label class="field-label" for="${id}">${label}</label><textarea class="field-textarea" id="${id}" name="${id}" maxlength="${max}" minlength="${min}" required placeholder="${placeholder}"></textarea>`;
    api.drawer('LEAVE YOUR LEGACY / ЛИЧНАЯ ПАМЯТЬ',`
      <span class="v10-eyebrow">YOUR EXPERIENCE MATTERS</span><h2>За этой звездой —<br><em>ты.</em></h2>
      <p>Не результат сделки. Решение, которое изменило тебя.</p>
      <ol class="v10-form-progress" aria-label="Шаги создания истории">${['Имя','Контекст','Выбор','Итог','Урок','Просмотр'].map((x,i)=>`<li data-form-progress="${i}"><span>${i+1}</span>${x}</li>`).join('')}</ol>
      <form id="createForm" novalidate>
      <p class="v10-quiet" id="v10FormPrivacy">Сохраним только в этом браузере. Сервер публикации пока не подключён. Экспорт JSON поможет сделать резервную копию.</p>
      <fieldset data-form-step="0"><legend>01 / Как тебя запомнить?</legend>
        <label class="field-label" for="alias">Псевдоним</label><input class="field-input" id="alias" name="alias" autocomplete="nickname" minlength="2" maxlength="32" required placeholder="Например, NIGHT OWL">
        <div class="field-grid"><div><label class="field-label" for="market">Рынок</label><select class="field-select" id="market" name="market">${['CRYPTO','FOREX','STOCKS','FUTURES','OTHER'].map(x=>`<option>${x}</option>`).join('')}</select></div>
        <div><label class="field-label" for="category">Тема</label><select class="field-select" id="category" name="category">${Object.entries(window.MarketV10.data.themes).map(([v,x])=>`<option value="${v}">${x}</option>`).join('')}</select></div></div></fieldset>
      <fieldset data-form-step="1" hidden><legend>02 / До решения</legend><p>Что происходило? Чего ты ожидал или боялся?</p>${field('before','Контекст твоей истории',1200,'Без чужих имён, контактов и конфиденциальных данных.')}</fieldset>
      <fieldset data-form-step="2" hidden><legend>03 / Момент выбора</legend><p>Какое решение ты принял и почему?</p>${field('decision','Твой выбор',1200,'Расскажи о конкретном решении.')}</fieldset>
      <fieldset data-form-step="3" hidden><legend>04 / Последствия</legend><p>Что изменилось после? Что ты почувствовал?</p>${field('consequences','Что произошло',1200,'Здесь важен твой опыт, а не размер прибыли.')}</fieldset>
      <fieldset data-form-step="4" hidden><legend>05 / Что осталось</legend>${field('rule','Твой урок · одно правило на 30 дней',180,'Правило, к которому ты сможешь вернуться.',8)}
        ${field('quote','Что бы ты сказал себе до этого решения?',280,'Одна мысль, которая останется рядом со звездой.')}
        <details class="v10-capsule"><summary>Добавить послание себе через 30 дней</summary><label class="field-label" for="capsule">Личная капсула · не зашифрована</label><textarea class="field-textarea" id="capsule" name="capsule" maxlength="500" placeholder="Когда ты вернёшься к этой истории…"></textarea></details></fieldset>
      <fieldset data-form-step="5" hidden><legend>06 / Твоя история перед сохранением</legend><div id="v10LegacyReview" class="v10-legacy-review"></div>
        <label class="legacy-consent"><input type="checkbox" id="localConsent" name="localConsent" required><span>Согласен сохранить историю на этом устройстве. Понимаю, что это не публичная публикация; не включаю чужие личные данные.</span></label>
        <p class="v10-quiet">Удалить локальные истории и отметки можно в «Мой след». Очистка браузера удаляет данные. Для публичной отправки потребуются отдельное согласие, модерация и управление удалением.</p></fieldset>
      <div class="v10-honeypot" aria-hidden="true"><label for="website">Оставь поле пустым</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div>
      <p id="v10FormError" role="alert" hidden></p><p id="v10FormStatus" role="status" aria-live="polite"></p>
      <div class="v10-form-actions"><button id="v10FormBack" class="btn btn-outline" type="button" hidden>← Назад</button><button id="v10FormNext" class="btn btn-primary" type="button">Продолжить ↗</button><button id="v10FormSave" class="btn btn-primary" type="submit" hidden>Сохранить мою звезду ✦</button></div>
      </form>`);
    const drawer=document.getElementById('drawer');drawer.classList.add('v10-legacy');
    const form=document.getElementById('createForm');
    const steps=[...form.querySelectorAll('[data-form-step]')];
    let current=0,busy=false;
    const next=document.getElementById('v10FormNext'),back=document.getElementById('v10FormBack'),save=document.getElementById('v10FormSave');
    function valid(step) {
      for(const input of steps[step].querySelectorAll('input,textarea,select')){
        if(typeof input.value==='string' && input.type!=='checkbox') input.value=input.value.trim();
        if(!input.checkValidity()){input.reportValidity();input.focus();return false;}
      }
      return true;
    }
    function show(index,focus=true) {
      current=index;steps.forEach((step,i)=>step.hidden=i!==current);
      document.querySelectorAll('[data-form-progress]').forEach((el,i)=>{el.classList.toggle('is-current',i===index);el.setAttribute('aria-current',i===index?'step':'false');});
      next.hidden=index===5;save.hidden=index!==5;back.hidden=index===0;
      document.getElementById('v10FormError').hidden=true;
      if(index===5) {
        const values=new FormData(form);
        document.getElementById('v10LegacyReview').innerHTML='<strong>@'+esc(values.get('alias'))+'</strong><blockquote>«'+esc(values.get('quote'))+'»</blockquote>'+['before','decision','consequences','rule'].map((key,i)=>'<section><h3>'+window.MarketV10.data.labels[i]+'</h3><p>'+esc(values.get(key))+'</p></section>').join('');
      }
      if(focus){const target=steps[index].querySelector('input,textarea,select')||steps[index];if(target===steps[index])target.tabIndex=-1;target.focus({preventScroll:true});steps[index].scrollIntoView({block:'start',behavior:'instant'});}
      document.getElementById('v10FormStatus').textContent='Шаг '+(index+1)+' из 6';
    }
    next.onclick=()=>{if(valid(current))show(current+1);};back.onclick=()=>show(Math.max(0,current-1));
    form.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.tagName==='INPUT'&&event.target.type!=='checkbox'){event.preventDefault();if(current<5)next.click();}});
    form.addEventListener('submit',event=>{
      event.preventDefault();if(busy)return;
      if(current!==5){next.click();return;}
      for(let i=0;i<steps.length;i++){if(!valid(i)){show(i);valid(i);return;}}
      if(form.elements.website.value)return;
      busy=true;save.disabled=true;
      const data=new FormData(form);
      // Preserve old story/quote/export contracts; chapters carry the full account.
      data.set('story',String(data.get('before')).slice(0,1200));
      const succeeded=api.save(data);
      if(!succeeded){
        busy=false;save.disabled=false;
        const error=document.getElementById('v10FormError');error.hidden=false;
        error.textContent='Не удалось сохранить историю. Она не опубликована. Проверь доступ к хранилищу браузера и повтори попытку; текст остаётся в форме.';
        error.tabIndex=-1;error.focus();
      }
    });
    show(0,false);
  }
  return {mount,publication};
})();
