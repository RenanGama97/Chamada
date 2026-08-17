// Configuração do app "Igreja Aberta".
//
// O app funciona 100% offline sem mexer em nada aqui (modo LOCAL: os dados
// ficam guardados no próprio celular).
//
// Para que todos os irmãos vejam a MESMA escala e para receber notificação
// push mesmo com o app fechado, preencha os campos abaixo seguindo o
// passo a passo do README.md (Supabase - plano gratuito).

export const CONFIG = {
  nomeGrupo: 'Igreja Aberta',
  nomeIgreja: '',

  // Sincronização na nuvem (opcional)
  supabase: {
    url: 'https://pexgvmgqlagwptagfkab.supabase.co',
    // Chave pública do projeto ("anon public" ou "publishable").
    // Ela é pública de propósito: fica visível para quem abrir o app.
    anonKey: 'sb_publishable_xlP7ONIeqrAocfDfT9Ntwg_VnzVP22T',
  },

  // Notificação push (opcional, exige o Supabase configurado)
  vapidPublicKey: '',
};

// Horários padrão dos cultos. Podem ser alterados dentro do app (Ajustes),
// estes valores são apenas o ponto de partida.
export const TIPOS_PADRAO = {
  domingo_manha: {
    label: 'Culto de domingo (manhã)',
    curto: 'Domingo manhã',
    apelido: 'Manhã',
    diaSemana: 0, // 0 = domingo
    horaCulto: '09:00',
    horaAbertura: '08:15',
    ativo: true,
  },
  domingo_noite: {
    label: 'Culto de domingo (noite)',
    curto: 'Domingo noite',
    apelido: 'Noite',
    diaSemana: 0,
    horaCulto: '18:00',
    horaAbertura: '17:15',
    ativo: true,
  },
  quinta_estudo: {
    label: 'Estudo bíblico (quinta)',
    curto: 'Quinta estudo',
    apelido: 'Estudo',
    diaSemana: 4, // 4 = quinta
    horaCulto: '19:30',
    horaAbertura: '18:45',
    ativo: true,
  },
};

export const PREFERENCIAS_PADRAO = {
  pessoasPorEvento: 1,
  evitarRepetirNaSemana: true,
  diasAntecedenciaLembrete: 1, // avisa 1 dia antes, além do aviso no dia
  horaLembrete: '08:00',
  tipos: TIPOS_PADRAO,
};
