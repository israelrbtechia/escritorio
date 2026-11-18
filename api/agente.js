// POST /api/agente — uma rodada de conversa com um funcionário: { papel, messages }.
// O navegador guarda a conversa, executa as ferramentas e conduz as rodadas (assim o 3D acompanha cada passo).
//
// Variáveis na Vercel:
//   ANTHROPIC_API_KEY  (obrigatória) chave da API do Claude
//   AGENCIA_CODIGO     (recomendada) código de acesso pedido pelo site
//   AGENCIA_MODELO     (opcional) padrão: claude-opus-5-5
import { PAPEIS } from './_equipe.js';
import { responder, codigoOk, lerCorpo, rodada, erroDaApi } from './_agentes.js';

const LIMITE_BYTES = 700_000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return responder(res, 405, { erro: 'Use POST.' });
  if (!codigoOk(req)) return responder(res, 401, { erro: 'Código de acesso inválido.', precisaCodigo: true });
  if (!process.env.ANTHROPIC_API_KEY) return responder(res, 500, { erro: 'Falta a variável ANTHROPIC_API_KEY no projeto da Vercel.' });

  const corpo = lerCorpo(req);
  if (!corpo) return responder(res, 400, { erro: 'JSON inválido.' });
  const { papel, messages } = corpo;
  if (!PAPEIS[papel]) return responder(res, 400, { erro: 'Funcionário desconhecido.' });
  if (JSON.stringify(corpo).length > LIMITE_BYTES) return responder(res, 413, { erro: 'Conversa grande demais. Comece uma nova reunião.' });
  const ok = Array.isArray(messages) && messages.length > 0 &&
    messages.every(m => m && (m.role === 'user' || m.role === 'assistant') && m.content != null);
  if (!ok) return responder(res, 400, { erro: 'Conversa inválida.' });

  try {
    return responder(res, 200, await rodada(papel, messages));
  } catch (e) {
    console.error(e);
    const [status, erro] = erroDaApi(e);
    return responder(res, status, { erro });
  }
}
