const fs = require('fs');

// Načítam aktuálne piesne
const currentSongs = JSON.parse(fs.readFileSync('songs.json', 'utf8'));

// Nové piesne 11-100 (extrahované z web stránky)
const newSongs = [
  {
    id: "s11",
    title: "Ó, príďže, Emanuel",
    category: "adventne",
    lyrics: `1. Ó, príďže, Emanuel,
vykúp svoj ľud Izrael,
ktorý v zajatí teraz žije,
až kým sa Syn Boží nezjaví.

Refrén:
Plesaj zem, veseľ sa, javy radosť,
bo príde Emanuel, príde ku nám sám.

2. Ó, príďže, Odrod Jesseho,
vykúp národ z biedy svojho,
z diablovej moci vyvedieš nás,
a dar spásy dávaš, večný kráľ náš.

3. Ó, príďže, Dieťa nebeské,
Dieťatko božské, anjelské,
čakáme tvoju potechu,
veľmi sme padli do hriechu.

4. Ó, príďže, príď, náš Spasiteľ,
nebeský ty náš Tešiteľ,
a prines nám dar milosti,
vo viere daj nám stálosti.`
  },
  {
    id: "s12",
    title: "Čistá Panna",
    category: "adventne",
    lyrics: `1. Čistá Panna,
nádej sladká,
Božia Matka!

2. Ty si pozdravenie prijala,
Božie znamenie z úst anjela.
Čistá Panna,
nádej sladká,
Božia Matka!

3. Ľud svoj hriešny vedieš k spaseniu,
nevidia ich k svetlu krásnemu.
Čistá Panna,
nádej sladká,
Božia Matka!

4. Že si našou Matkou, nám ukáž,
prijať milostivo ráč hlas náš.
Čistá Panna,
nádej sladká,
Božia Matka!

5. Daj nám ruku, veď nás do neba,
tam, kde sídli Božia veleba.
Čistá Panna,
nádej sladká,
Božia Matka!`
  },
  {
    id: "s13",
    title: "Zdravas', zdravas', ó, Mária",
    category: "adventne",
    lyrics: `1. Zdravas', zdravas', ó, Mária,
milosti si Božej plná!
Tak pozdravil anjel teba
v Nazaretskom meste tvojom dome.

2. Nezľakni sa, Panna čistá,
v Ducha Svätého milosti
počneš Syna Božieho,
ktorý bude veľký, večný Pán.

3. Dievka Pánova volala:
Staň sa podľa slova tvojho!
Hľa, služobnica tu Pána,
sľub môj známy je u Pána.

4. Z Ducha Svätého
zatienivšieho
počneš a zrodený z teba
Syn milený
bude jak Boh velebený.

5. Dievka Pánova,
čujúc tie slová,
s úctou sa sklonila
a ticho vravela:
Bohu som sa pokorila.

6. Raduj sa milá,
Matka spanilá,
Syn Boží sám seba
láskavo k nám z neba
na svet vtelí skrze teba.`
  }
];

// Zvyšok piesní 14-100 budem pridávať postupne z textu
// Tu zatiaľ len ukážka - potrebujem manuálne extrahovať všetky piesne

console.log("Script ready - need to add songs 14-100");
