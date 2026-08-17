// Tela principal: a escala do mês, com o próximo turno de quem está usando o
// app em destaque e os botões de compartilhar.

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

let periodoSelecionado = null;
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

  if (!escalas.some((e) => e.periodo === periodoSelecionado)) {
    periodoSelecionado =
      escalas.find((e) => e.periodo >= periodoAtual())?.periodo || escalas[0].periodo;
  }

  const escala = escalas.find((e) => e.periodo === periodoSelecionado);
  const hoje = hojeISO();
  const itens = mostrarPassados ? escala.itens : escala.itens.filter((i) => i.data >= hoje);
  const podeEditar = app.ehAdmin || escala.status === 'publicada';

  return `
    ${cartaoMeuTurno(eu)}

    <div class="cartao">
      <div class="campo" style="margin:0">
        <label for="periodo">Mês</label>
        <select id="periodo">
          ${escalas
            .map(
              (e) =>
                `<option value="${e.periodo}" ${e.periodo === periodoSelecionado ? 'selected' : ''}>
                   ${escapar(nomeMes(e.periodo))}${e.status === 'rascunho' ? ' (rascunho)' : ''}
                 </option>`,
            )
            .join('')}
        </select>
      </div>
      <div class="linha-botoes" style="margin-top:12px">
        <button class="botao botao--verde" data-acao="whatsapp" type="button">Enviar no WhatsApp</button>
        <button class="botao" data-acao="copiar" type="button">Copiar</button>
      </div>
      <label class="escolha" style="margin-top:4px">
        <input type="checkbox" id="verPassados" ${mostrarPassados ? 'checked' : ''} />
        Mostrar dias que já passaram
      </label>
    </div>

    ${
      escala.status === 'rascunho'
        ? `<div class="cartao" style="background:var(--ambar-fundo);border-color:var(--ambar)">
             <strong>Rascunho.</strong> Esta escala ainda não foi publicada para o grupo.
           </div>`
        : ''
    }

    ${renderizarDias(itens, { euId: eu.id, editavel: podeEditar })}

    <p class="mini" style="text-align:center">
      ${escala.itens.length} horário(s) no mês · ${
        escala.itens.filter((i) => !i.membroIds.length).length
      } sem irmão definido
    </p>
  `;
}

export function montar(raiz, { app, eu }) {
  raiz.querySelectorAll('[data-ir]').forEach((botao) => {
    botao.onclick = () => app.ir(botao.dataset.ir);
  });

  const seletor = raiz.querySelector('#periodo');
  if (seletor) {
    seletor.onchange = () => {
      periodoSelecionado = seletor.value;
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

  const escala = db.escalaDoPeriodo(periodoSelecionado);

  raiz.querySelector('[data-acao="whatsapp"]')?.addEventListener('click', () => {
    abrirWhatsApp(textoDaEscala(escala));
  });

  raiz.querySelector('[data-acao="copiar"]')?.addEventListener('click', async () => {
    const texto = textoDaEscala(escala);
    const resultado = await compartilhar(texto);
    if (resultado === 'copiado') app.aviso('Escala copiada. Cole no grupo.', 'ok');
    else if (resultado === 'compartilhado') app.aviso('Pronto!', 'ok');
    else if (resultado === 'falhou') {
      copiar(texto);
      app.aviso('Escala copiada.', 'ok');
    }
  });

  raiz.querySelectorAll('[data-editar]').forEach((botao) => {
    botao.onclick = () => {
      const item = escala.itens.find((i) => i.id === botao.dataset.editar);
      abrirEdicaoTurno({
        app,
        escala,
        item,
        aoSalvar: () => app.recarregar(),
      });
    };
  });

  raiz.querySelector('[data-acao="ver-meu"]')?.addEventListener('click', () => {
    const proximo = proximoTurno(eu.id);
    if (proximo) {
      periodoSelecionado = proximo.periodo;
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
