// Edge Function "notificar-atualizacao" — avisa TODOS os irmãos inscritos
// que saiu uma versão nova do app, mesmo com o app fechado.
//
// Quem chama essa função é o próprio GitHub Actions, automaticamente, depois
// de publicar uma versão com número novo (veja .github/workflows/pages.yml).
// Não precisa agendar nada no Supabase — ao contrário da "lembretes", essa
// não roda sozinha todo dia, só quando é chamada.
//
// Segredos necessários (os mesmos da função "lembretes" — se ela já está
// configurada, essa já funciona sem repetir nada):
//   VAPID_PUBLIC_KEY    a mesma chave pública que está em js/config.js
//   VAPID_PRIVATE_KEY   a chave privada (essa não sai do painel)
//   VAPID_SUBJECT       ex.: mailto:secretaria@suaigreja.com
//
// Já vêm prontas do próprio Supabase: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.

import { enviarPush, type Inscricao } from './push.ts';

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!;
const CHAVE_SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const VAPID = {
  publica: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  privada: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
  assunto: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:igreja@exemplo.com',
};

async function api(caminho: string, init: RequestInit = {}) {
  const resposta = await fetch(`${URL_SUPABASE}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: CHAVE_SERVICO,
      Authorization: `Bearer ${CHAVE_SERVICO}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!resposta.ok) {
    throw new Error(`${caminho} -> ${resposta.status} ${await resposta.text()}`);
  }
  return resposta.status === 204 ? null : await resposta.json();
}

Deno.serve(async (req) => {
  try {
    if (!VAPID.publica || !VAPID.privada) {
      return Response.json(
        { erro: 'Faltam os segredos VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY.' },
        { status: 500 },
      );
    }

    // O número da versão é opcional — só deixa a mensagem mais específica.
    let versao = '';
    try {
      const corpo = await req.json();
      if (typeof corpo?.versao === 'string') versao = corpo.versao;
    } catch {
      // sem corpo, ou corpo que não é JSON: tudo bem, avisa sem o número
    }

    const inscricoes: Inscricao[] = await api('push_inscricoes?select=endpoint,p256dh,auth');

    const conteudo = JSON.stringify({
      titulo: '🔔 Olá, irmão!',
      corpo: versao
        ? `Tem atualização nova no app Igreja Aberta (versão ${versao}). Abra o aplicativo!`
        : 'Tem atualização nova no app Igreja Aberta. Abra o aplicativo!',
      // tag fixa: se o irmão ainda não tiver aberto desde a última vez, a
      // notificação nova substitui a antiga em vez de empilhar duas.
      tag: 'atualizacao',
      url: './',
    });

    let enviados = 0;
    let falhas = 0;
    let expiradas = 0;

    for (const inscricao of inscricoes) {
      try {
        const status = await enviarPush({ inscricao, payload: conteudo, vapid: VAPID });

        if (status >= 200 && status < 300) {
          enviados++;
        } else if (status === 404 || status === 410) {
          // inscrição expirada (app desinstalado, permissão revogada)
          expiradas++;
          await api(`push_inscricoes?endpoint=eq.${encodeURIComponent(inscricao.endpoint)}`, {
            method: 'DELETE',
          });
        } else {
          falhas++;
          console.error(`push de atualização: HTTP ${status}`);
        }
      } catch (erro) {
        falhas++;
        console.error('push de atualização:', erro);
      }
    }

    const resumo = {
      versao: versao || null,
      inscricoes: inscricoes.length,
      enviados,
      falhas,
      inscricoesExpiradas: expiradas,
    };
    console.log('notificar-atualizacao', resumo);
    return Response.json(resumo);
  } catch (erro) {
    console.error(erro);
    return Response.json({ erro: String(erro) }, { status: 500 });
  }
});
