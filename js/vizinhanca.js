// Peças usadas pelo mundo aberto (js/mundo.js): céu, ruas, casas, árvores e palmeiras. Dados: © OpenStreetMap, Microsoft Building Footprints, SRTM.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const COR = { asfalto: 0x34313b, terra: 0xb38a5e, rio: 0x2fb8c4, faixa: 0xffd60a, lote: 0x8e8790, vagas: 0x6f6f6b };

/** Céu de fim de tarde em cidade tropical: índigo no alto, roxo, rosa e laranja no horizonte; neblina quente. */
export function ceu(cena) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  // o chão cobre a metade de baixo da tela: o rosa e o laranja ficam na parte de cima, que aparece
  grad.addColorStop(0, '#3b2a7e'); grad.addColorStop(0.18, '#8a3a92'); grad.addColorStop(0.34, '#e2508a');
  grad.addColorStop(0.48, '#ff7a5c'); grad.addColorStop(0.62, '#ffab6e'); grad.addColorStop(0.8, '#ffd49a'); grad.addColorStop(1, '#ffe8bd');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cena.background = t;
  cena.fog = new THREE.Fog(0xf39a86, 380, 2600);
  // o sol baixo no horizonte (oeste), com halo
  const brilho = (tam, cores) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const gg = cv.getContext('2d'), r = gg.createRadialGradient(128, 128, 0, 128, 128, 128);
    cores.forEach(([k, cor]) => r.addColorStop(k, cor));
    gg.fillStyle = r; gg.fillRect(0, 0, 256, 256);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
    s.scale.set(tam, tam, 1);
    s.position.set(-2300, 150, 800);
    s.renderOrder = -1;
    cena.add(s);
    return s;
  };
  brilho(2600, [[0, 'rgba(255,170,110,.55)'], [0.4, 'rgba(255,100,120,.18)'], [1, 'rgba(255,90,120,0)']]);
  const sol = brilho(520, [[0, 'rgba(255,250,225,1)'], [0.45, 'rgba(255,215,140,1)'], [0.62, 'rgba(255,150,90,.6)'], [1, 'rgba(255,120,80,0)']]);
  sol.material.color.setScalar(2.2); // passa do branco: o brilho (bloom) acende o sol
}

/** Palmeira em blocos (tronco curvo, folhas caídas e cocos), numa geometria só para instanciar. */
export function geometriaPalmeira() {
  const partes = [], cor = (geo, hex) => {
    const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
  };
  let x = 0, y = 0;
  for (let k = 0; k < 8; k++) {
    const s = 0.62 - k * 0.04, geo = new THREE.BoxGeometry(s, 1.25, s);
    geo.rotateZ(-0.05 - k * 0.025);
    geo.translate(x, y + 0.62, 0);
    partes.push(cor(geo, k % 2 ? 0x8a6a4a : 0x7a5b3d));
    x += 0.06 + k * 0.035; y += 1.2;
  }
  for (let k = 0; k < 9; k++) {
    const geo = new THREE.BoxGeometry(0.5, 0.08, 3.6);
    geo.translate(0, 0, 1.8);
    geo.rotateX(0.35 + (k % 3) * 0.18);
    geo.rotateY((k / 9) * Math.PI * 2);
    geo.translate(x, y + 0.1, 0);
    partes.push(cor(geo, [0x3f9a3c, 0x4fb348, 0x2f7f35][k % 3]));
  }
  for (let k = 0; k < 3; k++) {
    const geo = new THREE.BoxGeometry(0.34, 0.34, 0.34);
    geo.translate(x + Math.cos(k * 2.1) * 0.35, y - 0.25, Math.sin(k * 2.1) * 0.35);
    partes.push(cor(geo, 0x6b4a22));
  }
  return mergeGeometries(partes);
}
export const PASTEL = [0xffc4d6, 0xa8e6cf, 0xffd3a5, 0xd7c4f2, 0xfff1c9, 0x9fe3ec, 0xffffff];

/** Faixas (ruas e rios) seguindo o terreno: uma malha só por tipo. */
export function fitas(lista, cor) {
  const pos = [], idx = [];
  for (const { l, p } of lista) {
    const n = p.length / 3;
    if (n < 2) continue;
    const base = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let dx = p[b * 3] - p[a * 3], dz = p[b * 3 + 2] - p[a * 3 + 2];
      const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
      const ox = -dz * l / 2, oz = dx * l / 2;
      pos.push(p[i * 3] + ox, p[i * 3 + 1], p[i * 3 + 2] + oz, p[i * 3] - ox, p[i * 3 + 1], p[i * 3 + 2] - oz);
      if (i < n - 1) { const k = base + i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3)); // virada para cima
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: cor, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  m.receiveShadow = true;
  return m;
}

/** Faixa amarela tracejada no meio da SC-281. */
export function faixaCentral(vias) {
  const marcas = [];
  for (const v of vias) {
    if (!v.faixa) continue;
    const p = v.p, n = p.length / 3;
    for (let i = 0; i < n - 1; i += 1) {
      const x1 = p[i * 3], z1 = p[i * 3 + 2], x2 = p[i * 3 + 3], z2 = p[i * 3 + 5];
      marcas.push([(x1 + x2) / 2, (p[i * 3 + 1] + p[i * 3 + 4]) / 2 + 0.03, (z1 + z2) / 2, Math.atan2(-(z2 - z1), x2 - x1)]);
    }
  }
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.04, 0.16), new THREE.MeshLambertMaterial({ color: COR.faixa }), marcas.length);
  const o = new THREE.Object3D();
  marcas.forEach(([x, y, z, a], i) => { o.position.set(x, y, z); o.rotation.set(0, a, 0); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); });
  return mesh;
}

/** Casas: paredes, telhado de 4 águas (cerâmica ou fibrocimento) e galpões com telhado plano de metal. */
export function casas(lista) {
  const grupo = new THREE.Group();
  const cubo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const piramide = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);
  const paredes = new THREE.InstancedMesh(cubo, new THREE.MeshLambertMaterial({ color: 0xffffff }), lista.length);
  const pontudos = lista.filter(c => c[9] !== 2), planos = lista.filter(c => c[9] === 2);
  const telhados = new THREE.InstancedMesh(piramide, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), pontudos.length);
  const lajes = new THREE.InstancedMesh(cubo, new THREE.MeshLambertMaterial({ color: 0xffffff }), planos.length);
  const o = new THREE.Object3D(), c = new THREE.Color();
  let it = 0, il = 0;
  lista.forEach(([x, z, ang, w, d, h, base, parede, telhado, tipo], i) => {
    const alto = h + 0.4; // um pouco enterrada, para não flutuar no morro
    o.position.set(x, base - 0.4, z); o.rotation.set(0, ang, 0); o.scale.set(w, alto, d); o.updateMatrix();
    // fachadas em tons pastel (rosa, menta, pêssego, lavanda), como numa cidade de praia
    paredes.setMatrixAt(i, o.matrix); paredes.setColorAt(i, c.set('#' + parede).lerp(new THREE.Color(PASTEL[(Math.abs(Math.round(x * 3 + z * 7))) % PASTEL.length]), 0.6));
    if (tipo === 2) {
      o.position.set(x, base + h, z); o.scale.set(w + 0.4, 0.35, d + 0.4); o.updateMatrix();
      lajes.setMatrixAt(il, o.matrix); lajes.setColorAt(il++, c.set('#' + telhado));
    } else {
      const altTelhado = Math.min(2.4, 0.9 + Math.min(w, d) * 0.12);
      o.position.set(x, base + h, z); o.scale.set(w + 0.7, altTelhado, d + 0.7); o.updateMatrix(); // beiral
      telhados.setMatrixAt(it, o.matrix); telhados.setColorAt(it++, c.set('#' + telhado));
    }
  });
  for (const m of [paredes, telhados, lajes]) { m.castShadow = true; m.receiveShadow = true; grupo.add(m); }
  return grupo;
}

/** Árvores da mata e dos morros (tronco e copa em blocos, verdes variados). */
export function arvores(lista) {
  const n = lista.length / 4;
  const tronco = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 1, 0.7).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0x5b3f26 }), n);
  const copa = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
  const o = new THREE.Object3D(), c = new THREE.Color();
  const verdes = [0x3e7a32, 0x2f6a2a, 0x4b8a3a, 0x356f2c, 0x5a9440];
  for (let i = 0; i < n; i++) {
    const x = lista[i * 4], y = lista[i * 4 + 1], z = lista[i * 4 + 2], s = lista[i * 4 + 3];
    o.rotation.set(0, (x * 13 + z * 7) % 6.28, 0);
    o.position.set(x, y - 0.3, z); o.scale.set(1, s * 0.45, 1); o.updateMatrix(); tronco.setMatrixAt(i, o.matrix);
    o.position.set(x, y + s * 0.38, z); o.scale.set(s, s * 0.8, s); o.updateMatrix(); copa.setMatrixAt(i, o.matrix);
    copa.setColorAt(i, c.set(verdes[(Math.abs(Math.round(x * 3 + z)) % verdes.length)]));
  }
  copa.castShadow = true;
  const g = new THREE.Group();
  g.add(tronco, copa);
  return g;
}
