// Ponto de entrada: navegação entre telas e avisos (toasts).

import * as telaInicio from './views/inicio.js';
import * as telaTr03 from './views/tr03.js';

const TELAS = {
  inicio: telaInicio,
  tr03: telaTr03,
};

const el = {
  view: document.getElementById('view'),
  nav: document.getElementById('navegacao'),
  avisos: document.getElementById('avisos'),
};

export const app = {
  rota: 'inicio',
  subRota: null,

  ir(rota, subRota = null, { comHistorico = true } = {}) {
    if (!TELAS[rota]) rota = 'inicio';
    this.rota = rota;
    this.subRota = subRota;
    if (comHistorico) {
      const hash = subRota ? `#${rota}/${subRota}` : `#${rota}`;
      if (location.hash !== hash) location.hash = hash;
    }
    this.desenhar();
  },

  desenhar() {
    for (const botao of el.nav.querySelectorAll('.nav__item')) {
      botao.classList.toggle('nav__item--ativo', botao.dataset.rota === this.rota);
    }
    const tela = TELAS[this.rota];
    const ctx = { app: this };
    el.view.innerHTML = tela.render(ctx);
    tela.montar?.(el.view, ctx);
  },

  aviso(texto, tipo = '') {
    const div = document.createElement('div');
    div.className = `aviso ${tipo ? `aviso--${tipo}` : ''}`;
    div.textContent = texto;
    el.avisos.appendChild(div);
    while (el.avisos.children.length > 3) el.avisos.firstElementChild.remove();
    setTimeout(() => div.remove(), 3800);
  },

  erro(algo) {
    const texto = algo instanceof Error ? algo.message : String(algo);
    console.error(algo);
    this.aviso(texto, 'erro');
  },
};

el.nav.addEventListener('click', (evento) => {
  const botao = evento.target.closest('.nav__item');
  if (botao) app.ir(botao.dataset.rota);
});

window.addEventListener('hashchange', () => {
  const [rota, subRota] = location.hash.replace('#', '').split('/');
  app.ir(rota || 'inicio', subRota || null, { comHistorico: false });
});

const [rotaInicial, subRotaInicial] = location.hash.replace('#', '').split('/');
app.ir(rotaInicial || 'inicio', subRotaInicial || null, { comHistorico: false });
