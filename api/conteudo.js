// /api/conteudo — Central de conteúdo do Instagram (stories do dia, reels da semana, ideias, prints, gestor e configurações).
// Usada pelas páginas /conteudo/ (mesmo login do prédio) e pelo webhook do WhatsApp.
//   GET    ?r=sessao                         → confere o login
//   GET    ?r=historico&tipo=stories|reels|ideias[&data=]
//   POST   ?r=stories                        → stories de hoje agora (Especialista de crescimento)
//   POST   ?r=gerar      { enviar }          → relatório de reels agora (Roteirista); enviar = avisar no WhatsApp
//   POST   ?r=ideias     { tema }            → ideia com pesquisa na internet (Especialista de crescimento)
//   GET|PUT ?r=config                        → lojas de referência, estoque, sobre a loja, transcrições
//   GET|POST|DELETE ?r=prints                → prints dos stories das concorrentes (POST = bytes da imagem)
//   GET|POST|PUT|DELETE ?r=gestor            → quadro de conteúdo
//   GET|POST ?r=whatsapp                     → webhook do WhatsApp (sem login; assinatura da Meta)
import { waitUntil } from '@vercel/functions';
import { autenticado, NAO_AUTENTICADO } from './_agentes.js';
import { ErroMeta } from './_meta.js';
import * as C from './_conteudo.js';

const json = (corpo, status = 200) => Response.json(corpo, { status, headers: { 'Cache-Control': 'no-store' } });
/** Geração demorada: manda um espaço a cada 8 s (o iPhone desiste depois de ~60 s sem nada) e o JSON no fim. */
function demorado(trabalho) {
  const enc = new TextEncoder();
  const corpo = new ReadableStream({
    async start(ctrl) {
      ctrl.enqueue(enc.encode(' '));
      const pulso = setInterval(() => { try { ctrl.enqueue(enc.encode(' ')); } catch { /* fechou */ } }, 8000);
      let r;
      try { r = await trabalho(); } catch (e) {
        if (!(e instanceof C.ErroConteudo || e instanceof ErroMeta)) console.error(e);
        r = { ok: false, erro: e.message || 'Erro na central de conteúdo.', status: 500 };
      }
      clearInterval(pulso);
      ctrl.enqueue(enc.encode(JSON.stringify(r)));
      ctrl.close();
    },
  });
  return new Response(corpo, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
const logado = request => autenticado({ headers: { authorization: request.headers.get('authorization') || '' } });

async function tratar(request, metodo) {
  const url = new URL(request.url);
  const r = url.searchParams.get('r');
  if (r === 'whatsapp') return metodo === 'GET' ? verificarWebhook(url) : webhook(request);
  if (!logado(request)) return json(NAO_AUTENTICADO, 401);
  const q = k => url.searchParams.get(k) ?? '';
  const corpo = async () => {
    const d = await request.json().catch(() => null);
    if (!d || typeof d !== 'object') throw new C.ErroConteudo('Dados inválidos.');
    if (d.posicao !== undefined) d.posicao = Number(d.posicao);
    return d;
  };

  if (r === 'sessao') return json({ ok: true });
  if (r === 'historico' && metodo === 'GET') {
    if (!q('data')) return json({ datas: await C.listarHistorico(q('tipo')) });
    const item = await C.carregarHistorico(q('tipo'), q('data'));
    return item ? json(item) : json({ erro: 'não encontrado' }, 404);
  }
  if (r === 'stories' && metodo === 'POST') {
    return demorado(async () => {
      const { registro, resultado } = await C.rodarRotinaConteudo('stories', 'manual');
      return registro.status === 'ok' ? { ok: true, roteiro: resultado, rotina: registro.id } : { ok: false, erro: registro.erro, status: 500 };
    });
  }
  if (r === 'gerar' && metodo === 'POST') {
    const { enviar } = await request.json().catch(() => ({}));
    return demorado(async () => {
      const { registro, resultado } = await C.rodarRotinaConteudo('reels', 'manual', { whatsapp: enviar === true });
      return registro.status === 'ok' ? { ok: true, relatorio: resultado, avisos: resultado.avisos, rotina: registro.id } : { ok: false, erro: registro.erro, status: 500 };
    });
  }
  if (r === 'ideias' && metodo === 'POST') {
    const { tema } = await request.json().catch(() => ({}));
    return demorado(async () => ({ ok: true, ideia: await C.gerarIdeia(typeof tema === 'string' ? tema : '') }));
  }
  if (r === 'config') {
    if (metodo === 'GET') return json(await C.lerTextosLoja());
    if (metodo === 'PUT') return json(await C.salvarTextosLoja(await corpo()));
  }
  if (r === 'prints') {
    if (metodo === 'GET') {
      const agora = new Date();
      const ontem = C.dataLocal(new Date(agora.getTime() - 864e5)), hoje = C.dataLocal(agora);
      return json({ ontem, hoje, prints: await C.listarPrints([ontem, hoje]) });
    }
    if (metodo === 'POST') {
      const tipo = (request.headers.get('content-type') || '').split(';')[0].trim();
      if (!C.tipoAceito(tipo)) return json({ erro: 'Envie JPG, PNG ou WebP.' }, 415);
      const dados = Buffer.from(await request.arrayBuffer());
      if (!dados.length || dados.length > C.TAMANHO_MAXIMO) return json({ erro: 'Imagem vazia ou maior que 3 MB.' }, 413);
      return json({ ok: true, url: await C.salvarPrint(dados, tipo) });
    }
    if (metodo === 'DELETE') return (await C.apagarPrint(q('url'))) ? json({ ok: true }) : json({ erro: 'print inválido' }, 400);
  }
  if (r === 'gestor') {
    if (metodo === 'GET') {
      if (q('contar')) return json({ total: await C.contarNoDia(q('contar')) });
      return json({ cards: await C.listarCards(q('de'), q('ate')) });
    }
    if (metodo === 'POST') return json({ card: await C.criarCard(await corpo()) });
    if (metodo === 'PUT') return json({ card: await C.atualizarCard(q('id'), await corpo()) });
    if (metodo === 'DELETE') { await C.apagarCard(q('id')); return json({ ok: true }); }
  }
  return json({ erro: 'Rota desconhecida.' }, 404);
}

function verificarWebhook(url) {
  const ok = url.searchParams.get('hub.mode') === 'subscribe' && process.env.WHATSAPP_VERIFY_TOKEN
    && url.searchParams.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN && url.searchParams.get('hub.challenge');
  return ok ? new Response(url.searchParams.get('hub.challenge'), { status: 200 }) : new Response('proibido', { status: 403 });
}

async function webhook(request) {
  const bruto = await request.text();
  if (!C.assinaturaValida(bruto, request.headers.get('x-hub-signature-256'), process.env.META_APP_SECRET)) return new Response('assinatura inválida', { status: 401 });
  const autorizados = new Set(C.destinatarios().map(C.chaveNumero));
  const ultima = new Map(); // uma resposta por número
  let corpo = {};
  try { corpo = JSON.parse(bruto); } catch { /* ignora */ }
  for (const m of C.extrairMensagens(corpo)) if (autorizados.has(C.chaveNumero(m.de))) ultima.set(C.chaveNumero(m.de), m);
  // responde 200 na hora (a Meta reenvia se demorar) e manda o relatório em seguida
  if (ultima.size) waitUntil(Promise.all([...ultima.values()].map(m => C.responderNoWhatsapp(m.de, m.texto))).catch(e => console.error(e)));
  return new Response('ok', { status: 200 });
}

const rota = metodo => async request => {
  try {
    return await tratar(request, metodo);
  } catch (e) {
    const conhecido = e instanceof C.ErroConteudo || e instanceof ErroMeta;
    if (!conhecido) console.error(e);
    return json({ ok: false, erro: e.message || 'Erro na central de conteúdo.' }, conhecido ? 422 : 500);
  }
};
export const GET = rota('GET');
export const POST = rota('POST');
export const PUT = rota('PUT');
export const DELETE = rota('DELETE');
