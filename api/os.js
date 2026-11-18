// GET /api/os — OS em andamento da loja RB Tech no ReparoSimples, para o laboratório do prédio.
//   GET              → { configurado, ordens: [{ os, modelo, status, atualizado }] }
//   GET ?lojas=1     → lista de lojas do ReparoSimples (para achar o REPARO_LOJA_ID)
import { responder, autenticado, NAO_AUTENTICADO } from './_agentes.js';
import { reparoConfigurado, reparoConectavel, lerOrdensAbertas, listarLojas, ErroReparo } from './_reparo.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return responder(res, 405, { erro: 'Use GET.' });
  if (!autenticado(req)) return responder(res, 401, NAO_AUTENTICADO);
  try {
    if (req.query?.lojas === '1') return responder(res, 200, { lojas: await listarLojas() });
    if (!reparoConfigurado()) return responder(res, 200, { configurado: false, conectavel: reparoConectavel(), ordens: [] });
    return responder(res, 200, { configurado: true, ordens: await lerOrdensAbertas() });
  } catch (e) {
    if (!(e instanceof ErroReparo)) console.error(e);
    return responder(res, e instanceof ErroReparo ? 422 : 502, { erro: e.message || 'Erro ao ler o ReparoSimples.' });
  }
}
