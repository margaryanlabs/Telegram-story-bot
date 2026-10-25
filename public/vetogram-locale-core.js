// Russian is authoritative. Missing localized keys fall back to Russian.
export const UI_LOCALES=Object.freeze(['ru','en','hy']);
const labels={
  chats:['Чаты','Chats','Զրույցներ'],home:['Vetogram','Vetogram','Vetogram'],stories:['Истории','Stories','Պատմություններ'],privacy:['Защита','Privacy','Գաղտնիություն'],studio:['Студия','Studio','Ստուդիա'],
  quick:['Быстро','Quick','Արագ'],pro:['Студия Про','Studio Pro','Պրո ստուդիա'],director:['AI-режиссёр','AI Director','AI ռեժիսոր'],
  text:['Текст','Text','Տեքստ'],photo:['Фото','Photo','Լուսանկար'],layers:['Слои','Layers','Շերտեր'],sound:['Звук','Sound','Ձայն'],idea:['Идея / ИИ','Idea / AI','Գաղափար / AI'],link:['Ссылка','Link','Հղում'],project:['Проект','Project','Նախագիծ'],
  newStory:['＋ Новая','＋ New','＋ Նոր'],preview:['⤢ Просмотр','⤢ Preview','⤢ Նախադիտում'],remix:['✧ Ремикс','✧ Remix','✧ Ռեմիքս'],publish:['К публикации →','Continue →','Հրապարակել →'],
  style:['Стиль истории','Story style','Պատմության ոճ'],recent:['Недавние разделы','Recent sections','Վերջին բաժինները'],tools:['Твои инструменты','Your tools','Քո գործիքները'],
  language:['Язык интерфейса','Interface language','Միջերեսի լեզուն'],closePreview:['Закрыть предпросмотр','Close preview','Փակել նախադիտումը'],
  undo:['Отменить действие','Undo','Չեղարկել'],redo:['Повторить действие','Redo','Կրկնել'],
  musicPick:['＋ Выбрать аудио','＋ Choose audio','＋ Ընտրել ձայն'],musicClear:['Убрать звук','Remove sound','Հեռացնել ձայնը'],
  musicExport:['↓ Скачать клип до 8 секунд','↓ Download up to 8s clip','↓ Ներբեռնել մինչև 8 վրկ․ հոլովակ'],
  title:['Заголовок','Title','Վերնագիր'],subtitle:['Подзаголовок','Subtitle','Ենթավերնագիր'],caption:['Подпись для Telegram','Telegram caption','Telegram-ի նկարագրություն'],
  save:['✓ Сохранить','✓ Save','✓ Պահպանել'],search:['Найти чат…','Find a chat…','Գտնել զրույց…'],
};
export function normalizeLocale(value){return UI_LOCALES.includes(value)?value:'ru';}
export function uiText(key,locale='ru',fallback=''){
  const row=labels[key];return row?.[UI_LOCALES.indexOf(normalizeLocale(locale))]||row?.[0]||fallback;
}
