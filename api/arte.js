// /api/arte — o diretor de arte (Claude) desenha cada tela das artes da Helena e o revisor visual corrige.
//   POST { acao: "desenhar", plano, indice }                 → { svg }
//   POST { acao: "revisar", plano, indice, svg, imagem }     → { svg }   (imagem = a tela renderizada, JPEG em base64)
import { responder, responderDemorado, autenticado, lerCorpo, NAO_AUTENTICADO, erroDaApi } from './_agentes.js';
import { desenharTelaSvg, revisarTelaSvg } from './_designer.js';

function planoValido(p) {
  return p && Array.isArray(p.slides) && p.slides.length >= 1 && p.slides.length <= 10 && Array.isArray(p.tamanho) && Array.isArray(p.imagens) && Array.isArray(p.fixos);
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return responder(res, 405, { erro: 'Use POST.' });
  if (!autenticado(req)) return responder(res, 401, NAO_AUTENTICADO);
  const c = lerCorpo(req);
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
