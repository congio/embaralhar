// Embaralhar de Verdade
// Roda dentro da página do YouTube Music (music.youtube.com).
// 
// Embaralhar: lê a playlist inteira, sorteia a ordem, começa a tocar na hora
// e coloca todas as outras músicas no "A seguir". Não altera nada na conta.
// Salvar cópia embaralhada: faz o mesmo sorteio, mas em vez de tocar cria
// uma playlist nova com o nome e a visibilidade que você escolher.
// A playlist original nunca é alterada.
// 
// Usa só a sessão já logada no music.youtube.com. Não envia nada pra nenhum outro lugar.

(() => {
  if (window.__edvLoaded) return;
  window.__edvLoaded = true;
  console.log('[Embaralhar de Verdade] carregada nesta página', location.href);

  const NAME = 'Embaralhar de Verdade';
  let busy = false;

  // Utilidades
  const cfg = (key) => (window.ytcfg && window.ytcfg.get ? window.ytcfg.get(key) : undefined);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (...a) => console.log(`[${NAME}]`, ...a);

  function getCookie(name) {
    const safe = name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&');
    const m = document.cookie.match(new RegExp('(?:^|; )' + safe + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  async function sha1(text) {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Cabeçalho de autenticação a partir da sessão logada (mesmo método que o site usa)
  async function authHeader() {
    const origin = location.origin;
    const ts = Math.floor(Date.now() / 1000);
    const sources = [
      ['SAPISIDHASH', getCookie('SAPISID') || getCookie('__Secure-3PAPISID')],
      ['SAPISID1PHASH', getCookie('__Secure-1PAPISID')],
      ['SAPISID3PHASH', getCookie('__Secure-3PAPISID')],
    ];
    const parts = [];
    for (const [label, value] of sources) {
      if (value) parts.push(`${label} ${ts}_${await sha1(`${ts} ${value} ${origin}`)}`);
    }
    if (!parts.length) throw new Error('Não encontrei sua sessão. Entre na sua conta do YouTube Music e tente de novo.');
    return parts.join(' ');
  }

  async function api(endpoint, body) {
    const key = cfg('INNERTUBE_API_KEY');
    const url = `/youtubei/v1/${endpoint}?prettyPrint=false` + (key ? `&key=${key}` : '');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: await authHeader(),
      'X-Origin': location.origin,
      'X-Goog-AuthUser': String(cfg('SESSION_INDEX') ?? 0),
      'X-Youtube-Client-Name': String(cfg('INNERTUBE_CONTEXT_CLIENT_NAME') ?? 67),
      'X-Youtube-Client-Version': String(cfg('INNERTUBE_CLIENT_VERSION') ?? ''),
    };
    const visitor = cfg('VISITOR_DATA');
    if (visitor) headers['X-Goog-Visitor-Id'] = visitor;

    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ context: cfg('INNERTUBE_CONTEXT'), ...body }),
    });
    if (!res.ok) throw new Error(`O YouTube Music respondeu com erro ${res.status} (${endpoint}).`);
    return res.json();
  }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const r = new Uint32Array(1);
      crypto.getRandomValues(r);
      const j = r[0] % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Página atual
  function currentPlaylistId() {
    if (location.pathname !== '/playlist') return null;
    let id = new URLSearchParams(location.search).get('list');
    if (!id) return null;
    if (id.startsWith('VL')) id = id.slice(2);
    if (id === 'SE') return null; // episódios salvos (podcasts)
    return id;
  }

  function currentPlaylistTitle() {
    const el = document.querySelector(
      'ytmusic-responsive-header-renderer h1, ytmusic-detail-header-renderer .title, ytmusic-editable-playlist-detail-header-renderer .title'
    );
    const fromDom = el && el.textContent.trim();
    if (fromDom) return fromDom;
    const fromTitle = document.title.replace(/\s*-\s*YouTube Music\s*$/i, '').trim();
    return fromTitle || 'Playlist';
  }

  const isEnabled = () => document.documentElement.dataset.edvEnabled !== '0';

  // Ler a playlist inteira
  function walk(node, items, tokens) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n, items, tokens);
      return;
    }
    const row = node.musicResponsiveListItemRenderer;
    if (row && row.playlistItemData) {
      const sid = row.playlistItemData.playlistSetVideoId;
      const vid = row.playlistItemData.videoId;
      // Indisponível = aparece acinzentada na playlist (mesmo critério que o site usa)
      const available = row.musicItemRendererDisplayPolicy !== 'MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT';
      if (sid && vid) items.push({ sid, vid, available }); // sugestões não têm setVideoId, então ficam de fora
    }
    const token =
      (node.continuationCommand && node.continuationCommand.token) ||
      (node.nextContinuationData && node.nextContinuationData.continuation);
    if (token) tokens.push(token);
    for (const k in node) {
      if (k !== 'musicResponsiveListItemRenderer') walk(node[k], items, tokens);
    }
  }

  async function readPlaylist(playlistId) {
    const bySid = new Map();
    const seen = new Set();
    const queue = [];

    const collect = (resp) => {
      const items = [];
      const tokens = [];
      walk(resp, items, tokens);
      items.forEach((i) => bySid.set(i.sid, i));
      queue.push(...tokens);
    };

    collect(await api('browse', { browseId: 'VL' + playlistId }));

    let guard = 0;
    while (queue.length && guard++ < 500) {
      const token = queue.shift();
      if (seen.has(token)) continue;
      seen.add(token);
      collect(await api('browse', { continuation: token }));
    }
    return [...bySid.values()];
  }

  // Lê a playlist assim que a página dela abre, pra que o clique seja imediato.
  // Guarda só os IDs das músicas disponíveis, sem repetição.
  // Se a leitura falhar, a leitura automática só tenta de novo depois de 30 s
  let cache = { id: null, promise: null, failedAt: 0 };

  function prefetch(playlistId) {
    if (cache.id === playlistId && cache.promise) return cache.promise;
    const promise = readPlaylist(playlistId).then((tracks) => {
      const vids = [...new Set(tracks.filter((t) => t.available).map((t) => t.vid))];
      log(`playlist lida: ${vids.length} músicas (${tracks.length - vids.length} indisponíveis ou repetidas ficaram de fora)`);
      return vids;
    });
    promise.catch(() => {
      if (cache.promise === promise) cache = { id: playlistId, promise: null, failedAt: Date.now() };
    });
    cache = { id: playlistId, promise, failedAt: 0 };
    return promise;
  }

  function shouldPrefetch(playlistId) {
    if (cache.id !== playlistId) return true;
    return !cache.promise && Date.now() - cache.failedAt > 30000;
  }

  // Embaralhar: tocar sem alterar nada
  function currentVideoId() {
    const p = document.getElementById('movie_player');
    try {
      const d = p && typeof p.getVideoData === 'function' ? p.getVideoData() : null;
      if (d && d.video_id) return d.video_id;
    } catch (e) {}
    return new URLSearchParams(location.search).get('v');
  }

  async function waitForVideo(videoId, ms = 8000) {
    for (let t = 0; t < ms; t += 250) {
      await sleep(250);
      if (currentVideoId() === videoId) return true;
    }
    return false;
  }

  // Mesma navegação que o site faz quando você clica numa música
  function navigateTo(videoId) {
    const app = document.querySelector('ytmusic-app');
    if (!app) return false;
    app.dispatchEvent(
      new CustomEvent('yt-navigate', {
        bubbles: true,
        composed: true,
        detail: { endpoint: { watchEndpoint: { videoId } } },
      })
    );
    return true;
  }

  // Acha o "store" interno onde o YouTube Music guarda a fila
  function findStore() {
    const roots = [
      document.querySelector('#queue'),
      document.querySelector('ytmusic-player-queue'),
      document.querySelector('ytmusic-app'),
    ].filter(Boolean);
    const seen = new Set();
    const search = (obj, depth) => {
      if (!obj || typeof obj !== 'object' || seen.has(obj) || depth > 3) return null;
      seen.add(obj);
      if (typeof obj.dispatch === 'function' && typeof obj.getState === 'function') {
        try {
          const s = obj.getState();
          if (s && s.queue) return obj;
        } catch (e) {}
      }
      for (const k of ['store', 'queue', 'reduxStore']) {
        const r = search(obj[k], depth + 1);
        if (r) return r;
      }
      return null;
    };
    for (const r of roots) {
      const found = search(r, 0);
      if (found) return found;
    }
    return null;
  }

  function itemVideoId(item) {
    const r =
      (item && item.playlistPanelVideoRenderer) ||
      (item &&
        item.playlistPanelVideoWrapperRenderer &&
        item.playlistPanelVideoWrapperRenderer.primaryRenderer &&
        item.playlistPanelVideoWrapperRenderer.primaryRenderer.playlistPanelVideoRenderer);
    return r ? { id: r.videoId, selected: !!r.selected } : { id: null, selected: false };
  }

  // Pede os itens de fila de um lote, se o lote der erro, divide e tenta de novo,
  // pulando só as músicas que o YouTube Music recusar.
  async function queueItemsFor(videoIds, contextParams) {
    try {
      const body = { videoIds };
      if (contextParams) body.queueContextParams = contextParams;
      const resp = await api('music/get_queue', body);
      return (resp.queueDatas || []).map((d) => d.content).filter(Boolean);
    } catch (e) {
      if (videoIds.length === 1) {
        log('música recusada, pulando', videoIds[0], e.message);
        return [];
      }
      const mid = Math.ceil(videoIds.length / 2);
      return [
        ...(await queueItemsFor(videoIds.slice(0, mid), contextParams)),
        ...(await queueItemsFor(videoIds.slice(mid), contextParams)),
      ];
    }
  }

  async function playShuffled() {
    const playlistId = currentPlaylistId();
    if (!playlistId || busy) return;
    setBusy(true);
    try {
      setProgress('Carregando...');
      const vids = await prefetch(playlistId); // normalmente já está pronto
      if (vids.length < 2) throw new Error('Essa playlist não tem músicas disponíveis suficientes pra embaralhar.');
      const ids = shuffle(vids);

      // Começa a música na hora (tenta a próxima se a sorteada não tocar)
      let first = -1;
      for (let i = 0; i < Math.min(5, ids.length); i++) {
        if (navigateTo(ids[i]) && (await waitForVideo(ids[i], 6000))) {
          first = i;
          break;
        }
        log('não começou a tocar, tentando outra', ids[i]);
      }
      if (first === -1) throw new Error('O YouTube Music não começou a tocar. Recarregue a página e tente de novo.');
      const rest = ids.slice(first + 1);

      // Acha a fila e a posição da música atual
      let store = null;
      for (let t = 0; t < 5000 && !store; t += 200) {
        store = findStore();
        if (!store) await sleep(200);
      }
      if (!store) throw new Error('Não achei a fila do YouTube Music. [diag: store]');

      let state = store.getState().queue;
      for (let t = 0; t < 4000; t += 200) {
        state = store.getState().queue;
        if (state.items.some((it) => itemVideoId(it).id === ids[first])) break;
        await sleep(200);
      }
      let at = state.items.findIndex((it) => itemVideoId(it).selected);
      if (at === -1) at = state.items.findIndex((it) => itemVideoId(it).id === ids[first]);
      if (at === -1) at = 0;
      let insertAt = at + 1;

      // Coloca as outras no "A seguir" em lotes de 50, com a música já tocando
      let added = 0;
      for (let i = 0; i < rest.length; i += 50) {
        const items = await queueItemsFor(rest.slice(i, i + 50), state.queueContextParams);
        if (!items.length) continue;
        const s = store.getState().queue;
        const before = s.items.length;
        store.dispatch({
          type: 'ADD_ITEMS',
          payload: { nextQueueItemId: s.nextQueueItemId, index: insertAt, items, shuffleEnabled: false, shouldAssignIds: true },
        });
        const grew = store.getState().queue.items.length - before;
        if (grew <= 0) throw new Error(`O YouTube Music não aceitou as músicas na fila. [diag: lote ${i / 50}]`);
        insertAt += grew;
        added += grew;
        setProgress(`Fila: ${added + 1}/${ids.length - first}`);
      }
      log(`fila pronta: ${added + 1} músicas`);
      setBusy(false);
      toast(`Tocando ${added + 1} músicas embaralhadas.`);
    } catch (e) {
      setBusy(false);
      fail(e);
    }
  }

  // Salvar cópia embaralhada
  // Adiciona músicas a uma playlist, se um lote for recusado, divide e pula só as recusadas.
  async function addToPlaylist(playlistId, videoIds) {
    try {
      const resp = await api('browse/edit_playlist', {
        playlistId,
        actions: videoIds.map((id) => ({ action: 'ACTION_ADD_VIDEO', addedVideoId: id, dedupeOption: 'DEDUPE_OPTION_SKIP' })),
      });
      if (resp.status && resp.status !== 'STATUS_SUCCEEDED') throw new Error(resp.status);
      return videoIds.length;
    } catch (e) {
      if (videoIds.length === 1) {
        log('música recusada na cópia, pulando', videoIds[0], e.message);
        return 0;
      }
      const mid = Math.ceil(videoIds.length / 2);
      return (await addToPlaylist(playlistId, videoIds.slice(0, mid))) + (await addToPlaylist(playlistId, videoIds.slice(mid)));
    }
  }

  async function createShuffledCopy(sourceId, sourceTitle, name, privacy) {
    setBusy(true);
    try {
      setProgress('Carregando...');
      const vids = await prefetch(sourceId);
      if (!vids.length) throw new Error('Essa playlist não tem músicas disponíveis pra copiar.');
      const ids = shuffle(vids);

      setProgress(`Cópia: 0/${ids.length}`);
      const first = ids.slice(0, 100);
      const resp = await api('playlist/create', {
        title: name.slice(0, 150),
        description: `Cópia embaralhada de "${sourceTitle}", criada pelo ${NAME}.`,
        privacyStatus: privacy,
        videoIds: first,
      });
      const newId = resp.playlistId;
      if (!newId) throw new Error('O YouTube Music não criou a playlist. [diag: playlist/create sem ID]');

      let done = first.length;
      setProgress(`Cópia: ${done}/${ids.length}`);
      for (let i = 100; i < ids.length; i += 100) {
        await addToPlaylist(newId, ids.slice(i, i + 100));
        done = Math.min(i + 100, ids.length);
        setProgress(`Cópia: ${done}/${ids.length}`);
      }

      log(`cópia criada: ${newId}`);
      setBusy(false);
      toast(`"${name}" criada com as músicas embaralhadas.`, { href: `/playlist?list=${newId}`, label: 'Abrir' });
    } catch (e) {
      setBusy(false);
      fail(e);
    }
  }

  // Interface na página
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const FONT = "Roboto, 'YouTube Sans', Arial, sans-serif";
  const RED = 'linear-gradient(180deg, #F0444A, #D21F27)';

  function svgEl(tag, attrs) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  function icon(kind, size) {
    const svg = svgEl('svg', { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    svg.style.flexShrink = '0';
    svg.style.display = 'block';
    if (kind === 'shuffle') {
      const g = svgEl('g', { fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      for (const d of [
        'M4 7h2.5c2.6 0 4 1.3 5.5 5s2.9 5 5.5 5H19',
        'M4 17h2.5c2.6 0 4-1.3 5.5-5s2.9-5 5.5-5H19',
        'M16.5 4.5 19 7l-2.5 2.5',
        'M16.5 14.5 19 17l-2.5 2.5',
      ])
        g.appendChild(svgEl('path', { d }));
      svg.appendChild(g);
    } else {
      const d = {
        copy: 'M14 10H3v2h11v-2zm0-4H3v2h11V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM3 16h7v-2H3v2z',
        close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
      }[kind];
      svg.appendChild(svgEl('path', { fill: 'currentColor', d }));
    }
    return svg;
  }

  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === 'style') Object.assign(e.style, v);
      else if (k === 'checked') e.checked = true;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children) e.append(c);
    return e;
  }

  const show = (e, on, display = 'flex') => (e.style.display = on ? display : 'none');

  const BTN = { border: '0', margin: '0', background: 'none', color: '#fff', font: `inherit`, cursor: 'pointer', outline: 'none' };

  function hover(e, on, off) {
    e.addEventListener('mouseenter', () => Object.assign(e.style, on));
    e.addEventListener('mouseleave', () => {
      if (!(document.activeElement === e && e.matches(':focus-visible'))) Object.assign(e.style, off);
    });
    e.addEventListener('focus', () => {
      if (e.matches(':focus-visible')) Object.assign(e.style, on);
    });
    e.addEventListener('blur', () => Object.assign(e.style, off));
  }

  let ui = null;

  function buildUi() {
    const root = el('div', {
      id: 'edv-root',
      style: {
        position: 'fixed', right: '16px', bottom: '88px', zIndex: '2147483000',
        display: 'none', flexDirection: 'column', alignItems: 'flex-end', gap: '8px',
        fontFamily: FONT, pointerEvents: 'none',
      },
    });

    // Aviso (sucesso ou erro)
    const toastMsg = el('span', { style: { flex: '1', minWidth: '0', paddingTop: '2px', overflowWrap: 'anywhere' } });
    const toastClose = el('button', { type: 'button', 'aria-label': 'Fechar', style: { ...BTN, color: '#aaa', display: 'flex', padding: '2px', borderRadius: '50%' } }, icon('close', 16));
    hover(toastClose, { color: '#fff' }, { color: '#aaa' });
    const toastEl = el('div', {
      role: 'status',
      style: {
        display: 'none', maxWidth: '300px', background: '#282828', color: '#fff', fontSize: '13px', lineHeight: '1.45',
        padding: '10px 10px 10px 14px', borderRadius: '8px', boxShadow: '0 6px 20px rgba(0,0,0,.6)',
        alignItems: 'flex-start', gap: '10px', pointerEvents: 'auto', boxSizing: 'border-box',
      },
    }, toastMsg, toastClose);
    toastClose.addEventListener('click', () => {
      show(toastEl, false);
      refresh();
    });

    // Menu
    const menuItem = (cmd, ico, label) => {
      const b = el('button', {
        type: 'button', role: 'menuitem', 'data-cmd': cmd,
        style: { ...BTN, display: 'flex', gap: '14px', alignItems: 'center', padding: '10px 16px', fontSize: '14px', textAlign: 'left', width: '100%', boxSizing: 'border-box' },
      }, ico, label);
      ico.style.color = '#aaa';
      hover(b, { background: '#4a4a4a' }, { background: 'none' });
      return b;
    };
    const menu = el('div', {
      role: 'menu',
      style: {
        display: 'none', flexDirection: 'column', width: '232px', background: '#282828', borderRadius: '8px',
        padding: '6px 0', boxShadow: '0 6px 20px rgba(0,0,0,.6)', pointerEvents: 'auto', boxSizing: 'border-box',
      },
    }, menuItem('play', icon('shuffle', 20), 'Embaralhar'), menuItem('copy', icon('copy', 20), 'Salvar cópia embaralhada'));

    // Linha da bolinha
    const progress = el('span', {
      style: {
        display: 'none', background: '#282828', color: '#fff', fontSize: '12px', padding: '6px 12px', borderRadius: '14px',
        whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,.5)', fontVariantNumeric: 'tabular-nums', pointerEvents: 'auto',
      },
    });
    const tip = el('span', {
      style: {
        display: 'none', background: '#616161', color: '#fff', fontSize: '12px', padding: '5px 8px', borderRadius: '4px', whiteSpace: 'nowrap',
      },
    }, NAME);
    const ring = el('span', {
      'aria-hidden': 'true',
      style: {
        display: 'none', position: 'absolute', inset: '-4px', borderRadius: '50%', boxSizing: 'border-box',
        border: '3px solid transparent', borderTopColor: '#ff8a8e', borderRightColor: '#ff8a8e', pointerEvents: 'none',
      },
    });
    const ball = el('button', {
      type: 'button', id: 'edv-ball', 'aria-label': NAME, 'aria-haspopup': 'menu', 'aria-expanded': 'false',
      style: {
        ...BTN, position: 'relative', width: '40px', height: '40px', borderRadius: '50%', padding: '0',
        display: 'flex', alignItems: 'center', justifyContent: 'center', background: RED,
        boxShadow: '0 4px 14px rgba(0,0,0,.55)', transition: 'filter .15s, transform .15s', pointerEvents: 'auto',
      },
    }, ring, icon('shuffle', 20));
    const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, progress, tip, ball);

    root.append(toastEl, menu, row);
    document.body.appendChild(root);

    ball.addEventListener('mouseenter', () => {
      if (busy) return;
      ball.style.filter = 'brightness(1.2)';
      ball.style.transform = 'scale(1.08)';
      ball.style.boxShadow = '0 6px 18px rgba(0,0,0,.65)';
      if (menu.style.display === 'none') show(tip, true, 'block');
    });
    ball.addEventListener('mouseleave', () => {
      ball.style.filter = 'none';
      ball.style.transform = 'none';
      ball.style.boxShadow = '0 4px 14px rgba(0,0,0,.55)';
      show(tip, false);
    });
    ball.addEventListener('mousedown', () => (ball.style.transform = 'scale(.96)'));
    ball.addEventListener('mouseup', () => (ball.style.transform = 'scale(1.08)'));
    ball.addEventListener('click', (e) => {
      e.stopPropagation();
      if (busy) return;
      show(tip, false);
      setMenu(menu.style.display === 'none');
    });
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cmd]');
      if (!b) return;
      setMenu(false);
      run(b.dataset.cmd);
    });

    // Fecha o menu ao clicar fora ou apertar Esc
    document.addEventListener('click', (e) => {
      if (menu.style.display !== 'none' && !root.contains(e.target)) setMenu(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.style.display !== 'none') setMenu(false);
    });

    // Anel girando enquanto trabalha
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const spin = reduce ? null : ring.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 1000, iterations: Infinity });
    if (spin) spin.pause();

    return { root, ball, ring, spin, menu, tip, toastEl, toastMsg, progress };
  }

  function setMenu(open) {
    if (!ui) return;
    show(ui.menu, open);
    ui.ball.setAttribute('aria-expanded', String(open));
  }

  function setBusy(on) {
    busy = on;
    if (!ui) return;
    show(ui.ring, on, 'block');
    if (ui.spin) on ? ui.spin.play() : ui.spin.pause();
    ui.ball.style.cursor = on ? 'progress' : 'pointer';
    show(ui.progress, on, 'block');
    if (on) {
      setMenu(false);
      show(ui.toastEl, false);
      show(ui.tip, false);
    }
    refresh();
  }

  function setProgress(text) {
    if (ui) ui.progress.textContent = text;
  }

  let toastTimer = null;
  function toast(message, opts = {}) {
    if (!ui) return;
    ui.toastMsg.textContent = message;
    if (opts.href) {
      const a = el('a', { href: opts.href, style: { color: '#ff8a8e', fontWeight: '500', textDecoration: 'none', marginLeft: '6px' } }, opts.label || 'Abrir');
      ui.toastMsg.appendChild(a);
    }
    ui.toastEl.style.borderLeft = '3px solid #ff4a52';
    show(ui.toastEl, true);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      show(ui.toastEl, false);
      refresh();
    }, opts.error ? 15000 : 8000);
    refresh();
  }

  function fail(e) {
    console.error(`[${NAME}]`, e);
    toast(e.message || String(e), { error: true });
  }

  // Janela de nome da cópia
  function openCopyDialog() {
    const sourceId = currentPlaylistId();
    if (!sourceId || busy || document.getElementById('edv-modal')) return;
    const sourceTitle = currentPlaylistTitle();

    const label = (text) => el('span', { style: { fontSize: '12px', color: '#aaa' } }, text);
    const input = el('input', {
      id: 'edv-name', name: 'name', type: 'text', maxlength: '150', autocomplete: 'off', required: true,
      style: {
        border: '0', borderBottom: '2px solid #717171', background: 'none', padding: '6px 0', color: '#fff',
        fontSize: '16px', fontFamily: FONT, width: '100%', outline: 'none', boxSizing: 'border-box', borderRadius: '0',
      },
    });
    input.addEventListener('focus', () => (input.style.borderBottomColor = '#fff'));
    input.addEventListener('blur', () => (input.style.borderBottomColor = '#717171'));

    const radio = (id, value, text, checked) =>
      el('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', color: '#fff' } },
        el('input', { type: 'radio', id, name: 'privacy', value, checked, style: { accentColor: '#fff', margin: '0', width: '16px', height: '16px', cursor: 'pointer' } }),
        text);

    const actionBtn = (text, solid, type) => {
      const base = solid ? { background: '#fff', color: '#0f0f0f' } : { background: 'none', color: '#fff' };
      const b = el('button', {
        type,
        style: { ...BTN, ...base, fontSize: '14px', fontWeight: '500', padding: '9px 18px', borderRadius: '18px' },
      }, text);
      hover(b, solid ? { background: '#d6d6d6' } : { background: 'rgba(255,255,255,.16)' }, base);
      return b;
    };
    const cancelBtn = actionBtn('Cancelar', false, 'button');
    const createBtn = actionBtn('Criar', true, 'submit');

    const text = el('p', { style: { margin: '0', fontSize: '14px', color: '#aaa', lineHeight: '1.5' } },
      'Cria uma playlist nova com as músicas disponíveis numa ordem sorteada. A playlist original continua igual.');

    const form = el('form', {
      role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Salvar cópia embaralhada',
      style: {
        width: '100%', maxWidth: '400px', background: '#282828', color: '#fff', borderRadius: '12px', padding: '24px',
        display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 8px 32px rgba(0,0,0,.6)', boxSizing: 'border-box', fontFamily: FONT,
      },
    },
      el('h2', { style: { margin: '0', fontSize: '20px', fontWeight: '500', color: '#fff' } }, 'Salvar cópia embaralhada'),
      text,
      el('label', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, label('Nome'), input),
      el('div', { role: 'radiogroup', 'aria-label': 'Quem pode ver', style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        label('Quem pode ver'),
        el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px 18px' } },
          radio('edv-priv-private', 'PRIVATE', 'Privada', true),
          radio('edv-priv-unlisted', 'UNLISTED', 'Não listada', false),
          radio('edv-priv-public', 'PUBLIC', 'Pública', false))),
      el('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' } }, cancelBtn, createBtn)
    );

    const modal = el('div', {
      id: 'edv-modal',
      style: {
        position: 'fixed', inset: '0', zIndex: '2147483001', background: 'rgba(0,0,0,.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box',
      },
    }, form);
    document.body.appendChild(modal);

    input.value = `${sourceTitle} (embaralhada)`;
    input.focus();
    input.select();

    // Mostra quantas músicas vão entrar, quando a leitura terminar
    prefetch(sourceId)
      .then((vids) => {
        text.textContent = `Cria uma playlist nova com as ${vids.length} músicas disponíveis numa ordem sorteada. A playlist original continua igual.`;
      })
      .catch(() => {});

    const close = () => modal.remove();

    // Impede que as teclas digitadas acionem os atalhos do YouTube Music
    modal.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') close();
    });
    modal.addEventListener('keyup', (e) => e.stopPropagation());
    modal.addEventListener('keypress', (e) => e.stopPropagation());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
    cancelBtn.addEventListener('click', close);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) {
        input.focus();
        return;
      }
      const checked = form.querySelector('input[name="privacy"]:checked');
      const privacy = (checked && checked.value) || 'PRIVATE';
      close();
      createShuffledCopy(sourceId, sourceTitle, name, privacy);
    });
  }

  // Comandos da bolinha
  function run(cmd) {
    if (!isEnabled() || !currentPlaylistId() || busy) return;
    if (cmd === 'play') playShuffled();
    else if (cmd === 'copy') openCopyDialog();
  }


  // Mostrar ou esconder conforme a página e a chave de ativar
  let lastError = '';
  function refresh() {
    try {
      refreshUnsafe();
    } catch (e) {
      const msg = (e && e.stack) || String(e);
      if (msg !== lastError) {
        lastError = msg;
        console.error(`[${NAME}] erro ao mostrar a bolinha:`, e);
      }
    }
  }

  let reported = '';
  function refreshUnsafe() {
    if (!document.body) return;
    const enabled = isEnabled();
    const pid = currentPlaylistId();

    const state = `ativada=${enabled} playlist=${pid || 'nenhuma'}`;
    if (state !== reported) {
      reported = state;
      log('estado:', state);
    }

    if (!enabled) {
      if (ui) show(ui.root, false);
      const modal = document.getElementById('edv-modal');
      if (modal) modal.remove();
      return;
    }

    if (!ui) ui = buildUi();
    if (pid && shouldPrefetch(pid)) prefetch(pid).catch((e) => log('leitura da playlist falhou:', e.message));

    const showBall = !!pid;
    show(ui.ball, showBall || busy);
    if (!showBall) setMenu(false);
    const toastOpen = ui.toastEl.style.display !== 'none';
    show(ui.root, showBall || busy || toastOpen);
  }

  setInterval(refresh, 1000);
  new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['data-edv-enabled'] });
  refresh();
})();