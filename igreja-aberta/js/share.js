// Monta e compartilha o texto da escala (WhatsApp, "compartilhar" do celular
// ou simplesmente copiar).

import { CONFIG } from './config.js';
import { db } from './store.js';
import { DIAS_SEMANA, formatarData, nomeMes, paraData } from './util.js';

const SIGLAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export function textoDaEscala(escala, { comAvisos = true } = {}) {
  const titulo = `*ESCALA — ${CONFIG.nomeGrupo.toUpperCase()}*`;
  const linhas = [titulo, `🗓️ ${nomeMes(escala.periodo).toUpperCase()}`, ''];

  const porData = new Map();
  for (const item of [...escala.itens].sort((a, b) => a.data.localeCompare(b.data))) {
    if (!porData.has(item.data)) porData.set(item.data, []);
    porData.get(item.data).push(item);
  }

  for (const [data, itens] of porData) {
    const sigla = SIGLAS[paraData(data).getDay()];
    linhas.push(`*${sigla} ${formatarData(data)}*`);
    for (const item of itens.sort((a, b) => a.tipo.localeCompare(b.tipo))) {
      const tipo = db.tipo(item.tipo);
      const nomes = item.membroIds
        .map((id) => db.membro(id)?.nome)
        .filter(Boolean)
        .join(' e ');
      const chegada = tipo.horaAbertura ? ` (abrir ${tipo.horaAbertura})` : '';
      linhas.push(`• ${tipo.apelido || tipo.curto}${chegada}: ${nomes || '⚠️ A DEFINIR'}`);
    }
    linhas.push('');
  }

  if (comAvisos) {
    const vagos = escala.itens.filter((i) => !i.membroIds.length).length;
    if (vagos) {
      linhas.push(`⚠️ ${vagos} horário(s) ainda sem irmão definido.`, '');
    }
    linhas.push('_Se precisar trocar, avise pelo app ou aqui no grupo._');
  }

  return linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function textoDoLembrete(item) {
  const tipo = db.tipo(item.tipo);
  const dia = DIAS_SEMANA[paraData(item.data).getDay()];
  return `${dia} (${formatarData(item.data)}) — ${tipo.label}. Chegar às ${tipo.horaAbertura} para abrir a igreja.`;
}

export async function compartilhar(texto) {
  if (navigator.share) {
    try {
      await navigator.share({ text: texto });
      return 'compartilhado';
    } catch (erro) {
      if (erro.name === 'AbortError') return 'cancelado';
    }
  }
  return copiar(texto) ? 'copiado' : 'falhou';
}

export function abrirWhatsApp(texto) {
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
}

export function copiar(texto) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(texto).catch(() => copiarAntigo(texto));
    return true;
  }
  return copiarAntigo(texto);
}

function copiarAntigo(texto) {
  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}
