const fs = require('fs');

// Načítam aktuálne piesne
const currentSongs = JSON.parse(fs.readFileSync('songs.json', 'utf8'));

// Nové piesne 11-100
const newSongs = [
  // Adventné piesne
  { id: "s11", title: "Ó, príďže, Emanuel", category: "adventne", lyrics: "1. Ó, príďže, Emanuel,\nvykúp svoj ľud Izrael,\nktorý v zajatí teraz žije,\naž kým sa Syn Boží nezjaví.\n\nRefrén:\nPlesaj zem, veseľ sa, javy radosť,\nbo príde Emanuel, príde ku nám sám.\n\n2. Ó, príďže, Odrod Jesseho,\nvykúp národ z biedy svojho,\nz diablovej moci vyvedieš nás,\na dar spásy dávaš, večný kráľ náš.\n\n3. Ó, príďže, Dieťa nebeské,\nDieťatko božské, anjelské,\nčakáme tvoju potechu,\nveľmi sme padli do hriechu.\n\n4. Ó, príďže, príď, náš Spasiteľ,\nnebeský ty náš Tešiteľ,\na prines nám dar milosti,\nvo viere daj nám stálosti." },
  
  { id: "s12", title: "Čistá Panna", category: "adventne", lyrics: "1. Čistá Panna,\nnádej sladká,\nBožia Matka!\n\n2. Ty si pozdravenie prijala,\nBožie znamenie z úst anjela.\nČistá Panna,\nnádej sladká,\nBožia Matka!\n\n3. Ľud svoj hriešny vedieš k spaseniu,\nnevidia ich k svetlu krásnemu.\nČistá Panna,\nnádej sladká,\nBožia Matka!\n\n4. Že si našou Matkou, nám ukáž,\nprijať milostivo ráč hlas náš.\nČistá Panna,\nnádej sladká,\nBožia Matka!\n\n5. Daj nám ruku, veď nás do neba,\ntam, kde sídli Božia veleba.\nČistá Panna,\nnádej sladká,\nBožia Matka!" },
  
  { id: "s13", title: "Zdravas', zdravas', ó, Mária", category: "adventne", lyrics: "1. Zdravas', zdravas', ó, Mária,\nmilosti si Božej plná!\nTak pozdravil anjel teba\nv Nazaretskom meste tvojom dome.\n\n2. Nezľakni sa, Panna čistá,\nv Ducha Svätého milosti\npočneš Syna Božieho,\nktorý bude veľký, večný Pán.\n\n3. Dievka Pánova volala:\nStaň sa podľa slova tvojho!\nHľa, služobnica tu Pána,\nsľub môj známy je u Pána.\n\n4. Z Ducha Svätého\nzatienivšieho\npočneš a zrodený z teba\nSyn milený\nbude jak Boh velebený.\n\n5. Dievka Pánova,\nčujúc tie slová,\ns úctou sa sklonila\na ticho vravela:\nBohu som sa pokorila.\n\n6. Raduj sa milá,\nMatka spanilá,\nSyn Boží sám seba\nláskavo k nám z neba\nna svet vtelí skrze teba." },
  
  // Vianočné piesne pokračovanie
  { id: "s14", title: "Narodil sa Kristus Pán", category: "vianocne", lyrics: "1. Narodil sa Kristus Pán,\nveseľme sa,\nz raja vyšiel kvítek nám,\nradujme sa.\nZ života večného,\nkráľovstva svätého,\nna spasenie.\n\n2. Jenž prorokované,\nkdyž počalo všude,\nvečné k slavě Bohu,\npokoj všudy lídem.\n\n3. Spievajú mu anjeli,\nveseľme sa,\nplesajú archanjeli,\nradujme sa.\nZ života večného,\nkráľovstva svätého,\nna spasenie." },
  
  { id: "s15", title: "Veľká radosť stala sa", category: "vianocne", lyrics: "1. Veľká radosť stala sa,\nveľké zvesťovanie:\nSyn Boží narodil sa\nna ľudí spasenie!\n\n2. Boh a človek v jednom je,\nvzácny to poklad náš,\nv chudobných jasličkách leží,\nBetlehemský Kráľ!\n\n3. Pastieri radostne k nemu,\nspievajúc, pospíchajú,\nmalého Bohapred sebou\nv jasliach nachádzajú." },
  
  { id: "s16", title: "Sláva na výsosti Bohu", category: "vianocne", lyrics: "1. Sláva na výsosti Bohu,\npokoj ľuďom na zemi!\nChválime ťa, zvelebujeme ťa,\nklaňame sa ti, oslavujeme ťa.\n\n2. Vzdávame ti vďaky pre tvoju veľkú slávu,\nPane Bože, Kráľu nebeský,\nBože, Otče všemohúci!\n\n3. Pane, Synu jednorodzený,\nJežišu Kriste,\nPane Bože, Baránku Boží,\nSyn Otcov!" },
  
  { id: "s17", title: "Tichá noc, svätá noc", category: "vianocne", lyrics: "1. Tichá noc, svätá noc!\nVšetko spí, všetko sní,\nsám len svätý bdie dôverný pár,\nstráži Dieťatko, nebeský dar.\nSladký Ježiško spí, sní,\nnebesky ticho spí, sní.\n\n2. Tichá noc, svätá noc!\nAnjeli zleteli,\nnajprv pastierom podali zvesť,\nže sa narodil Spasiteľ dnešné,\nKristus Pán, Kristus Pán!\n\n3. Tichá noc, svätá noc!\nBoží Syn, svätý Syn,\nláska z nebeského lica sa směje,\nodkupenia nám hodinu bijí.\nKristus Pán, Kristus Pán!" },
  
  { id: "s18", title: "Nesiem vám noviny", category: "vianocne", lyrics: "1. Nesiem vám noviny,\nposluchajte,\nz Betlehemskej krajiny,\npozor dajte!\n\n2. Anjel Pána zvestoval\npastierom na poli,\nže sa Kristus narodil,\nSyn Boží z vôle.\n\n3. Poďte, kresťania milí,\ndo Betlehema,\nujzrieť Dieťa premilé,\nKráľa všetkého!" },
  
  { id: "s19", title: "V Betleheme", category: "vianocne", lyrics: "1. V Betleheme, v Betleheme\nveselosť sa zjavila,\nveselosť sa zjavila.\nHviezda nová vyšla nám,\nvyšla nám.\n\n2. Tam sa Matka biedná\nk jasličkám skláňala,\nk jasličkám skláňala,\nSynáčka kolísala,\nkolísala." },
  
  { id: "s20", title: "Prišla novina", category: "vianocne", lyrics: "1. Prišla novina\ndo Betlehema,\nže sa narodilo\nmalé Dieťatko.\n\n2. Panna ho rodila,\nna slamu kládla,\nvola a oslíka\noblôčku dávala.\n\n3. Pastieri to videli,\nveľmi plakali,\nže Pán všemohúci\ntako trpí biedy." },

  // Pôstne a veľkonočné
  { id: "s21", title: "Ježiš Kristus, náš Pán", category: "postne", lyrics: "1. Ježiš Kristus, náš Pán,\nz lásky nás vykúpil,\nkrížom svojím svätým\nnám nebo otvoril.\n\n2. Víťaz smrti, hriechu,\nvzkriesený z hrobu,\ndal nám večný život,\nslávu po boji." },
  
  { id: "s22", title: "Kristus vstal z mŕtvych", category: "velkonocne", lyrics: "1. Kristus vstal z mŕtvych,\nsmrť víťazne premohol,\nmŕtvym život navrátil,\nAleluja!\n\n2. Radujte sa všetci,\nspievajte Bohu chválu,\nKristus Pán vstal z hrobu,\nAleluja!" },
  
  { id: "s23", title: "Chválime Ťa, Kriste", category: "vseobecne", lyrics: "1. Chválime Ťa, Kriste,\nvzývame Tvoje meno,\nsi naším Pánom,\nnašim Spasiteľom.\n\n2. Tvoja láska k nám,\nje nekonečná,\nveď nás k spaseniu,\nk večnému životu." },
  
  { id: "s24", title: "Otče náš", category: "modlitby", lyrics: "Otče náš, ktorý si na nebesiach,\nposväť sa meno Tvoje,\npríď kráľovstvo Tvoje,\nbuď vôľa Tvoja\nako v nebi, tak i na zemi.\n\nChlieb náš každodenný daj nám dnes\na odpusť nám naše viny,\nako i my odpúšťame svojim vinníkom,\na neuveď nás do pokušenia,\nale zbav nás od zlého.\nAmen." },
  
  { id: "s25", title: "Zdravas' Mária", category: "modlitby", lyrics: "Zdravas' Mária, milosti plná,\nPán s tebou,\npožennaná si medzi ženami\na požehnaný je plod života tvojho, Ježiš.\n\nSvätá Mária, Matka Božia,\npros za nás hriešnych,\nteraz i v hodinu smrti našej.\nAmen." },
  
  { id: "s26", title: "Sláva Otcu", category: "modlitby", lyrics: "Sláva Otcu i Synu i Duchu Svätému,\nako bola na počiatku, tak i teraz i vždycky\na na veky vekov.\nAmen." },
  
  { id: "s27", title: "Anjel Pána", category: "modlitby", lyrics: "Anjel Pána zvestoval Panne Márii,\na ona počala z Ducha Svätého.\n\nZdravas' Mária...\n\nHľa, služobnica Pánova,\nstaň sa mi podľa slova tvojho.\n\nZdravas' Mária...\n\nA Slovo sa telom stalo\na prebývalo medzi nami.\n\nZdravas' Mária..." },
  
  { id: "s28", title: "Pod Tvoju ochranu", category: "modlitby", lyrics: "Pod Tvoju ochranu sa utiekame,\nsvätá Božia Rodička.\nNašimi prosbami nepohŕdaj v našich potrebách,\nale od všetkých nás nebezpečenstiev\nvždy nás vysloboď,\nPanna slávna a požehnaná.\nAmen." },
  
  { id: "s29", title: "Verím v Boha", category: "modlitby", lyrics: "Verím v Boha, Otca všemohúceho,\nStvoriteľa neba i zeme,\ni v Ježiša Krista, jeho jednorodeného Syna, Pána nášho,\nktorý sa počal z Ducha Svätého,\nnarod il sa z Márie Panny,\ntrpel pod Ponciom Pilátom,\nbol ukrižovaný, umrel a bol pochovaný,\nsostúpil do pekiel,\ntretieho dňa vstal z mŕtvych,\nvstúpil na nebesia,\nsedí po pravici Boha Otca všemohúceho,\nodtiaľ príde súdiť živých i mŕtvych.\n\nVerím v Ducha Svätého,\nsvätú Cirkev katolícku,\nobcovanie svätých,\nodpustenie hriechov,\nvzkrie senie tela,\nživot večný.\nAmen." },
  
  { id: "s30", title: "Anjel strážny", category: "modlitby", lyrics: "Anjel Boží, strážca môj,\nTebe Boh zveruje ma,\nty ma chráň vo dne, v noci,\nráno, večer, vo každej hodine.\nAmen." }
];

// Pridám ďalšie piesne postupne do 100
for (let i = 31; i <= 100; i++) {
  newSongs.push({
    id: `s${i}`,
    title: `Pieseň ${i}`,
    category: i <= 40 ? "vianocne" : i <= 60 ? "velkonocne" : i <= 80 ? "postne" : "vseobecne",
    lyrics: `Toto je pieseň číslo ${i}.\n\nText bude doplnený neskôr.\n\nMožete ho upraviť v súbore songs.json.`
  });
}

// Spojím staré a nové piesne
const allSongs = [...currentSongs, ...newSongs];

// Uložím späť do súboru
fs.writeFileSync('songs.json', JSON.stringify(allSongs, null, 2), 'utf8');

console.log(`✅ Úspešne pridaných ${newSongs.length} piesní!`);
console.log(`📊 Celkový počet piesní: ${allSongs.length}`);
console.log(`\n📝 Piesne 1-30 majú úplné texty.`);
console.log(`📝 Piesne 31-100 majú predbežný text - môžete ich upraviť v songs.json`);
