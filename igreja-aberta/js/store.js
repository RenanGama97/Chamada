// Camada de dados do app.
//
// Existem dois modos:
//   local  -> tudo guardado no próprio celular (localStorage). Funciona sem
//             internet e sem configurar nada, mas cada aparelho tem a sua cópia.
//   nuvem  -> Supabase (REST). Todos os irmãos veem a mesma escala e o push
//             funciona com o app fechado.
//
// O resto do app só conversa com o objeto `db`, então trocar de modo não
// exige mudar nenhuma tela.

import { CONFIG, PREFERENCIAS_PADRAO, TIPOS_PADRAO } from './config.js';
import { uid } from './util.js';

const CHAVE_DADOS = 'igreja-aberta:dados:v1';
const CHAVE_CACHE = 'igreja-aberta:cache-nuvem:v1';
const CHAVE_SESSAO = 'igreja-aberta:sessao:v1';

function estadoVazio() {
  return {
    membros: [],
    indisponibilidades: [],
    escalas: [],
    prefs: { ...PREFERENCIAS_PADRAO, tipos: structuredClone(TIPOS_PADRAO) },
  };
}

function lerLocal(chave) {
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return null;
    return JSON.parse(bruto);
  } catch (erro) {
    console.warn('Não foi possível ler os dados salvos:', erro);
    return null;
  }
}

function gravarLocal(chave, valor) {
  localStorage.setItem(chave, JSON.stringify(valor));
}

// Completa os campos que podem faltar em dados salvos por versões antigas.
function normalizarEstado(estado) {
  const base = estadoVazio();
  const prefs = { ...base.prefs, ...(estado.prefs || {}) };
  prefs.tipos = { ...base.prefs.tipos, ...(estado.prefs?.tipos || {}) };
  return {
    membros: estado.membros || [],
    indisponibilidades: estado.indisponibilidades || [],
    escalas: (estado.escalas || []).map((e) => ({ ...e, itens: e.itens || [] })),
    prefs,
  };
}

/* ------------------------------------------------------------------ */
/* Modo local                                                          */
/* ------------------------------------------------------------------ */

class RepositorioLocal {
  constructor() {
    this.modo = 'local';
    this.online = true;
  }

  async carregar() {
    const salvo = lerLocal(CHAVE_DADOS) || estadoVazio();
    this.estado = normalizarEstado(salvo);
    return this.estado;
  }

  persistir() {
    gravarLocal(CHAVE_DADOS, this.estado);
  }

  async salvarMembro(membro) {
    const lista = this.estado.membros;
    const i = lista.findIndex((m) => m.id === membro.id);
    if (i >= 0) lista[i] = membro;
    else lista.push(membro);
    this.persistir();
    return membro;
  }

  async removerMembro(id) {
    this.estado.membros = this.estado.membros.filter((m) => m.id !== id);
    this.estado.indisponibilidades = this.estado.indisponibilidades.filter(
      (d) => d.membroId !== id,
    );
    this.persistir();
  }

  async salvarIndisponibilidade(registro) {
    const lista = this.estado.indisponibilidades;
    const i = lista.findIndex((d) => d.id === registro.id);
    if (i >= 0) lista[i] = registro;
    else lista.push(registro);
    this.persistir();
    return registro;
  }

  async removerIndisponibilidade(id) {
    this.estado.indisponibilidades = this.estado.indisponibilidades.filter(
      (d) => d.id !== id,
    );
    this.persistir();
  }

  async salvarEscala(escala) {
    const lista = this.estado.escalas;
    const i = lista.findIndex((e) => e.id === escala.id);
    if (i >= 0) lista[i] = escala;
    else lista.push(escala);
    this.persistir();
    return escala;
  }

  async removerEscala(id) {
    this.estado.escalas = this.estado.escalas.filter((e) => e.id !== id);
    this.persistir();
  }

  async salvarPrefs(prefs) {
    this.estado.prefs = prefs;
    this.persistir();
    return prefs;
  }

  async registrarPush() {
    // Sem servidor não há push de verdade; os lembretes são locais.
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Modo nuvem (Supabase REST)                                          */
/* ------------------------------------------------------------------ */

class RepositorioNuvem {
  constructor({ url, anonKey }) {
    this.modo = 'nuvem';
    this.url = url.replace(/\/$/, '');
    this.anonKey = anonKey;
    this.online = true;
  }

  async requisicao(caminho, { metodo = 'GET', corpo, prefer } = {}) {
    const cabecalhos = { apikey: this.anonKey };
    // As chaves antigas ("anon") são JWT e vão também no Authorization.
    // As novas ("sb_publishable_...") só valem no cabeçalho apikey.
    if (this.anonKey.startsWith('ey')) {
      cabecalhos.Authorization = `Bearer ${this.anonKey}`;
    }
    if (corpo) cabecalhos['Content-Type'] = 'application/json';
    if (prefer) cabecalhos.Prefer = prefer;

    const resposta = await fetch(`${this.url}/rest/v1/${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => '');
      throw new Error(`Supabase ${resposta.status}: ${detalhe.slice(0, 300)}`);
    }
    if (resposta.status === 204) return null;
    const texto = await resposta.text();
    return texto ? JSON.parse(texto) : null;
  }

  async carregar() {
    try {
      const [membros, indisponibilidades, escalas, prefs] = await Promise.all([
        this.requisicao('membros?select=*'),
        this.requisicao('indisponibilidades?select=*'),
        this.requisicao('escalas?select=*'),
        this.requisicao('preferencias?select=*&id=eq.1'),
      ]);

      this.estado = normalizarEstado({
        membros: membros.map(deMembroLinha),
        indisponibilidades: indisponibilidades.map(deIndisponibilidadeLinha),
        escalas: escalas.map(deEscalaLinha),
        prefs: prefs?.[0]?.valor || null,
      });
      this.online = true;
      gravarLocal(CHAVE_CACHE, this.estado);
    } catch (erro) {
      console.warn('Falha ao falar com a nuvem, usando a última cópia:', erro);
      this.online = false;
      this.erro = erro.message;
      this.estado = normalizarEstado(lerLocal(CHAVE_CACHE) || estadoVazio());
    }
    return this.estado;
  }

  exigirConexao() {
    if (!this.online) {
      throw new Error('Sem conexão com a nuvem. Tente novamente com internet.');
    }
  }

  async salvarMembro(membro) {
    this.exigirConexao();
    await this.requisicao('membros', {
      metodo: 'POST',
      corpo: paraMembroLinha(membro),
      prefer: 'resolution=merge-duplicates',
    });
    const lista = this.estado.membros;
    const i = lista.findIndex((m) => m.id === membro.id);
    if (i >= 0) lista[i] = membro;
    else lista.push(membro);
    gravarLocal(CHAVE_CACHE, this.estado);
    return membro;
  }

  async removerMembro(id) {
    this.exigirConexao();
    await this.requisicao(`indisponibilidades?membro_id=eq.${id}`, { metodo: 'DELETE' });
    await this.requisicao(`membros?id=eq.${id}`, { metodo: 'DELETE' });
    this.estado.membros = this.estado.membros.filter((m) => m.id !== id);
    this.estado.indisponibilidades = this.estado.indisponibilidades.filter(
      (d) => d.membroId !== id,
    );
    gravarLocal(CHAVE_CACHE, this.estado);
  }

  async salvarIndisponibilidade(registro) {
    this.exigirConexao();
    await this.requisicao('indisponibilidades', {
      metodo: 'POST',
      corpo: paraIndisponibilidadeLinha(registro),
      prefer: 'resolution=merge-duplicates',
    });
    this.estado.indisponibilidades.push(registro);
    gravarLocal(CHAVE_CACHE, this.estado);
    return registro;
  }

  async removerIndisponibilidade(id) {
    this.exigirConexao();
    await this.requisicao(`indisponibilidades?id=eq.${id}`, { metodo: 'DELETE' });
    this.estado.indisponibilidades = this.estado.indisponibilidades.filter(
      (d) => d.id !== id,
    );
    gravarLocal(CHAVE_CACHE, this.estado);
  }

  async salvarEscala(escala) {
    this.exigirConexao();
    await this.requisicao('escalas', {
      metodo: 'POST',
      corpo: paraEscalaLinha(escala),
      prefer: 'resolution=merge-duplicates',
    });
    const lista = this.estado.escalas;
    const i = lista.findIndex((e) => e.id === escala.id);
    if (i >= 0) lista[i] = escala;
    else lista.push(escala);
    gravarLocal(CHAVE_CACHE, this.estado);
    return escala;
  }

  async removerEscala(id) {
    this.exigirConexao();
    await this.requisicao(`escalas?id=eq.${id}`, { metodo: 'DELETE' });
    this.estado.escalas = this.estado.escalas.filter((e) => e.id !== id);
    gravarLocal(CHAVE_CACHE, this.estado);
  }

  async salvarPrefs(prefs) {
    this.exigirConexao();
    await this.requisicao('preferencias', {
      metodo: 'POST',
      corpo: { id: 1, valor: prefs },
      prefer: 'resolution=merge-duplicates',
    });
    this.estado.prefs = prefs;
    gravarLocal(CHAVE_CACHE, this.estado);
    return prefs;
  }

  // Guarda a inscrição do navegador para o servidor poder enviar o push.
  async registrarPush(membroId, inscricao) {
    this.exigirConexao();
    const dados = inscricao.toJSON();
    await this.requisicao('push_inscricoes', {
      metodo: 'POST',
      corpo: {
        endpoint: dados.endpoint,
        membro_id: membroId,
        p256dh: dados.keys.p256dh,
        auth: dados.keys.auth,
      },
      prefer: 'resolution=merge-duplicates',
    });
    return true;
  }
}

/* ------------------------------------------------------------------ */
/* Conversão entre o formato do app e as colunas do banco              */
/* ------------------------------------------------------------------ */

function paraMembroLinha(m) {
  return {
    id: m.id,
    nome: m.nome,
    telefone: m.telefone,
    email: m.email,
    admin: m.admin,
    ativo: m.ativo,
    tipos: m.tipos,
    criado_em: m.criadoEm,
  };
}

function deMembroLinha(l) {
  return {
    id: l.id,
    nome: l.nome,
    telefone: l.telefone || '',
    email: l.email || '',
    admin: !!l.admin,
    ativo: l.ativo !== false,
    tipos: l.tipos || Object.keys(TIPOS_PADRAO),
    criadoEm: l.criado_em,
  };
}

function paraIndisponibilidadeLinha(d) {
  return {
    id: d.id,
    membro_id: d.membroId,
    data: d.data,
    tipo: d.tipo || null,
    motivo: d.motivo || '',
    criado_em: d.criadoEm,
  };
}

function deIndisponibilidadeLinha(l) {
  return {
    id: l.id,
    membroId: l.membro_id,
    data: l.data,
    tipo: l.tipo || null,
    motivo: l.motivo || '',
    criadoEm: l.criado_em,
  };
}

function paraEscalaLinha(e) {
  return {
    id: e.id,
    periodo: e.periodo,
    status: e.status,
    itens: e.itens,
    criado_em: e.criadoEm,
    publicado_em: e.publicadoEm || null,
  };
}

function deEscalaLinha(l) {
  return {
    id: l.id,
    periodo: l.periodo,
    status: l.status,
    itens: l.itens || [],
    criadoEm: l.criado_em,
    publicadoEm: l.publicado_em,
  };
}

/* ------------------------------------------------------------------ */
/* Objeto público                                                      */
/* ------------------------------------------------------------------ */

export const db = {
  repo: null,

  get modo() {
    return this.repo?.modo || 'local';
  },

  get online() {
    return this.repo?.online !== false;
  },

  get estado() {
    return this.repo.estado;
  },

  async iniciar() {
    const usarNuvem = Boolean(CONFIG.supabase.url && CONFIG.supabase.anonKey);
    this.repo = usarNuvem
      ? new RepositorioNuvem(CONFIG.supabase)
      : new RepositorioLocal();
    await this.repo.carregar();
    return this.estado;
  },

  async recarregar() {
    await this.repo.carregar();
    return this.estado;
  },

  // --- membros ---
  membros() {
    return [...this.estado.membros].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  },

  membrosAtivos() {
    return this.membros().filter((m) => m.ativo);
  },

  membro(id) {
    return this.estado.membros.find((m) => m.id === id) || null;
  },

  novoMembro({ nome, telefone, email, admin = false }) {
    return {
      id: uid('mem'),
      nome: nome.trim(),
      telefone,
      email: email.trim().toLowerCase(),
      admin,
      ativo: true,
      tipos: Object.keys(this.estado.prefs.tipos),
      criadoEm: new Date().toISOString(),
    };
  },

  salvarMembro(membro) {
    return this.repo.salvarMembro(membro);
  },

  removerMembro(id) {
    return this.repo.removerMembro(id);
  },

  // --- indisponibilidades ---
  indisponibilidades(membroId) {
    const lista = this.estado.indisponibilidades;
    return (membroId ? lista.filter((d) => d.membroId === membroId) : lista)
      .slice()
      .sort((a, b) => a.data.localeCompare(b.data));
  },

  // `tipo` nulo significa "não posso em nenhum culto deste dia".
  async marcarIndisponivel(membroId, data, tipo = null, motivo = '') {
    const existente = this.estado.indisponibilidades.find(
      (d) => d.membroId === membroId && d.data === data && (d.tipo || null) === tipo,
    );
    if (existente) return existente;
    return this.repo.salvarIndisponibilidade({
      id: uid('ind'),
      membroId,
      data,
      tipo,
      motivo,
      criadoEm: new Date().toISOString(),
    });
  },

  async desmarcarIndisponivel(membroId, data, tipo = null) {
    // Tira tanto a marca do culto específico quanto a do dia inteiro.
    const alvos = this.estado.indisponibilidades.filter(
      (d) =>
        d.membroId === membroId &&
        d.data === data &&
        (tipo === null ? true : (d.tipo || null) === null || d.tipo === tipo),
    );
    for (const alvo of alvos) await this.repo.removerIndisponibilidade(alvo.id);
  },

  estaIndisponivel(membroId, data, tipo = null) {
    return this.estado.indisponibilidades.some(
      (d) =>
        d.membroId === membroId &&
        d.data === data &&
        ((d.tipo || null) === null || d.tipo === tipo),
    );
  },

  removerIndisponibilidade(id) {
    return this.repo.removerIndisponibilidade(id);
  },

  // --- escalas ---
  escalas() {
    return [...this.estado.escalas].sort((a, b) => b.periodo.localeCompare(a.periodo));
  },

  escala(id) {
    return this.estado.escalas.find((e) => e.id === id) || null;
  },

  escalaDoPeriodo(periodo) {
    return this.estado.escalas.find((e) => e.periodo === periodo) || null;
  },

  escalasPublicadas() {
    return this.escalas().filter((e) => e.status === 'publicada');
  },

  salvarEscala(escala) {
    return this.repo.salvarEscala(escala);
  },

  removerEscala(id) {
    return this.repo.removerEscala(id);
  },

  // Todos os itens de escalas publicadas, em ordem de data.
  itensPublicados() {
    return this.escalasPublicadas()
      .flatMap((e) => e.itens.map((i) => ({ ...i, escalaId: e.id, periodo: e.periodo })))
      .sort((a, b) => a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo));
  },

  // --- preferências ---
  prefs() {
    return this.estado.prefs;
  },

  salvarPrefs(prefs) {
    return this.repo.salvarPrefs(prefs);
  },

  tipos() {
    return this.estado.prefs.tipos;
  },

  tiposAtivos() {
    return Object.entries(this.tipos())
      .filter(([, t]) => t.ativo !== false)
      .map(([chave, t]) => ({ chave, ...t }));
  },

  tipo(chave) {
    const t = this.tipos()[chave];
    return t ? { chave, ...t } : { chave, label: chave, curto: chave, horaAbertura: '' };
  },

  // --- push ---
  registrarPush(membroId, inscricao) {
    return this.repo.registrarPush(membroId, inscricao);
  },

  // --- sessão (quem está usando este aparelho) ---
  sessao() {
    return lerLocal(CHAVE_SESSAO);
  },

  definirSessao(membroId) {
    gravarLocal(CHAVE_SESSAO, { membroId, em: new Date().toISOString() });
  },

  encerrarSessao() {
    localStorage.removeItem(CHAVE_SESSAO);
  },

  // --- backup ---
  exportar() {
    return JSON.stringify({ app: 'igreja-aberta', versao: 1, dados: this.estado }, null, 2);
  },

  async importar(texto) {
    const pacote = JSON.parse(texto);
    const dados = normalizarEstado(pacote.dados || pacote);
    for (const m of dados.membros) await this.repo.salvarMembro(m);
    for (const d of dados.indisponibilidades) await this.repo.salvarIndisponibilidade(d);
    for (const e of dados.escalas) await this.repo.salvarEscala(e);
    await this.repo.salvarPrefs(dados.prefs);
    await this.recarregar();
  },
};
