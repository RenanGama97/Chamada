// Lê os dados exportados do SAP em dois formatos:
//   - arquivo (.xlsx, .xls, .csv, .txt) via SheetJS
//   - texto colado direto da grade do SAP/Excel (colunas separadas por tab, ; ou ,)
//
// As duas formas terminam no mesmo lugar: uma matriz de linhas, que vira
// { headers, linhas }. Isso deixa o resto do app (tabela, filtro de status
// etc.) igual não importa de onde os dados vieram.

function normalizarCabecalhos(cabecalhos) {
  const vistos = new Map();
  return cabecalhos.map((valor, indice) => {
    const nome = String(valor ?? '').trim() || `Coluna ${indice + 1}`;
    const vezes = vistos.get(nome) || 0;
    vistos.set(nome, vezes + 1);
    return vezes > 0 ? `${nome} (${vezes + 1})` : nome;
  });
}

// Exportações do SAP às vezes trazem uma linha de título antes do cabeçalho
// de verdade (uma linha com só uma célula preenchida). Pula essas linhas.
function linhasParaObjetos(matriz) {
  const indiceCabecalho = matriz.findIndex(
    (linha) => linha.filter((v) => String(v ?? '').trim() !== '').length > 1,
  );
  const inicio = indiceCabecalho === -1 ? 0 : indiceCabecalho;
  const [cabecalhosBrutos, ...resto] = matriz.slice(inicio);
  if (!cabecalhosBrutos) return { headers: [], linhas: [] };

  const headers = normalizarCabecalhos(cabecalhosBrutos);
  const linhas = resto
    .filter((linha) => linha.some((v) => String(v ?? '').trim() !== ''))
    .map((linha) => Object.fromEntries(headers.map((h, i) => [h, linha[i] ?? ''])));
  return { headers, linhas };
}

export async function lerArquivo(arquivo) {
  if (!window.XLSX) {
    throw new Error(
      'O leitor de arquivos (XLSX) não carregou — tente colar os dados em vez de enviar o arquivo.',
    );
  }
  const buffer = await arquivo.arrayBuffer();
  const livro = window.XLSX.read(buffer, { type: 'array', cellDates: true });
  const planilha = livro.Sheets[livro.SheetNames[0]];
  const matriz = window.XLSX.utils.sheet_to_json(planilha, {
    header: 1,
    raw: false,
    defval: '',
  });
  return linhasParaObjetos(matriz);
}

function detectarDelimitador(linha) {
  const candidatos = ['\t', ';', ','];
  let melhor = candidatos[0];
  let melhorContagem = -1;
  for (const candidato of candidatos) {
    const contagem = linha.split(candidato).length;
    if (contagem > melhorContagem) {
      melhor = candidato;
      melhorContagem = contagem;
    }
  }
  return melhor;
}

export function lerTextoColado(texto) {
  const linhas = texto
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((linha) => linha.trim() !== '');
  if (!linhas.length) return { headers: [], linhas: [] };

  const delimitador = detectarDelimitador(linhas[0]);
  const matriz = linhas.map((linha) => linha.split(delimitador));
  return linhasParaObjetos(matriz);
}
