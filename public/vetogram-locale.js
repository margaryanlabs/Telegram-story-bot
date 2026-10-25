import {normalizeLocale,uiText} from './vetogram-locale-core.js';
// Only explicitly marked application chrome is translated. Never walk chat,
// archive, AI response, prompt, canvas or other user-content nodes.
let locale='ru';
try{locale=normalizeLocale(localStorage.getItem('vetogram-ui-locale'));}catch{}
const selector=document.getElementById('noirLocale');
function apply(value){
  locale=normalizeLocale(value);document.documentElement.lang=locale;
  document.querySelectorAll('[data-ui-text]').forEach(node=>{
    node.textContent=uiText(node.dataset.uiText,locale,node.textContent);
  });
  document.querySelectorAll('[data-ui-label]').forEach(node=>{
    node.setAttribute('aria-label',uiText(node.dataset.uiLabel,locale,node.getAttribute('aria-label')||''));
  });
  document.querySelectorAll('[data-ui-placeholder]').forEach(node=>{
    node.setAttribute('placeholder',uiText(node.dataset.uiPlaceholder,locale,node.getAttribute('placeholder')||''));
  });
  if(selector)selector.value=locale;
  window.dispatchEvent(new CustomEvent('vetogram:locale-changed',{detail:{locale}}));
}
selector?.addEventListener('change',()=>{
  apply(selector.value);try{localStorage.setItem('vetogram-ui-locale',locale);}catch{}
});
window.VetogramI18n=Object.freeze({setLocale:apply,t:(key,fallback)=>uiText(key,locale,fallback),getLocale:()=>locale});
apply(locale);
