// Ligação com o ReparoSimples (sistema de assistência da RB Tech, repositório REPARORBTECH, banco no Supabase).
// Lê só as OS da loja RB Tech: número, aparelho, status, defeito e previsão. Nunca lê dados de cliente.
//
// Variáveis na Vercel (do projeto do prédio):
//   REPARO_SUPABASE_URL          endereço do Supabase do ReparoSimples (ex.: https://xxxx.supabase.co)
//   REPARO_SUPABASE_SERVICE_KEY  chave secreta (service_role ou sb_secret_...) — só no servidor
//   REPARO_LOJA_ID               id da loja RB Tech na tabela "lojas" (o prédio mostra a lista para você escolher)

const url = () => String(process.env.REPARO_SUPABASE_URL || '').trim().replace(/\/(rest|auth)\/v1.*$/i, '').replace(/\/+$/, '');
const chave = () => String(process.env.REPARO_SUPABASE_SERVICE_KEY || '').trim();
const loja = () => String(process.env.REPARO_LOJA_ID || '').trim();
export const reparoConfigurado = () => !!(url() && chave() && loja());
export const reparoConectavel = () => !!(url() && chave());

export class ErroReparo extends Error {}

async function rest(caminho) {
  const k = chave();
  const cab = { apikey: k, accept: 'application/json' };
  if (k.startsWith('eyJ')) cab.authorization = 'Bearer ' + k; // chave antiga (JWT); a nova sb_secret_ vai só no apikey
  const r = await fetch(`${url()}/rest/v1/${caminho}`, { headers: cab, signal: AbortSignal.timeout(15000) });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    if (r.status === 401 || r.status === 403) throw new ErroReparo('O Supabase do ReparoSimples recusou a chave. Confira REPARO_SUPABASE_SERVICE_KEY.');
    throw new ErroReparo(`ReparoSimples respondeu ${r.status}: ${txt.slice(0, 160)}`);
  }
  return r.json();
}

/** Lojas cadastradas (para achar o id da RB Tech). */
export async function listarLojas() {
  if (!reparoConectavel()) throw new ErroReparo('Faltam REPARO_SUPABASE_URL e REPARO_SUPABASE_SERVICE_KEY na Vercel.');
  const lojas = await rest('lojas?select=id,nome&order=criado_em.asc&limit=200');
  return lojas.map(l => ({ id: l.id, nome: l.nome }));
}

const ATIVOS = ['analise', 'peca', 'servico', 'concluido'];

/** OS em andamento da loja RB Tech (fora da lixeira). */
export async function lerOrdensAbertas({ detalhes = false } = {}) {
  if (!reparoConfigurado()) throw new ErroReparo('O ReparoSimples ainda não está ligado (faltam REPARO_SUPABASE_URL, REPARO_SUPABASE_SERVICE_KEY e REPARO_LOJA_ID).');
  const campos = 'id,atualizado_em,dados';
  const filtro = [
    `loja_id=eq.${encodeURIComponent(loja())}`,
    'colecao=eq.os',
    `dados->>status=in.(${ATIVOS.join(',')})`,
    'or=(dados->>deleted.is.null,dados->>deleted.eq.false)',
    'order=atualizado_em.desc',
    'limit=80',
  ].join('&');
  const linhas = await rest(`itens?select=${campos}&${filtro}`);
  return linhas.map(l => {
    const d = l.dados || {};
    const base = {
      os: String(d.numero ?? l.id),
      modelo: [d.aparelho?.marca && !/apple/i.test(d.aparelho.marca) ? d.aparelho.marca : '', d.aparelho?.modelo].filter(Boolean).join(' ').trim(),
      status: d.status,
      atualizado: l.atualizado_em,
    };
    if (!detalhes) return base;
    return { ...base, defeito: d.defeito || '', servico: d.servico || '', previsao: d.previsao || null, criadoEm: d.criadoEm || null, tecnico: d.tecnico || '' };
  });
}

/** Ferramenta da equipe da loja (Rael e técnico): as OS abertas com defeito, serviço e previsão. */
export async function ferramentaOrdens() {
  const ordens = await lerOrdensAbertas({ detalhes: true });
  const nomes = { analise: 'em análise', peca: 'aguardando peça', servico: 'em reparo', concluido: 'pronta para retirada' };
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    fonte: 'ReparoSimples (loja RB Tech)',
    total: ordens.length,
    porStatus: Object.fromEntries(Object.keys(nomes).map(k => [nomes[k], ordens.filter(o => o.status === k).length])),
    atrasadas: ordens.filter(o => o.previsao && String(o.previsao).slice(0, 10) < hoje && o.status !== 'concluido').map(o => o.os),
    ordens: ordens.map(o => ({ ...o, status: nomes[o.status] || o.status })),
  };
}
