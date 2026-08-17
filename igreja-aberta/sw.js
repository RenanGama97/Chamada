/* Service worker do app Igreja Aberta.
 * - deixa o app abrir sem internet (cache dos arquivos)
 * - mostra o lembrete do dia em segundo plano (quando o navegador permite)
 * - recebe o push enviado pelo servidor
 */

// IMPORTANTE: este número precisa ser igual ao VERSAO de js/versao.js.
// É ele que faz os celulares perceberem que existe versão nova, baixarem os
// arquivos e mostrarem a barra "Atualizar".
const VERSAO = '1.1.1';
const CACHE = `igreja-aberta-${VERSAO}`;
const ARQUIVOS = [
  './',
  './index.html',
  './css/app.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/config.js',
  './js/store.js',
  './js/util.js',
  './js/idb.js',
  './js/versao.js',
  './js/marca.js',
  './js/scheduler.js',
  './js/share.js',
  './js/notifications.js',
  './js/views/login.js',
  './js/views/comum.js',
  './js/views/escala.js',
  './js/views/disponibilidade.js',
  './js/views/irmaos.js',
  './js/views/gerar.js',
  './js/views/ajustes.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(ARQUIVOS);

      // Normalmente a versão nova fica "esperando" e o app mostra a barra
      // "Atualizar" — quem decide a hora da troca é o irmão.
      //
      // Exceção: os caches com o nome antigo ("igreja-aberta-v1" e "-v2") são
      // de versões do app que ainda não sabiam mostrar essa barra. Se
      // esperássemos por elas, o celular ficaria preso na versão velha para
      // sempre. Nesse caso assumimos na hora.
      const chaves = await caches.keys();
      const versaoSemAviso = chaves.some((c) => /^igreja-aberta-v\d+$/.test(c));
      if (versaoSemAviso) await self.skipWaiting();
    })(),
  );
});

// A tela pede a troca quando o botão "Atualizar" é tocado.
self.addEventListener('message', (evento) => {
  if (evento.data?.tipo === 'ATUALIZAR') self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;

  const url = new URL(pedido.url);
  // Chamadas ao Supabase sempre vão para a rede.
  if (url.origin !== self.location.origin) return;

  evento.respondWith(
    caches.match(pedido).then((emCache) => {
      const daRede = fetch(pedido)
        .then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE).then((cache) => cache.put(pedido, copia));
          }
          return resposta;
        })
        .catch(() => emCache || caches.match('./index.html'));
      return emCache || daRede;
    }),
  );
});

/* ---------- lembretes em segundo plano ---------- */

self.addEventListener('periodicsync', (evento) => {
  if (evento.tag === 'lembretes-igreja-aberta') {
    evento.waitUntil(verificarLembretes());
  }
});

self.addEventListener('sync', (evento) => {
  if (evento.tag === 'lembretes-igreja-aberta') {
    evento.waitUntil(verificarLembretes());
  }
});

async function verificarLembretes() {
  const dados = await idbGet('lembretes');
  if (!dados || !dados.itens || !dados.itens.length) return;

  const hoje = isoHoje(0);
  const amanha = isoHoje(1);
  const avisados = (await idbGet('avisados')) || {};

  for (const item of dados.itens) {
    const ehHoje = item.data === hoje;
    const ehAmanha = item.data === amanha && (dados.diasAntecedencia ?? 1) >= 1;
    if (!ehHoje && !ehAmanha) continue;

    const chave = `${item.data}|${item.tipo}|${ehHoje ? 'hoje' : 'amanha'}`;
    if (avisados[chave]) continue;

    await self.registration.showNotification(
      ehHoje ? '🔑 Hoje é o seu dia de abrir a igreja' : '🔔 Amanhã é o seu dia',
      {
        body: item.texto,
        tag: chave,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        data: { url: './' },
      },
    );
    avisados[chave] = Date.now();
  }

  await idbSet('avisados', avisados);
}

/* ---------- push enviado pelo servidor ---------- */

self.addEventListener('push', (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = { corpo: evento.data ? evento.data.text() : '' };
  }

  evento.waitUntil(
    self.registration.showNotification(dados.titulo || '🔑 Igreja Aberta', {
      body: dados.corpo || 'Você está escalado para abrir a igreja.',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: dados.tag || 'lembrete',
      data: { url: dados.url || './' },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data?.url || './', self.location.href).href;

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if (janela.url.startsWith(self.location.origin) && 'focus' in janela) {
          return janela.focus();
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});

/* ---------- cópia enxuta do helper de IndexedDB ---------- */

function abrirBanco() {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open('igreja-aberta', 1);
    pedido.onupgradeneeded = () => {
      if (!pedido.result.objectStoreNames.contains('estado')) {
        pedido.result.createObjectStore('estado');
      }
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function idbGet(chave) {
  const banco = await abrirBanco();
  return new Promise((resolve, reject) => {
    const pedido = banco.transaction('estado', 'readonly').objectStore('estado').get(chave);
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function idbSet(chave, valor) {
  const banco = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = banco.transaction('estado', 'readwrite');
    tx.objectStore('estado').put(valor, chave);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function isoHoje(maisDias) {
  const d = new Date();
  d.setDate(d.getDate() + maisDias);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}
