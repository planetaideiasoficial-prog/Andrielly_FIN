/* =====================================================
   SERVICE WORKER - Gestor Financeiro Pro
   Versão: v1 (aumente a versão quando atualizar o app)
   ===================================================== */

const CACHE_NAME = 'gestor-financeiro-pro-v1';

/* Arquivos que serão cacheados na instalação */
const ARQUIVOS_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './planeta-terra.png',
  /* Bibliotecas externas (CDN) */
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];

/* ---------- INSTALL ---------- */
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ARQUIVOS_CACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Falha ao cachear:', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* ---------- ACTIVATE ---------- */
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando...');
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
    }).then(() => self.clients.claim())
  );
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  /* Ignora requisições que não são GET */
  if (request.method !== 'GET') return;

  /* Ignora chamadas do Firebase (sempre online, com cache próprio) */
  if (request.url.includes('firestore.googleapis.com') ||
      request.url.includes('firebaseio.com') ||
      request.url.includes('identitytoolkit.googleapis.com') ||
      request.url.includes('securetoken.googleapis.com')) {
    return;
  }

  /* Estratégia: Network First com fallback para cache
     - Tenta buscar da rede (dados atualizados)
     - Se falhar (offline), usa o cache */
  event.respondWith(
    fetch(request)
      .then((response) => {
        /* Só cacheia respostas válidas */
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => {
        /* Offline: tenta o cache */
        return caches.match(request).then((cached) => {
          if (cached) return cached;

          /* Fallback para navegação HTML */
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

/* ---------- MENSAGEM PARA FORÇAR ATUALIZAÇÃO ---------- */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
