// Zistí, či aplikácia beží cez server/server.mjs (napr. na Orange Pi).
// Vtedy sa stav synchronizuje cez server medzi všetkými zariadeniami.
// Pri "npm run dev" server nie je, a stav sa synchronizuje cez localStorage (len v jednom prehliadači).
export const serverAvailable = fetch('/api/state', { cache: 'no-store' })
  .then(res => res.ok && (res.headers.get('content-type') || '').includes('application/json'))
  .catch(() => false);

// Nastavenia servera:
//   dataUrl - odkiaľ brať piesne a obrázky (Orange Pi napojené na administráciu), inak null = GitHub
//   admin   - či na tomto serveri beží administrácia (NAS)
export const appConfig = fetch('/api/config', { cache: 'no-store' })
  .then(res => (res.ok && (res.headers.get('content-type') || '').includes('application/json') ? res.json() : null))
  .then(config => ({ dataUrl: null, admin: false, ...config }))
  .catch(() => ({ dataUrl: null, admin: false }));

const defaultGithubRawUrl = 'https://raw.githubusercontent.com/JanKarajos/tvdisplay/main/songs.json';
const defaultImagesUrl = 'https://raw.githubusercontent.com/JanKarajos/tvdisplay/main/images.json';

// Adresy, odkiaľ sa načítajú piesne, obrázky a kategórie.
// managed = true znamená, že dáta spravuje administrácia (nie GitHub z ovládania).
export async function getDataUrls() {
  const config = await appConfig;
  if (config.dataUrl) {
    return {
      songs: config.dataUrl + 'songs.json',
      images: config.dataUrl + 'images.json',
      categories: config.dataUrl + 'categories.json',
      managed: true,
    };
  }
  const songs = localStorage.getItem('tvdisplay-github-raw') || defaultGithubRawUrl;
  return {
    songs,
    images: localStorage.getItem('tvdisplay-github-images-raw') || defaultImagesUrl,
    // categories.json leží vedľa songs.json
    categories: songs.replace(/[^/]*$/, 'categories.json'),
    managed: false,
  };
}
