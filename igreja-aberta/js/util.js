// Funções utilitárias: datas, textos e ids.

export const DIAS_SEMANA = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado',
];

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function uid(prefixo = 'id') {
  return `${prefixo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Datas são sempre tratadas como texto ISO "AAAA-MM-DD".
// Usamos meio-dia para criar o Date e nunca escorregar de dia por fuso horário.
export function paraData(iso) {
  return new Date(`${iso}T12:00:00`);
}

export function paraISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function hojeISO() {
  return paraISO(new Date());
}

export function somarDias(iso, dias) {
  const d = paraData(iso);
  d.setDate(d.getDate() + dias);
  return paraISO(d);
}

export function diffDias(isoA, isoB) {
  const ms = paraData(isoA).getTime() - paraData(isoB).getTime();
  return Math.round(ms / 86400000);
}

export function formatarData(iso, { comAno = false } = {}) {
  const d = paraData(iso);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return comAno ? `${dia}/${mes}/${d.getFullYear()}` : `${dia}/${mes}`;
}

export function formatarDataLonga(iso) {
  const d = paraData(iso);
  return `${DIAS_SEMANA[d.getDay()]}, ${formatarData(iso)}`;
}

export function nomeMes(periodo) {
  // periodo = "AAAA-MM"
  const [ano, mes] = periodo.split('-').map(Number);
  return `${MESES[mes - 1]} de ${ano}`;
}

export function periodoAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function proximoPeriodo(periodo, passos = 1) {
  const [ano, mes] = periodo.split('-').map(Number);
  const d = new Date(ano, mes - 1 + passos, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function primeiroDiaDoPeriodo(periodo) {
  return `${periodo}-01`;
}

export function ultimoDiaDoPeriodo(periodo) {
  const [ano, mes] = periodo.split('-').map(Number);
  return paraISO(new Date(ano, mes, 0));
}

// Lista todas as datas de um intervalo que caem em um determinado dia da semana.
export function datasDoDiaSemana(inicioISO, fimISO, diaSemana) {
  const datas = [];
  let atual = paraData(inicioISO);
  const fim = paraData(fimISO);
  while (atual.getDay() !== diaSemana && atual <= fim) {
    atual.setDate(atual.getDate() + 1);
  }
  while (atual <= fim) {
    datas.push(paraISO(atual));
    atual.setDate(atual.getDate() + 7);
  }
  return datas;
}

export function primeiroNome(nome = '') {
  return nome.trim().split(/\s+/)[0] || '';
}

export function iniciais(nome = '') {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// Guarda só os dígitos e monta o formato do WhatsApp (55 + DDD + número).
export function normalizarTelefone(valor = '') {
  const digitos = valor.replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.startsWith('55')) return digitos;
  return `55${digitos}`;
}

export function formatarTelefone(valor = '') {
  const d = valor.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor;
}

export function emailValido(valor = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim());
}

export function escapar(texto = '') {
  return String(texto)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Comparação de nomes ignorando acentos e maiúsculas.
export function chaveNome(nome = '') {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}
