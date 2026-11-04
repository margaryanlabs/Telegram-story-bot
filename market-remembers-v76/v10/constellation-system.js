window.MarketV10 = window.MarketV10 || {};
window.MarketV10.constellations = {
  mount(source, api) {
    const old=document.querySelector('.v77-threads');
    if(!old || api.guided())return;
    const records=api.related(source);
    if(!records.length)return;
    old.replaceChildren();old.classList.add('v10-constellation');
    const title=document.createElement('h3');title.textContent='Истории притягиваются смыслом.';
    const eyebrow=document.createElement('span');eyebrow.className='v10-eyebrow';eyebrow.textContent='CONSTELLATION / СВЯЗИ ПАМЯТИ';
    const note=document.createElement('p');note.className='v10-quiet';
    note.textContent='Общие темы и дополняющие уроки. Связи не означают знакомства между людьми.';
    const map=document.createElement('div');map.className='v10-constellation-map';
    map.setAttribute('role','group');map.setAttribute('aria-label','Тематическое созвездие '+source.alias);
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 600 260');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
    const positions=[[15,57],[48,78],[83,53]];
    records.forEach((record,i)=>{
      const [x,y]=positions[i];
      const path=document.createElementNS(svg.namespaceURI,'path');
      path.setAttribute('d',`M 300 47 Q ${x*6} 76 ${x*6} ${y*2.6}`);svg.append(path);
      const node=document.createElement('button');node.type='button';node.className='v10-constellation-star';
      node.style.left=x+'%';node.style.top=y+'%';
      node.setAttribute('aria-label','Открыть '+record.story.alias+'. '+record.relation+': '+(window.MarketV10.data.themes[record.story.category]||record.story.category));
      const glyph=document.createElement('span');glyph.className='v10-node-glyph';glyph.textContent='✦';glyph.setAttribute('aria-hidden','true');
      const label=document.createElement('strong');label.textContent=record.story.alias;
      const reason=document.createElement('small');reason.textContent=window.MarketV10.data.themes[record.story.category]||record.story.category;
      node.append(glyph,label,reason);node.onclick=()=>api.follow(record.index,record.relation);map.append(node);
    });
    const center=document.createElement('div');center.className='v10-constellation-origin';
    const star=document.createElement('span');star.textContent='✧';star.setAttribute('aria-hidden','true');
    const name=document.createElement('strong');name.textContent=source.alias;center.append(star,name);
    map.prepend(svg,center);
    const alternative=document.createElement('details');alternative.className='v10-constellation-list';
    const summary=document.createElement('summary');summary.textContent='Читать связи списком';alternative.append(summary);
    const list=document.createElement('ul');
    records.forEach(record=>{
      const li=document.createElement('li');const button=document.createElement('button');button.type='button';
      button.textContent=record.story.alias+' · '+record.relation+' / '+(window.MarketV10.data.themes[record.story.category]||record.story.category)+' ↗';
      button.onclick=()=>api.follow(record.index,record.relation);
      const kind=document.createElement('small');kind.textContent=window.MarketV10.data.provenance(record.story);
      li.append(button,kind);list.append(li);
    });
    alternative.append(list);old.append(eyebrow,title,note,map,alternative);
  }
};
