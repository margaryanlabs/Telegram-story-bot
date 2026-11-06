window.MarketV10 = window.MarketV10 || {};
window.MarketV10.motion = (() => {
  const query = matchMedia('(prefers-reduced-motion: reduce)');
  const visited = new Set();
  let brief = false;
  return {
    get reduced() {return query.matches;},
    seen(record) {visited.add(String(record.id));},
    skip(record) {return query.matches || brief || visited.has(String(record.id));},
    preference(value) {brief=!!value;},
    reveal(element) {
      if (!query.matches && element.animate) element.animate(
        [{opacity:.25,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],
        {duration:300,easing:'cubic-bezier(.2,.7,.2,1)'});
    }
  };
})();
