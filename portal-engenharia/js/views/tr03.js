import { montarFonte } from '../components/fonteDados.js';

export const titulo = 'TR03';

const ABAS = ['q', 'p'];

function abaAtual(ctx) {
  return ABAS.includes(ctx.app.subRota) ? ctx.app.subRota : 'q';
}

export function render(ctx) {
  const aba = abaAtual(ctx);

  return `
    <div class="pagina">
      <h2 class="pagina__titulo">TR03</h2>
      <p class="pagina__subtitulo">Materiais de engenharia no depósito TR03, por tipo.</p>

      <div class="abas">
        <button class="aba ${aba === 'q' ? 'aba--ativa' : ''}" data-acao="aba" data-aba="q" type="button">Tipo Q</button>
        <button class="aba ${aba === 'p' ? 'aba--ativa' : ''}" data-acao="aba" data-aba="p" type="button">Tipo P</button>
      </div>

      <div class="conteudo-aba">
        ${
          aba === 'q'
            ? `<div class="fonte-slot" data-slot="mb52"></div>
               <div class="fonte-slot" data-slot="mb51"></div>
               <div class="fonte-slot" data-slot="zqry_lo_002"></div>`
            : `<div class="fonte-slot" data-slot="zmmr075"></div>`
        }
      </div>
    </div>
  `;
}

export function montar(raiz, ctx) {
  raiz.querySelectorAll('[data-acao="aba"]').forEach((botao) => {
    botao.onclick = () => ctx.app.ir('tr03', botao.dataset.aba);
  });

  const aba = abaAtual(ctx);

  if (aba === 'q') {
    montarFonte(
      raiz.querySelector('[data-slot="mb52"]'),
      { chave: 'mb52', titulo: 'MB52', descricao: 'Estoque em depósito (rodar filtrando o depósito TR03).' },
      ctx,
    );
    montarFonte(
      raiz.querySelector('[data-slot="mb51"]'),
      { chave: 'mb51', titulo: 'MB51', descricao: 'Documentos de material (rodar filtrando o depósito TR03).' },
      ctx,
    );
    montarFonte(
      raiz.querySelector('[data-slot="zqry_lo_002"]'),
      { chave: 'zqry_lo_002', titulo: 'ZQRY_LO_002', descricao: 'Rodar filtrando o depósito TR03.' },
      ctx,
    );
  } else {
    montarFonte(
      raiz.querySelector('[data-slot="zmmr075"]'),
      {
        chave: 'zmmr075',
        titulo: 'ZMMR075',
        descricao: 'Pendentes = linhas com Status 02.',
        comPendentes: true,
      },
      ctx,
    );
  }
}
