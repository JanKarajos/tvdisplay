const fs = require('fs');
const songs = JSON.parse(fs.readFileSync('songs.json', 'utf8'));

// Odstránim duplicity podľa ID
const uniqueSongs = [];
const seenIds = new Set();

for (const song of songs) {
  if (!seenIds.has(song.id)) {
    seenIds.add(song.id);
    uniqueSongs.push(song);
  }
}

fs.writeFileSync('songs.json', JSON.stringify(uniqueSongs, null, 2), 'utf8');

console.log('✅ Odstránené duplicity');
console.log('📊 Pôvodný počet: ' + songs.length);
console.log('📊 Nový počet: ' + uniqueSongs.length);
