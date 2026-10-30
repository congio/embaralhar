// Embaralhar de Verdade — ponte entre a janela da extensão e a página do YouTube Music.
//
// O content.js roda no "mundo" da página (precisa disso pra falar com o player e a fila),
// e de lá não tem acesso às APIs do Chrome. Este arquivo roda isolado, lê a chave de ativar
// salva na janela da extensão e os textos no idioma do navegador (pasta _locales), e repassa
// os dois pra página.

const DEFAULTS = { enabled: true };
console.log('[Embaralhar de Verdade] ponte carregada');

// Textos usados dentro da página (os da janela da extensão são lidos direto pelo popup.js)
const PAGE_KEYS = [
  'menuShuffle', 'menuCopy', 'menuShuffleQueue', 'menuSaveQueue',
  'close', 'open', 'cancel', 'create', 'fieldName', 'fieldWho',
  'privPrivate', 'privUnlisted', 'privPublic',
  'dialogCopyText', 'dialogCopyTextCount', 'dialogQueueText',
  'defaultCopyName', 'defaultQueueName', 'descCopy', 'descQueue',
  'progressLoading', 'progressQueue', 'progressCopy', 'progressShufflingQueue',
  'toastPlaying', 'toastCopyCreated', 'toastQueueShuffled', 'toastQueueSaved',
  'errNoSession', 'errHttp', 'errNotEnoughToShuffle', 'errNotPlaying', 'errNoQueue',
  'errQueueRejected', 'errNotCreated', 'errNoSongsToCopy', 'errQueueTooSmall', 'errQueueShuffleRejected',
];

function passStrings() {
  const strings = {};
  for (const key of PAGE_KEYS) strings[key] = chrome.i18n.getMessage(key);
  const root = document.documentElement;
  root.dataset.edvLocale = chrome.i18n.getUILanguage();
  root.dataset.edvStrings = JSON.stringify(strings);
}

function apply(settings) {
  const root = document.documentElement;
  root.dataset.edvEnabled = settings.enabled ? '1' : '0';
}

passStrings();
chrome.storage.sync.get(DEFAULTS, apply);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.enabled) chrome.storage.sync.get(DEFAULTS, apply);
});
