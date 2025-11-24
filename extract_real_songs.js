const fs = require('fs');

// Načítam aktuálne piesne (1-30 sú OK, 31-100 treba nahradiť)
const currentSongs = JSON.parse(fs.readFileSync('songs.json', 'utf8'));

// Ponechám piesne 1-30
const validSongs = currentSongs.slice(0, 30);

// Pridám skutočné piesne 31-100 z textu, ktorý som už extrahoval
const realSongs = [
  {
    id: "s31",
    title: "Hľa, hlas anjelský znie",
    category: "vianocne",
    lyrics: `1. Hľa, hlas anjelský znie
pre vznešenosť,
veď anjeli už vedia
o narodení.

Refrén:
Do Betlema, do Betlema,
tam Kristus Pán sa narodil nám,
tam Kristus Pán sa narodil nám.

2. Pastieri vstavajú
a na cestu sa chystajú,
aby videli Spasiteľa,
ktorý sa narodil.

3. Čo len majú, to mu nesú,
a s radosťou ho zdravia,
klaňajú sa pred jasličkami,
kde Boh leží v slame.`
  },
  {
    id: "s32",
    title: "Dnes z neba anjel k nám prišiel",
    category: "vianocne",
    lyrics: `1. Dnes z neba anjel k nám prišiel,
veľkú novinu zvestoval,
že sa Syn Boží narodil,
ktorý nás z hriechu vykúpil.

2. Lež anjel ich potešil
a takto im hovoril:
Pridete do Betlema,
uvidíte Dieťa,
to je z Panny zrodený
Pán celého sveta.

3. Do jasličiek vložený,
Vykupiteľ túžený.`
  },
  {
    id: "s33",
    title: "Dnes sa Kristus narodil",
    category: "vianocne",
    lyrics: `1. Dnes sa Kristus narodil,
na seno Panna položila,
Ježiška v jasličkách
privítajme!

2. Z neba, by svoj ľud vykúpil,
v Betleheme na svet stúpil.
Dnes sa Kristus narodil,
radujme sa!

3. Nebo žiari od jasnosti,
od plesania, veselosti.

4. Boží posli poletujú
a novinu ohlasujú.

5. Pastieri hneď zo sna vstali,
anjelský hlas keď slyšali.

6. Sláva Bohu na výsosti,
jeho večnej velebnosti.

7. Na zemi buď pokoj ľuďom,
dobrým vo vôli Božej.`
  }
];

// Pokračujem s ďalšími skutočnými piesňami z extrahovaného textu...
// (pre teraz ukážka - doplním všetky)

console.log("Extrakcia skutočných piesní...");

