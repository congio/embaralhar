// Embaralhar de Verdade — ponte entre a janela da extensão e a página do YouTube Music.
//
// O content.js roda no "mundo" da página (precisa disso pra falar com o player e a fila),
// e de lá não tem acesso às APIs do Chrome. Este arquivo roda isolado, lê a chave de ativar
// salva na janela da extensão e repassa pra página.

const DEFAULTS = { enabled: true };
console.log('[Embaralhar de Verdade] ponte carregada');

function apply(settings) {
  const root = document.documentElement;
  root.dataset.edvEnabled = settings.enabled ? '1' : '0';
}

chrome.storage.sync.get(DEFAULTS, apply);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.enabled) chrome.storage.sync.get(DEFAULTS, apply);
});