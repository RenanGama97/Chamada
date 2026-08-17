// Tela "Não posso": o irmão marca os cultos em que não estará disponível.
// A escala é gerada respeitando essas marcações.

import { db } from '../store.js';
import { eventosDoIntervalo } from '../scheduler.js';
import {
  DIAS_SEMANA,
  escapar,
  formatarData,
  hojeISO,
  paraData,
  somarDias,
} from '../util.js';

export const titulo = 'Não posso';

const DIAS_A_FRENTE = 91; // cerca de 3 meses

export function render({ eu }) {
  const hoje = hojeISO();
  const eventos = eventosDoIntervalo(hoje, somarDias(hoje, DIAS_A_FRENTE), db.tiposAtivos());
  const meus = db.indisponibilidades(eu.id);
  const marcadosNoDia = new Set(
    meus.filter((d) => !d.tipo).map((d) => d.data),
  );

  const porData = new Map();
  for (const evento of eventos) {
    if (!porData.has(evento.data)) porData.set(evento.data, []);
    porData.get(evento.data).push(evento);
  }

  const cartoes = [...porData.entries()]
    .map(([data, eventosDoDia]) => {
      const diaTodoMarcado = marcadosNoDia.has(data);
      return `
        <article class="dia">
          <header class="dia__topo">
            <span>${escapar(DIAS_SEMANA[paraData(data).getDay()])}</span>
            <span class="dia__data">${formatarData(data)}</span>
            ${diaTodoMarcado ? '<span class="selo selo--vermelho">dia todo</span>' : ''}
          </header>
          ${eventosDoDia
            .map((evento) => {
              const tipo = db.tipo(evento.tipo);
              const marcado = db.estaIndisponivel(eu.id, evento.data, evento.tipo);
              return `
                <label class="turno ${marcado ? 'turno--vago' : ''}">
                  <input
                    type="checkbox"
                    style="width:22px;height:22px;accent-color:var(--vermelho)"
                    data-data="${escapar(evento.data)}"
                    data-tipo="${escapar(evento.tipo)}"
                    ${marcado ? 'checked' : ''}
                    ${diaTodoMarcado ? 'disabled' : ''}
                  />
                  <span class="turno__info">
                    <span class="turno__tipo">${escapar(tipo.apelido || tipo.curto)} · ${escapar(tipo.horaCulto || '')}</span>
                    <span class="turno__nome">${marcado ? 'Não posso' : 'Estou disponível'}</span>
                  </span>
                </label>
              `;
            })
            .join('')}
        </article>
      `;
    })
    .join('');

  return `
    <div class="cartao">
      <div class="cartao__titulo">🚫 Marque quando não puder</div>
      <p class="fraco" style="margin:0">
        Deixe marcado só o que você <strong>não</strong> pode. Ao gerar a escala,
        o app não coloca ninguém em dia marcado — assim ninguém precisa ficar
        editando depois.
      </p>
    </div>

    <div class="cartao">
      <div class="cartao__titulo">✈️ Vou viajar / ficar fora um período</div>
      <div class="grade-2">
        <div class="campo">
          <label for="de">De</label>
          <input type="date" id="de" value="${hoje}" />
        </div>
        <div class="campo">
          <label for="ate">Até</label>
          <input type="date" id="ate" value="${hoje}" />
        </div>
      </div>
      <div class="campo">
        <label for="motivo">Motivo (opcional)</label>
        <input type="text" id="motivo" maxlength="80" placeholder="Ex.: viagem de família" />
      </div>
      <button class="botao botao--bloco" data-acao="bloquear-periodo" type="button">
        Marcar período inteiro
      </button>
    </div>

    ${
      meus.filter((d) => d.data >= hoje).length
        ? `<h2 class="secao-titulo">Suas marcações</h2>
           <div class="cartao">
             ${meus
               .filter((d) => d.data >= hoje)
               .map(
                 (d) => `
                   <div class="pessoa">
                     <div class="pessoa__bola" style="background:var(--vermelho-fundo);color:var(--vermelho)">🚫</div>
                     <div class="pessoa__info">
                       <div class="pessoa__nome">${formatarData(d.data, { comAno: true })}</div>
                       <div class="mini">
                         ${d.tipo ? escapar(db.tipo(d.tipo).curto) : 'Dia inteiro'}
                         ${d.motivo ? `· ${escapar(d.motivo)}` : ''}
                       </div>
                     </div>
                     <button class="botao botao--pequeno" data-remover="${escapar(d.id)}" type="button">Tirar</button>
                   </div>
                 `,
               )
               .join('')}
           </div>`
        : ''
    }

    <h2 class="secao-titulo">Próximos cultos</h2>
    ${cartoes || '<div class="cartao vazio">Nenhum culto configurado.</div>'}
  `;
}

export function montar(raiz, { app, eu }) {
  raiz.querySelectorAll('input[type="checkbox"][data-data]').forEach((caixa) => {
    caixa.onchange = async () => {
      const { data, tipo } = caixa.dataset;
      try {
        if (caixa.checked) {
          await db.marcarIndisponivel(eu.id, data, tipo);
          app.aviso(`Marcado: não posso em ${formatarData(data)}.`);
        } else {
          await db.desmarcarIndisponivel(eu.id, data, tipo);
          app.aviso(`Disponível em ${formatarData(data)}.`, 'ok');
        }
        app.desenhar();
      } catch (erro) {
        caixa.checked = !caixa.checked;
        app.erro(erro);
      }
    };
  });

  raiz.querySelector('[data-acao="bloquear-periodo"]').onclick = async () => {
    const de = raiz.querySelector('#de').value;
    const ate = raiz.querySelector('#ate').value;
    const motivo = raiz.querySelector('#motivo').value.trim();

    if (!de || !ate || ate < de) {
      return app.aviso('Confira as datas do período.', 'erro');
    }

    const eventos = eventosDoIntervalo(de, ate, db.tiposAtivos());
    if (!eventos.length) {
      return app.aviso('Não há culto nesse período.', 'erro');
    }

    const datas = [...new Set(eventos.map((e) => e.data))];
    try {
      for (const data of datas) {
        await db.marcarIndisponivel(eu.id, data, null, motivo);
      }
      app.aviso(`${datas.length} dia(s) marcado(s).`, 'ok');
      app.desenhar();
    } catch (erro) {
      app.erro(erro);
    }
  };

  raiz.querySelectorAll('[data-remover]').forEach((botao) => {
    botao.onclick = async () => {
      try {
        await db.removerIndisponibilidade(botao.dataset.remover);
        app.aviso('Marcação removida.', 'ok');
        app.desenhar();
      } catch (erro) {
        app.erro(erro);
      }
    };
  });
}
