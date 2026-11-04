window.MarketV10 = window.MarketV10 || {};
window.MarketV10.reader = (() => {
  let sections=[],buttons=[],scrollFrame=0,progress=null;
  function update() {
    scrollFrame=0;
    const drawer=document.getElementById('drawer');
    if(drawer.hidden||!sections.length)return;
    const top=drawer.getBoundingClientRect().top+Math.min(190,drawer.clientHeight*.27);
    let current=0;
    sections.forEach((s,i)=>{if(s.getBoundingClientRect().top<=top)current=i;});
    buttons.forEach((button,i)=>{button.classList.toggle('is-current',i===current);button.setAttribute('aria-current',i===current?'step':'false');});
    if(progress){
      const bar=progress.querySelector('.v113-progress-fill');
      const label=progress.querySelector('.v113-progress-label');
      if(bar)bar.style.width=((current+1)/sections.length*100).toFixed(1)+'%';
      if(label)label.textContent='ГЛАВА '+String(current+1).padStart(2,'0')+' / '+String(sections.length).padStart(2,'0')+' · '+window.MarketV10.data.labels[current];
      progress.setAttribute('aria-valuenow',String(current+1));
    }
    const stage=drawer.querySelector('.v93-reader-stage');
    if(stage)stage.textContent='0'+(current+1)+' / '+window.MarketV10.data.labels[current].toUpperCase();
  }
  function init() {
    document.getElementById('drawer').addEventListener('scroll',()=>{
      if(!scrollFrame)scrollFrame=requestAnimationFrame(update);
    },{passive:true});
  }
  function jumpToChapter(index){
    const section=sections[index];if(!section)return;
    const drawer=document.getElementById('drawer');
    const nav=drawer.querySelector('.v10-chapter-nav');
    const head=drawer.querySelector('.drawer-head');
    const sticky=(nav?.offsetHeight||72)+(head?.offsetHeight||50)+12;
    const offset=section.getBoundingClientRect().top-drawer.getBoundingClientRect().top+drawer.scrollTop-sticky;
    drawer.scrollTo({top:Math.max(0,offset),behavior:window.MarketV10.motion.reduced?'instant':'smooth'});
    section.focus({preventScroll:true});
    window.MarketV10.motion.reveal(section);
  }
  function mount(record,api) {
    sections=[];buttons=[];progress=null;
    const drawer=document.getElementById('drawer');
    const article=drawer.querySelector('.memory-experience');
    if(!article)return;
    drawer.classList.add('v10-reader');
    // Sourced quotations keep their original context, source and editorial disclaimer.
    if(record.type!=='legend') {
      const title=document.getElementById('memoryTitle');
      title.textContent='@'+record.alias;
      const abstract=document.createElement('p');abstract.className='v10-story-abstract';
      abstract.textContent='«'+String(record.quote||'').replace(/[«»]/g,'')+'»';
      title.after(abstract);
      const overview=document.createElement('div');overview.className='v113-story-overview';
      const tag=document.createElement('span');tag.className='v113-story-provenance';
      tag.textContent=window.MarketV10.data.provenance(record);
      const context=document.createElement('p');context.className='v113-story-context';
      const category=window.MarketV10.data.themes[record.category]||String(record.category||'Опыт');
      context.textContent=[category,String(record.market||'').trim()].filter(Boolean).join(' · ')+' / Четыре главы. Отсутствующие детали не выдуманы.';
      overview.append(tag,context);
      progress=document.createElement('div');progress.className='v113-chapter-progress';
      progress.setAttribute('role','progressbar');progress.setAttribute('aria-label','Прогресс чтения по главам');
      progress.setAttribute('aria-valuemin','1');progress.setAttribute('aria-valuemax','4');progress.setAttribute('aria-valuenow','1');
      const progressLabel=document.createElement('span');progressLabel.className='v113-progress-label';
      progressLabel.textContent='ГЛАВА 01 / 04 · До решения';
      const track=document.createElement('span');track.className='v113-progress-track';track.setAttribute('aria-hidden','true');
      const fill=document.createElement('span');fill.className='v113-progress-fill';track.append(fill);
      progress.append(progressLabel,track);
      article.querySelector('.human-profile')?.remove();
      article.querySelector('.human-story-label')?.remove();
      article.querySelector('.museum-chapter-nav')?.remove();
      article.querySelectorAll('.human-journey-step,.memory-section').forEach(el=>el.remove());
      const nav=document.createElement('nav');nav.className='v10-chapter-nav';nav.setAttribute('aria-label','Главы истории');
      const container=document.createElement('div');container.className='v10-story-chapters';
      window.MarketV10.data.chapters(record).forEach((chapter,i)=>{
        const section=document.createElement('section');section.className='v10-chapter';section.id='v10-chapter-'+chapter.key;
        section.dataset.chapter=chapter.key;section.tabIndex=-1;
        const eyebrow=document.createElement('span');eyebrow.className='v10-eyebrow';eyebrow.textContent='CHAPTER '+chapter.number+' / '+chapter.english.toUpperCase();
        const heading=document.createElement('h3');heading.textContent=chapter.label;
        const copy=document.createElement('p');copy.textContent=chapter.text||'Этот этап не описан в исходной записи.';
        if(chapter.missing)copy.className='v10-missing';
        section.append(eyebrow,heading);
        if(chapter.legacy){const note=document.createElement('small');note.className='v10-source-note';note.textContent='Исходная история сохранена целиком; автор не разделял её на этапы.';section.append(note);}
        section.append(copy);
        if(i<3){
          const next=document.createElement('button');next.type='button';next.className='v113-next-chapter';
          next.textContent='Продолжить · '+window.MarketV10.data.labels[i+1]+' →';
          next.setAttribute('aria-label','Перейти к главе '+(i+2)+': '+window.MarketV10.data.labels[i+1]);
          next.onclick=()=>jumpToChapter(i+1);
          section.append(next);
        }
        container.append(section);sections.push(section);
        const button=document.createElement('button');button.type='button';button.dataset.v10Chapter=String(i);
        const number=document.createElement('span');number.textContent=chapter.number;
        const label=document.createElement('strong');label.textContent=chapter.label;
        button.append(number,label);button.setAttribute('aria-controls',section.id);
        button.setAttribute('aria-current',i===0?'step':'false');
        button.onclick=()=>jumpToChapter(i);
        buttons.push(button);nav.append(button);
      });
      abstract.after(overview,progress,nav,container);
      const ending=document.createElement('section');ending.className='v113-story-ending';
      const endingTag=document.createElement('span');endingTag.className='v10-eyebrow';
      endingTag.textContent='BEYOND THIS MEMORY / ТЕМАТИЧЕСКОЕ ПРОДОЛЖЕНИЕ';
      const endingTitle=document.createElement('h3');endingTitle.textContent='У каждой истории есть продолжение.';
      const endingNote=document.createElement('p');endingNote.textContent='Другие записи связаны общими темами и уроками, а не личными знакомствами.';
      ending.append(endingTag,endingTitle,endingNote);
      const related=api.related(record);
      if(related.length&&related[0].story){
        const linked=related[0];
        const nextStory=document.createElement('button');nextStory.className='v113-related-action';nextStory.type='button';
        nextStory.textContent='Открыть связанную звезду · @'+linked.story.alias+' ↗';
        nextStory.setAttribute('aria-label','Перейти к связанной истории '+linked.story.alias);
        nextStory.onclick=()=>api.follow(linked.index,linked.relation);
        ending.append(nextStory);
      }
      container.after(ending);
      const provenance=article.querySelector('.memory-disclaimer');
      if(provenance)provenance.textContent=window.MarketV10.data.provenance(record)+(record.local?'. Публичная публикация не выполнялась.':'. Не биография реального человека.');
    }
    const link=document.createElement('button');link.type='button';link.className='v10-permalink';
    link.textContent=record.local?'Скопировать ссылку · только для этого браузера':'Скопировать ссылку на звезду ↗';
    link.onclick=async()=>{
      try {await navigator.clipboard.writeText(window.MarketV10.data.permalink(record));api.toast(record.local?'Ссылка открывается только там, где сохранена личная запись.':'Ссылка на звезду скопирована.');}
      catch {api.toast('Копирование недоступно. Ссылка на эту звезду находится в адресной строке.');}
    };
    document.getElementById('saveLesson')?.after(link);
    if(record.local){const privacy=document.createElement('p');privacy.className='v10-quiet';privacy.textContent='Стабильный ID: '+record.id+'. Ссылка не переносит историю на другое устройство; для переноса используй экспорт JSON.';link.after(privacy);}
    window.MarketV10.constellations.mount(record,api);
    update();
  }
  return {init,mount};
})();
