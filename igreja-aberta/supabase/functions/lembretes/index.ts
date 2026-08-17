// Edge Function "lembretes" — envia a notificação push para os irmãos
// escalados. Roda no Supabase (Deno) e deve ser chamada uma vez por dia por
// um agendamento (veja o README).
//
// Variáveis de ambiente necessárias (Supabase > Edge Functions > Secrets):
//   SUPABASE_URL              (já vem preenchida)
//   SUPABASE_SERVICE_ROLE_KEY (já vem preenchida)
//   VAPID_PUBLIC_KEY          gerado por: npx web-push generate-vapid-keys
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT             ex.: mailto:secretaria@suaigreja.com

import webpush from 'npm:web-push@3.6.7';

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!;
const CHAVE_SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FUSO = Deno.env.get('FUSO_HORARIO') ?? 'America/Sao_Paulo';

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:igreja@exemplo.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

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
    const hoje = dataLocal(0);
    const amanha = dataLocal(1);

    const [escalas, membros, inscricoes, prefsLinhas] = await Promise.all([
      api('escalas?select=itens&status=eq.publicada'),
      api('membros?select=id,nome'),
      api('push_inscricoes?select=*'),
      api('preferencias?select=valor&id=eq.1'),
    ]);

    const tipos = prefsLinhas?.[0]?.valor?.tipos ?? {};
    const nomes = new Map(membros.map((m: any) => [m.id, m.nome]));
    const porMembro = new Map<string, any[]>();
    for (const inscricao of inscricoes) {
      const lista = porMembro.get(inscricao.membro_id) ?? [];
      lista.push(inscricao);
      porMembro.set(inscricao.membro_id, lista);
    }

    const itens: Item[] = escalas.flatMap((e: any) => e.itens ?? []);
    const alvos = itens.filter((i) => i.data === hoje || i.data === amanha);

    let enviados = 0;
    let falhas = 0;

    for (const item of alvos) {
      const quando = item.data === hoje ? 'hoje' : 'amanha';
      const tipo = tipos[item.tipo] ?? {};
      const descricao = APELIDOS[item.tipo] ?? item.tipo;
      const abertura = tipo.horaAbertura ? ` Chegue às ${tipo.horaAbertura}.` : '';

      for (const membroId of item.membroIds ?? []) {
        const chave = `${membroId}|${item.data}|${item.tipo}|${quando}`;

        // Não repete o mesmo aviso se a função rodar mais de uma vez.
        const jaEnviado = await api(
          `lembretes_enviados?select=chave&chave=eq.${encodeURIComponent(chave)}`,
        );
        if (jaEnviado.length) continue;

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

        const alvosPush = porMembro.get(membroId) ?? [];
        let algumOk = false;

        for (const inscricao of alvosPush) {
          try {
            await webpush.sendNotification(
              {
                endpoint: inscricao.endpoint,
                keys: { p256dh: inscricao.p256dh, auth: inscricao.auth },
              },
              conteudo,
            );
            algumOk = true;
            enviados++;
          } catch (erro: any) {
            falhas++;
            // Inscrição expirada: apaga para não tentar de novo.
            if (erro?.statusCode === 404 || erro?.statusCode === 410) {
              await api(
                `push_inscricoes?endpoint=eq.${encodeURIComponent(inscricao.endpoint)}`,
                { method: 'DELETE' },
              );
            } else {
              console.error(`falha para ${nomes.get(membroId)}:`, erro?.message ?? erro);
            }
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

    const resumo = { hoje, amanha, turnos: alvos.length, enviados, falhas };
    console.log('lembretes', resumo);
    return Response.json(resumo);
  } catch (erro) {
    console.error(erro);
    return Response.json({ erro: String(erro) }, { status: 500 });
  }
});
