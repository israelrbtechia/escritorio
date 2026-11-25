// Mundo aberto: São José (SC) inteira em volta da loja, em quadrados de 500 m carregados conforme você se move.
// Dados em mundo/ (gerados por scripts/gerar-mundo.py): relevo SRTM, ruas, rios, mar e mata do OpenStreetMap e casas
// do Microsoft Building Footprints. © OpenStreetMap contributors (ODbL) · Microsoft (ODbL) · SRTM.
import * as THREE from 'three';
import { ceu, fitas, faixaCentral, casas as montarCasas, arvores as montarArvores, geometriaPalmeira, COR } from './vizinhanca.js';

const BASE = new URL('../mundo/', import.meta.url);

export async function montarMundo(cena, { celular = false } = {}) {
  let ind;
  try {
    const r = await fetch(new URL('indice.json', BASE));
    if (!r.ok) return null;
    ind = await r.json();
  } catch (e) { console.warn('mundo não carregou:', e); return null; }
  const ceuCtl = ceu(cena);
  cena.fog.near = celular ? 260 : 340; cena.fog.far = celular ? 950 : 1350; // a neblina esconde a borda do que está carregado

  // ---------- coordenadas: cena (x, z) ↔ longitude/latitude, e a altura do relevo ----------
  const c = ind.conversao, rel = ind.relevo;
  const paraCena = (lon, lat) => {
    const x = (lon - c.lon0) * c.kx, z = -(lat - c.lat0) * c.ky;
    return [x * c.cphi + z * c.sphi, -x * c.sphi + z * c.cphi + c.zRua];
  };
  const paraGrade = (x, z) => {
    const zz = z - c.zRua;
    const ex = x * c.cphi - zz * c.sphi, ez = x * c.sphi + zz * c.cphi;
    return [((c.lon0 + ex / c.kx) - rel.oeste) / rel.dlon, ((c.lat0 - ez / c.ky) - rel.sul) / rel.dlat];
  };
  const Y = rel.y, NX = rel.nx, NY = rel.ny;
  /** Altura do chão no ponto (exatamente a mesma da malha do relevo). */
  function altura(x, z) {
    let [gi, gj] = paraGrade(x, z);
    gi = Math.min(Math.max(gi, 0), NX - 1.0001); gj = Math.min(Math.max(gj, 0), NY - 1.0001);
    const i = Math.floor(gi), j = Math.floor(gj), u = gi - i, v = gj - j;
    const a = Y[j * NX + i], b = Y[j * NX + i + 1], cc = Y[(j + 1) * NX + i], d = Y[(j + 1) * NX + i + 1];
    return u + v <= 1 ? a + (b - a) * u + (cc - a) * v : d + (cc - d) * (1 - u) + (b - d) * (1 - v);
  }

  const grupo = new THREE.Group();
  grupo.name = 'mundo';
  cena.add(grupo);

  // ---------- relevo inteiro (uma malha só) e o mar ----------
  const pos = new Float32Array(NX * NY * 3), cores = new Float32Array(NX * NY * 3), cor = new THREE.Color();
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i, [x, z] = paraCena(rel.oeste + i * rel.dlon, rel.sul + j * rel.dlat), y = Y[k];
    pos[k * 3] = x; pos[k * 3 + 1] = y - 0.05; pos[k * 3 + 2] = z;
    const h = y - ind.chao;
    cor.set(y < ind.mar + 0.6 ? 0xd9c38f : h < 4 ? 0x9cb45a : h < 25 ? 0x7f9f4c : h < 80 ? 0x5e8a42 : 0x4b743a);
    cores[k * 3] = cor.r; cores[k * 3 + 1] = cor.g; cores[k * 3 + 2] = cor.b;
  }
  const idx = [];
  for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const a = j * NX + i, b = a + 1, cc = a + NX, d = cc + 1;
    idx.push(a, cc, b, b, cc, d);
  }
  const geoT = new THREE.BufferGeometry();
  geoT.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geoT.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  geoT.setIndex(idx);
  geoT.computeVertexNormals();
  if (geoT.attributes.normal.array[1] < 0) { geoT.setIndex(idx.map((_, k) => idx[k - (k % 3) + [0, 2, 1][k % 3]])); geoT.computeVertexNormals(); }
  const terreno = new THREE.Mesh(geoT, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  terreno.receiveShadow = true;
  grupo.add(terreno);
  const mar = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x1f8fb0 }));
  mar.position.y = ind.mar;
  grupo.add(mar);

  // pátio da loja (estacionamento na frente e nos lados)
  const lote = new THREE.Mesh(new THREE.BoxGeometry(40, 0.2, 26), new THREE.MeshLambertMaterial({ color: COR.lote }));
  lote.position.set(0, -0.62, -0.5); lote.receiveShadow = true;
  grupo.add(lote);

  // ---------- SC-281 inteira (trânsito) e palmeiras na beira dela, perto da loja ----------
  const sc = [];
  for (let i = 0; i < ind.sc281.length; i += 2) { const x = ind.sc281[i], z = ind.sc281[i + 1]; sc.push(x, altura(x, z) + 0.07, z); }
  const sc281 = sc.length ? [{ l: 11, t: 0, faixa: 1, p: sc }] : [];
  {
    const lugares = [];
    let andado = 0;
    for (let i = 3; i < sc.length; i += 3) {
      const dx = sc[i] - sc[i - 3], dz = sc[i + 2] - sc[i - 1], l = Math.hypot(dx, dz) || 1;
      andado += l;
      if (andado < 26) continue;
      andado = 0;
      if (Math.hypot(sc[i], sc[i + 2]) > 1600) continue;
      for (const lado of [-1, 1]) {
        const x = sc[i] - (dz / l) * 9.5 * lado, z = sc[i + 2] + (dx / l) * 9.5 * lado;
        if (!(Math.abs(x) < 24 && z > -16 && z < 24)) lugares.push([x, altura(x, z) - 0.4, z]);
      }
    }
    for (const [x, z] of [[-19.5, -11], [-19.5, -2], [-19.5, 7], [19.5, -11], [19.5, -2], [19.5, 7], [-9, -13], [9, -13]]) lugares.push([x, -0.55, z]);
    const palm = new THREE.InstancedMesh(geometriaPalmeira(), new THREE.MeshLambertMaterial({ vertexColors: true }), lugares.length);
    const o = new THREE.Object3D();
    lugares.forEach(([x, y, z], i) => {
      const s = 0.85 + ((Math.abs(Math.round(x * 7 + z * 3)) % 40) / 100);
      o.position.set(x, y, z); o.rotation.set(0, (x * 13.7 + z * 5.3) % (Math.PI * 2), 0); o.scale.set(s, s, s); o.updateMatrix();
      palm.setMatrixAt(i, o.matrix);
    });
    palm.castShadow = true;
    grupo.add(palm);
  }

  // ---------- postes (em cada quadrado) e materiais que o ciclo do dia acende ----------
  const MAT_POSTE = new THREE.MeshLambertMaterial({ color: 0x3a3a40 });
  const MAT_LAMPADA = new THREE.MeshBasicMaterial({ color: 0x8a8070 });
  const GEO_POSTE = new THREE.BoxGeometry(0.18, 7, 0.18).translate(0, 3.5, 0);
  const GEO_BRACO = new THREE.BoxGeometry(0.12, 0.12, 1.6).translate(0, 6.9, 0.75);
  const GEO_LAMPADA = new THREE.BoxGeometry(0.5, 0.16, 0.7).translate(0, 6.8, 1.45);
  function postes(vias) {
    const lugares = [];
    for (const v of vias) {
      if (v.t || v.l < 5.5) continue;
      const passo = v.faixa ? 34 : 46;
      let andado = passo / 2, lado = 1;
      for (let i = 3; i < v.p.length; i += 3) {
        const dx = v.p[i] - v.p[i - 3], dz = v.p[i + 2] - v.p[i - 1], l = Math.hypot(dx, dz) || 1;
        andado += l;
        if (andado < passo) continue;
        andado = 0;
        const off = v.l / 2 + 1.1, x = v.p[i] - (dz / l) * off * lado, z = v.p[i + 2] + (dx / l) * off * lado;
        if (Math.abs(x) < 24 && z > -16 && z < 24) continue; // pátio da loja
        lugares.push([x, altura(x, z), z, Math.atan2(dx * lado, dz * lado) + Math.PI / 2 * lado]);
        if (!v.faixa) lado = -lado;
      }
    }
    if (!lugares.length) return null;
    const g = new THREE.Group(), o = new THREE.Object3D();
    const pos = new THREE.InstancedMesh(GEO_POSTE, MAT_POSTE, lugares.length), bra = new THREE.InstancedMesh(GEO_BRACO, MAT_POSTE, lugares.length), lam = new THREE.InstancedMesh(GEO_LAMPADA, MAT_LAMPADA, lugares.length);
    lugares.forEach(([x, y, z, a], i) => {
      o.position.set(x, y, z); o.rotation.set(0, a, 0); o.updateMatrix();
      pos.setMatrixAt(i, o.matrix); bra.setMatrixAt(i, o.matrix); lam.setMatrixAt(i, o.matrix);
    });
    g.add(pos, bra, lam);
    g.userData.compartilhado = true; // materiais e geometrias ficam (são de todos os quadrados)
    return g;
  }

  // ---------- outdoors da RB Tech na SC-281 e ponto de ônibus perto da loja ----------
  const outdoors = [];
  {
    const tela = document.createElement('canvas'); tela.width = 1024; tela.height = 384;
    const gg = tela.getContext('2d');
    gg.fillStyle = '#0b0b0b'; gg.fillRect(0, 0, 1024, 384);
    const grad = gg.createLinearGradient(0, 0, 1024, 0); grad.addColorStop(0, 'rgba(255,214,10,.25)'); grad.addColorStop(1, 'rgba(255,214,10,0)');
    gg.fillStyle = grad; gg.fillRect(0, 0, 1024, 384);
    gg.fillStyle = '#ffd60a'; gg.font = '900 150px Anton, Impact, sans-serif'; gg.fillText('RB TECH', 50, 175);
    gg.fillStyle = '#ffffff'; gg.font = '700 52px Poppins, Arial, sans-serif'; gg.fillText('iPhone com garantia · troca na hora', 54, 255);
    gg.fillStyle = '#ffd60a'; gg.font = '600 38px Poppins, Arial, sans-serif'; gg.fillText('Rodovia SC-281, 7955 · Colônia Santana', 54, 325);
    const tx = new THREE.CanvasTexture(tela); tx.colorSpace = THREE.SRGBColorSpace;
    const matTela = new THREE.MeshLambertMaterial({ map: tx, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.15 });
    outdoors.push(matTela);
    const lugares = [];
    let d = 0;
    for (let i = 3; i < sc.length; i += 3) {
      const dx = sc[i] - sc[i - 3], dz = sc[i + 2] - sc[i - 1], l = Math.hypot(dx, dz) || 1;
      d += l;
      const dist = Math.hypot(sc[i], sc[i + 2]);
      if (dist < 120 || dist > 1500 || (lugares.length && Math.hypot(sc[i] - lugares[lugares.length - 1][0], sc[i + 2] - lugares[lugares.length - 1][2]) < 420)) continue;
      const lado = lugares.length % 2 ? 1 : -1;
      const x = sc[i] - (dz / l) * 15 * lado, z = sc[i + 2] + (dx / l) * 15 * lado;
      lugares.push([x, altura(x, z), z, Math.atan2(-dz * lado, dx * lado)]);
    }
    for (const [x, y, z, a] of lugares) {
      const o = new THREE.Group(); o.position.set(x, y, z); o.rotation.y = a;
      for (const px of [-3, 3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, 7, 0.35), MAT_POSTE); p.position.set(px, 3.5, 0); o.add(p); }
      const placa = new THREE.Mesh(new THREE.BoxGeometry(10.5, 4, 0.3), new THREE.MeshLambertMaterial({ color: 0x111111 })); placa.position.set(0, 8.5, 0); o.add(placa);
      const frente = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.75), matTela); frente.position.set(0, 8.5, 0.16); o.add(frente);
      const verso = frente.clone(); verso.rotation.y = Math.PI; verso.position.z = -0.16; o.add(verso);
      o.traverse(m => { if (m.isMesh) m.castShadow = true; });
      grupo.add(o);
    }
    // ponto de ônibus na calçada da SC-281, à direita da loja
    const ponto = new THREE.Group(); ponto.position.set(30, -0.5, 11.2);
    const vidro = new THREE.MeshLambertMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.35 });
    const cobertura = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 1.8), new THREE.MeshLambertMaterial({ color: 0xffd60a })); cobertura.position.set(0, 2.6, 0); ponto.add(cobertura);
    for (const px of [-2, 2]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.1), MAT_POSTE); p.position.set(px, 1.3, -0.8); ponto.add(p); }
    const fundo = new THREE.Mesh(new THREE.BoxGeometry(4, 1.9, 0.05), vidro); fundo.position.set(0, 1.4, -0.85); ponto.add(fundo);
    const banco = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.45), new THREE.MeshLambertMaterial({ color: 0x8a6a4a })); banco.position.set(0, 0.5, -0.5); ponto.add(banco);
    const placaOnibus = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), new THREE.MeshLambertMaterial({ color: 0x1f6fd6 })); placaOnibus.position.set(2.4, 2.4, 0); ponto.add(placaOnibus);
    grupo.add(ponto);
  }

  // ---------- quadrados de 500 m: carregar e descarregar conforme o foco ----------
  const TAM = ind.chunk, existe = new Set(ind.chunks);
  const raio = celular ? 850 : 1250;
  const carregados = new Map(); // chave → { grupo, casas } (ou { carregando: true })
  let fila = 0;
  const comY = (p, sobe) => { const out = []; for (let i = 0; i < p.length; i += 2) out.push(p[i], altura(p[i], p[i + 1]) + sobe, p[i + 1]); return out; };
  async function carregar(k) {
    carregados.set(k, { carregando: true });
    fila++;
    try {
      const d = await (await fetch(new URL(`c_${k}.json`, BASE))).json();
      if (!carregados.has(k)) return; // saiu do raio enquanto baixava
      const g = new THREE.Group();
      const vias = d.vias.map(v => ({ ...v, p: comY(v.p, v.faixa ? 0.09 : 0.07) }));
      const asf = vias.filter(v => !v.t), terra = vias.filter(v => v.t);
      if (asf.length) g.add(fitas(asf, COR.asfalto));
      if (terra.length) g.add(fitas(terra, COR.terra));
      if (vias.some(v => v.faixa)) g.add(faixaCentral(vias));
      if (d.rios.length) g.add(fitas(d.rios.map(v => ({ ...v, p: comY(v.p, 0.05) })), COR.rio));
      const casas = d.casas.map(([x, z, ang, w, dd, h, parede, telhado, tipo]) => {
        const cA = Math.cos(ang), sA = Math.sin(ang);
        let base = Infinity;
        for (const [u, v] of [[-w / 2, -dd / 2], [w / 2, -dd / 2], [-w / 2, dd / 2], [w / 2, dd / 2]]) base = Math.min(base, altura(x + u * cA + v * sA, z - u * sA + v * cA));
        return [x, z, ang, w, dd, h, base, parede, telhado, tipo];
      });
      if (casas.length) g.add(montarCasas(casas));
      const arv = [];
      for (let i = 0; i < d.arvores.length; i += 3) { const x = d.arvores[i], z = d.arvores[i + 1]; arv.push(x, altura(x, z), z, d.arvores[i + 2]); }
      if (arv.length) g.add(montarArvores(arv));
      const luzes = postes(vias);
      if (luzes) g.add(luzes);
      grupo.add(g);
      carregados.set(k, { grupo: g, casas, vias });
    } catch (e) {
      console.warn('quadrado', k, e);
      carregados.delete(k);
    } finally { fila--; }
  }
  function descarregar(k) {
    const item = carregados.get(k);
    carregados.delete(k);
    if (!item?.grupo) return;
    grupo.remove(item.grupo);
    item.grupo.traverse(o => {
      if (o.parent?.userData.compartilhado) { o.dispose?.(); return; } // postes: só a instância; materiais e formas são de todos
      o.geometry?.dispose(); if (o.material) [].concat(o.material).forEach(m => m.dispose());
    });
  }
  let ultimo = null, faltam = true;
  /** Chame com o ponto que importa (câmera ou jogador): carrega o que está perto e solta o que ficou longe. */
  function atualizar(foco) {
    if (!foco) return;
    if (ultimo && !faltam && Math.hypot(foco.x - ultimo.x, foco.z - ultimo.z) < 40) return;
    ultimo = { x: foco.x, z: foco.z };
    const ci = Math.floor(foco.x / TAM), cj = Math.floor(foco.z / TAM), alc = Math.ceil(raio / TAM);
    const perto = [];
    for (let i = ci - alc; i <= ci + alc; i++) for (let j = cj - alc; j <= cj + alc; j++) {
      const k = `${i}_${j}`;
      if (!existe.has(k)) continue;
      const dx = Math.max(i * TAM - foco.x, 0, foco.x - (i + 1) * TAM), dz = Math.max(j * TAM - foco.z, 0, foco.z - (j + 1) * TAM);
      const dist = Math.hypot(dx, dz);
      if (dist <= raio) perto.push([dist, k]);
    }
    perto.sort((a, b) => a[0] - b[0]);
    const querer = new Set(perto.map(p => p[1]));
    for (const k of [...carregados.keys()]) {
      const [i, j] = k.split('_').map(Number);
      const dx = Math.max(i * TAM - foco.x, 0, foco.x - (i + 1) * TAM), dz = Math.max(j * TAM - foco.z, 0, foco.z - (j + 1) * TAM);
      if (!querer.has(k) && Math.hypot(dx, dz) > raio + 300) descarregar(k);
    }
    faltam = false;
    for (const [, k] of perto) {
      if (carregados.has(k)) continue;
      if (fila >= 3) { faltam = true; break; } // poucos de cada vez, para não travar
      carregar(k);
    }
  }
  /** Casas perto de (x, z), para colisão: [x, z, ângulo, largura, profundidade, ...]. */
  function casasPerto(x, z) {
    const lista = [];
    const ci = Math.floor(x / TAM), cj = Math.floor(z / TAM);
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
      const item = carregados.get(`${i}_${j}`);
      if (item?.casas) for (const h of item.casas) if (Math.abs(h[0] - x) < 60 && Math.abs(h[1] - z) < 60) lista.push(h);
    }
    return lista;
  }
  /** Ruas dos quadrados carregados perto de (x, z) (com altura): para pedestres e carros do bairro. */
  function viasPerto(x, z, raioBusca = 600) {
    const lista = [];
    for (const item of carregados.values()) for (const v of item.vias || []) {
      const p = v.p, meio = Math.floor(p.length / 6) * 3;
      if (Math.hypot(p[meio] - x, p[meio + 2] - z) < raioBusca) lista.push(v);
    }
    return lista;
  }
  atualizar({ x: 0, z: 0 });
  return {
    ceu: ceuCtl, luzes: { lampada: MAT_LAMPADA, outdoors }, viasPerto,
    grupo, fonte: ind.fonte, loja: ind.loja, altura, casasPerto, atualizar, paraCena,
    chao: [terreno, lote],
    dados: { vias: sc281, casas: [] }, // o trânsito usa a SC-281 inteira
    carregados: () => carregados.size,
  };
}
