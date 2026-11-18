// Central de conteúdo do Instagram da RBTech (veio do antigo "Agente de Reels e Stories", agora dentro do prédio).
// Quem cuida:
//   - Stories do dia (todo dia ~8h) e ideias de trend: Especialista de crescimento, do time da Helena.
//   - Relatório semanal de reels virais (segunda ~8h): Roteirista de vídeo, do time da Pamella.
// Cada rotina é UMA chamada ao Claude (sem reunião do chefe), para economizar tokens.
// Toda a análise (engajamento, mediana, virais, padrões) é do Claude; o código só coleta e entrega os dados.
//
// Dados guardados no Redis do prédio (Upstash): configuração, stories, reels, ideias e o quadro do gestor.
// Prints dos stories das concorrentes: Blob da Vercel (o mesmo das mídias do Instagram).
// WhatsApp (opcional): WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_DESTINATARIOS, WHATSAPP_MODO,
//   WHATSAPP_TEMPLATE, WHATSAPP_TEMPLATE_IDIOMA, WHATSAPP_VERIFY_TOKEN e META_APP_SECRET (webhook).
import crypto from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { put, list, del } from '@vercel/blob';
import { graph, contaInstagram, metaLigado } from './_meta.js';
import { lerItem, salvarItem, listarIds, apagarItem, armazemLigado, salvarRotina } from './_armazem.js';
import { modeloDe, esforcoDe } from './_agentes.js';

export const FUSO = 'America/Sao_Paulo';
export class ErroConteudo extends Error {}

const exigirArmazem = () => {
  if (!armazemLigado()) throw new ErroConteudo('Falta ligar o Redis na Vercel: no projeto do prédio, abra Storage → Create Database → Upstash for Redis → crie e conecte ao projeto (marque Production) → depois Deployments → Redeploy.');
};
const exigirInstagram = () => {
  if (!metaLigado().instagram) throw new ErroConteudo('O Instagram da RBTech não está ligado (faltam META_ACCESS_TOKEN e META_IG_USER_ID na Vercel).');
};

// ======================================================================
// Configuração (lojas de referência, estoque, sobre a loja, transcrições)
// ======================================================================
export function normalizarContas(json = {}) {
  const contasReferencia = (json.contasReferencia ?? [])
    .map(c => String(c).replace(/^@/, '').trim().toLowerCase())
    .filter(c => /^[a-z0-9._]{1,30}$/.test(c));
  const inteiro = (v, padrao, min, max) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : padrao;
  };
  return {
    contasReferencia: [...new Set(contasReferencia)],
    quantidadeRoteiros: inteiro(json.quantidadeRoteiros, 5, 1, 10),
    quantidadeStories: inteiro(json.quantidadeStories, 20, 5, 30),
    diasAnalise: inteiro(json.diasAnalise, 30, 7, 90),
    postsPorConta: inteiro(json.postsPorConta, 50, 10, 100),
  };
}

export async function lerTextosLoja() {
  const c = (await lerItem('conteudo', 'config')) || {};
  return { loja: c.loja || '', estoque: c.estoque || '', transcricoes: c.transcricoes || '', contas: normalizarContas(c.contas || {}) };
}

export async function salvarTextosLoja(t = {}) {
  exigirArmazem();
  const atual = await lerTextosLoja();
  const texto = (v, antes) => (typeof v === 'string' ? v.slice(0, 20000) : antes);
  await salvarItem('conteudo', {
    id: 'config',
    quando: Date.now(),
    loja: texto(t.loja, atual.loja),
    estoque: texto(t.estoque, atual.estoque),
    transcricoes: texto(t.transcricoes, atual.transcricoes),
    contas: t.contas ? normalizarContas({ ...atual.contas, ...t.contas }) : atual.contas,
  });
  return lerTextosLoja();
}

const LOJA_PADRAO = 'RBTech (às vezes escrita RBtec): loja de iPhones e celulares em Florianópolis (SC). O cliente chega pelo Instagram e conversa pelo WhatsApp. Identidade amarelo e preto.';

async function carregarConfigLoja({ exigirReferencias = true } = {}) {
  const textos = await lerTextosLoja();
  const avisos = [];
  if (exigirReferencias && !textos.contas.contasReferencia.length) {
    throw new ErroConteudo('Nenhuma loja de referência cadastrada. Cadastre na Central de conteúdo, em Configurações.');
  }
  if (!textos.contas.contasReferencia.length) avisos.push('Nenhuma loja de referência cadastrada: o roteiro usou só a época e o estoque.');
  let sobreALoja = textos.loja.trim();
  if (!sobreALoja) {
    sobreALoja = LOJA_PADRAO;
    avisos.push('"Sobre a loja" está vazio na Central de conteúdo: usei uma descrição curta da RBTech.');
  }
  return { contas: textos.contas, sobreALoja, estoque: textos.estoque.trim(), transcricoes: textos.transcricoes.trim(), avisos };
}

// ======================================================================
// Claude: uma chamada por tarefa (streaming, fallback no servidor, busca na internet quando pedida)
// ======================================================================
const client = new Anthropic();

async function perguntar({ papel, sistema, texto, imagens = [], esquema, buscas = 0 }) {
  const model = modeloDe(papel);
  const effort = esforcoDe(papel);
  const conteudo = [];
  for (const im of imagens) {
    conteudo.push({ type: 'text', text: im.legenda });
    conteudo.push({
      type: 'image',
      source: im.url.startsWith('data:')
        ? { type: 'base64', media_type: im.url.slice(5, im.url.indexOf(';')), data: im.url.slice(im.url.indexOf(',') + 1) }
        : { type: 'url', url: im.url },
    });
  }
  conteudo.push({ type: 'text', text: texto });
  const haiku = /haiku/i.test(model);
  const tools = buscas
    ? [{
        type: haiku ? 'web_search_20250305' : 'web_search_20260209',
        name: 'web_search',
        max_uses: buscas,
        user_location: { type: 'approximate', country: 'BR', region: 'SC', city: 'Florianópolis', timezone: FUSO },
      }]
    : [];

  const messages = [{ role: 'user', content: conteudo }];
  const textos = [];
  const fontes = new Map();
  for (let rodada = 0; rodada < 4; rodada++) {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 64000,
      thinking: { type: 'adaptive' },
      output_config: { effort, ...(esquema ? { format: { type: 'json_schema', schema: esquema } } : {}) },
      ...(haiku ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }),
      system: sistema,
      messages,
      ...(tools.length ? { tools } : {}),
    });
    const r = await stream.finalMessage();
    if (r.stop_reason === 'refusal') throw new ErroConteudo(`O Claude recusou o pedido (${r.stop_details?.category ?? 'sem categoria'}).`);
    if (r.stop_reason === 'max_tokens') throw new ErroConteudo('A resposta passou do limite de tamanho e veio cortada.');
    for (const b of r.content) {
      // texto escrito antes de uma busca ("Vou pesquisar...") não faz parte da resposta final
      if (b.type === 'server_tool_use' || b.type === 'web_search_tool_result') { textos.length = 0; continue; }
      if (b.type !== 'text') continue;
      textos.push(b.text);
      for (const c of b.citations ?? []) {
        if (c.type === 'web_search_result_location' && !fontes.has(c.url)) fontes.set(c.url, { titulo: c.title ?? c.url, url: c.url });
      }
    }
    console.log(`Conteúdo (${papel}): ${r.model}, ${r.usage.input_tokens} tokens de entrada, ${r.usage.output_tokens} de saída, parada ${r.stop_reason}.`);
    if (r.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: r.content });
  }
  const resposta = textos.join('').trim();
  if (!resposta) throw new ErroConteudo('O Claude não devolveu texto.');
  return { texto: resposta, fontes: [...fontes.values()] };
}

// ======================================================================
// Instagram (API da Meta): lojas de referência e a própria RBTech
// ======================================================================
const CAMPOS_POST = 'caption,like_count,comments_count,media_type,media_product_type,permalink,timestamp';

/** Posts de uma loja de referência. Só funciona com contas comerciais ou de criador. */
async function buscarContaReferencia(username, limite) {
  const campos = `business_discovery.username(${username}){username,followers_count,media_count,media.limit(${limite}){${CAMPOS_POST}}}`;
  const { business_discovery: bd } = await graph(contaInstagram(), { fields: campos });
  return { username: bd.username, followers_count: bd.followers_count, media_count: bd.media_count, posts: bd.media?.data ?? [] };
}

/** Métricas de um post ou story. Os nomes mudam entre versões da API: tenta da mais completa para a mais simples. */
async function buscarInsights(id, combinacoes) {
  for (const metric of combinacoes) {
    try {
      const { data } = await graph(`${id}/insights`, { metric });
      const saida = {};
      for (const m of data) {
        const v = m.total_value?.value ?? m.values?.[0]?.value;
        if (typeof v === 'number') saida[m.name] = v;
      }
      return saida;
    } catch { /* tenta a próxima */ }
  }
  return {};
}

/** Posts recentes da RBTech; os dos últimos 7 dias ganham alcance e visualizações. */
async function buscarPostsProprios(agora, limite = 30) {
  const { data } = await graph(`${contaInstagram()}/media`, { fields: `id,${CAMPOS_POST}`, limit: limite });
  const inicioSemana = agora.getTime() - 7 * 864e5;
  return Promise.all(data.map(async post => {
    if (new Date(post.timestamp).getTime() < inicioSemana) return post;
    const m = await buscarInsights(post.id, ['reach,views', 'reach']);
    return { ...post, alcance: m.reach, visualizacoes: m.views };
  }));
}

/** Stories da RBTech ainda no ar (últimas 24 h). A API não entrega stories de outras contas. */
async function buscarStoriesProprios() {
  const { data } = await graph(`${contaInstagram()}/stories`, { fields: 'id,media_type,permalink,timestamp,caption' });
  return Promise.all(data.map(async ({ id, ...story }) => ({ ...story, metricas: await buscarInsights(id, ['reach,views,replies', 'reach,replies', 'reach']) })));
}

/** Coleta das lojas de referência: um erro numa conta vira aviso e não derruba as outras. */
async function coletarReferencias(contas, postsPorConta, avisos) {
  const resultados = await Promise.allSettled(contas.map(c => buscarContaReferencia(c, postsPorConta)));
  const referencias = [];
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') referencias.push(r.value);
    else avisos.push(`Não consegui ler @${contas[i]}: ${r.reason?.message || r.reason}`);
  });
  return referencias;
}

const semId = posts => posts.map(({ id: _id, ...resto }) => resto);
const desde = (posts, inicio) => semId(posts.filter(p => new Date(p.timestamp).getTime() >= inicio));

// ======================================================================
// Datas comerciais (o código só calcula quando cada data cai; a estratégia é do Claude)
// ======================================================================
const utc = d => Date.UTC(d.ano, d.mes - 1, d.dia);
const deUtc = ms => { const d = new Date(ms); return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() }; };
const somarDias = (d, n) => deUtc(utc(d) + n * 864e5);
const diaDaSemana = d => new Date(utc(d)).getUTCDay();

export function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  return { ano, mes, dia: ((h + l - 7 * m + 114) % 31) + 1 };
}
function enesimo(ano, mes, semana, n) {
  let d = { ano, mes, dia: 1 };
  while (diaDaSemana(d) !== semana) d = somarDias(d, 1);
  return somarDias(d, 7 * (n - 1));
}
export function blackFriday(ano) {
  let d = { ano, mes: 11, dia: 30 };
  while (diaDaSemana(d) !== 5) d = somarDias(d, -1);
  return d;
}
function datasDoAno(ano) {
  const p = pascoa(ano), bf = blackFriday(ano);
  return [
    { nome: 'Ano Novo', dia: { ano, mes: 1, dia: 1 } },
    { nome: 'Volta às aulas (fevereiro)', dia: { ano, mes: 2, dia: 1 } },
    { nome: 'Carnaval', dia: somarDias(p, -47) },
    { nome: 'Dia do Consumidor', dia: { ano, mes: 3, dia: 15 } },
    { nome: 'Páscoa', dia: p },
    { nome: 'Dia das Mães', dia: enesimo(ano, 5, 0, 2) },
    { nome: 'Dia dos Namorados', dia: { ano, mes: 6, dia: 12 } },
    { nome: 'Dia dos Pais', dia: enesimo(ano, 8, 0, 2) },
    { nome: 'Lançamento do novo iPhone (data aproximada, a Apple anuncia em setembro)', dia: enesimo(ano, 9, 2, 2) },
    { nome: 'Dia do Cliente', dia: { ano, mes: 9, dia: 15 } },
    { nome: 'Dia das Crianças', dia: { ano, mes: 10, dia: 12 } },
    { nome: 'Black Friday', dia: bf },
    { nome: 'Cyber Monday', dia: somarDias(bf, 3) },
    { nome: 'Prazo da 1ª parcela do 13º salário', dia: { ano, mes: 11, dia: 30 } },
    { nome: 'Começo da alta temporada de verão em Florianópolis', dia: { ano, mes: 12, dia: 15 } },
    { nome: 'Prazo da 2ª parcela do 13º salário', dia: { ano, mes: 12, dia: 20 } },
    { nome: 'Natal', dia: { ano, mes: 12, dia: 25 } },
  ];
}
function hojeNoFuso(agora) {
  const [ano, mes, dia] = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora).split('-').map(Number);
  return { ano, mes, dia };
}
const formatarDia = d => `${String(d.dia).padStart(2, '0')}/${String(d.mes).padStart(2, '0')}/${d.ano}`;
export function proximasDatas(agora, dias = 45) {
  const hoje = hojeNoFuso(agora);
  return [...datasDoAno(hoje.ano), ...datasDoAno(hoje.ano + 1)]
    .map(({ nome, dia }) => ({ nome, data: formatarDia(dia), diasAte: Math.round((utc(dia) - utc(hoje)) / 864e5) }))
    .filter(d => d.diasAte >= 0 && d.diasAte <= dias)
    .sort((a, b) => a.diasAte - b.diasAte);
}
const dataPorExtenso = agora => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'full' }).format(agora);
export function dataLocal(agora) {
  const d = hojeNoFuso(agora);
  return `${d.ano}-${String(d.mes).padStart(2, '0')}-${String(d.dia).padStart(2, '0')}`;
}
const formatarCurto = d => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short' }).format(d);

// ======================================================================
// Prints dos stories das concorrentes (Blob da Vercel; no computador, memória)
// ======================================================================
const TIPOS_IMAGEM = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const TAMANHO_MAXIMO = 3 * 1024 * 1024;
const MAX_PRINTS = 30;
/** Chave do Blob: BLOB_READ_WRITE_TOKEN ou outra que a Vercel criou com prefixo (sempre começa com vercel_blob_rw_). */
export const tokenBlob = () => process.env.BLOB_READ_WRITE_TOKEN || Object.values(process.env).find(v => String(v || '').startsWith('vercel_blob_rw_'));
const blobLigado = () => !!tokenBlob();
const printsNaMemoria = [];
export const tipoAceito = t => !!t && t in TIPOS_IMAGEM;

export async function salvarPrint(dados, tipo, agora = new Date()) {
  const caminho = `conteudo/prints/${dataLocal(agora)}/${agora.getTime()}-${crypto.randomBytes(3).toString('hex')}.${TIPOS_IMAGEM[tipo]}`;
  if (!blobLigado()) {
    if (process.env.VERCEL) throw new ErroConteudo('Ligue o Blob na Vercel (Storage → Blob) para enviar prints.');
    const url = `data:${tipo};base64,${dados.toString('base64')}`;
    printsNaMemoria.push({ caminho, url });
    return url;
  }
  const b = await put(caminho, dados, { access: 'public', contentType: tipo, addRandomSuffix: false, token: tokenBlob() });
  return b.url;
}

/** Prints dos dias pedidos (AAAA-MM-DD), mais antigos primeiro: [{ url, dia, enviadoEm }]. */
export async function listarPrints(dias) {
  const saida = [];
  for (const dia of dias) {
    const prefixo = `conteudo/prints/${dia}/`;
    if (!blobLigado()) {
      for (const p of printsNaMemoria) if (p.caminho.startsWith(prefixo)) saida.push({ url: p.url, dia, enviadoEm: Number(p.caminho.split('/').pop().split('-')[0]) });
      continue;
    }
    let cursor;
    do {
      const pagina = await list({ prefix: prefixo, cursor, token: tokenBlob() });
      for (const b of pagina.blobs) saida.push({ url: b.url, dia, enviadoEm: Number(b.pathname.split('/').pop().split('-')[0]) || 0 });
      cursor = pagina.hasMore ? pagina.cursor : undefined;
    } while (cursor);
  }
  return saida.sort((a, b) => a.enviadoEm - b.enviadoEm);
}

export async function apagarPrint(url) {
  if (url.startsWith('data:')) {
    const i = printsNaMemoria.findIndex(p => p.url === url);
    if (i >= 0) printsNaMemoria.splice(i, 1);
    return true;
  }
  let u;
  try { u = new URL(url); } catch { return false; }
  if (!u.hostname.endsWith('.public.blob.vercel-storage.com') || !u.pathname.startsWith('/conteudo/prints/')) return false;
  await del(url, { token: tokenBlob() });
  return true;
}

// ======================================================================
// Stories do dia — Especialista de crescimento (time da Helena)
// ======================================================================
const DIAS_DE_POSTS = 3;
const txt = { type: 'string' };
export const ESQUEMA_STORIES = {
  type: 'object', additionalProperties: false, required: ['resumo', 'stories'],
  properties: {
    resumo: {
      type: 'object', additionalProperties: false, required: ['epoca', 'estrategiaDoDia', 'oQueAsConcorrentesFizeram', 'observacoes'],
      properties: {
        epoca: { ...txt, description: 'Momento comercial e datas próximas que pesam hoje.' },
        estrategiaDoDia: { ...txt, description: 'A linha do dia em 2 a 4 frases: objetivo, oferta principal, ritmo.' },
        oQueAsConcorrentesFizeram: { ...txt, description: 'O que as lojas de referência postaram ontem e o que se destacou. Diga se não houve dados.' },
        observacoes: { ...txt, description: 'Avisos: produto fora do estoque, dado faltando etc. Vazio se nada.' },
      },
    },
    stories: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['numero', 'horario', 'tipo', 'objetivo', 'cena', 'fala', 'textoNaTela', 'interacao', 'produto', 'inspiracao'],
        properties: {
          numero: { type: 'integer' },
          horario: { ...txt, description: 'Horário sugerido para postar, ex.: 09:30.' },
          tipo: { ...txt, description: 'Bastidor, produto, prova social, enquete, dica, oferta, contagem regressiva...' },
          objetivo: { ...txt, description: 'Para que serve este story na sequência do dia.' },
          cena: { ...txt, description: 'O que filmar ou fotografar e como enquadrar.' },
          fala: { ...txt, description: 'O que o dono fala. Vazio se for só imagem e texto.' },
          textoNaTela: txt,
          interacao: { ...txt, description: 'Figurinha: enquete, caixa de perguntas, quiz, link do WhatsApp... Vazio se nenhuma.' },
          produto: { ...txt, description: 'Produto do estoque, como o dono escreveu ou por extenso, ou vazio.' },
          inspiracao: { ...txt, description: "Post ou print de referência que inspirou, ou 'época' / 'estoque'." },
        },
      },
    },
  },
};

function promptStories(sobreALoja, quantidade) {
  return `Você é o Especialista de crescimento do time da Helena, no 2º andar do Prédio RBTech, e cuida dos stories da RBTech, uma loja de iPhones e celulares em Florianópolis. Todo dia de manhã você entrega ao dono o roteiro dos stories daquele dia, pronto para gravar com o celular, sozinho.

## Sobre a loja
${sobreALoja}

## O que você recebe
- A data de hoje e as datas comerciais das próximas semanas.
- Os posts e reels das lojas de referência dos últimos dias, como vieram da API do Instagram. A API não entrega os stories de outras contas, então isso é o que existe de dado automático delas.
- Às vezes, prints de stories das lojas de referência que o dono tirou e enviou. Quando houver, eles são a melhor pista do que as concorrentes fizeram nos stories.
- Os stories da própria RBTech das últimas 24 horas, com métricas quando a API devolver.
- O estoque da semana.

## Etapa 1 — O que as lojas de referência fizeram ontem
Foque no que foi publicado ontem. Para os posts, compare o engajamento (curtidas + 2 × comentários) de cada um com os outros posts da mesma conta para ver o que se destacou. Nos prints, identifique tipo de story, oferta, gancho, figurinhas usadas e sequência. Ignore sorteios. Se ontem não houver dados das concorrentes, diga isso e apoie o roteiro na época e no estoque.

## Etapa 2 — Estratégia da época
Olhe as datas comerciais próximas e decida o que pesa hoje: aquecimento, contagem regressiva, a data em si ou o pós. Pense também no dia da semana e no momento do mês (salário, 13º, temporada de verão em Florianópolis). A estratégia do dia tem que ser uma só, clara, e os stories inteiros servem a ela.

## Etapa 3 — Roteiro do dia
Escreva exatamente ${quantidade} stories, numerados em ordem, espalhados ao longo do dia, com horário sugerido para cada um.

Regras:
- Monte uma sequência com ritmo: abertura do dia, bastidores, produto, prova social, interação, educação, oferta e chamada para o WhatsApp. Não repita o mesmo tipo três vezes seguidas.
- Use figurinhas de interação (enquete, caixa de perguntas, quiz, contagem regressiva, link) em pelo menos um quarto dos stories.
- Adapte a fórmula, nunca o conteúdo. Não reaproveite frases, artes ou bordões de outras lojas.
- Use só produtos, preços e condições que estiverem no estoque e nas informações da loja. Nunca invente preço, especificação, garantia ou promoção. Se a estratégia pedir uma oferta que não existe, sugira em "observacoes" em vez de anunciar.
- O estoque é escrito pelo dono do jeito que ele quiser: lista, frases soltas, abreviações ("13 pro max 256 azul 4.2k pix"), erros de digitação, preços em formatos variados. Interprete com bom senso. Quando algo estiver incompleto ou ambíguo (preço sem dizer se é no Pix, modelo sem capacidade, condição pouco clara), use só a parte que está clara e não complete o resto por conta própria. Se faltar algo importante, diga em "observacoes".
- Escreva as falas como o dono falaria: português do Brasil, frases curtas, natural, sem cara de anúncio.
- Não fale mal de concorrentes nem de outras lojas.
- Cada story precisa ser possível de gravar em menos de um minuto, com o celular.`;
}

function mensagemStories(d) {
  const datas = d.datas.length
    ? d.datas.map(x => `- ${x.nome}: ${x.data} (${x.diasAte === 0 ? 'hoje' : `em ${x.diasAte} dia(s)`})`).join('\n')
    : 'Nenhuma data comercial nas próximas semanas.';
  return `Hoje é ${d.hoje}. Ontem foi ${d.ontem}.
Os horários dos posts (timestamp) estão em UTC. Florianópolis é UTC−3.

## Datas comerciais próximas
${datas}

## Prints de stories das lojas de referência
${d.quantidadePrints > 0 ? `${d.quantidadePrints} print(s), nas imagens acima.` : 'Nenhum print enviado.'}

## Posts das lojas de referência (últimos ${DIAS_DE_POSTS} dias)
${JSON.stringify(d.referencias, null, 2)}

## Stories da RBTech nas últimas 24 horas
${d.storiesProprios.length ? JSON.stringify(d.storiesProprios, null, 2) : 'Nenhum story no ar ou dado indisponível.'}

## Estoque da semana
${d.estoque || 'Lista de estoque não informada. Use exemplos genéricos e avise em observacoes.'}

## Avisos da coleta
${d.avisos.length ? d.avisos.map(a => `- ${a}`).join('\n') : 'Nenhum.'}

Monte o roteiro de stories de hoje.`;
}

export async function gerarStoriesDoDia(agora = new Date()) {
  exigirArmazem();
  exigirInstagram();
  const config = await carregarConfigLoja({ exigirReferencias: false });
  const avisos = [...config.avisos];
  const inicio = agora.getTime() - DIAS_DE_POSTS * 864e5;
  const ontem = new Date(agora.getTime() - 864e5);

  const referencias = (await coletarReferencias(config.contas.contasReferencia, 15, avisos))
    .map(c => ({ ...c, posts: desde(c.posts, inicio) }));
  let storiesProprios = [];
  try { storiesProprios = await buscarStoriesProprios(); } catch (e) { avisos.push(`Não consegui ler os stories da RBTech: ${e.message}`); }

  let prints = [];
  try { prints = (await listarPrints([dataLocal(ontem), dataLocal(agora)])).slice(-MAX_PRINTS); } catch (e) { avisos.push(`Não consegui ler os prints: ${e.message}`); }
  const fmt = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' });
  const imagens = prints.map((p, i) => ({ url: p.url, legenda: `Print ${i + 1} de story de loja de referência (enviado em ${fmt.format(new Date(p.enviadoEm))}):` }));

  const { texto } = await perguntar({
    papel: 'especialista',
    sistema: promptStories(config.sobreALoja, config.contas.quantidadeStories),
    texto: mensagemStories({
      hoje: dataPorExtenso(agora), ontem: dataPorExtenso(ontem), datas: proximasDatas(agora),
      referencias, storiesProprios, estoque: config.estoque, avisos, quantidadePrints: imagens.length,
    }),
    imagens,
    esquema: ESQUEMA_STORIES,
  });
  const roteiro = JSON.parse(texto);
  if (roteiro.stories.length !== config.contas.quantidadeStories) avisos.push(`Pedi ${config.contas.quantidadeStories} stories e vieram ${roteiro.stories.length}.`);
  const salvo = { ...roteiro, id: dataLocal(agora), data: dataLocal(agora), geradoEm: agora.toISOString(), quando: agora.getTime(), avisos, printsUsados: imagens.length };
  await salvarItem('stories', salvo);
  await podar('stories', 120);
  return salvo;
}

/** Os stories em texto (para a aba Entregas, o HTML e o chat). */
export function storiesEmTexto(r) {
  const linhas = [
    `### Estratégia do dia`, r.resumo.estrategiaDoDia, '',
    `**Época:** ${r.resumo.epoca}`, '',
    `**O que as concorrentes fizeram:** ${r.resumo.oQueAsConcorrentesFizeram}`,
  ];
  if (r.resumo.observacoes) linhas.push('', `**Observações:** ${r.resumo.observacoes}`);
  for (const s of r.stories) {
    linhas.push('', `### ${s.numero}. ${s.horario} · ${s.tipo}`, `- **Objetivo:** ${s.objetivo}`, `- **Cena:** ${s.cena}`);
    if (s.fala) linhas.push(`- **Fala:** "${s.fala}"`);
    if (s.textoNaTela) linhas.push(`- **Texto na tela:** ${s.textoNaTela}`);
    if (s.interacao) linhas.push(`- **Figurinha:** ${s.interacao}`);
    if (s.produto) linhas.push(`- **Produto:** ${s.produto}`);
    if (s.inspiracao) linhas.push(`- **Inspiração:** ${s.inspiracao}`);
  }
  if (r.avisos?.length) linhas.push('', '**Avisos da coleta:**', ...r.avisos.map(a => `- ${a}`));
  return linhas.join('\n');
}

// ======================================================================
// Relatório semanal de reels — Roteirista de vídeo (time da Pamella)
// ======================================================================
function promptReels(sobreALoja, quantidadeRoteiros) {
  return `Você é o Roteirista de vídeo do time de tráfego da Pamella, no 2º andar do Prédio RBTech, e cuida dos reels da RBTech, uma loja de iPhones e celulares em Florianópolis. Toda semana você recebe dados de posts de lojas de referência do mesmo nicho e transforma isso em roteiros de reels que o dono da loja vai gravar.

O objetivo é simples: descobrir o que está dando resultado para outras lojas, entender por quê, e adaptar isso para a RBTech, sem copiar ninguém.

## Sobre a loja
${sobreALoja}

## Etapa 1 — Encontrar o que viralizou
Para cada conta de referência:
- Calcule o engajamento de cada post: curtidas + 2 × comentários (comentário vale mais porque exige mais esforço).
- Calcule a mediana de engajamento daquela conta no período.
- Multiplicador = engajamento do post ÷ mediana da conta.
- Considere "viral" o post com multiplicador 3 ou mais. Entre 2 e 3, "acima da média".

Comparar cada post com a própria conta é o que importa: um reel com 800 curtidas numa conta que costuma ter 100 diz mais do que um com 5.000 numa conta que sempre tem 4.000.

Descarte da análise:
- Sorteios e posts do tipo "comente e marque amigos": inflam comentários e não ensinam nada sobre conteúdo.
- Posts com menos de 48 horas: ainda estão crescendo.
- Contas com menos de 5 posts no período: não dá para calcular mediana confiável.

Se a mensagem trouxer avisos da coleta (conta que não pôde ser lida, por exemplo), mencione no resumo em uma linha.

## Etapa 2 — Entender por que funcionou
Para cada post viral, identifique com base na legenda e na transcrição (quando houver):
- Formato: pessoa falando para a câmera, POV, unboxing, comparação, antes e depois, bastidores, prova social (cliente recebendo), teste (bateria, câmera, queda), mito ou verdade, preço revelado no final, etc.
- Gancho: a primeira frase ou o que aparece nos primeiros 3 segundos.
- Tema: o assunto de fundo (medo de golpe no seminovo, bateria, preço, troca, lançamento, comparação entre modelos...).
- Oferta e chamada para ação: o que o vídeo pede para a pessoa fazer.

Sem transcrição, você só tem a legenda: deixe claro quando o formato ou o gancho for uma dedução a partir dela.

Depois, procure padrões que se repetem. Só chame de padrão algo que aparece em pelo menos 2 contas diferentes; o que aparece em uma conta só, chame de "sinal fraco". Se os dados da semana forem poucos ou inconclusivos, diga isso claramente em vez de forçar conclusões.

Se houver dados dos posts da própria RBTech da semana anterior, compare: o que funcionou e o que não funcionou para a loja, e use isso para ajustar os roteiros.

## Etapa 3 — Escrever os roteiros
Escreva ${quantidadeRoteiros} roteiros para o dono gravar com o celular, sozinho, em poucos minutos cada.

Regras:
- Adapte a fórmula, nunca o conteúdo. Não reaproveite frases, piadas ou bordões de outras lojas. O Instagram reduz o alcance de conteúdo copiado, e a loja precisa de identidade própria.
- Use só produtos, preços e condições que estiverem no estoque e nas informações da loja. Se um roteiro pedir um produto que não está no estoque, use um exemplo genérico e avise. Nunca invente preço, especificação, garantia ou promoção.
- O estoque é escrito pelo dono do jeito que ele quiser: lista, frases soltas, abreviações ("13 pro max 256 azul 4.2k pix"), erros de digitação, preços em formatos variados. Interprete com bom senso. Quando algo estiver incompleto ou ambíguo (preço sem dizer se é no Pix, modelo sem capacidade, condição pouco clara), use só a parte que está clara e não complete o resto por conta própria.
- Escreva como o dono falaria: português do Brasil, frases curtas, natural, sem cara de anúncio. Nada de gírias forçadas.
- Não fale mal de concorrentes nem de outras lojas.
- O gancho é o mais importante: ele precisa prender nos primeiros 3 segundos.
- Varie os formatos entre os roteiros da semana.

## Formato da resposta
A resposta vai ser enviada pelo WhatsApp. Use *negrito* com um asterisco, listas com "•", e nada de tabelas, títulos com # ou negrito com dois asteriscos. Responda só com o relatório, sem introdução nem despedida.

*📊 RESUMO DA SEMANA*
• Quantas contas e posts foram analisados
• Os 3 a 5 posts mais virais: conta, multiplicador, formato, gancho e link
• Padrões encontrados (e sinais fracos, separados)
• Como foi a RBTech na semana anterior (se houver dados)

Depois, para cada roteiro:

*🎬 ROTEIRO [número] — [nome curto]*
*Inspirado em:* [padrão + link do post de referência]
*Por que deve funcionar:* [1 frase]
*Duração:* [em segundos]
*Cenário:* [onde gravar, enquadramento, o que aparece]
*Produto:* [do estoque]

*Gancho (0–3s)*
Fala: "..."
Texto na tela: "..."

*Desenvolvimento*
• Fala: "..." | Na tela: "..."
• (uma linha por corte)

*Chamada final*
Fala: "..."

*Legenda:* [legenda pronta, com chamada para o WhatsApp e até 5 hashtags]
*Melhor horário sugerido:* [com base nos horários dos posts virais; diga que é uma estimativa]`;
}

function mensagemReels(d) {
  const proprios = d.proprios.length ? JSON.stringify(d.proprios, null, 2) : 'Sem posts da RBTech nos últimos 7 dias.';
  return `Período analisado: ${d.periodo.inicio} a ${d.periodo.fim}
Data e hora da coleta: ${d.agora}
Os horários dos posts (timestamp) estão em UTC. Florianópolis é UTC−3.

## Posts das contas de referência
${JSON.stringify(d.referencias, null, 2)}

## Avisos da coleta
${d.avisos.length ? d.avisos.map(a => `- ${a}`).join('\n') : 'Nenhum.'}

## Transcrições
${d.transcricoes || 'Nenhuma transcrição esta semana.'}

## Produtos em estoque esta semana
${d.estoque || 'Lista de estoque não informada. Use exemplos genéricos e avise em cada roteiro.'}

## Resultados da RBTech na semana passada
${proprios}

Gere o relatório e os roteiros desta semana.`;
}

export async function gerarRelatorioReels(agora = new Date()) {
  exigirArmazem();
  exigirInstagram();
  const config = await carregarConfigLoja();
  const avisos = [...config.avisos];
  const { diasAnalise, postsPorConta, contasReferencia, quantidadeRoteiros } = config.contas;
  const brutas = await coletarReferencias(contasReferencia, postsPorConta, avisos);
  if (!brutas.length) throw new ErroConteudo(`Nenhuma conta de referência pôde ser lida.\n${avisos.join('\n')}`);
  let proprios = [];
  try { proprios = await buscarPostsProprios(agora); } catch (e) { avisos.push(`Não consegui ler os posts da própria RBTech: ${e.message}`); }

  const inicio = new Date(agora.getTime() - diasAnalise * 864e5);
  const periodo = { inicio: formatarCurto(inicio), fim: formatarCurto(agora) };
  const { texto } = await perguntar({
    papel: 'roteirista',
    sistema: promptReels(config.sobreALoja, quantidadeRoteiros),
    texto: mensagemReels({
      periodo, agora: agora.toISOString(),
      referencias: brutas.map(c => ({ ...c, posts: desde(c.posts, inicio.getTime()) })),
      proprios: desde(proprios, agora.getTime() - 7 * 864e5),
      avisos, transcricoes: config.transcricoes, estoque: config.estoque,
    }),
  });
  const salvo = {
    id: dataLocal(agora), quando: agora.getTime(), geradoEm: agora.toISOString(),
    periodo: `${periodo.inicio} a ${periodo.fim}`, texto, partes: dividirMensagem(texto), avisos, entreguePara: [],
  };
  await salvarItem('reels', salvo);
  await podar('reels', 60);
  return salvo;
}

/** Texto do WhatsApp (*negrito*, •) em markdown para o prédio. */
export const whatsappParaMarkdown = t => t.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1**$2**').replace(/^•\s?/gm, '- ');

// ======================================================================
// Ideia avulsa com pesquisa na internet — Especialista de crescimento
// ======================================================================
const MAX_BUSCAS = 6;
function promptIdeias(sobreALoja) {
  return `Você é o Especialista de crescimento do time da Helena, no 2º andar do Prédio RBTech, e cria conteúdo para o Instagram da RBTech, uma loja de iPhones e celulares em Florianópolis. Quando o dono pede, você cria uma ideia de conteúdo avulsa pegando carona no que está viralizando no momento.

## Sobre a loja
${sobreALoja}

## Etapa 1 — Descobrir o que está em alta
Use a busca na internet para descobrir o que está bombando agora no Brasil: assuntos do momento, lançamentos, memes, trends do Instagram e do TikTok, áudios em alta, jogos, séries, futebol, notícias de tecnologia. Se o dono informar um tema, pesquise sobre ele (o que está acontecendo, por que está em alta, como as pessoas estão falando disso).

Escolha UM assunto que:
- esteja realmente em alta agora (prefira coisas das últimas duas semanas);
- dê para ligar de forma natural com celular, iPhone ou com a loja;
- não seja tragédia, crime, política, religião, doença ou polêmica pesada.

## Etapa 2 — Criar o conteúdo
Crie exatamente 1 story, 1 reels e 1 post para o feed, todos sobre o mesmo assunto, que o dono consiga gravar sozinho com o celular.

Regras:
- A ligação com o assunto tem que ser esperta e leve, não forçada.
- Use a referência sem usar material de terceiros: nada de logo, trilha ou cena original de jogo, filme ou música com direitos. Recrie com a loja, os produtos e o próprio dono.
- Use só produtos, preços e condições que estiverem no estoque e nas informações da loja. O estoque é escrito do jeito que o dono quiser; interprete com bom senso e não complete o que estiver ambíguo. Nunca invente preço, especificação, garantia ou promoção.
- Escreva como o dono falaria: português do Brasil, frases curtas, natural, sem cara de anúncio.
- Não fale mal de concorrentes.

## Formato da resposta
Responda só com o conteúdo abaixo, sem introdução nem despedida. Use *negrito* com um asterisco, listas com "•" e nada de tabelas ou títulos com #.

*🔥 O QUE ESTÁ EM ALTA*
• Assunto: [qual é]
• Por que está bombando: [1 ou 2 frases]
• Ligação com a RBTech: [1 frase]
• Validade: [quanto tempo a trend deve durar; quando postar]

*📱 STORY*
*Cena:* [o que filmar]
*Fala:* "..."
*Texto na tela:* "..."
*Figurinha:* [enquete, caixa de perguntas, quiz, link...]

*🎬 REELS*
*Duração:* [segundos]
*Gancho (0–3s)*
Fala: "..."
Texto na tela: "..."
*Desenvolvimento*
• Fala: "..." | Na tela: "..."
• (uma linha por corte)
*Chamada final*
Fala: "..."
*Áudio:* [sugestão: áudio em alta no Instagram ou voz original]
*Legenda:* [pronta, com chamada para o WhatsApp e até 5 hashtags]

*🖼️ POST*
*Formato:* [foto única ou carrossel com N cards]
• Card 1: [texto e imagem]
• (um por card)
*Legenda:* [pronta, com chamada para o WhatsApp e até 5 hashtags]`;
}

function idIdeia(agora) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(agora);
  const p = t => partes.find(x => x.type === t)?.value ?? '00';
  return `${p('year')}-${p('month')}-${p('day')}T${p('hour')}-${p('minute')}-${p('second')}`;
}

export async function gerarIdeia(tema = '', agora = new Date()) {
  exigirArmazem();
  const config = await carregarConfigLoja({ exigirReferencias: false });
  const temaLimpo = String(tema).trim().slice(0, 200);
  const datas = proximasDatas(agora, 30).map(d => `- ${d.nome}: ${d.data}`).join('\n');
  const { texto, fontes } = await perguntar({
    papel: 'especialista',
    sistema: promptIdeias(config.sobreALoja),
    texto: `Hoje é ${dataPorExtenso(agora)}.

## Tema pedido pelo dono
${temaLimpo || 'Nenhum. Descubra o que está viralizando agora e escolha o melhor assunto.'}

## Datas comerciais próximas (para combinar, se fizer sentido)
${datas || 'Nenhuma nas próximas semanas.'}

## Estoque da semana
${config.estoque || 'Não informado. Use exemplos genéricos e avise.'}

Crie a ideia de conteúdo.`,
    buscas: MAX_BUSCAS,
  });
  const ideia = { id: idIdeia(agora), quando: agora.getTime(), geradoEm: agora.toISOString(), tema: temaLimpo, texto, fontes };
  await salvarItem('ideias', ideia);
  await podar('ideias', 100);
  return ideia;
}

// ======================================================================
// Histórico (stories, reels, ideias)
// ======================================================================
const COLECOES = { stories: 'stories', reels: 'reels', ideias: 'ideias' };
const ID_VALIDO = /^\d{4}-\d{2}-\d{2}(T\d{2}-\d{2}-\d{2})?$/;

async function podar(colecao, manter) {
  const ids = (await listarIds(colecao)).sort();
  for (const id of ids.slice(0, Math.max(0, ids.length - manter))) await apagarItem(colecao, id);
}
export async function listarHistorico(tipo) {
  if (!COLECOES[tipo]) throw new ErroConteudo('tipo inválido');
  return (await listarIds(COLECOES[tipo])).filter(id => ID_VALIDO.test(id)).sort().reverse();
}
export async function carregarHistorico(tipo, id) {
  if (!COLECOES[tipo] || !ID_VALIDO.test(id)) return null;
  return lerItem(COLECOES[tipo], id);
}
export async function ultimoReels() {
  const [id] = await listarHistorico('reels');
  return id ? lerItem('reels', id) : null;
}

/** Ferramenta da equipe: o que já está pronto na central de conteúdo. */
export async function ferramentaConteudo() {
  const textos = await lerTextosLoja();
  const hoje = dataLocal(new Date());
  const [stories, reels, idIdeia] = await Promise.all([lerItem('stories', hoje), ultimoReels(), listarHistorico('ideias').then(l => l[0])]);
  const ideia = idIdeia ? await lerItem('ideias', idIdeia) : null;
  return {
    fonte: 'Central de conteúdo do prédio',
    lojasDeReferencia: textos.contas.contasReferencia,
    sobreALoja: textos.loja || '(não preenchido)',
    estoqueDaSemana: textos.estoque || '(não preenchido)',
    storiesDeHoje: stories ? { estrategia: stories.resumo, stories: stories.stories.map(s => `${s.numero}. ${s.horario} · ${s.tipo}: ${s.objetivo}`) } : 'ainda não gerados hoje',
    ultimoRelatorioDeReels: reels ? { periodo: reels.periodo, texto: reels.texto.slice(0, 8000) } : 'nenhum ainda',
    ultimaIdeia: ideia ? { quando: ideia.geradoEm, tema: ideia.tema, texto: ideia.texto.slice(0, 4000) } : 'nenhuma ainda',
  };
}

// ======================================================================
// Gestor de conteúdo (quadro tipo Trello: cards por dia, em sequência)
// ======================================================================
export const TIPOS_CARD = ['story', 'reels', 'post', 'outro'];
export const STATUS_CARD = ['a fazer', 'gravado', 'postado'];
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

async function lerQuadro() {
  return (await lerItem('conteudo', 'quadro')) || { id: 'quadro', cards: [] };
}
async function gravarQuadro(q) {
  exigirArmazem();
  await salvarItem('conteudo', { ...q, id: 'quadro', quando: Date.now() });
}
function limpar(e, atual) {
  const dia = e.dia ?? atual?.dia;
  if (!dia || !DIA.test(dia)) throw new ErroConteudo('Dia inválido.');
  const tipo = e.tipo ?? atual?.tipo ?? 'story';
  if (!TIPOS_CARD.includes(tipo)) throw new ErroConteudo('Tipo inválido.');
  const status = e.status ?? atual?.status ?? 'a fazer';
  if (!STATUS_CARD.includes(status)) throw new ErroConteudo('Status inválido.');
  const horario = String(e.horario ?? atual?.horario ?? '').trim();
  if (horario && !HORA.test(horario)) throw new ErroConteudo('Horário inválido (use HH:MM).');
  const titulo = String(e.titulo ?? atual?.titulo ?? '').trim().slice(0, 200);
  if (!titulo) throw new ErroConteudo('Dê um título ao card.');
  return { dia, tipo, status, horario, titulo, conteudo: String(e.conteudo ?? atual?.conteudo ?? '').slice(0, 20000), origem: String(e.origem ?? atual?.origem ?? '').slice(0, 200) };
}
const doDia = (cards, dia) => cards.filter(c => c.dia === dia).sort((a, b) => a.ordem - b.ordem);
const renumerar = (cards, dia) => doDia(cards, dia).forEach((c, i) => { c.ordem = i + 1; });
function posicionar(cards, card, posicao) {
  const outros = doDia(cards, card.dia).filter(c => c.id !== card.id);
  const i = posicao && posicao >= 1 ? Math.min(Math.floor(posicao) - 1, outros.length) : outros.length;
  outros.splice(i, 0, card);
  outros.forEach((c, k) => { c.ordem = k + 1; });
}
export async function listarCards(de, ate) {
  if (!DIA.test(de || '') || !DIA.test(ate || '')) throw new ErroConteudo('Período inválido.');
  const { cards } = await lerQuadro();
  return cards.filter(c => c.dia >= de && c.dia <= ate).sort((a, b) => (a.dia === b.dia ? a.ordem - b.ordem : a.dia.localeCompare(b.dia)));
}
export async function contarNoDia(dia) {
  if (!DIA.test(dia)) throw new ErroConteudo('Dia inválido.');
  return doDia((await lerQuadro()).cards, dia).length;
}
export async function criarCard(e) {
  const q = await lerQuadro();
  const agora = new Date().toISOString();
  const card = { id: crypto.randomBytes(6).toString('hex'), ordem: 0, criadoEm: agora, atualizadoEm: agora, ...limpar(e) };
  q.cards.push(card);
  posicionar(q.cards, card, e.posicao);
  await gravarQuadro(q);
  return card;
}
export async function atualizarCard(id, e) {
  const q = await lerQuadro();
  const card = q.cards.find(c => c.id === id);
  if (!card) throw new ErroConteudo('Card não encontrado.');
  const diaAntigo = card.dia;
  Object.assign(card, limpar(e, card), { atualizadoEm: new Date().toISOString() });
  if (card.dia !== diaAntigo || e.posicao !== undefined) {
    posicionar(q.cards, card, e.posicao ?? (card.dia === diaAntigo ? card.ordem : undefined));
    renumerar(q.cards, diaAntigo);
  }
  await gravarQuadro(q);
  return card;
}
export async function apagarCard(id) {
  const q = await lerQuadro();
  const card = q.cards.find(c => c.id === id);
  if (!card) return;
  q.cards = q.cards.filter(c => c.id !== id);
  renumerar(q.cards, card.dia);
  await gravarQuadro(q);
}

// ======================================================================
// WhatsApp (opcional): aviso do relatório de reels
// ======================================================================
const LIMITE_MENSAGEM = 3900;
export function dividirMensagem(texto, limite = LIMITE_MENSAGEM) {
  const partes = [];
  for (const bloco of texto.split(/\n(?=\*🎬 ROTEIRO)/u).map(b => b.trim()).filter(Boolean)) {
    if (bloco.length <= limite) partes.push(bloco);
    else partes.push(...agrupar(bloco.split(/\n\s*\n/), '\n\n', limite));
  }
  return partes;
}
function agrupar(pedacos, sep, limite) {
  const saida = [];
  let atual = '';
  for (const p of pedacos) {
    if (p.length > limite) {
      if (atual) saida.push(atual);
      atual = '';
      if (sep === '\n\n') saida.push(...agrupar(p.split('\n'), '\n', limite));
      else for (let i = 0; i < p.length; i += limite) saida.push(p.slice(i, i + limite));
      continue;
    }
    const junto = atual ? `${atual}${sep}${p}` : p;
    if (junto.length > limite) { saida.push(atual); atual = p; } else atual = junto;
  }
  if (atual) saida.push(atual);
  return saida.map(s => s.trim()).filter(Boolean);
}

export const whatsappLigado = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_DESTINATARIOS);
export const destinatarios = () => String(process.env.WHATSAPP_DESTINATARIOS || '').split(',').map(n => n.replace(/\D/g, '')).filter(Boolean);
async function enviarWhatsapp(corpo) {
  const r = await fetch(`https://graph.facebook.com/${process.env.META_API_VERSION || 'v25.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...corpo }),
  });
  if (!r.ok) throw new ErroConteudo(`WhatsApp recusou o envio (${r.status}): ${await r.text()}`);
}
export const enviarTexto = (para, texto) => enviarWhatsapp({ to: para, type: 'text', text: { body: texto, preview_url: false } });
export async function enviarPartes(para, partes) {
  for (const [i, parte] of partes.entries()) {
    await enviarTexto(para, parte);
    if (i < partes.length - 1) await new Promise(r => setTimeout(r, 1200));
  }
}
const enviarModeloAviso = (para, periodo) => enviarWhatsapp({
  to: para, type: 'template',
  template: {
    name: process.env.WHATSAPP_TEMPLATE || 'relatorio_semanal',
    language: { code: process.env.WHATSAPP_TEMPLATE_IDIOMA || 'pt_BR' },
    components: [{ type: 'body', parameters: [{ type: 'text', text: periodo }] }],
  },
});

/** Avisa os destinatários: modelo aprovado (padrão; o relatório vai quando a pessoa responder) ou direto. */
export async function avisarNoWhatsapp(relatorio) {
  if (!whatsappLigado()) return { enviado: false, motivo: 'WhatsApp não configurado' };
  const numeros = destinatarios();
  if ((process.env.WHATSAPP_MODO || 'modelo') === 'direto') {
    for (const n of numeros) { await enviarPartes(n, relatorio.partes); relatorio.entreguePara.push(n); }
    await salvarItem('reels', relatorio);
  } else {
    for (const n of numeros) await enviarModeloAviso(n, relatorio.periodo);
  }
  return { enviado: true };
}

export function assinaturaValida(corpoBruto, cabecalho, segredo) {
  if (!segredo || !cabecalho?.startsWith('sha256=')) return false;
  const esperado = crypto.createHmac('sha256', segredo).update(corpoBruto, 'utf8').digest('hex');
  const recebido = cabecalho.slice(7);
  return recebido.length === esperado.length && crypto.timingSafeEqual(Buffer.from(recebido, 'hex'), Buffer.from(esperado, 'hex'));
}
/** No Brasil o WhatsApp às vezes manda o celular sem o nono dígito: esta forma serve só para comparar. */
export function chaveNumero(numero) {
  const n = String(numero).replace(/\D/g, '');
  return n.length === 13 && n.startsWith('55') && n[4] === '9' ? n.slice(0, 4) + n.slice(5) : n;
}
export function extrairMensagens(corpo) {
  const saida = [];
  for (const entrada of corpo?.entry ?? []) {
    for (const mudanca of entrada.changes ?? []) {
      for (const m of mudanca.value?.messages ?? []) {
        saida.push({ de: m.from, texto: m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? '' });
      }
    }
  }
  return saida;
}
const PEDIDO_DE_REENVIO = /relat[oó]rio|reenvi|de novo|roteiro/i;
const AJUDA = 'Sou o time de conteúdo do Prédio RBTech. Toda segunda eu mando o relatório de reels da semana. Para receber o último de novo, responda *relatório*.';
export async function responderNoWhatsapp(de, texto) {
  const r = await ultimoReels();
  if (!r) return enviarTexto(de, 'Ainda não tenho nenhum relatório pronto.');
  const jaRecebeu = r.entreguePara.some(n => chaveNumero(n) === chaveNumero(de));
  if (jaRecebeu && !PEDIDO_DE_REENVIO.test(texto)) return enviarTexto(de, AJUDA);
  await enviarPartes(de, r.partes);
  if (!jaRecebeu) { r.entreguePara.push(de); await salvarItem('reels', r); }
}

// ======================================================================
// Rotinas do prédio: o trabalho vira uma "rotina" no chat do chefe e uma entrega na aba Entregas
// ======================================================================
export const ROTINAS_CONTEUDO = {
  stories: { gestor: 'gerente_crescimento', papel: 'especialista', pedido: 'Roteiro dos stories de hoje' },
  reels: { gestor: 'chefe', papel: 'roteirista', pedido: 'Relatório semanal de reels virais, com roteiros para gravar' },
};

export async function rodarRotinaConteudo(equipe, origem = 'manual', { whatsapp = false } = {}) {
  const def = ROTINAS_CONTEUDO[equipe];
  if (!def) throw new ErroConteudo('Rotina de conteúdo desconhecida.');
  const inicio = Date.now();
  const id = `R${inicio.toString(36)}${crypto.randomBytes(2).toString('hex')}`;
  const registro = { id, equipe, gestor: def.gestor, origem, inicio, fim: null, status: 'ok', conteudo: equipe, entregas: [], decisoes: [], pedidos: [], edicoes: [] };
  let resultado = null;
  try {
    if (equipe === 'stories') {
      resultado = await gerarStoriesDoDia();
      const obs = resultado.resumo.observacoes ? `\n\n**Observações:** ${resultado.resumo.observacoes}` : '';
      registro.relatorio = `**Stories de hoje prontos** (${resultado.stories.length}), feitos pelo especialista.\n\n**Estratégia do dia:** ${resultado.resumo.estrategiaDoDia}\n\n**Época:** ${resultado.resumo.epoca}${obs}\n\nO roteiro completo está na entrega ${id}-E1 e na Central de conteúdo (aba Insta).`;
      registro.entregas.push({ id: `${id}-E1`, papel: def.papel, pedido: def.pedido, texto: storiesEmTexto(resultado), quando: Date.now() });
    } else {
      resultado = await gerarRelatorioReels();
      let aviso = '';
      if (whatsapp) {
        try { aviso = (await avisarNoWhatsapp(resultado)).enviado ? '\n\nAvisei no WhatsApp.' : ''; } catch (e) { resultado.avisos.push(`WhatsApp: ${e.message}`); aviso = `\n\nNão deu para avisar no WhatsApp: ${e.message}`; }
      }
      registro.relatorio = `**Relatório de reels da semana pronto** (${resultado.periodo}), feito pelo roteirista.${aviso}\n\nO relatório completo com os roteiros está na entrega ${id}-E1 e na Central de conteúdo (aba Insta).`;
      registro.entregas.push({ id: `${id}-E1`, papel: def.papel, pedido: def.pedido, texto: whatsappParaMarkdown(resultado.texto), quando: Date.now() });
    }
  } catch (e) {
    registro.status = 'erro';
    registro.erro = e.message || String(e);
  }
  registro.fim = Date.now();
  let salvo = false;
  try { salvo = await salvarRotina(registro); } catch { /* sem Redis */ }
  return { registro, resultado, salvo };
}
