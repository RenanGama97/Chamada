// Tela de ajustes: perfil, lembretes, instalação, horários dos cultos,
// sincronização e backup.

import { CONFIG } from '../config.js';
import { db } from '../store.js';
import { notificacoes, proximoTurnoTexto } from '../notifications.js';
import { NOVIDADES, VERSAO } from '../versao.js';
import {
  emailValido,
  escapar,
  formatarTelefone,
  normalizarTelefone,
} from '../util.js';

export const titulo = 'Ajustes';

export function render({ app, eu }) {
  const prefs = db.prefs();
  const tipos = Object.entries(db.tipos());
  const permissao = notificacoes.permissao;
  const proximo = proximoTurnoTexto(eu.id);

  const estadoNotificacao =
    permissao === 'granted'
      ? '<span class="selo selo--verde">ativado</span>'
      : permissao === 'denied'
        ? '<span class="selo selo--vermelho">bloqueado no celular</span>'
        : permissao === 'unsupported'
          ? '<span class="selo">não suportado</span>'
          : '<span class="selo selo--ambar">desativado</span>';

  return `
    <div class="cartao">
      <div class="cartao__titulo">👤 Meu cadastro</div>
      <div class="campo">
        <label for="pNome">Nome</label>
        <input type="text" id="pNome" value="${escapar(eu.nome)}" />
      </div>
      <div class="campo">
        <label for="pTelefone">Telefone (WhatsApp)</label>
        <input type="tel" id="pTelefone" value="${escapar(formatarTelefone(eu.telefone))}" />
      </div>
      <div class="campo">
        <label for="pEmail">E-mail</label>
        <input type="email" id="pEmail" value="${escapar(eu.email)}" />
      </div>
      <div class="campo">
        <label>Participo destes cultos</label>
        ${db
          .tiposAtivos()
          .map(
            (t) => `
              <label class="escolha">
                <input type="checkbox" data-meu-tipo="${escapar(t.chave)}" ${eu.tipos.includes(t.chave) ? 'checked' : ''} />
                ${escapar(t.label)}
              </label>`,
          )
          .join('')}
      </div>
      <label class="escolha">
        <input type="checkbox" id="pAtivo" ${eu.ativo ? 'checked' : ''} />
        Estou disponível para entrar na escala
      </label>
      <button class="botao botao--principal botao--bloco" data-acao="salvar-perfil" type="button">
        Salvar meu cadastro
      </button>
    </div>

    <div class="cartao">
      <div class="cartao__titulo"><span>🔔 Lembretes no celular</span>${estadoNotificacao}</div>
      <p class="fraco" style="margin:0 0 10px">
        O app avisa no dia do seu turno (e um dia antes).
        ${proximo ? `Seu próximo: <strong>${escapar(proximo)}</strong>.` : ''}
      </p>
      <div class="linha-botoes">
        ${
          permissao === 'granted'
            ? '<button class="botao" data-acao="testar-notificacao" type="button">Enviar teste</button>'
            : '<button class="botao botao--principal" data-acao="ativar-notificacao" type="button">Ativar lembretes</button>'
        }
      </div>
      ${
        permissao === 'denied'
          ? `<p class="mini" style="margin-top:8px">
               As notificações estão bloqueadas nas configurações do navegador.
               Abra as permissões do site no celular e libere "Notificações".
             </p>`
          : ''
      }
      ${
        db.modo === 'local'
          ? `<p class="mini" style="margin-top:8px">
               No modo local o aviso aparece quando você abre o app (e em segundo
               plano, se o seu celular permitir). Para receber o aviso mesmo com o
               app fechado, ative a sincronização na nuvem — veja o README.
             </p>`
          : ''
      }
    </div>

    <div class="cartao">
      <div class="cartao__titulo">📲 Instalar no celular</div>
      <p class="fraco" style="margin:0 0 10px">
        Instalando, o app fica com ícone na tela inicial e abre sem o navegador.
      </p>
      <div class="linha-botoes">
        <button class="botao" data-acao="instalar" type="button">Instalar agora</button>
      </div>
      <p class="mini" style="margin-top:8px">
        <strong>Android/Chrome:</strong> menu ⋮ → "Adicionar à tela inicial".<br />
        <strong>iPhone/Safari:</strong> botão Compartilhar → "Adicionar à Tela de Início".
      </p>
    </div>

    ${
      app.ehAdmin
        ? `<div class="cartao">
            <div class="cartao__titulo">⏰ Horários dos cultos</div>
            ${tipos
              .map(
                ([chave, t]) => `
                  <div style="border-top:1px solid var(--borda);padding-top:10px;margin-top:10px">
                    <label class="escolha">
                      <input type="checkbox" data-tipo-ativo="${escapar(chave)}" ${t.ativo !== false ? 'checked' : ''} />
                      <strong>${escapar(t.label)}</strong>
                    </label>
                    <div class="grade-2">
                      <div class="campo">
                        <label for="culto_${escapar(chave)}">Início do culto</label>
                        <input type="time" id="culto_${escapar(chave)}" data-hora-culto="${escapar(chave)}" value="${escapar(t.horaCulto || '')}" />
                      </div>
                      <div class="campo">
                        <label for="abrir_${escapar(chave)}">Chegar para abrir</label>
                        <input type="time" id="abrir_${escapar(chave)}" data-hora-abertura="${escapar(chave)}" value="${escapar(t.horaAbertura || '')}" />
                      </div>
                    </div>
                  </div>`,
              )
              .join('')}
            <div class="campo" style="margin-top:12px">
              <label for="aPessoas">Irmãos por culto (padrão)</label>
              <input type="number" id="aPessoas" min="1" max="5" value="${prefs.pessoasPorEvento || 1}" />
            </div>
            <button class="botao botao--principal botao--bloco" data-acao="salvar-prefs" type="button">
              Salvar horários
            </button>
          </div>`
        : ''
    }

    <div class="cartao">
      <div class="cartao__titulo">
        <span>☁️ Dados do grupo</span>
        <span class="selo ${db.modo === 'nuvem' ? 'selo--verde' : 'selo--ambar'}">
          ${db.modo === 'nuvem' ? (db.online ? 'nuvem' : 'nuvem (offline)') : 'só neste celular'}
        </span>
      </div>
      <p class="fraco" style="margin:0 0 10px">
        ${
          db.modo === 'nuvem'
            ? `Sincronizado com ${escapar(new URL(CONFIG.supabase.url).host)}.`
            : 'Cada celular tem a sua própria cópia. Para todos verem a mesma escala, configure o Supabase (README.md) ou use o backup abaixo.'
        }
      </p>
      <div class="linha-botoes">
        <button class="botao" data-acao="atualizar" type="button">Atualizar dados</button>
        <button class="botao" data-acao="exportar" type="button">Baixar backup</button>
        ${app.ehAdmin ? '<button class="botao" data-acao="importar" type="button">Restaurar backup</button>' : ''}
      </div>
    </div>

    <div class="cartao">
      <div class="cartao__titulo">
        <span>ℹ️ Sobre o app</span>
        <span class="versao-etiqueta">versão ${escapar(VERSAO)}</span>
      </div>
      <p class="fraco" style="margin:0 0 10px">
        As atualizações chegam sozinhas: quando sair uma versão nova, aparece o
        aviso "Atualizar" na tela.
      </p>
      <div class="linha-botoes">
        <button class="botao" data-acao="novidades" type="button">O que há de novo</button>
        <button class="botao" data-acao="procurar-atualizacao" type="button">Procurar atualização</button>
      </div>
    </div>

    <div class="cartao">
      <button class="botao botao--perigo botao--bloco" data-acao="sair" type="button">Sair deste aparelho</button>
      <p class="mini" style="margin:10px 0 0;text-align:center">
        ${escapar(CONFIG.nomeGrupo)} · IECC
      </p>
    </div>
  `;
}

export function montar(raiz, { app, eu }) {
  raiz.querySelector('[data-acao="salvar-perfil"]').onclick = async () => {
    const nome = raiz.querySelector('#pNome').value.trim();
    const telefone = normalizarTelefone(raiz.querySelector('#pTelefone').value);
    const email = raiz.querySelector('#pEmail').value.trim().toLowerCase();
    const tiposEscolhidos = [...raiz.querySelectorAll('[data-meu-tipo]')]
      .filter((c) => c.checked)
      .map((c) => c.dataset.meuTipo);

    if (nome.length < 3) return app.aviso('Escreva o seu nome.', 'erro');
    if (email && !emailValido(email)) return app.aviso('Confira o e-mail.', 'erro');
    if (!tiposEscolhidos.length) return app.aviso('Marque pelo menos um culto.', 'erro');

    try {
      await db.salvarMembro({
        ...eu,
        nome,
        telefone,
        email,
        tipos: tiposEscolhidos,
        ativo: raiz.querySelector('#pAtivo').checked,
      });
      app.aviso('Cadastro salvo.', 'ok');
      await app.recarregar();
    } catch (erro) {
      app.erro(erro);
    }
  };

  raiz.querySelector('[data-acao="ativar-notificacao"]')?.addEventListener('click', async () => {
    const resultado = await notificacoes.pedirPermissao();
    if (resultado === 'granted') {
      await notificacoes.sincronizarLembretes(eu.id);
      await notificacoes.testar();
      app.aviso('Lembretes ativados.', 'ok');
    } else if (resultado === 'denied') {
      app.aviso('O celular bloqueou as notificações deste site.', 'erro');
    } else if (resultado === 'unsupported') {
      app.aviso('Este navegador não suporta notificações.', 'erro');
    }
    app.desenhar();
  });

  raiz.querySelector('[data-acao="testar-notificacao"]')?.addEventListener('click', async () => {
    const ok = await notificacoes.testar();
    if (!ok) app.aviso('Não foi possível enviar o teste.', 'erro');
  });

  raiz.querySelector('[data-acao="instalar"]').onclick = async () => {
    if (app.promptInstalacao) {
      app.promptInstalacao.prompt();
      app.promptInstalacao = null;
    } else {
      app.aviso('Use o menu do navegador: "Adicionar à tela inicial".');
    }
  };

  raiz.querySelector('[data-acao="salvar-prefs"]')?.addEventListener('click', async () => {
    const prefs = structuredClone(db.prefs());
    for (const [chave, tipo] of Object.entries(prefs.tipos)) {
      const ativo = raiz.querySelector(`[data-tipo-ativo="${chave}"]`);
      const culto = raiz.querySelector(`[data-hora-culto="${chave}"]`);
      const abertura = raiz.querySelector(`[data-hora-abertura="${chave}"]`);
      if (ativo) tipo.ativo = ativo.checked;
      if (culto) tipo.horaCulto = culto.value;
      if (abertura) tipo.horaAbertura = abertura.value;
    }
    prefs.pessoasPorEvento = Math.max(
      1,
      Math.min(5, Number(raiz.querySelector('#aPessoas').value || 1)),
    );

    try {
      await db.salvarPrefs(prefs);
      app.aviso('Horários salvos.', 'ok');
      await app.recarregar();
    } catch (erro) {
      app.erro(erro);
    }
  });

  raiz.querySelector('[data-acao="atualizar"]').onclick = async () => {
    try {
      await app.recarregar();
      app.aviso('Dados atualizados.', 'ok');
    } catch (erro) {
      app.erro(erro);
    }
  };

  raiz.querySelector('[data-acao="exportar"]').onclick = () => {
    const conteudo = db.exportar();
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `igreja-aberta-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    app.aviso('Backup baixado.', 'ok');
  };

  raiz.querySelector('[data-acao="importar"]')?.addEventListener('click', () => {
    const entrada = document.createElement('input');
    entrada.type = 'file';
    entrada.accept = 'application/json';
    entrada.onchange = async () => {
      const arquivo = entrada.files?.[0];
      if (!arquivo) return;
      const ok = await app.confirmar(
        'Restaurar o backup? Os cadastros e escalas do arquivo serão somados aos atuais.',
        { textoOk: 'Restaurar' },
      );
      if (!ok) return;
      try {
        await db.importar(await arquivo.text());
        app.aviso('Backup restaurado.', 'ok');
        await app.recarregar();
      } catch (erro) {
        app.erro(erro);
      }
    };
    entrada.click();
  });

  raiz.querySelector('[data-acao="novidades"]').onclick = () => {
    app.abrirModal({
      titulo: '✨ O que há de novo',
      html: `
        ${NOVIDADES.map(
          (n) => `
            <p class="mini" style="margin:12px 0 6px">Versão ${escapar(n.versao)}</p>
            <ul class="novidades">
              ${n.itens.map((i) => `<li>${escapar(i)}</li>`).join('')}
            </ul>`,
        ).join('')}
        <button class="botao botao--principal botao--bloco" data-acao="ok" type="button" style="margin-top:16px">
          Fechar
        </button>
      `,
      montar: (caixa) => {
        caixa.querySelector('[data-acao="ok"]').onclick = () => app.fecharModal();
      },
    });
  };

  raiz.querySelector('[data-acao="procurar-atualizacao"]').onclick = async () => {
    const registro = await navigator.serviceWorker?.getRegistration();
    if (!registro) return app.aviso('Este navegador não guarda o app offline.', 'erro');
    await registro.update().catch(() => {});
    setTimeout(() => {
      if (registro.waiting) app.aviso('Versão nova encontrada! Toque em "Atualizar".', 'ok');
      else app.aviso('Você já está na versão mais recente.', 'ok');
    }, 1200);
  };

  raiz.querySelector('[data-acao="sair"]').onclick = async () => {
    const ok = await app.confirmar('Sair do app neste aparelho?', { textoOk: 'Sair' });
    if (ok) app.sair();
  };
}
