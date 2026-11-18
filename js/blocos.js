// Peças de montar compartilhadas pelos andares: blocos, placas de texto e móveis.
import * as THREE from 'three';

export const AMARELO = 0xffd60a;
export const PRETO = 0x0f0f0f;
export const PI = Math.PI;
export const FONTE = '"Poppins", system-ui, sans-serif';

const cacheMat = new Map();
export function mat(cor, extra) {
  const k = cor + (extra ? JSON.stringify(extra) : '');
  if (!cacheMat.has(k)) cacheMat.set(k, new THREE.MeshLambertMaterial({ color: cor, ...extra }));
  return cacheMat.get(k);
}
const cacheGeo = new Map();
export function geo(w, h, d) {
  const k = `${w}|${h}|${d}`;
  if (!cacheGeo.has(k)) cacheGeo.set(k, new THREE.BoxGeometry(w, h, d));
  return cacheGeo.get(k);
}
export function caixa(w, h, d, cor, x = 0, y = 0, z = 0, pai = null, extra = null) {
  const m = new THREE.Mesh(geo(w, h, d), typeof cor === 'object' ? cor : mat(cor, extra));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (pai) pai.add(m);
  return m;
}
export function grupo(x = 0, y = 0, z = 0, pai = null) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (pai) pai.add(g);
  return g;
}
export function telaCanvas(w, h, pixel = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (pixel) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; } else t.anisotropy = 4;
  return { c, ctx: c.getContext('2d'), t };
}
export function placa(w, h, textura, x, y, z, rotY = 0, pai) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textura, toneMapped: false }));
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  pai.add(m);
  return m;
}
export function aleatorio(semente) {
  let s = semente;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
export const suave = (a, b, k) => a + (b - a) * k;
export function anguloAlvo(atual, alvo, k) {
  let d = alvo - atual;
  while (d > PI) d -= 2 * PI;
  while (d < -PI) d += 2 * PI;
  return atual + d * k;
}
export const sortear = lista => lista[Math.floor(Math.random() * lista.length)];

/** Placa de texto (letreiro). Redesenha quando as fontes chegam. */
export function letreiro({ w = 1024, h = 128, fundo = '#0f0f0f', titulo, cor = '#ffd60a', sub = '', corSub = '#f4f4f4', tamanho = 70 }) {
  const tela = telaCanvas(w, h);
  const desenhar = () => {
    const g = tela.ctx;
    g.fillStyle = fundo; g.fillRect(0, 0, w, h);
    g.textBaseline = 'middle';
    g.fillStyle = cor; g.font = `800 ${tamanho}px ${FONTE}`;
    const largura = g.measureText(titulo).width;
    const x = sub ? 40 : (w - largura) / 2;
    g.fillText(titulo, x, h / 2 + 2);
    if (sub) {
      g.fillStyle = corSub; g.font = `600 ${Math.round(tamanho * 0.42)}px ${FONTE}`;
      g.fillText(sub, x + largura + 30, h / 2 + 4);
    }
    tela.t.needsUpdate = true;
  };
  desenhar();
  document.fonts?.ready.then(desenhar);
  return tela;
}

// ---------- móveis ----------
export function mesa(m, x, z, w, d, corTampo, corPe) {
  caixa(w, 0.08, d, corTampo, x, 0.8, z, m);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    caixa(0.08, 0.78, 0.08, corPe, x + sx * (w / 2 - 0.1), 0.39, z + sz * (d / 2 - 0.1), m);
  }
}
export function cadeira(m, x, z, rot, chefe = false) {
  const g = grupo(x, 0, z, m);
  g.rotation.y = rot;
  const cor = chefe ? 0x111111 : 0x2a2a2a;
  caixa(0.62, 0.1, 0.6, cor, 0, 0.48, 0, g);
  caixa(0.62, chefe ? 0.95 : 0.7, 0.09, cor, 0, chefe ? 1.0 : 0.88, -0.32, g);
  caixa(0.07, 0.4, 0.07, 0x555555, 0, 0.25, 0, g);
  caixa(0.55, 0.05, 0.08, 0x555555, 0, 0.04, 0, g);
  caixa(0.08, 0.05, 0.55, 0x555555, 0, 0.04, 0, g);
  return g;
}
export function caneca(m, x, z, y = 0.84) {
  caixa(0.12, 0.14, 0.12, 0xffffff, x, y + 0.07, z, m);
  caixa(0.1, 0.02, 0.1, 0x5a3a20, x, y + 0.14, z, m);
}
export function planta(m, x, z, s) {
  caixa(0.5 * s, 0.5 * s, 0.5 * s, 0x2b2b2b, x, 0.25 * s, z, m);
  const verdes = [0x3f8f3a, 0x4fa64a, 0x2f7a2c];
  const rnd = aleatorio(Math.floor(Math.abs(x * 100 + z * 7)) + 99);
  for (let i = 0; i < 6; i++) {
    const k = 0.25 + rnd() * 0.25;
    caixa(k * s, k * s, k * s, verdes[i % 3], x + (rnd() - 0.5) * 0.45 * s, (0.6 + rnd() * 0.7) * s, z + (rnd() - 0.5) * 0.45 * s, m);
  }
}
export function monitor(m, x, z, rot, cor = 0x111111) {
  const g = grupo(x, 0.84, z, m);
  g.rotation.y = rot;
  caixa(0.08, 0.3, 0.08, 0x333333, 0, 0.15, -0.02, g);
  caixa(0.36, 0.03, 0.22, 0x333333, 0, 0.015, -0.02, g);
  caixa(1.0, 0.62, 0.05, cor, 0, 0.6, 0, g);
  const tela = telaCanvas(256, 160);
  placa(0.94, 0.56, tela.t, 0, 0.6, 0.027, 0, g);
  return tela;
}
export function monitorEnfeite(m, x, z, rot, desenho = 'grafico') {
  const g = grupo(x, 0.84, z, m);
  g.rotation.y = rot;
  caixa(0.06, 0.3, 0.06, 0x333333, 0, 0.15, 0, g);
  caixa(0.8, 0.5, 0.05, 0x111111, 0, 0.52, 0, g);
  const tela = telaCanvas(128, 80);
  const c = tela.ctx;
  c.fillStyle = '#0e1622'; c.fillRect(0, 0, 128, 80);
  if (desenho === 'codigo') {
    const cores = ['#ffd60a', '#7fc4ff', '#2fd17a', '#c792ea', '#e0e0e0'];
    for (let i = 0; i < 9; i++) { c.fillStyle = cores[i % 5]; c.fillRect(8 + (i % 3) * 8, 8 + i * 7, 30 + ((i * 37) % 70), 4); }
  } else {
    c.strokeStyle = '#ffd60a'; c.lineWidth = 3; c.beginPath();
    [70, 62, 66, 50, 44, 38, 30, 22].forEach((y, i) => (i ? c.lineTo(8 + i * 16, y) : c.moveTo(8, y)));
    c.stroke();
    c.fillStyle = '#2fd17a';
    for (let i = 0; i < 6; i++) c.fillRect(10 + i * 19, 74 - (i + 2) * 5, 10, (i + 2) * 5);
  }
  tela.t.needsUpdate = true;
  placa(0.75, 0.45, tela.t, 0, 0.52, 0.027, 0, g);
}
export function camaCachorro(m, x, z, s, cor, almofada) {
  caixa(1.2 * s, 0.12, 0.95 * s, cor, x, 0.06, z, m);
  caixa(1.0 * s, 0.06, 0.75 * s, almofada, x, 0.14, z, m);
  caixa(1.2 * s, 0.24, 0.12, cor, x, 0.18, z - 0.42 * s, m);
  caixa(0.12, 0.24, 0.95 * s, cor, x - 0.54 * s, 0.18, z, m);
  caixa(0.12, 0.24, 0.95 * s, cor, x + 0.54 * s, 0.18, z, m);
}
/** Piso de tábuas (textura repetida). */
export function texturaPiso(tons, linha = 'rgba(70,40,20,.35)', semente = 3) {
  const piso = telaCanvas(512, 512);
  const g = piso.ctx;
  const rnd = aleatorio(semente);
  for (let y = 0; y < 512; y += 32) {
    let x = -Math.floor(rnd() * 120);
    while (x < 512) {
      const w = 120 + Math.floor(rnd() * 140);
      g.fillStyle = tons[Math.floor(rnd() * tons.length)];
      g.fillRect(x, y, w, 32);
      g.fillStyle = linha; g.fillRect(x, y, 2, 32);
      x += w;
    }
    g.fillStyle = linha; g.fillRect(0, y, 512, 2);
  }
  piso.t.wrapS = piso.t.wrapT = THREE.RepeatWrapping;
  piso.t.repeat.set(4, 2.7);
  return piso.t;
}
export function piso(m, textura, w = 24, d = 16) {
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: textura }));
  chao.rotation.x = -PI / 2;
  chao.position.y = 0.001;
  chao.receiveShadow = true;
  m.add(chao);
  return chao;
}
