/* V10 structured memory contract. No generated biography or invented events. */
window.MarketV10 = window.MarketV10 || {};
window.MarketV10.data = (() => {
  const labels = ['До решения', 'Момент выбора', 'Последствия', 'Что осталось'];
  const english = ['Before the Decision', 'The Moment', 'Consequences', 'What Remains'];
  const keys = ['before', 'decision', 'consequences', 'remains'];
  const themes = {Risk:'Риск', Discipline:'Дисциплина', FOMO:'FOMO', Patience:'Терпение'};
  const clean = (value, max=1200) => typeof value === 'string' ? value.slice(0,max).trim() : '';
  function chapters(record) {
    const supplied = record.chapters || {};
    return keys.map((key, i) => {
      // Legacy records contain one undivided account. Preserve it verbatim,
      // visibly distinguish it from a structured before/decision/consequence.
      const fallback = i === 0 ? clean(record.story) : i === 3 ? clean(record.rule,180) : '';
      const text = clean(supplied[key], i===3 ? 180 : 1200) || fallback;
      return {key, number:['I','II','III','IV'][i], label:labels[i], english:english[i], text,
        legacy:i===0 && !clean(supplied.before), missing:!text};
    });
  }
  function provenance(record) {
    if (record.local) return 'Личная запись · только на этом устройстве';
    if (record.type === 'legend') return 'Историческая цитата · указан источник';
    return record.type === 'editorial' ? 'Fictional · редакционный пример' : 'Fictional · вымышленная история';
  }
  function permalink(record) {
    const url = new URL(location.href);
    url.hash = 'story/' + encodeURIComponent(String(record.id));
    return url.href;
  }
  return {labels, english, keys, themes, clean, chapters, provenance, permalink};
})();
