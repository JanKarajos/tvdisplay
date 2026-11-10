// Signál s časovým limitom pre fetch. V prehliadačoch bez AbortController (staršie smart TV)
// vráti undefined – požiadavka potom beží bez limitu, ale nezlyhá.
export function timeoutSignal(ms) {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
    if (typeof AbortController === 'function') {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), ms);
      return controller.signal;
    }
  } catch {
    // ignoruj
  }
  return undefined;
}
