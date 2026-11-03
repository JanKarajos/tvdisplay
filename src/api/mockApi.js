import { realtime } from '../hooks/useRealtime';
import { serverAvailable } from './server';

// Kategórie sa načítajú dynamicky z piesní
let DEMO_CATEGORIES = [];

// Kategórie uložené v categories.json (aj prázdne kategórie a pekné názvy s diakritikou)
let CUSTOM_CATEGORIES = [];

// Piesne sa načítajú z GitHub
let DEMO_SONGS = [];

// Obrázky na pozadie sa načítajú z GitHub
let DEMO_IMAGES = [];

function pause(ms) { return new Promise(res => setTimeout(res, ms)); }

const DEFAULT_STATE = { currentSongId: null, background: null, isHidden: false, currentPage: 0 };

// Doplní kategórie z categories.json do kategórií odvodených z piesní
function mergeCustomCategories() {
  CUSTOM_CATEGORIES.forEach(c => {
    const existing = DEMO_CATEGORIES.find(d => d.id === c.id);
    if (existing) existing.name = c.name;
    else DEMO_CATEGORIES.push({ id: c.id, name: c.name });
  });
}

// Relatívne adresy médií (napr. "media/x.jpg" z administrácie) prevedie na plné voči adrese JSON súboru
function resolveMediaUrl(url, base) {
  if (!url || /^(data:|blob:|https?:)/i.test(url)) return url;
  return new URL(url, new URL(base, window.location.href)).href;
}

// Pridá do URL parameter, aby sme obišli cache raw.githubusercontent.com
function freshUrl(url) {
  return url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
}

function encodeBase64(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch (e) {
    // fallback for environments without btoa/unescape
    return Buffer.from(str, 'utf8').toString('base64');
  }
}

// Vytvorí alebo prepíše súbor v GitHub repo pomocou contents API.
// content musí byť už v base64.
async function putGitHubFile({ owner, repo, path, token, message, content }) {
  if (!owner || !repo || !path || !token) throw new Error('owner, repo, path and token are required');
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  // First try to GET the existing file to obtain sha (if exists)
  let sha = undefined;
  try {
    const getRes = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } });
    if (getRes.ok) {
      const getData = await getRes.json();
      sha = getData.sha;
    }
  } catch (e) {
    console.warn('Could not get existing file (it may not exist):', e);
  }

  const body = { message, content };
  if (sha) body.sha = sha;

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error('Failed to save ' + path + ' to GitHub: ' + putRes.status + ' ' + errText);
  }

  return putRes.json();
}

export const api = {
  getCategories: async () => { 
    await pause(100); 
    console.log('getCategories called, returning:', DEMO_CATEGORIES);
    return DEMO_CATEGORIES; 
  },
  getSongsByCategory: async (cat) => { 
    await pause(100); 
    const filtered = DEMO_SONGS.filter(s => s.category === cat);
    console.log('getSongsByCategory called for', cat, 'found', filtered.length, 'songs from total', DEMO_SONGS.length);
    return filtered;
  },
  getAllSongs: async () => {
    await pause(100);
    console.log('getAllSongs called, returning:', DEMO_SONGS.length, 'songs');
    return DEMO_SONGS.filter(s => s.category); // Vráti všetky piesne s kategóriou (nie obrázky/prezentácie)
  },
  getImages: async () => {
    await pause(50);
    console.log('getImages called, returning:', DEMO_IMAGES.length, 'images');
    return DEMO_IMAGES;
  },
  addCustomSong: async ({ title, lyrics, imageUrl, category, pdfUrl, pageCount }) => {
    await pause(100);
    const id = 'custom-' + Math.random().toString(36).slice(2, 10);
    
    // Ak je to iba obrázok (bez lyrics a pdfUrl), pridaj do DEMO_IMAGES
    if (imageUrl && !lyrics && !pdfUrl) {
      const newImage = { id, title, imageUrl };
      DEMO_IMAGES.push(newImage);
      return newImage;
    }
    
    // Inak pridaj do DEMO_SONGS
    const newSong = { id, title, category };
    if (imageUrl) newSong.imageUrl = imageUrl;
    if (lyrics) newSong.lyrics = lyrics;
    if (pdfUrl) {
      newSong.pdfUrl = pdfUrl;
      newSong.pageCount = pageCount || 1;
      newSong.type = 'pdf';
    }
    DEMO_SONGS.push(newSong);
    return newSong;
  },
  getPresentations: async () => {
    await pause(50);
    if (!Array.isArray(DEMO_SONGS)) return [];
    return DEMO_SONGS.filter(s => s.type === 'pdf');
  },
  getSong: async (id) => { 
    await pause(80); 
    console.log('getSong called with id:', id, 'Total songs:', DEMO_SONGS.length);
    // Obrázky sú v samostatnom zozname (images.json)
    const song = DEMO_SONGS.find(s => s.id === id) || DEMO_IMAGES.find(img => img.id === id);
    console.log('Found song:', song);
    return song || null; 
  },
  loadPsalm: async () => { await pause(300); return { id: 'psalm-today', title: 'Responzóriový žalm (dnes)', lyrics: 'Hospodin je môj pastier\nNenúdím sa' }; },
  state: JSON.parse(localStorage.getItem('tvdisplay-api-state') || '{"currentSongId":null,"background":null,"isHidden":false,"currentPage":0}'),
  getState: async () => { 
    if (await serverAvailable) {
      const cached = realtime.getServerState();
      if (cached) {
        api.state = cached;
        return api.state;
      }
      const res = await fetch('/api/state', { cache: 'no-store' });
      api.state = { ...DEFAULT_STATE, ...(await res.json()) };
      return api.state;
    }
    await pause(50); 
    const savedState = localStorage.getItem('tvdisplay-api-state');
    if (savedState) {
      api.state = JSON.parse(savedState);
    }
    return api.state; 
  },
  addCategory: async ({ name }) => {
    await pause(100);
    const id = name.trim().toLowerCase().replace(/\s+/g, '-');
    const newCategory = { id, name: name.trim() };
    CUSTOM_CATEGORIES = [...CUSTOM_CATEGORIES.filter(c => c.id !== id), newCategory];
    const existing = DEMO_CATEGORIES.find(c => c.id === id);
    if (existing) existing.name = newCategory.name;
    else DEMO_CATEGORIES.push(newCategory);
    return newCategory;
  },
  setState: async (st) => { 
    console.log('Setting new state:', st);
    if (await serverAvailable) {
      // Server stav zlúči a rozpošle všetkým zariadeniam
      try {
        const res = await fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(st)
        });
        if (!res.ok) throw new Error('Server vrátil ' + res.status);
      } catch (e) {
        console.error('Error setting state on server:', e);
        return api.state;
      }
      api.state = { ...DEFAULT_STATE, ...(realtime.getServerState() || api.state), ...st };
      return api.state;
    }
    try {
      // Načítaj aktuálny stav
      let currentState;
      try {
        currentState = JSON.parse(localStorage.getItem('tvdisplay-api-state') || '{"currentSongId":null,"background":null,"isHidden":false,"currentPage":0}');
      } catch (e) {
        console.error('Error parsing stored state, using default:', e);
        currentState = {"currentSongId":null,"background":null,"isHidden":false,"currentPage":0};
      }

      // Vytvor nový stav
      const newState = { ...currentState, ...st };
      console.log('New merged state:', newState);
      
      // Ulož stav do api
      api.state = newState;

      // Ulož stav do localStorage
      try {
        localStorage.setItem('tvdisplay-api-state', JSON.stringify(newState));
      } catch (e) {
        console.error('Error saving to localStorage:', e);
      }
      
      // Emituj zmenu stavu
      console.log('Emitting new state:', newState);
      realtime.emit({ type: 'state', state: newState });
      return newState;
    } catch (e) {
      console.error('Error setting state:', e);
      return api.state;
    }
  },

  // --- Remote / GitHub helpers ---
  remoteSource: null,
  remoteImagesSource: null,
  setRemoteSource: async (url) => {
    api.remoteSource = url;
    return url;
  },
  setRemoteImagesSource: async (url) => {
    api.remoteImagesSource = url;
    return url;
  },
  // Load songs from a raw JSON URL (for example raw.githubusercontent.com/.../songs.json)
  loadRemoteSongs: async (url, { fresh = false } = {}) => {
    const target = url || api.remoteSource;
    if (!target) throw new Error('No remote URL provided');
    await pause(100);
    try {
      console.log('Loading songs from:', target);
      const res = await fetch(fresh ? freshUrl(target) : target);
      if (!res.ok) throw new Error('Failed to fetch remote songs: ' + res.statusText);
      const data = await res.json();
      console.log('Loaded data:', data);
      if (Array.isArray(data)) {
        data.forEach(s => {
          if (s.pdfUrl) s.pdfUrl = resolveMediaUrl(s.pdfUrl, target);
          if (s.imageUrl) s.imageUrl = resolveMediaUrl(s.imageUrl, target);
        });
        DEMO_SONGS = data;
        console.log('Updated DEMO_SONGS to:', DEMO_SONGS.length, 'songs');
        // Rebuild categories from loaded songs (unique non-empty categories)
        try {
          const cats = Array.from(new Set(data.map(s => s.category).filter(Boolean)))
            .map(id => ({ id, name: id.replace(/[-_]/g, ' ').replace(/\b\w/g, c=>c.toUpperCase()) }));
          console.log('Rebuilt categories:', cats);
          if (cats.length) {
            // replace demo categories with those inferred from data
            DEMO_CATEGORIES.length = 0;
            cats.forEach(c => DEMO_CATEGORIES.push(c));
            mergeCustomCategories();
            console.log('Updated DEMO_CATEGORIES to:', DEMO_CATEGORIES);
          }
        } catch (e) {
          console.warn('Could not rebuild categories from remote data', e);
        }
      }
      return data;
    } catch (e) {
      console.error('Error loading remote songs:', e);
      throw e;
    }
  },
  // Load images from a raw JSON URL (for example raw.githubusercontent.com/.../images.json)
  loadRemoteImages: async (url, { fresh = false } = {}) => {
    const target = url || api.remoteImagesSource;
    if (!target) throw new Error('No remote images URL provided');
    await pause(100);
    try {
      console.log('Loading images from:', target);
      const res = await fetch(fresh ? freshUrl(target) : target);
      if (!res.ok) throw new Error('Failed to fetch remote images: ' + res.statusText);
      const data = await res.json();
      console.log('Loaded images:', data);
      if (Array.isArray(data)) {
        data.forEach(img => { img.imageUrl = resolveMediaUrl(img.imageUrl, target); });
        DEMO_IMAGES = data;
        console.log('Updated DEMO_IMAGES to:', DEMO_IMAGES.length, 'images');
      }
      return data;
    } catch (e) {
      console.error('Error loading remote images:', e);
      throw e;
    }
  },
  // Load categories from a raw JSON URL (categories.json: [{ id, name }])
  loadRemoteCategories: async (url, { fresh = false } = {}) => {
    const res = await fetch(fresh ? freshUrl(url) : url);
    // categories.json nemusí existovať (kým sa nepridá prvá kategória)
    if (res.status === 404) return CUSTOM_CATEGORIES;
    if (!res.ok) throw new Error('Failed to fetch remote categories: ' + res.statusText);
    const data = await res.json();
    if (Array.isArray(data)) {
      CUSTOM_CATEGORIES = data.filter(c => c && c.id && c.name);
      mergeCustomCategories();
    }
    return CUSTOM_CATEGORIES;
  },
  // Save current DEMO_SONGS to a GitHub repo path using the contents API.
  // params: { owner, repo, path, token, message }
  saveSongsToGitHub: async ({ owner, repo, path, token, message = 'Update songs.json from tvdisplay' }) => {
    const content = encodeBase64(JSON.stringify(DEMO_SONGS, null, 2));
    return putGitHubFile({ owner, repo, path, token, message, content });
  },
  // Save current DEMO_IMAGES to a GitHub repo path using the contents API.
  // params: { owner, repo, path, token, message }
  saveImagesToGitHub: async ({ owner, repo, path, token, message = 'Update images.json from tvdisplay' }) => {
    const content = encodeBase64(JSON.stringify(DEMO_IMAGES, null, 2));
    return putGitHubFile({ owner, repo, path, token, message, content });
  },
  // Save custom categories (categories.json) to a GitHub repo path.
  saveCategoriesToGitHub: async ({ owner, repo, path, token, message = 'Update categories.json from tvdisplay' }) => {
    const content = encodeBase64(JSON.stringify(CUSTOM_CATEGORIES, null, 2));
    return putGitHubFile({ owner, repo, path, token, message, content });
  },
  // Upload a PDF (data URL) as a separate file to the repo and return its raw URL.
  uploadPdfToGitHub: async ({ owner, repo, path, token, dataUrl, message = 'Add PDF from tvdisplay' }) => {
    const content = dataUrl.slice(dataUrl.indexOf(',') + 1);
    await putGitHubFile({ owner, repo, path, token, message, content });
    return `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`;
  }
};
