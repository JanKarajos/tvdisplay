import { realtime } from '../hooks/useRealtime';
import psalms2026 from '../../Texty/Žalmy 2026.json';
import psalms2027 from '../../Texty/Žalmy 2027.json';

// Kategórie sa načítajú dynamicky z piesní
let DEMO_CATEGORIES = [];

// Piesne sa načítajú z GitHub
let DEMO_SONGS = [];

// Obrázky na pozadie sa načítajú z GitHub
let DEMO_IMAGES = [];

function pause(ms) { return new Promise(res => setTimeout(res, ms)); }

function toLocalISODate(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizePsalmRefrain(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Defensive: if scraping ever captured an entire HTML page/error response,
  // do not show it on the display.
  const lower = trimmed.toLowerCase();
  const looksLikeHtml =
    lower.includes('<html') ||
    lower.includes('<!doctype') ||
    lower.includes('lang="sk"') ||
    (trimmed.includes('<') && trimmed.includes('>') && trimmed.length > 80);

  if (looksLikeHtml) return null;
  if (trimmed.length > 500) return null;

  return trimmed;
}

function buildPsalmMap(dataset, yearLabel) {
  try {
    const entries = Array.isArray(dataset?.content) ? dataset.content : [];
    const map = new Map();
    for (const item of entries) {
      if (!item?.number) continue;
      const refrain = Array.isArray(item.strophes) ? item.strophes[0] : null;
      if (typeof refrain === 'string' && refrain.trim()) {
        map.set(item.number, refrain.trim());
      }
    }
    return map;
  } catch (e) {
    console.warn(`Failed to build psalm map for ${yearLabel}:`, e);
    return new Map();
  }
}

const PSALM_MAPS_BY_YEAR = new Map([
  ['2026', buildPsalmMap(psalms2026, '2026')],
  ['2027', buildPsalmMap(psalms2027, '2027')],
]);

function getStateServerUrl() {
  return window.location.hostname === 'localhost'
    ? 'http://localhost:3002'
    : `http://${window.location.hostname}:3002`;
}

async function ensurePsalmYearLoaded(year) {
  if (!/^\d{4}$/.test(String(year))) return;
  if (PSALM_MAPS_BY_YEAR.has(year)) return;

  const baseUrl = getStateServerUrl();
  try {
    const response = await fetch(`${baseUrl}/api/psalms/${year}`, {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return;

    const json = await response.json();
    const map = buildPsalmMap(json, year);
    if (map.size) PSALM_MAPS_BY_YEAR.set(year, map);
  } catch {
    // ignore
  }
}

async function getPsalmRefrainForDateAsync(isoDate) {
  const year = String(isoDate || '').slice(0, 4);
  await ensurePsalmYearLoaded(year);
  const map = PSALM_MAPS_BY_YEAR.get(year);
  if (map) return map.get(isoDate);

  // Fallback: try known maps
  return PSALM_MAPS_BY_YEAR.get('2027')?.get(isoDate) || PSALM_MAPS_BY_YEAR.get('2026')?.get(isoDate);
}

async function buildPsalmSong(dateStr) {
  const isoDate = typeof dateStr === 'string' && dateStr.trim() ? dateStr.trim() : toLocalISODate();
  const rawRefrain = await getPsalmRefrainForDateAsync(isoDate);
  const refrain = normalizePsalmRefrain(rawRefrain);
  const lyrics = refrain || `Žalm pre dátum ${isoDate} sa nenašiel.`;
  if (!refrain && typeof rawRefrain === 'string' && rawRefrain.trim()) {
    console.warn('[psalm] Invalid refrain payload for', isoDate, 'starting with:', rawRefrain.trim().slice(0, 120));
  }
  return {
    id: `psalm-${isoDate}`,
    title: `Responzóriový žalm (${isoDate})`,
    category: 'Žalmy',
    lyrics,
    hideTitle: true,
  };
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
  deleteImage: async (imageId) => {
    await pause(100);
    console.log('[deleteImage] Attempting to delete image with ID:', imageId);
    console.log('[deleteImage] Current DEMO_IMAGES:', DEMO_IMAGES);
    console.log('[deleteImage] DEMO_IMAGES length:', DEMO_IMAGES.length);
    const index = DEMO_IMAGES.findIndex(img => img.id === imageId);
    console.log('[deleteImage] Found index:', index);
    if (index !== -1) {
      DEMO_IMAGES.splice(index, 1);
      console.log('[deleteImage] Deleted image. Total images:', DEMO_IMAGES.length);
      return true;
    }
    console.log('[deleteImage] Image not found in DEMO_IMAGES');
    return false;
  },
  addCustomSong: async ({ title, lyrics, imageUrl, category, pdfUrl, pageCount }) => {
    await pause(100);
    const id = 'custom-' + Math.random().toString(36).slice(2, 10);
    
    // Ak je to iba obrázok (bez lyrics a pdfUrl), pridaj do DEMO_IMAGES
    if (imageUrl && !lyrics && !pdfUrl) {
      const newImage = { id, title, imageUrl };
      DEMO_IMAGES.push(newImage);
      console.log('[addCustomSong] Added image to DEMO_IMAGES. Total images:', DEMO_IMAGES.length, DEMO_IMAGES);
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
    console.log('[addCustomSong] Added song to DEMO_SONGS. Total songs:', DEMO_SONGS.length);
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
    if (typeof id === 'string' && id.startsWith('psalm-')) {
      const dateStr = id.slice('psalm-'.length);
      return await buildPsalmSong(dateStr);
    }
    const song = DEMO_SONGS.find(s => s.id === id);
    console.log('Found song:', song);
    return song || null; 
  },
  loadPsalm: async ({ date } = {}) => {
    await pause(100);
    return await buildPsalmSong(date);
  },
  state: JSON.parse(localStorage.getItem('tvdisplay-api-state') || '{"currentSongId":null,"background":null,"isHidden":false,"currentPage":0,"selectedSongIds":[],"nextSongId":null}'),
  stateServerUrl: window.location.hostname === 'localhost' 
    ? 'http://localhost:3002' 
    : `http://${window.location.hostname}:3002`,
  useStateServer: false,
  
  // Skontroluj dostupnosť state servera
  checkStateServer: async function() {
    try {
      const response = await fetch(`${this.stateServerUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      if (response.ok) {
        this.useStateServer = true;
        console.log('✅ mockApi: State server je dostupný');
        return true;
      }
    } catch (error) {
      console.log('⚠️ mockApi: State server nie je dostupný, používam localStorage');
    }
    this.useStateServer = false;
    return false;
  },
  
  getState: async function() { 
    await pause(50);
    
    // Skús načítať zo state servera
    if (this.useStateServer) {
      try {
        const response = await fetch(`${this.stateServerUrl}/api/state`);
        if (response.ok) {
          const serverState = await response.json();
          this.state = serverState;
          // Aktualizuj aj localStorage pre fallback
          localStorage.setItem('tvdisplay-api-state', JSON.stringify(serverState));
          return this.state;
        }
      } catch (error) {
        console.warn('Chyba pri načítaní zo state servera, používam localStorage:', error);
        this.useStateServer = false;
      }
    }
    
    // Fallback na localStorage
    const savedState = localStorage.getItem('tvdisplay-api-state');
    if (savedState) {
      this.state = JSON.parse(savedState);
    }
    return this.state; 
  },
  addCategory: async ({ name }) => {
    await pause(100);
    const id = name.toLowerCase().replace(/\s+/g, '-');
    const newCategory = { id, name };
    DEMO_CATEGORIES.push(newCategory);
    return newCategory;
  },
  setState: async function(st) { 
    console.log('Setting new state:', st);
    try {
      // Načítaj aktuálny stav
      let currentState;
      
      // Ak používame state server, načítaj z neho
      if (this.useStateServer) {
        try {
          const response = await fetch(`${this.stateServerUrl}/api/state`);
          if (response.ok) {
            currentState = await response.json();
          } else {
            throw new Error('Server nedostupný');
          }
        } catch (error) {
          console.warn('State server nedostupný, používam localStorage');
          this.useStateServer = false;
          currentState = JSON.parse(localStorage.getItem('tvdisplay-api-state') || '{"currentSongId":null,"background":null,"isHidden":false,"currentPage":0,"selectedSongIds":[],"nextSongId":null}');
        }
      } else {
        try {
          currentState = JSON.parse(localStorage.getItem('tvdisplay-api-state') || '{"currentSongId":null,"background":null,"isHidden":false,"currentPage":0,"selectedSongIds":[],"nextSongId":null}');
        } catch (e) {
          console.error('Error parsing stored state, using default:', e);
          currentState = {"currentSongId":null,"background":null,"isHidden":false,"currentPage":0,"selectedSongIds":[],"nextSongId":null};
        }
      }

      // Vytvor nový stav
      const newState = { ...currentState, ...st };
      console.log('New merged state:', newState);
      
      // Ulož stav do api
      this.state = newState;

      // Ak používame state server, ulož na server
      if (this.useStateServer) {
        try {
          const response = await fetch(`${this.stateServerUrl}/api/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newState)
          });
          if (response.ok) {
            console.log('✅ Stav uložený na state server');
          } else {
            throw new Error('Server error');
          }
        } catch (error) {
          console.error('Chyba pri ukladaní na state server, používam localStorage:', error);
          this.useStateServer = false;
        }
      }

      // Vždy ulož aj do localStorage (fallback)
      try {
        localStorage.setItem('tvdisplay-api-state', JSON.stringify(newState));
      } catch (e) {
        console.error('Error saving to localStorage:', e);
      }
      
      // Emituj zmenu stavu (pre realtime hook)
      console.log('Emitting new state:', newState);
      realtime.emit({ type: 'state', state: newState });
      return newState;
    } catch (e) {
      console.error('Error setting state:', e);
      return this.state;
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
  // Load images from a raw JSON URL (for example raw.githubusercontent.com/.../images.json)
  loadRemoteImages: async (url) => {
    const target = url || api.remoteImagesSource;
    if (!target) throw new Error('No remote images URL provided');
    await pause(100);
    try {
      console.log('Loading images from:', target);
      
      // Ak je to GitHub raw URL, použi Contents API aby sme obišli cache
      if (target.includes('raw.githubusercontent.com')) {
        // Odstráň existujúce cache-busting parametre z URL
        const cleanTarget = target.split('?')[0];
        
        // Konvertuj raw URL na Contents API URL
        // raw.githubusercontent.com/owner/repo/branch/path -> api.github.com/repos/owner/repo/contents/path?ref=branch
        const match = cleanTarget.match(/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)/);
        if (match) {
          const [, owner, repo, branch, path] = match;
          // Pridaj timestamp aby sme obišli cache
          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}&_=${Date.now()}`;
          console.log('Using GitHub Contents API:', apiUrl);
          
          const res = await fetch(apiUrl, {
            headers: {
              'Accept': 'application/vnd.github.v3+json'
            }
          });
          
          if (!res.ok) {
            console.error('GitHub API error:', res.status, res.statusText);
            throw new Error('Failed to fetch from GitHub API: ' + res.statusText);
          }
          
          const fileData = await res.json();
          // GitHub Contents API vracia base64-encoded content
          const encodedContent = fileData.content ? fileData.content.replace(/\n/g, '') : '';
          
          // Ak je content prázdny (veľké súbory), použi download_url
          if (!encodedContent || encodedContent.trim() === '') {
            if (fileData.download_url) {
              console.log('Content empty, using download_url:', fileData.download_url);
              const downloadRes = await fetch(fileData.download_url);
              if (!downloadRes.ok) throw new Error('Failed to download file');
              const data = await downloadRes.json();
              console.log('Loaded images via download_url:', data);
              
              if (Array.isArray(data)) {
                DEMO_IMAGES = data;
                console.log('Updated DEMO_IMAGES to:', DEMO_IMAGES.length, 'images');
              }
              return data;
            } else {
              console.log('Empty file on GitHub, returning empty array');
              DEMO_IMAGES = [];
              return [];
            }
          }
          
          const content = atob(encodedContent);
          const data = JSON.parse(content);
          console.log('Loaded images via Contents API:', data);
          
          if (Array.isArray(data)) {
            DEMO_IMAGES = data;
            console.log('Updated DEMO_IMAGES to:', DEMO_IMAGES.length, 'images');
          }
          return data;
        }
      }
      
      // Fallback na normálny fetch s cache-busting
      const cacheBreaker = target.includes('?') ? `&_=${Date.now()}` : `?_=${Date.now()}`;
      const res = await fetch(target + cacheBreaker);
      if (!res.ok) throw new Error('Failed to fetch remote images: ' + res.statusText);
      const data = await res.json();
      console.log('Loaded images:', data);
      if (Array.isArray(data)) {
        DEMO_IMAGES = data;
        console.log('Updated DEMO_IMAGES to:', DEMO_IMAGES.length, 'images');
      }
      return data;
    } catch (e) {
      console.error('Error loading remote images:', e);
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
      let errorMsg = `Failed to save to GitHub: ${putRes.status}`;
      
      if (putRes.status === 401) {
        errorMsg += ' - UNAUTHORIZED: GitHub token je neplatný alebo chýba. Skontroluj token v nastaveniach.';
      } else if (putRes.status === 403) {
        errorMsg += ' - FORBIDDEN: Token nemá práva na zápis do repozitára. Musíš vytvoriť nový token s "repo" oprávnením.';
      } else if (putRes.status === 404) {
        errorMsg += ' - NOT FOUND: Repozitár alebo cesta neexistuje. Skontroluj Owner/Repo/Path.';
      } else if (putRes.status === 422) {
        errorMsg += ' - VALIDATION ERROR: GitHub odmietol súbor (napr. nesprávny SHA). Skús znova.';
      }
      
      console.error('[saveSongsToGitHub] Full error:', errText);
      throw new Error(errorMsg + '\n\nDetails: ' + errText);
    }

    const resData = await putRes.json();
    return resData;
  },
  // Save current DEMO_IMAGES to a GitHub repo path using the contents API.
  // params: { owner, repo, path, token, message }
  saveImagesToGitHub: async ({ owner, repo, path, token, message = 'Update images.json from tvdisplay' }) => {
    if (!owner || !repo || !path || !token) throw new Error('owner, repo, path and token are required');
    console.log('[saveImagesToGitHub] Saving', DEMO_IMAGES.length, 'images to GitHub:', DEMO_IMAGES);
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const contentStr = JSON.stringify(DEMO_IMAGES, null, 2);
    console.log('[saveImagesToGitHub] Content to save:', contentStr);
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
      let errorMsg = `Failed to save images to GitHub: ${putRes.status}`;
      
      if (putRes.status === 401) {
        errorMsg += ' - UNAUTHORIZED: GitHub token je neplatný alebo chýba. Skontroluj token v nastaveniach.';
      } else if (putRes.status === 403) {
        errorMsg += ' - FORBIDDEN: Token nemá práva na zápis do repozitára. Musíš vytvoriť nový token s "repo" oprávnením.';
      } else if (putRes.status === 404) {
        errorMsg += ' - NOT FOUND: Repozitár alebo cesta neexistuje. Skontroluj Owner/Repo/Path.';
      } else if (putRes.status === 422) {
        errorMsg += ' - VALIDATION ERROR: GitHub odmietol súbor (napr. nesprávny SHA). Skús znova.';
      }
      
      console.error('[saveImagesToGitHub] Full error:', errText);
      throw new Error(errorMsg + '\n\nDetails: ' + errText);
    }

    const resData = await putRes.json();
    return resData;
  }
};
