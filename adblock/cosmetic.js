// Nettoie les blocs "Sponsorisé" / "Publicité" ajoutés dynamiquement et les zones vides laissées par les pubs bloquées.
(() => {
  const LABELS = /^(sponsoris[ée]|publicit[ée]|annonce|sponsored|advertisement|ad)$/i;

  function clean(root) {
    if (!root || !root.querySelectorAll) return;
    // Conteneurs dont le seul libellé visible est "Publicité" / "Sponsorisé"
    root.querySelectorAll('span, div, p, small').forEach(el => {
      if (el.childElementCount === 0 && LABELS.test(el.textContent.trim())) {
        const box = el.closest('[class*="ad"], [id*="ad"], aside');
        if (box && box !== document.body && box.offsetHeight < 800) box.style.setProperty('display', 'none', 'important');
      }
    });
    // Iframes vides restantes (pub bloquée)
    root.querySelectorAll('iframe:not([src]), iframe[src="about:blank"]').forEach(f => {
      if (/ad|banner|gpt/i.test(f.id + ' ' + f.className)) f.style.setProperty('display', 'none', 'important');
    });
  }

  const start = () => {
    clean(document);
    new MutationObserver(muts => {
      for (const m of muts) m.addedNodes.forEach(n => n.nodeType === 1 && clean(n.parentElement || n));
    }).observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
