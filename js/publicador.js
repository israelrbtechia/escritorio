// Publica uma arte da Helena no Instagram: desenha os JPGs aqui no navegador, sobe no Blob da Vercel
// (a Meta baixa de um endereço público) e pede ao servidor para publicar pela API oficial.
import { upload } from 'https://cdn.jsdelivr.net/npm/@vercel/blob@2.8.2/client/+esm';
import { gerarImagens, gravarVideo } from './arte.js';

const esperar = ms => new Promise(r => setTimeout(r, ms));

/** aoPasso(texto) recebe o andamento. Devolve { status: 'publicado', permalink } ou lança erro. */
export async function publicarArte(pedido, { token, aoPasso = () => {} }) {
  const cab = { 'content-type': 'application/json', authorization: `Bearer ${token}` };
  async function instagram(corpo) {
    let r;
    try { r = await fetch('/api/instagram', { method: 'POST', headers: cab, body: JSON.stringify(corpo) }); }
    catch { throw new Error('a conexão caiu. Toque em publicar de novo: se já tinha ido, o app avisa.'); }
    const d = await r.json().catch(() => null);
    if (r.status === 401) throw new Error('o login expirou. Entre de novo no prédio e toque em publicar.');
    if (!r.ok || !d) throw new Error(d?.erro || `erro ${r.status}`);
    if (d.erro && d.status >= 400) throw new Error(d.erro);
    return d;
  }
  if (!pedido?.arte?.slides?.length) throw new Error('esta arte não tem telas.');
  const conf = await fetch('/api/upload', { headers: cab }).then(r => r.json()).catch(() => ({}));
  if (conf.blob === false) throw new Error('o Blob ainda não está ligado na Vercel (Storage → Blob → conectar ao projeto).');

  let arquivos;
  if (pedido.arte.movimento) {
    aoPasso('🎬 Gravando a animação… (não troque de tela)');
    const video = await gravarVideo(pedido.arte, pedido.tipo, { aoProgresso: k => aoPasso(`🎬 Gravando a animação: ${Math.round(k * 100)}% (não troque de tela)`) });
    arquivos = [{ blob: video, nome: 'video.mp4', tipo: 'video/mp4' }];
  } else {
    aoPasso('🎨 Desenhando as imagens…');
    arquivos = (await gerarImagens(pedido.arte, pedido.tipo)).map((blob, i) => ({ blob, nome: `${i + 1}.jpg`, tipo: 'image/jpeg' }));
  }
  const midias = [];
  for (const [i, a] of arquivos.entries()) {
    aoPasso(`⬆️ Subindo ${a.tipo === 'video/mp4' ? 'o vídeo' : `a imagem ${i + 1} de ${arquivos.length}`}…`);
    const r = await upload(`instagram/${pedido.id}/${Date.now()}-${a.nome}`, a.blob, {
      access: 'public', handleUploadUrl: '/api/upload', headers: { authorization: `Bearer ${token}` }, contentType: a.tipo,
      multipart: a.blob.size > 20 * 1024 * 1024,
    });
    midias.push({ url: r.url, tipo: a.tipo });
  }
  await instagram({ acao: 'midia_recebida', pedido, midias });
  for (let tentativa = 1; tentativa <= 6; tentativa++) {
    aoPasso(tentativa === 1 ? '📤 Enviando para o Instagram…' : `⏳ A Meta ainda está processando (tentativa ${tentativa})…`);
    const r = await instagram({ acao: 'publicar', pedido, midias, legenda: pedido.legenda || '' });
    if (r.status === 'publicado') return r;
    await esperar(pedido.arte.movimento ? 20000 : 15000); // vídeo: a Meta demora mais para processar
  }
  throw new Error('a Meta ainda não terminou. Abra a página da arte em alguns minutos e toque em publicar de novo.');
}
