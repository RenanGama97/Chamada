// Versão do app e histórico do que mudou.
//
// AO PUBLICAR UMA VERSÃO NOVA:
//   1. aumente VERSAO aqui;
//   2. escreva as mudanças no topo de NOVIDADES (em português simples, pensando
//      no irmão que vai ler no celular);
//   3. coloque o mesmo número em `VERSAO` no arquivo sw.js.
//
// O passo 3 é o que faz os celulares perceberem que existe versão nova e
// mostrarem o aviso "Atualizar".

export const VERSAO = '1.5.3';

export const NOVIDADES = [
  {
    versao: '1.5.3',
    data: '2026-08-19',
    itens: [
      'Corrigido de verdade: as caixinhas de horário (Horários dos cultos) passavam um pouco da borda do cartão em alguns celulares. Agora ficam sempre dentro do cartão.',
    ],
  },
  {
    versao: '1.5.2',
    data: '2026-08-18',
    itens: [
      'Corrigido: a barra de rolagem aparecia como uma faixa colada na borda direita da tela, parecendo conteúdo passando. Agora ela fica escondida (a rolagem continua funcionando normalmente).',
    ],
  },
  {
    versao: '1.5.1',
    data: '2026-08-18',
    itens: [
      'Corrigido de vez: os campos de horário/data (Horários dos cultos e Vou viajar) ainda passavam da tela em alguns aparelhos. Agora ficam sempre um embaixo do outro no celular, sem risco de estourar.',
    ],
  },
  {
    versao: '1.5.0',
    data: '2026-08-18',
    itens: [
      'Corrigido: telas que passavam da largura do celular (Não posso e Ajustes). Agora tudo cabe certinho na tela.',
      'Não dá mais para dar zoom com dois dedos ou toque duplo no app.',
      'Horários dos cultos: agora todo mundo pode ver, mas só o administrador consegue alterar.',
      'Administrador agora pode cadastrar outros tipos de evento (Culto das Mulheres, Culto Phronesis, etc.), com nome, dia, horário de início e horário de chegada.',
    ],
  },
  {
    versao: '1.4.0',
    data: '2026-08-18',
    itens: [
      'O lembrete agora chega no celular mesmo com o app fechado, na véspera e no dia do seu turno.',
      'Se você ainda não ativou os lembretes, entre em Ajustes e toque em "Ativar lembretes".',
    ],
  },
  {
    versao: '1.3.0',
    data: '2026-08-18',
    itens: [
      'A tela de abertura agora mostra a arte original da IECC, a mesma da igreja.',
      'A logo vai surgindo devagar quando o app abre, em vez de aparecer de uma vez.',
      'O ícone do app no celular também passou a usar o desenho original.',
    ],
  },
  {
    versao: '1.2.0',
    data: '2026-08-17',
    itens: [
      'A logo da tela de abertura ficou igual à da igreja: o mesmo desenho e a mesma fonte.',
      'O app inteiro passou a usar a fonte da identidade da IECC.',
    ],
  },
  {
    versao: '1.1.1',
    data: '2026-08-17',
    itens: [
      'Correção: quem estava numa versão antiga do app não recebia a atualização. Agora a troca acontece sozinha.',
    ],
  },
  {
    versao: '1.1.0',
    data: '2026-08-17',
    itens: [
      'O app está com a cara da IECC: cores, marca e tela de abertura novos.',
      'Atualização automática: quando sair uma versão nova, aparece o aviso "Atualizar" e o app se reinicia sozinho, já com as novidades.',
      'Esta tela aqui, que conta o que mudou a cada versão.',
      'O número da versão agora aparece em Ajustes.',
    ],
  },
  {
    versao: '1.0.0',
    data: '2026-08-17',
    itens: [
      'Cadastro dos irmãos com telefone e e-mail.',
      'Tela "Não posso" para marcar os dias indisponíveis.',
      'Geração automática da escala do mês, dividindo os turnos de forma justa.',
      'Edição dos turnos e envio da escala pronta no WhatsApp.',
      'Lembrete no celular no dia do turno e um dia antes.',
    ],
  },
];

export function novidadesDaVersao(versao = VERSAO) {
  return NOVIDADES.find((n) => n.versao === versao) || null;
}

// Compara "1.2.0" com "1.10.0" corretamente (número a número, não como texto).
export function comparaVersao(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff) return diff;
  }
  return 0;
}
