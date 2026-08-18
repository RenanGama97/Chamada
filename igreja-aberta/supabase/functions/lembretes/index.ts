// Edge Function "lembretes" — avisa no celular quem abre a igreja hoje e
// quem abre amanhã, mesmo com o app fechado.
//
// Roda no Supabase (Deno) uma vez por dia, chamada pelo agendamento do banco.
// Não depende de nenhuma biblioteca: o envio do push está em push.ts.
//
// Segredos necessários (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY    a mesma chave pública que está em js/config.js
//   VAPID_PRIVATE_KEY   a chave privada (essa não sai do painel)
//   VAPID_SUBJECT       ex.: mailto:secretaria@suaigreja.com
//
// Já vêm prontas do próprio Supabase: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.

import { enviarPush, type Inscricao } from './push.ts';

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!;
const CHAVE_SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FUSO = Deno.env.get('FUSO_HORARIO') ?? 'America/Sao_Paulo';

const VAPID = {
  publica: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  privada: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
  assunto: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:igreja@exemplo.com',
};

type Item = {
  id: string;
  data: string;
  tipo: string;
  membroIds: string[];
  observacao?: string;
};

const APELIDOS: Record<string, string> = {
  domingo_manha: 'culto de domingo pela manhã',
  domingo_noite: 'culto de domingo pela noite',
  quinta_estudo: 'estudo bíblico de quinta',
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

// Data de "hoje" no fuso da igreja, no formato AAAA-MM-DD.
function dataLocal(maisDias = 0) {
  const agora = new Date(Date.now() + maisDias * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

function formatarDia(iso: string) {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

Deno.serve(async () => {
  try {
    if (!VAPID.publica || !VAPID.privada) {
      return Response.json(
        { erro: 'Faltam os segredos VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY.' },
        { status: 500 },
      );
    }

    const hoje = dataLocal(0);
    const amanha = dataLocal(1);

    const [escalas, membros, inscricoes, prefsLinhas, enviados] = await Promise.all([
      api('escalas?select=itens&status=eq.publicada'),
      api('membros?select=id,nome'),
      api('push_inscricoes?select=*'),
      api('preferencias?select=valor&id=eq.1'),
      api('lembretes_enviados?select=chave'),
    ]);

    const tipos = prefsLinhas?.[0]?.valor?.tipos ?? {};
    const nomes = new Map<string, string>(membros.map((m: any) => [m.id, m.nome]));
    const jaAvisados = new Set<string>(enviados.map((e: any) => e.chave));

    const porMembro = new Map<string, Inscricao[]>();
    for (const i of inscricoes) {
      const lista = porMembro.get(i.membro_id) ?? [];
      lista.push({ endpoint: i.endpoint, p256dh: i.p256dh, auth: i.auth });
      porMembro.set(i.membro_id, lista);
    }

    const itens: Item[] = escalas.flatMap((e: any) => e.itens ?? []);
    const alvos = itens.filter((i) => i.data === hoje || i.data === amanha);

    let enviadosAgora = 0;
    let falhas = 0;
    let expiradas = 0;

    for (const item of alvos) {
      const quando = item.data === hoje ? 'hoje' : 'amanha';
      const tipo = tipos[item.tipo] ?? {};
      const descricao = APELIDOS[item.tipo] ?? item.tipo;
      const abertura = tipo.horaAbertura ? ` Chegue às ${tipo.horaAbertura}.` : '';

      for (const membroId of item.membroIds ?? []) {
        const chave = `${membroId}|${item.data}|${item.tipo}|${quando}`;
        if (jaAvisados.has(chave)) continue;

        const conteudo = JSON.stringify({
          titulo:
            quando === 'hoje'
              ? '🔑 Hoje é o seu dia de abrir a igreja'
              : '🔔 Amanhã é o seu dia de abrir a igreja',
          corpo:
            `${formatarDia(item.data)} — ${descricao}.${abertura}` +
            (item.observacao ? ` (${item.observacao})` : ''),
          tag: chave,
          url: './',
        });

        let algumOk = false;
        for (const inscricao of porMembro.get(membroId) ?? []) {
          try {
            const status = await enviarPush({ inscricao, payload: conteudo, vapid: VAPID });

            if (status >= 200 && status < 300) {
              algumOk = true;
              enviadosAgora++;
            } else if (status === 404 || status === 410) {
              // inscrição expirada (app desinstalado, permissão revogada)
              expiradas++;
              await api(
                `push_inscricoes?endpoint=eq.${encodeURIComponent(inscricao.endpoint)}`,
                { method: 'DELETE' },
              );
            } else {
              falhas++;
              console.error(`push para ${nomes.get(membroId)}: HTTP ${status}`);
            }
          } catch (erro) {
            falhas++;
            console.error(`push para ${nomes.get(membroId)}:`, erro);
          }
        }

        if (algumOk) {
          await api('lembretes_enviados', {
            method: 'POST',
            headers: { Prefer: 'resolution=ignore-duplicates' },
            body: JSON.stringify({ chave }),
          });
        }
      }
    }

    const resumo = {
      hoje,
      amanha,
      turnos: alvos.length,
      enviados: enviadosAgora,
      falhas,
      inscricoesExpiradas: expiradas,
    };
    console.log('lembretes', resumo);
    return Response.json(resumo);
  } catch (erro) {
    console.error(erro);
    return Response.json({ erro: String(erro) }, { status: 500 });
  }
});
