/* Popular TV series that list RUSSIAN AUDIO on the cited official title pages.
 * They are NOT video streams and are NOT licensed for embedding.
 * Playback must be checked on the rights-holder website for the viewer's region.
 * Source URLs are direct title detail pages, not copies or pirate mirrors.
 */
(function(){
 "use strict";
 // title, original title, year, Kinopoisk series ID, broad genre, editorial grouping
 const ROWS=[
 ["Игра престолов","Game of Thrones",2011,464963,"Фэнтези","global"],
 ["Дом Дракона","House of the Dragon",2022,1316601,"Фэнтези","global"],
 ["Сопрано","The Sopranos",1999,79848,"Криминал","global"],
 ["Наследники","Succession",2018,986788,"Драма","global"],
 ["Мир Дикого Запада","Westworld",2016,195523,"Фантастика","global"],
 ["Большая маленькая ложь","Big Little Lies",2017,947758,"Драма","global"],
 ["Барри","Barry",2018,972587,"Комедия","global"],
 ["Воин","Warrior",2019,1219257,"Боевик","global"],
 ["Ваша честь","Your Honor",2020,1253157,"Криминал","global"],
 ["Гангстерленд","MobLand",2025,5512084,"Криминал","global"],
 ["Тёмные ветра","Dark Winds",2022,4510601,"Детектив","global"],
 ["Перевал","Der Pass",2018,1189907,"Триллер","global"],
 ["Фишер","Fisher",2023,4443734,"Детектив","russian"],
 ["Метод","The Method",2015,838050,"Триллер","russian"],
 ["Этерна","Eterna",2025,5377710,"Фэнтези","russian"],
 ["Цикады","Tsikady",2023,5365497,"Драма","russian"],
 ["Жить жизнь","Zhit zhizn",2023,5001375,"Триллер","russian"],
 ["Казанова","Kazanova",2020,1189814,"Детектив","russian"],
 ["Центурия","Tsenturiya",2026,6658187,"Детектив","russian"],
 ["Формула преступления","Formula prestupleniya",2019,1203028,"Детектив","russian"],
 ["Хэдшот","Headshot",2022,1359915,"Фантастика","russian"],
 ["Реальные пацаны","Realnye patsany",2010,568082,"Комедия","russian"],
 ["Мир! Дружба! Жвачка!","Mir Druzhba Zhvachka",2020,1306638,"Драма","russian"],
 ["Алекс Лютый","Alex Luty",2019,1266998,"Детектив","russian"],
 ["Полёт","Polyot",2019,1286642,"Триллер","russian"],
 ["Грозный","Grozny",2020,1348091,"Исторические","russian"],
 ["Химичка","Himichka",2023,5065777,"Криминал","russian"],
 ["Разрешите обратиться","Razreshite obratitsya",2023,5001226,"Комедия","russian"],
 ["Связь","Connection",2024,5507035,"Триллер","global"],
 ["Злые люди","Zlye lyudi",2025,5939529,"Детектив","russian"],
 ["Научи меня жить","Nauchi menya zhit",2016,1007795,"Детектив","russian"]
 ];
 // All source pages above explicitly display 'Аудиодорожки: Русский'.
 const entries=ROWS.map(([title,original,year,id,genre,group],i)=>{
   const sourcePage="https://www.kinopoisk.ru/series/"+id+"/";
   return {
     id:"series-rus-discovery-"+id,title,original,year,
     minutes:null,creator:"Русские аудиодорожки · проверено в каталоге",
     synopsis:"На странице сериала указан русский звук. Доступность подписки, сезонов и воспроизведения в вашем регионе необходимо проверить на площадке.",
     genres:["Сериалы",genre,group==="global"?"Зарубежные":"Российские"],
     contentType:"Сериалы",spoken:"Русская дорожка в каталоге",hue:(i*47+290)%360,
     discoveryOnly:true,sourceCatalog:"series-legal-discovery",
     russianAudioStatus:"catalog-listed",russianAudio:{
       language:"ru",audioEvidence:"listed-by-provider",provider:"Кинопоиск",
       url:sourcePage,availability:"unknown",
       note:"На странице сериала указана русская аудиодорожка. Онлайн-просмотр в вашей стране не проверен."
     },
     watchAvailability:"unknown",sourcePage,watchProvider:"Кинопоиск",
     license:"Справочная карточка; лицензии на трансляцию сериала в Cinema нет.",
     licenseUrl:sourcePage,player:null,poster:null,editions:[],
     seriesGroup:group,seriesPopular:true,publishedAt:null
   };
 });

 // In the Netflix Armenia Russian-language catalogue the studio itself lists
 // "русский" under AUDIO (not merely subtitles). Streaming remains subscriber-only.
 const NETFLIX=[
   ["Очень странные дела","Stranger Things",2016,"80057281","Фантастика"],
   ["Уэнздей","Wednesday",2022,"81231974","Фэнтези"],
   ["Игра в кальмара","Squid Game",2021,"81040344","Триллер"]
 ];
 for(const [title,original,year,netflixId,genre] of NETFLIX){
   const sourcePage="https://www.netflix.com/am-ru/title/"+netflixId;
   entries.push({
     id:"series-netflix-discovery-"+netflixId,title,original,year,minutes:null,
     creator:"Netflix · русская аудиодорожка в каталоге для Армении",
     synopsis:"Русский язык указан в разделе аудио на официальной странице Netflix для Армении. Воспроизведение доступно по правилам Netflix и требует соответствующей подписки.",
     genres:["Сериалы",genre,"Зарубежные"],contentType:"Сериалы",
     spoken:"Русская дорожка в каталоге",hue:215,discoveryOnly:true,
     sourceCatalog:"series-legal-discovery",russianAudioStatus:"catalog-listed",
     russianAudio:{language:"ru",audioEvidence:"listed-by-provider",provider:"Netflix",url:sourcePage,availability:"unknown",
       note:"Netflix для Армении указывает русский язык в разделе аудио. Смотреть на Netflix по условиям подписки."},
     watchAvailability:"unknown",sourcePage,watchProvider:"Netflix",
     license:"Справочная карточка; лицензии на трансляцию в Cinema нет.",licenseUrl:sourcePage,
     player:null,poster:null,editions:[],seriesGroup:"global",seriesPopular:true,publishedAt:null
   });
 }
 window.VetogramCinemaPopularSeries=Object.freeze(entries);
})();
