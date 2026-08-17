// Tela do administrador: cadastro dos irmãos do grupo "Igreja Aberta".

import { db } from '../store.js';
import {
  emailValido,
  escapar,
  formatarTelefone,
  hojeISO,
  iniciais,
  normalizarTelefone,
} from '../util.js';

export const titulo = 'Irmãos';

export function render({ eu }) {
  const membros = db.membros();
  const cargas = contarTurnos();
  const maior = Math.max(1, ...cargas.values());
  const hoje = hojeISO();

  return `
    <div class="cartao">
      <div class="cartao__titulo">
        <span>👥 ${membros.length} cadastrado(s)</span>
        <button class="botao botao--pequeno botao--principal" data-acao="novo" type="button">+ Adicionar</button>
      </div>
      <p class="fraco" style="margin:0">
        Quem entra pelo app se cadastra sozinho. Você pode corrigir dados,
        marcar quem está de licença e definir outros administradores.
      </p>
    </div>

    ${
      membros.length
        ? `<div class="cartao">
            ${membros
              .map((m) => {
                const turnos = cargas.get(m.id) || 0;
                const bloqueios = db
                  .indisponibilidades(m.id)
                  .filter((d) => d.data >= hoje).length;
                return `
                  <div class="pessoa">
                    <div class="pessoa__bola">${escapar(iniciais(m.nome))}</div>
                    <div class="pessoa__info">
                      <div class="pessoa__nome">
                        ${escapar(m.nome)}
                        ${m.id === eu.id ? '<span class="selo selo--marca">você</span>' : ''}
                        ${m.admin ? '<span class="selo selo--verde">adm</span>' : ''}
                        ${m.ativo ? '' : '<span class="selo">de licença</span>'}
                      </div>
                      <div class="mini">
                        ${escapar(formatarTelefone(m.telefone))} · ${turnos} turno(s)
                        ${bloqueios ? ` · ${bloqueios} dia(s) marcado(s)` : ''}
                      </div>
                      <div class="barra"><div class="barra__preenchida" style="width:${(turnos / maior) * 100}%"></div></div>
                    </div>
                    <button class="botao botao--pequeno" data-editar="${escapar(m.id)}" type="button">Editar</button>
                  </div>
                `;
              })
              .join('')}
           </div>`
        : `<div class="cartao vazio">
             <span class="vazio__icone">👥</span>
             Nenhum irmão cadastrado ainda.
           </div>`
    }

    <p class="mini" style="text-align:center">
      A barra mostra quantos turnos cada um já teve nas escalas salvas — é o que
      o app usa para dividir de forma justa.
    </p>
  `;
}

export function montar(raiz, { app, eu }) {
  raiz.querySelector('[data-acao="novo"]').onclick = () => abrirFormulario({ app, eu });

  raiz.querySelectorAll('[data-editar]').forEach((botao) => {
    botao.onclick = () =>
      abrirFormulario({ app, eu, membro: db.membro(botao.dataset.editar) });
  });
}

function abrirFormulario({ app, eu, membro = null }) {
  const editando = Boolean(membro);
  const tipos = db.tiposAtivos();
  const atual = membro || {
    id: null,
    nome: '',
    telefone: '',
    email: '',
    admin: false,
    ativo: true,
    tipos: tipos.map((t) => t.chave),
  };

  app.abrirModal({
    titulo: editando ? 'Editar irmão' : 'Novo irmão',
    html: `
      <div class="campo">
        <label for="fNome">Nome completo</label>
        <input type="text" id="fNome" value="${escapar(atual.nome)}" />
      </div>
      <div class="campo">
        <label for="fTelefone">Telefone (WhatsApp)</label>
        <input type="tel" id="fTelefone" value="${escapar(formatarTelefone(atual.telefone))}" />
      </div>
      <div class="campo">
        <label for="fEmail">E-mail</label>
        <input type="email" id="fEmail" value="${escapar(atual.email)}" />
      </div>

      <div class="campo">
        <label>Participa de quais cultos</label>
        ${tipos
          .map(
            (t) => `
              <label class="escolha">
                <input type="checkbox" data-tipo="${escapar(t.chave)}" ${atual.tipos.includes(t.chave) ? 'checked' : ''} />
                ${escapar(t.label)}
              </label>`,
          )
          .join('')}
      </div>

      <label class="escolha">
        <input type="checkbox" id="fAtivo" ${atual.ativo ? 'checked' : ''} />
        Disponível para a escala
      </label>
      <label class="escolha">
        <input type="checkbox" id="fAdmin" ${atual.admin ? 'checked' : ''} />
        É administrador (gera a escala)
      </label>

      <div class="linha-botoes" style="margin-top:14px">
        <button class="botao" data-acao="cancelar" type="button">Cancelar</button>
        <button class="botao botao--principal" data-acao="salvar" type="button">Salvar</button>
      </div>
      ${
        editando && atual.id !== eu.id
          ? `<button class="botao botao--perigo botao--bloco" data-acao="excluir" type="button" style="margin-top:8px">
               Excluir cadastro
             </button>`
          : ''
      }
    `,
    montar: (raiz) => {
      raiz.querySelector('[data-acao="cancelar"]').onclick = () => app.fecharModal();

      raiz.querySelector('[data-acao="salvar"]').onclick = async () => {
        const nome = raiz.querySelector('#fNome').value.trim();
        const telefone = normalizarTelefone(raiz.querySelector('#fTelefone').value);
        const email = raiz.querySelector('#fEmail').value.trim().toLowerCase();
        const tiposEscolhidos = [...raiz.querySelectorAll('[data-tipo]')]
          .filter((c) => c.checked)
          .map((c) => c.dataset.tipo);

        if (nome.length < 3) return app.aviso('Escreva o nome.', 'erro');
        if (email && !emailValido(email)) return app.aviso('Confira o e-mail.', 'erro');
        if (!tiposEscolhidos.length) {
          return app.aviso('Marque pelo menos um culto.', 'erro');
        }

        const dados = editando
          ? { ...membro }
          : db.novoMembro({ nome, telefone, email });

        Object.assign(dados, {
          nome,
          telefone,
          email,
          tipos: tiposEscolhidos,
          ativo: raiz.querySelector('#fAtivo').checked,
          admin: raiz.querySelector('#fAdmin').checked,
        });

        // Evita o grupo ficar sem nenhum administrador.
        const outrosAdmins = db
          .membros()
          .filter((m) => m.admin && m.id !== dados.id).length;
        if (!dados.admin && outrosAdmins === 0) {
          return app.aviso('O grupo precisa de pelo menos um administrador.', 'erro');
        }

        try {
          await db.salvarMembro(dados);
          app.fecharModal();
          app.aviso('Cadastro salvo.', 'ok');
          await app.recarregar();
        } catch (erro) {
          app.erro(erro);
        }
      };

      raiz.querySelector('[data-acao="excluir"]')?.addEventListener('click', async () => {
        const ok = await app.confirmar(
          `Excluir o cadastro de ${membro.nome}? As marcações de indisponibilidade dele também serão apagadas.`,
          { textoOk: 'Excluir', perigo: true },
        );
        if (!ok) return;
        try {
          await db.removerMembro(membro.id);
          app.fecharModal();
          app.aviso('Cadastro excluído.', 'ok');
          await app.recarregar();
        } catch (erro) {
          app.erro(erro);
        }
      });
    },
  });
}

// Quantos turnos cada irmão já teve, somando todas as escalas salvas.
function contarTurnos() {
  const contagem = new Map();
  for (const escala of db.escalas()) {
    for (const item of escala.itens) {
      for (const id of item.membroIds) {
        contagem.set(id, (contagem.get(id) || 0) + 1);
      }
    }
  }
  return contagem;
}
