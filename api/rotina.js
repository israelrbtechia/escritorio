// /api/rotina — a equipe trabalhando sozinha, mesmo com o app fechado.
//
//   GET  /api/rotina                                → últimas rotinas salvas (o app mostra ao abrir)
//   GET  /api/rotina?equipe=crescimento&executar=1  → chamado pelo Cron da Vercel (exige CRON_SECRET)
//   POST /api/rotina?equipe=trafego&executar=1      → botão "rodar agora" do app (exige o código de acesso)
//
// Variáveis: CRON_SECRET (a Vercel manda no cabeçalho do cron) e o Redis do Upstash para guardar os relatórios.
// Quando roda cada uma: veja api/_rotinas.js (tráfego, crescimento e vendas 4x ao dia; loja a cada 10 atualizações de OS).
import { ROTINAS } from './_equipe.js';
import { ROTINAS_CONTEUDO } from './_conteudo.js';
import { responder, codigoOk, NAO_AUTENTICADO } from './_agentes.js';
import { armazemLigado, lerRotinas } from './_armazem.js';
import { rotinasAtivas, executarRotina } from './_rotinas.js';
import { estadoContadorOs, textoUltimasAtualizacoes } from './_reparo.js';

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
      return responder(res, 200, { armazem: armazemLigado(), ativas: rotinasAtivas(), contadorOs: await estadoContadorOs().catch(() => null), rotinas: await lerRotinas(12) });
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
  const origem = req.method === 'GET' ? 'automatica' : 'manual';
  const extra = equipe === 'loja' ? await textoUltimasAtualizacoes().catch(() => '') : '';
  const { registro, salvo } = await executarRotina(equipe, origem, { extra, whatsapp: origem === 'automatica' && equipe === 'reels' });
  return responder(res, registro.status === 'ok' ? 200 : 502, { salvo, armazem: armazemLigado(), rotina: registro });
}
