# 🔑 Igreja Aberta — app da escala

App para o grupo dos irmãos que abrem a igreja. Funciona no celular como um
aplicativo (dá para instalar na tela inicial), gera a escala do mês com um
toque, respeita os dias que cada um marcou que não pode, deixa editar quando
acontece um imprevisto e manda o texto pronto para o grupo do WhatsApp.

Cultos já configurados: **domingo pela manhã**, **domingo pela noite** e
**estudo bíblico na quinta**. Os horários são editáveis dentro do app.

---

## 1. O que já funciona

| Recurso | Como funciona |
| --- | --- |
| Login | Nome + telefone + e-mail (sem senha). Quem entra primeiro fica administrador. |
| Cadastro dos irmãos | Nome, telefone, e-mail, de quais cultos participa, se está disponível. |
| "Não posso" | Cada irmão marca os cultos em que não estará — inclusive um período inteiro (viagem). |
| Gerar escala | Um toque: divide os turnos de forma justa, sem cair em dia marcado. |
| Editar | Administrador troca qualquer turno; cada irmão pode mexer no turno dele. |
| WhatsApp | Botão que abre o WhatsApp com o texto da escala já formatado. |
| Lembrete | Notificação no celular no dia do turno (e um dia antes). |
| Offline | Depois de abrir uma vez, o app abre sem internet. |

## 2. Como colocar no ar (GitHub Pages)

1. Faça o push desta pasta para o GitHub (já está no repositório).
2. No GitHub: **Settings → Pages → Source: GitHub Actions**.
3. O workflow `.github/workflows/pages.yml` publica a pasta `igreja-aberta/`
   a cada push na `main`.
4. O endereço fica assim:
   `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`

Mande esse link no grupo. Cada irmão abre e instala:

- **Android / Chrome:** menu ⋮ → *Adicionar à tela inicial*
- **iPhone / Safari:** botão Compartilhar → *Adicionar à Tela de Início*

> No iPhone, a notificação só funciona **depois** de adicionar à Tela de Início
> (limitação do próprio iOS). Peça para instalarem antes de ativar o lembrete.

Para testar no computador, é preciso um servidor local (não vale abrir o
arquivo direto, por causa dos módulos):

```bash
cd igreja-aberta
python3 -m http.server 8000
# abra http://localhost:8000
```

> **Ao mexer no código:** troque o número de `VERSAO` em `sw.js`
> (`igreja-aberta-v2` → `v3`, e assim por diante). É o que faz os celulares
> baixarem a versão nova em vez de continuar usando a cópia guardada.

## 3. Modo local x modo nuvem

O app começa no **modo local**: tudo fica salvo no próprio celular. Serve para
testar e para um único administrador manter a escala, mas cada aparelho tem a
sua cópia — o que o administrador gera não aparece no celular dos outros.

Para todos verem a mesma escala e receberem push com o app fechado, ative o
**modo nuvem** (Supabase — plano gratuito é suficiente):

### 3.1 Criar o banco

1. Crie uma conta em [supabase.com](https://supabase.com) e um projeto novo.
2. Abra **SQL Editor**, cole todo o conteúdo de
   [`supabase/schema.sql`](supabase/schema.sql) e clique em **RUN**.
3. Vá em **Project Settings → API** e copie:
   - *Project URL*
   - *anon public key*
4. Preencha em [`js/config.js`](js/config.js):

```js
supabase: {
  url: 'https://xxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOi...',
},
```

Pronto: no próximo acesso o app já sincroniza. O selo em **Ajustes → Dados do
grupo** mostra "nuvem".

> **Sobre segurança:** o app não usa senha e a chave `anon` fica dentro dele,
> então quem tiver o link consegue ver e editar a escala. Para um grupo da
> igreja isso normalmente é aceitável — mas não guarde nada sigiloso ali. Se
> quiser fechar mais, o caminho é trocar as políticas do `schema.sql` por
> Supabase Auth (login por e-mail com link mágico).

### 3.2 Ligar o push de verdade

Sem servidor, o lembrete aparece quando o irmão abre o app (e em segundo plano,
quando o celular dele permite). Com o Supabase configurado, dá para enviar a
notificação na hora marcada mesmo com o app fechado:

1. Gere o par de chaves VAPID:

   ```bash
   npx web-push generate-vapid-keys
   ```

2. Coloque a chave **pública** em `js/config.js`:

   ```js
   vapidPublicKey: 'BEl62iUYgUiv...',
   ```

3. Publique a função (precisa da [CLI do Supabase](https://supabase.com/docs/guides/cli)):

   ```bash
   supabase link --project-ref SEU_PROJECT_REF
   supabase secrets set \
     VAPID_PUBLIC_KEY=... \
     VAPID_PRIVATE_KEY=... \
     VAPID_SUBJECT=mailto:voce@email.com
   supabase functions deploy lembretes
   ```

4. Agende para rodar todo dia às 8h de Brasília (11h UTC). No SQL Editor:

   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;

   select cron.schedule(
     'lembretes-igreja-aberta',
     '0 11 * * *',
     $$
     select net.http_post(
       url := 'https://SEU-PROJETO.supabase.co/functions/v1/lembretes',
       headers := '{"Authorization": "Bearer SUA_SERVICE_ROLE_KEY"}'::jsonb
     );
     $$
   );
   ```

A função avisa quem abre a igreja **hoje** e quem abre **amanhã**, e guarda o
que já mandou para não repetir.

## 4. Como o grupo usa no dia a dia

**Administrador (você)**

1. Abre o app → aba **Irmãos** → confere/cadastra o pessoal.
2. Aba **Gerar** → escolhe o mês → **✨ Gerar escala** → confere a prévia
   (a barra mostra a divisão entre os irmãos) → **📣 Publicar e enviar no
   WhatsApp**.
3. Se alguém pedir troca: aba **Escala** → botão **Trocar** na linha.

**Cada irmão**

1. Abre o link, entra com nome, telefone e e-mail, instala na tela inicial.
2. Em **Ajustes**, toca em **Ativar lembretes**.
3. Antes de o mês virar, entra em **Não posso** e marca os dias em que não
   estará disponível.
4. No dia do turno, recebe a notificação no celular.

## 5. Como a divisão é feita

Na ordem:

1. Ninguém entra em dia/culto que marcou como indisponível.
2. Ninguém abre dois cultos no mesmo dia.
3. Quem tem **menos turnos acumulados** entra primeiro (conta as escalas
   anteriores, então um mês continua de onde o outro parou).
4. Evita escalar a mesma pessoa duas vezes na mesma semana — a não ser que não
   haja outra opção.
5. Só entra em cultos que a pessoa marcou que participa.

Quando não sobra ninguém disponível, o horário fica como **"a definir"** e o
app avisa na prévia, em vez de escalar quem não pode.

## 6. Backup

Em **Ajustes → Dados do grupo**:

- **Baixar backup** gera um `.json` com irmãos, marcações e escalas.
- **Restaurar backup** (administrador) devolve esse arquivo para o app — é
  também o jeito de levar os dados do modo local para o modo nuvem.

## 7. Estrutura dos arquivos

```
igreja-aberta/
├── index.html              estrutura da tela
├── manifest.webmanifest    dados de instalação (nome, ícone, cor)
├── sw.js                   service worker: offline, lembrete e push
├── css/app.css
├── icons/
├── js/
│   ├── config.js           👈 onde você configura Supabase e VAPID
│   ├── app.js              navegação, sessão, avisos
│   ├── store.js            banco de dados (local ou nuvem)
│   ├── scheduler.js         geração da escala
│   ├── share.js            texto do WhatsApp
│   ├── notifications.js    lembretes e push
│   ├── util.js  idb.js
│   └── views/              uma tela por arquivo
└── supabase/
    ├── schema.sql          tabelas do banco
    └── functions/lembretes/index.ts   envio do push
```

## 8. Ideias para as próximas versões

- Login com link mágico por e-mail (fecha o acesso de verdade).
- Aviso para o administrador quando faltar irmão em algum horário.
- Envio automático da escala no grupo do WhatsApp (hoje o app abre o WhatsApp
  com o texto pronto; o envio automático exige a API oficial do WhatsApp
  Business).
- Histórico anual, com quantas vezes cada irmão abriu no ano.
