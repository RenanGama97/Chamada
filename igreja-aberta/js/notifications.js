// Lembretes no celular.
//
// Existem duas camadas, e o app usa as duas juntas:
//
// 1) Lembrete local (funciona sem servidor): o app guarda os próximos turnos
//    do irmão no IndexedDB. Sempre que o app é aberto — e também em segundo
//    plano, quando o navegador permite (Periodic Background Sync) — ele avisa
//    se hoje ou amanhã é o dia dele abrir a igreja.
//
// 2) Push de verdade (exige o Supabase + VAPID configurados no config.js):
//    o servidor dispara a notificação na hora marcada, mesmo com o app
//    fechado. Veja o README.md.

import { CONFIG } from './config.js';
import { db } from './store.js';
import { idbGet, idbSet } from './idb.js';
import { textoDoLembrete } from './share.js';
import { formatarData, hojeISO, somarDias } from './util.js';

export const notificacoes = {
  get suportado() {
    return 'Notification' in window && 'serviceWorker' in navigator;
  },

  get permissao() {
    return this.suportado ? Notification.permission : 'unsupported';
  },

  async pedirPermissao() {
    if (!this.suportado) return 'unsupported';
    const resultado = await Notification.requestPermission();
    if (resultado === 'granted') {
      await this.ativarPush();
      await registrarSyncPeriodico();
    }
    return resultado;
  },

  // Guarda no IndexedDB os próximos turnos de quem está usando o aparelho.
  async sincronizarLembretes(membroId) {
    if (!membroId) return;
    const hoje = hojeISO();
    const prefs = db.prefs();
    const meus = db
      .itensPublicados()
      .filter((i) => i.data >= hoje && i.membroIds.includes(membroId))
      .slice(0, 20)
      .map((i) => ({
        data: i.data,
        tipo: i.tipo,
        texto: textoDoLembrete(i),
        horaAbertura: db.tipo(i.tipo).horaAbertura,
      }));

    await idbSet('lembretes', {
      membroId,
      atualizadoEm: new Date().toISOString(),
      diasAntecedencia: prefs.diasAntecedenciaLembrete ?? 1,
      itens: meus,
    });
  },

  // Chamado quando o app abre: avisa sobre hoje e sobre amanhã.
  async verificarAgora() {
    if (this.permissao !== 'granted') return;
    const dados = await idbGet('lembretes');
    if (!dados?.itens?.length) return;

    const registro = await navigator.serviceWorker.ready;
    const hoje = hojeISO();
    const amanha = somarDias(hoje, 1);
    const jaAvisados = (await idbGet('avisados')) || {};

    for (const item of dados.itens) {
      const ehHoje = item.data === hoje;
      const ehAmanha = item.data === amanha && (dados.diasAntecedencia ?? 1) >= 1;
      if (!ehHoje && !ehAmanha) continue;

      const chave = `${item.data}|${item.tipo}|${ehHoje ? 'hoje' : 'amanha'}`;
      if (jaAvisados[chave]) continue;

      await registro.showNotification(
        ehHoje ? '🔑 Hoje é o seu dia de abrir a igreja' : '🔔 Amanhã é o seu dia',
        {
          body: item.texto,
          tag: chave,
          icon: 'icons/icon-192.png',
          badge: 'icons/icon-192.png',
          requireInteraction: false,
          data: { url: './' },
        },
      );
      jaAvisados[chave] = Date.now();
    }

    // Limpa avisos com mais de 60 dias.
    const limite = Date.now() - 60 * 86400000;
    for (const [chave, quando] of Object.entries(jaAvisados)) {
      if (quando < limite) delete jaAvisados[chave];
    }
    await idbSet('avisados', jaAvisados);
  },

  // Notificação de teste, para o irmão confirmar que está funcionando.
  async testar() {
    if (this.permissao !== 'granted') {
      const r = await this.pedirPermissao();
      if (r !== 'granted') return false;
    }
    const registro = await navigator.serviceWorker.ready;
    await registro.showNotification('🔑 Igreja Aberta', {
      body: 'Pronto! É assim que você vai ser avisado no seu dia.',
      icon: 'icons/icon-192.png',
      tag: 'teste',
    });
    return true;
  },

  // Este aparelho já está registrado para receber push com o app fechado?
  async estadoPush() {
    if (!this.suportado) return 'nao-suportado';
    if (db.modo !== 'nuvem' || !CONFIG.vapidPublicKey) return 'sem-servidor';
    if (this.permissao !== 'granted') return 'sem-permissao';
    try {
      const registro = await navigator.serviceWorker.ready;
      return (await registro.pushManager.getSubscription()) ? 'registrado' : 'nao-registrado';
    } catch {
      return 'nao-registrado';
    }
  },

  // Inscreve o aparelho no push do servidor (só com Supabase + VAPID).
  async ativarPush() {
    if (db.modo !== 'nuvem' || !CONFIG.vapidPublicKey) return false;
    const sessao = db.sessao();
    if (!sessao?.membroId) return false;

    try {
      const registro = await navigator.serviceWorker.ready;
      const inscricao =
        (await registro.pushManager.getSubscription()) ||
        (await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ParaUint8(CONFIG.vapidPublicKey),
        }));
      await db.registrarPush(sessao.membroId, inscricao);
      return true;
    } catch (erro) {
      console.warn('Não foi possível ativar o push:', erro);
      return false;
    }
  },
};

async function registrarSyncPeriodico() {
  try {
    const registro = await navigator.serviceWorker.ready;
    if (!('periodicSync' in registro)) return;
    const estado = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (estado.state !== 'granted') return;
    await registro.periodicSync.register('lembretes-igreja-aberta', {
      minInterval: 12 * 60 * 60 * 1000,
    });
  } catch {
    // Navegador sem suporte: seguimos apenas com o aviso ao abrir o app.
  }
}

function base64ParaUint8(base64) {
  const preenchido = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const bruto = atob(preenchido);
  return Uint8Array.from([...bruto].map((c) => c.charCodeAt(0)));
}

// Texto de apoio para a tela de ajustes.
export function proximoTurnoTexto(membroId) {
  const hoje = hojeISO();
  const proximo = db
    .itensPublicados()
    .find((i) => i.data >= hoje && i.membroIds.includes(membroId));
  if (!proximo) return null;
  return `${formatarData(proximo.data, { comAno: true })} — ${db.tipo(proximo.tipo).label}`;
}
