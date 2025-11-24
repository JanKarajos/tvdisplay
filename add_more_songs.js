const fs = require('fs');

// Načítam aktuálne piesne
const currentSongs = JSON.parse(fs.readFileSync('songs.json', 'utf8'));

// Pridám ďalších 10 piesní zo spevníka (31-40)
const newSongs = [
  {
    id: "s31",
    title: "Hľa, zástup zboru anjelského",
    category: "vianocne",
    lyrics: "1. Hľa, zástup zboru anjelského prichodí z neba vysokého,\nbudí zo sna sladkého strážcov stáda ovčieho\nspievaním, spievaním, spievaním.\n\n2. Sláva buď Bohu najvyššiemu a pokoj človeku hriešnemu,\nlebo prišiel Spasiteľ, hriešnikov Vykupiteľ,\nna ten svet, na ten svet, na ten svet!\n\n3. V jasličky Matka ho vložila, zima ho ukrutne mrazila,\nale hneď vôl a osol dýchaním ho zahriať išol,\nzohrievali, zohrievali, zohrievali."
  },
  {
    id: "s32",
    title: "Chtiac, aby spal",
    category: "vianocne",
    lyrics: "1. Chtiac, aby spal, Panna mu spieva,\nsvätý Jozef mu na fujare hrá;\nspievaj mi spánok, Matka rozmilá,\nhraj mi uspávanku, Jozef môj!\n\n2. Aby som spal, Matka mi spieva,\naby som spal, Jozef mi hrá.\nPrečo by som spal, keď treba bdieť\na modliť sa za celý svet!"
  },
  {
    id: "s33",
    title: "Jamôl, veselá novina",
    category: "vianocne",
    lyrics: "1. Jamôl, jamôl, veselá novina,\nči počula teba, milá rodina?\n\n2. Či počula teba, milá rodina,\nže anjelský hlas nám zprávu podal dnes?\n\n3. Že anjelský hlas nám zprávu podal dnes,\nže sa Pán narodil v Betleheme dnes!"
  },
  {
    id: "s34",
    title: "Kde si, náš Mesiáš",
    category: "vianocne",
    lyrics: "1. Kde si, náš Mesiáš, kde si, náš Pán?\nV betlemskom meste ťa vyhľadávam.\n\n2. Teba ja hľadám, teba ja žiadam,\nteba mať v srdci mojom prajem si.\n\n3. Pôjdem, pôjdem, azda ťa len nájdem,\nkeď ťa hľadám.\n\n4. Lež našiel som Dieťa ležať v sene,\ns Máriou Matičkou utúlené;\nv maštali na slame slabo má postlané;\npred ním kľakám.\n\n5. Keď si sa ty, Pane, tak ponížil,\npretože som hriešne na svete žil:\ndvoje rúk si skladám, pred tebou tu kľakám,\nteba žiadam."
  },
  {
    id: "s35",
    title: "Keď Mária plačúcemu",
    category: "vianocne",
    lyrics: "1. Keď Mária plačúcemu a sna si žiadajúcemu\nSynovi očká zastiera, pritom mu pekne tak spieva:\nÓ, milý, á, sladký, á, Ježiško môj!\n\n2. Tys' moja sladkosť vtelená, radosť si moja vznešená.\nSpi, ruža krásna, premilá, z lásky som teba zrodila.\nÓ, milý, á, sladký, á, Ježiško môj!\n\n3. Pastieri tebe spievajú, pred tebou zbožne kľakajú.\nSpi už, á, Synku môj malý, hodný si večnej poklony.\nÓ, milý, á, sladký, á, Ježiško môj!"
  },
  {
    id: "s36",
    title: "Kyrie eleison",
    category: "vianocne",
    lyrics: "1. Kyrie eleison, Kriste eleison!\nPána Krista narodenie stalo sa nám na spasenie.\nPane, vyslyš nás, Kriste, vyslyš nás!\n\n2. Kyrie eleison, Kriste eleison!\nJežiš Kristus milostivý z neba stúpil dobrotivý.\nPane vyslyš nás, Kriste, vyslyš nás!"
  },
  {
    id: "s37",
    title: "Búvaj, Dieťa krásne",
    category: "vianocne",
    lyrics: "1. Búvaj, Dieťa krásne, uložené v jasle;\nbúvaj, búvaj, Pachoľa; milostivé Jezuľa!\nBudeme ťa kolísať, abys' mohol dobre spať,\nJežišku náš milý, aby sa ti snili\nveľmi krásne sny, veľmi krásne sny.\n\n2. Drozdy a hrdličky, chystajte pesničky,\nnech sa Dieťa poteší na tom našom salaši.\nSpev škovránka, slávika, k tomu pekná muzika;\nmy budeme s vami spievať za jasľami\nSynu milému, Synu milému."
  },
  {
    id: "s38",
    title: "Ľudia všetci, kresťania",
    category: "vianocne",
    lyrics: "1. Ľudia všetci, kresťania, počúvajte,\nradostnú novinu, všetci prijímajte.\nSpasiteľ sa nám narodil, Betlehem ho v sebe choval,\nna slame Panna Syna kolísala.\n\n2. Vitaj medzi nami, ó, predrahý Kráľu,\npokoj ty nám prineseš, zbavíš nás od žiaľu.\nAnjeli ho vítali, pastieri mu spievali,\nmy tu pred ním zbožne pokľakáme."
  },
  {
    id: "s39",
    title: "Mária Panna Syna kvíli",
    category: "vianocne",
    lyrics: "1. Mária Panna Syna kvíli\na takto mu pekne spievala:\nJežišku, Synáčku!\n\n2. Pastieri stádo zanechali,\nk Betlemu rýchlo pospíechali\na dary mu oddali,\nveselo mu spievali;\nPane náš, Kráľu náš!"
  },
  {
    id: "s40",
    title: "Počúvajte, kresťania",
    category: "vianocne",
    lyrics: "1. Počúvajte, kresťania,\nčo anjel hlása,\nčo je to zasa nového!\nNič sa nelekajme,\nveselosť robme,\nže sa stal div neslýchaného!\n\n2. Pastieri ovce pásli,\nráno si vstávali,\nvzácnu slávu videli.\nAnjel im hovoril,\nznepokojil,\nveľkú radosť zvestoval im."
  }
];

// Spojím
const allSongs = [...currentSongs, ...newSongs];

// Uložím
fs.writeFileSync('songs.json', JSON.stringify(allSongs, null, 2), 'utf8');

console.log(`✅ Pridaných ${newSongs.length} nových piesní!`);
console.log(`📊 Celkový počet: ${allSongs.length} piesní`);
