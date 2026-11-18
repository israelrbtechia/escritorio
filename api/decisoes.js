// /api/decisoes — a sala do Israel (Boss) no terraço: toda decisão dos chefes passa por aqui.
//   GET                                          → lista de decisões (rotinas e app)
//   POST { acao: "salvar", decisao }             → guarda uma decisão criada no app
//   POST { acao: "auditar", id, status, comentario } → Israel aprova ou recusa
import { responder, codigoOk, lerCorpo } from './_agentes.js';
import { armazemLigado, salvarDecisao, lerDecisoes, auditarDecisao } from './_armazem.js';

const texto = (v, max) => String(v ?? '').slice(0, max);

export default async function handler(req, res) {
  if (!codigoOk(req)) return responder(res, 401, { erro: 'Código de acesso inválido.', precisaCodigo: true });
  if (!armazemLigado()) return responder(res, 200, { armazem: false, decisoes: [] });
  try {
    if (req.method === 'GET') return responder(res, 200, { armazem: true, decisoes: await lerDecisoes() });
    if (req.method !== 'POST') return responder(res, 405, { erro: 'Use GET ou POST.' });
    const c = lerCorpo(req);
    if (!c) return responder(res, 400, { erro: 'JSON inválido.' });
    if (c.acao === 'salvar' && c.decisao?.id) {
      const d = c.decisao;
      const limpa = {
        id: texto(d.id, 40), gestor: texto(d.gestor, 40), andar: Number(d.andar) || 0,
        titulo: texto(d.titulo, 140), decisao: texto(d.decisao, 4000), motivo: texto(d.motivo, 4000), riscos: texto(d.riscos, 3000),
        urgencia: ['baixa', 'media', 'alta'].includes(d.urgencia) ? d.urgencia : 'media',
        entregas: Array.isArray(d.entregas) ? d.entregas.slice(0, 10).map(e => texto(e, 40)) : [],
        status: 'pendente', comentario: '', quando: Number(d.quando) || Date.now(), origem: 'app',
      };
      await salvarDecisao(limpa);
      return responder(res, 200, { ok: true, decisao: limpa });
    }
    if (c.acao === 'auditar' && c.id && ['aprovada', 'recusada'].includes(c.status)) {
      const d = await auditarDecisao(texto(c.id, 40), c.status, texto(c.comentario, 2000));
      return d ? responder(res, 200, { ok: true, decisao: d }) : responder(res, 404, { erro: 'Decisão não encontrada.' });
    }
    return responder(res, 400, { erro: 'Ação desconhecida.' });
  } catch (e) {
    return responder(res, 502, { erro: e.message });
  }
}
