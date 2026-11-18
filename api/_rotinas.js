// Executa uma rotina do prédio (usada pelo cron, pelo botão "Rodar" e pelo contador de OS do ReparoSimples).
//   - tráfego, crescimento e vendas/SaaS: 4 turnos por dia (8h, 12h, 16h e 20h, pelo cron da Vercel)
//   - loja: a cada 10 atualizações de OS da RB Tech no ReparoSimples (OS nova ou mudança de status)
//   - stories (todo dia) e reels (segunda): uma chamada só, pela central de conteúdo
import crypto from 'node:crypto';
import { ROTINAS } from './_equipe.js';
import { ROTINAS_CONTEUDO, rodarRotinaConteudo } from './_conteudo.js';
import { reuniaoNoServidor, erroDaApi } from './_agentes.js';
import { salvarRotina, lerRotinas, lerDecisoes, resumoAuditoria } from './_armazem.js';

export const DURACAO_MAX_MS = 300_000; // igual ao maxDuration do vercel.json
export const EQUIPES_ROTINA = [...Object.keys(ROTINAS_CONTEUDO), ...Object.keys(ROTINAS)];
/** Por padrão rodam sozinhas: stories, reels, tráfego, crescimento e vendas. A loja roda pelo contador de OS. */
export const PADRAO_ATIVAS = ['stories', 'reels', 'trafego', 'crescimento', 'vendas'];

/** Equipes cuja rotina automática está ligada. ROTINAS_ATIVAS na Vercel troca o padrão (ex.: "stories,reels,trafego" ou "todas"). */
export function rotinasAtivas() {
  if (!String(process.env.ROTINAS_ATIVAS || '').trim()) return PADRAO_ATIVAS;
  const v = String(process.env.ROTINAS_ATIVAS).toLowerCase().split(/[\s,;]+/).filter(Boolean);
  return v.includes('todas') ? EQUIPES_ROTINA : EQUIPES_ROTINA.filter(e => v.includes(e));
}

/** Turno do dia em Brasília. */
export function turnoAgora(agora = new Date()) {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23' }).format(agora));
  return h < 11 ? 'manhã (1º turno)' : h < 15 ? 'meio-dia (2º turno)' : h < 19 ? 'tarde (3º turno)' : 'noite (4º turno)';
}

/** Resumo do último relatório da mesma equipe, para o chefe não repetir o que já foi feito. */
async function ultimoTurno(equipe) {
  try {
    const r = (await lerRotinas(12)).find(x => x.equipe === equipe && x.status === 'ok');
    if (!r) return '';
    const quando = new Date(r.inicio).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return `\n\n[ÚLTIMO TURNO · ${quando}]\n${String(r.relatorio || '').slice(0, 1800)}\n[/ÚLTIMO TURNO]`;
  } catch { return ''; }
}

/**
 * Roda a rotina de uma equipe e guarda o relatório (o app mostra ao abrir).
 * @param {string} equipe  stories, reels, trafego, crescimento, loja ou vendas
 * @param {'automatica'|'manual'} origem
 * @param {{ extra?: string, whatsapp?: boolean }} opcoes  extra: contexto a mais no pedido (ex.: as OS que mudaram)
 */
export async function executarRotina(equipe, origem, { extra = '', whatsapp = false } = {}) {
  if (ROTINAS_CONTEUDO[equipe]) return rodarRotinaConteudo(equipe, origem, { whatsapp });
  const rotina = ROTINAS[equipe];
  if (!rotina) throw new Error('Equipe desconhecida.');
  const inicio = Date.now();
  const data = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' });
  const registro = {
    id: `R${inicio.toString(36)}${crypto.randomBytes(2).toString('hex')}`,
    equipe, gestor: rotina.gestor, origem, inicio, fim: null, status: 'ok',
  };
  try {
    let auditoria = '';
    try { auditoria = resumoAuditoria(await lerDecisoes(), rotina.gestor); } catch { /* sem histórico */ }
    const contexto = equipe === 'loja' ? '' : `\nTurno: ${turnoAgora()}. A rotina roda 4 vezes por dia.${await ultimoTurno(equipe)}`;
    const pedido = auditoria + rotina.pedido(data) + contexto + (extra ? `\n\n${extra}` : '');
    Object.assign(registro, await reuniaoNoServidor(rotina.gestor, pedido, { prazo: inicio + DURACAO_MAX_MS - 25_000, idRotina: registro.id }));
  } catch (e) {
    console.error(e);
    registro.status = 'erro';
    registro.erro = erroDaApi(e)[1];
  }
  registro.fim = Date.now();
  // os códigos das entregas da rotina ganham o id da rotina, para não colidir com os do app
  for (const e of registro.entregas || []) {
    const novo = `${registro.id}-${e.id}`;
    registro.relatorio = (registro.relatorio || '').replaceAll(new RegExp(`\\b${e.id}\\b`, 'g'), novo);
    e.id = novo;
  }
  let salvo = false;
  try { salvo = await salvarRotina(registro); } catch (e) { registro.erroArmazem = e.message; }
  return { registro, salvo };
}
