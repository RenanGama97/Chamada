import { fontes } from '../store.js';
import { formatarDataHora } from '../util.js';

export const titulo = 'Início';

const FONTES_Q = ['mb52', 'mb51', 'zqry_lo_002'];

function resumoQ() {
  const datasets = FONTES_Q.map((chave) => fontes.obter(chave)).filter(Boolean);
  const totalLinhas = datasets.reduce((soma, d) => soma + d.linhas.length, 0);
  const ultimaImportacao = datasets.map((d) => d.importadoEm).sort().at(-1) || null;
  return { totalLinhas, ultimaImportacao, importadas: datasets.length, total: FONTES_Q.length };
}

function resumoP() {
  const dataset = fontes.obter('zmmr075');
  if (!dataset) return { totalLinhas: 0, totalPendentes: 0, ultimaImportacao: null };
  const campoStatus = dataset.headers.find((h) => h.trim().toLowerCase() === 'status');
  const totalPendentes = campoStatus
    ? dataset.linhas.filter((l) => Number(l[campoStatus]) === 2).length
    : 0;
  return { totalLinhas: dataset.linhas.length, totalPendentes, ultimaImportacao: dataset.importadoEm };
}

export function render() {
  const q = resumoQ();
  const p = resumoP();

  return `
    <div class="pagina">
      <h2 class="pagina__titulo">Portal da Engenharia</h2>
      <p class="pagina__subtitulo">Visão geral do que está rolando na engenharia.</p>

      <div class="cartoes">
        <a class="cartao" href="#tr03/q">
          <p class="cartao__rotulo">TR03 · Tipo Q</p>
          <p class="cartao__numero">${q.totalLinhas}</p>
          <p class="cartao__detalhe">
            ${q.importadas} de ${q.total} fontes importadas (MB52, MB51, ZQRY_LO_002)
            ${q.ultimaImportacao ? `· última em ${formatarDataHora(q.ultimaImportacao)}` : ''}
          </p>
        </a>
        <a class="cartao" href="#tr03/p">
          <p class="cartao__rotulo">TR03 · Tipo P</p>
          <p class="cartao__numero">${p.totalPendentes}</p>
          <p class="cartao__detalhe">
            pendentes (Status 02) de ${p.totalLinhas} linha(s) — ZMMR075
            ${p.ultimaImportacao ? `· última em ${formatarDataHora(p.ultimaImportacao)}` : ''}
          </p>
        </a>
      </div>

      <p class="mais-em-breve">Mais seções entram aqui conforme forem adicionadas ao portal.</p>
    </div>
  `;
}

export function montar() {}
