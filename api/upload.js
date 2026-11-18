// /api/upload — gera a autorização para o navegador subir vídeos e fotos direto no Blob da Vercel
// (arquivos grandes não passam pelo servidor). Precisa do Blob ligado no projeto (variável BLOB_READ_WRITE_TOKEN).
import { handleUpload } from '@vercel/blob/client';
import { responder, autenticado, lerCorpo, NAO_AUTENTICADO } from './_agentes.js';
import { tokenBlob } from './_conteudo.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!autenticado(req)) return responder(res, 401, NAO_AUTENTICADO);
    return responder(res, 200, { blob: !!tokenBlob() });
  }
  if (req.method !== 'POST') return responder(res, 405, { erro: 'Use POST.' });
  const corpo = lerCorpo(req);
  if (!corpo) return responder(res, 400, { erro: 'JSON inválido.' });
  // o pedido de autorização vem do navegador e precisa de login; o aviso de "upload concluído" vem da Vercel (assinado)
  if (corpo.type === 'blob.generate-client-token' && !autenticado(req)) return responder(res, 401, NAO_AUTENTICADO);
  if (!tokenBlob()) return responder(res, 500, { erro: 'Ligue o Blob na Vercel (Storage → Blob) para subir arquivos.' });
  try {
    const resposta = await handleUpload({
      token: tokenBlob(),
      body: corpo,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png'],
        maximumSizeInBytes: 500 * 1024 * 1024,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {},
    });
    return responder(res, 200, resposta);
  } catch (e) {
    return responder(res, 400, { erro: e.message || 'Upload recusado.' });
  }
}
