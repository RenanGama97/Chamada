// Funções pequenas usadas em vários pontos do app.

export function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

export function formatarDataHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// Captura foco e seleção de um campo de texto antes de o container ser
// redesenhado (innerHTML novo troca o elemento e derrubaria o foco/cursor).
export function capturarFoco(container) {
  const ativo = document.activeElement;
  if (!ativo || !container || !container.contains(ativo) || !ativo.dataset?.acao) return null;
  return {
    acao: ativo.dataset.acao,
    selStart: 'selectionStart' in ativo ? ativo.selectionStart : null,
    selEnd: 'selectionEnd' in ativo ? ativo.selectionEnd : null,
  };
}

export function restaurarFoco(container, foco) {
  if (!foco) return;
  const novo = container.querySelector(`[data-acao="${foco.acao}"]`);
  if (!novo) return;
  novo.focus();
  if (typeof foco.selStart === 'number' && novo.setSelectionRange) {
    try {
      novo.setSelectionRange(foco.selStart, foco.selEnd);
    } catch {
      // campo não suporta seleção (ex.: input type file) — ignora
    }
  }
}
