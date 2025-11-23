import { realtime } from '../hooks/useRealtime';

// Kategórie sa načítajú dynamicky z piesní
let DEMO_CATEGORIES = [];

// Piesne sa načítajú z GitHub
let DEMO_SONGS = [];

function pause(ms) { return new Promise(res => setTimeout(res, ms)); }

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
    if (!Array.isArray(DEMO_SONGS)) return [];
    return DEMO_SONGS.filter(s => s.imageUrl && !s.category);
  },
  addCustomSong: async ({ title, lyrics, imageUrl, category, pdfUrl, pageCount }) => {
    await pause(100);
    const id = 'custom-' + Math.random().toString(36).slice(2, 10);
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
    const song = DEMO_SONGS.find(s => s.id === id);
    console.log('Found song:', song);
    return song || null; 
  },
  loadPsalm: async () => { await pause(300); return { id: 'psalm-today', title: 'Responzóriový žalm (dnes)', lyrics: 'Hospodin je môj pastier\nNenúdím sa' }; },
  state: JSON.parse(localStorage.getItem('tvdisplay-api-state') || '{"currentSongId":null,"background":null,"isHidden":false,"currentPage":0}'),
  getState: async () => { 
    await pause(50); 
    const savedState = localStorage.getItem('tvdisplay-api-state');
    if (savedState) {
      api.state = JSON.parse(savedState);
    }
    return api.state; 
  },
  addCategory: async ({ name }) => {
    await pause(100);
    const id = name.toLowerCase().replace(/\s+/g, '-');
    const newCategory = { id, name };
    DEMO_CATEGORIES.push(newCategory);
    return newCategory;
  },
  setState: async (st) => { 
    console.log('Setting new state:', st);
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
  setRemoteSource: async (url) => {
    api.remoteSource = url;
    return url;
  },
  // Load songs from a raw JSON URL (for example raw.githubusercontent.com/.../songs.json)
  loadRemoteSongs: async (url) => {
    const target = url || api.remoteSource;
    if (!target) throw new Error('No remote URL provided');
    await pause(100);
    try {
      console.log('Loading songs from:', target);
      const res = await fetch(target);
      if (!res.ok) throw new Error('Failed to fetch remote songs: ' + res.statusText);
      const data = await res.json();
      console.log('Loaded data:', data);
      if (Array.isArray(data)) {
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
  // Save current DEMO_SONGS to a GitHub repo path using the contents API.
  // params: { owner, repo, path, token, message }
  saveSongsToGitHub: async ({ owner, repo, path, token, message = 'Update songs.json from tvdisplay' }) => {
    if (!owner || !repo || !path || !token) throw new Error('owner, repo, path and token are required');
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const contentStr = JSON.stringify(DEMO_SONGS, null, 2);
    // GitHub expects base64 encoded content
    const encodeBase64 = (str) => {
      try {
        return btoa(unescape(encodeURIComponent(str)));
      } catch (e) {
        // fallback for environments without btoa/unescape
        return Buffer.from(str, 'utf8').toString('base64');
      }
    };

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

    const body = {
      message,
      content: encodeBase64(contentStr),
    };
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
      throw new Error('Failed to save to GitHub: ' + putRes.status + ' ' + errText);
    }

    const resData = await putRes.json();
    return resData;
  }
};
