// Janela da extensão: chave de ativar e tema.

const DEFAULTS = { enabled: true, theme: 'auto' };

const enabledEl = document.querySelector('#opt-enabled');

document.querySelector('#version').textContent = chrome.runtime.getManifest().version;

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  document.querySelectorAll('[data-theme-opt]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeOpt === theme)));
}

chrome.storage.sync.get(DEFAULTS, (s) => {
  enabledEl.setAttribute('aria-checked', String(s.enabled));
  applyTheme(s.theme);
});

function toggle() {
  const on = enabledEl.getAttribute('aria-checked') !== 'true';
  enabledEl.setAttribute('aria-checked', String(on));
  chrome.storage.sync.set({ enabled: on });
}

enabledEl.addEventListener('click', toggle);
enabledEl.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    toggle();
  }
});

document.querySelectorAll('[data-theme-opt]').forEach((b) =>
  b.addEventListener('click', () => {
    chrome.storage.sync.set({ theme: b.dataset.themeOpt });
    applyTheme(b.dataset.themeOpt);
  })
);