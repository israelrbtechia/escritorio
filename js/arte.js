// Artes da Helena: posts, carrosséis, stories e reels desenhados aqui no navegador, no padrão da RB Tech
// (preto, amarelo #FFD60A, fonte Poppins e a logo RB Tech Celulares em todas as telas).
// A Helena (Claude) escreve o conteúdo e escolhe layout, tema, efeito visual e emojis de cada tela; este módulo desenha.
// - Feed (post e carrossel): JPG 1080×1350 (4:5, o maior que o Instagram mostra no feed).
// - Stories e reels: 1080×1920. Com movimento, vira vídeo MP4 (texto entrando, emoji estalando, troca de tela com
//   passagem amarela), gravado no próprio navegador.
// Camadas de cada tela: fundo (com o efeito, animável) → conteúdo (texto, pré-desenhado) → emojis → moldura (logo e contador).

export const LAYOUTS = ['capa', 'lista', 'numero', 'frase', 'comparativo', 'cta', 'ilustracao'];
export const TEMAS_ARTE = ['escuro', 'amarelo', 'claro'];
export const EFEITOS = ['brilho', 'grade', 'particulas', 'vidro', 'neon', 'liso'];
export const POSICOES_LOGO = ['canto_superior_esquerdo', 'canto_superior_direito', 'canto_inferior_esquerdo', 'canto_inferior_direito', 'nenhum'];
export const TIPOS_ARTE = ['carrossel', 'post', 'stories', 'reels'];
const TEMAS = {
  escuro: { fundo: '#0b0b0b', texto: '#ffffff', sub: '#cfcfcf', destaque: '#ffd60a', tintaDestaque: '#0b0b0b', linha: 'rgba(255,214,10,.16)', vidro: 'rgba(255,255,255,.06)', borda: 'rgba(255,214,10,.35)' },
  amarelo: { fundo: '#ffd60a', texto: '#0b0b0b', sub: '#2a2a2a', destaque: '#0b0b0b', tintaDestaque: '#ffd60a', linha: 'rgba(0,0,0,.10)', vidro: 'rgba(255,255,255,.28)', borda: 'rgba(0,0,0,.25)' },
  claro: { fundo: '#f6f3ec', texto: '#0b0b0b', sub: '#4a4a4a', destaque: '#c99a00', tintaDestaque: '#ffffff', linha: 'rgba(201,154,0,.18)', vidro: 'rgba(255,255,255,.7)', borda: 'rgba(201,154,0,.4)' },
};
const FONTE = 'Poppins, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Helvetica Neue", Arial, sans-serif';
const FONTE_EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const W = 1080, M = 90;
const vertical = tipo => tipo === 'stories' || tipo === 'reels';
export const tamanhoDa = tipo => [W, vertical(tipo) ? 1920 : 1350];
const ease = k => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.pow(1 - k, 3));
const pop = k => (k <= 0 ? 0 : k >= 1 ? 1 : 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2)); // passa um pouco e volta

// ---------- limpeza (o que vem do Claude) ----------
const txt = (v, max) => String(v ?? '').slice(0, max);
export function limparArte(entrada = {}, tipo = 'carrossel') {
  const t = TIPOS_ARTE.includes(tipo) ? tipo : 'post';
  const movimento = t === 'reels' ? true : t === 'stories' ? !!entrada.movimento : false;
  const max = t === 'carrossel' || t === 'reels' ? 10 : t === 'stories' && movimento ? 3 : 1;
  const slides = (Array.isArray(entrada.slides) ? entrada.slides : []).slice(0, max).map(s => ({
    layout: LAYOUTS.includes(s?.layout) ? s.layout : 'capa',
    tema: TEMAS_ARTE.includes(s?.tema) ? s.tema : 'escuro',
    efeito: EFEITOS.includes(s?.efeito) ? s.efeito : 'brilho',
    titulo: txt(s?.titulo, 220), texto: txt(s?.texto, 900), destaque: txt(s?.destaque, 80), rodape: txt(s?.rodape, 120),
    emoji: [...txt(s?.emoji, 40)].slice(0, 12).join(''),
    svg: /^\s*<svg[\s>]/i.test(String(s?.svg || '')) ? txt(s.svg, 24000) : '',
  }));
  return { logo: POSICOES_LOGO.includes(entrada.logo) ? entrada.logo : 'canto_superior_esquerdo', movimento, slides };
}

// ---------- recursos ----------
let logo = null, grao = null;
function carregarLogo() {
  logo ||= new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = new URL('../img/logo-rbtech.jpg', import.meta.url).href;
  });
  return logo;
}
async function fontes() {
  try {
    await Promise.all([
      ...['800 100px Poppins', '700 60px Poppins', '600 40px Poppins', '500 40px Poppins'].map(f => document.fonts.load(f)),
      document.fonts.load('80px "Noto Color Emoji"', '🔥📱').catch(() => {}),
    ]);
  } catch { /* usa a fonte do sistema */ }
}
function carregarSvg(svg) {
  return new Promise(res => {
    let s = svg;
    if (!/xmlns=/.test(s)) s = s.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  });
}
/** Textura de grão de filme (dá acabamento de foto, sem pesar). */
function texturaGrao() {
  if (grao) return grao;
  const c = document.createElement('canvas');
  c.width = c.height = 192;
  const g = c.getContext('2d'), d = g.createImageData(192, 192);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  grao = c;
  return c;
}
function aleatorio(semente) {
  let a = semente >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- texto ----------
/** Palavras entre *asteriscos* saem na cor de destaque. */
function pedacos(texto) {
  return String(texto).split(/\s+/).filter(Boolean).map(p => ({ p: p.replace(/\*/g, ''), marcado: /\*/.test(p) }));
}
function quebrar(g, texto, largura) {
  const linhas = [];
  for (const par of String(texto).split('\n')) {
    let linha = [], larg = 0;
    const espaco = g.measureText(' ').width;
    for (const w of pedacos(par)) {
      const lw = g.measureText(w.p).width;
      if (linha.length && larg + espaco + lw > largura) { linhas.push(linha); linha = []; larg = 0; }
      larg += (linha.length ? espaco : 0) + lw;
      linha.push(w);
    }
    linhas.push(linha);
  }
  return linhas;
}
/** Escreve o texto na caixa, diminuindo a letra até caber. Devolve onde terminou (y). */
function escrever(g, texto, { x, y, largura, altura, tamanho, minimo = 26, peso = 800, cor, destaque, alinhar = 'left', entre = 1.14, brilho = null }) {
  if (!String(texto || '').trim()) return y;
  let t = tamanho, linhas;
  for (;;) {
    g.font = `${peso} ${t}px ${FONTE}`;
    linhas = quebrar(g, texto, largura);
    if (linhas.length * t * entre <= altura || t <= minimo) break;
    t = Math.max(minimo, t - 4);
  }
  g.textBaseline = 'top';
  g.textAlign = 'left';
  const espaco = g.measureText(' ').width;
  linhas.forEach((linha, i) => {
    const total = linha.reduce((s, w, k) => s + g.measureText(w.p).width + (k ? espaco : 0), 0);
    let cx = alinhar === 'center' ? x + (largura - total) / 2 : alinhar === 'right' ? x + largura - total : x;
    for (const w of linha) {
      g.save();
      g.fillStyle = w.marcado && destaque ? destaque : cor;
      if (w.marcado && brilho) { g.shadowColor = brilho; g.shadowBlur = 28; }
      g.fillText(w.p, cx, y + i * t * entre);
      g.restore();
      cx += g.measureText(w.p).width + espaco;
    }
  });
  return y + linhas.length * t * entre;
}
function retangulo(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function etiqueta(g, texto, x, y, tema, { tamanho = 38 } = {}) {
  if (!texto) return y;
  g.font = `800 ${tamanho}px ${FONTE}`;
  const w = Math.min(g.measureText(texto.toUpperCase()).width + tamanho * 1.2, W - 2 * M), h = tamanho * 1.7;
  g.save(); g.shadowColor = 'rgba(255,214,10,.45)'; g.shadowBlur = 30;
  g.fillStyle = tema.destaque; retangulo(g, x, y, w, h, h / 2); g.fill(); g.restore();
  g.fillStyle = tema.tintaDestaque; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillText(texto.toUpperCase(), x + w / 2, y + h / 2 + 2, w - tamanho);
  return y + h;
}

// ---------- fundo (efeito visual; t em segundos, Infinity = imagem parada) ----------
function fundo(g, H, prep, t) {
  const { tema, nomeTema, indice } = prep, s = prep.s;
  const parado = !Number.isFinite(t), T = parado ? 1.4 : t;
  g.fillStyle = tema.fundo; g.fillRect(0, 0, W, H);
  const escuro = nomeTema === 'escuro';
  const luz = (x, y, r, cor) => { const gr = g.createRadialGradient(x, y, 10, x, y, r); gr.addColorStop(0, cor); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
  const pulso = 0.85 + 0.15 * Math.sin(T * 2.2);
  if (escuro) luz(W * 0.85, H * 0.08, H * 0.75, `rgba(255,214,10,${(0.2 * pulso).toFixed(3)})`);
  else if (nomeTema === 'amarelo') luz(W * 0.2, H * 0.9, H * 0.8, 'rgba(255,255,255,.35)');
  const efeito = s.efeito;
  if (efeito === 'grade') {
    // piso em perspectiva (estilo tech) andando para a frente
    g.save();
    const horizonte = H * 0.58, fuga = W / 2;
    g.strokeStyle = escuro ? 'rgba(255,214,10,.22)' : tema.linha; g.lineWidth = 2;
    for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(fuga, horizonte); g.lineTo(fuga + i * 170, H + 40); g.stroke(); }
    const fase = (T * 0.45) % 1;
    for (let k = 0; k < 14; k++) {
      const z = (k + fase) / 14, y = horizonte + Math.pow(z, 2.2) * (H - horizonte + 60);
      g.globalAlpha = Math.min(1, z * 2); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    g.globalAlpha = 1;
    luz(W / 2, horizonte, W * 0.8, escuro ? 'rgba(255,214,10,.16)' : 'rgba(255,255,255,.3)');
    g.restore();
  } else if (efeito === 'particulas') {
    const r = aleatorio(indice * 97 + 13);
    g.save();
    for (let i = 0; i < 70; i++) {
      const x = r() * W, v = 20 + r() * 60, y = ((r() * H - T * v) % H + H) % H, tam = 2 + r() * 7;
      g.globalAlpha = 0.25 + 0.5 * r();
      g.fillStyle = r() < 0.7 ? tema.destaque : tema.texto;
      if (r() < 0.25) { g.fillRect(x - tam, y - 1.5, tam * 2, 3); g.fillRect(x - 1.5, y - tam, 3, tam * 2); } // brilhos em cruz
      else { g.beginPath(); g.arc(x, y, tam / 2, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
  } else if (efeito === 'vidro') {
    // bolhas de luz se mexendo devagar atrás de um cartão de vidro
    luz(W * (0.25 + 0.08 * Math.sin(T * 0.7)), H * 0.3, 520, escuro ? 'rgba(255,214,10,.30)' : 'rgba(255,255,255,.55)');
    luz(W * (0.8 + 0.06 * Math.cos(T * 0.6)), H * 0.75, 560, escuro ? 'rgba(232,177,58,.25)' : 'rgba(0,0,0,.08)');
    g.save();
    g.fillStyle = tema.vidro; g.strokeStyle = tema.borda; g.lineWidth = 2;
    retangulo(g, M - 40, prep.topo - 50, W - 2 * M + 80, prep.base - prep.topo + 100, 44); g.fill(); g.stroke();
    g.restore();
  } else if (efeito === 'neon') {
    g.save();
    g.strokeStyle = tema.destaque; g.lineWidth = 6; g.shadowColor = tema.destaque; g.shadowBlur = 40 * pulso;
    retangulo(g, 40, 40, W - 80, H - 80, 40); g.stroke();
    g.shadowBlur = 0; g.globalAlpha = 0.06; g.fillStyle = escuro ? '#fff' : '#000';
    for (let y = (T * 40) % 8; y < H; y += 8) g.fillRect(0, y, W, 2); // linhas de tela
    g.restore();
  }
  if (efeito !== 'liso' && efeito !== 'neon') {
    // linhas de velocidade (como as da logo), entrando de lado; alterna o lado a cada tela
    const entrada = parado ? 1 : ease(t / 0.9);
    g.save();
    g.strokeStyle = tema.linha; g.lineCap = 'round';
    const esquerda = indice % 2 === 0;
    for (let i = 0; i < 6; i++) {
      g.lineWidth = 14 - i * 1.6;
      const y = H - 150 - i * 34, comp = (380 - i * 48) * entrada;
      g.beginPath();
      if (esquerda) { g.moveTo(-20, y); g.lineTo(comp, y - comp * 0.18); } else { g.moveTo(W + 20, y); g.lineTo(W - comp, y - comp * 0.18); }
      g.stroke();
    }
    g.restore();
  }
  if (prep.svgFundo) { g.save(); g.globalAlpha = 0.35; g.drawImage(prep.svgFundo, 0, 0, W, H); g.restore(); }
  // grão de filme (anda a cada quadro no vídeo)
  g.save();
  g.globalAlpha = nomeTema === 'escuro' ? 0.06 : 0.045;
  g.globalCompositeOperation = 'overlay';
  const pad = g.createPattern(texturaGrao(), 'repeat');
  const dx = parado ? 0 : Math.floor(T * 60) * 37 % 192;
  g.translate(dx, dx * 0.7); g.fillStyle = pad; g.fillRect(-200, -200, W + 400, H + 400);
  g.restore();
}

// ---------- moldura: logo, contador, "arraste", rodapé ----------
function moldura(g, H, prep, arte, tipo) {
  const { tema, nomeTema, indice, img, s } = prep;
  const posicao = arte.logo || 'canto_superior_esquerdo';
  if (img && posicao !== 'nenhum') {
    const h = 170, w = h * (img.width / img.height);
    const x = posicao.includes('direito') ? W - M + 20 - w : M - 20;
    const y = posicao.includes('superior') ? 56 : H - 56 - h;
    if (nomeTema === 'escuro') { g.save(); g.globalCompositeOperation = 'lighten'; g.drawImage(img, x, y, w, h); g.restore(); } // o preto da logo some no fundo escuro
    else { g.save(); g.fillStyle = '#0b0b0b'; retangulo(g, x - 10, y - 10, w + 20, h + 20, 22); g.fill(); g.drawImage(img, x, y, w, h); g.restore(); }
  }
  const total = arte.slides.length;
  if (total > 1 && tipo === 'carrossel') {
    g.font = `700 30px ${FONTE}`; g.fillStyle = tema.sub; g.textBaseline = 'top';
    const lado = posicao.includes('superior_direito') ? 'left' : 'right';
    g.textAlign = lado; g.fillText(`${indice + 1}/${total}`, lado === 'left' ? M : W - M, 80);
  }
  if (tipo === 'carrossel' && indice === 0 && total > 1) {
    g.font = `700 34px ${FONTE}`; g.fillStyle = tema.destaque; g.textAlign = 'right'; g.textBaseline = 'bottom';
    g.fillText('arraste →', W - M, H - 70);
  }
  if (s.rodape) {
    const livre = !posicao.includes('inferior');
    g.font = `600 30px ${FONTE}`; g.fillStyle = tema.sub; g.textBaseline = 'bottom'; g.textAlign = 'center';
    g.fillText(s.rodape, W / 2, H - (livre ? 64 : 250), W - 2 * M);
  }
}

// ---------- conteúdo (layouts) ----------
function conteudo(g, H, prep) {
  const { s, tema, svgIlustracao } = prep, topo = prep.topo, base = prep.base;
  const largura = W - 2 * M;
  const cor = tema.texto, destaque = tema.destaque, sub = tema.sub;
  const brilho = prep.nomeTema === 'escuro' ? 'rgba(255,214,10,.55)' : null;
  switch (s.layout) {
    case 'lista': {
      let y = escrever(g, s.titulo, { x: M, y: topo, largura: largura - (s.emoji ? 160 : 0), altura: 270, tamanho: 76, cor, destaque, brilho });
      y += 50;
      const itens = s.texto.split('\n').map(l => l.replace(/^\s*([-•*]|\d+[.)])\s*/, '').trim()).filter(Boolean).slice(0, 6);
      const passo = Math.min(vertical(prep.tipo) ? 210 : 170, (base - y) / Math.max(1, itens.length));
      itens.forEach((item, k) => {
        const cy = y + k * passo;
        g.save(); g.shadowColor = 'rgba(255,214,10,.4)'; g.shadowBlur = 18;
        g.fillStyle = destaque; g.beginPath(); g.arc(M + 34, cy + 34, 34, 0, Math.PI * 2); g.fill(); g.restore();
        g.fillStyle = tema.tintaDestaque; g.font = `800 36px ${FONTE}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(k + 1), M + 34, cy + 36);
        escrever(g, item, { x: M + 100, y: cy + 2, largura: largura - 100, altura: passo - 18, tamanho: 44, minimo: 28, peso: 600, cor, destaque, entre: 1.2 });
      });
      break;
    }
    case 'numero': {
      let y = escrever(g, s.titulo, { x: M, y: topo, largura, altura: 200, tamanho: 62, cor, destaque, alinhar: 'center' });
      g.save(); if (brilho) { g.shadowColor = brilho; g.shadowBlur = 50; }
      y = escrever(g, s.destaque, { x: M, y: y + 50, largura, altura: 330, tamanho: 250, minimo: 90, cor: destaque, alinhar: 'center', entre: 1.0 });
      g.restore();
      escrever(g, s.texto, { x: M + 20, y: y + 40, largura: largura - 40, altura: base - y - 40, tamanho: 46, minimo: 28, peso: 500, cor: sub, destaque, alinhar: 'center', entre: 1.3 });
      break;
    }
    case 'frase': {
      g.font = `800 260px ${FONTE}`; g.fillStyle = destaque; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText('“', M - 10, topo - 70);
      const y = escrever(g, s.titulo, { x: M, y: topo + 170, largura, altura: base - topo - 330, tamanho: 84, minimo: 40, cor, destaque, entre: 1.18, brilho });
      escrever(g, s.texto, { x: M, y: y + 40, largura, altura: 140, tamanho: 40, minimo: 26, peso: 600, cor: sub, destaque });
      break;
    }
    case 'comparativo': {
      const y = escrever(g, s.titulo, { x: M, y: topo, largura, altura: 220, tamanho: 70, cor, destaque, alinhar: 'center', brilho }) + 50;
      const [a, b] = (s.destaque || 'Antes | Depois').split('|').map(x => x.trim());
      const col = (largura - 30) / 2, alt = Math.min(base - y, 900);
      const linhas = s.texto.split('\n').map(l => l.split('|').map(x => x.trim())).filter(l => l[0] || l[1]).slice(0, 6);
      [[a, 0], [b, 1]].forEach(([cab, k]) => {
        const x = M + k * (col + 30);
        g.save();
        if (k) { g.shadowColor = 'rgba(255,214,10,.35)'; g.shadowBlur = 40; }
        g.fillStyle = k ? destaque : (prep.nomeTema === 'escuro' ? '#1d1d1d' : 'rgba(0,0,0,.08)');
        retangulo(g, x, y, col, alt, 28); g.fill(); g.restore();
        const tinta = k ? tema.tintaDestaque : cor;
        escrever(g, cab, { x: x + 30, y: y + 30, largura: col - 60, altura: 70, tamanho: 44, minimo: 28, cor: tinta, alinhar: 'center' });
        const passo = (alt - 140) / Math.max(1, linhas.length);
        linhas.forEach((l, i) => escrever(g, (k ? '✓ ' : '✕ ') + (l[k] || ''), { x: x + 30, y: y + 130 + i * passo, largura: col - 60, altura: passo - 12, tamanho: 36, minimo: 24, peso: 600, cor: tinta }));
      });
      break;
    }
    case 'cta': {
      let y = escrever(g, s.titulo, { x: M, y: topo + 40, largura, altura: 420, tamanho: 104, minimo: 48, cor, destaque, alinhar: 'center', brilho });
      y = escrever(g, s.texto, { x: M + 20, y: y + 40, largura: largura - 40, altura: 260, tamanho: 46, minimo: 28, peso: 500, cor: sub, destaque, alinhar: 'center', entre: 1.3 });
      if (s.destaque) {
        g.font = `800 48px ${FONTE}`;
        const w = Math.min(g.measureText(s.destaque).width + 120, largura), h = 120, x = (W - w) / 2, yb = Math.min(y + 60, base - h);
        g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 30; g.shadowOffsetY = 10;
        g.fillStyle = destaque; retangulo(g, x, yb, w, h, 60); g.fill(); g.restore();
        g.fillStyle = tema.tintaDestaque; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(s.destaque, W / 2, yb + h / 2 + 2, w - 60);
        prep.botao = { x, y: yb, w, h };
      }
      break;
    }
    case 'ilustracao': {
      const y = escrever(g, s.titulo, { x: M, y: topo, largura, altura: 230, tamanho: 72, cor, destaque, alinhar: 'center', brilho }) + 30;
      const textoAlt = s.texto ? 170 : 0;
      const caixaH = base - y - textoAlt;
      if (svgIlustracao) {
        const r = Math.min(largura / svgIlustracao.width, caixaH / svgIlustracao.height) || 1;
        const w = svgIlustracao.width * r, h = svgIlustracao.height * r;
        g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 40; g.shadowOffsetY = 20;
        g.drawImage(svgIlustracao, (W - w) / 2, y + (caixaH - h) / 2, w, h); g.restore();
      }
      escrever(g, s.texto, { x: M, y: base - textoAlt + 20, largura, altura: textoAlt, tamanho: 44, minimo: 26, peso: 500, cor: sub, destaque, alinhar: 'center', entre: 1.25 });
      break;
    }
    default: { // capa
      let y = topo + 30;
      if (s.destaque) y = etiqueta(g, s.destaque, M, y, tema) + 50;
      y = escrever(g, s.titulo, { x: M, y, largura: largura - (s.emoji ? 120 : 0), altura: base - y - 220, tamanho: vertical(prep.tipo) ? 128 : 118, minimo: 54, cor, destaque, entre: 1.06, brilho });
      escrever(g, s.texto, { x: M, y: y + 40, largura, altura: base - y - 40, tamanho: 48, minimo: 28, peso: 500, cor: sub, destaque, entre: 1.28 });
    }
  }
}

// ---------- emojis: figurinhas grandes com sombra ----------
function posicoesEmoji(prep, n) {
  const H = prep.H, topo = prep.topo;
  const lugares = [[W - M - 90, topo + 40, -10, 190], [M + 70, prep.base - 40, 12, 150], [W - M - 60, prep.base - 120, 8, 130]];
  // títulos centralizados ocupam a largura toda: o emoji fica acima do título e embaixo, no canto
  if (['numero', 'cta', 'ilustracao', 'comparativo', 'frase'].includes(prep.s.layout)) { lugares[0] = [W - M - 60, topo - 95, -10, 120]; lugares[1] = [M + 60, H - (H > 1400 ? 520 : 330), 12, 120]; lugares[2] = [W - M - 60, H - (H > 1400 ? 520 : 330), 8, 110]; }
  return lugares.slice(0, n);
}
function emojis(g, prep, t) {
  const lista = [...new Intl.Segmenter('pt', { granularity: 'grapheme' }).segment(prep.s.emoji || '')].map(x => x.segment).filter(e => e.trim()).slice(0, 3);
  if (!lista.length) return;
  const parado = !Number.isFinite(t);
  posicoesEmoji(prep, lista.length).forEach(([x, y, giro, tam], i) => {
    const k = parado ? 1 : pop((t - 0.35 - i * 0.18) / 0.55);
    if (k <= 0) return;
    const bob = parado ? 0 : Math.sin(t * 2.4 + i) * 10;
    g.save();
    g.translate(x, y + bob);
    g.rotate((giro + (parado ? 0 : Math.sin(t * 1.6 + i) * 4)) * Math.PI / 180);
    g.scale(k, k);
    g.font = `${tam}px ${FONTE_EMOJI}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 30; g.shadowOffsetY = 16;
    g.fillText(lista[i], 0, 0);
    g.restore();
  });
}

// ---------- montagem ----------
async function preparar(arte, tipo, indice) {
  const [, H] = tamanhoDa(tipo);
  const s = arte.slides[indice];
  const nomeTema = TEMAS[s.tema] ? s.tema : 'escuro';
  const [img, svg] = await Promise.all([carregarLogo(), s.svg ? carregarSvg(s.svg) : null, fontes()]);
  const prep = {
    H, s, tipo, indice, img, nomeTema, tema: TEMAS[nomeTema],
    topo: 290 + (H > 1400 ? 200 : 0), base: H - (H > 1400 ? 460 : 300),
    svgIlustracao: s.layout === 'ilustracao' ? svg : null, svgFundo: s.layout !== 'ilustracao' ? svg : null,
  };
  // o conteúdo é desenhado uma vez numa camada transparente (no vídeo ele entra animado)
  const camada = document.createElement('canvas');
  camada.width = W; camada.height = H;
  conteudo(camada.getContext('2d'), H, prep);
  prep.camada = camada;
  return prep;
}
/** Desenha a tela no instante t (segundos desde que ela entrou; Infinity = imagem parada, já completa). */
function compor(g, prep, arte, tipo, t) {
  const H = prep.H, parado = !Number.isFinite(t);
  fundo(g, H, prep, t);
  if (parado) g.drawImage(prep.camada, 0, 0);
  else {
    // o texto sobe e vai aparecendo de cima para baixo (o título primeiro, depois o resto)
    const k = ease((t - 0.15) / 0.9);
    if (k > 0) {
      g.save();
      g.globalAlpha = Math.min(1, k * 1.4);
      g.beginPath(); g.rect(0, 0, W, prep.topo - 60 + (H - prep.topo + 120) * k); g.clip();
      g.drawImage(prep.camada, 0, 70 * (1 - k));
      g.restore();
    }
    if (prep.botao && t > 1.2) { // o botão do cta pulsa
      const b = prep.botao, p = (Math.sin((t - 1.2) * 4) + 1) / 2;
      g.save(); g.strokeStyle = prep.tema.destaque; g.lineWidth = 4; g.globalAlpha = 0.6 * (1 - p);
      retangulo(g, b.x - 16 * p, b.y - 16 * p, b.w + 32 * p, b.h + 32 * p, (b.h + 32 * p) / 2); g.stroke(); g.restore();
    }
  }
  emojis(g, prep, t);
  moldura(g, H, prep, arte, tipo);
}

/** Desenha a tela `indice` da arte (imagem parada) num canvas (cria um se não vier). */
export async function desenharTela(arte, tipo, indice, canvas = document.createElement('canvas')) {
  const prep = await preparar(arte, tipo, indice);
  canvas.width = W; canvas.height = prep.H;
  compor(canvas.getContext('2d'), prep, arte, tipo, Infinity);
  return canvas;
}

/** Todas as telas em JPG (post, carrossel e stories parado). */
export async function gerarImagens(arte, tipo) {
  const lista = [];
  for (let i = 0; i < arte.slides.length; i++) {
    const c = await desenharTela(arte, tipo, i);
    lista.push(await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92)));
  }
  return lista;
}

/** Miniaturas (data URL) para o chat. */
export async function miniaturas(arte, tipo, largura = 240) {
  const lista = [];
  for (let i = 0; i < arte.slides.length; i++) {
    const c = await desenharTela(arte, tipo, i);
    const m = document.createElement('canvas');
    m.width = largura; m.height = Math.round(largura * c.height / c.width);
    m.getContext('2d').drawImage(c, 0, 0, m.width, m.height);
    lista.push(m.toDataURL('image/jpeg', 0.8));
  }
  return lista;
}

// ---------- movimento (stories e reels animados) ----------
export const duracaoDaTela = (arte, tipo) => (tipo === 'stories' ? Math.max(5, Math.min(7, 15 / arte.slides.length)) : 3.2);
export const duracaoTotal = (arte, tipo) => duracaoDaTela(arte, tipo) * arte.slides.length;
const TRANSICAO = 0.45;
function quadroDoVideo(g, preps, arte, tipo, tempo) {
  const dur = duracaoDaTela(arte, tipo), n = preps.length;
  const i = Math.min(n - 1, Math.floor(tempo / dur)), local = tempo - i * dur;
  if (i > 0 && local < TRANSICAO) {
    // passagem: a tela nova entra varrendo da esquerda, com uma faixa amarela na frente
    compor(g, preps[i - 1], arte, tipo, dur + local);
    const k = ease(local / TRANSICAO), x = W * k;
    g.save(); g.beginPath(); g.rect(0, 0, x, preps[i].H); g.clip();
    compor(g, preps[i], arte, tipo, local);
    g.restore();
    g.fillStyle = '#ffd60a'; g.fillRect(x - 18, 0, 18, preps[i].H);
  } else compor(g, preps[i], arte, tipo, local);
}
/** Toca a animação ao vivo num canvas (prévia). Devolve a função que para. */
export async function tocarAnimacao(arte, tipo, canvas) {
  const preps = [];
  for (let i = 0; i < arte.slides.length; i++) preps.push(await preparar(arte, tipo, i));
  canvas.width = W; canvas.height = preps[0].H;
  const g = canvas.getContext('2d'), total = duracaoTotal(arte, tipo) + 0.8;
  let parar = false;
  const inicio = performance.now();
  const passo = () => {
    if (parar) return;
    quadroDoVideo(g, preps, arte, tipo, ((performance.now() - inicio) / 1000) % total);
    requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
  return () => { parar = true; };
}
export function formatoDeVideo() {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || null;
}
/** Grava a animação em MP4 (tempo real: um reels de 7 telas leva uns 22 s). Não troque de aba enquanto grava. */
export async function gravarVideo(arte, tipo, { aoProgresso = () => {} } = {}) {
  const formato = formatoDeVideo();
  if (!formato) throw new Error('este navegador não grava vídeo MP4. Use o Chrome ou o Safari atualizados (no iPhone, o Safari grava).');
  const preps = [];
  for (let i = 0; i < arte.slides.length; i++) preps.push(await preparar(arte, tipo, i));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = preps[0].H;
  const g = canvas.getContext('2d');
  quadroDoVideo(g, preps, arte, tipo, 0);
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: formato, videoBitsPerSecond: 10_000_000 });
  const pedacosVideo = [];
  rec.ondataavailable = e => { if (e.data?.size) pedacosVideo.push(e.data); };
  const fim = new Promise(res => { rec.onstop = res; });
  const total = duracaoTotal(arte, tipo) + 0.6; // meio segundo parado no fim
  rec.start(250);
  const inicio = performance.now();
  await new Promise(res => {
    const passo = () => {
      const tempo = (performance.now() - inicio) / 1000;
      quadroDoVideo(g, preps, arte, tipo, Math.min(tempo, total - 0.01));
      aoProgresso(Math.min(1, tempo / total));
      if (tempo >= total) res(); else requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
  rec.stop();
  await fim;
  stream.getTracks().forEach(t => t.stop());
  return new Blob(pedacosVideo, { type: formato.split(';')[0] });
}
