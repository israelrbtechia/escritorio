// /api/decisoes — a sala do Israel (Boss) no terraço: toda decisão dos chefes passa por aqui.
//   GET                                                   → lista de decisões (rotinas e app) e se as ações no ReparoSimples estão ligadas
//   POST { acao: "salvar", decisao }                      → guarda uma decisão criada no app
//   POST { acao: "auditar", id, status, comentario }      → Israel aprova ou recusa.
//        Aprovada com "acoes": o prédio executa as ações no ReparoSimples (API do RB Central) e guarda o resultado de cada uma.
import { responder, responderDemorado, codigoOk, lerCorpo, NAO_AUTENTICADO } from './_agentes.js';
import { armazemLigado, salvarDecisao, lerDecisoes, auditarDecisao, travar, soltar } from './_armazem.js';
import { centralLigada, limparAcoes, executarAcoes } from './_central.js';

const texto = (v, max) => String(v ?? '').slice(0, max);
const limpar = d => ({
  id: texto(d.id, 60), gestor: texto(d.gestor, 40), andar: Number(d.andar) || 0,
  titulo: texto(d.titulo, 140), decisao: texto(d.decisao, 4000), motivo: texto(d.motivo, 4000), riscos: texto(d.riscos, 3000),
  urgencia: ['baixa', 'media', 'alta'].includes(d.urgencia) ? d.urgencia : 'media',
  entregas: Array.isArray(d.entregas) ? d.entregas.slice(0, 10).map(e => texto(e, 60)) : [],
  acoes: limparAcoes(d.acoes),
  status: 'pendente', comentario: '', quando: Number(d.quando) || Date.now(), origem: d.origem === 'rotina' ? 'rotina' : 'app', ensaio: !!d.ensaio,
});

export default async function handler(req, res) {
  if (!codigoOk(req)) return responder(res, 401, NAO_AUTENTICADO);
  if (!armazemLigado()) return responder(res, 200, { armazem: false, central: centralLigada(), decisoes: [] });
  try {
    if (req.method === 'GET') return responder(res, 200, { armazem: true, central: centralLigada(), decisoes: await lerDecisoes() });
    if (req.method !== 'POST') return responder(res, 405, { erro: 'Use GET ou POST.' });
    const c = lerCorpo(req);
    if (!c) return responder(res, 400, { erro: 'JSON inválido.' });
    if (c.acao === 'salvar' && c.decisao?.id) {
      const d = limpar(c.decisao);
      await salvarDecisao(d);
      return responder(res, 200, { ok: true, decisao: d });
    }
    if (c.acao === 'auditar' && c.id && ['aprovada', 'recusada'].includes(c.status)) {
      const id = texto(c.id, 60);
      let d = await auditarDecisao(id, c.status, texto(c.comentario, 2000));
      // decisão que só existia no navegador (o salvar falhou): guarda agora e audita
      if (!d && c.decisao?.id === id) { await salvarDecisao(limpar(c.decisao)); d = await auditarDecisao(id, c.status, texto(c.comentario, 2000)); }
      if (!d) return responder(res, 404, { erro: 'Decisão não encontrada.' });
      const executar = c.status === 'aprovada' && d.acoes?.length && !d.execucao && !d.ensaio;
      if (!executar) return responder(res, 200, { ok: true, decisao: d });
      return responderDemorado(res, async () => {
        if (!centralLigada()) {
          d = { ...d, execucao: d.acoes.map(() => ({ ok: false, detalhe: 'API do RB Central não ligada no prédio (REPARO_CENTRAL_URL e REPARO_CENTRAL_TOKEN)' })), executadaEm: Date.now() };
          d.execucao = d.execucao.map((r, i) => ({ acao: (d.acoes[i].tipo + ' · OS ' + d.acoes[i].os), ...r }));
          await salvarDecisao(d);
          return { ok: true, decisao: d };
        }
        if (!(await travar(`executando:${id}`, 300))) return { ok: true, decisao: d, aviso: 'As ações desta decisão já estão sendo executadas.' };
        try {
          d = { ...d, execucao: await executarAcoes(d.acoes), executadaEm: Date.now() };
          await salvarDecisao(d);
          return { ok: true, decisao: d };
        } finally {
          await soltar(`executando:${id}`);
        }
      });
    }
    return responder(res, 400, { erro: 'Ação desconhecida.' });
  } catch (e) {
    return responder(res, 502, { erro: e.message });
  }
}
