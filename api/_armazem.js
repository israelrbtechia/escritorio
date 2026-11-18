// Guarda os relatórios das rotinas automáticas num Redis (Upstash), para o app mostrar quando abrir.
// Na Vercel: Storage → Marketplace → Upstash (Redis). Ele cria KV_REST_API_URL e KV_REST_API_TOKEN sozinho.
// Também aceita UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN.

const url = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const tok = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const CHAVE = 'agencia:rotinas';
const GUARDAR = 40;

export const armazemLigado = () => !!(url() && tok());

async function comando(...args) {
  const r = await fetch(url(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok()}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15000),
  });
  const j = await r.json().catch(() => ({}));
  if (j.error) throw new Error(`Redis: ${j.error}`);
  return j.result;
}

export async function salvarRotina(registro) {
  if (!armazemLigado()) return false;
  await comando('LPUSH', CHAVE, JSON.stringify(registro));
  await comando('LTRIM', CHAVE, 0, GUARDAR - 1);
  return true;
}

export async function lerRotinas(n = 12) {
  if (!armazemLigado()) return [];
  const lista = (await comando('LRANGE', CHAVE, 0, n - 1)) || [];
  return lista.map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
}

// ---------- decisões auditadas pelo Israel ----------
const DECISOES = 'agencia:decisoes';

export async function salvarDecisao(d) {
  if (!armazemLigado()) return false;
  await comando('HSET', DECISOES, d.id, JSON.stringify(d));
  return true;
}

export async function lerDecisoes() {
  if (!armazemLigado()) return [];
  const plano = (await comando('HGETALL', DECISOES)) || [];
  const lista = [];
  for (let i = 1; i < plano.length; i += 2) { try { lista.push(JSON.parse(plano[i])); } catch { /* ignora */ } }
  return lista.sort((a, b) => b.quando - a.quando).slice(0, 200);
}

export async function auditarDecisao(id, status, comentario) {
  if (!armazemLigado()) return null;
  const atual = await comando('HGET', DECISOES, id);
  if (!atual) return null;
  const d = { ...JSON.parse(atual), status, comentario: comentario || '', auditadaEm: Date.now() };
  await comando('HSET', DECISOES, id, JSON.stringify(d));
  return d;
}

/** Texto curto com as últimas auditorias de um gestor, para ele respeitar o que o Israel decidiu. */
export function resumoAuditoria(decisoes, gestor) {
  const minhas = decisoes.filter(d => d.gestor === gestor && d.status !== 'pendente').slice(0, 6);
  if (!minhas.length) return '';
  return '[AUDITORIA]\n' + minhas.map(d =>
    `- ${d.id} "${d.titulo}": ${d.status === 'aprovada' ? 'APROVADA' : 'RECUSADA'}${d.comentario ? ` — comentário do Israel: ${d.comentario}` : ''}`).join('\n') + '\n[/AUDITORIA]\n\n';
}

// ---------- itens genéricos (pedidos de mídia, edições manuais) ----------
export async function salvarItem(colecao, item) {
  if (!armazemLigado()) return false;
  await comando('HSET', `agencia:${colecao}`, item.id, JSON.stringify(item));
  return true;
}
export async function lerItem(colecao, id) {
  if (!armazemLigado()) return null;
  const v = await comando('HGET', `agencia:${colecao}`, id);
  try { return v ? JSON.parse(v) : null; } catch { return null; }
}
export async function lerItens(colecao, limite = 200) {
  if (!armazemLigado()) return [];
  const plano = (await comando('HGETALL', `agencia:${colecao}`)) || [];
  const lista = [];
  for (let i = 1; i < plano.length; i += 2) { try { lista.push(JSON.parse(plano[i])); } catch { /* ignora */ } }
  return lista.sort((a, b) => (b.quando || 0) - (a.quando || 0)).slice(0, limite);
}
