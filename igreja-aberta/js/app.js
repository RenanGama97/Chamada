// Ponto de entrada do app: sessão, navegação entre telas, avisos e modais.

import { CONFIG } from './config.js';
import { db } from './store.js';
import { notificacoes } from './notifications.js';
import { escapar, iniciais } from './util.js';

import * as telaLogin from './views/login.js';
import * as telaEscala from './views/escala.js';
import * as telaDisponibilidade from './views/disponibilidade.js';
import * as telaIrmaos from './views/irmaos.js';
import * as telaGerar from './views/gerar.js';
import * as telaAjustes from './views/ajustes.js';

const TELAS = {
  escala: telaEscala,
  disponibilidade: telaDisponibilidade,
  irmaos: telaIrmaos,
  gerar: telaGerar,
  ajustes: telaAjustes,
};

const SOMENTE_ADMIN = new Set(['irmaos', 'gerar']);

const el = {
  carregando: document.getElementById('carregando'),
  cabecalho: document.getElementById('cabecalho'),
  titulo: document.getElementById('tituloTela'),
  botaoPerfil: document.getElementById('botaoPerfil'),
  faixa: document.getElementById('faixaAviso'),
  view: document.getElementById('view'),
  nav: document.getElementById('navegacao'),
  avisos: document.getElementById('avisos'),
  modal: document.getElementById('modal'),
  modalCaixa: document.getElementById('modalCaixa'),
};

export const app = {
  rota: 'escala',
  eu: null,
  promptInstalacao: null,

  get ehAdmin() {
    return Boolean(this.eu?.admin);
  },

  /* ---------- navegação ---------- */

  ir(rota, { comHistorico = true } = {}) {
    if (!TELAS[rota]) rota = 'escala';
    if (SOMENTE_ADMIN.has(rota) && !this.ehAdmin) rota = 'escala';
    this.rota = rota;
    if (comHistorico && location.hash !== `#${rota}`) location.hash = rota;
    this.desenhar();
  },

  desenhar() {
    if (!this.eu) {
      el.cabecalho.classList.add('oculto');
      el.nav.classList.add('oculto');
      el.view.innerHTML = telaLogin.render({ app: this, db });
      telaLogin.montar(el.view, { app: this, db });
      return;
    }

    el.cabecalho.classList.remove('oculto');
    el.nav.classList.remove('oculto');
    el.botaoPerfil.textContent = iniciais(this.eu.nome);

    for (const botao of el.nav.querySelectorAll('.nav__item')) {
      const rota = botao.dataset.rota;
      const escondido = SOMENTE_ADMIN.has(rota) && !this.ehAdmin;
      botao.classList.toggle('oculto', escondido);
      if (rota === this.rota) botao.setAttribute('aria-current', 'page');
      else botao.removeAttribute('aria-current');
    }

    const tela = TELAS[this.rota];
    el.titulo.textContent = tela.titulo;
    const ctx = { app: this, db, eu: this.eu };
    el.view.innerHTML = tela.render(ctx);
    el.view.scrollTop = 0;
    tela.montar?.(el.view, ctx);
    this.atualizarFaixa();
  },

  atualizarFaixa() {
    const partes = [];
    if (db.modo === 'nuvem' && !db.online) {
      partes.push('📴 Sem conexão — mostrando a última escala baixada.');
    }
    if (db.modo === 'local') {
      partes.push(
        '📱 Modo local: os dados ficam só neste celular. Veja "Ajustes" para sincronizar com o grupo.',
      );
    }
    if (notificacoes.suportado && notificacoes.permissao === 'default') {
      partes.push('🔔 Toque em "Ajustes" para ativar os lembretes.');
    }
    el.faixa.innerHTML = partes.map(escapar).join('<br />');
    el.faixa.classList.toggle('oculto', partes.length === 0);
  },

  /* ---------- dados ---------- */

  async recarregar({ redesenhar = true } = {}) {
    await db.recarregar();
    if (this.eu) {
      const atualizado = db.membro(this.eu.id);
      if (atualizado) this.eu = atualizado;
    }
    await notificacoes.sincronizarLembretes(this.eu?.id);
    if (redesenhar) this.desenhar();
  },

  async entrar(membro) {
    this.eu = membro;
    db.definirSessao(membro.id);
    await notificacoes.sincronizarLembretes(membro.id);
    await notificacoes.ativarPush();
    this.ir('escala');
    await notificacoes.verificarAgora();
  },

  sair() {
    db.encerrarSessao();
    this.eu = null;
    this.desenhar();
  },

  /* ---------- avisos e modal ---------- */

  aviso(texto, tipo = '') {
    const div = document.createElement('div');
    div.className = `aviso ${tipo ? `aviso--${tipo}` : ''}`;
    div.textContent = texto;
    el.avisos.appendChild(div);
    // Mantém no máximo três avisos na tela para não cobrir o conteúdo.
    while (el.avisos.children.length > 3) el.avisos.firstElementChild.remove();
    setTimeout(() => div.remove(), 3800);
  },

  erro(algo) {
    const texto = algo instanceof Error ? algo.message : String(algo);
    console.error(algo);
    this.aviso(texto, 'erro');
  },

  abrirModal({ titulo, html, montar }) {
    el.modalCaixa.innerHTML = `
      <div class="modal__titulo">${escapar(titulo)}</div>
      ${html}
    `;
    el.modal.classList.remove('oculto');
    montar?.(el.modalCaixa);
  },

  fecharModal() {
    el.modal.classList.add('oculto');
    el.modalCaixa.innerHTML = '';
  },

  confirmar(pergunta, { textoOk = 'Confirmar', perigo = false } = {}) {
    return new Promise((resolve) => {
      this.abrirModal({
        titulo: 'Confirmar',
        html: `
          <p>${escapar(pergunta)}</p>
          <div class="linha-botoes" style="margin-top:14px">
            <button class="botao" data-acao="nao" type="button">Cancelar</button>
            <button class="botao ${perigo ? 'botao--perigo' : 'botao--principal'}" data-acao="sim" type="button">
              ${escapar(textoOk)}
            </button>
          </div>
        `,
        montar: (raiz) => {
          raiz.querySelector('[data-acao="nao"]').onclick = () => {
            this.fecharModal();
            resolve(false);
          };
          raiz.querySelector('[data-acao="sim"]').onclick = () => {
            this.fecharModal();
            resolve(true);
          };
        },
      });
    });
  },
};

/* ---------- eventos globais ---------- */

el.nav.addEventListener('click', (evento) => {
  const botao = evento.target.closest('.nav__item');
  if (botao) app.ir(botao.dataset.rota);
});

el.botaoPerfil.addEventListener('click', () => app.ir('ajustes'));

el.modal.addEventListener('click', (evento) => {
  if (evento.target === el.modal) app.fecharModal();
});

window.addEventListener('hashchange', () => {
  const rota = location.hash.replace('#', '') || 'escala';
  if (rota !== app.rota) app.ir(rota, { comHistorico: false });
});

window.addEventListener('beforeinstallprompt', (evento) => {
  evento.preventDefault();
  app.promptInstalacao = evento;
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && app.eu) {
    notificacoes.verificarAgora().catch(() => {});
  }
});

/* ---------- inicialização ---------- */

async function iniciar() {
  document.title = `${CONFIG.nomeGrupo} — Escala`;
  document.querySelector('.cabecalho__olho').textContent = CONFIG.nomeGrupo;

  try {
    await db.iniciar();
  } catch (erro) {
    app.erro(erro);
  }

  const sessao = db.sessao();
  app.eu = sessao ? db.membro(sessao.membroId) : null;

  // Se o cadastro foi apagado na nuvem, derruba a sessão deste aparelho.
  if (sessao && !app.eu) db.encerrarSessao();

  el.carregando.classList.add('oculto');
  app.ir(location.hash.replace('#', '') || 'escala', { comHistorico: false });

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js');
    } catch (erro) {
      console.warn('Service worker não registrado:', erro);
    }
  }

  if (app.eu) {
    await notificacoes.sincronizarLembretes(app.eu.id);
    await notificacoes.verificarAgora().catch(() => {});
    await notificacoes.ativarPush();
    // Em modo nuvem, busca dados novos ao abrir.
    if (db.modo === 'nuvem') {
      app.recarregar().catch((erro) => console.warn(erro));
    }
  }
}

iniciar();
