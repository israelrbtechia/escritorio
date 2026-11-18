// /api/rotina — a equipe trabalhando sozinha, mesmo com o app fechado.
//
//   GET  /api/rotina                                → últimas rotinas salvas (o app mostra ao abrir)
//   GET  /api/rotina?equipe=crescimento&executar=1  → chamado pelo Cron da Vercel (exige CRON_SECRET)
//   POST /api/rotina?equipe=trafego&executar=1      → botão "rodar agora" do app (exige o código de acesso)
//
// Variáveis: CRON_SECRET (a Vercel manda no cabeçalho do cron) e o Redis do Upstash para guardar os relatórios.
// ECONOMIA: as reuniões automáticas dos andares ficam em standby. Sem ROTINAS_ATIVAS, só rodam as rotinas de conteúdo
// (stories do dia e reels da semana, que vieram do antigo agente). Para escolher, crie ROTINAS_ATIVAS na Vercel
// com as equipes separadas por vírgula (ex.: "stories,reels,trafego") ou "todas". O botão "Rodar agora" sempre funciona.
import crypto from 'node:crypto';
import { ROTINAS } from './_equipe.js';
import { ROTINAS_CONTEUDO, rodarRotinaConteudo } from './_conteudo.js';
import { responder, codigoOk, reuniaoNoServidor, erroDaApi, NAO_AUTENTICADO } from './_agentes.js';
import { armazemLigado, salvarRotina, lerRotinas, lerDecisoes, resumoAuditoria } from './_armazem.js';

const DURACAO_MAX_MS = 300_000; // igual ao maxDuration do vercel.json
const EQUIPES_ROTINA = [...Object.keys(ROTINAS_CONTEUDO), ...Object.keys(ROTINAS)];
/** Equipes cuja rotina automática (cron) está ligada. Padrão: só stories e reels (as reuniões ficam em standby). */
function rotinasAtivas() {
  if (!String(process.env.ROTINAS_ATIVAS || '').trim()) return Object.keys(ROTINAS_CONTEUDO);
  const v = String(process.env.ROTINAS_ATIVAS).toLowerCase().split(/[\s,;]+/).filter(Boolean);
  return v.includes('todas') ? EQUIPES_ROTINA : EQUIPES_ROTINA.filter(e => v.includes(e));
}

function chamadaDoCron(req) {
  const segredo = process.env.CRON_SECRET;
  return !!segredo && req.headers.authorization === `Bearer ${segredo}`;
}

export default async function handler(req, res) {
  const inicio = Date.now();
  const executar = req.query?.executar === '1';

  if (!executar) {
    if (req.method !== 'GET') return responder(res, 405, { erro: 'Use GET.' });
    if (!codigoOk(req)) return responder(res, 401, NAO_AUTENTICADO);
    try {
      return responder(res, 200, { armazem: armazemLigado(), ativas: rotinasAtivas(), rotinas: await lerRotinas(12) });
    } catch (e) {
      return responder(res, 502, { armazem: true, ativas: rotinasAtivas(), erro: e.message, rotinas: [] });
    }
  }

  // executar uma rotina: pelo cron (GET com CRON_SECRET) ou pelo app (POST com o código)
  const permitido = (req.method === 'GET' && chamadaDoCron(req)) || (req.method === 'POST' && codigoOk(req));
  if (!permitido) return responder(res, 401, req.method === 'POST' ? NAO_AUTENTICADO : { erro: 'Rotina não autorizada.' });
  if (!process.env.ANTHROPIC_API_KEY) return responder(res, 500, { erro: 'Falta a variável ANTHROPIC_API_KEY.' });

  const equipe = req.query?.equipe;
  const rotina = ROTINAS[equipe];
  if (!rotina && !ROTINAS_CONTEUDO[equipe]) return responder(res, 400, { erro: 'Equipe desconhecida. Use stories, reels, trafego, crescimento, loja ou vendas.' });
  // cron de uma equipe em standby: sai na hora, sem chamar a IA
  if (req.method === 'GET' && !rotinasAtivas().includes(equipe)) return responder(res, 200, { standby: true, equipe });
  // stories do dia e reels da semana: uma chamada só, feita pelo funcionário certo (sem reunião do chefe)
  if (ROTINAS_CONTEUDO[equipe]) {
    const origem = req.method === 'GET' ? 'automatica' : 'manual';
    const { registro, salvo } = await rodarRotinaConteudo(equipe, origem, { whatsapp: origem === 'automatica' && equipe === 'reels' });
    return responder(res, registro.status === 'ok' ? 200 : 502, { salvo, armazem: armazemLigado(), rotina: registro });
  }

  const data = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' });
  const registro = {
    id: `R${inicio.toString(36)}${crypto.randomBytes(2).toString('hex')}`,
    equipe, gestor: rotina.gestor, origem: req.method === 'GET' ? 'automatica' : 'manual',
    inicio, fim: null, status: 'ok',
  };
  try {
    let auditoria = '';
    try { auditoria = resumoAuditoria(await lerDecisoes(), rotina.gestor); } catch { /* sem histórico */ }
    Object.assign(registro, await reuniaoNoServidor(rotina.gestor, auditoria + rotina.pedido(data), { prazo: inicio + DURACAO_MAX_MS - 25_000, idRotina: registro.id }));
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
  return responder(res, registro.status === 'ok' ? 200 : 502, { salvo, armazem: armazemLigado(), rotina: registro });
}
