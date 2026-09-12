# Portal da Engenharia

Painel com o que está rolando na engenharia. Por enquanto tem uma seção:
**TR03** (materiais no depósito TR03), dividida em **Tipo Q** e **Tipo P**.

- **Tipo Q** — dados de três transações do SAP: `MB52`, `MB51` e `ZQRY_LO_002`.
  Rode cada uma no SAP já filtrando pelo depósito TR03, exporte e importe aqui.
- **Tipo P** — dados da transação `ZMMR075`. O portal separa sozinho as linhas
  com a coluna **Status = 02** como **pendentes** (é o que aparece por padrão).

## Como importar os dados

Em cada bloco (MB52, MB51, ZQRY_LO_002 ou ZMMR075) dá pra:

- **Arquivo**: enviar o `.xlsx`/`.xls`/`.csv` exportado do SAP; ou
- **Colar dados**: copiar as linhas direto da grade do SAP ou do Excel
  (com o cabeçalho das colunas na primeira linha) e colar no campo de texto.

Os dados ficam guardados só neste navegador (localStorage) — se abrir em outro
computador ou limpar os dados do site, precisa importar de novo. Se no futuro
for importante todo o time ver os mesmos dados importados por qualquer um,
dá pra trocar isso por um banco compartilhado (ex.: Supabase, como o outro
projeto deste repositório usa) sem mudar o resto do app.

## Rodando local

Não tem build nem dependências — é só abrir `index.html`, ou servir a pasta
com qualquer servidor estático, por exemplo:

```
npx serve portal-engenharia
```

## Estrutura

```
index.html
css/app.css
js/
  app.js              # navegação entre telas e avisos
  store.js            # guarda os dados importados (localStorage)
  importar.js         # lê arquivo (SheetJS) ou texto colado
  components/
    fonteDados.js      # bloco de importar + buscar + tabela, reusado por transação
  views/
    inicio.js          # resumo geral
    tr03.js             # seção TR03 (abas Tipo Q / Tipo P)
```
