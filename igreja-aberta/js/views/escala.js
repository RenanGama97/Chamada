// Tela principal: a escala do mês (ou de um período de vários meses), com o
// próximo turno de quem está usando o app em destaque e os botões de
// compartilhar.

import { db } from '../store.js';
import { abrirWhatsApp, compartilhar, copiar, textoDaEscala } from '../share.js';
import {
  DIAS_SEMANA,
  escapar,
  formatarData,
  hojeISO,
  nomeMes,
  paraData,
  periodoAtual,
} from '../util.js';
import { abrirEdicaoTurno, renderizarDias } from './comum.js';

export const titulo = 'Escala';

let deSelecionado = null;
let ateSelecionado = null;
let mostrarPassados = false;

export function render({ app, eu }) {
  const escalas = escalasVisiveis(app);

  if (!escalas.length) {
    return `
      <div class="cartao vazio">
        <span class="vazio__icone">🗓️</span>
        <p><strong>Nenhuma escala publicada ainda.</strong></p>
        <p class="fraco">
          ${
            app.ehAdmin
              ? 'Cadastre os irmãos e gere a escala do mês.'
              : 'Assim que o administrador gerar a escala, ela aparece aqui.'
          }
        </p>
        ${
          app.ehAdmin
            ? `<div class="linha-botoes" style="margin-top:12px">
                 <button class="botao botao--principal" data-ir="irmaos" type="button">Cadastrar irmãos</button>
                 <button class="botao" data-ir="gerar" type="button">Gerar escala</button>
               </div>`
            : ''
        }
      </div>
    `;
  }

  if (!escalas.some((e) => e.periodo === deSelecionado)) {
    deSelecionado = escalas.find((e) => e.periodo >= periodoAtual())?.periodo || escalas[0].periodo;
    ateSelecionado = deSelecionado;
  }
  if (!escalas.some((e) => e.periodo === ateSelecionado) || ateSelecionado < deSelecionado) {
    ateSelecionado = deSelecionado;
  }

  const escalasIntervalo = escalas.filter(
    (e) => e.periodo >= deSelecionado && e.periodo <= ateSelecionado,
  );
  const umMesSo = deSelecionado === ateSelecionado;
  const hoje = hojeISO();
  const itens = escalasIntervalo
    .flatMap((e) => e.itens)
    .filter((i) => mostrarPassados || i.data >= hoje);
  const podeEditar = app.ehAdmin || escalasIntervalo.every((e) => e.status === 'publicada');
  const rascunhos = escalasIntervalo.filter((e) => e.status === 'rascunho');

  const opcoesMes = (selecionado) =>
    escalas
      .map(
        (e) =>
          `<option value="${e.periodo}" ${e.periodo === selecionado ? 'selected' : ''}>
             ${escapar(nomeMes(e.periodo))}${e.status === 'rascunho' ? ' (rascunho)' : ''}
           </option>`,
      )
      .join('');

  return `
    ${cartaoMeuTurno(eu)}

    <div class="cartao">
      <div class="grade-2">
        <div class="campo" style="margin:0">
          <label for="periodoDe">De</label>
          <select id="periodoDe">${opcoesMes(deSelecionado)}</select>
        </div>
        <div class="campo" style="margin:0">
          <label for="periodoAte">Até</label>
          <select id="periodoAte">${opcoesMes(ateSelecionado)}</select>
        </div>
      </div>
      <p class="fraco" style="margin:0 0 12px">
        ${
          umMesSo
            ? 'Escolha "Até" um mês mais à frente pra compartilhar vários meses de uma vez.'
            : `Compartilhando ${escapar(nomeMes(deSelecionado))} até ${escapar(nomeMes(ateSelecionado))} de uma vez.`
        }
      </p>
      <div class="linha-botoes">
        <button class="botao botao--verde" data-acao="whatsapp" type="button">Enviar no WhatsApp</button>
        <button class="botao" data-acao="copiar" type="button">Copiar</button>
      </div>
      <label class="escolha" style="margin-top:4px">
        <input type="checkbox" id="verPassados" ${mostrarPassados ? 'checked' : ''} />
        Mostrar dias que já passaram
      </label>
      ${
        app.ehAdmin
          ? `<button class="botao botao--perigo botao--pequeno" data-acao="excluir-escala" type="button" style="margin-top:10px">
               🗑️ Excluir a escala de ${escapar(nomeMes(deSelecionado))}
             </button>`
          : ''
      }
    </div>

    ${
      rascunhos.length
        ? `<div class="cartao" style="background:var(--ambar-fundo);border-color:var(--ambar)">
             <strong>Rascunho.</strong>
             ${
               rascunhos.length > 1
                 ? `Os meses ${escapar(rascunhos.map((e) => nomeMes(e.periodo)).join(', '))} ainda não foram publicados.`
                 : 'Esta escala ainda não foi publicada para o grupo.'
             }
           </div>`
        : ''
    }

    ${renderizarDias(itens, { euId: eu.id, editavel: podeEditar })}

    <p class="mini" style="text-align:center">
      ${itens.length} horário(s) ${umMesSo ? 'no mês' : 'no período'} ·
      ${itens.filter((i) => !i.membroIds.length).length} sem irmão definido
    </p>
  `;
}

export function montar(raiz, { app, eu }) {
  raiz.querySelectorAll('[data-ir]').forEach((botao) => {
    botao.onclick = () => app.ir(botao.dataset.ir);
  });

  const escalas = escalasVisiveis(app);
  if (!escalas.length) return;

  const seletorDe = raiz.querySelector('#periodoDe');
  if (seletorDe) {
    seletorDe.onchange = () => {
      deSelecionado = seletorDe.value;
      if (ateSelecionado < deSelecionado) ateSelecionado = deSelecionado;
      app.desenhar();
    };
  }

  const seletorAte = raiz.querySelector('#periodoAte');
  if (seletorAte) {
    seletorAte.onchange = () => {
      ateSelecionado = seletorAte.value;
      if (ateSelecionado < deSelecionado) deSelecionado = ateSelecionado;
      app.desenhar();
    };
  }

  const verPassados = raiz.querySelector('#verPassados');
  if (verPassados) {
    verPassados.onchange = () => {
      mostrarPassados = verPassados.checked;
      app.desenhar();
    };
  }

  const escalasIntervalo = escalas.filter(
    (e) => e.periodo >= deSelecionado && e.periodo <= ateSelecionado,
  );
  const itensDoIntervalo = escalasIntervalo.flatMap((e) => e.itens);
  const tituloCompartilhar =
    deSelecionado === ateSelecionado
      ? nomeMes(deSelecionado)
      : `${nomeMes(deSelecionado)} A ${nomeMes(ateSelecionado)}`;

  raiz.querySelector('[data-acao="whatsapp"]')?.addEventListener('click', () => {
    abrirWhatsApp(textoDaEscala({ itens: itensDoIntervalo }, { titulo: tituloCompartilhar }));
  });

  raiz.querySelector('[data-acao="copiar"]')?.addEventListener('click', async () => {
    const texto = textoDaEscala({ itens: itensDoIntervalo }, { titulo: tituloCompartilhar });
    const resultado = await compartilhar(texto);
    if (resultado === 'copiado') app.aviso('Escala copiada. Cole no grupo.', 'ok');
    else if (resultado === 'compartilhado') app.aviso('Pronto!', 'ok');
    else if (resultado === 'falhou') {
      copiar(texto);
      app.aviso('Escala copiada.', 'ok');
    }
  });

  const escalaPorItem = new Map();
  for (const e of escalasIntervalo) {
    for (const item of e.itens) escalaPorItem.set(item.id, e);
  }

  raiz.querySelectorAll('[data-editar]').forEach((botao) => {
    botao.onclick = () => {
      const escala = escalaPorItem.get(botao.dataset.editar);
      const item = escala?.itens.find((i) => i.id === botao.dataset.editar);
      if (!escala || !item) return;
      abrirEdicaoTurno({ app, escala, item, aoSalvar: () => app.recarregar() });
    };
  });

  raiz.querySelector('[data-acao="excluir-escala"]')?.addEventListener('click', async () => {
    const escalaDe = db.escalaDoPeriodo(deSelecionado);
    if (!escalaDe) return;

    const ok = await app.confirmar(
      `Excluir a escala de ${nomeMes(escalaDe.periodo)}? Isso apaga todos os turnos desse mês e não pode ser desfeito.`,
      { textoOk: 'Excluir', perigo: true },
    );
    if (!ok) return;

    try {
      await db.removerEscala(escalaDe.id);
      app.aviso('Escala excluída.', 'ok');
      await app.recarregar();
    } catch (erro) {
      app.erro(erro);
    }
  });

  raiz.querySelector('[data-acao="ver-meu"]')?.addEventListener('click', () => {
    const proximo = proximoTurno(eu.id);
    if (proximo) {
      deSelecionado = proximo.periodo;
      ateSelecionado = proximo.periodo;
      app.desenhar();
    }
  });
}

function escalasVisiveis(app) {
  const lista = app.ehAdmin ? db.escalas() : db.escalasPublicadas();
  return [...lista].sort((a, b) => a.periodo.localeCompare(b.periodo));
}

function proximoTurno(membroId) {
  const hoje = hojeISO();
  return (
    db.itensPublicados().find((i) => i.data >= hoje && i.membroIds.includes(membroId)) || null
  );
}

function cartaoMeuTurno(eu) {
  const proximo = proximoTurno(eu.id);
  if (!proximo) {
    return `
      <div class="cartao">
        <div class="cartao__titulo">Seu próximo turno</div>
        <p class="fraco" style="margin:0">
          Você não está escalado nos próximos cultos. 🙌
        </p>
      </div>
    `;
  }

  const tipo = db.tipo(proximo.tipo);
  const dias = Math.round(
    (paraData(proximo.data) - paraData(hojeISO())) / 86400000,
  );
  const quando =
    dias === 0 ? 'É HOJE' : dias === 1 ? 'É AMANHÃ' : `Faltam ${dias} dias`;
  const companhia = proximo.membroIds
    .filter((id) => id !== eu.id)
    .map((id) => db.membro(id)?.nome)
    .filter(Boolean);

  return `
    <div class="cartao cartao--destaque">
      <div class="cartao__titulo">
        <span>🔑 Seu próximo turno</span>
        <span class="selo ${dias <= 1 ? 'selo--ambar' : 'selo--marca'}">${escapar(quando)}</span>
      </div>
      <p style="margin:6px 0 2px;font-size:17px;font-weight:700">
        ${escapar(DIAS_SEMANA[paraData(proximo.data).getDay()])}, ${formatarData(proximo.data)}
        · ${escapar(tipo.apelido || tipo.curto)}
      </p>
      <p class="fraco" style="margin:0">
        Chegar às <strong>${escapar(tipo.horaAbertura)}</strong> (culto ${escapar(tipo.horaCulto)}).
        ${companhia.length ? `Com ${escapar(companhia.join(' e '))}.` : ''}
      </p>
      <button class="botao botao--pequeno" data-acao="ver-meu" type="button" style="margin-top:10px">
        Ver o mês deste turno
      </button>
    </div>
  `;
}
