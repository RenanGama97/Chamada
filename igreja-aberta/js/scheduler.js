// Geração automática da escala.
//
// Regras aplicadas, em ordem de importância:
//   1. Ninguém entra em dia que marcou como indisponível.
//   2. Ninguém abre dois cultos no mesmo dia.
//   3. Quem tem menos escalas até agora entra primeiro (divisão justa).
//   4. Se possível, evita escalar a mesma pessoa duas vezes na mesma semana.
//   5. Só entra em cultos que a pessoa marcou que participa.

import { datasDoDiaSemana, diffDias, uid } from './util.js';

// Monta a lista de eventos (data + tipo) de um intervalo.
export function eventosDoIntervalo(inicioISO, fimISO, tipos) {
  const eventos = [];
  for (const tipo of tipos) {
    for (const data of datasDoDiaSemana(inicioISO, fimISO, tipo.diaSemana)) {
      eventos.push({ data, tipo: tipo.chave });
    }
  }
  return eventos.sort(
    (a, b) => a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo),
  );
}

// Quantas vezes cada irmão já foi escalado, olhando escalas anteriores.
// Serve para a próxima escala continuar de onde a anterior parou.
function historicoDeCargas(escalas, antesDe) {
  const cargas = new Map();
  const ultimaData = new Map();
  for (const escala of escalas) {
    for (const item of escala.itens) {
      if (antesDe && item.data >= antesDe) continue;
      for (const membroId of item.membroIds) {
        cargas.set(membroId, (cargas.get(membroId) || 0) + 1);
        const anterior = ultimaData.get(membroId);
        if (!anterior || item.data > anterior) ultimaData.set(membroId, item.data);
      }
    }
  }
  return { cargas, ultimaData };
}

/**
 * Gera os itens da escala.
 *
 * @param {object} params
 * @param {Array}  params.membros            irmãos ativos
 * @param {Array}  params.indisponibilidades registros {membroId, data}
 * @param {Array}  params.escalasAnteriores  para continuar a divisão justa
 * @param {string} params.inicio             data ISO inicial
 * @param {string} params.fim                data ISO final
 * @param {Array}  params.tipos              tipos de culto ativos
 * @param {number} params.pessoasPorEvento
 * @param {boolean} params.evitarRepetirNaSemana
 * @param {Map}    [params.fixos]            "data|tipo" -> [membroIds] a manter
 */
export function gerarEscala({
  membros,
  indisponibilidades,
  escalasAnteriores = [],
  inicio,
  fim,
  tipos,
  pessoasPorEvento = 1,
  evitarRepetirNaSemana = true,
  fixos = new Map(),
}) {
  const eventos = eventosDoIntervalo(inicio, fim, tipos);
  const disponiveis = membros.filter((m) => m.ativo);

  // "membroId|data|tipo" para um culto específico e "membroId|data|*" para o
  // dia inteiro.
  const bloqueios = new Set(
    indisponibilidades.map((d) => `${d.membroId}|${d.data}|${d.tipo || '*'}`),
  );
  const estaBloqueado = (membroId, data, tipo) =>
    bloqueios.has(`${membroId}|${data}|*`) || bloqueios.has(`${membroId}|${data}|${tipo}`);

  const { cargas, ultimaData } = historicoDeCargas(escalasAnteriores, inicio);
  for (const m of disponiveis) {
    if (!cargas.has(m.id)) cargas.set(m.id, 0);
  }

  const itens = [];
  const avisos = [];
  // Desempate estável, mas que muda a cada geração para não viciar a ordem.
  const sorteio = new Map(disponiveis.map((m) => [m.id, Math.random()]));

  for (const evento of eventos) {
    const chaveEvento = `${evento.data}|${evento.tipo}`;
    const escolhidos = [...(fixos.get(chaveEvento) || [])];

    while (escolhidos.length < pessoasPorEvento) {
      const candidatos = disponiveis.filter((m) => {
        if (escolhidos.includes(m.id)) return false;
        if (!m.tipos.includes(evento.tipo)) return false;
        if (estaBloqueado(m.id, evento.data, evento.tipo)) return false;
        // já está escalado em outro culto no mesmo dia
        const jaNoDia = itens.some(
          (i) => i.data === evento.data && i.membroIds.includes(m.id),
        );
        return !jaNoDia;
      });

      if (!candidatos.length) break;

      candidatos.sort((a, b) => {
        const pesoA = cargas.get(a.id) + penalidadeSemana(a.id, evento.data);
        const pesoB = cargas.get(b.id) + penalidadeSemana(b.id, evento.data);
        if (pesoA !== pesoB) return pesoA - pesoB;
        const ultA = ultimaData.get(a.id) || '';
        const ultB = ultimaData.get(b.id) || '';
        if (ultA !== ultB) return ultA.localeCompare(ultB); // quem faz mais tempo primeiro
        return sorteio.get(a.id) - sorteio.get(b.id);
      });

      const escolhido = candidatos[0];
      escolhidos.push(escolhido.id);
      cargas.set(escolhido.id, cargas.get(escolhido.id) + 1);
      ultimaData.set(escolhido.id, evento.data);
    }

    if (escolhidos.length < pessoasPorEvento) {
      avisos.push({
        data: evento.data,
        tipo: evento.tipo,
        mensagem:
          escolhidos.length === 0
            ? 'Nenhum irmão disponível nesta data'
            : `Faltou ${pessoasPorEvento - escolhidos.length} irmão(s) disponível(is)`,
      });
    }

    itens.push({
      id: uid('item'),
      data: evento.data,
      tipo: evento.tipo,
      membroIds: escolhidos,
      observacao: '',
    });
  }

  return { itens, avisos, resumo: resumoDeCargas(itens, membros) };

  // Soma um pequeno peso a quem já abriu nos últimos 6 dias, para espaçar
  // os turnos sem impedir a escala quando não houver outra opção.
  function penalidadeSemana(membroId, dataEvento) {
    if (!evitarRepetirNaSemana) return 0;
    const ultima = ultimaData.get(membroId);
    if (!ultima) return 0;
    return Math.abs(diffDias(dataEvento, ultima)) <= 6 ? 0.6 : 0;
  }
}

// Quantas vezes cada irmão aparece na escala gerada.
export function resumoDeCargas(itens, membros) {
  const contagem = new Map(membros.map((m) => [m.id, 0]));
  for (const item of itens) {
    for (const id of item.membroIds) {
      contagem.set(id, (contagem.get(id) || 0) + 1);
    }
  }
  return [...contagem.entries()]
    .map(([membroId, total]) => ({
      membroId,
      total,
      nome: membros.find((m) => m.id === membroId)?.nome || '—',
    }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
}
