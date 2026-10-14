/* =====================================================
   SERVICE WORKER - Gestor Financeiro Pro
   Versão: v4 (sempre que mudar o app, aumente esse número)
   ===================================================== */

const CACHE_NAME = 'gestor-financeiro-pro-v4';

/* Arquivos essenciais cacheados na instalação */
const ARQUIVOS_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './planeta-terra.png'
];

/* Recursos externos (CDN) — cache-first para velocidade */
const CDN_CACHE = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];

/* ---------- INSTALL ---------- */
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando versão', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache obrigatório (HTML, manifest, ícone)
      const obrigatorios = cache.addAll(ARQUIVOS_CACHE);
      // Cache de CDN em paralelo (falha não bloqueia)
      const cdn = Promise.allSettled(
        CDN_CACHE.map(url => cache.add(url).catch(err => console.warn('[SW] Falha CDN:', url, err)))
      );
      return Promise.all([obrigatorios, cdn]);
    }).then(() => {
      // Ativa imediatamente sem esperar as abas fecharem
      return self.skipWaiting();
    })
  );
});

/* ---------- ACTIVATE ---------- */
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando versão', CACHE_NAME);
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      // Assume o controle das abas abertas imediatamente
      return self.clients.claim();
    })
  );
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignora requisições que não são GET
  if (request.method !== 'GET') return;

  // Ignora chamadas do Firebase (sempre online, com cache próprio)
  if (request.url.includes('firestore.googleapis.com') ||
      request.url.includes('firebaseio.com') ||
      request.url.includes('identitytoolkit.googleapis.com') ||
      request.url.includes('securetoken.googleapis.com') ||
      request.url.includes('firebaseinstallations.googleapis.com')) {
    return;
  }

  const url = new URL(request.url);

  // ===== HTML / navegação: NETWORK-FIRST (sempre pega a versão mais nova) =====
  if (request.mode === 'navigate' ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/' ||
      url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Sempre atualiza o cache com a versão nova
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone).catch(() => {}));
          }
          return response;
        })
        .catch(() => caches.match(request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // ===== Recursos externos (CDN, fontes): CACHE-FIRST (mais rápido) =====
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone).catch(() => {}));
          }
          return response;
        });
      })
    );
    return;
  }

  // ===== Outros arquivos locais (imagens, manifest): NETWORK-FIRST =====
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone).catch(() => {}));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

/* ---------- MENSAGENS DO APP ---------- */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
