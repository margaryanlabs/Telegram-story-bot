/* Verified claims about language versions on official providers' own title pages.
 * A listed Russian audio track DOES NOT mean playback is currently offered.
 * A film catalogue page is not a stream nor an embedding license.
 *
 * Metadata verified from the provider's publicly readable title pages.
 * Entries remain region-specific / can show "unavailable" or remove audio.
 * Never open provider streaming URLs in an iframe, scrape MP4/HLS, or claim
 * Russian voices from a subtitle listing alone.
 */
(function(){
 "use strict";
 const meg=(path)=>"https://megogo.net/ru/view/"+path;
 const rows=[
 // Wizarding World: original Russian audio listed on title page.
 ["Harry Potter and the Philosopher's Stone",2001,"MEGOGO",meg("2453151-garri-potter-i-filosofskiy-kamen.html"),"unknown"],
 ["Harry Potter and the Chamber of Secrets",2002,"MEGOGO",meg("2453171-garri-potter-i-taynaya-komnata.html"),"unavailable"],
 ["Harry Potter and the Prisoner of Azkaban",2004,"MEGOGO",meg("2453181-garri-potter-i-uznik-azkabana.html"),"unavailable"],
 ["Harry Potter and the Goblet of Fire",2005,"MEGOGO",meg("2453191-garri-potter-i-kubok-ognya.html"),"unknown"],
 ["Harry Potter and the Order of the Phoenix",2007,"Okko","https://okko.tv/movie/harry-potter-and-the-order-of-the-phoenix/play","unknown"],
 ["Harry Potter and the Half-Blood Prince",2009,"MEGOGO",meg("2453221-garri-potter-i-prints-polukrovka.html"),"unavailable"],
 ["Harry Potter and the Deathly Hallows – Part 1",2010,"MEGOGO",meg("2453231-garri-potter-i-dary-smerti-chast-i.html"),"unavailable"],
 ["Harry Potter and the Deathly Hallows – Part 2",2011,"MEGOGO",meg("2453261-garri-potter-i-dary-smerti-chast-ii.html"),"unknown"],
 ["Fantastic Beasts and Where to Find Them",2016,"MEGOGO",meg("2013241-fantasticheskie-tvari-i-gde-oni-obitayut.html"),"unknown"],
 ["Fantastic Beasts: The Crimes of Grindelwald",2018,"MEGOGO",meg("2016991-fantasticheskie-tvari-prestupleniya-grin-de-val-da.html"),"unknown"],
 // Marvel official listing of Russian *audio*, not confirmation of playback.
 ["Iron Man",2008,"MEGOGO",meg("2861251-zheleznyy-chelovek.html"),"unknown"],
 ["Iron Man 2",2010,"MEGOGO",meg("2861231-zheleznyy-chelovek-2.html"),"unknown"],
 ["Iron Man 3",2013,"MEGOGO",meg("1004541-zheleznyy-chelovek-3.html"),"unknown"],
 ["The Avengers",2012,"MEGOGO",meg("2861271-mstiteli.html"),"unknown"],
 ["Avengers: Infinity War",2018,"MEGOGO",meg("3828671-mstiteli-voyna-beskonechnosti.html"),"unknown"],
 ["Avengers: Endgame",2019,"MEGOGO",meg("4512995-mstiteli-final.html"),"unknown"],
 ["Guardians of the Galaxy",2014,"MEGOGO",meg("2861331-strazhi-galaktiki.html"),"unavailable"],
 ["Guardians of the Galaxy Vol. 2",2017,"MEGOGO",meg("2013421-strazhi-galaktiki-chast-2.html"),"unknown"],
 ["Guardians of the Galaxy Vol. 3",2023,"MEGOGO",meg("3945751-strazhi-galaktiki-chast-3.html"),"unknown"]
 ];
 const key=(name,year)=>name+"|"+year;
 const lookup=Object.fromEntries(rows.map(([original,year,provider,url,availability])=>
   [key(original,year),Object.freeze({
     original,year,provider,url,
     language:"ru",audioEvidence:"listed-by-provider",
     availability,verifiedOn:"2026-10-28",
     note:availability==="unavailable"
       ?"Русская аудиодорожка указана в карточке, но сервис сообщает «недоступен». Не является рабочей ссылкой на фильм."
       :"Русская аудиодорожка указана на странице сервиса. Доступность для вашей страны и воспроизведение НЕ проверены."
   })]));
 window.VetogramCinemaRussianAudio=Object.freeze({lookup,key,count:rows.length});
})();
