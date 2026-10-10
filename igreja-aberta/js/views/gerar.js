// Tela do administrador: gerar a escala por um período (pode passar de um mês).

import { db } from '../store.js';
import { gerarEscala, resumoDeCargas } from '../scheduler.js';
import { abrirWhatsApp, textoDaEscala } from '../share.js';
import {
  escapar,
  formatarData,
  nomeMes,
  periodoAtual,
  periodosEntre,
  primeiroDiaDoPeriodo,
  proximoPeriodo,
  uid,
  ultimoDiaDoPeriodo,
} from '../util.js';
import { renderizarDias } from './comum.js';

export const titulo = 'Gerar escala';

const proximo = proximoPeriodo(periodoAtual());
let inicio = primeiroDiaDoPeriodo(proximo);
let fim = ultimoDiaDoPeriodo(proximo);
let previa = null; // { itens, avisos, resumo }

export function render({ app }) {
  const membros = db.membrosAtivos();
  const prefs = db.prefs();
  const periodoValido = inicio && fim && fim >= inicio;
  const existentes = periodoValido
    ? periodosEntre(inicio, fim)
        .map((p) => db.escalaDoPeriodo(p))
        .filter(Boolean)
    : [];

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
      <div class="grade-2">
        <div class="campo">
          <label for="gInicio">De</label>
          <input type="date" id="gInicio" value="${inicio}" />
        </div>
        <div class="campo">
          <label for="gFim">Até</label>
          <input type="date" id="gFim" value="${fim}" />
        </div>
      </div>
      <p class="fraco" style="margin:0 0 12px">
        Pode passar de um mês (ex.: 15/10 até 30/11) — útil pra distribuir os turnos
        num período maior, em vez de sempre fechar no fim do mês.
      </p>

      ${
        !periodoValido
          ? `<p class="mini" style="color:var(--vermelho)">"Até" precisa ser igual ou depois de "De".</p>`
          : ''
      }

      <div class="campo">
        <label for="gPessoas">Irmãos por culto</label>
        <input type="number" id="gPessoas" min="1" max="5" value="${prefs.pessoasPorEvento || 1}" />
      </div>

      <label class="escolha">
        <input type="checkbox" id="gEspacar" ${prefs.evitarRepetirNaSemana ? 'checked' : ''} />
        Evitar escalar a mesma pessoa duas vezes na semana
      </label>

      ${
        existentes.length
          ? `<label class="escolha">
               <input type="checkbox" id="gManter" checked />
               Manter os turnos que já estão definidos nesse período
             </label>`
          : ''
      }

      <button
        class="botao botao--principal botao--bloco"
        data-acao="gerar"
        type="button"
        style="margin-top:8px"
        ${periodoValido ? '' : 'disabled'}
      >
        ✨ Gerar escala de ${escapar(formatarData(inicio))} até ${escapar(formatarData(fim))}
      </button>

      <p class="mini" style="margin-top:10px">
        ${membros.length} irmão(s) disponível(is) ·
        ${db.tiposAtivos().length} tipo(s) de culto ·
        respeita as marcações de "não posso".
      </p>
    </div>

    ${
      existentes.length && !previa
        ? `<div class="cartao" style="background:var(--ambar-fundo);border-color:var(--ambar)">
             <strong>Atenção:</strong> já existe escala em: ${escapar(existentes.map((e) => nomeMes(e.periodo)).join(', '))}.
             Só os turnos dentro de ${escapar(formatarData(inicio))}–${escapar(formatarData(fim))}
             serão substituídos; fora desse período, nada muda.
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
    <h2 class="secao-titulo">Prévia — ${escapar(formatarData(inicio))} até ${escapar(formatarData(fim))}</h2>

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

  const campoInicio = raiz.querySelector('#gInicio');
  if (campoInicio) {
    campoInicio.onchange = () => {
      inicio = campoInicio.value;
      previa = null;
      app.desenhar();
    };
  }

  const campoFim = raiz.querySelector('#gFim');
  if (campoFim) {
    campoFim.onchange = () => {
      fim = campoFim.value;
      previa = null;
      app.desenhar();
    };
  }

  raiz.querySelector('[data-acao="gerar"]')?.addEventListener('click', () => {
    if (!inicio || !fim || fim < inicio) {
      app.aviso('Confira as datas: "Até" precisa ser igual ou depois de "De".', 'erro');
      return;
    }

    const pessoas = Math.max(
      1,
      Math.min(5, Number(raiz.querySelector('#gPessoas')?.value || 1)),
    );
    const espacar = raiz.querySelector('#gEspacar')?.checked ?? true;
    const manter = raiz.querySelector('#gManter')?.checked ?? false;

    const existentes = periodosEntre(inicio, fim)
      .map((p) => db.escalaDoPeriodo(p))
      .filter(Boolean);

    const fixos = new Map();
    if (manter) {
      for (const e of existentes) {
        for (const item of e.itens) {
          if (item.membroIds.length) fixos.set(`${item.data}|${item.tipo}`, item.membroIds);
        }
      }
    }

    previa = gerarEscala({
      membros: db.membrosAtivos(),
      indisponibilidades: db.indisponibilidades(),
      escalasAnteriores: db.escalas(),
      inicio,
      fim,
      tipos: db.tiposAtivos(),
      pessoasPorEvento: pessoas,
      evitarRepetirNaSemana: espacar,
      fixos,
    });

    // Preserva os turnos que já estavam salvos fora do período escolhido
    // (ex.: começo do mês, ou o mês seguinte depois do "até"), em vez de
    // gerar os meses tocados inteiros do zero.
    const preservados = existentes.flatMap((e) =>
      e.itens.filter((i) => i.data < inicio || i.data > fim),
    );
    if (preservados.length) {
      previa = {
        ...previa,
        itens: [...preservados, ...previa.itens],
        resumo: resumoDeCargas([...preservados, ...previa.itens], db.membros()),
      };
    }

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

  const periodosTocados = periodosEntre(inicio, fim);
  const existentes = periodosTocados.map((p) => db.escalaDoPeriodo(p)).filter(Boolean);

  if (existentes.length && status === 'publicada') {
    const nomes = existentes.map((e) => nomeMes(e.periodo)).join(', ');
    const ok = await app.confirmar(
      `Isso substitui os turnos já salvos dentro de ${formatarData(inicio)}–${formatarData(fim)}` +
        ` (em: ${nomes}). Continuar?`,
      { textoOk: 'Substituir' },
    );
    if (!ok) return;
  }

  // Cada mês continua sendo guardado como uma escala separada — só agrupa
  // os itens (preservados + recém-gerados) de volta por mês pra salvar.
  const porPeriodo = new Map();
  for (const item of previa.itens) {
    const p = item.data.slice(0, 7);
    if (!porPeriodo.has(p)) porPeriodo.set(p, []);
    porPeriodo.get(p).push(item);
  }

  const agora = new Date().toISOString();
  const escalas = [...porPeriodo.entries()].map(([p, itens]) => {
    const existente = db.escalaDoPeriodo(p);
    return {
      id: existente?.id || uid('esc'),
      periodo: p,
      status,
      itens,
      criadoEm: existente?.criadoEm || agora,
      publicadoEm: status === 'publicada' ? agora : null,
    };
  });

  try {
    for (const escala of escalas) {
      await db.salvarEscala(escala);
    }
    previa = { ...previa, resumo: resumoDeCargas(previa.itens, db.membros()) };
    await app.recarregar({ redesenhar: false });

    if (status === 'publicada') {
      previa = null;
      app.aviso('Escala publicada!', 'ok');
      const itensDoPeriodo = escalas.flatMap((e) =>
        e.itens.filter((i) => i.data >= inicio && i.data <= fim),
      );
      abrirWhatsApp(
        textoDaEscala(
          { itens: itensDoPeriodo },
          { titulo: `${formatarData(inicio)} A ${formatarData(fim)}` },
        ),
      );
      app.ir('escala');
    } else {
      app.aviso('Rascunho salvo.', 'ok');
      app.desenhar();
    }
  } catch (erro) {
    app.erro(erro);
  }
}
