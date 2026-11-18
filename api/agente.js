// POST /api/agente — uma rodada de conversa com um funcionário: { papel, messages }.
// O navegador guarda a conversa, executa as ferramentas e conduz as rodadas (assim o 3D acompanha cada passo).
//
// Variáveis na Vercel:
//   ANTHROPIC_API_KEY  (obrigatória) chave da API do Claude
//   AGENCIA_USUARIO e AGENCIA_SENHA  login do site (recomendado)
//   AGENCIA_MODELO     (opcional) padrão: claude-opus-5-5
import { PAPEIS } from './_equipe.js';
import { responder, responderDemorado, codigoOk, lerCorpo, rodada, NAO_AUTENTICADO } from './_agentes.js';
import { lerValor, gravarValor, travar, soltar } from './_armazem.js';
const esperar = ms => new Promise(r => setTimeout(r, ms));

/**
 * Uma rodada com o Claude. Com idRodada, o resultado fica guardado 15 min: se a conexão do celular cair
 * e o app pedir de novo a mesma rodada, ele recebe o resultado pronto (ou espera a que ainda está rodando).
 */
async function rodadaGuardada(id, papel, messages) {
  if (id) {
    const pronto = await lerValor(`rodada:${id}`).catch(() => null);
    if (pronto) return JSON.parse(pronto);
    if (!(await travar(`rodada:${id}:rodando`, 330).catch(() => true))) {
      const limite = Date.now() + 270_000;
      while (Date.now() < limite) {
        await esperar(2000);
        const v = await lerValor(`rodada:${id}`).catch(() => null);
        if (v) return JSON.parse(v);
        if (!(await lerValor(`rodada:${id}:rodando`).catch(() => null))) break; // a outra caiu: roda de novo
      }
    }
  }
  try {
    const r = await rodada(papel, messages);
    if (id) await gravarValor(`rodada:${id}`, JSON.stringify(r), 900).catch(() => {});
    return r;
  } finally {
    if (id) await soltar(`rodada:${id}:rodando`).catch(() => {});
  }
}

const LIMITE_BYTES = 700_000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return responder(res, 405, { erro: 'Use POST.' });
  if (!codigoOk(req)) return responder(res, 401, NAO_AUTENTICADO);
  if (!process.env.ANTHROPIC_API_KEY) return responder(res, 500, { erro: 'Falta a variável ANTHROPIC_API_KEY no projeto da Vercel.' });

  const corpo = lerCorpo(req);
  if (!corpo) return responder(res, 400, { erro: 'JSON inválido.' });
  const { papel, messages } = corpo;
  if (!PAPEIS[papel]) return responder(res, 400, { erro: 'Funcionário desconhecido.' });
  if (JSON.stringify(corpo).length > LIMITE_BYTES) return responder(res, 413, { erro: 'Conversa grande demais. Comece uma nova reunião.' });
  const ok = Array.isArray(messages) && messages.length > 0 &&
    messages.every(m => m && (m.role === 'user' || m.role === 'assistant') && m.content != null);
  if (!ok) return responder(res, 400, { erro: 'Conversa inválida.' });

  const id = typeof corpo.idRodada === 'string' && /^[\w-]{8,64}$/.test(corpo.idRodada) ? corpo.idRodada : null;
  return responderDemorado(res, () => rodadaGuardada(id, papel, messages));
}
