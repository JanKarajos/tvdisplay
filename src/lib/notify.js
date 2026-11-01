// Hlásenie výsledku uloženia. Úspech je tichý, chyba sa ukáže.
export function reportSave(result, what) {
  if (result?.ok) return;
  const local = result?.savedLocally ? '\n\nZmena je uložená na serveri lokálne, ale nie na GitHube.' : '';
  window.alert(`${what}: ${result?.error || 'neznáma chyba'}${local}`);
}
