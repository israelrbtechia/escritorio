// O bairro real em volta da loja (Colônia Santana, São José/SC): terreno com os morros, a SC-281 e as ruas,
// rios, 670 casas nos lugares reais e a mata. Tudo em blocos, no estilo do prédio. 1 unidade = 1 metro.
// Dados em js/vizinhanca-dados.js (gerado por scripts/gerar-vizinhanca.py): © OpenStreetMap, Microsoft Building Footprints, SRTM.
import * as THREE from 'three';

const COR = { asfalto: 0x3b3e43, terra: 0xa3825a, rio: 0x4a8cc0, faixa: 0xffd60a, lote: 0x8d8d88, vagas: 0x6f6f6b };

/** Céu de dia: degradê no fundo e neblina na mesma cor do horizonte (os morros somem ao longe). */
function ceu(cena) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#5f9fd6'); grad.addColorStop(0.55, '#a9cfe8'); grad.addColorStop(1, '#dce9ee');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cena.background = t;
  cena.fog = new THREE.Fog(0xd3e4ec, 420, 2700);
}

function terreno(v) {
  const n = v.n, pos = new Float32Array(v.p);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const idx = [];
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  geo.setIndex(idx);
  geo.computeVertexNormals();
  if (geo.attributes.normal.array[1] < 0) { geo.setIndex(idx.map((_, k) => idx[k - (k % 3) + [0, 2, 1][k % 3]])); geo.computeVertexNormals(); }
  // cor pela altura: pasto no vale, mato mais escuro nos morros
  const cores = new Float32Array(pos.length), c = new THREE.Color();
  for (let k = 0; k < pos.length; k += 3) {
    const h = pos[k + 1];
    c.set(h < 4 ? 0x86b45e : h < 25 ? 0x6ea150 : h < 80 ? 0x4f8a3f : 0x3f7536);
    cores[k] = c.r; cores[k + 1] = c.g; cores[k + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  m.receiveShadow = true;
  return m;
}

/** Faixas (ruas e rios) seguindo o terreno: uma malha só por tipo. */
function fitas(lista, cor) {
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
function faixaCentral(vias) {
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
function casas(lista) {
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
    paredes.setMatrixAt(i, o.matrix); paredes.setColorAt(i, c.set('#' + parede));
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
function arvores(lista) {
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

/** Monta o bairro em volta do prédio. Devolve o grupo (ou null se não deu para carregar os dados). */
export async function montarVizinhanca(cena) {
  let v;
  try { ({ VIZINHANCA: v } = await import('./vizinhanca-dados.js')); } catch (e) { console.warn('bairro real não carregou:', e); return null; }
  ceu(cena);
  const g = new THREE.Group();
  g.name = 'vizinhanca';
  g.add(terreno(v.terreno));
  g.add(fitas(v.vias.filter(x => !x.t), COR.asfalto));
  g.add(fitas(v.vias.filter(x => x.t), COR.terra));
  g.add(fitas(v.rios, COR.rio));
  g.add(faixaCentral(v.vias));
  g.add(casas(v.casas));
  g.add(arvores(v.arvores));
  // pátio da loja (estacionamento na frente e nos lados)
  const lote = new THREE.Mesh(new THREE.BoxGeometry(40, 0.2, 26), new THREE.MeshLambertMaterial({ color: COR.lote }));
  lote.position.set(0, -0.62, -0.5); lote.receiveShadow = true;
  g.add(lote);
  cena.add(g);
  return { grupo: g, fonte: v.fonte, loja: v.loja };
}
