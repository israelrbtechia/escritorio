// /api/saas — ReparoSimples como SaaS, no 3º andar do prédio.
//   GET  /api/saas                → números (lojas, pagantes, receita mensal, lojas novas) e as últimas revisões dos servidores
//   GET  /api/saas?revisar=1      → revisão dos servidores pelo cron da Vercel (exige CRON_SECRET), 2 vezes por dia
//   POST /api/saas?revisar=1      → botão "Revisar agora" do app
// Não usa IA: não gasta créditos.
import { responder, codigoOk, NAO_AUTENTICADO } from './_agentes.js';
import { reparoConectavel } from './_reparo.js';
import { lerSaasReparo, revisarServidores, lerRevisoes } from './_saas.js';

const doCron = req => !!process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;

export default async function handler(req, res) {
  const revisar = req.query?.revisar === '1';
  if (revisar) {
    const permitido = (req.method === 'GET' && doCron(req)) || (req.method === 'POST' && codigoOk(req));
    if (!permitido) return responder(res, 401, req.method === 'POST' ? NAO_AUTENTICADO : { erro: 'Revisão não autorizada.' });
    if (!reparoConectavel()) return responder(res, 200, { configurado: false });
    try {
      return responder(res, 200, { configurado: true, ...(await revisarServidores(req.method === 'GET' ? 'automatica' : 'manual')) });
    } catch (e) {
      return responder(res, 502, { configurado: true, erro: e.message });
    }
  }
  if (req.method !== 'GET') return responder(res, 405, { erro: 'Use GET.' });
  if (!codigoOk(req)) return responder(res, 401, NAO_AUTENTICADO);
  if (!reparoConectavel()) return responder(res, 200, { configurado: false, revisoes: [] });
  const revisoes = await lerRevisoes(6);
  try {
    return responder(res, 200, { configurado: true, numeros: await lerSaasReparo(), revisoes });
  } catch (e) {
    return responder(res, 200, { configurado: true, erro: e.message, revisoes });
  }
}
