// Mini armazenamento em IndexedDB. Serve de ponte entre a tela e o
// service worker (o service worker não consegue ler o localStorage).

const NOME_BANCO = 'igreja-aberta';
const LOJA = 'estado';

function abrir() {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOME_BANCO, 1);
    pedido.onupgradeneeded = () => {
      if (!pedido.result.objectStoreNames.contains(LOJA)) {
        pedido.result.createObjectStore(LOJA);
      }
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

export async function idbGet(chave) {
  const banco = await abrir();
  return new Promise((resolve, reject) => {
    const pedido = banco.transaction(LOJA, 'readonly').objectStore(LOJA).get(chave);
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

export async function idbSet(chave, valor) {
  const banco = await abrir();
  return new Promise((resolve, reject) => {
    const tx = banco.transaction(LOJA, 'readwrite');
    tx.objectStore(LOJA).put(valor, chave);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
