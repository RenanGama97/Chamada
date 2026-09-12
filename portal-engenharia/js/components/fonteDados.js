// Bloco reutilizável: import (arquivo ou colar) + busca + tabela ordenável
// para uma transação do SAP (ex.: MB52, ZMMR075). Cada instância se
// desenha e se religa sozinha dentro do elemento recebido em montarFonte,
// então várias podem conviver na mesma tela sem interferir uma na outra.

import { fontes } from '../store.js';
import { lerArquivo, lerTextoColado } from '../importar.js';
import { escapar, formatarDataHora, capturarFoco, restaurarFoco } from '../util.js';

const estados = new Map();

function estadoDe(chave) {
  if (!estados.has(chave)) {
    estados.set(chave, {
      busca: '',
      ordenarPor: null,
      ordemAsc: true,
      modoImportar: 'arquivo',
      somentePendentes: true,
    });
  }
  return estados.get(chave);
}

function normalizaTexto(v) {
  return String(v ?? '').toLowerCase();
}

function ehPendente(linha, campoStatus) {
  return campoStatus != null && Number(linha[campoStatus]) === 2;
}

function encontrarCampoStatus(headers) {
  return headers.find((h) => h.trim().toLowerCase() === 'status') || null;
}

function linhasFiltradas(dataset, estado, campoStatus) {
  let linhas = dataset.linhas;
  if (campoStatus && estado.somentePendentes) {
    linhas = linhas.filter((linha) => ehPendente(linha, campoStatus));
  }
  if (estado.busca.trim()) {
    const alvo = normalizaTexto(estado.busca);
    linhas = linhas.filter((linha) => Object.values(linha).some((v) => normalizaTexto(v).includes(alvo)));
  }
  if (estado.ordenarPor) {
    const campo = estado.ordenarPor;
    linhas = [...linhas].sort((a, b) => {
      const cmp = normalizaTexto(a[campo]).localeCompare(normalizaTexto(b[campo]), 'pt-BR', {
        numeric: true,
      });
      return estado.ordemAsc ? cmp : -cmp;
    });
  }
  return linhas;
}

function renderTabela(headers, linhas, estado, campoStatus) {
  if (!headers.length) return '<p class="vazio">Nenhum dado importado ainda.</p>';
  if (!linhas.length) return '<p class="vazio">Nenhuma linha encontrada com esse filtro.</p>';

  return `
    <table class="tabela">
      <thead>
        <tr>
          ${headers
            .map((h) => {
              const seta = estado.ordenarPor === h ? (estado.ordemAsc ? ' ▲' : ' ▼') : '';
              return `<th data-acao="ordenar" data-campo="${escapar(h)}">${escapar(h)}${seta}</th>`;
            })
            .join('')}
        </tr>
      </thead>
      <tbody>
        ${linhas
          .map(
            (linha) => `
              <tr>
                ${headers
                  .map((h) => {
                    const valor = linha[h];
                    if (h === campoStatus) {
                      const pendente = ehPendente(linha, campoStatus);
                      return `<td><span class="status-badge ${pendente ? 'status-badge--pendente' : ''}">${escapar(valor)}</span></td>`;
                    }
                    return `<td>${escapar(valor)}</td>`;
                  })
                  .join('')}
              </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function renderFonte(opts) {
  const { chave, titulo, descricao, comPendentes } = opts;
  const estado = estadoDe(chave);
  const dataset = fontes.obter(chave);
  const headers = dataset?.headers || [];
  const campoStatus = comPendentes && dataset ? encontrarCampoStatus(headers) : null;
  const totalLinhas = dataset?.linhas.length || 0;
  const totalPendentes = campoStatus ? dataset.linhas.filter((l) => ehPendente(l, campoStatus)).length : 0;
  const linhas = dataset ? linhasFiltradas(dataset, estado, campoStatus) : [];

  return `
    <section class="fonte" data-chave="${escapar(chave)}">
      <div class="fonte__cabecalho">
        <div>
          <h3 class="fonte__titulo">${escapar(titulo)}</h3>
          ${descricao ? `<p class="fonte__descricao">${escapar(descricao)}</p>` : ''}
        </div>
        ${
          dataset
            ? `<div class="fonte__meta">
                <span>${totalLinhas} linha${totalLinhas === 1 ? '' : 's'}</span>
                <span>importado em ${escapar(formatarDataHora(dataset.importadoEm))}</span>
                <button class="botao botao--texto" data-acao="limpar" type="button">Remover dados</button>
              </div>`
            : ''
        }
      </div>

      ${
        comPendentes && dataset && !campoStatus
          ? `<p class="aviso-inline aviso-inline--alerta">
              Coluna "Status" não encontrada neste arquivo — mostrando todas as linhas, sem separar pendentes.
            </p>`
          : ''
      }

      <div class="fonte__importar">
        <div class="abas-mini">
          <button class="aba-mini ${estado.modoImportar === 'arquivo' ? 'aba-mini--ativa' : ''}" data-acao="modo-arquivo" type="button">Arquivo</button>
          <button class="aba-mini ${estado.modoImportar === 'colar' ? 'aba-mini--ativa' : ''}" data-acao="modo-colar" type="button">Colar dados</button>
        </div>
        ${
          estado.modoImportar === 'arquivo'
            ? `<input class="entrada-arquivo" data-acao="arquivo" type="file" accept=".xlsx,.xls,.csv,.txt" />`
            : `<textarea class="entrada-colar" data-acao="colar-texto" rows="4" placeholder="Cole aqui as linhas copiadas do Excel ou da grade do SAP (com o cabeçalho na primeira linha)"></textarea>
               <button class="botao botao--principal" data-acao="colar-confirmar" type="button">Importar texto colado</button>`
        }
      </div>

      ${
        dataset
          ? `<div class="fonte__ferramentas">
              <input class="entrada-busca" data-acao="busca" type="search" placeholder="Buscar em ${totalLinhas} linhas…" value="${escapar(estado.busca)}" />
              ${
                campoStatus
                  ? `<label class="alternador">
                      <input type="checkbox" data-acao="pendentes" ${estado.somentePendentes ? 'checked' : ''} />
                      Somente pendentes (Status 02) — ${totalPendentes}
                    </label>`
                  : ''
              }
            </div>
            <div class="fonte__tabela-wrap">${renderTabela(headers, linhas, estado, campoStatus)}</div>`
          : `<p class="vazio">Nenhum dado importado ainda.</p>`
      }
    </section>
  `;
}

export function montarFonte(container, opts, ctx) {
  const estado = estadoDe(opts.chave);

  function desenhar() {
    const foco = capturarFoco(container);
    container.innerHTML = renderFonte(opts);
    ligarEventos();
    restaurarFoco(container, foco);
  }

  function ligarEventos() {
    container.querySelector('[data-acao="modo-arquivo"]').onclick = () => {
      estado.modoImportar = 'arquivo';
      desenhar();
    };
    container.querySelector('[data-acao="modo-colar"]').onclick = () => {
      estado.modoImportar = 'colar';
      desenhar();
    };

    const entradaArquivo = container.querySelector('[data-acao="arquivo"]');
    if (entradaArquivo) {
      entradaArquivo.onchange = async () => {
        const arquivo = entradaArquivo.files?.[0];
        if (!arquivo) return;
        try {
          const { headers, linhas } = await lerArquivo(arquivo);
          fontes.salvar(opts.chave, {
            headers,
            linhas,
            nomeArquivo: arquivo.name,
            importadoEm: new Date().toISOString(),
          });
          ctx.app.aviso(`"${arquivo.name}" importado: ${linhas.length} linha(s).`);
          desenhar();
        } catch (erro) {
          ctx.app.erro(erro);
        }
      };
    }

    const botaoColarConfirmar = container.querySelector('[data-acao="colar-confirmar"]');
    if (botaoColarConfirmar) {
      botaoColarConfirmar.onclick = () => {
        const textarea = container.querySelector('[data-acao="colar-texto"]');
        const texto = textarea?.value || '';
        if (!texto.trim()) return;
        try {
          const { headers, linhas } = lerTextoColado(texto);
          fontes.salvar(opts.chave, {
            headers,
            linhas,
            nomeArquivo: null,
            importadoEm: new Date().toISOString(),
          });
          ctx.app.aviso(`Dados colados importados: ${linhas.length} linha(s).`);
          desenhar();
        } catch (erro) {
          ctx.app.erro(erro);
        }
      };
    }

    const botaoLimpar = container.querySelector('[data-acao="limpar"]');
    if (botaoLimpar) {
      botaoLimpar.onclick = () => {
        if (!window.confirm(`Remover os dados importados de ${opts.titulo}?`)) return;
        fontes.limpar(opts.chave);
        desenhar();
      };
    }

    const entradaBusca = container.querySelector('[data-acao="busca"]');
    if (entradaBusca) {
      entradaBusca.oninput = () => {
        estado.busca = entradaBusca.value;
        desenhar();
      };
    }

    const alternadorPendentes = container.querySelector('[data-acao="pendentes"]');
    if (alternadorPendentes) {
      alternadorPendentes.onchange = () => {
        estado.somentePendentes = alternadorPendentes.checked;
        desenhar();
      };
    }

    container.querySelectorAll('[data-acao="ordenar"]').forEach((th) => {
      th.onclick = () => {
        const campo = th.dataset.campo;
        if (estado.ordenarPor === campo) estado.ordemAsc = !estado.ordemAsc;
        else {
          estado.ordenarPor = campo;
          estado.ordemAsc = true;
        }
        desenhar();
      };
    });
  }

  desenhar();
}
