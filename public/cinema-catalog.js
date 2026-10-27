/* VETOGRAM CINEMA / independent, licensed-content catalog.
 * Files are addressed by exact Wikimedia Commons titles; no unauthorized mirrors.
 * Audio languages reflect ACTUAL verified editions, not a promise of Russian dubbing.
 */
(function () {
  "use strict";
  const BY3="https://creativecommons.org/licenses/by/3.0/";
  const BY25="https://creativecommons.org/licenses/by/2.5/";
  const BY4="https://creativecommons.org/licenses/by/4.0/";
  const films=[
    {id:"sintel",title:"Синтел",original:"Sintel",year:2010,minutes:15,genres:["Фэнтези","Драма","Анимация"],hue:24,
      synopsis:"В мире заснеженных гор и древних городов девушка отправляется на поиски маленького дракона. Её путешествие оборачивается историей о памяти и времени.",
      creator:"Blender Foundation · режиссёр Colin Levy",file:"Sintel movie 4K.webm",license:"CC BY 3.0",licenseUrl:BY3,site:"https://durian.blender.org/",spoken:"Английский"},
    {id:"big-buck-bunny",title:"Большой кролик Бак",original:"Big Buck Bunny",year:2008,minutes:10,genres:["Анимация","Комедия","Семейный"],hue:57,
      synopsis:"Миролюбивый большой кролик встречает лесных проказников — и придумывает необычную месть.",
      creator:"Blender Foundation · режиссёр Sacha Goedegebure",file:"Big Buck Bunny 4K.webm",license:"CC BY 3.0",licenseUrl:BY3,site:"https://peach.blender.org/",spoken:"Без диалогов"},
    {id:"tears-of-steel",title:"Слёзы стали",original:"Tears of Steel",year:2012,minutes:12,genres:["Фантастика","Экшн"],hue:211,
      synopsis:"Амстердам будущего. Учёные и воины пытаются предотвратить катастрофу, вернувшись к судьбоносному разговору.",
      creator:"Blender Foundation · режиссёр Ian Hubert",file:"Tears of Steel in 4k - Official Blender Foundation release.webm",license:"CC BY 3.0",licenseUrl:BY3,site:"https://mango.blender.org/",spoken:"Английский"},
    {id:"elephants-dream",title:"Сон слона",original:"Elephants Dream",year:2006,minutes:11,genres:["Анимация","Фантастика"],hue:295,
      synopsis:"Двое путников исследуют странную машину — мир, в котором каждый видит собственную реальность.",
      creator:"Blender Foundation · режиссёр Bassam Kurdali",file:"Elephants Dream (2006) 1080p24.webm",license:"CC BY 2.5",licenseUrl:BY25,site:"https://orange.blender.org/",spoken:"Английский"},
    {id:"spring",title:"Весна",original:"Spring",year:2019,minutes:8,genres:["Анимация","Фэнтези"],hue:162,
      synopsis:"Юная пастушка и её верный пёс встречаются с древними духами природы в начале новой весны.",
      creator:"Blender Animation Studio · режиссёр Andy Goralczyk",file:"Spring - Blender Open Movie.webm",license:"CC BY · см. источник",licenseUrl:BY4,site:"https://studio.blender.org/films/spring/",spoken:"Без диалогов"},
    {id:"sprite-fright",title:"Ужас спрайтов",original:"Sprite Fright",year:2021,minutes:10,genres:["Анимация","Комедия","Ужасы"],hue:344,
      synopsis:"Туристы устраивают пикник в лесу, но совсем не готовы встретить его маленьких обитателей.",
      creator:"Blender Animation Studio · режиссёр Matthew Luhn",file:"Sprite Fright - Blender Open Movie-full movie.webm",license:"CC BY · см. источник",licenseUrl:BY4,site:"https://studio.blender.org/films/sprite-fright/",spoken:"Английский"},
    {id:"coffee-run",title:"Кофейный забег",original:"Coffee Run",year:2020,minutes:3,genres:["Анимация","Комедия"],hue:39,
      synopsis:"Одна чашка кофе превращает обычные мысли в стремительную погоню по воспоминаниям.",
      creator:"Blender Animation Studio · режиссёр Hjalti Hjalmarsson",file:"Coffee Run - Blender Open Movie-full movie.webm",license:"CC BY · см. источник",licenseUrl:BY4,site:"https://studio.blender.org/films/coffee-run/",spoken:"Без диалогов"},
    {id:"charge",title:"Заряд",original:"Charge",year:2022,minutes:4,genres:["Анимация","Фантастика","Экшн"],hue:199,
      synopsis:"В городе будущего заряд энергии значит больше, чем деньги. Один старик решает бросить вызов системе.",
      creator:"Blender Studio",file:"Charge - Blender Open Movie-full movie.webm",license:"CC BY · см. источник",licenseUrl:BY4,site:"https://studio.blender.org/films/charge/",spoken:"Без диалогов"},
    {id:"caminandes-gran-dillama",title:"Каминандес: Гран Дилама",original:"Caminandes: Gran Dillama",year:2013,minutes:3,genres:["Анимация","Комедия","Семейный"],hue:91,
      synopsis:"Лама Коро мечтает о сочной траве, но между ней и обедом есть одна электрическая преграда.",
      creator:"Blender Foundation · режиссёр Pablo Vazquez",file:"Caminandes - Gran Dillama - Blender Foundation's new Open Movie.webm",license:"CC BY · см. источник",licenseUrl:BY3,site:"https://www.caminandes.com/",spoken:"Без диалогов"},
    {id:"caminandes-llama-drama",title:"Каминандес: Лама-драма",original:"Caminandes: Llama Drama",year:2013,minutes:2,genres:["Анимация","Комедия","Семейный"],hue:52,
      synopsis:"Ламе очень хочется попасть на другую сторону дороги. Неожиданная преграда не оставляет её в покое.",
      creator:"Blender Foundation · режиссёр Pablo Vazquez",file:"Caminandes- Llama Drama - Short Movie.ogv",license:"CC BY · см. источник",licenseUrl:BY3,site:"https://www.caminandes.com/",spoken:"Без диалогов"},
    {id:"caminandes-llamigos",title:"Каминандес: Ламигос",original:"Caminandes 3: Llamigos",year:2016,minutes:3,genres:["Анимация","Комедия","Семейный"],hue:192,
      synopsis:"Коро и пингвин Оскар соперничают за вкусные ягоды в заснеженных горах.",
      creator:"Blender Institute · режиссёр Pablo Vazquez",file:"Caminandes 3 - Llamigos - Blender Animated Short.webm",license:"CC BY · см. источник",licenseUrl:BY4,site:"https://www.caminandes.com/",spoken:"Без диалогов"},
    {id:"cosmos-laundromat",title:"Космическая прачечная",original:"Cosmos Laundromat: First Cycle",year:2015,minutes:12,genres:["Анимация","Драма","Фантастика"],hue:269,
      synopsis:"Уставшая овца на необитаемом острове получает удивительное предложение начать совсем другую жизнь.",
      creator:"Blender Institute · режиссёр Mathieu Auvray",file:"Cosmos Laundromat - First Cycle - Official Blender Foundation release.webm",license:"CC BY 3.0",licenseUrl:BY3,site:"https://gooseberry.blender.org/",spoken:"Английский"}
  ];
  films.forEach(function(f){f.editions=[]; /* optional approved: [{id:'ru',label:'Русский',url:'https://...',license:'...',credit:'...'}] */});
  window.VetogramCinemaCatalog=Object.freeze(films.map(function(f){return Object.freeze(f)}));
})();