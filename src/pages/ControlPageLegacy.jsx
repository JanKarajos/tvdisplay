import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/api';
import { useRealtime } from '../hooks/useRealtime';

function digitOnly(value) {
  return (value || '').replace(/\D/g, '');
}

function useLegacyStyles() {
  useEffect(() => {
    const hrefs = [
      '/legacy/css/bootstrap/bootstrap.min.css',
      '/legacy/css/fonts/Nunito.css',
      '/legacy/css/site.css',
      '/legacy/ChurchApp.Web.styles.css',
      '/icons/css/all.css',
    ];

    const links = hrefs.map((href) => {
      let link = document.querySelector(`link[data-legacy-style="${href}"]`);
      if (!link) {
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.setAttribute('data-legacy-style', href);
        document.head.appendChild(link);
      }
      return link;
    });

    // Old app uses full-page layout without cursor restrictions.
    const prevBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = 'white';

    return () => {
      // Remove styles when leaving legacy page to avoid affecting existing UI.
      links.forEach((link) => {
        if (link && link.parentNode) link.parentNode.removeChild(link);
      });
      document.body.style.backgroundColor = prevBg;
    };
  }, []);
}

export default function ControlPageLegacy() {
  useLegacyStyles();

  const [allSongs, setAllSongs] = useState([]);
  const [query, setQuery] = useState('');
  const [queue, setQueue] = useState([]);
  const [state, setState] = useState({ currentSongId: null, background: null, isHidden: false, currentPage: 0 });
  const [currentSong, setCurrentSong] = useState(null);
  const [loadingPsalm, setLoadingPsalm] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const songs = await api.getAllSongs();
      setAllSongs(songs);
      const s = await api.getState();
      setState(s);
      if (s.currentSongId) {
        const song = await api.getSong(s.currentSongId);
        setCurrentSong(song);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const syncCurrentSong = async () => {
      if (!state.currentSongId) {
        setCurrentSong(null);
        return;
      }
      const song = await api.getSong(state.currentSongId);
      setCurrentSong(song);
    };
    syncCurrentSong();
  }, [state.currentSongId]);

  const handleRealtimeUpdate = useCallback((msg) => {
    if (msg.type !== 'state') return;
    setState(msg.state);
  }, []);

  useRealtime(handleRealtimeUpdate);

  const normalizedQuery = useMemo(() => digitOnly(query), [query]);

  const results = useMemo(() => {
    const q = normalizedQuery.trim();
    if (!q) return [];

    // Primárne podľa čísla (keypad štýl), fallback podľa názvu.
    const byNumber = allSongs
      .filter(s => s.number != null && String(s.number).startsWith(q))
      .slice(0, 25);

    if (byNumber.length > 0) return byNumber;

    const lower = q.toLowerCase();
    return allSongs
      .filter(s => (s.title || '').toLowerCase().includes(lower))
      .slice(0, 25);
  }, [allSongs, normalizedQuery]);

  const pressDigit = (d) => setQuery(prev => (prev + String(d)).slice(0, 10));
  const backspace = () => setQuery(prev => prev.slice(0, -1));
  const clear = () => setQuery('');

  const addToQueue = (song) => setQueue(prev => [...prev, song]);
  const removeFromQueue = (idx) => setQueue(prev => prev.filter((_, i) => i !== idx));

  const loadPsalmToday = async () => {
    setLoadingPsalm(true);
    try {
      const psalm = await api.loadPsalm();
      addToQueue(psalm);
    } finally {
      setLoadingPsalm(false);
    }
  };

  const showSong = async (song) => {
    const currentState = await api.getState();
    const newState = await api.setState({
      currentSongId: song.id,
      isHidden: currentState.isHidden,
      currentPage: 0,
    });
    setState(newState);
  };

  const toggleHide = async () => {
    const currentState = await api.getState();
    const newState = await api.setState({ isHidden: !currentState.isHidden });
    setState(newState);
  };

  const clearScreen = async () => {
    const newState = await api.setState({ currentSongId: null, isHidden: false, currentPage: 0 });
    setState(newState);
  };

  const getPageCount = useCallback((song) => {
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
  }, []);

  const currentPageCount = currentSong ? getPageCount(currentSong) : 0;

  const prevPage = async () => {
    const s = await api.getState();
    const newState = await api.setState({ ...s, currentPage: Math.max((s.currentPage || 0) - 1, 0) });
    setState(newState);
  };

  const nextPage = async () => {
    const s = await api.getState();
    const maxPage = Math.max(currentPageCount - 1, 0);
    const newState = await api.setState({ ...s, currentPage: Math.min((s.currentPage || 0) + 1, maxPage) });
    setState(newState);
  };

  const clearQueue = () => setQueue([]);

  return (
    <div className="page" b-vn3toe3vg6="">
      <div className="sidebar" b-vn3toe3vg6="">
        <div className="top-row pl-4 navbar navbar-dark" b-wnu6nuuo1f="">
          <div className="container-fluid">
            <a className="navbar-brand" href="#control-legacy" b-wnu6nuuo1f="">
              ChurchApp
            </a>
            <button
              className="navbar-toggler"
              type="button"
              aria-label="Toggle navigation"
              onClick={() => setNavOpen(v => !v)}
              b-wnu6nuuo1f=""
            >
              <span className="navbar-toggler-icon" />
            </button>
          </div>
        </div>

        <div className={navOpen ? 'collapse show' : 'collapse'} b-wnu6nuuo1f="">
          <ul className="nav flex-column">
            <li className="nav-item px-3" b-wnu6nuuo1f="">
              <a className="nav-link" href="#control-legacy" b-wnu6nuuo1f="">
                Ovládanie
              </a>
            </li>
            <li className="nav-item px-3" b-wnu6nuuo1f="">
              <a className="nav-link" href="#display" b-wnu6nuuo1f="">
                Display
              </a>
            </li>
            <li className="nav-item px-3" b-wnu6nuuo1f="">
              <a className="nav-link" href="#broadcast" b-wnu6nuuo1f="">
                Broadcast
              </a>
            </li>
          </ul>
        </div>
      </div>

      <main b-vn3toe3vg6="">
        <div className="top-row px-4" b-vn3toe3vg6="" />
        <article className="content px-4" b-vn3toe3vg6="">
          <div className="d-flex flex-row w-100" b-gmpvgtvr00="">
            {/* Queue */}
            <div className="queue p-2 col-2" b-gmpvgtvr00="">
              <div className="d-flex justify-content-between" b-gmpvgtvr00="">
                <div className="p-2 col-9" b-gmpvgtvr00="">
                  <h2 b-gmpvgtvr00="">
                    <b b-gmpvgtvr00="">Výber</b>
                  </h2>
                </div>
                <div className="p-2 col-1" b-gmpvgtvr00="">
                  <h4 b-gmpvgtvr00="">
                    <label style={{ cursor: 'pointer' }} b-gmpvgtvr00="" onClick={clearQueue}>
                      <i className="fa-solid fa-xmark close" b-gmpvgtvr00="" />
                    </label>
                  </h4>
                </div>
              </div>

              {queue.length === 0 ? (
                <>
                  <div className="d-flex flex-row justify-content-center mt-4" b-gmpvgtvr00="">
                    <div className="col-9" b-gmpvgtvr00="">
                      <img src="/images/empty-folder.svg" className="w-100" b-gmpvgtvr00="" />
                    </div>
                  </div>
                  <h5 className="w-100 text-center" b-gmpvgtvr00="">
                    Žiadne pesničky vo fronte
                  </h5>
                </>
              ) : (
                queue.map((song, idx) => (
                  <div key={`${song.id}-${idx}`} className="result d-flex justify-content-between mt-2" b-gmpvgtvr00="">
                    <div className="p-2 col-9" b-gmpvgtvr00="" onClick={() => showSong(song)} role="button" tabIndex={0}>
                      <label b-gmpvgtvr00="" style={{ cursor: 'pointer' }}>
                        {song.number ? `${song.number}. ` : ''}{song.title}
                      </label>
                    </div>
                    <div className="p-2 col-1" b-gmpvgtvr00="">
                      <h4 b-gmpvgtvr00="">
                        <label style={{ cursor: 'pointer' }} b-gmpvgtvr00="" onClick={() => removeFromQueue(idx)}>
                          <i className="fa-solid fa-xmark close" b-gmpvgtvr00="" />
                        </label>
                      </h4>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Search */}
            <div className="search-results p-2 col-3" b-gmpvgtvr00="">
              <h2 b-gmpvgtvr00="">
                <b b-gmpvgtvr00="">Hľadať</b>
              </h2>
              <div className="input-search flex-row w-95" b-gmpvgtvr00="">
                <input
                  value={normalizedQuery}
                  onChange={(e) => setQuery(digitOnly(e.target.value))}
                  placeholder="Zadaj číslo"
                  inputMode="numeric"
                />
              </div>

              {!normalizedQuery.trim() || results.length === 0 ? (
                <label b-gmpvgtvr00="">Žiadne výsledky</label>
              ) : (
                results.map((song) => (
                  <div key={song.id} className="result d-flex justify-content-between mt-2" b-gmpvgtvr00="">
                    <div className="p-2 col-2" b-gmpvgtvr00="">
                      <h4 b-gmpvgtvr00="">
                        <label style={{ cursor: 'pointer' }} b-gmpvgtvr00="" onClick={() => addToQueue(song)}>
                          <i className="fa-solid fa-plus" b-gmpvgtvr00="" />
                        </label>
                      </h4>
                    </div>
                    <div className="p-2 col-9" b-gmpvgtvr00="">
                      <label b-gmpvgtvr00="" style={{ cursor: 'pointer' }} onClick={() => addToQueue(song)}>
                        {song.number ? `${song.number}. ` : ''}{song.title}
                      </label>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Keypad */}
            <div className="keypad p-2 col-6" b-gmpvgtvr00="">
              <div className="key-row row" b-gmpvgtvr00="">
                {[7, 8, 9].map((n) => (
                  <div key={n} className="key col-4" b-gmpvgtvr00="" onClick={() => pressDigit(n)} role="button" tabIndex={0}>
                    <b b-gmpvgtvr00="">{n}</b>
                  </div>
                ))}
              </div>
              <div className="key-row row" b-gmpvgtvr00="">
                {[4, 5, 6].map((n) => (
                  <div key={n} className="key col-4" b-gmpvgtvr00="" onClick={() => pressDigit(n)} role="button" tabIndex={0}>
                    <b b-gmpvgtvr00="">{n}</b>
                  </div>
                ))}
              </div>
              <div className="key-row row" b-gmpvgtvr00="">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="key col-4" b-gmpvgtvr00="" onClick={() => pressDigit(n)} role="button" tabIndex={0}>
                    <b b-gmpvgtvr00="">{n}</b>
                  </div>
                ))}
              </div>
              <div className="key-row row" b-gmpvgtvr00="">
                <div className="key col-6" b-gmpvgtvr00="" onClick={() => pressDigit(0)} role="button" tabIndex={0}>
                  <b b-gmpvgtvr00="">0</b>
                </div>
                <div className="key col-6" b-gmpvgtvr00="" onClick={clear} role="button" tabIndex={0}>
                  <b b-gmpvgtvr00="">clear</b>
                </div>
              </div>

              <button className="button-secondary w-100 p-1 mt-2" onClick={backspace} type="button">
                ⌫
              </button>
              <button className="button-primary w-100 p-1" onClick={toggleHide} type="button">
                <div className="d-flex justify-content-center w-100">
                  {state.isHidden ? 'Zobraziť' : 'Skryť'}
                </div>
              </button>
              <button className="button-primary w-100 p-1" onClick={clearScreen} type="button">
                <div className="d-flex justify-content-center w-100">Vymazať</div>
              </button>
              <button className="button-primary w-100 p-1" onClick={loadPsalmToday} type="button" disabled={loadingPsalm}>
                <div className="d-flex justify-content-center w-100">
                  {loadingPsalm ? 'Načítavam…' : 'Načítať žalm dnes'}
                </div>
              </button>
              <button className="button-secondary w-100 p-1 mt-2" onClick={prevPage} type="button" disabled={(state.currentPage || 0) === 0}>
                Predch.
              </button>
              <button
                className="button-secondary w-100 p-1 mt-2"
                onClick={nextPage}
                type="button"
                disabled={(state.currentPage || 0) >= Math.max(currentPageCount - 1, 0)}
              >
                Ďalšia
              </button>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
