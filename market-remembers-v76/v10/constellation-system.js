/* MARKET REMEMBERS V11.7 — explainable constellations.
 * Editorial topic links only. No inferred real-world relationship,
 * no new graph database, network requests, or fabricated social edges.
 */
window.MarketV10 = window.MarketV10 || {};
window.MarketV10.constellations = (() => {
  const positions=[[18,59],[50,75],[82,59]];
  const themes=()=>window.MarketV10.data.themes;
  const topic=record=>themes()[record.category]||String(record.category||'Опыт');
  const clean=value=>String(value??'').trim();
  function explain(source,target,relation){
    if(!source||!target)return '';
    const from=topic(source),to=topic(target);
    let reason='';
    if(relation==='Общая тема'&&source.category===target.category){
      reason='Обе записи относятся к одной редакционной категории: «'+from+'». Это сходство тем, а не общее событие.';
    }else if(relation==='Следующий урок'){
      reason='Редакционная последовательность сопоставляет тему «'+from+'» с темой «'+to+'». Это маршрут чтения, не причинно-следственная связь между людьми.';
    }else if(relation==='Редакционный взгляд'&&target.type==='editorial'){
      reason='Другая редакционная история показывает тему «'+to+'» с отдельной точки зрения. Персонаж и сюжет вымышлены.';
    }else{
      reason='Дополнительная запись доступного архива: тема «'+to+'». Связь навигационная, не биографическая.';
    }
    const a=clean(source.market),b=clean(target.market);
    if(a&&b&&a===b)reason+=' В обеих записях указан рынок «'+a.slice(0,90)+'».';
    return reason;
  }
  function node(tag,cls,content){
    const element=document.createElement(tag);
    if(cls)element.className=cls;
    if(content!=null)element.textContent=content;
    return element;
  }
  function mount(source,api){
    const host=document.querySelector('.v77-threads');
    if(!host||api.guided())return;
    const records=api.related(source).filter(item=>item?.story&&Number.isInteger(item.index)).slice(0,3);
    if(!records.length)return;
    host.replaceChildren();
    host.classList.add('v10-constellation','v117-constellation');

    const eyebrow=node('span','v10-eyebrow','CONSTELLATION / ОБЪЯСНИМЫЕ СВЯЗИ');
    const title=node('h3',null,'Почему эти звёзды рядом?');
    const note=node('p','v10-quiet',
      'Линии показывают редакционные тематические переходы между записями. Это не знакомство, родство или общий опыт реальных людей.');
    const map=node('div','v10-constellation-map v117-constellation-map');
    map.setAttribute('role','group');
    map.setAttribute('aria-label','Тематическое созвездие '+source.alias);

    const ns='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 600 260');
    svg.setAttribute('preserveAspectRatio','none');
    svg.setAttribute('aria-hidden','true');

    const center=node('div','v10-constellation-origin v117-origin');
    const core=node('span',null,'✧');core.setAttribute('aria-hidden','true');
    const name=node('strong',null,'@'+clean(source.alias).slice(0,80));
    const badge=node('small',null,'ИСТОЧНИК ПУТИ');
    center.append(core,name,badge);

    const evidence=node('section','v117-evidence');
    evidence.setAttribute('aria-label','Объяснение тематической связи');
    const evidenceEyebrow=node('span','v117-evidence-eyebrow','ПРИЧИНА СВЯЗИ / 01');
    const evidenceName=node('h4','v117-evidence-title');
    const evidenceBody=node('p','v117-evidence-body');
    const evidenceKind=node('p','v117-evidence-kind');
    evidence.setAttribute('aria-live','polite');
    evidence.append(evidenceEyebrow,evidenceName,evidenceBody,evidenceKind);
    const controls=node('div','v117-related-rows');
    controls.setAttribute('role','group');
    controls.setAttribute('aria-label','Переходы к связанным записям');

    const paths=[],stars=[],inspectors=[];
    function select(i){
      const entry=records[i];if(!entry)return;
      const target=entry.story;
      evidenceEyebrow.textContent='ПРИЧИНА СВЯЗИ / '+String(i+1).padStart(2,'0');
      evidenceName.textContent=clean(entry.relation)+' · @'+clean(target.alias);
      evidenceBody.textContent=explain(source,target,entry.relation);
      evidenceKind.textContent=window.MarketV10.data.provenance(target);
      paths.forEach((path,k)=>path.classList.toggle('is-active',k===i));
      stars.forEach((star,k)=>star.classList.toggle('is-highlighted',k===i));
      inspectors.forEach((button,k)=>button.setAttribute('aria-pressed',String(k===i)));
    }
    records.forEach((entry,i)=>{
      const target=entry.story;
      const [x,y]=positions[i];
      const path=document.createElementNS(ns,'path');
      path.setAttribute('d','M 300 48 Q '+(x*6)+' 88 '+(x*6)+' '+(y*2.6));
      svg.append(path);paths.push(path);

      const button=node('button','v10-constellation-star v117-star');
      button.type='button';
      button.style.left=x+'%';button.style.top=y+'%';
      button.setAttribute('aria-label','Открыть '+target.alias+'. '+entry.relation+': '+topic(target));
      const glyph=node('span','v10-node-glyph','✦');
      glyph.setAttribute('aria-hidden','true');
      const label=node('strong',null,'@'+clean(target.alias).slice(0,80));
      const topicLabel=node('small',null,topic(target));
      button.append(glyph,label,topicLabel);
      button.onfocus=()=>select(i);
      button.onmouseenter=()=>select(i);
      button.onclick=()=>api.follow(entry.index,entry.relation);
      map.append(button);stars.push(button);

      const row=node('div','v117-link-row');
      const text=node('div','v117-link-description');
      const labelStrong=node('strong',null,clean(entry.relation));
      const subtitle=node('span',null,'@'+clean(target.alias)+' · '+topic(target));
      text.append(labelStrong,subtitle);
      const inspect=node('button','v117-inspect','Почему?');
      inspect.type='button';
      inspect.setAttribute('aria-controls','v117LinkEvidence');
      inspect.setAttribute('aria-label','Объяснить связь с историей '+target.alias);
      inspect.onclick=()=>select(i);
      const go=node('button','v117-follow','Открыть ↗');
      go.type='button';
      go.setAttribute('aria-label','Открыть связанную историю '+target.alias);
      go.onclick=()=>api.follow(entry.index,entry.relation);
      row.append(text,inspect,go);controls.append(row);inspectors.push(inspect);
    });
    map.prepend(svg,center);
    evidence.id='v117LinkEvidence';
    const fallback=node('details','v10-constellation-list v117-text-list');
    const summary=node('summary',null,'Все связи текстом');fallback.append(summary);
    const list=node('ul');
    records.forEach(entry=>{
      const item=node('li');
      const button=node('button',null,'@'+clean(entry.story.alias)+' · '+entry.relation+' ↗');
      button.type='button';button.onclick=()=>api.follow(entry.index,entry.relation);
      const description=node('small',null,explain(source,entry.story,entry.relation));
      item.append(button,description);list.append(item);
    });
    fallback.append(list);
    host.append(eyebrow,title,note,map,evidence,controls,fallback);
    select(0);
  }
  return {mount,explain};
})();
