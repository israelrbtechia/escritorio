// /api/arte — artes da Helena (uma função só: o plano Hobby da Vercel aceita até 12).
//   POST { acao: "desenhar", plano, indice }                 → { svg }   o diretor de arte (Claude) desenha a tela
//   POST { acao: "revisar", plano, indice, svg, imagem }     → { svg }   o revisor olha a tela pronta (JPEG base64) e corrige
//   POST { prompt }                                          → { url }   gera a imagem de destaque (gerador da OpenAI)
//   GET  ?u=<Blob>                                           → o PNG da imagem pelo próprio domínio
//   GET                                                      → { ligado } (o gerador de imagens está configurado?)
// /api/imagem é o mesmo endereço (rewrite no vercel.json), para os links antigos continuarem valendo.
import { responder, responderDemorado, autenticado, lerCorpo, NAO_AUTENTICADO, erroDaApi } from './_agentes.js';
import { desenharTelaSvg, revisarTelaSvg } from './_designer.js';
import { gerarImagem, geradorDeImagemLigado, BLOB_DA_ARTE } from './_imagem.js';

async function imagem(req, res) {
  const u = String(req.query?.u || '');
  if (!u) return responder(res, 200, { ligado: geradorDeImagemLigado() });
  if (!BLOB_DA_ARTE.test(u)) return responder(res, 400, { erro: 'Endereço de imagem inválido.' });
  const r = await fetch(u).catch(() => null);
  if (!r?.ok) return responder(res, 404, { erro: 'Imagem não encontrada.' });
  res.statusCode = 200;
  res.setHeader('content-type', r.headers.get('content-type') || 'image/png');
  res.setHeader('cache-control', 'public, max-age=31536000, immutable');
  res.end(Buffer.from(await r.arrayBuffer()));
}

function planoValido(p) {
  return p && Array.isArray(p.slides) && p.slides.length >= 1 && p.slides.length <= 10 && Array.isArray(p.tamanho) && Array.isArray(p.imagens) && Array.isArray(p.fixos);
}
export default async function handler(req, res) {
  if (req.method === 'GET') return imagem(req, res);
  if (req.method !== 'POST') return responder(res, 405, { erro: 'Use GET ou POST.' });
  if (!autenticado(req)) return responder(res, 401, NAO_AUTENTICADO);
  const c = lerCorpo(req);
  if (c && !c.acao && c.prompt) {
    return responderDemorado(res, async () => {
      try { return { url: await gerarImagem(c.prompt) }; }
      catch (e) { return { erro: e.message || 'Não deu para gerar a imagem.', status: 502 }; }
    });
  }
  const indice = Number(c?.indice);
  if (!c || !planoValido(c.plano) || !(indice >= 0 && indice < c.plano.slides.length)) return responder(res, 400, { erro: 'Plano da arte inválido.' });
  if (JSON.stringify(c).length > 3_500_000) return responder(res, 413, { erro: 'Pedido grande demais.' });
  return responderDemorado(res, async () => {
    try {
      if (c.acao === 'desenhar') return await desenharTelaSvg(c.plano, indice);
      if (c.acao === 'revisar' && c.svg && c.imagem) return await revisarTelaSvg(c.plano, indice, String(c.svg).slice(0, 120_000), String(c.imagem).replace(/^data:image\/\w+;base64,/, ''));
      return { erro: 'Ação desconhecida.', status: 400 };
    } catch (e) {
      const [status, erro] = erroDaApi(e);
      return { erro, status };
    }
  });
}
