// Imagens de destaque das artes da Helena (servidas por /api/arte, também acessível como /api/imagem).
// O Claude não gera fotos: quando OPENAI_API_KEY existe na Vercel, a descrição que a Helena escreve vira uma imagem
// recortada (fundo transparente) no gerador de imagens da OpenAI. O PNG fica no Blob da Vercel e o app lê pelo
// próprio domínio (/api/imagem?u=...), para o navegador poder desenhar e exportar a arte.
// Sem a chave, as artes usam o iPhone 3D desenhado pelo app.
import { put } from '@vercel/blob';
import { tokenBlob } from './_conteudo.js';

/** A chave da OpenAI: OPENAI_API_KEY ou qualquer variável com "OPENAI" no nome que tenha uma chave (sk-...). */
export function chaveOpenAI() {
  const direta = String(process.env.OPENAI_API_KEY || '').trim();
  if (direta) return direta;
  const [, valor] = Object.entries(process.env).find(([nome, v]) => /openai/i.test(nome) && /^sk-/.test(String(v || '').trim())) || [];
  return String(valor || '').trim();
}
/** O que falta para gerar imagens (vazio = está tudo ligado). */
export function faltaParaImagens() {
  const falta = [];
  if (!chaveOpenAI()) falta.push('a chave OPENAI_API_KEY na Vercel do prédio');
  if (!tokenBlob()) falta.push('o Blob da Vercel conectado ao projeto (Storage → Blob)');
  return falta;
}
export const geradorDeImagemLigado = () => !faltaParaImagens().length;
export const BLOB_DA_ARTE = /^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\/artes\/[\w./-]+$/i;

const estilo = p => `${p}

Estilo: imagem de destaque para um carrossel premium de Instagram de uma loja de celulares. Objeto ou personagem único, recortado, sem fundo (transparente), iluminação de estúdio dramática com recorte de luz nas bordas, alto detalhe, foto realista ou render 3D de alta qualidade. Sem texto, sem letras, sem marcas d'água, sem logos de marca.`;

export async function gerarImagem(descricao) {
  if (!geradorDeImagemLigado()) throw new Error(`o gerador de imagens não está ligado: falta ${faltaParaImagens().join(' e ')}`);
  const prompt = String(descricao || '').trim().slice(0, 1500);
  if (!prompt) throw new Error('descrição da imagem vazia');
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { authorization: `Bearer ${chaveOpenAI()}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGEM_MODELO || 'gpt-image-1',
      prompt: estilo(prompt), n: 1, size: '1024x1536', background: 'transparent', output_format: 'png',
      quality: process.env.OPENAI_IMAGEM_QUALIDADE || 'high',
    }),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d?.data?.[0]?.b64_json) throw new Error(d?.error?.message || `o gerador de imagens respondeu ${r.status}`);
  const blob = await put(`artes/${Date.now()}.png`, Buffer.from(d.data[0].b64_json, 'base64'), {
    access: 'public', contentType: 'image/png', token: tokenBlob(), addRandomSuffix: true,
  });
  return `/api/imagem?u=${encodeURIComponent(blob.url)}`;
}
