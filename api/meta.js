// POST /api/meta — lê métricas da Meta para o app.
//   { consulta: "status" }                                   → o que está ligado e seguidores
//   { consulta: "placar" }                                   → investimento e conversas de hoje e dos últimos 30 dias
//   { consulta: "ler_metricas_anuncios", periodo, nivel }    → ferramentas usadas pela equipe
//   { consulta: "ler_metricas_instagram", periodo }
//   { consulta: "ler_posts_instagram", quantidade }
import { responder, codigoOk, lerCorpo, NAO_AUTENTICADO } from './_agentes.js';
import { lerStatus, lerPlacar, executarFerramentaMeta, ErroMeta } from './_meta.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return responder(res, 405, { erro: 'Use POST.' });
  if (!codigoOk(req)) return responder(res, 401, NAO_AUTENTICADO);
  const corpo = lerCorpo(req);
  if (!corpo) return responder(res, 400, { erro: 'JSON inválido.' });
  const { consulta, ...entrada } = corpo;
  try {
    if (consulta === 'status') return responder(res, 200, await lerStatus());
    if (consulta === 'placar') return responder(res, 200, await lerPlacar());
    if (['ler_metricas_anuncios', 'ler_metricas_instagram', 'ler_posts_instagram', 'ler_ordens_de_servico', 'ler_saas_reparo'].includes(consulta)) {
      return responder(res, 200, await executarFerramentaMeta(consulta, entrada));
    }
    return responder(res, 400, { erro: 'Consulta desconhecida.' });
  } catch (e) {
    const conhecido = e instanceof ErroMeta || e?.constructor?.name === 'ErroReparo';
    if (!conhecido) console.error(e);
    return responder(res, conhecido ? 422 : 502, { erro: e.message || 'Não deu para ler a Meta.' });
  }
}
