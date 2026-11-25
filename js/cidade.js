// Cidade viva em volta de você: pedestres nas calçadas e carros e motos nas ruas do bairro (além da SC-281).
// Tudo acontece só perto do foco (câmera ou você no jogo): quem fica longe volta para perto, numa rua carregada.
import * as THREE from 'three';
import { montarCarro } from './jogo.js';

const sorteio = arr => arr[Math.floor(Math.random() * arr.length)];
const PELES = [0xf0c8a0, 0xe0ac85, 0xc68a5e, 0x8d5a3b, 0x6e4430, 0xf3d2b3];
const CABELOS = [0x1a1a1a, 0x2b1d14, 0x6b3a1f, 0xa8432a, 0xd4a017, 0x5a3b26, 0x777777];
const ROUPAS = [0xff4fa0, 0x18d1e0, 0xffd60a, 0xffffff, 0x1c1c1c, 0x3b6fd6, 0x2fa86b, 0xff9f43, 0x8b5cf6, 0xd7263d, 0xf2e3b3];
const CALCAS = [0x1c1c1c, 0x2d3446, 0x3b5b8c, 0x8a7a5a, 0xf2f2f2, 0x5a6270];

/** Moto em blocos com piloto de capacete. */
function montarMoto(cor) {
  const g = new THREE.Group();
  const caixa = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  g.userData.rodas = [0.75, -0.75].map(z => { const r = new THREE.Group(); r.position.set(0, 0.34, z); g.add(r); const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.68, 0.68), new THREE.MeshLambertMaterial({ color: 0x141414 })); r.add(m); return r; });
  caixa(0.32, 0.36, 1.3, cor, 0, 0.72, 0);
  caixa(0.3, 0.12, 0.7, 0x1c1c1c, 0, 0.96, -0.2);
  caixa(0.7, 0.06, 0.06, 0x222222, 0, 1.12, 0.55);
  caixa(0.22, 0.12, 0.06, 0xfff3c4, 0, 0.86, 0.68);
  caixa(0.42, 0.58, 0.3, sorteio(ROUPAS), 0, 1.32, -0.15);          // piloto
  caixa(0.16, 0.5, 0.16, 0x1c1c1c, -0.14, 0.86, 0.05); caixa(0.16, 0.5, 0.16, 0x1c1c1c, 0.14, 0.86, 0.05);
  caixa(0.34, 0.34, 0.36, sorteio([0x111111, 0xffffff, 0xd7263d, 0xffd60a]), 0, 1.8, -0.12); // capacete
  return g;
}

export function criarCidade({ cena, mundo, celular = false }) {
  const NPED = celular ? 6 : 12, NCARROS = celular ? 5 : 9, NMOTOS = celular ? 2 : 4, RAIO = celular ? 260 : 360;
  const pedestres = [], veiculos = [];
  let criarPersonagem = null;
  import('./personagens.js').then(m => { criarPersonagem = m.criarPersonagem; }).catch(() => {});

  /** Ponto e direção na rua v (polilinha x,y,z), na distância s, deslocado para o lado. */
  function naRua(v, s, lado) {
    const p = v.p;
    let i = 3, acc = 0;
    for (; i < p.length; i += 3) {
      const l = Math.hypot(p[i] - p[i - 3], p[i + 2] - p[i - 1]);
      if (acc + l >= s) break;
      acc += l;
    }
    i = Math.min(i, p.length - 3);
    const ax = p[i - 3], az = p[i - 1], bx = p[i], bz = p[i + 2], l = Math.hypot(bx - ax, bz - az) || 1, k = Math.min(1, Math.max(0, (s - acc) / l));
    const fx = (bx - ax) / l, fz = (bz - az) / l, x = ax + (bx - ax) * k - fz * lado, z = az + (bz - az) * k + fx * lado;
    return { x, z, fx, fz };
  }
  const comprimento = v => { let s = 0; for (let i = 3; i < v.p.length; i += 3) s += Math.hypot(v.p[i] - v.p[i - 3], v.p[i + 2] - v.p[i - 1]); return s; };
  function escolherRua(foco, filtro) {
    const vias = mundo.viasPerto(foco.x, foco.z, RAIO).filter(v => filtro(v) && v.p.length >= 6);
    if (!vias.length) return null;
    const v = sorteio(vias);
    return { v, total: comprimento(v) };
  }

  async function novoPedestre() {
    if (!criarPersonagem) return null;
    const f = Math.random() < 0.5;
    const roupa = {
      sexo: f ? 'f' : 'm', penteado: f ? sorteio(['long', 'buns']) : sorteio(['simpleparted', 'buzzed']), barba: !f && Math.random() < 0.25,
      pele: sorteio(PELES), cabelo: sorteio(CABELOS), camisa: sorteio(ROUPAS), calca: sorteio(CALCAS), sapato: sorteio([0xffffff, 0x1c1c1c, 0x8a5a2c]),
      mangaCurta: Math.random() < 0.6,
    };
    try {
      const m = await criarPersonagem(roupa);
      m.tocar('Walk_Loop', 0);
      cena.add(m.raiz);
      return { m, rua: null, s: 0, sentido: 1, vel: 1.1 + Math.random() * 0.5, lado: 0, parado: 0 };
    } catch { return null; }
  }
  function posicionar(ped, foco) {
    const r = escolherRua(foco, v => !v.t && v.l >= 5);
    if (!r) { ped.m.raiz.visible = false; ped.rua = null; return; }
    ped.rua = r; ped.s = Math.random() * r.total; ped.sentido = Math.random() < 0.5 ? 1 : -1;
    ped.lado = (r.v.l / 2 + 1.3) * (Math.random() < 0.5 ? 1 : -1); // na calçada, de um dos lados
    ped.m.raiz.visible = true;
  }
  function novoVeiculo(moto) {
    const g = moto ? montarMoto(sorteio(ROUPAS)) : montarCarro(sorteio([0xff4fa0, 0xf6f2ea, 0x18d1e0, 0x1c1c1c, 0xff9f43, 0x8b5cf6, 0xd7263d, 0x3dd598, 0x9a9a9a]));
    cena.add(g);
    return { g, moto, rua: null, s: 0, sentido: 1, vel: 0, max: moto ? 11 + Math.random() * 4 : 8 + Math.random() * 4, raio: moto ? 1.1 : 2.3 };
  }
  function posicionarVeiculo(c, foco) {
    const r = escolherRua(foco, v => v.l >= 5 && !v.pista);
    if (!r) { c.g.visible = false; c.rua = null; return; }
    c.rua = r; c.s = Math.random() * r.total; c.sentido = Math.random() < 0.5 ? 1 : -1; c.vel = c.max * 0.6; c.g.visible = true;
  }
  for (let i = 0; i < NCARROS; i++) veiculos.push(novoVeiculo(false));
  for (let i = 0; i < NMOTOS; i++) veiculos.push(novoVeiculo(true));
  let criando = false;

  return {
    veiculos,
    /** Algum carro ou moto do bairro encosta neste círculo? */
    colide(x, z, r) { return veiculos.some(c => c.g.visible && Math.hypot(c.g.position.x - x, c.g.position.z - z) < r + c.raio); },
    atualizar(dt, foco, obstaculos = []) {
      if (!foco) return;
      // pedestres: cria aos poucos (cada um é um personagem 3D)
      if (!criando && pedestres.length < NPED && criarPersonagem) {
        criando = true;
        novoPedestre().then(p => { if (p) { posicionar(p, foco); pedestres.push(p); } }).finally(() => { criando = false; });
      }
      for (const p of pedestres) {
        const raiz = p.m.raiz;
        if (!p.rua || Math.hypot(raiz.position.x - foco.x, raiz.position.z - foco.z) > RAIO + 80) posicionar(p, foco);
        if (!p.rua) continue;
        p.s += p.vel * p.sentido * dt;
        if (p.s > p.rua.total || p.s < 0) { p.sentido = -p.sentido; p.s = Math.min(Math.max(p.s, 0), p.rua.total); }
        const q = naRua(p.rua.v, p.s, p.lado);
        raiz.position.set(q.x, mundo.altura(q.x, q.z) + 0.02, q.z);
        raiz.rotation.y = Math.atan2(q.fx * p.sentido, q.fz * p.sentido);
        p.m.atualizar(dt * p.vel / 1.2);
      }
      // carros e motos nas ruas do bairro (mão direita), freiam para você e para quem está na frente
      for (const c of veiculos) {
        if (!c.rua || Math.hypot(c.g.position.x - foco.x, c.g.position.z - foco.z) > RAIO + 120) posicionarVeiculo(c, foco);
        if (!c.rua) continue;
        const lado = Math.min(2.2, c.rua.v.l / 4) * c.sentido;
        const frente = naRua(c.rua.v, Math.min(Math.max(c.s + 9 * c.sentido, 0), c.rua.total), lado);
        let livre = !obstaculos.some(o => Math.hypot(o.x - frente.x, o.z - frente.z) < 4.5)
          && !veiculos.some(o => o !== c && o.g.visible && Math.hypot(o.g.position.x - frente.x, o.g.position.z - frente.z) < 3.5);
        const alvo = livre ? c.max : 0;
        c.vel += (alvo - c.vel) * Math.min(1, dt * (alvo < c.vel ? 3 : 0.7));
        c.s += c.vel * c.sentido * dt;
        if (c.s > c.rua.total || c.s < 0) { c.sentido = -c.sentido; c.s = Math.min(Math.max(c.s, 0), c.rua.total); } // fim da rua: volta
        const q = naRua(c.rua.v, c.s, lado);
        c.g.position.set(q.x, mundo.altura(q.x, q.z) + 0.04, q.z);
        c.g.rotation.y = Math.atan2(q.fx * c.sentido, q.fz * c.sentido);
        for (const r of c.g.userData.rodas || []) r.rotation.x += c.vel * dt / 0.35;
      }
    },
  };
}
