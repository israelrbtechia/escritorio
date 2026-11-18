// /api/imagem
//   POST { prompt }  → { url } gera a imagem de destaque de uma arte (precisa de login; demora ~30 s)
//   GET  ?u=<Blob>   → devolve o PNG pelo próprio domínio (o canvas do navegador só exporta imagens da mesma origem)
//   GET              → { ligado } (o gerador está configurado?)
import { responder, responderDemorado, autenticado, lerCorpo, NAO_AUTENTICADO } from './_agentes.js';
import { gerarImagem, geradorDeImagemLigado, BLOB_DA_ARTE } from './_imagem.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const u = String(req.query?.u || '');
    if (!u) return responder(res, 200, { ligado: geradorDeImagemLigado() });
    if (!BLOB_DA_ARTE.test(u)) return responder(res, 400, { erro: 'Endereço de imagem inválido.' });
    const r = await fetch(u).catch(() => null);
    if (!r?.ok) return responder(res, 404, { erro: 'Imagem não encontrada.' });
    res.statusCode = 200;
    res.setHeader('content-type', r.headers.get('content-type') || 'image/png');
    res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  if (req.method !== 'POST') return responder(res, 405, { erro: 'Use GET ou POST.' });
  if (!autenticado(req)) return responder(res, 401, NAO_AUTENTICADO);
  const c = lerCorpo(req);
  if (!c?.prompt) return responder(res, 400, { erro: 'Falta a descrição da imagem (prompt).' });
  return responderDemorado(res, async () => {
    try { return { url: await gerarImagem(c.prompt) }; }
    catch (e) { return { erro: e.message || 'Não deu para gerar a imagem.', status: 502 }; }
  });
}
