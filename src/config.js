// Jedno miesto pre adresu servera. Dá sa prepísať cez VITE_SERVER_URL v .env.
const fallback = `${window.location.protocol}//${window.location.hostname}:3002`;

export const SERVER_URL = (import.meta.env.VITE_SERVER_URL || fallback).replace(/\/$/, '');
export const WS_URL = SERVER_URL.replace(/^http/, 'ws') + '/ws';

export const SONGS_URL = 'https://raw.githubusercontent.com/JanKarajos/tvdisplay/main/songs.json';
export const IMAGES_URL = 'https://raw.githubusercontent.com/JanKarajos/tvdisplay/main/images.json';

// Relatívne cesty (napr. /uploads/x.pdf) patria serveru
export function resolveServerUrl(url) {
  if (typeof url === 'string' && url.startsWith('/')) return SERVER_URL + url;
  return url;
}
