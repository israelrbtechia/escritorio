// /api/instagram — pedidos de mídia, publicação e edições manuais do departamento de crescimento (Helena).
//   GET                                                   → { armazem, pedidos, edicoes }
//   POST { acao: "salvar_pedido", pedido }                → guarda o pedido de mídia (criado pela Helena)
//   POST { acao: "midia_recebida", pedido, midias }       → o Israel subiu os arquivos
//   POST { acao: "publicar", pedido, midias, legenda }    → publica no Instagram (o clique do Israel é a aprovação)
//   POST { acao: "salvar_edicao", edicao } / { acao: "marcar_edicao", id, feito }
import { responder, responderDemorado, autenticado, lerCorpo, NAO_AUTENTICADO } from './_agentes.js';
import { armazemLigado, salvarItem, lerItem, lerItens } from './_armazem.js';
import { publicarNoInstagram, ErroMeta } from './_meta.js';
import { limparArte } from '../js/arte.js';

const TIPOS = ['reels', 'post', 'carrossel', 'stories'];
const texto = (v, max) => String(v ?? '').slice(0, max);
const midiaValida = m => m && /^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\//i.test(String(m.url || ''));
function limparPedido(p) {
  return {
    id: texto(p.id, 40), tipo: TIPOS.includes(p.tipo) ? p.tipo : 'post', titulo: texto(p.titulo, 140), briefing: texto(p.briefing, 3000),
    legenda: texto(p.legenda, 2200), quando_publicar: texto(p.quando_publicar, 120), solicitante: texto(p.solicitante, 40),
    quando: Number(p.quando) || Date.now(), status: texto(p.status || 'aguardando_midia', 30),
    // arte desenhada pelo app (criar_arte da Helena): o navegador gera os JPGs na hora de publicar
    ...(p.arte?.slides?.length ? { arte: limparArte(p.arte, TIPOS.includes(p.tipo) ? p.tipo : 'post') } : {}),
  };
}

export default async function handler(req, res) {
  if (!autenticado(req)) return responder(res, 401, NAO_AUTENTICADO);
  try {
    if (req.method === 'GET') {
      const [pedidos, edicoes] = await Promise.all([lerItens('pedidos'), lerItens('edicoes')]);
      return responder(res, 200, { armazem: armazemLigado(), pedidos, edicoes });
    }
    if (req.method !== 'POST') return responder(res, 405, { erro: 'Use GET ou POST.' });
    const c = lerCorpo(req);
    if (!c) return responder(res, 400, { erro: 'JSON inválido.' });

    if (c.acao === 'salvar_pedido' && c.pedido?.id) {
      const atual = await lerItem('pedidos', texto(c.pedido.id, 40));
      const pedido = { ...limparPedido(c.pedido), ...(atual ? { status: atual.status, midias: atual.midias, permalink: atual.permalink, ...(atual.arte && !c.pedido.arte ? { arte: atual.arte } : {}) } : {}) };
      await salvarItem('pedidos', pedido);
      return responder(res, 200, { ok: true, pedido });
    }
    if (c.acao === 'midia_recebida' && c.pedido?.id) {
      const midias = (c.midias || []).filter(midiaValida).slice(0, 10).map(m => ({ url: m.url, tipo: texto(m.tipo, 40) }));
      const pedido = { ...(await lerItem('pedidos', c.pedido.id) || limparPedido(c.pedido)), midias, status: 'midia_recebida' };
      await salvarItem('pedidos', pedido);
      return responder(res, 200, { ok: true, pedido });
    }
    if (c.acao === 'publicar' && c.pedido?.id) {
      const base = await lerItem('pedidos', c.pedido.id) || limparPedido(c.pedido);
      if (base.status === 'publicado') return responder(res, 200, { status: 'publicado', permalink: base.permalink, pedido: base });
      const midias = (c.midias || base.midias || []).filter(midiaValida);
      if (!midias.length) return responder(res, 400, { erro: 'Suba o arquivo antes de publicar.' });
      const legenda = texto(c.legenda ?? base.legenda, 2200);
      return responderDemorado(res, async () => { // vídeo demora: manda sinal de vida para o celular não desistir
        try {
          const r = await publicarNoInstagram({ tipo: base.tipo, midias, legenda, container: base.container }, { prazo: Date.now() + 200_000 });
          const pedido = { ...base, midias, legenda, status: r.status === 'publicado' ? 'publicado' : 'processando', container: r.container ?? base.container, permalink: r.permalink || null, publicadoEm: r.status === 'publicado' ? Date.now() : null };
          await salvarItem('pedidos', pedido);
          return { ...r, pedido };
        } catch (e) {
          if (!(e instanceof ErroMeta)) console.error(e);
          return { erro: e.message || 'Erro no Instagram.', status: e instanceof ErroMeta ? 422 : 502 };
        }
      });
    }
    if (c.acao === 'salvar_edicao' && c.edicao?.id) {
      const e = c.edicao;
      const edicao = {
        id: texto(e.id, 40), onde: texto(e.onde, 30), link: texto(e.link, 400), texto_atual: texto(e.texto_atual, 2200), texto_novo: texto(e.texto_novo, 2200),
        motivo: texto(e.motivo, 1500), autor: texto(e.autor, 40), quando: Number(e.quando) || Date.now(), feito: !!e.feito,
      };
      await salvarItem('edicoes', edicao);
      return responder(res, 200, { ok: true, edicao });
    }
    if (c.acao === 'marcar_edicao' && c.id) {
      const atual = await lerItem('edicoes', texto(c.id, 40));
      if (atual) await salvarItem('edicoes', { ...atual, feito: !!c.feito, feitoEm: c.feito ? Date.now() : null });
      return responder(res, 200, { ok: true });
    }
    return responder(res, 400, { erro: 'Ação desconhecida.' });
  } catch (e) {
    if (!(e instanceof ErroMeta)) console.error(e);
    return responder(res, e instanceof ErroMeta ? 422 : 502, { erro: e.message || 'Erro no Instagram.' });
  }
}
