// Doplnky pre staršie prehliadače (starší Android WebView, prehliadače v smart TV).
// Bez nich by sa ovládanie či displej na takom zariadení vôbec nezobrazili.
if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout !== 'function') {
  AbortSignal.timeout = function timeout(ms) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('Časový limit vypršal', 'TimeoutError')), ms);
    return controller.signal;
  };
}
