// ReparoSimples como SaaS (3º andar): os números do painel admin e a revisão dos servidores.
// Usa as mesmas variáveis da ligação com o laboratório (REPARO_SUPABASE_URL e REPARO_SUPABASE_SERVICE_KEY): é o mesmo banco.
// Só mostra nome da loja, plano, situação da assinatura e datas. Nunca e-mail, telefone ou dados dos clientes das lojas.
// Opcional: REPARO_SITE_URL (ex.: https://reparosimples.com.br) para a revisão também conferir o site no ar.
// A revisão não usa IA: não gasta créditos.
import { reparoConectavel, restReparo, urlReparo, chaveReparo, ErroReparo } from './_reparo.js';
import { salvarItem, lerItens } from './_armazem.js';

const DIA = 86_400_000;
const PLANOS_NOMES = { essencial: 'Essencial', pro: 'Pro', pro_max: 'Pro Max' };
const nomePlano = id => PLANOS_NOMES[id] || id || 'sem plano';
const data = v => (v ? new Date(v).getTime() : NaN);

/** Mesma regra da função loja_situacao do ReparoSimples. */
function situacao(l, porId, recursosDe, tolerancia, agora, fundo = 0) {
  if (l.status_assinatura === 'bloqueada') return 'bloqueada';
  if (l.matriz_id && fundo < 3) {
    const m = porId.get(l.matriz_id);
    if (!m) return 'expirada';
    const sitMatriz = situacao(m, porId, recursosDe, tolerancia, agora, fundo + 1);
    if (!recursosDe(m.plano_id).includes('multilojas')) return sitMatriz === 'bloqueada' ? 'bloqueada' : 'expirada';
    return sitMatriz;
  }
  if (l.isenta || data(l.cortesia_ate) > agora) return 'ativa';
  switch (l.status_assinatura) {
    case 'ativa': return 'ativa';
    case 'teste': return data(l.teste_ate) > agora ? 'teste' : 'expirada';
    case 'inadimplente': return (data(l.inadimplente_desde) || agora) + tolerancia * DIA > agora ? 'inadimplente' : 'somente_leitura';
    case 'cancelada': return data(l.periodo_pago_ate) > agora ? 'ativa' : 'expirada';
    default: return 'expirada';
  }
}

async function contar(caminho) {
  try { return (await restReparo(caminho)).length; } catch { return null; } // tabela que não existe nesta versão do ReparoSimples
}

/** Números do SaaS, do mesmo jeito que o painel admin do ReparoSimples calcula. */
export async function lerSaasReparo() {
  if (!reparoConectavel()) throw new ErroReparo('O ReparoSimples ainda não está ligado (faltam REPARO_SUPABASE_URL e REPARO_SUPABASE_SERVICE_KEY).');
  const [lojas, planos, config] = await Promise.all([
    restReparo('lojas?select=*&order=criado_em.desc&limit=5000'),
    restReparo('planos?select=id,nome,preco_mensal,recursos'),
    restReparo('plataforma_config?select=chave,valor&chave=in.(tolerancia_atraso_dias,precos_hotmart)').catch(() => []),
  ]);
  const cfg = Object.fromEntries(config.map(c => [c.chave, c.valor]));
  const tolerancia = Number(cfg.tolerancia_atraso_dias) || 5;
  const precosHotmart = cfg.precos_hotmart && typeof cfg.precos_hotmart === 'object' ? cfg.precos_hotmart : {};
  const plano = new Map(planos.map(p => [p.id, p]));
  const recursosDe = id => plano.get(id)?.recursos || [];
  const porId = new Map(lojas.map(l => [l.id, l]));
  const agora = Date.now();
  const br = new Date(agora - 3 * 3_600_000); // horário de Brasília (sem horário de verão)
  const inicioMes = Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), 1) + 3 * 3_600_000;

  const por = {};
  let pagantes = 0, reais = 0, hotmart = 0;
  const pagantesPorPlano = {}, porOrigem = {};
  for (const l of lojas) {
    const s = situacao(l, porId, recursosDe, tolerancia, agora);
    l._sit = s;
    por[s] = (por[s] || 0) + 1;
    const paga = !l.isenta && (s === 'ativa' || s === 'inadimplente') && l.status_assinatura !== 'teste';
    if (!paga) continue;
    pagantes++;
    pagantesPorPlano[nomePlano(l.plano_id)] = (pagantesPorPlano[nomePlano(l.plano_id)] || 0) + 1;
    const origem = l.provedor_pagamento || 'kiwify';
    porOrigem[origem] = (porOrigem[origem] || 0) + 1;
    if (origem === 'hotmart') hotmart += Number(precosHotmart[l.plano_id]) || 0;
    else reais += Number(plano.get(l.plano_id)?.preco_mensal) || 0;
  }
  const visiveis = lojas.filter(l => !/\(unida\)\s*$/i.test(l.nome || ''));
  const [pagamentosPendentes, avisosNaoLidos] = await Promise.all([
    contar('kiwify_eventos?select=id&status=in.(revisao,erro,pendente_loja)&limit=500'),
    contar('plataforma_avisos?select=id&lido=eq.false&limit=500'),
  ]);
  return {
    fonte: 'ReparoSimples (banco do Supabase)',
    atualizado: new Date(agora).toISOString(),
    lojas: lojas.length,
    ativas: por.ativa || 0,
    emTeste: por.teste || 0,
    inadimplentes: por.inadimplente || 0,
    expiradas: (por.expirada || 0) + (por.somente_leitura || 0),
    bloqueadas: por.bloqueada || 0,
    pagantes,
    pagantesPorPlano,
    porOrigem,
    receitaMensal: { reais: Math.round(reais * 100) / 100, hotmart: hotmart ? { valor: hotmart, moeda: String(precosHotmart.moeda || 'CLP') } : null },
    novasNoMes: lojas.filter(l => data(l.criado_em) >= inicioMes).length,
    novas7dias: lojas.filter(l => data(l.criado_em) > agora - 7 * DIA).length,
    recentes: visiveis.slice(0, 8).map(l => ({ id: l.id, nome: l.nome || '(sem nome)', criada: l.criado_em, plano: nomePlano(l.plano_id), situacao: l._sit })),
    pagamentosPendentes,
    avisosNaoLidos,
  };
}

/** Revisão dos servidores do ReparoSimples (2 vezes por dia pelo cron, ou no botão). */
export async function revisarServidores(origem = 'manual') {
  const checagens = [];
  const medir = async (nome, fn) => {
    const t = Date.now();
    try {
      const detalhe = (await fn()) || '';
      const ms = Date.now() - t;
      checagens.push({ nome, nivel: ms > 4000 ? 'atencao' : 'ok', ms, detalhe: ms > 4000 ? `lento (${(ms / 1000).toFixed(1)} s)${detalhe ? ' · ' + detalhe : ''}` : detalhe });
    } catch (e) {
      checagens.push({ nome, nivel: 'falha', ms: Date.now() - t, detalhe: e.message || String(e) });
    }
  };
  const tempo = () => AbortSignal.timeout(12000);
  await medir('Banco de dados (Supabase)', async () => { await restReparo('planos?select=id&limit=1'); });
  await medir('Login das lojas (Supabase Auth)', async () => {
    const r = await fetch(`${urlReparo()}/auth/v1/health`, { headers: { apikey: chaveReparo() }, signal: tempo() });
    if (r.status >= 500) throw new Error(`respondeu ${r.status}`);
  });
  const site = String(process.env.REPARO_SITE_URL || '').trim();
  if (site) {
    await medir('Site do ReparoSimples', async () => {
      const r = await fetch(site, { redirect: 'follow', signal: tempo() });
      if (r.status >= 500) throw new Error(`respondeu ${r.status}`);
      return `HTTP ${r.status}`;
    });
  }
  let numeros = null;
  await medir('Números do SaaS', async () => { numeros = await lerSaasReparo(); return `${numeros.lojas} lojas · ${numeros.pagantes} pagantes`; });
  if (numeros?.pagamentosPendentes) {
    checagens.push({ nome: 'Pagamentos (Kiwify/Hotmart)', nivel: 'atencao', ms: 0, detalhe: `${numeros.pagamentosPendentes} evento(s) de pagamento esperando revisão no painel admin` });
  } else if (numeros) {
    checagens.push({ nome: 'Pagamentos (Kiwify/Hotmart)', nivel: 'ok', ms: 0, detalhe: 'nenhum evento travado' });
  }
  if (numeros?.avisosNaoLidos) checagens.push({ nome: 'Avisos da plataforma', nivel: 'atencao', ms: 0, detalhe: `${numeros.avisosNaoLidos} aviso(s) não lido(s) no painel admin` });

  const status = checagens.some(c => c.nivel === 'falha') ? 'falha' : checagens.some(c => c.nivel === 'atencao') ? 'atencao' : 'ok';
  let anterior = null;
  try { anterior = (await lerItens('saas_revisoes', 1))[0] || null; } catch { /* sem Redis */ }
  const desde = anterior?.quando || Date.now() - DIA;
  const revisao = {
    id: `S${Date.now().toString(36)}`,
    quando: Date.now(),
    origem,
    status,
    checagens,
    resumo: numeros ? { lojas: numeros.lojas, ativas: numeros.ativas, pagantes: numeros.pagantes, receitaMensal: numeros.receitaMensal } : null,
    novas: (numeros?.recentes || []).filter(l => data(l.criada) > desde),
    site: !!site,
  };
  let salvo = false;
  try { salvo = await salvarItem('saas_revisoes', revisao); } catch { /* sem Redis */ }
  return { revisao, numeros, salvo };
}

export async function lerRevisoes(n = 6) {
  try { return await lerItens('saas_revisoes', n); } catch { return []; }
}

/** Ferramenta da equipe (head de vendas, produto e estrategista do ReparoSimples). */
export async function ferramentaSaas() {
  const numeros = await lerSaasReparo();
  const [ultima] = await lerRevisoes(1);
  return {
    ...numeros,
    ultimaRevisaoDosServidores: ultima ? { quando: new Date(ultima.quando).toISOString(), status: ultima.status, checagens: ultima.checagens.map(c => `${c.nome}: ${c.nivel}${c.detalhe ? ' · ' + c.detalhe : ''}`) } : 'nenhuma ainda',
  };
}
