// Artes da Helena: carrosséis, posts, stories e reels no padrão de designer da RB Tech.
// A Helena (Claude) escreve o conteúdo e dirige a arte; este módulo desenha no navegador:
// - tipografia editorial: blocos de título em letra condensada (Anton) do tamanho exato da coluna, com linhas em
//   amarelo, em contorno ou pequenas; cursiva (Allison) cruzando a tela; texto com **negrito** e *destaque*;
// - imagem de destaque recortada (gerada pelo /api/imagem, ou um iPhone 3D desenhado aqui), com brilho atrás,
//   tratamento de cor e, no carrossel, atravessando para a tela seguinte (o carrossel é montado como um painel só);
// - acabamento: selo de perfil com a logo RB Tech Celulares, bolinhas de página, quadradinhos de pixel, brilhos de
//   lente, feixe de luz, grão de filme e efeitos de fundo (grade tech, partículas, vidro, neon);
// - movimento (reels e stories animados): texto subindo, cursiva se escrevendo, imagem entrando com zoom lento,
//   emojis estalando e passagem amarela entre as telas (MP4 gravado no navegador).
// Feed: 1080×1350. Stories e reels: 1080×1920.

export const LAYOUTS = ['capa', 'topico', 'fechamento', 'lista', 'numero', 'comparativo', 'cta'];
export const TEMAS_ARTE = ['escuro', 'amarelo', 'claro'];
export const EFEITOS = ['brilho', 'luz', 'pixel', 'grade', 'particulas', 'vidro', 'neon', 'liso'];
export const LADOS_IMAGEM = ['direita', 'esquerda', 'centro', 'atravessa', 'fundo'];
export const POSICOES_LOGO = ['canto_superior_esquerdo', 'canto_superior_direito', 'canto_inferior_esquerdo', 'canto_inferior_direito', 'nenhum'];
export const TIPOS_ARTE = ['carrossel', 'post', 'stories', 'reels'];
const TEMAS = {
  escuro: { fundo: '#070707', texto: '#ffffff', sub: '#d6d6d6', destaque: '#ffd60a', tintaDestaque: '#0b0b0b', linha: 'rgba(255,214,10,.16)', vidro: 'rgba(255,255,255,.06)', borda: 'rgba(255,214,10,.35)', luz: '255,214,10' },
  amarelo: { fundo: '#ffd000', texto: '#0b0b0b', sub: '#1d1d1d', destaque: '#ffffff', tintaDestaque: '#0b0b0b', linha: 'rgba(0,0,0,.10)', vidro: 'rgba(255,255,255,.28)', borda: 'rgba(0,0,0,.25)', luz: '255,255,255' },
  claro: { fundo: '#f4f1ea', texto: '#0b0b0b', sub: '#3d3d3d', destaque: '#c99a00', tintaDestaque: '#ffffff', linha: 'rgba(201,154,0,.18)', vidro: 'rgba(255,255,255,.7)', borda: 'rgba(201,154,0,.4)', luz: '201,154,0' },
};
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';
const CORPO = `Poppins, ${EMOJI}, "Helvetica Neue", Arial, sans-serif`;
const TITULO = `Anton, "Bebas Neue", Impact, ${EMOJI}, sans-serif`;
const CURSIVA = 'Allison, "Great Vibes", "Brush Script MT", cursive';
const W = 1080, M = 84;
const vertical = tipo => tipo === 'stories' || tipo === 'reels';
export const tamanhoDa = tipo => [W, vertical(tipo) ? 1920 : 1350];
const ease = k => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.pow(1 - k, 3));
const pop = k => (k <= 0 ? 0 : k >= 1 ? 1 : 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2));

// ---------- limpeza (o que vem do Claude) ----------
const txt = (v, max) => String(v ?? '').slice(0, max);
export function limparArte(entrada = {}, tipo = 'carrossel') {
  const t = TIPOS_ARTE.includes(tipo) ? tipo : 'post';
  const movimento = t === 'reels' ? true : t === 'stories' ? !!entrada.movimento : false;
  const max = t === 'carrossel' || t === 'reels' ? 10 : t === 'stories' && movimento ? 3 : 1;
  const slides = (Array.isArray(entrada.slides) ? entrada.slides : []).slice(0, max).map(s => {
    const url = String(s?.imagem_url || '');
    return {
      layout: LAYOUTS.includes(s?.layout) ? s.layout : s?.layout === 'frase' || s?.layout === 'ilustracao' ? 'topico' : 'capa',
      tema: TEMAS_ARTE.includes(s?.tema) ? s.tema : 'escuro',
      efeito: EFEITOS.includes(s?.efeito) ? s.efeito : 'brilho',
      chamada: txt(s?.chamada, 80), titulo: txt(s?.titulo, 220), texto: txt(s?.texto, 900), destaque: txt(s?.destaque, 80),
      assinatura: txt(s?.assinatura, 28), rodape: txt(s?.rodape, 120),
      emoji: [...txt(s?.emoji, 40)].slice(0, 12).join(''),
      imagem: txt(s?.imagem, 1200),
      imagem_url: /^\/api\/imagem\?u=https%3A%2F%2F[\w.%-]+$/i.test(url) ? url : '',
      imagem_lado: LADOS_IMAGEM.includes(s?.imagem_lado) ? s.imagem_lado : 'direita',
      imagem_cor: s?.imagem_cor === 'dourado' ? 'dourado' : 'natural',
      svg_tela: limparSvg(s?.svg_tela), // a tela desenhada pelo diretor de arte (Claude), quando houver
    };
  });
  return {
    logo: POSICOES_LOGO.includes(entrada.logo) ? entrada.logo : 'canto_superior_esquerdo',
    perfil: txt(entrada.perfil || 'RB Tech Celulares', 40), arroba: txt(entrada.arroba, 40).replace(/^([^@])/, '@$1'),
    movimento, slides,
  };
}

// ---------- telas desenhadas pelo diretor de arte (SVG escrito pelo Claude) ----------
/** Tira do SVG tudo que não é desenho (scripts, eventos, links de fora). Imagens só por {{logo}}, {{imagem:N}} ou #id. */
export function limparSvg(svg) {
  let s = String(svg || '').trim();
  if (!/^<svg[\s>]/i.test(s) || !/<\/svg>\s*$/i.test(s) || s.length > 150_000) return '';
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/((?:xlink:)?href\s*=\s*)("|')(?!\{\{(?:logo|imagem:\d+)\}\}|#)[^"']*\2/gi, '$1$2#$2')
    .replace(/url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/gi, 'none');
  return s;
}
const paraDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
let cssFontes = null;
/** As fontes vão dentro do SVG (uma imagem SVG não enxerga as fontes da página). */
function fontesParaSvg() {
  cssFontes ||= (async () => {
    try {
      const css = await (await fetch('https://fonts.googleapis.com/css2?family=Anton&family=Allison&family=Poppins:wght@400;500;600;700;800&display=block')).text();
      const blocos = css.split('/*').slice(1).map(b => b.split('*/')).filter(([nome]) => /^\s*latin(-ext)?\s*$/.test(nome));
      const regras = await Promise.all(blocos.map(async ([, regra]) => {
        const m = regra.match(/url\((https:[^)]+)\)/);
        if (!m) return '';
        return regra.trim().replace(m[1], await paraDataUrl(await (await fetch(m[1])).blob()));
      }));
      return regras.join('\n');
    } catch { return ''; }
  })();
  return cssFontes;
}
async function imagemDaTelaSvg(svg, geral) {
  const css = await fontesParaSvg();
  // imagem pedida que não existe (ou link que a limpeza tirou): some o elemento inteiro, sem ícone de imagem quebrada
  let s = svg.replace(/<image\b[^>]*?(?:xlink:)?href\s*=\s*("|')(\{\{imagem:(\d+)\}\}|#)\1[^>]*?(?:\/>|>\s*<\/image>)/gi, (m, _q, ref, n) => (ref === '#' || !geral.imagemUrl[Number(n)] ? '' : m));
  s = s.replace(/\{\{logo\}\}/g, geral.logoUrl || '#').replace(/\{\{imagem:(\d+)\}\}/g, (_, n) => geral.imagemUrl[Number(n)] || '#');
  if (!/xmlns=/.test(s)) s = s.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  if (!/xmlns:xlink=/.test(s) && /xlink:/.test(s)) s = s.replace(/<svg/i, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  s = s.replace(/<svg[^>]*>/i, m => `${m}<style>${css}</style>`);
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  });
}
/** O que o diretor de arte precisa saber: conteúdo, tamanhos das imagens e o que atravessa de uma tela para a outra. */
export async function planoDoDesigner(arte, tipo) {
  const geral = await prepararArte(arte, tipo);
  const [largura, altura] = tamanhoDa(tipo);
  return {
    tipo, tamanho: [largura, altura], perfil: arte.perfil, arroba: arte.arroba,
    logo: [geral.logoImg?.width || 450, geral.logoImg?.height || 480],
    imagens: arte.slides.map((s, i) => (geral.imagem[i] ? { w: geral.imagem[i].width, h: geral.imagem[i].height, descricao: s.imagem || 'iPhone em 3D' } : null)),
    fixos: tipo === 'carrossel' ? geral.painel.filter(e => e.tipo === 'imagem' && e.lado === 'atravessa' && e.tela < arte.slides.length - 1)
      .map(e => ({ imagem: e.tela, x: e.x, y: e.y, w: e.w, h: e.h, telas: [e.tela, e.tela + 1] })) : [],
    slides: arte.slides.map(({ layout, tema, efeito, chamada, titulo, texto, destaque, assinatura, emoji, rodape, imagem_lado }) => ({ layout, tema, efeito, chamada, titulo, texto, destaque, assinatura, emoji, rodape, imagem_lado })),
  };
}
/** A tela em JPEG (para o revisor visual olhar). Devolve null se o SVG não abrir. */
export async function fotoDaTela(arte, tipo, indice, largura = 720) {
  const prep = await preparar(arte, tipo, indice);
  if (arte.slides[indice].svg_tela && !prep.svgImg) return null;
  const c = document.createElement('canvas');
  c.width = W; c.height = prep.H;
  compor(c.getContext('2d'), prep, arte, tipo, Infinity);
  const m = document.createElement('canvas');
  m.width = largura; m.height = Math.round(largura * c.height / c.width);
  m.getContext('2d').drawImage(c, 0, 0, m.width, m.height);
  return m.toDataURL('image/jpeg', 0.82);
}

// ---------- recursos ----------
let logo = null, grao = null;
const imagens = new Map();
function carregarImagem(src) {
  if (!imagens.has(src)) {
    imagens.set(src, new Promise(res => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src;
    }));
  }
  return imagens.get(src);
}
const carregarLogo = () => (logo ||= carregarImagem(new URL('../img/logo-rbtech.jpg', import.meta.url).href));
let fontesProntas = null;
function fontes() {
  fontesProntas ||= Promise.all([
    ...['800 100px Poppins', '700 60px Poppins', '600 40px Poppins', '500 40px Poppins', '400 40px Poppins', '100px Anton', '100px Allison'].map(f => document.fonts.load(f).catch(() => {})),
    document.fonts.load('80px "Noto Color Emoji"', '🔥📱').catch(() => {}),
  ]).catch(() => {});
  return fontesProntas;
}
function texturaGrao() {
  if (grao) return grao;
  const c = document.createElement('canvas');
  c.width = c.height = 192;
  const g = c.getContext('2d'), d = g.createImageData(192, 192);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  return (grao = c);
}
function aleatorio(semente) {
  let a = semente >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Tratamento de cor da imagem de destaque: preto e branco com luz dourada (como nas artes de designer). */
function dourado(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const l = (0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]) / 255;
    const k = Math.pow(l, 1.1);
    p[i] = 18 + k * 237; p[i + 1] = 16 + k * 212; p[i + 2] = 12 + Math.pow(k, 1.6) * 150;
  }
  g.putImageData(d, 0, 0);
  return c;
}

// ---------- iPhone 3D desenhado (quando não há imagem gerada) ----------
function iphone(largura = 520, giro = -0.2) {
  const w = largura, h = largura * 2.05;
  const lado = Math.abs(Math.sin(giro)) * h + Math.cos(giro) * w + 120, alto = Math.cos(giro) * h + Math.abs(Math.sin(giro)) * w + 120;
  const c = document.createElement('canvas');
  c.width = Math.ceil(lado); c.height = Math.ceil(alto);
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2); g.rotate(giro); g.translate(-w / 2, -h / 2);
  const r = w * 0.17;
  // espessura do aparelho (a lateral aparece atrás, deslocada)
  const lateral = g.createLinearGradient(0, 0, w, 0);
  lateral.addColorStop(0, '#3b3934'); lateral.addColorStop(0.5, '#a39f96'); lateral.addColorStop(1, '#4a4741');
  retangulo(g, 22, 14, w, h, r); g.fillStyle = lateral; g.fill();
  const corpo = g.createLinearGradient(0, 0, w, h);
  corpo.addColorStop(0, '#e9e6df'); corpo.addColorStop(0.18, '#7d7a74'); corpo.addColorStop(0.5, '#2a2926'); corpo.addColorStop(0.82, '#8a867e'); corpo.addColorStop(1, '#d8d4cb');
  retangulo(g, 0, 0, w, h, r); g.fillStyle = corpo; g.fill();
  const b = w * 0.035;
  retangulo(g, b, b, w - 2 * b, h - 2 * b, r * 0.85); g.fillStyle = '#050505'; g.fill();
  const tela = g.createLinearGradient(0, 0, w, h);
  tela.addColorStop(0, '#2b2203'); tela.addColorStop(0.45, '#0d0b06'); tela.addColorStop(1, '#3a2a00');
  const s = w * 0.07;
  retangulo(g, s, s, w - 2 * s, h - 2 * s, r * 0.7); g.fillStyle = tela; g.fill();
  // ondas de luz na tela (papel de parede)
  g.save(); retangulo(g, s, s, w - 2 * s, h - 2 * s, r * 0.7); g.clip();
  for (let i = 0; i < 5; i++) {
    const gr = g.createRadialGradient(w * (0.2 + i * 0.18), h * (0.75 - i * 0.12), 10, w * (0.2 + i * 0.18), h * (0.75 - i * 0.12), w * 0.55);
    gr.addColorStop(0, `rgba(255,${180 + i * 10},10,.55)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  const reflexo = g.createLinearGradient(0, 0, w, h * 0.6);
  reflexo.addColorStop(0, 'rgba(255,255,255,.22)'); reflexo.addColorStop(0.35, 'rgba(255,255,255,0)');
  g.fillStyle = reflexo; g.fillRect(0, 0, w, h);
  g.restore();
  retangulo(g, w * 0.36, s + h * 0.018, w * 0.28, h * 0.034, h * 0.017); g.fillStyle = '#000'; g.fill(); // ilha dinâmica
  // botões laterais
  g.fillStyle = '#6d6a64';
  retangulo(g, -6, h * 0.22, 8, h * 0.06, 3); g.fill(); retangulo(g, -6, h * 0.31, 8, h * 0.1, 3); g.fill(); retangulo(g, w - 2, h * 0.27, 8, h * 0.14, 3); g.fill();
  return c;
}

// ---------- texto ----------
/** **negrito**, *destaque* (cor da marca). Funciona com palavras soltas ou trechos. */
function pedacos(texto) {
  const lista = [];
  let negrito = false, marcado = false;
  for (const bruto of String(texto).split(/\s+/).filter(Boolean)) {
    let p = bruto, n = negrito, m = marcado;
    if (p.startsWith('**')) { n = negrito = true; p = p.slice(2); } else if (p.startsWith('*')) { m = marcado = true; p = p.slice(1); }
    const fecha = p.match(/(\*\*|\*)([.,!?:;)"'…]*)$/);
    if (fecha) { p = p.slice(0, -fecha[0].length) + fecha[2]; if (fecha[1] === '**') negrito = false; else marcado = false; }
    if (p) lista.push({ p: p.replace(/\*/g, ''), negrito: n, marcado: m });
  }
  return lista;
}
const fonteDe = (w, peso, t, familia) => `${w.negrito || w.marcado ? Math.max(peso, 700) : peso} ${t}px ${familia}`;
function quebrar(g, texto, largura, peso, t, familia) {
  const linhas = [];
  for (const par of String(texto).split('\n')) {
    let linha = [], larg = 0;
    for (const w of pedacos(par)) {
      g.font = fonteDe(w, peso, t, familia);
      const lw = g.measureText(w.p).width, esp = t * 0.28;
      if (linha.length && larg + esp + lw > largura) { linhas.push(linha); linha = []; larg = 0; }
      larg += (linha.length ? esp : 0) + lw;
      w.l = lw;
      linha.push(w);
    }
    linhas.push(linha);
  }
  return linhas;
}
/** Escreve o texto na caixa, diminuindo a letra até caber. Devolve onde terminou (y). */
function escrever(g, texto, { x, y, largura, altura, tamanho, minimo = 26, peso = 400, cor, forte, destaque, alinhar = 'left', entre = 1.22, familia = CORPO, brilho = null }) {
  if (!String(texto || '').trim()) return y;
  let t = tamanho, linhas;
  for (;;) {
    linhas = quebrar(g, texto, largura, peso, t, familia);
    if (linhas.length * t * entre <= altura || t <= minimo) break;
    t = Math.max(minimo, t - 3);
  }
  g.textBaseline = 'top'; g.textAlign = 'left';
  linhas.forEach((linha, i) => {
    const esp = t * 0.28;
    const total = linha.reduce((s, w, k) => s + w.l + (k ? esp : 0), 0);
    let cx = alinhar === 'center' ? x + (largura - total) / 2 : alinhar === 'right' ? x + largura - total : x;
    for (const w of linha) {
      g.save();
      g.font = fonteDe(w, peso, t, familia);
      g.fillStyle = w.marcado && destaque ? destaque : w.negrito && forte ? forte : cor;
      if (w.marcado && brilho) { g.shadowColor = brilho; g.shadowBlur = 26; }
      g.fillText(w.p, cx, y + i * t * entre);
      g.restore();
      cx += w.l + esp;
    }
  });
  return y + linhas.length * t * entre;
}
/**
 * Bloco de título de designer: cada linha em letra condensada, esticada até a largura da coluna.
 * *LINHA* = cor da marca · ~LINHA~ = só o contorno · +linha = pequena (como o "das" entre QUALIDADE e IMAGENS).
 */
function blocoTitulo(g, titulo, { x, y, largura, alturaMax, cor, destaque, alinhar = 'left', maximo = 330, brilho, medir = false }) {
  const linhas = String(titulo || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    let estilo = 'normal', texto = l;
    if (/^\+/.test(texto)) { estilo = 'pequena'; texto = texto.slice(1).trim(); }
    if (/^\*.*\*$/.test(texto)) { estilo = estilo === 'pequena' ? 'pequena-destaque' : 'destaque'; texto = texto.slice(1, -1); }
    else if (/^~.*~$/.test(texto)) { estilo = 'contorno'; texto = texto.slice(1, -1); }
    // *palavra* no meio da linha: só ela na cor da marca
    const partes = estilo === 'normal' && /\*/.test(texto) ? texto.split(/(\*[^*]+\*)/).filter(Boolean).map(p => ({ p: p.replace(/\*/g, '').toUpperCase(), d: /^\*/.test(p) })) : null;
    return { texto: texto.replace(/[*~]/g, '').toUpperCase(), estilo, partes };
  });
  if (!linhas.length) return y;
  const base = 100;
  for (const l of linhas) {
    g.font = `${base}px ${TITULO}`;
    const w = g.measureText(l.texto).width || 1;
    l.t = l.estilo.startsWith('pequena') ? 0 : Math.min(maximo, base * largura / w);
  }
  const grandes = linhas.filter(l => l.t);
  const media = grandes.length ? grandes.reduce((s, l) => s + l.t, 0) / grandes.length : 120;
  for (const l of linhas) if (!l.t) l.t = Math.min(media * 0.34, 80);
  const passo = l => l.t * (l.estilo.startsWith('pequena') ? 1.25 : 0.9);
  let altura = linhas.reduce((s, l) => s + passo(l), 0);
  const k = altura > alturaMax ? alturaMax / altura : 1;
  for (const l of linhas) l.t *= k;
  altura *= k;
  if (medir) return y + altura;
  let cy = y;
  g.textBaseline = 'top';
  for (const l of linhas) {
    g.save();
    g.font = `${l.t}px ${TITULO}`;
    const w = g.measureText(l.texto).width;
    const lx = alinhar === 'center' ? x + (largura - w) / 2 : alinhar === 'right' ? x + largura - w : x;
    const deCima = -l.t * 0.04; // a Anton tem pouco espaço em cima
    if (l.estilo === 'contorno') {
      g.strokeStyle = cor; g.lineWidth = Math.max(2, l.t * 0.025); g.strokeText(l.texto, lx, cy + deCima);
    } else if (l.partes) {
      let px = lx;
      for (const p of l.partes) {
        g.save(); g.fillStyle = p.d ? destaque : cor;
        if (p.d && brilho) { g.shadowColor = brilho; g.shadowBlur = 40; }
        g.fillText(p.p, px, cy + deCima); g.restore();
        px += g.measureText(p.p).width;
      }
    } else {
      g.fillStyle = l.estilo.includes('destaque') ? destaque : l.estilo === 'pequena' ? destaque : cor;
      if (l.estilo.includes('destaque') && brilho) { g.shadowColor = brilho; g.shadowBlur = 40; }
      g.fillText(l.texto, lx, cy + deCima);
    }
    g.restore();
    cy += passo(l);
  }
  return cy;
}
function retangulo(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ---------- acabamentos ----------
function luz(g, x, y, r, rgb, a) { const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
/** Brilho de lente: núcleo forte, halo e um anel. */
function flare(g, x, y, tam, rgb, a = 1) {
  luz(g, x, y, tam * 3.2, rgb, 0.22 * a);
  luz(g, x, y, tam, '255,255,255', 0.95 * a);
  g.save(); g.globalAlpha = 0.25 * a; g.strokeStyle = `rgb(${rgb})`; g.lineWidth = 2;
  g.beginPath(); g.arc(x, y, tam * 2.1, 0, Math.PI * 2); g.stroke(); g.restore();
}
/** Quadradinhos de pixel em escada (o detalhe "tech" das artes de referência). */
function pixelEscada(g, x, y, lado, n, cor, sentido = 1, semente = 1) {
  const r = aleatorio(semente);
  g.save(); g.lineWidth = 2;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i % 4; j++) {
      const px = x + sentido * i * lado, py = y - j * lado;
      if (r() < 0.18) { g.fillStyle = cor; g.globalAlpha = 0.5; g.fillRect(px, py, lado, lado); }
      g.globalAlpha = 0.55; g.strokeStyle = 'rgba(255,255,255,.65)'; g.strokeRect(px + 1, py + 1, lado - 2, lado - 2);
    }
  }
  g.restore();
}
function feixe(g, x, H, rgb, a) {
  const gr = g.createLinearGradient(x - 70, 0, x + 70, 0);
  gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(0.45, `rgba(${rgb},${0.35 * a})`); gr.addColorStop(0.5, `rgba(255,255,255,${0.9 * a})`); gr.addColorStop(0.55, `rgba(${rgb},${0.35 * a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(x - 70, 0, 140, H);
}

// ---------- fundo (efeito visual; t em segundos, Infinity = parado) ----------
function fundo(g, prep, t) {
  const { tema, nomeTema, indice, H } = prep, s = prep.s;
  const parado = !Number.isFinite(t), T = parado ? 1.4 : t;
  g.fillStyle = tema.fundo; g.fillRect(0, 0, W, H);
  const escuro = nomeTema === 'escuro';
  const pulso = 0.85 + 0.15 * Math.sin(T * 2.2);
  if (escuro) { luz(g, W * (indice % 2 ? 0.1 : 0.9), H * 0.1, H * 0.7, tema.luz, 0.16 * pulso); luz(g, W * 0.5, H * 1.05, H * 0.6, tema.luz, 0.08); }
  else if (nomeTema === 'amarelo') { luz(g, W * 0.15, H * 0.15, H * 0.9, '255,255,255', 0.35); luz(g, W, H, H * 0.8, '160,90,0', 0.25); }
  const r = aleatorio(indice * 97 + 13);
  switch (s.efeito) {
    case 'grade': {
      g.save();
      const horizonte = H * 0.6, fuga = W / 2;
      g.strokeStyle = escuro ? 'rgba(255,214,10,.2)' : tema.linha; g.lineWidth = 2;
      for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(fuga, horizonte); g.lineTo(fuga + i * 170, H + 40); g.stroke(); }
      const fase = (T * 0.45) % 1;
      for (let k = 0; k < 14; k++) { const z = (k + fase) / 14, y = horizonte + Math.pow(z, 2.2) * (H - horizonte + 60); g.globalAlpha = Math.min(1, z * 2); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.restore();
      break;
    }
    case 'pixel': {
      // malha fina e blocos de pixel espalhados, como uma tela de edição
      g.save(); g.strokeStyle = escuro ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)'; g.lineWidth = 1;
      for (let x = 0; x < W; x += 54) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (let y = 0; y < H; y += 54) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      for (let i = 0; i < 26; i++) { const tam = 54 * (1 + Math.floor(r() * 3)); g.fillStyle = `rgba(${tema.luz},${(0.04 + r() * 0.1) * (parado ? 1 : 0.7 + 0.3 * Math.sin(T * 3 + i))})`; g.fillRect(Math.floor(r() * 20) * 54, Math.floor(r() * 25) * 54, tam, tam); }
      g.restore();
      break;
    }
    case 'particulas': {
      g.save();
      for (let i = 0; i < 70; i++) {
        const x = r() * W, v = 20 + r() * 60, y = ((r() * H - T * v) % H + H) % H, tam = 2 + r() * 7;
        g.globalAlpha = 0.25 + 0.5 * r(); g.fillStyle = r() < 0.7 ? tema.destaque : tema.texto;
        if (r() < 0.25) { g.fillRect(x - tam, y - 1.5, tam * 2, 3); g.fillRect(x - 1.5, y - tam, 3, tam * 2); } else { g.beginPath(); g.arc(x, y, tam / 2, 0, Math.PI * 2); g.fill(); }
      }
      g.restore();
      break;
    }
    case 'vidro': {
      luz(g, W * (0.25 + 0.08 * Math.sin(T * 0.7)), H * 0.3, 560, escuro ? tema.luz : '255,255,255', escuro ? 0.3 : 0.5);
      luz(g, W * (0.8 + 0.06 * Math.cos(T * 0.6)), H * 0.75, 600, escuro ? '232,177,58' : '0,0,0', escuro ? 0.25 : 0.08);
      g.save(); g.fillStyle = tema.vidro; g.strokeStyle = tema.borda; g.lineWidth = 2;
      retangulo(g, M - 40, prep.topo - 50, W - 2 * M + 80, prep.base - prep.topo + 100, 44); g.fill(); g.stroke(); g.restore();
      break;
    }
    case 'neon': {
      g.save(); g.strokeStyle = tema.destaque; g.lineWidth = 6; g.shadowColor = tema.destaque; g.shadowBlur = 40 * pulso;
      retangulo(g, 40, 40, W - 80, H - 80, 40); g.stroke();
      g.shadowBlur = 0; g.globalAlpha = 0.06; g.fillStyle = escuro ? '#fff' : '#000';
      for (let y = (T * 40) % 8; y < H; y += 8) g.fillRect(0, y, W, 2);
      g.restore();
      break;
    }
    case 'luz': {
      feixe(g, indice % 2 ? W * 0.12 : W * 0.86, H, tema.luz, parado ? 0.8 : 0.65 + 0.35 * Math.sin(T * 1.8));
      break;
    }
    default: break;
  }
  if (s.efeito === 'brilho' || s.efeito === 'luz' || s.efeito === 'pixel') {
    // bolhas de luz desfocadas e um brilho de lente
    g.save();
    for (let i = 0; i < 5; i++) { const x = r() * W, y = r() * H * 0.9, tam = 40 + r() * 90; luz(g, x + (parado ? 0 : Math.sin(T * 0.5 + i) * 14), y, tam, tema.luz, 0.12 + r() * 0.12); }
    flare(g, indice % 2 ? W * 0.82 : W * 0.16, H * (0.1 + r() * 0.12), 16 + r() * 10, tema.luz, parado ? 1 : 0.75 + 0.25 * Math.sin(T * 2.6));
    g.restore();
  }
  // grão de filme
  g.save();
  g.globalAlpha = escuro ? 0.07 : 0.05; g.globalCompositeOperation = 'overlay';
  const dx = parado ? 0 : Math.floor(T * 60) * 37 % 192;
  g.translate(dx, dx * 0.7); g.fillStyle = g.createPattern(texturaGrao(), 'repeat'); g.fillRect(-200, -200, W + 400, H + 400);
  g.restore();
}

// ---------- painel do carrossel: imagens e cursivas que atravessam as telas ----------
/** Onde fica cada imagem e cada cursiva, em coordenadas do painel inteiro (tela i começa em x = i × 1080). */
function montarPainel(arte, tipo, H, recursos) {
  const itens = [];
  const fluxo = tipo === 'carrossel' && arte.slides.length > 1;
  arte.slides.forEach((s, i) => {
    const img = recursos.imagem[i];
    if (img) {
      const lado = s.imagem_lado === 'atravessa' && !fluxo ? 'direita' : s.imagem_lado;
      const asp = img.width / img.height;
      let h = H * (lado === 'centro' ? 0.7 : lado === 'atravessa' ? 0.64 : 0.82);
      let w = h * asp;
      const maxW = lado === 'centro' ? W * 0.95 : W * 0.62;
      if (w > maxW) { w = maxW; h = w / asp; }
      if (lado === 'fundo') { h = H; w = Math.max(W, H * asp); }
      // nas laterais a imagem sai um pouco da tela (fica "cortada" pela borda, como nas artes de designer)
      const cx = lado === 'esquerda' ? W * 0.1 : lado === 'centro' ? W / 2 : lado === 'atravessa' ? W : lado === 'fundo' ? W / 2 : W * 0.9;
      const y = lado === 'fundo' ? 0 : lado === 'atravessa' ? H * 0.3 : lado === 'centro' ? H * (vertical(tipo) ? 0.12 : 0.03) : H - h + H * 0.03;
      itens.push({ tipo: 'imagem', tela: i, img, x: i * W + cx - w / 2, y, w, h, lado, cx: i * W + cx });
    }
    if (s.assinatura) {
      const capa = s.layout === 'capa';
      const tam = capa ? 230 : vertical(tipo) ? 380 : 340;
      // nas telas do meio a cursiva começa no meio e "vaza" para a próxima tela (no fim, fica dentro)
      const ultima = i === arte.slides.length - 1;
      const x = capa ? i * W + W / 2 : i * W + (fluxo && !ultima ? W * 0.42 : W * 0.12);
      const y = capa ? recursos.fimTitulo[i] - tam * 0.08 : H - (vertical(tipo) ? 200 : 110);
      const tituloEmDestaque = /^\s*\*[^\n]*\*\s*$/m.test(s.titulo || '');
      const cor = capa ? (tituloEmDestaque ? (s.tema === 'escuro' ? '#ffffff' : recursos.temas[i].texto) : recursos.temas[i].destaque) : (s.tema === 'escuro' ? '#ffffff' : recursos.temas[i].texto);
      itens.push({ tipo: 'cursiva', tela: i, texto: s.assinatura, x, y, tam, centro: capa, cor });
    }
  });
  return itens;
}
function desenharImagem(g, e, t, parado, prep) {
  const k = parado ? 1 : ease((t - 0.1) / 0.8);
  if (k <= 0) return;
  const zoom = parado ? 1 : 1.06 - 0.06 * ease(t / 3.2);
  const w = e.w * zoom, h = e.h * zoom, x = e.x - (w - e.w) / 2 + (parado ? 0 : (1 - k) * (e.lado === 'esquerda' ? -60 : 60)), y = e.y - (h - e.h) * 0.6;
  g.save();
  g.globalAlpha = k;
  if (e.lado === 'fundo') {
    g.drawImage(e.img, x, y, w, h);
    const sombra = g.createLinearGradient(0, 0, 0, prep.H);
    sombra.addColorStop(0, 'rgba(0,0,0,.35)'); sombra.addColorStop(0.55, 'rgba(0,0,0,.55)'); sombra.addColorStop(1, 'rgba(0,0,0,.9)');
    g.fillStyle = sombra; g.fillRect(x, 0, w, prep.H);
  } else {
    luz(g, e.cx, y + h * 0.45, Math.max(w, h) * 0.55, prep.tema.luz, prep.nomeTema === 'escuro' ? 0.28 : 0.35);
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 60; g.shadowOffsetY = 30;
    g.drawImage(e.img, x, y, w, h);
    g.shadowColor = 'transparent';
    // quadradinhos de pixel encostados na imagem
    pixelEscada(g, e.lado === 'esquerda' ? x + w * 0.7 : x + w * 0.05, y + h * 0.62, 34, 6, prep.tema.destaque, e.lado === 'esquerda' ? 1 : -1, e.tela + 5);
  }
  g.restore();
}
function desenharCursiva(g, e, t, parado) {
  const k = parado ? 1 : ease((t - 0.5) / 1.1);
  if (k <= 0) return;
  g.save();
  g.font = `${e.tam}px ${CURSIVA}`;
  g.textBaseline = 'alphabetic';
  const largura = g.measureText(e.texto).width;
  const x0 = e.centro ? e.x - largura / 2 : e.x;
  g.translate(x0, e.y); g.rotate(-0.1);
  if (!parado) { g.beginPath(); g.rect(-40, -e.tam * 1.2, (largura + 80) * k, e.tam * 2); g.clip(); } // a cursiva vai se escrevendo
  g.fillStyle = e.cor; g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 18;
  g.fillText(e.texto, 0, 0);
  g.restore();
}

// ---------- selo de perfil, bolinhas de página e logo ----------
function selo(g, prep, arte, x, y, alinhar = 'left') {
  const { img, tema } = prep;
  if (arte.logo === 'nenhum') return y;
  const r = 34;
  g.save();
  g.font = `700 28px ${CORPO}`;
  const nome = arte.perfil || 'RB Tech Celulares';
  const larg = 2 * r + 16 + Math.max(g.measureText(nome).width, arte.arroba ? (g.font = `500 25px ${CORPO}`, g.measureText(arte.arroba).width) : 0);
  const x0 = alinhar === 'center' ? x - larg / 2 : alinhar === 'right' ? x - larg : x;
  g.beginPath(); g.arc(x0 + r, y + r, r, 0, Math.PI * 2); g.fillStyle = '#000'; g.fill();
  g.save(); g.clip();
  if (img) { const s = r * 2.25; g.drawImage(img, x0 + r - s / 2, y + r - s / 2 - 2, s, s * img.height / img.width); }
  g.restore();
  g.strokeStyle = tema.destaque; g.lineWidth = 3; g.beginPath(); g.arc(x0 + r, y + r, r + 2, 0, Math.PI * 2); g.stroke();
  g.textBaseline = 'top'; g.textAlign = 'left';
  g.font = `700 28px ${CORPO}`; g.fillStyle = tema.texto; g.fillText(nome, x0 + 2 * r + 16, y + (arte.arroba ? 10 : 20));
  if (arte.arroba) { g.font = `500 25px ${CORPO}`; g.fillStyle = tema.sub; g.fillText(arte.arroba, x0 + 2 * r + 16, y + 42); }
  g.restore();
  return y + 2 * r;
}
function bolinhas(g, prep, total, x, y, alinhar = 'left') {
  if (total < 2) return;
  const i = prep.indice, itens = [i - 1, i, i + 1].filter(n => n >= 0 && n < total);
  const tam = n => (n === i ? 30 : 19);
  const larg = itens.reduce((s, n) => s + 2 * tam(n) + 12, -12);
  let cx = alinhar === 'center' ? x - larg / 2 : alinhar === 'right' ? x - larg : x;
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const n of itens) {
    const r = tam(n);
    g.beginPath(); g.arc(cx + r, y, r, 0, Math.PI * 2);
    g.fillStyle = n === i ? prep.tema.destaque : '#ffffff'; g.fill();
    g.font = `${n === i ? 800 : 600} ${n === i ? 34 : 22}px ${CORPO}`;
    g.fillStyle = n === i ? prep.tema.tintaDestaque : '#0b0b0b'; g.fillText(String(n + 1), cx + r, y + 2);
    cx += 2 * r + 12;
  }
  g.restore();
}
function linhaVertical(g, x, y1, y2, cor) {
  g.save(); g.strokeStyle = cor; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y1); g.lineTo(x, y2); g.stroke();
  g.fillStyle = cor; g.beginPath(); g.arc(x, y2, 6, 0, Math.PI * 2); g.fill(); g.restore();
}

// ---------- conteúdo (layouts) ----------
function conteudo(g, prep, arte) {
  const { s, tema, H, tipo } = prep;
  const cor = tema.texto, destaque = tema.destaque, sub = tema.sub;
  const brilho = prep.nomeTema === 'escuro' ? 'rgba(255,214,10,.55)' : null;
  const total = arte.slides.length, carrossel = tipo === 'carrossel';
  const v = vertical(tipo) ? 285 : 0; // stories e reels: tudo um pouco mais para baixo
  const lado = prep.ladoImagem || 'nenhum';
  // coluna de texto: do lado oposto ao da imagem
  const colunaEsq = lado !== 'esquerda';
  const comImagemLateral = lado === 'direita' || lado === 'esquerda' || lado === 'atravessa';
  const colW = comImagemLateral ? W * 0.6 : W - 2 * M;
  const colX = colunaEsq ? M : W - M - colW;
  const alinhar = comImagemLateral ? (colunaEsq ? 'left' : 'right') : 'center';
  const corpoTexto = (texto, y, largura = colW, x = colX, al = alinhar, alt = 360) => {
    if (!texto) return y;
    const fim = escrever(g, texto, { x: al === 'left' && comImagemLateral ? x + 26 : x, y, largura: largura - (comImagemLateral ? 26 : 0), altura: alt, tamanho: vertical(tipo) ? 44 : 40, minimo: 26, peso: 400, cor, forte: cor, destaque, alinhar: al, brilho });
    if (comImagemLateral) linhaVertical(g, al === 'right' ? x + largura + 14 : x, y + 4, fim + 6, cor);
    return fim;
  };
  switch (s.layout) {
    case 'capa': {
      selo(g, prep, arte, W / 2, 110 + v * 0.4, 'center');
      const altTit = H * 0.36;
      let y = H * (vertical(tipo) ? 0.5 : 0.53);
      if (s.chamada) y = blocoTitulo(g, s.chamada, { x: W * 0.18, y, largura: W * 0.64, alturaMax: 90, cor, destaque, alinhar: 'center', maximo: 92 }) + 8;
      y = blocoTitulo(g, s.titulo, { x: M - 10, y, largura: W - 2 * M + 20, alturaMax: altTit, cor, destaque, alinhar: 'center', brilho });
      prep.fimTitulo = y;
      if (s.texto) escrever(g, s.texto, { x: M, y: y + 40, largura: W - 2 * M, altura: 140, tamanho: 38, minimo: 24, peso: 400, cor: sub, forte: cor, destaque, alinhar: 'center' });
      break;
    }
    case 'fechamento': {
      const y0 = H * 0.27 + v;
      let y = blocoTitulo(g, s.titulo, { x: colX, y: y0, largura: colW, alturaMax: 300, cor, destaque, alinhar, brilho, maximo: 260 });
      y = selo(g, prep, arte, alinhar === 'right' ? colX + colW : colX, y + 30, alinhar === 'center' ? 'center' : alinhar);
      y = corpoTexto(s.texto, y + 36);
      if (s.destaque) {
        g.font = `800 40px ${CORPO}`;
        const bw = Math.min(g.measureText(s.destaque).width + 100, colW), bh = 100, bx = alinhar === 'right' ? colX + colW - bw : alinhar === 'center' ? (W - bw) / 2 : colX;
        g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 30; g.shadowOffsetY = 10; g.fillStyle = destaque; retangulo(g, bx, y + 44, bw, bh, 50); g.fill(); g.restore();
        g.fillStyle = tema.tintaDestaque; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.destaque, bx + bw / 2, y + 44 + bh / 2 + 2, bw - 40);
        prep.botao = { x: bx, y: y + 44, w: bw, h: bh };
        y += 44 + bh;
      }
      if (carrossel) bolinhas(g, prep, total, alinhar === 'right' ? colX + colW : colX, y + 90, alinhar === 'center' ? 'center' : alinhar);
      break;
    }
    case 'lista': {
      selo(g, prep, arte, M, 70, 'left');
      let y = blocoTitulo(g, s.titulo, { x: M, y: 200 + v, largura: W - 2 * M, alturaMax: 330, cor, destaque, brilho, maximo: 200 }) + 46;
      const itens = s.texto.split('\n').map(l => l.replace(/^\s*([-•]|\d+[.)])\s*/, '').trim()).filter(Boolean).slice(0, 6);
      const passo = Math.min(vertical(tipo) ? 210 : 150, (prep.base - y) / Math.max(1, itens.length));
      itens.forEach((item, k) => {
        const cy = y + k * passo;
        g.save(); g.shadowColor = 'rgba(255,214,10,.4)'; g.shadowBlur = 18;
        g.fillStyle = destaque; g.beginPath(); g.arc(M + 32, cy + 32, 32, 0, Math.PI * 2); g.fill(); g.restore();
        g.fillStyle = tema.tintaDestaque; g.font = `800 34px ${CORPO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(k + 1), M + 32, cy + 34);
        escrever(g, item, { x: M + 92, y: cy + 4, largura: W - 2 * M - 92, altura: passo - 14, tamanho: 40, minimo: 26, peso: 500, cor, forte: cor, destaque, entre: 1.2 });
      });
      if (carrossel) bolinhas(g, prep, total, M, H - 90, 'left');
      break;
    }
    case 'numero': {
      selo(g, prep, arte, W / 2, 70, 'center');
      let y = blocoTitulo(g, s.titulo, { x: M + 60, y: 230 + v, largura: W - 2 * M - 120, alturaMax: 200, cor, destaque, alinhar: 'center', maximo: 130 });
      g.save(); if (brilho) { g.shadowColor = brilho; g.shadowBlur = 60; }
      y = blocoTitulo(g, `*${s.destaque || ''}*`, { x: M, y: y + 30, largura: W - 2 * M, alturaMax: 420, cor, destaque, alinhar: 'center', maximo: 420 });
      g.restore();
      escrever(g, s.texto, { x: M + 40, y: y + 40, largura: W - 2 * M - 80, altura: prep.base - y, tamanho: 42, minimo: 26, peso: 400, cor: sub, forte: cor, destaque, alinhar: 'center', entre: 1.3 });
      if (carrossel) bolinhas(g, prep, total, W / 2, H - 90, 'center');
      break;
    }
    case 'comparativo': {
      selo(g, prep, arte, W / 2, 70, 'center');
      const y = blocoTitulo(g, s.titulo, { x: M, y: 200 + v, largura: W - 2 * M, alturaMax: 260, cor, destaque, alinhar: 'center', brilho, maximo: 170 }) + 50;
      const [a, b] = (s.destaque || 'Antes | Depois').split('|').map(x => x.trim());
      const col = (W - 2 * M - 30) / 2, alt = Math.min(prep.base - y, 760);
      const linhas = s.texto.split('\n').map(l => l.split('|').map(x => x.trim())).filter(l => l[0] || l[1]).slice(0, 6);
      [[a, 0], [b, 1]].forEach(([cab, k]) => {
        const x = M + k * (col + 30);
        g.save(); if (k) { g.shadowColor = 'rgba(255,214,10,.35)'; g.shadowBlur = 40; }
        g.fillStyle = k ? destaque : (prep.nomeTema === 'escuro' ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)');
        retangulo(g, x, y, col, alt, 28); g.fill(); g.restore();
        const tinta = k ? tema.tintaDestaque : cor;
        blocoTitulo(g, cab, { x: x + 30, y: y + 30, largura: col - 60, alturaMax: 70, cor: tinta, destaque: tinta, alinhar: 'center', maximo: 64 });
        const passo = (alt - 140) / Math.max(1, linhas.length);
        linhas.forEach((l, i) => escrever(g, (k ? '✓ ' : '✕ ') + (l[k] || ''), { x: x + 30, y: y + 130 + i * passo, largura: col - 60, altura: passo - 12, tamanho: 34, minimo: 22, peso: 600, cor: tinta }));
      });
      if (carrossel) bolinhas(g, prep, total, W / 2, H - 90, 'center');
      break;
    }
    case 'cta': {
      selo(g, prep, arte, W / 2, 70, 'center');
      let y = blocoTitulo(g, s.titulo, { x: M, y: H * 0.26 + v, largura: W - 2 * M, alturaMax: 420, cor, destaque, alinhar: 'center', brilho, maximo: 300 });
      y = escrever(g, s.texto, { x: M + 30, y: y + 40, largura: W - 2 * M - 60, altura: 220, tamanho: 42, minimo: 26, peso: 400, cor: sub, forte: cor, destaque, alinhar: 'center', entre: 1.3 });
      if (s.destaque) {
        g.font = `800 46px ${CORPO}`;
        const w = Math.min(g.measureText(s.destaque).width + 120, W - 2 * M), h = 116, x = (W - w) / 2, yb = Math.min(y + 60, prep.base - h);
        g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 30; g.shadowOffsetY = 10; g.fillStyle = destaque; retangulo(g, x, yb, w, h, 58); g.fill(); g.restore();
        g.fillStyle = tema.tintaDestaque; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.destaque, W / 2, yb + h / 2 + 2, w - 60);
        prep.botao = { x, y: yb, w, h };
      }
      if (carrossel) bolinhas(g, prep, total, W / 2, H - 90, 'center');
      break;
    }
    default: { // topico: título-bloco, texto com linha vertical, selo e bolinhas, imagem do outro lado
      const y0 = (comImagemLateral ? H * 0.2 : H * 0.24) + v;
      let y = y0;
      if (s.chamada) y = blocoTitulo(g, s.chamada, { x: colX, y, largura: colW * 0.7, alturaMax: 80, cor, destaque, alinhar, maximo: 80 }) + 10;
      y = blocoTitulo(g, s.titulo, { x: colX, y, largura: colW, alturaMax: H * 0.36, cor, destaque, alinhar, brilho });
      y = corpoTexto(s.texto, y + 34);
      y = selo(g, prep, arte, alinhar === 'right' ? colX + colW : alinhar === 'center' ? W / 2 : colX, y + 34, alinhar);
      if (carrossel) bolinhas(g, prep, total, alinhar === 'right' ? colX + colW : alinhar === 'center' ? W / 2 : colX, Math.max(y + 130, H * 0.8), alinhar);
    }
  }
}

// ---------- emojis: figurinhas grandes com sombra ----------
function emojis(g, prep, t) {
  const lista = [...new Intl.Segmenter('pt', { granularity: 'grapheme' }).segment(prep.s.emoji || '')].map(x => x.segment).filter(e => e.trim()).slice(0, 3);
  if (!lista.length) return;
  const parado = !Number.isFinite(t), H = prep.H;
  // os emojis ficam do lado da imagem (longe do texto); sem imagem, à direita
  const direita = prep.ladoImagem !== 'esquerda';
  const lugares = [[direita ? W - M - 70 : M + 70, H * 0.14, -10, 130], [direita ? M + 60 : W - M - 60, H * 0.88, 12, 110], [direita ? W - M - 50 : M + 50, H * 0.7, 8, 100]];
  lista.forEach((e, i) => {
    const [x, y, giro, tam] = lugares[i];
    const k = parado ? 1 : pop((t - 0.4 - i * 0.18) / 0.55);
    if (k <= 0) return;
    const bob = parado ? 0 : Math.sin(t * 2.4 + i) * 10;
    g.save(); g.translate(x, y + bob); g.rotate((giro + (parado ? 0 : Math.sin(t * 1.6 + i) * 4)) * Math.PI / 180); g.scale(k, k);
    g.font = `${tam}px ${EMOJI}, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 30; g.shadowOffsetY = 16;
    g.fillText(e, 0, 0);
    g.restore();
  });
}

// ---------- montagem ----------
const cacheArte = new WeakMap();
/** Carrega fontes, logo e imagens e monta o painel uma vez por arte. */
async function prepararArte(arte, tipo) {
  const chave = cacheArte.get(arte);
  if (chave?.tipo === tipo) return chave.pronto;
  const pronto = (async () => {
    const [, H] = tamanhoDa(tipo);
    await fontes();
    const logoImg = await carregarLogo();
    const imagem = await Promise.all(arte.slides.map(async s => {
      if (s.imagem_url) { const img = await carregarImagem(s.imagem_url); if (img) return s.imagem_cor === 'dourado' ? dourado(img) : img; }
      if (s.imagem) return iphone(); // pediu uma imagem, mas o gerador não está ligado: entra o iPhone 3D
      return null;
    }));
    const temas = arte.slides.map(s => TEMAS[s.tema] || TEMAS.escuro);
    // onde termina o título de cada capa (para a cursiva cruzar por cima)
    const medidor = document.createElement('canvas').getContext('2d');
    const fimTitulo = arte.slides.map(s => {
      if (s.layout !== 'capa') return 0;
      let y = H * (vertical(tipo) ? 0.5 : 0.53);
      if (s.chamada) y = blocoTitulo(medidor, s.chamada, { x: W * 0.18, y, largura: W * 0.64, alturaMax: 90, maximo: 92, medir: true }) + 8;
      return blocoTitulo(medidor, s.titulo, { x: M - 10, y, largura: W - 2 * M + 20, alturaMax: H * 0.36, medir: true });
    });
    const painel = montarPainel(arte, tipo, H, { imagem, temas, fimTitulo });
    const comoUrl = el => { try { const c = document.createElement('canvas'); c.width = el.width; c.height = el.height; c.getContext('2d').drawImage(el, 0, 0); return c.toDataURL(el instanceof HTMLImageElement && /\.jpe?g/i.test(el.src) ? 'image/jpeg' : 'image/png'); } catch { return ''; } };
    return { H, logoImg, imagem, painel, logoUrl: logoImg ? comoUrl(logoImg) : '', imagemUrl: imagem.map(el => (el ? comoUrl(el) : '')) };
  })();
  cacheArte.set(arte, { tipo, pronto });
  return pronto;
}
async function preparar(arte, tipo, indice) {
  const geral = await prepararArte(arte, tipo);
  const s = arte.slides[indice];
  const nomeTema = TEMAS[s.tema] ? s.tema : 'escuro';
  const H = geral.H;
  const prep = { H, s, tipo, indice, img: geral.logoImg, nomeTema, tema: TEMAS[nomeTema], geral, temImagem: !!geral.imagem[indice], topo: 290 + (H > 1400 ? 200 : 0), base: H - (H > 1400 ? 460 : 300) };
  // de que lado está a imagem nesta tela (a dela ou a que atravessa da vizinha): o texto vai para o outro lado
  prep.ladoImagem = prep.temImagem ? s.imagem_lado : null;
  if (!prep.ladoImagem) {
    const x0 = indice * W;
    const vizinha = geral.painel.find(e => e.tipo === 'imagem' && e.tela !== indice && e.x < x0 + W && e.x + e.w > x0);
    if (vizinha) prep.ladoImagem = vizinha.cx < x0 + W / 2 ? 'esquerda' : 'direita';
  }
  if (prep.ladoImagem === 'atravessa') prep.ladoImagem = 'direita';
  if (s.svg_tela) { prep.svgImg = await imagemDaTelaSvg(s.svg_tela, geral); if (prep.svgImg) return prep; } // tela do diretor de arte; se não abrir, usa o molde
  const camada = document.createElement('canvas');
  camada.width = W; camada.height = H;
  conteudo(camada.getContext('2d'), prep, arte);
  prep.camada = camada;
  return prep;
}
/** Desenha a tela no instante t (segundos desde que ela entrou; Infinity = imagem parada, já completa). */
function compor(g, prep, arte, tipo, t) {
  const parado = !Number.isFinite(t), H = prep.H, x0 = prep.indice * W;
  if (prep.svgImg) { // tela do diretor de arte: no vídeo, entra com um zoom lento
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const z = parado ? 1 : 1.05 - 0.05 * ease(t / 3);
    g.drawImage(prep.svgImg, (W - W * z) / 2, (H - H * z) / 2, W * z, H * z);
    return;
  }
  fundo(g, prep, t);
  const visiveis = prep.geral.painel.filter(e => {
    const largura = e.tipo === 'cursiva' ? e.tam * e.texto.length * 0.6 + 200 : e.w;
    const ini = e.tipo === 'cursiva' && e.centro ? e.x - largura / 2 : e.x;
    return ini < x0 + W && ini + largura > x0;
  });
  g.save(); g.translate(-x0, 0);
  // a imagem da própria tela anima; as que vêm de outra tela aparecem prontas (continuam a da vizinha)
  for (const e of visiveis) if (e.tipo === 'imagem') desenharImagem(g, e, e.tela === prep.indice ? t : Infinity, parado || e.tela !== prep.indice, prep);
  g.restore();
  if (parado) g.drawImage(prep.camada, 0, 0);
  else {
    const k = ease((t - 0.15) / 0.9);
    if (k > 0) {
      g.save(); g.globalAlpha = Math.min(1, k * 1.4);
      g.beginPath(); g.rect(0, 0, W, 120 + (H - 120) * k); g.clip();
      g.drawImage(prep.camada, 0, 70 * (1 - k));
      g.restore();
    }
    if (prep.botao && t > 1.2) {
      const b = prep.botao, p = (Math.sin((t - 1.2) * 4) + 1) / 2;
      g.save(); g.strokeStyle = prep.tema.destaque; g.lineWidth = 4; g.globalAlpha = 0.6 * (1 - p);
      retangulo(g, b.x - 16 * p, b.y - 16 * p, b.w + 32 * p, b.h + 32 * p, (b.h + 32 * p) / 2); g.stroke(); g.restore();
    }
  }
  g.save(); g.translate(-x0, 0);
  for (const e of visiveis) if (e.tipo === 'cursiva') desenharCursiva(g, e, e.tela === prep.indice ? t : Infinity, parado || e.tela !== prep.indice);
  g.restore();
  emojis(g, prep, t);
  // a logo vai no selo de perfil de cada tela (arte.logo = 'nenhum' esconde o selo)
  if (prep.s.rodape) {
    g.save(); g.font = `600 28px ${CORPO}`; g.fillStyle = prep.tema.sub; g.textBaseline = 'bottom'; g.textAlign = 'center';
    g.fillText(prep.s.rodape, W / 2, H - 40, W - 2 * M); g.restore();
  }
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
    lista.push(await new Promise(r => c.toBlob(r, 'image/jpeg', 0.93)));
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
    lista.push(m.toDataURL('image/jpeg', 0.82));
  }
  return lista;
}

// ---------- movimento (stories e reels animados) ----------
export const duracaoDaTela = (arte, tipo) => (tipo === 'stories' ? Math.max(5, Math.min(7, 15 / arte.slides.length)) : 3.4);
export const duracaoTotal = (arte, tipo) => duracaoDaTela(arte, tipo) * arte.slides.length;
const TRANSICAO = 0.45;
function quadroDoVideo(g, preps, arte, tipo, tempo) {
  const dur = duracaoDaTela(arte, tipo), n = preps.length;
  const i = Math.min(n - 1, Math.floor(tempo / dur)), local = tempo - i * dur;
  if (i > 0 && local < TRANSICAO) {
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
  const passo = () => { if (parar) return; quadroDoVideo(g, preps, arte, tipo, ((performance.now() - inicio) / 1000) % total); requestAnimationFrame(passo); };
  requestAnimationFrame(passo);
  return () => { parar = true; };
}
export function formatoDeVideo() {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || null;
}
/** Grava a animação em MP4 (tempo real: um reels de 7 telas leva uns 24 s). Não troque de aba enquanto grava. */
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
  const total = duracaoTotal(arte, tipo) + 0.6;
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
