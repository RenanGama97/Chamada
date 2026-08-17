// Tela de entrada: nome, telefone e e-mail. Sem senha — é um grupo pequeno e
// de confiança. Quem entra primeiro vira administrador do grupo.

import { CONFIG } from '../config.js';
import { MARCA_SVG } from '../marca.js';
import {
  chaveNome,
  emailValido,
  escapar,
  normalizarTelefone,
} from '../util.js';

export const titulo = 'Entrar';

export function render({ db }) {
  const primeiro = db.membros().length === 0;

  return `
    <section class="cartao" style="text-align:center">
      <div class="marca-login">${MARCA_SVG}</div>
      <h2 style="margin-bottom:2px">${escapar(CONFIG.nomeGrupo)}</h2>
      <p class="mini" style="letter-spacing:0.18em;margin-bottom:8px">IECC</p>
      <p class="fraco">Escala dos irmãos que abrem a igreja.</p>
    </section>

    ${
      primeiro
        ? `<div class="cartao cartao--destaque">
             <div class="cartao__titulo">👋 Primeiro acesso</div>
             <p class="fraco" style="margin:0">
               Você é o primeiro a entrar, então ficará como <strong>administrador</strong>:
               poderá cadastrar os irmãos e gerar a escala.
             </p>
           </div>`
        : ''
    }

    <form class="cartao" id="formLogin" novalidate>
      <div class="campo">
        <label for="nome">Nome completo</label>
        <input id="nome" name="nome" type="text" autocomplete="name" placeholder="Ex.: João da Silva" required />
      </div>
      <div class="campo">
        <label for="telefone">Telefone (WhatsApp)</label>
        <input id="telefone" name="telefone" type="tel" autocomplete="tel" placeholder="(11) 99999-9999" required />
      </div>
      <div class="campo">
        <label for="email">E-mail</label>
        <input id="email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="voce@email.com" required />
      </div>
      <button class="botao botao--principal botao--bloco" type="submit">Entrar</button>
      <p class="mini" style="margin:12px 0 0; text-align:center">
        Se você já se cadastrou antes, use o mesmo e-mail para voltar ao seu cadastro.
      </p>
    </form>
  `;
}

export function montar(raiz, { app, db }) {
  const formulario = raiz.querySelector('#formLogin');

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const nome = formulario.nome.value.trim();
    const telefone = normalizarTelefone(formulario.telefone.value);
    const email = formulario.email.value.trim().toLowerCase();

    if (nome.length < 3) return app.aviso('Escreva o seu nome.', 'erro');
    if (telefone.replace(/\D/g, '').length < 12) {
      return app.aviso('Informe o telefone com DDD.', 'erro');
    }
    if (!emailValido(email)) return app.aviso('Confira o e-mail.', 'erro');

    const botao = formulario.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Entrando…';

    try {
      const existente =
        db.estado.membros.find((m) => m.email && m.email === email) ||
        db.estado.membros.find((m) => chaveNome(m.nome) === chaveNome(nome));

      let membro;
      if (existente) {
        // Aproveita para atualizar contato e reativar quem voltou.
        membro = { ...existente, nome, telefone, email, ativo: true };
        await db.salvarMembro(membro);
        app.aviso(`Bem-vindo de volta, ${nome.split(' ')[0]}!`, 'ok');
      } else {
        const primeiro = db.membros().length === 0;
        membro = db.novoMembro({ nome, telefone, email, admin: primeiro });
        await db.salvarMembro(membro);
        app.aviso('Cadastro feito! Você já está na lista.', 'ok');
      }

      await app.entrar(membro);
    } catch (erro) {
      app.erro(erro);
      botao.disabled = false;
      botao.textContent = 'Entrar';
    }
  });
}
