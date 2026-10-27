/* Film discovery only. These entries are NOT video streams or licenses.
 * Streaming location: official franchise landing pages, region dependent.
 * Do not use undocumented video mirrors or pretend trailers are full films. */
(function(){
 "use strict";
 const MCU=[
 ["Железный человек","Iron Man",2008],["Невероятный Халк","The Incredible Hulk",2008],
 ["Железный человек 2","Iron Man 2",2010],["Тор","Thor",2011],["Первый мститель","Captain America: The First Avenger",2011],
 ["Мстители","The Avengers",2012],["Железный человек 3","Iron Man 3",2013],["Тор 2: Царство тьмы","Thor: The Dark World",2013],
 ["Первый мститель: Другая война","Captain America: The Winter Soldier",2014],
 ["Стражи Галактики","Guardians of the Galaxy",2014],["Мстители: Эра Альтрона","Avengers: Age of Ultron",2015],
 ["Человек-муравей","Ant-Man",2015],["Первый мститель: Противостояние","Captain America: Civil War",2016],
 ["Доктор Стрэндж","Doctor Strange",2016],["Стражи Галактики. Часть 2","Guardians of the Galaxy Vol. 2",2017],
 ["Человек-паук: Возвращение домой","Spider-Man: Homecoming",2017],["Тор: Рагнарёк","Thor: Ragnarok",2017],
 ["Чёрная пантера","Black Panther",2018],["Мстители: Война бесконечности","Avengers: Infinity War",2018],
 ["Человек-муравей и Оса","Ant-Man and the Wasp",2018],["Капитан Марвел","Captain Marvel",2019],
 ["Мстители: Финал","Avengers: Endgame",2019],["Человек-паук: Вдали от дома","Spider-Man: Far From Home",2019],
 ["Чёрная вдова","Black Widow",2021],["Шан-Чи и легенда десяти колец","Shang-Chi and the Legend of the Ten Rings",2021],
 ["Вечные","Eternals",2021],["Человек-паук: Нет пути домой","Spider-Man: No Way Home",2021],
 ["Доктор Стрэндж: В мультивселенной безумия","Doctor Strange in the Multiverse of Madness",2022],
 ["Тор: Любовь и гром","Thor: Love and Thunder",2022],["Чёрная пантера: Ваканда навеки","Black Panther: Wakanda Forever",2022],
 ["Человек-муравей и Оса: Квантомания","Ant-Man and the Wasp: Quantumania",2023],
 ["Стражи Галактики. Часть 3","Guardians of the Galaxy Vol. 3",2023],
 ["Капитан Марвел 2","The Marvels",2023],["Дэдпул и Росомаха","Deadpool & Wolverine",2024],
 ["Капитан Америка: Новый мир","Captain America: Brave New World",2025],
 ["Громовержцы*","Thunderbolts*",2025],["Фантастическая четвёрка: Первые шаги","The Fantastic Four: First Steps",2025]
 ];
 const POTTER=[
 ["Гарри Поттер и философский камень","Harry Potter and the Philosopher's Stone",2001],
 ["Гарри Поттер и Тайная комната","Harry Potter and the Chamber of Secrets",2002],
 ["Гарри Поттер и узник Азкабана","Harry Potter and the Prisoner of Azkaban",2004],
 ["Гарри Поттер и Кубок огня","Harry Potter and the Goblet of Fire",2005],
 ["Гарри Поттер и Орден Феникса","Harry Potter and the Order of the Phoenix",2007],
 ["Гарри Поттер и Принц-полукровка","Harry Potter and the Half-Blood Prince",2009],
 ["Гарри Поттер и Дары Смерти: Часть 1","Harry Potter and the Deathly Hallows – Part 1",2010],
 ["Гарри Поттер и Дары Смерти: Часть 2","Harry Potter and the Deathly Hallows – Part 2",2011],
 ["Фантастические твари и где они обитают","Fantastic Beasts and Where to Find Them",2016],
 ["Фантастические твари: Преступления Грин-де-Вальда","Fantastic Beasts: The Crimes of Grindelwald",2018],
 ["Фантастические твари: Тайны Дамблдора","Fantastic Beasts: The Secrets of Dumbledore",2022]
 ];
 const LEGACY=[
 ["Люди Икс","X-Men",2000],["Люди Икс 2","X2",2003],["Люди Икс: Последняя битва","X-Men: The Last Stand",2006],
 ["Люди Икс: Начало. Росомаха","X-Men Origins: Wolverine",2009],["Люди Икс: Первый класс","X-Men: First Class",2011],
 ["Росомаха: Бессмертный","The Wolverine",2013],["Люди Икс: Дни минувшего будущего","X-Men: Days of Future Past",2014],
 ["Дэдпул","Deadpool",2016],["Люди Икс: Апокалипсис","X-Men: Apocalypse",2016],
 ["Логан","Logan",2017],["Дэдпул 2","Deadpool 2",2018],["Люди Икс: Тёмный Феникс","Dark Phoenix",2019],
 ["Новые мутанты","The New Mutants",2020],["Веном","Venom",2018],["Веном 2","Venom: Let There Be Carnage",2021],
 ["Веном: Последний танец","Venom: The Last Dance",2024],["Человек-паук","Spider-Man",2002],
 ["Человек-паук 2","Spider-Man 2",2004],["Человек-паук 3: Враг в отражении","Spider-Man 3",2007],
 ["Новый Человек-паук","The Amazing Spider-Man",2012],["Новый Человек-паук: Высокое напряжение","The Amazing Spider-Man 2",2014],
 ["Человек-паук: Через вселенные","Spider-Man: Into the Spider-Verse",2018],
 ["Человек-паук: Паутина вселенных","Spider-Man: Across the Spider-Verse",2023]
 ];
 // These are provider collection pages, NOT direct film links or playable embeds.
 const PROVIDERS={
  mcu:{url:"https://www.disneyplus.com/browse/page-60f4707d-19bb-4c0c-9390-ab269137be50",name:"Disney+ · Marvel"},
  potter:{url:"https://www.harrypotter.com/features/how-to-stream-harry-potter-wherever-you-are",name:"Wizarding World · где смотреть"},
  legacy:{url:"https://www.disneyplus.com/browse/page-60f4707d-19bb-4c0c-9390-ab269137be50",name:"Disney+ · Marvel"}
 };
 function slug(s){return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
 const bundle=(rows,kind,franchise,hue)=>rows.map(([title,original,year],i)=>({
  id:"licensed-discovery-"+kind+"-"+slug(original)+"-"+year,
  title,original,year,minutes:null,creator:franchise,
  synopsis:"Часть коллекции «"+franchise+"». Доступный сервис и язык озвучки зависят от страны. Это карточка для поиска официального просмотра, не видеопоток.",
  genres:["Фильмы",franchise,kind==="potter"?"Фэнтези":"Фантастика"],
  contentType:"Фильмы",hue,
  spoken:"Уточняется у сервиса",
  franchise:kind,franchiseName:franchise,franchiseOrder:i+1,
  discoveryOnly:true,sourceCatalog:"franchise-availability",
  sourcePage:PROVIDERS[kind].url,
  watchProvider:PROVIDERS[kind].name,
  license:"Справочная карточка. Права на показ не предоставлены.",
  licenseUrl:PROVIDERS[kind].url,
  editions:[],player:null,poster:null
 }));
 window.VetogramCinemaFranchises=Object.freeze([
  ...bundle(MCU,"mcu","Marvel · MCU",353),
  ...bundle(POTTER,"potter","Гарри Поттер и волшебный мир",230),
  ...bundle(LEGACY,"legacy","Marvel · классика",20)
 ]);
})();
