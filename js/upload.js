// Página de upload: o Israel sobe o vídeo ou a foto pedida pela Helena, revisa a legenda e aprova a publicação.
// O arquivo vai direto do navegador para o Blob da Vercel (vídeos grandes não passam pelo servidor);
// depois o servidor pede à Meta para publicar a partir desse endereço.
import { upload } from 'https://cdn.jsdelivr.net/npm/@vercel/blob@2.8.2/client/+esm';

const $ = id => document.getElementById(id);
const ler = (k, p) => { try { const v = localStorage.getItem(k); return v == null ? p : JSON.parse(v); } catch { return p; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
const NOMES = { gerente_crescimento: 'Helena', especialista: 'Especialista de crescimento', chefe: 'Pamella', gerente_loja: 'Rael', head_vendas: 'Head de vendas' };
const TIPOS = {
  reels: { nome: '🎬 Reels', aceita: 'video/mp4,video/quicktime', varios: false, dica: 'Vídeo MP4 ou MOV, na vertical (9:16), de 3 segundos a 15 minutos.' },
  post: { nome: '🖼️ Post', aceita: 'image/jpeg,image/png,video/mp4,video/quicktime', varios: false, dica: 'Foto JPG ou PNG (vira JPG), ou um vídeo.' },
  carrossel: { nome: '🗂️ Carrossel', aceita: 'image/jpeg,image/png,video/mp4,video/quicktime', varios: true, dica: 'De 2 a 10 fotos ou vídeos, na ordem em que devem aparecer.' },
  stories: { nome: '⏱️ Stories', aceita: 'image/jpeg,image/png,video/mp4,video/quicktime', varios: false, dica: 'Foto ou vídeo na vertical (9:16), até 60 segundos.' },
};

// ---------- pedido (vem no próprio link) ----------
function lerPedido() {
  const p = new URLSearchParams(location.search).get('p');
  if (!p) return null;
  try {
    const json = decodeURIComponent(escape(atob(p.replace(/-/g, '+').replace(/_/g, '/'))));
    return JSON.parse(json);
  } catch { return null; }
}
const pedido = lerPedido();
const token = () => ler('agencia.token', '');
const cabecalhos = () => ({ 'content-type': 'application/json', authorization: `Bearer ${token()}` });
let arquivos = [];   // File[] prontos para subir (PNG já convertido)
let midias = [];     // [{ url, tipo }] depois do upload
let semServidor = false;

function avisar(texto, tipo = 'info', html = false) {
  const a = $('aviso');
  a.hidden = !texto;
  a.className = `aviso-up ${tipo}`;
  if (html) a.innerHTML = texto; else a.textContent = texto;
}
/** Atualiza o pedido também no navegador, para o prédio mostrar o andamento. */
function atualizarLocal(dados) {
  const lista = ler('agencia.pedidos', []);
  const i = lista.findIndex(x => x.id === pedido.id);
  if (i >= 0) lista[i] = { ...lista[i], ...dados }; else lista.push({ ...pedido, ...dados });
  gravar('agencia.pedidos', lista);
}

// ---------- login ----------
async function conferirLogin() {
  try {
    const r = await fetch('/api/login', { headers: cabecalhos() });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) { semServidor = true; return; }
    const d = await r.json();
    if (d.exigeLogin && !d.valido) await pedirLogin();
  } catch { semServidor = true; }
}
function pedirLogin() {
  $('telaLogin').hidden = false;
  return new Promise(res => {
    $('formLogin').onsubmit = async e => {
      e.preventDefault();
      $('loginErro').textContent = '';
      const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario: $('loginUsuario').value, senha: $('loginSenha').value }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { $('loginErro').textContent = d.erro || 'Não deu para entrar.'; return; }
      gravar('agencia.token', d.token || '');
      $('telaLogin').hidden = true;
      res();
    };
  });
}
async function api(corpo) {
  const r = await fetch('/api/instagram', { method: 'POST', headers: cabecalhos(), body: JSON.stringify(corpo) });
  const d = await r.json().catch(() => null);
  if (r.status === 401 && d?.precisaLogin) { await pedirLogin(); return api(corpo); }
  if (!r.ok || !d) throw new Error(d?.erro || `Erro ${r.status}.`);
  return d;
}

// ---------- arquivos ----------
const ehVideo = f => f.type.startsWith('video/');
async function pngParaJpg(f) {
  if (f.type !== 'image/png') return f;
  const img = await createImageBitmap(f);
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
  return new File([blob], f.name.replace(/\.png$/i, '.jpg'), { type: 'image/jpeg' });
}
function medirVideo(f) {
  return new Promise(res => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { res({ duracao: v.duration, largura: v.videoWidth, altura: v.videoHeight }); URL.revokeObjectURL(v.src); };
    v.onerror = () => res(null);
    v.src = URL.createObjectURL(f);
  });
}
async function escolher(lista) {
  const cfg = TIPOS[pedido.tipo] || TIPOS.post;
  let novos = [...lista].filter(f => cfg.aceita.split(',').includes(f.type));
  if (!novos.length) { avisar('Formato não aceito. ' + cfg.dica, 'erro'); return; }
  if (!cfg.varios) novos = novos.slice(0, 1);
  if (cfg.varios) novos = [...arquivos, ...novos].slice(0, 10);
  arquivos = await Promise.all(novos.map(pngParaJpg));
  midias = [];
  avisar('');
  const avisos = [];
  $('previas').innerHTML = '';
  for (const f of arquivos) {
    const div = document.createElement('div');
    div.className = 'previa';
    const url = URL.createObjectURL(f);
    if (ehVideo(f)) {
      div.innerHTML = '<video muted playsinline controls></video><small></small>';
      div.querySelector('video').src = url;
      const m = await medirVideo(f);
      if (m) {
        div.querySelector('small').textContent = `${Math.round(m.duracao)} s · ${m.largura}×${m.altura}`;
        if (pedido.tipo === 'reels' && (m.duracao < 3 || m.duracao > 900)) avisos.push('O reels precisa ter de 3 segundos a 15 minutos.');
        if (pedido.tipo === 'stories' && m.duracao > 60) avisos.push('Stories em vídeo: até 60 segundos.');
        if (['reels', 'stories'].includes(pedido.tipo) && m.altura && Math.abs(m.largura / m.altura - 9 / 16) > 0.08) avisos.push('O vídeo não está na vertical 9:16: o Instagram pode cortar as bordas.');
      }
    } else {
      div.innerHTML = '<img alt=""><small></small>';
      div.querySelector('img').src = url;
      div.querySelector('small').textContent = `${(f.size / 1e6).toFixed(1)} MB`;
    }
    $('previas').appendChild(div);
  }
  if (pedido.tipo === 'carrossel' && arquivos.length < 2) avisos.push('Escolha pelo menos 2 arquivos para o carrossel (pode adicionar mais).');
  $('avisosArquivo').textContent = avisos.join(' ');
  $('btSubir').disabled = !arquivos.length || (pedido.tipo === 'carrossel' && arquivos.length < 2);
  $('btPublicar').disabled = true;
  $('statusUp').textContent = `${arquivos.length} arquivo(s) pronto(s) para subir.`;
}

// ---------- subir e publicar ----------
async function subir() {
  if (semServidor) { avisar('Esta é uma prévia sem servidor: o upload só funciona no site publicado na Vercel.', 'erro'); return; }
  $('btSubir').disabled = true;
  midias = [];
  try {
    const conf = await fetch('/api/upload', { headers: cabecalhos() }).then(r => r.json()).catch(() => ({}));
    if (conf.precisaLogin) { await pedirLogin(); $('btSubir').disabled = false; return; }
    if (conf.blob === false) throw new Error('o Blob ainda não está ligado na Vercel (Storage → Blob → conectar ao projeto).');
    $('barra').hidden = false;
    const total = arquivos.reduce((s, f) => s + f.size, 0);
    let enviados = 0;
    for (const [i, f] of arquivos.entries()) {
      $('statusUp').textContent = `Subindo ${i + 1} de ${arquivos.length}: ${f.name}…`;
      const nome = `instagram/${pedido.id}/${Date.now()}-${f.name.replace(/[^\w.-]+/g, '_')}`;
      const blob = await upload(nome, f, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        headers: { authorization: `Bearer ${token()}` },
        multipart: f.size > 20 * 1024 * 1024,
        onUploadProgress: p => { $('barra').firstElementChild.style.width = `${Math.round(((enviados + p.loaded) / total) * 100)}%`; },
      });
      enviados += f.size;
      midias.push({ url: blob.url, tipo: f.type });
    }
    $('barra').firstElementChild.style.width = '100%';
    await api({ acao: 'midia_recebida', pedido: { ...pedido, legenda: $('legenda').value }, midias });
    atualizarLocal({ status: 'midia_recebida', midias });
    $('statusUp').textContent = '✅ Arquivo no ar. Revise a legenda e aprove a publicação.';
    $('btPublicar').disabled = false;
  } catch (e) {
    avisar(`Não deu para subir: ${e.message}`, 'erro');
    $('btSubir').disabled = false;
  }
}
async function publicar(tentativa = 1) {
  if (tentativa === 1 && !confirm('Publicar agora no Instagram da RBTech?')) return;
  $('btPublicar').disabled = true;
  $('btSubir').disabled = true;
  $('statusUp').textContent = tentativa === 1 ? 'Enviando para o Instagram… vídeos podem levar alguns minutos para a Meta processar.' : `A Meta ainda está processando (tentativa ${tentativa})…`;
  try {
    const r = await api({ acao: 'publicar', pedido: { ...pedido, legenda: $('legenda').value }, midias, legenda: $('legenda').value });
    if (r.status === 'publicado') {
      atualizarLocal({ status: 'publicado', permalink: r.permalink, legenda: $('legenda').value, publicadoEm: Date.now() });
      $('statusUp').textContent = '';
      avisar(`🎉 Publicado no Instagram!${r.permalink ? ` <a href="${r.permalink}" target="_blank" rel="noopener">Ver o post</a>` : ''}`, 'ok', true);
      return;
    }
    atualizarLocal({ status: 'processando' });
    if (tentativa < 6) { setTimeout(() => publicar(tentativa + 1), 15000); return; }
    avisar('A Meta ainda não terminou de processar o vídeo. Volte a este link em alguns minutos e clique em publicar de novo.', 'info');
    $('btPublicar').disabled = false;
  } catch (e) {
    avisar(`Não publicou: ${e.message}`, 'erro');
    $('btPublicar').disabled = false;
  }
}

// ---------- início ----------
if (!pedido) {
  avisar('Link de upload inválido. Abra o link que a Helena deixou no chat do prédio.', 'erro');
} else {
  const cfg = TIPOS[pedido.tipo] || TIPOS.post;
  $('pTipo').textContent = cfg.nome;
  $('pCodigo').textContent = pedido.id;
  $('pQuem').textContent = `pedido por ${NOMES[pedido.solicitante] || 'equipe'}`;
  $('pTitulo').textContent = pedido.titulo || 'Conteúdo para o Instagram';
  $('pQuando').textContent = pedido.quando_publicar ? `Quando publicar: ${pedido.quando_publicar}` : '';
  $('pBriefing').textContent = pedido.briefing || '';
  $('zonaDica').textContent = cfg.dica;
  $('arquivo').accept = cfg.aceita;
  $('arquivo').multiple = cfg.varios;
  $('legenda').value = pedido.legenda || '';
  $('contLegenda').textContent = $('legenda').value.length;
  $('cartaoLegenda').hidden = pedido.tipo === 'stories';
  for (const id of ['cartaoPedido', 'cartaoArquivo', 'cartaoPublicar']) $(id).hidden = false;
  const local = ler('agencia.pedidos', []).find(x => x.id === pedido.id);
  if (local?.status === 'publicado') avisar(`Este pedido já foi publicado.${local.permalink ? ` <a href="${local.permalink}" target="_blank" rel="noopener">Ver o post</a>` : ''}`, 'ok', true);

  $('legenda').addEventListener('input', () => { $('contLegenda').textContent = $('legenda').value.length; });
  $('arquivo').addEventListener('change', e => escolher(e.target.files));
  const zona = $('zona');
  zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('em-cima'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('em-cima'));
  zona.addEventListener('drop', e => { e.preventDefault(); zona.classList.remove('em-cima'); escolher(e.dataTransfer.files); });
  $('btSubir').addEventListener('click', subir);
  $('btPublicar').addEventListener('click', () => publicar(1));
  await conferirLogin();
  if (semServidor) avisar('Prévia sem servidor: dá para ver a página, mas o upload e a publicação só funcionam no site publicado na Vercel.', 'info');
}
