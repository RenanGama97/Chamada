// Tela do administrador: gerar a escala do mês com um toque.

import { db } from '../store.js';
import { gerarEscala, resumoDeCargas } from '../scheduler.js';
import { abrirWhatsApp, textoDaEscala } from '../share.js';
import {
  escapar,
  formatarData,
  nomeMes,
  periodoAtual,
  primeiroDiaDoPeriodo,
  proximoPeriodo,
  uid,
  ultimoDiaDoPeriodo,
} from '../util.js';
import { renderizarDias } from './comum.js';

export const titulo = 'Gerar escala';

let periodo = proximoPeriodo(periodoAtual());
let previa = null; // { itens, avisos, resumo }

export function render({ app }) {
  const membros = db.membrosAtivos();
  const prefs = db.prefs();
  const existente = db.escalaDoPeriodo(periodo);
  const opcoesPeriodo = [0, 1, 2, 3].map((i) => proximoPeriodo(periodoAtual(), i));

  if (membros.length === 0) {
    return `
      <div class="cartao vazio">
        <span class="vazio__icone">👥</span>
        <p><strong>Cadastre os irmãos primeiro.</strong></p>
        <button class="botao botao--principal" data-ir="irmaos" type="button" style="margin-top:10px">
          Ir para os irmãos
        </button>
      </div>
    `;
  }

  return `
    <div class="cartao">
      <div class="campo">
        <label for="gPeriodo">Mês da escala</label>
        <select id="gPeriodo">
          ${opcoesPeriodo
            .map(
              (p) =>
                `<option value="${p}" ${p === periodo ? 'selected' : ''}>
                   ${escapar(nomeMes(p))}${db.escalaDoPeriodo(p) ? ' — já existe' : ''}
                 </option>`,
            )
            .join('')}
        </select>
      </div>

      <div class="campo">
        <label for="gPessoas">Irmãos por culto</label>
        <input type="number" id="gPessoas" min="1" max="5" value="${prefs.pessoasPorEvento || 1}" />
      </div>

      <label class="escolha">
        <input type="checkbox" id="gEspacar" ${prefs.evitarRepetirNaSemana ? 'checked' : ''} />
        Evitar escalar a mesma pessoa duas vezes na semana
      </label>

      ${
        existente
          ? `<label class="escolha">
               <input type="checkbox" id="gManter" checked />
               Manter os turnos que já estão definidos em ${escapar(nomeMes(periodo))}
             </label>`
          : ''
      }

      <button class="botao botao--principal botao--bloco" data-acao="gerar" type="button" style="margin-top:8px">
        ✨ Gerar escala de ${escapar(nomeMes(periodo))}
      </button>

      <p class="mini" style="margin-top:10px">
        ${membros.length} irmão(s) disponível(is) ·
        ${db.tiposAtivos().length} tipo(s) de culto ·
        respeita as marcações de "não posso".
      </p>
    </div>

    ${
      existente && !previa
        ? `<div class="cartao" style="background:var(--ambar-fundo);border-color:var(--ambar)">
             <strong>Atenção:</strong> já existe uma escala de ${escapar(nomeMes(periodo))}
             (${escapar(existente.status)}). Gerar de novo substitui a atual.
           </div>`
        : ''
    }

    ${previa ? renderPrevia() : ''}
  `;
}

function renderPrevia() {
  const vagos = previa.itens.filter((i) => !i.membroIds.length).length;
  const maior = Math.max(1, ...previa.resumo.map((r) => r.total));

  return `
    <h2 class="secao-titulo">Prévia — ${escapar(nomeMes(periodo))}</h2>

    ${
      previa.avisos.length
        ? `<div class="cartao" style="background:var(--ambar-fundo);border-color:var(--ambar)">
             <div class="cartao__titulo">⚠️ ${previa.avisos.length} horário(s) com problema</div>
             ${previa.avisos
               .map(
                 (a) =>
                   `<div class="mini">${formatarData(a.data)} · ${escapar(db.tipo(a.tipo).curto)} — ${escapar(a.mensagem)}</div>`,
               )
               .join('')}
             <p class="mini" style="margin-top:8px">
               Você pode publicar assim e ajustar depois na tela da escala.
             </p>
           </div>`
        : `<div class="cartao" style="background:var(--verde-fundo);border-color:var(--verde)">
             ✅ Todos os ${previa.itens.length} horários preenchidos.
           </div>`
    }

    <div class="cartao">
      <div class="cartao__titulo">Divisão entre os irmãos</div>
      ${previa.resumo
        .filter((r) => r.total > 0 || db.membro(r.membroId)?.ativo)
        .map(
          (r) => `
            <div class="pessoa">
              <div class="pessoa__info">
                <div class="pessoa__nome">${escapar(r.nome)} <span class="mini">— ${r.total} turno(s)</span></div>
                <div class="barra"><div class="barra__preenchida" style="width:${(r.total / maior) * 100}%"></div></div>
              </div>
            </div>`,
        )
        .join('')}
    </div>

    ${renderizarDias(previa.itens, { euId: null, editavel: false })}

    <div class="cartao">
      <div class="linha-botoes">
        <button class="botao" data-acao="gerar" type="button">🔄 Gerar de novo</button>
        <button class="botao" data-acao="rascunho" type="button">Salvar rascunho</button>
      </div>
      <button class="botao botao--verde botao--bloco" data-acao="publicar" type="button" style="margin-top:8px">
        📣 Publicar e enviar no WhatsApp
      </button>
      ${vagos ? `<p class="mini" style="margin-top:8px">${vagos} horário(s) irão como "a definir".</p>` : ''}
    </div>
  `;
}

export function montar(raiz, { app }) {
  raiz.querySelectorAll('[data-ir]').forEach((botao) => {
    botao.onclick = () => app.ir(botao.dataset.ir);
  });

  const seletor = raiz.querySelector('#gPeriodo');
  if (seletor) {
    seletor.onchange = () => {
      periodo = seletor.value;
      previa = null;
      app.desenhar();
    };
  }

  raiz.querySelector('[data-acao="gerar"]')?.addEventListener('click', () => {
    const pessoas = Math.max(
      1,
      Math.min(5, Number(raiz.querySelector('#gPessoas')?.value || 1)),
    );
    const espacar = raiz.querySelector('#gEspacar')?.checked ?? true;
    const manter = raiz.querySelector('#gManter')?.checked ?? false;

    const existente = db.escalaDoPeriodo(periodo);
    const fixos = new Map();
    if (manter && existente) {
      for (const item of existente.itens) {
        if (item.membroIds.length) fixos.set(`${item.data}|${item.tipo}`, item.membroIds);
      }
    }

    previa = gerarEscala({
      membros: db.membrosAtivos(),
      indisponibilidades: db.indisponibilidades(),
      escalasAnteriores: db.escalas().filter((e) => e.periodo !== periodo),
      inicio: primeiroDiaDoPeriodo(periodo),
      fim: ultimoDiaDoPeriodo(periodo),
      tipos: db.tiposAtivos(),
      pessoasPorEvento: pessoas,
      evitarRepetirNaSemana: espacar,
      fixos,
    });

    app.aviso('Escala gerada. Confira a prévia abaixo.', 'ok');
    app.desenhar();
  });

  raiz.querySelector('[data-acao="rascunho"]')?.addEventListener('click', () =>
    salvar(app, 'rascunho'),
  );

  raiz.querySelector('[data-acao="publicar"]')?.addEventListener('click', () =>
    salvar(app, 'publicada'),
  );
}

async function salvar(app, status) {
  if (!previa) return;

  const existente = db.escalaDoPeriodo(periodo);
  if (existente && status === 'publicada') {
    const ok = await app.confirmar(
      `Isso substitui a escala de ${nomeMes(periodo)} que já está salva. Continuar?`,
      { textoOk: 'Substituir' },
    );
    if (!ok) return;
  }

  const escala = {
    id: existente?.id || uid('esc'),
    periodo,
    status,
    itens: previa.itens,
    criadoEm: existente?.criadoEm || new Date().toISOString(),
    publicadoEm: status === 'publicada' ? new Date().toISOString() : null,
  };

  try {
    await db.salvarEscala(escala);
    // Mantém o resumo coerente com o que foi salvo.
    previa = { ...previa, resumo: resumoDeCargas(escala.itens, db.membros()) };
    await app.recarregar({ redesenhar: false });

    if (status === 'publicada') {
      previa = null;
      app.aviso('Escala publicada!', 'ok');
      abrirWhatsApp(textoDaEscala(escala));
      app.ir('escala');
    } else {
      app.aviso('Rascunho salvo.', 'ok');
      app.desenhar();
    }
  } catch (erro) {
    app.erro(erro);
  }
}
