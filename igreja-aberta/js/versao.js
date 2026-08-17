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

export const VERSAO = '1.2.0';

export const NOVIDADES = [
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
