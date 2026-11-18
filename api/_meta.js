// Leitura das métricas da RBTech na Meta: anúncios (Marketing API) e Instagram (Graph API).
//
// Variáveis na Vercel:
//   META_ACCESS_TOKEN   token de acesso (de preferência de um "usuário do sistema" do Gerenciador de Negócios)
//   META_AD_ACCOUNT_ID  id da conta de anúncios (com ou sem "act_")
//   META_IG_USER_ID     id da conta profissional do Instagram (não é o @)
//   META_APP_SECRET     (opcional) chave secreta do app; assina as chamadas com appsecret_proof
//   META_API_VERSION    (opcional) padrão: v25.0 (suportada até 2028)
import crypto from 'node:crypto';

const versao = () => process.env.META_API_VERSION || 'v25.0';
const token = () => process.env.META_ACCESS_TOKEN || '';
const contaAnuncios = () => {
  const id = (process.env.META_AD_ACCOUNT_ID || '').trim();
  return id && (id.startsWith('act_') ? id : 'act_' + id);
};
const contaInstagram = () => (process.env.META_IG_USER_ID || '').trim();

export function metaLigado() {
  return { anuncios: !!(token() && contaAnuncios()), instagram: !!(token() && contaInstagram()) };
}

export class ErroMeta extends Error {
  constructor(msg, codigo) { super(msg); this.codigo = codigo; }
}

async function graph(caminho, params = {}, metodo = 'GET') {
  const u = new URL(`https://graph.facebook.com/${versao()}/${caminho}`);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  u.searchParams.set('access_token', token());
  if (process.env.META_APP_SECRET) {
    u.searchParams.set('appsecret_proof', crypto.createHmac('sha256', process.env.META_APP_SECRET).update(token()).digest('hex'));
  }
  const r = await fetch(u, { method: metodo, signal: AbortSignal.timeout(25000) });
  const j = await r.json().catch(() => ({}));
  if (j.error) {
    const m = j.error.message || 'erro desconhecido';
    if (j.error.code === 190) throw new ErroMeta('O token da Meta venceu ou é inválido. Gere outro e atualize META_ACCESS_TOKEN na Vercel.', 190);
    if (j.error.code === 10 || j.error.code === 200) throw new ErroMeta(`Falta permissão no token da Meta: ${m}`, j.error.code);
    throw new ErroMeta(`Meta respondeu: ${m}`, j.error.code);
  }
  if (!r.ok) throw new ErroMeta(`Meta respondeu com erro ${r.status}.`);
  return j;
}

// ---------- anúncios ----------
const PRESET = { hoje: 'today', ontem: 'yesterday', '7dias': 'last_7d', '14dias': 'last_14d', '30dias': 'last_30d' };
const NIVEL = { conta: 'account', campanha: 'campaign', anuncio: 'ad' };
const CONVERSA = 'onsite_conversion.messaging_conversation_started_7d';
const num = v => (v == null || v === '' ? null : Number(v));
const valorAcao = (lista, tipo) => num((lista || []).find(a => a.action_type === tipo)?.value);

function linhaAnuncio(l) {
  const conversas = valorAcao(l.actions, CONVERSA);
  const investimento = num(l.spend) ?? 0;
  return {
    ...(l.campaign_name ? { campanha: l.campaign_name } : {}),
    ...(l.adset_name ? { conjunto: l.adset_name } : {}),
    ...(l.ad_name ? { anuncio: l.ad_name } : {}),
    ...(l.date_start && l.date_start === l.date_stop ? { data: l.date_start } : {}),
    investimento,
    alcance: num(l.reach),
    impressoes: num(l.impressions),
    frequencia: num(l.frequency),
    cliques: num(l.clicks),
    cliquesNoLink: num(l.inline_link_clicks),
    ctr: num(l.ctr),
    cpc: num(l.cpc),
    cpm: num(l.cpm),
    conversasWhatsApp: conversas ?? 0,
    custoPorConversa: conversas ? +(investimento / conversas).toFixed(2) : null,
    outrasAcoes: (l.actions || [])
      .filter(a => a.action_type !== CONVERSA)
      .sort((a, b) => Number(b.value) - Number(a.value))
      .slice(0, 6)
      .map(a => ({ tipo: a.action_type, valor: num(a.value) })),
  };
}

export async function lerAnuncios({ periodo = '7dias', nivel = 'conta' } = {}) {
  if (!metaLigado().anuncios) throw new ErroMeta('A conta de anúncios da Meta ainda não está ligada (faltam META_ACCESS_TOKEN e META_AD_ACCOUNT_ID na Vercel).');
  const j = await graph(`${contaAnuncios()}/insights`, {
    date_preset: PRESET[periodo] || 'last_7d',
    level: NIVEL[nivel] || 'account',
    fields: 'campaign_name,adset_name,ad_name,spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,cpc,cpm,actions',
    limit: 50,
  });
  const linhas = (j.data || []).map(linhaAnuncio).sort((a, b) => b.investimento - a.investimento);
  return { fonte: 'Meta Ads', periodo, nivel, moeda: 'BRL', linhas, observacao: linhas.length ? undefined : 'Sem dados de anúncios neste período.' };
}

/** Números do dia e dos últimos 30 dias, para o placar do escritório. */
export async function lerPlacar() {
  if (!metaLigado().anuncios) throw new ErroMeta('A conta de anúncios da Meta ainda não está ligada.');
  const campos = 'spend,actions';
  const [hoje, dias] = await Promise.all([
    graph(`${contaAnuncios()}/insights`, { date_preset: 'today', level: 'account', fields: campos }),
    graph(`${contaAnuncios()}/insights`, { date_preset: 'last_30d', level: 'account', fields: campos, time_increment: 1, limit: 40 }),
  ]);
  const resumo = l => ({ investimento: num(l?.spend) ?? 0, conversas: valorAcao(l?.actions, CONVERSA) ?? 0 });
  return {
    hoje: resumo(hoje.data?.[0]),
    dias: (dias.data || []).map(l => ({ data: l.date_start, ...resumo(l) })).sort((a, b) => a.data.localeCompare(b.data)),
  };
}

// ---------- Instagram ----------
const DIAS = { '7dias': 7, '14dias': 14, '30dias': 30 };

/** Pede várias métricas de uma vez; se a Meta recusar alguma, pede uma a uma e anota as que falharam. */
async function insightsTolerante(caminho, metricas, params) {
  try {
    const j = await graph(caminho, { ...params, metric: metricas.join(',') });
    return { dados: j.data || [], falhas: [] };
  } catch (e) {
    if (e.codigo === 190) throw e;
    const partes = await Promise.allSettled(metricas.map(m => graph(caminho, { ...params, metric: m })));
    const dados = [];
    const falhas = [];
    partes.forEach((p, i) => (p.status === 'fulfilled' ? dados.push(...(p.value.data || [])) : falhas.push(metricas[i])));
    return { dados, falhas };
  }
}

export async function lerInstagram({ periodo = '7dias' } = {}) {
  if (!metaLigado().instagram) throw new ErroMeta('O Instagram da RBTech ainda não está ligado (faltam META_ACCESS_TOKEN e META_IG_USER_ID na Vercel).');
  const ig = contaInstagram();
  const dias = DIAS[periodo] || 7;
  const ate = Math.floor(Date.now() / 1000);
  const desde = ate - Math.min(dias * 86400, 30 * 86400 - 3600);

  const [perfil, totais, seguir, crescimento] = await Promise.all([
    graph(ig, { fields: 'username,name,biography,website,followers_count,follows_count,media_count' }),
    insightsTolerante(`${ig}/insights`,
      ['reach', 'views', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'shares', 'saves', 'replies', 'profile_links_taps'],
      { period: 'day', metric_type: 'total_value', since: desde, until: ate }),
    insightsTolerante(`${ig}/insights`, ['follows_and_unfollows'],
      { period: 'day', metric_type: 'total_value', breakdown: 'follow_type', since: desde, until: ate }),
    insightsTolerante(`${ig}/insights`, ['follower_count'], { period: 'day', since: desde, until: ate - 86400 }),
  ]);

  const numeros = {};
  for (const m of totais.dados) numeros[m.name] = m.total_value?.value ?? null;
  const fu = seguir.dados[0]?.total_value;
  const quebra = fu?.breakdowns?.[0]?.results || [];
  const seguiram = quebra.find(r => r.dimension_values?.includes('FOLLOWER'))?.value ?? null;
  const deixaram = quebra.find(r => r.dimension_values?.includes('NON_FOLLOWER'))?.value ?? null;
  const serie = (crescimento.dados[0]?.values || []).map(v => ({ data: v.end_time?.slice(0, 10), novosSeguidores: v.value }));

  return {
    fonte: 'Instagram', periodo,
    perfil: {
      usuario: perfil.username, nome: perfil.name, bio: perfil.biography, site: perfil.website,
      seguidores: perfil.followers_count, seguindo: perfil.follows_count, posts: perfil.media_count,
    },
    numerosDoPeriodo: numeros,
    seguidores: { seguiram, deixaramDeSeguir: deixaram, porDia: serie },
    metricasIndisponiveis: [...totais.falhas, ...seguir.falhas, ...crescimento.falhas],
  };
}

export async function lerPosts({ quantidade = 12 } = {}) {
  if (!metaLigado().instagram) throw new ErroMeta('O Instagram da RBTech ainda não está ligado (faltam META_ACCESS_TOKEN e META_IG_USER_ID na Vercel).');
  const n = Math.max(1, Math.min(25, Math.round(Number(quantidade) || 12)));
  const lista = await graph(`${contaInstagram()}/media`, {
    fields: 'id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count',
    limit: n,
  });
  const posts = await Promise.all((lista.data || []).map(async m => {
    const reels = m.media_product_type === 'REELS';
    const metricas = reels
      ? ['reach', 'views', 'likes', 'comments', 'shares', 'saved', 'total_interactions', 'ig_reels_avg_watch_time']
      : ['reach', 'views', 'likes', 'comments', 'shares', 'saved', 'total_interactions'];
    let numeros = {};
    let indisponiveis = [];
    try {
      const r = await insightsTolerante(`${m.id}/insights`, metricas, {});
      for (const x of r.dados) numeros[x.name] = x.values?.[0]?.value ?? x.total_value?.value ?? null;
      indisponiveis = r.falhas;
    } catch (e) {
      indisponiveis = metricas;
      if (e.codigo === 190) throw e;
    }
    if (numeros.ig_reels_avg_watch_time != null) numeros.tempoMedioAssistidoSeg = +(numeros.ig_reels_avg_watch_time / 1000).toFixed(1);
    delete numeros.ig_reels_avg_watch_time;
    return {
      id: m.id,
      tipo: reels ? 'reels' : m.media_type === 'CAROUSEL_ALBUM' ? 'carrossel' : m.media_type === 'VIDEO' ? 'video' : 'foto',
      data: m.timestamp, link: m.permalink,
      legenda: (m.caption || '').slice(0, 700),
      curtidas: m.like_count ?? null, comentarios: m.comments_count ?? null,
      numeros, ...(indisponiveis.length ? { metricasIndisponiveis: indisponiveis } : {}),
    };
  }));
  return { fonte: 'Instagram', quantidade: posts.length, posts };
}

/** Resumo curto para a tela de seguidores do escritório. */
export async function lerStatus() {
  const ligado = metaLigado();
  const status = { ligado };
  if (ligado.instagram) {
    try {
      const p = await graph(contaInstagram(), { fields: 'username,followers_count' });
      status.instagram = { usuario: p.username, seguidores: p.followers_count };
    } catch (e) { status.erroInstagram = e.message; }
  }
  return status;
}

/** Executa a ferramenta pedida por um funcionário. */
export async function executarFerramentaMeta(nome, entrada = {}) {
  if (nome === 'ler_metricas_anuncios') return lerAnuncios(entrada);
  if (nome === 'ler_metricas_instagram') return lerInstagram(entrada);
  if (nome === 'ler_posts_instagram') return lerPosts(entrada);
  throw new ErroMeta(`Ferramenta desconhecida: ${nome}`);
}

// ---------- publicar no Instagram (Content Publishing API) ----------
// A Meta baixa a mídia de um endereço público: por isso o arquivo sobe antes para o Blob da Vercel.
const esperar = ms => new Promise(r => setTimeout(r, ms));

async function esperarContainer(id, prazo) {
  for (;;) {
    const st = await graph(id, { fields: 'status_code,status' });
    if (st.status_code === 'FINISHED') return 'pronto';
    if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') throw new ErroMeta(`A Meta não aceitou a mídia: ${st.status || st.status_code}`);
    if (Date.now() > prazo) return 'processando';
    await esperar(4000);
  }
}

/**
 * Publica um post, carrossel, reels ou stories. Vídeos podem demorar para a Meta processar:
 * se o prazo acabar, devolve { status: 'processando', container } e a publicação continua numa próxima chamada.
 */
export async function publicarNoInstagram({ tipo, midias, legenda, container }, { prazo }) {
  if (!metaLigado().instagram) throw new ErroMeta('O Instagram da RBTech ainda não está ligado (faltam META_ACCESS_TOKEN e META_IG_USER_ID).');
  const ig = contaInstagram();
  const ehVideo = m => /video/.test(m.tipo || '') || /\.(mp4|mov)(\?|$)/i.test(m.url);
  let id = container;
  if (!id) {
    if (!midias?.length) throw new ErroMeta('Nenhuma mídia para publicar.');
    if (tipo === 'carrossel') {
      if (midias.length < 2) throw new ErroMeta('O carrossel precisa de pelo menos 2 arquivos.');
      const filhos = [];
      for (const m of midias.slice(0, 10)) {
        const f = await graph(`${ig}/media`, ehVideo(m) ? { media_type: 'VIDEO', video_url: m.url, is_carousel_item: true } : { image_url: m.url, is_carousel_item: true }, 'POST');
        filhos.push(f.id);
      }
      for (const f of filhos) if ((await esperarContainer(f, prazo)) !== 'pronto') return { status: 'processando', aviso: 'Os vídeos do carrossel ainda estão processando. Tente publicar de novo em 1 minuto.' };
      id = (await graph(`${ig}/media`, { media_type: 'CAROUSEL', children: filhos.join(','), caption: legenda }, 'POST')).id;
    } else {
      const m = midias[0];
      let params;
      if (tipo === 'reels') params = { media_type: 'REELS', video_url: m.url, caption: legenda, share_to_feed: true };
      else if (tipo === 'stories') params = ehVideo(m) ? { media_type: 'STORIES', video_url: m.url } : { media_type: 'STORIES', image_url: m.url };
      else params = ehVideo(m) ? { media_type: 'REELS', video_url: m.url, caption: legenda, share_to_feed: true } : { image_url: m.url, caption: legenda };
      id = (await graph(`${ig}/media`, params, 'POST')).id;
    }
  }
  if ((await esperarContainer(id, prazo)) !== 'pronto') return { status: 'processando', container: id };
  const publicado = await graph(`${ig}/media_publish`, { creation_id: id }, 'POST');
  let permalink = null;
  try { permalink = (await graph(publicado.id, { fields: 'permalink' })).permalink; } catch { /* sem link, segue */ }
  return { status: 'publicado', midiaId: publicado.id, permalink };
}
