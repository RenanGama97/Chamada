// Guarda os dados importados de cada transação (fonte) no navegador.
//
// Cada fonte é identificada por uma chave (ex.: "mb52") e guarda:
//   { headers: string[], linhas: object[], nomeArquivo: string|null, importadoEm: string }
//
// Por enquanto tudo fica só neste navegador (localStorage). Se no futuro
// o portal precisar mostrar os mesmos dados pra todo mundo do time, dá pra
// trocar esta camada por um backend compartilhado sem mexer no resto do app.

const CHAVE = 'portal-engenharia:fontes:v1';

function lerTudo() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? JSON.parse(bruto) : {};
  } catch (erro) {
    console.warn('Não foi possível ler os dados salvos:', erro);
    return {};
  }
}

function gravarTudo(tudo) {
  localStorage.setItem(CHAVE, JSON.stringify(tudo));
}

export const fontes = {
  obter(chave) {
    return lerTudo()[chave] || null;
  },

  salvar(chave, dataset) {
    const tudo = lerTudo();
    tudo[chave] = dataset;
    gravarTudo(tudo);
  },

  limpar(chave) {
    const tudo = lerTudo();
    delete tudo[chave];
    gravarTudo(tudo);
  },
};
