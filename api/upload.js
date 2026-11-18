// /api/upload — subir vídeos e fotos para o Blob da Vercel (a Meta baixa de um endereço público).
//   GET                                 → { blob, modo, variaveis }  modo: "token" (BLOB_READ_WRITE_TOKEN) ou "oidc" (BLOB_STORE_ID, sem chave)
//   POST (handleUpload do @vercel/blob) → autorização para o navegador subir direto (só no modo token; serve para arquivos grandes)
//   POST ?arquivo=1&nome=&tipo=         → o arquivo vai no corpo (application/octet-stream) e o servidor sobe (até 4 MB; funciona nos dois modos)
import { handleUpload } from '@vercel/blob/client';
import crypto from 'node:crypto';
import { responder, autenticado, lerCorpo, NAO_AUTENTICADO } from './_agentes.js';
import { tokenBlob, blobLigado, blobOidc, guardarNoBlob, urlPublica } from './_conteudo.js';

const TIPOS = ['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png'];
const MAXIMO_PELO_SERVIDOR = Math.floor(4.3 * 1024 * 1024); // limite de corpo das funções da Vercel (4,5 MB)

async function corpoBruto(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (req.body instanceof Uint8Array) return Buffer.from(req.body);
  const partes = [];
  for await (const p of req) partes.push(p);
  return Buffer.concat(partes);
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!autenticado(req)) return responder(res, 401, NAO_AUTENTICADO);
    return responder(res, 200, {
      blob: blobLigado(), modo: tokenBlob() ? 'token' : blobOidc() ? 'oidc' : null, maximoPeloServidor: MAXIMO_PELO_SERVIDOR,
      variaveis: Object.keys(process.env).filter(k => /blob/i.test(k)), // só os nomes, para conferir a conexão
    });
  }
  if (req.method !== 'POST') return responder(res, 405, { erro: 'Use POST.' });
  if (req.query?.arquivo === '1') {
    if (!autenticado(req)) return responder(res, 401, NAO_AUTENTICADO);
    if (!blobLigado()) return responder(res, 500, { erro: 'Ligue o Blob na Vercel (Storage → Blob) para subir arquivos.' });
    const tipo = String(req.query.tipo || '');
    if (!TIPOS.includes(tipo)) return responder(res, 400, { erro: 'Tipo de arquivo não aceito.' });
    try {
      const dados = await corpoBruto(req);
      if (!dados.length) return responder(res, 400, { erro: 'Arquivo vazio.' });
      if (dados.length > MAXIMO_PELO_SERVIDOR) return responder(res, 413, { erro: 'Arquivo maior que 4 MB.' });
      const nome = String(req.query.nome || 'arquivo').replace(/[^\w.-]+/g, '_').replace(/\.{2,}/g, '.').slice(0, 100);
      const b = await guardarNoBlob(`instagram/${Date.now()}-${crypto.randomBytes(3).toString('hex')}-${nome}`, dados, { contentType: tipo, addRandomSuffix: false });
      return responder(res, 200, { url: urlPublica(b.url, req.headers['x-forwarded-host'] || req.headers.host) });
    } catch (e) {
      return responder(res, 502, { erro: `O Blob recusou o arquivo: ${e.message}` });
    }
  }
  const corpo = lerCorpo(req);
  if (!corpo) return responder(res, 400, { erro: 'JSON inválido.' });
  // o pedido de autorização vem do navegador e precisa de login; o aviso de "upload concluído" vem da Vercel (assinado)
  if (corpo.type === 'blob.generate-client-token' && !autenticado(req)) return responder(res, 401, NAO_AUTENTICADO);
  if (!tokenBlob()) {
    return responder(res, 400, { erro: blobOidc()
      ? 'O Blob está conectado sem chave: arquivos de até 4 MB sobem pelo servidor, mas o upload direto de arquivos grandes precisa da chave BLOB_READ_WRITE_TOKEN do Blob na Vercel.'
      : 'Ligue o Blob na Vercel (Storage → Blob) para subir arquivos.' });
  }
  try {
    const resposta = await handleUpload({
      token: tokenBlob(),
      body: corpo,
      request: req,
      onBeforeGenerateToken: async () => ({ allowedContentTypes: TIPOS, maximumSizeInBytes: 500 * 1024 * 1024, addRandomSuffix: true }),
      onUploadCompleted: async () => {},
    });
    return responder(res, 200, resposta);
  } catch (e) {
    return responder(res, 400, { erro: e.message || 'Upload recusado.' });
  }
}
