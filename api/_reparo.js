// Ligação com o ReparoSimples (sistema de assistência da RB Tech, repositório REPARORBTECH, banco no Supabase).
// Lê só as OS da loja RB Tech: número, aparelho, status, defeito e previsão. Nunca lê dados de cliente.
//
// Variáveis na Vercel (do projeto do prédio):
//   REPARO_SUPABASE_URL          endereço do Supabase do ReparoSimples (ex.: https://xxxx.supabase.co)
//   REPARO_SUPABASE_SERVICE_KEY  chave secreta (service_role ou sb_secret_...) — só no servidor
//   REPARO_LOJA_ID               (opcional) id da loja RB Tech; sem ele, o prédio acha sozinho a loja com "RB Tech" no nome

// Aceita também os nomes usados no próprio ReparoSimples (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).
const url = () => String(process.env.REPARO_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/(rest|auth)\/v1.*$/i, '').replace(/\/+$/, '');
const chave = () => String(process.env.REPARO_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
const loja = () => String(process.env.REPARO_LOJA_ID || '').trim();
export const reparoConectavel = () => !!(url() && chave());
export const reparoConfigurado = reparoConectavel;

export class ErroReparo extends Error {}

export const urlReparo = url;
export const chaveReparo = chave;
export async function restReparo(caminho) { return rest(caminho); }

async function rest(caminho) {
  const k = chave();
  const cab = { apikey: k, accept: 'application/json' };
  if (k.startsWith('eyJ')) cab.authorization = 'Bearer ' + k; // chave antiga (JWT); a nova sb_secret_ vai só no apikey
  const r = await fetch(`${url()}/rest/v1/${caminho}`, { headers: cab, signal: AbortSignal.timeout(15000) });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    if (r.status === 401 || r.status === 403) throw new ErroReparo('O Supabase do ReparoSimples recusou a chave. Confira REPARO_SUPABASE_SERVICE_KEY (ou SUPABASE_SERVICE_ROLE_KEY).');
    throw new ErroReparo(`ReparoSimples respondeu ${r.status}: ${txt.slice(0, 160)}`);
  }
  return r.json();
}

/** Lojas cadastradas (para achar o id da RB Tech). */
export async function listarLojas() {
  if (!reparoConectavel()) throw new ErroReparo('Faltam o endereço e a chave do Supabase do ReparoSimples na Vercel (REPARO_SUPABASE_URL ou SUPABASE_URL, e REPARO_SUPABASE_SERVICE_KEY ou SUPABASE_SERVICE_ROLE_KEY).');
  const lojas = await rest('lojas?select=id,nome&order=criado_em.asc&limit=200');
  return lojas.map(l => ({ id: l.id, nome: l.nome }));
}

const ATIVOS = ['analise', 'peca', 'servico', 'concluido'];

/** A loja RB Tech: pela variável REPARO_LOJA_ID ou, sem ela, a única loja com "RB Tech" no nome. */
let lojaAchada = null;
export async function lojaRbTech() {
  if (loja()) return { id: loja(), nome: 'RB Tech' };
  if (lojaAchada) return lojaAchada;
  const lojas = await listarLojas();
  const rb = lojas.filter(l => /rb\s*-?\s*tech/i.test(l.nome || ''));
  if (rb.length === 1) return (lojaAchada = rb[0]);
  if (!rb.length) throw new ErroReparo('Não achei nenhuma loja com "RB Tech" no nome no ReparoSimples. Defina REPARO_LOJA_ID na Vercel.');
  throw new ErroReparo(`Achei ${rb.length} lojas com "RB Tech" no nome (${rb.map(l => l.nome).join(', ')}). Defina REPARO_LOJA_ID na Vercel com o id da certa.`);
}

/** OS em andamento da loja RB Tech (fora da lixeira). */
export async function lerOrdensAbertas({ detalhes = false } = {}) {
  if (!reparoConfigurado()) throw new ErroReparo('O ReparoSimples ainda não está ligado (faltam REPARO_SUPABASE_URL e REPARO_SUPABASE_SERVICE_KEY).');
  const rb = await lojaRbTech();
  const campos = 'id,atualizado_em,dados';
  const filtro = [
    `loja_id=eq.${encodeURIComponent(rb.id)}`,
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

// ======================================================================
// Contador de atualizações de OS: a cada 10 (OS nova ou mudança de status), a loja faz uma rodada.
// Duas formas de contar:
//   1) gatilho no Supabase (tempo real, mesmo com o app fechado): o SQL vem do app (Ajustes → ReparoSimples);
//   2) sem o gatilho: compara as OS a cada leitura do app (enquanto ele está aberto).
// ======================================================================
import { somar, lerValor, gravarValor, guardarEventos, lerEventos } from './_armazem.js';
export const A_CADA = 10;
const NOMES_STATUS = { analise: 'em análise', peca: 'aguardando peça', servico: 'em reparo', concluido: 'pronta', pago: 'entregue e paga', interrompido: 'interrompida' };
const nomeStatus = s => NOMES_STATUS[s] || s || '—';

/** Soma as atualizações e diz se completou mais um ciclo de 10. */
export async function registrarAtualizacoesOs(eventos) {
  if (!eventos.length) return { disparar: false, total: Number(await lerValor('os_contador')) || 0 };
  await guardarEventos('os_eventos', eventos.map(e => ({ ...e, quando: e.quando || Date.now() })), 40);
  const total = await somar('os_contador', eventos.length);
  if (total == null) return { disparar: false, total: 0 };
  return { disparar: Math.floor(total / A_CADA) > Math.floor((total - eventos.length) / A_CADA), total };
}

/** Sem o gatilho: compara as OS abertas com o retrato da última leitura. */
export async function compararComRetrato(ordens) {
  const gatilho = Number(await lerValor('os_gatilho')) || 0;
  if (Date.now() - gatilho < 7 * 864e5) return []; // o gatilho do Supabase já conta em tempo real
  const atual = Object.fromEntries(ordens.map(o => [o.os, { status: o.status, modelo: o.modelo }]));
  const bruto = await lerValor('os_retrato');
  await gravarValor('os_retrato', JSON.stringify(atual));
  if (!bruto) return []; // primeira leitura: só guarda o retrato
  let antes = {};
  try { antes = JSON.parse(bruto); } catch { return []; }
  const eventos = [];
  for (const [os, o] of Object.entries(atual)) {
    if (!antes[os]) eventos.push({ os, modelo: o.modelo, de: null, para: o.status, tipo: 'nova' });
    else if (antes[os].status !== o.status) eventos.push({ os, modelo: o.modelo, de: antes[os].status, para: o.status, tipo: 'status' });
  }
  for (const [os, o] of Object.entries(antes)) if (!atual[os]) eventos.push({ os, modelo: o.modelo, de: o.status, para: 'pago', tipo: 'saiu' });
  return eventos;
}

export async function estadoContadorOs() {
  const total = Number(await lerValor('os_contador')) || 0;
  const gatilho = Number(await lerValor('os_gatilho')) || 0;
  return { total, aCada: A_CADA, faltam: A_CADA - (total % A_CADA), gatilho: gatilho ? new Date(gatilho).toISOString() : null };
}

/** Texto das últimas atualizações, para o pedido da rotina da loja. */
export async function textoUltimasAtualizacoes(n = A_CADA) {
  const eventos = await lerEventos('os_eventos', n);
  if (!eventos.length) return '';
  const linhas = eventos.reverse().map(e => {
    const hora = new Date(e.quando).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const quem = `OS ${e.os}${e.modelo ? ` (${e.modelo})` : ''}`;
    return e.tipo === 'nova' || !e.de ? `- ${hora} · ${quem}: OS nova, ${nomeStatus(e.para)}` : `- ${hora} · ${quem}: ${nomeStatus(e.de)} → ${nomeStatus(e.para)}`;
  });
  return `[ÚLTIMAS ${linhas.length} ATUALIZAÇÕES DE OS NO REPAROSIMPLES]\n${linhas.join('\n')}\n[/ATUALIZAÇÕES]`;
}

/** SQL do gatilho para colar no Supabase do ReparoSimples (avisa o prédio a cada OS nova ou mudança de status da RB Tech). */
export function sqlDoGatilho({ endereco, lojaId, chave }) {
  const q = s => String(s).replace(/'/g, "''");
  return `-- Prédio RBTech: avisa o prédio a cada OS nova ou mudança de status da loja RB Tech.
-- Cole no Supabase do ReparoSimples (SQL Editor) e rode uma vez. Para desligar: drop trigger predio_rbtech_os on public.itens;
create extension if not exists pg_net with schema extensions;

create or replace function public.predio_rbtech_os() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.colecao is distinct from 'os' or new.loja_id::text <> '${q(lojaId)}' then return new; end if;
  if tg_op = 'UPDATE' and (old.dados->>'status') is not distinct from (new.dados->>'status') then return new; end if;
  perform net.http_post(
    url := '${q(endereco)}/api/os?evento=1',
    body := jsonb_build_object(
      'os', coalesce(new.dados->>'numero', new.id::text),
      'modelo', coalesce(new.dados->'aparelho'->>'modelo', ''),
      'de', case when tg_op = 'UPDATE' then old.dados->>'status' end,
      'para', new.dados->>'status'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-predio-chave', '${q(chave)}'),
    timeout_milliseconds := 5000);
  return new;
end $$;

drop trigger if exists predio_rbtech_os on public.itens;
create trigger predio_rbtech_os after insert or update on public.itens
  for each row execute function public.predio_rbtech_os();
`;
}
