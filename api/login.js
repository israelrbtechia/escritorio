// /api/login — entrada no prédio.
//   GET              → { exigeLogin, valido } (confere a sessão enviada no cabeçalho Authorization)
//   POST {usuario, senha} → { token } válido por 30 dias
import { responder, lerCorpo, loginExigido, conferirSenha, criarSessao, autenticado } from './_agentes.js';

export default async function handler(req, res) {
  if (req.method === 'GET') return responder(res, 200, { exigeLogin: loginExigido(), valido: autenticado(req) });
  if (req.method !== 'POST') return responder(res, 405, { erro: 'Use POST.' });
  if (!loginExigido()) return responder(res, 200, { token: '', aviso: 'Login desligado: defina AGENCIA_USUARIO e AGENCIA_SENHA na Vercel.' });
  const c = lerCorpo(req) || {};
  if (!conferirSenha(c.usuario, c.senha)) {
    await new Promise(r => setTimeout(r, 800)); // freia tentativas em sequência
    return responder(res, 401, { erro: 'Usuário ou senha incorretos.' });
  }
  return responder(res, 200, { token: criarSessao(String(c.usuario).trim().toLowerCase()) });
}
