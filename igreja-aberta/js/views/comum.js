// Pedaços de tela usados em mais de um lugar: a lista de dias da escala e o
// modal de troca de irmão em um turno.

import { db } from '../store.js';
import {
  DIAS_SEMANA,
  escapar,
  formatarData,
  hojeISO,
  paraData,
} from '../util.js';

// Agrupa os itens por data e devolve o HTML dos "cartões de dia".
export function renderizarDias(itens, { euId, editavel = false } = {}) {
  const hoje = hojeISO();
  const porData = new Map();
  for (const item of [...itens].sort(
    (a, b) => a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo),
  )) {
    if (!porData.has(item.data)) porData.set(item.data, []);
    porData.get(item.data).push(item);
  }

  if (!porData.size) {
    return `<div class="cartao vazio">
      <span class="vazio__icone">🗓️</span>
      Nenhum culto nesta lista.
    </div>`;
  }

  return [...porData.entries()]
    .map(([data, itensDoDia]) => {
      const diaSemana = DIAS_SEMANA[paraData(data).getDay()];
      const passado = data < hoje;
      const ehHoje = data === hoje;
      return `
        <article class="dia">
          <header class="dia__topo">
            <span>${escapar(diaSemana)}</span>
            <span class="dia__data">${formatarData(data)}</span>
            ${ehHoje ? '<span class="selo selo--marca">hoje</span>' : ''}
          </header>
          ${itensDoDia.map((item) => linhaTurno(item, { euId, editavel, passado })).join('')}
        </article>
      `;
    })
    .join('');
}

function linhaTurno(item, { euId, editavel, passado }) {
  const tipo = db.tipo(item.tipo);
  const nomes = item.membroIds.map((id) => db.membro(id)?.nome).filter(Boolean);
  const souEu = item.membroIds.includes(euId);
  const vago = nomes.length === 0;

  const classes = ['turno'];
  if (souEu) classes.push('turno--meu');
  else if (vago) classes.push('turno--vago');
  if (passado) classes.push('turno--passado');

  return `
    <div class="${classes.join(' ')}">
      <div class="turno__info">
        <div class="turno__tipo">
          ${escapar(tipo.apelido || tipo.curto || item.tipo)}
          ${tipo.horaAbertura ? `· abrir ${escapar(tipo.horaAbertura)}` : ''}
        </div>
        <div class="turno__nome">
          ${vago ? '<span class="selo selo--ambar">a definir</span>' : escapar(nomes.join(' e '))}
          ${souEu ? '<span class="selo selo--marca">você</span>' : ''}
        </div>
        ${item.observacao ? `<div class="mini">📝 ${escapar(item.observacao)}</div>` : ''}
      </div>
      ${
        editavel
          ? `<button class="botao botao--pequeno" data-editar="${escapar(item.id)}" type="button">Trocar</button>`
          : ''
      }
    </div>
  `;
}

// Modal para trocar quem abre em um turno.
export function abrirEdicaoTurno({ app, escala, item, aoSalvar }) {
  const tipo = db.tipo(item.tipo);
  const prefs = db.prefs();
  const vagas = Math.max(item.membroIds.length, prefs.pessoasPorEvento || 1);
  const podeTudo = app.ehAdmin;
  const souEnvolvido = item.membroIds.includes(app.eu.id) || item.membroIds.length === 0;

  if (!podeTudo && !souEnvolvido) {
    app.aviso('Só o administrador pode trocar o turno de outro irmão.', 'erro');
    return;
  }

  const opcoes = (selecionado) =>
    [
      `<option value="">— ninguém —</option>`,
      ...db
        .membrosAtivos()
        .map((m) => {
          const impedido = db.estaIndisponivel(m.id, item.data, item.tipo);
          const rotulo = `${m.nome}${impedido ? ' (marcou que não pode)' : ''}`;
          return `<option value="${escapar(m.id)}" ${m.id === selecionado ? 'selected' : ''}>${escapar(rotulo)}</option>`;
        }),
    ].join('');

  const seletores = Array.from({ length: vagas }, (_, i) => {
    const atual = item.membroIds[i] || '';
    return `
      <div class="campo">
        <label for="vaga${i}">Irmão ${vagas > 1 ? i + 1 : ''}</label>
        <select id="vaga${i}" data-vaga="${i}">${opcoes(atual)}</select>
      </div>
    `;
  }).join('');

  app.abrirModal({
    titulo: `${DIAS_SEMANA[paraData(item.data).getDay()]}, ${formatarData(item.data)} — ${tipo.apelido || tipo.curto}`,
    html: `
      <p class="mini">Chegada para abrir: ${escapar(tipo.horaAbertura || '—')}</p>
      ${seletores}
      <div class="campo">
        <label for="observacao">Observação (opcional)</label>
        <input id="observacao" type="text" maxlength="120" placeholder="Ex.: troquei com o Pedro" value="${escapar(item.observacao || '')}" />
      </div>
      <div class="linha-botoes">
        <button class="botao" data-acao="cancelar" type="button">Cancelar</button>
        <button class="botao botao--principal" data-acao="salvar" type="button">Salvar</button>
      </div>
    `,
    montar: (raiz) => {
      raiz.querySelector('[data-acao="cancelar"]').onclick = () => app.fecharModal();
      raiz.querySelector('[data-acao="salvar"]').onclick = async () => {
        const escolhidos = [...raiz.querySelectorAll('select[data-vaga]')]
          .map((s) => s.value)
          .filter(Boolean);
        const unicos = [...new Set(escolhidos)];

        if (!podeTudo && !unicos.includes(app.eu.id) && souEnvolvido && item.membroIds.length) {
          // Um irmão pode se tirar da escala, mas nesse caso precisa deixar
          // registrado quem assume (ou deixar vago de propósito).
          const ok = await app.confirmar(
            'Você vai sair deste turno. Confirma? Avise o grupo para alguém assumir.',
          );
          if (!ok) return;
        }

        const atualizada = {
          ...escala,
          itens: escala.itens.map((i) =>
            i.id === item.id
              ? { ...i, membroIds: unicos, observacao: raiz.querySelector('#observacao').value.trim() }
              : i,
          ),
        };

        try {
          await db.salvarEscala(atualizada);
          app.fecharModal();
          app.aviso('Turno atualizado.', 'ok');
          await aoSalvar?.();
        } catch (erro) {
          app.erro(erro);
        }
      };
    },
  });
}
