import React, { useState, useEffect } from 'react';
import { api } from '../api/mockApi';
import { useRealtime } from '../hooks/useRealtime';
import Card from '../components/Card';
import Preview from '../components/Preview';

export default function ControlPage() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [songs, setSongs] = useState([]);
  const [queue, setQueue] = useState([]);
  const [state, setState] = useState({ currentSongId: null, background: null, isHidden: false });
  const [currentSong, setCurrentSong] = useState(null);
  // Stav pre vyhľadávanie
  const [searchQuery, setSearchQuery] = useState("");
  // Stav pre text
  const [textTitle, setTextTitle] = useState("");
  const [textLyrics, setTextLyrics] = useState("");
  const [textCategory, setTextCategory] = useState("");
  const [addingText, setAddingText] = useState(false);
  // Stav pre obrázok
  const [imageTitle, setImageTitle] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [addingImage, setAddingImage] = useState(false);
  const [images, setImages] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  // Stav pre PDF prezentácie
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [addingPdf, setAddingPdf] = useState(false);
  const [presentations, setPresentations] = useState([]);
  // Stav pre GitHub sync
  const defaultGithubRawUrl = 'https://raw.githubusercontent.com/JanKarajos/tvdisplay/main/songs.json';
  const [githubRawUrl, setGithubRawUrl] = useState(localStorage.getItem('tvdisplay-github-raw') || defaultGithubRawUrl);
  const [githubOwner, setGithubOwner] = useState(localStorage.getItem('tvdisplay-github-owner') || 'JanKarajos');
  const [githubRepo, setGithubRepo] = useState(localStorage.getItem('tvdisplay-github-repo') || 'tvdisplay');
  const [githubPath, setGithubPath] = useState(localStorage.getItem('tvdisplay-github-path') || 'songs.json');
  const [githubToken, setGithubToken] = useState(localStorage.getItem('tvdisplay-github-token') || '');
  const [githubLoading, setGithubLoading] = useState(false);

  const defaultImagesUrl = 'https://raw.githubusercontent.com/JanKarajos/tvdisplay/main/images.json';

  useEffect(() => { 
    // Auto-load from GitHub - vždy použiť URL (buď uloženú alebo predvolenú)
    const autoLoad = async () => {
      const savedUrl = localStorage.getItem('tvdisplay-github-raw') || defaultGithubRawUrl;
      const savedImagesUrl = localStorage.getItem('tvdisplay-github-images-raw') || defaultImagesUrl;
      try {
        console.log('Auto-loading songs from URL:', savedUrl);
        await api.loadRemoteSongs(savedUrl);
        console.log('Songs loaded successfully');
        // Ulož URL pre budúce použitie
        localStorage.setItem('tvdisplay-github-raw', savedUrl);
      } catch (e) {
        console.error('Failed to auto-load songs:', e);
        alert('Nepodarilo sa načítať piesne z GitHub. Skontroluj konzolu.');
      }
      try {
        console.log('Auto-loading images from URL:', savedImagesUrl);
        await api.loadRemoteImages(savedImagesUrl);
        console.log('Images loaded successfully');
        localStorage.setItem('tvdisplay-github-images-raw', savedImagesUrl);
      } catch (e) {
        console.error('Failed to auto-load images:', e);
        // Neblokovať aplikáciu ak obrázky nie sú dostupné
      }
      // Načítaj kategórie po načítaní piesní
      const cats = await api.getCategories();
      console.log('Categories loaded:', cats);
      setCategories(cats);
      api.getState().then(setState);
    };
    autoLoad();
  }, []);

  useEffect(() => { 
    const loadSongs = async () => {
      if (searchQuery.trim()) {
        // Ak je zadané vyhľadávanie, načítaj všetky piesne
        console.log('Načítavam všetky piesne pre vyhľadávanie:', searchQuery);
        const allSongs = await api.getAllSongs();
        console.log('Načítaných piesní:', allSongs.length);
        setSongs(allSongs);
      } else if (selectedCategory) {
        // Inak načítaj len piesne z vybranej kategórie
        console.log('Načítavam piesne kategórie:', selectedCategory);
        const categorySongs = await api.getSongsByCategory(selectedCategory);
        console.log('Načítaných piesní:', categorySongs.length);
        setSongs(categorySongs);
      } else {
        console.log('Žiadna kategória ani vyhľadávanie');
        setSongs([]);
      }
    };
    loadSongs();
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    if (state.currentSongId) {
      api.getSong(state.currentSongId).then(setCurrentSong);
    } else {
      setCurrentSong(null);
    }
  }, [state.currentSongId]);

  useEffect(() => {
    api.getImages().then(setImages);
    api.getPresentations().then(setPresentations);
  }, [songs]);

  useRealtime(msg => { 
    if (msg.type === 'state') {
      setState(msg.state);
      if (msg.state.currentSongId) {
        api.getSong(msg.state.currentSongId).then(setCurrentSong);
      } else {
        setCurrentSong(null);
      }
    }
  });

  const addToQueue = (song) => setQueue(q => [...q, song]);
  const removeFromQueue = (i) => setQueue(q => q.filter((_, idx) => idx !== i));
  const showSong = async (s) => await api.setState({ currentSongId: s.id, isHidden: false, currentPage: 0 });

  // Funkcia na normalizáciu textu (odstránenie diakritiky)
  const normalizeText = (text) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Odstráni diakritiku
      .replace(/[^\w\s]/g, ' ') // Nahradí špeciálne znaky medzerami
      .replace(/\s+/g, ' ') // Normalizuje medzery
      .trim();
  };

  // Filtrovanie piesní podľa vyhľadávania (len názov a číslo)
  const filteredSongs = songs.filter(song => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    const normalizedQuery = normalizeText(searchQuery);
    
    // Hľadaj v názve (s diakritikou aj bez)
    if (song.title.toLowerCase().includes(query)) return true;
    if (normalizeText(song.title).includes(normalizedQuery)) return true;
    
    // Hľadaj podľa čísla piesne
    if (song.number && song.number.toString().includes(query)) return true;
    
    return false;
  });

  // Debug log pri zmene vyhľadávania
  if (searchQuery) {
    console.log('Vyhľadávanie:', searchQuery, '| Celkom piesní:', songs.length, '| Nájdených:', filteredSongs.length);
  }
  const toggleHide = async () => {
    const currentState = await api.getState();
    console.log('Toggling hide, current state:', currentState);
    const newState = await api.setState({ isHidden: !currentState.isHidden });
    console.log('New state after toggle:', newState);
    setState(newState);
  };
  const clearSong = async () => {
    const newState = await api.setState({ currentSongId: null, isHidden: false, currentPage: 0 });
    setState(newState);
  };
  
  // Vypočítaj počet strán (strof) v piesni
  const getPageCount = (song) => {
    if (!song?.lyrics) return 0;
    const allLines = song.lyrics.split('\n');
    let pageCount = 0;
    let hasContent = false;
    
    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      if (!line.trim() && hasContent) {
        pageCount++;
        hasContent = false;
      } else if (line.trim()) {
        hasContent = true;
      }
    }
    
    if (hasContent) pageCount++;
    return pageCount;
  };
  
  const currentPageCount = currentSong ? getPageCount(currentSong) : 0;
  const setBackground = async (v) => {
    try {
      console.log('Setting background, current state:', state);
      const newState = { ...state, background: v };
      console.log('New state before update:', newState);
      await api.setState(newState);
      console.log('Background set successfully');
    } catch (error) {
      console.error('Error setting background:', error);
    }
  };
  const loadPsalm = async () => { const ps = await api.loadPsalm(); addToQueue(ps); };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName) return;
    setAddingCategory(true);
    try {
      await api.addCategory({ name: newCategoryName });
      api.getCategories().then(setCategories);
      setNewCategoryName("");
    } catch (error) {
      console.error('Error adding category:', error);
    }
    setAddingCategory(false);
  };

  const handleAddText = async (e) => {
    e.preventDefault();
    if (!textTitle || !textCategory || !textLyrics) return;
    setAddingText(true);
    await api.addCustomSong({
      title: textTitle,
      lyrics: textLyrics,
      category: textCategory,
    });
    setTextTitle("");
    setTextLyrics("");
    setTextCategory("");
    setAddingText(false);
    if (selectedCategory === textCategory) {
      api.getSongsByCategory(selectedCategory).then(setSongs);
    }
  };

  const handleImageFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setImageFile(file);
    const reader = new window.FileReader();
    reader.onload = (ev) => {
      setImageUrl(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAddImage = async (e) => {
    e.preventDefault();
    if (!imageTitle || !imageUrl) return;
    setAddingImage(true);
    await api.addCustomSong({
      title: imageTitle,
      imageUrl: imageUrl,
    });
    setImageTitle("");
    setImageFile(null);
    setImageUrl("");
    setAddingImage(false);
    api.getImages().then(setImages);
  };

  const handlePdfFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Prosím vyberte PDF súbor');
      return;
    }
    setPdfFile(file);
    const reader = new window.FileReader();
    reader.onload = (ev) => {
      setPdfUrl(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAddPdf = async (e) => {
    e.preventDefault();
    if (!pdfTitle || !pdfUrl) return;
    setAddingPdf(true);
    await api.addCustomSong({
      title: pdfTitle,
      pdfUrl: pdfUrl,
      pageCount: pdfPageCount,
    });
    setPdfTitle("");
    setPdfFile(null);
    setPdfUrl("");
    setPdfPageCount(1);
    setAddingPdf(false);
    api.getPresentations().then(setPresentations);
  };

  const handleLoadFromRawUrl = async () => {
    if (!githubRawUrl) return alert('Zadajte raw URL na JSON súbor (raw.githubusercontent.com)');
    setGithubLoading(true);
    try {
      await api.loadRemoteSongs(githubRawUrl);
      // Refresh local views
      api.getCategories().then(setCategories);
      api.getPresentations().then(setPresentations);
      api.getImages().then(setImages);
      setSongs([]);
      alert('Načítané piesne z: ' + githubRawUrl);
      // Persist the raw url for convenience
      localStorage.setItem('tvdisplay-github-raw', githubRawUrl);
    } catch (e) {
      console.error(e);
      alert('Chyba pri načítaní remote JSON: ' + e.message);
    }
    setGithubLoading(false);
  };

  const handleSaveToGitHub = async () => {
    if (!githubOwner || !githubRepo || !githubPath || !githubToken) return alert('Please fill owner, repo, path and token');
    setGithubLoading(true);
    try {
      const res = await api.saveSongsToGitHub({ owner: githubOwner, repo: githubRepo, path: githubPath, token: githubToken });
      // persist config locally (token optional)
      localStorage.setItem('tvdisplay-github-owner', githubOwner);
      localStorage.setItem('tvdisplay-github-repo', githubRepo);
      localStorage.setItem('tvdisplay-github-path', githubPath);
      localStorage.setItem('tvdisplay-github-token', githubToken);
      alert('Uložené na GitHub: ' + (res.content && res.content.path ? res.content.path : 'OK'));
    } catch (e) {
      console.error(e);
      alert('Chyba pri ukladaní na GitHub: ' + e.message);
    }
    setGithubLoading(false);
  };

  return (
    <div className="container mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-7xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
          <Card title="Aktuálny stav">
            <div className="text-sm mb-2">Aktuálna pieseň: <span className="font-medium">{currentSong ? currentSong.title : '—'}</span></div>
            <div className="text-sm mb-2">Stav: <span className="font-medium">{state.isHidden ? 'Skrytý' : 'Zobrazený'}</span></div>
            <div className="text-sm mb-3">Pozadie: <span className="font-medium">{state.background ? 'Nastavené' : '—'}</span></div>
            <div className="flex flex-wrap gap-2">
              {state.currentSongId && (
                <>
                  <button onClick={clearSong} className="px-3 py-1.5 text-sm border rounded">Vymazať obsah</button>
                  <button onClick={toggleHide} className={`px-3 py-1.5 text-sm ${state.isHidden ? 'bg-blue-500 text-white' : 'border'} rounded`}>
                    {state.isHidden ? 'Zobraziť obsah' : 'Skryť obsah'}
                  </button>
                </>
              )}
              {state.background && (
                <button onClick={() => setBackground(null)} className="px-3 py-1.5 text-sm border rounded">Vypnúť pozadie</button>
              )}
            </div>
            
            {/* Navigácia strán piesne */}
            {currentSong?.lyrics && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-sm font-medium mb-2">Strana piesne:</div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => api.setState({ ...state, currentPage: Math.max((state.currentPage || 0) - 1, 0) })}
                    disabled={(state.currentPage || 0) === 0}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    ← Predošlá
                  </button>
                  <div className="text-sm font-medium">
                    Strana {(state.currentPage || 0) + 1} / {currentPageCount}
                  </div>
                  <button 
                    onClick={() => api.setState({ ...state, currentPage: Math.min((state.currentPage || 0) + 1, currentPageCount - 1) })}
                    disabled={(state.currentPage || 0) >= currentPageCount - 1}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Ďalšia →
                  </button>
                  <button 
                    onClick={() => api.setState({ ...state, currentPage: 0 })}
                    className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
                  >
                    Prvá strana
                  </button>
                </div>
              </div>
            )}
          </Card>

          <Card title="Kategórie">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {categories.map(c => (
                  <button key={c.id} onClick={() => setSelectedCategory(c.id)} 
                    className={`px-3 py-1.5 text-sm rounded transition-colors ${selectedCategory===c.id?'bg-blue-500 text-white':'bg-white border hover:bg-gray-50'}`}>
                    {c.name}
                  </button>
                ))}
              </div>
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nová kategória..."
                  className="flex-1 px-3 py-1.5 text-sm border rounded"
                  disabled={addingCategory}
                />
                <button
                  type="submit"
                  disabled={addingCategory || !newCategoryName}
                  className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
                >
                  {addingCategory ? 'Pridávam...' : 'Pridať'}
                </button>
              </form>
            </div>
          </Card>
        </div>

        <Card title={searchQuery.trim() ? 'Vyhľadávanie vo všetkých piesňach' : `Piesne v ${selectedCategory || '...'}`}>
          {/* Vyhľadávacie pole */}
          <div className="mb-3 pb-3 border-b">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hľadaj podľa názvu alebo čísla piesne..."
              className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <div className="mt-2 text-xs text-gray-600">
                Nájdených: {filteredSongs.length} {filteredSongs.length === 1 ? 'pieseň' : filteredSongs.length < 5 ? 'piesne' : 'piesní'}
              </div>
            )}
          </div>
          
          <div className="h-[calc(100vh-32rem)] min-h-[12rem] overflow-auto">
            {filteredSongs.map(s => (
              <div key={s.id} className="flex justify-between items-center p-2 border-b hover:bg-gray-50">
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {s.number && <span className="text-gray-500 mr-2">#{s.number}</span>}
                    {s.title}
                  </div>
                  {searchQuery.trim() && s.category && (
                    <div className="text-xs text-gray-500 mt-1">
                      {categories.find(c => c.id === s.category)?.name || s.category}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => addToQueue(s)} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">Pridať</button>
                  <button onClick={() => showSong(s)} className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Zobraziť</button>
                </div>
              </div>
            ))}
            {!filteredSongs.length && (searchQuery || selectedCategory) && (
              <div className="text-sm text-gray-500 p-3">
                {searchQuery ? 'Nenašli sa žiadne piesne' : 'Žiadne piesne v tejto kategórii'}
              </div>
            )}
            {!selectedCategory && !searchQuery && <div className="text-sm text-gray-500 p-3">Vyber kategóriu alebo začni vyhľadávať</div>}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card title="Preview">
          <Preview state={state} song={currentSong} />
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
          <Card title="Rýchle nastavenia">
            <div className="flex flex-wrap gap-2">
              <button onClick={loadPsalm} className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600">Načítať žalm</button>
              <button onClick={() => setBackground('#F8FAFF')} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Svetlé pozadie</button>
              <button onClick={() => setBackground(null)} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Čierna obrazovka</button>
            </div>
          </Card>

          <Card title="Vybraté piesne">
            <div className="max-h-48 overflow-auto">
              {queue.map((s,i)=>(
                <div key={(s.id||s.title)+i} className="flex justify-between p-2 border-b">
                  <div className="text-sm">{s.title}</div>
                  <div className="flex gap-2">
                    <button onClick={()=>showSong(s)} className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Zobraziť</button>
                    <button onClick={()=>removeFromQueue(i)} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">Vymazať</button>
                  </div>
                </div>
              ))}
              {!queue.length && <div className="text-sm text-gray-500 p-3">Žiadne piesne</div>}
            </div>
          </Card>
        </div>

        <Card title="Pridať vlastný text do kategórie">
          <form className="space-y-2" onSubmit={handleAddText}>
            <div className="flex gap-2">
              <select
                className="border rounded px-2 py-1"
                value={textCategory}
                onChange={e => setTextCategory(e.target.value)}
                required
              >
                <option value="">Vyber kategóriu</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input
                className="border rounded px-2 py-1 flex-1"
                type="text"
                placeholder="Názov"
                value={textTitle}
                onChange={e => setTextTitle(e.target.value)}
                required
              />
            </div>
            <textarea
              className="border rounded px-2 py-1 w-full"
              placeholder="Text piesne"
              value={textLyrics}
              onChange={e => setTextLyrics(e.target.value)}
              rows={2}
              required
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-3 py-1 rounded disabled:opacity-50"
              disabled={addingText || !textTitle || !textCategory || !textLyrics}
            >Pridať text</button>
          </form>
        </Card>
        <Card title="Pridať obrázok (bez kategórie)">
          <form className="space-y-2" onSubmit={handleAddImage}>
            <input
              className="border rounded px-2 py-1 w-full"
              type="text"
              placeholder="Názov obrázka"
              value={imageTitle}
              onChange={e => setImageTitle(e.target.value)}
              required
            />
            <input
              className="border rounded px-2 py-1 w-full"
              type="file"
              accept="image/*"
              onChange={handleImageFile}
              required
            />
            {imageUrl && (
              <div className="flex items-center gap-2 mt-1">
                <img src={imageUrl} alt="Náhľad" className="h-12 rounded border" />
                <button type="button" className="text-xs text-red-500 underline" onClick={()=>{setImageFile(null);setImageUrl("")}}>Odstrániť obrázok</button>
              </div>
            )}
            <button
              type="submit"
              className="bg-blue-500 text-white px-3 py-1 rounded disabled:opacity-50"
              disabled={addingImage || !imageTitle || !imageUrl}
            >Pridať obrázok</button>
          </form>
        </Card>

        <Card title="Obrázky (bez kategórie)">
          <div className="flex flex-wrap gap-4">
            {images.length === 0 && <div className="text-gray-500">Žiadne obrázky</div>}
            {images.map(img => (
              <div key={img.id} className="flex flex-col items-center w-32">
                <img src={img.imageUrl} alt={img.title || 'Obrázok'} className="w-32 h-20 object-cover rounded shadow mb-1" />
                <div className="text-xs text-center text-gray-700">{img.title}</div>
                <div className="flex gap-1 mt-1">
                  <button onClick={() => showSong(img)} className="px-2 py-1 text-xs bg-blue-500 text-white rounded">Zobraziť</button>
                  <button onClick={() => setBackground(img.imageUrl)} className="px-2 py-1 text-xs bg-gray-300 rounded">Pozadie</button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Pridať PDF prezentáciu">
          <form className="space-y-2" onSubmit={handleAddPdf}>
            <input
              className="border rounded px-2 py-1 w-full"
              type="text"
              placeholder="Názov prezentácie"
              value={pdfTitle}
              onChange={e => setPdfTitle(e.target.value)}
              required
            />
            <input
              className="border rounded px-2 py-1 w-full"
              type="file"
              accept="application/pdf"
              onChange={handlePdfFile}
              required
            />
            {pdfUrl && (
              <div className="flex items-center gap-2 mt-1">
                <div className="px-3 py-2 bg-gray-100 rounded border text-sm">
                  📄 PDF načítané
                </div>
                <input
                  type="number"
                  min="1"
                  value={pdfPageCount}
                  onChange={e => setPdfPageCount(parseInt(e.target.value) || 1)}
                  placeholder="Počet strán"
                  className="border rounded px-2 py-1 w-24"
                />
                <button type="button" className="text-xs text-red-500 underline" onClick={()=>{setPdfFile(null);setPdfUrl("")}}>Odstrániť</button>
              </div>
            )}
            <button
              type="submit"
              className="bg-blue-500 text-white px-3 py-1 rounded disabled:opacity-50"
              disabled={addingPdf || !pdfTitle || !pdfUrl}
            >Pridať PDF</button>
          </form>
        </Card>

        <Card title="PDF Prezentácie">
          <div className="space-y-2">
            {presentations.length === 0 && <div className="text-gray-500">Žiadne prezentácie</div>}
            {presentations.map(pdf => (
              <div key={pdf.id} className="flex justify-between items-center p-2 border rounded">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📄</span>
                  <div>
                    <div className="text-sm font-medium">{pdf.title}</div>
                    <div className="text-xs text-gray-500">{pdf.pageCount} strán</div>
                  </div>
                </div>
                <button onClick={() => showSong(pdf)} className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">Zobraziť</button>
              </div>
            ))}
          </div>
        </Card>
        
        <Card title="GitHub Sync (songs.json)">
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Načítanie z raw URL (read-only):</div>
            <div className="flex gap-2">
              <input className="flex-1 border rounded px-2 py-1" placeholder="https://raw.githubusercontent.com/.../songs.json" value={githubRawUrl} onChange={e=>setGithubRawUrl(e.target.value)} />
              <button onClick={handleLoadFromRawUrl} className="px-3 py-1 bg-green-500 text-white rounded" disabled={githubLoading}>{githubLoading ? 'Načítavam...' : 'Načítať'}</button>
            </div>

            <hr />

            <div className="text-sm text-gray-600">Uloženie (commit) do GitHub repo (potrebný PAT):</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input className="border rounded px-2 py-1" placeholder="owner (username)" value={githubOwner} onChange={e=>setGithubOwner(e.target.value)} />
              <input className="border rounded px-2 py-1" placeholder="repo" value={githubRepo} onChange={e=>setGithubRepo(e.target.value)} />
              <input className="border rounded px-2 py-1" placeholder="path (e.g. data/songs.json)" value={githubPath} onChange={e=>setGithubPath(e.target.value)} />
              <input className="border rounded px-2 py-1" placeholder="Personal Access Token" value={githubToken} onChange={e=>setGithubToken(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveToGitHub} className="px-3 py-1 bg-blue-500 text-white rounded" disabled={githubLoading}>{githubLoading ? 'Ukladám...' : 'Uložiť na GitHub'}</button>
              <div className="text-xs text-gray-500">Uloženie vykoná commit/replace súboru pomocou GitHub API.</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
