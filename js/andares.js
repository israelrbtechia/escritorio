// Os andares do prédio RBTech: móveis, salas fechadas dos chefes, copas, lazer, elevador, rua e postos de trabalho.
// Coordenadas de cada andar: x de -12 a 12, z de -8 (fundo) a 8 (frente aberta). O corredor fica em z = 0.
import * as THREE from 'three';
import {
  AMARELO, PRETO, PI, caixa, grupo, telaCanvas, placa, letreiro, mesa, cadeira, caneca, planta,
  monitor, monitorEnfeite, camaCachorro, texturaPiso, piso,
} from './blocos.js';
import { desenharVista, desenharRegras, desenharSaas, desenharSeguidores, desenharBoss } from './telas.js';

export const ALT = 4.2;            // altura de cada andar
export const PAREDE_H = 3.7;       // do piso até a laje de cima
export const ELEVADOR = { x: 13.25, z: -1.5, porta: [11.6, -1.5] };

const vidroMat = new THREE.MeshLambertMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.17, side: THREE.DoubleSide });

// ---------- peças ----------
function casca(g, { tons, parede = 0xede6d8, lado = 0xe4dccb, janela = false }) {
  caixa(24.8, 0.5, 16.8, 0x24211d, 0, -0.26, 0, g).castShadow = false;
  piso(g, texturaPiso(tons));
  const H = PAREDE_H;
  if (janela) {
    caixa(13.6, H, 0.3, parede, 5.2, H / 2, -8.15, g);
    const JX = -6.75, JW = 10.5;
    caixa(JW, 0.9, 0.3, parede, JX, 0.45, -8.15, g);
    caixa(JW, H - 2.8, 0.3, parede, JX, 2.8 + (H - 2.8) / 2, -8.15, g);
    for (let i = 0; i <= 4; i++) caixa(0.12, 1.9, 0.34, 0x2b2b2b, -12 + i * (JW / 4), 1.85, -8.12, g);
    caixa(JW, 0.1, 0.36, 0x2b2b2b, JX, 0.92, -8.1, g);
    caixa(JW, 0.1, 0.36, 0x2b2b2b, JX, 2.8, -8.1, g);
    const vidro = new THREE.Mesh(new THREE.PlaneGeometry(JW, 1.9), new THREE.MeshLambertMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.12 }));
    vidro.position.set(JX, 1.85, -8.05);
    g.add(vidro);
    const vista = telaCanvas(320, 150, true);
    desenharVista(vista);
    vista.t.repeat.set(1, (1.95 / 10.6) * (320 / 150));
    vista.t.offset.set(0, 0.27);
    placa(10.6, 1.95, vista.t, JX, 1.86, -8.42, 0, g);
    setInterval(() => desenharVista(vista), 10 * 60 * 1000);
  } else {
    caixa(24.3, H, 0.3, parede, 0, H / 2, -8.15, g);
  }
  caixa(24.3, 0.16, 0.34, 0x3a332b, 0, 0.08, -7.98, g);
  caixa(0.3, H, 16.3, lado, -12.15, H / 2, 0, g);
  caixa(0.34, 0.16, 16.3, 0x3a332b, -11.98, 0.08, 0, g);
  caixa(1.4, 0.12, 2.0, 0x3a3a3a, 12.65, -0.06, ELEVADOR.z, g).castShadow = false; // passarela do elevador
}
function faixaDaFachada(g, titulo, sub) {
  // fica num grupo próprio: só aparece quando o andar de cima também está à vista
  const f = grupo(0, 0, 0, g);
  const tela = letreiro({ w: 2048, h: 96, titulo, sub, tamanho: 58 });
  caixa(24.8, 0.5, 0.1, PRETO, 0, PAREDE_H + 0.25, 8.45, f);
  placa(24.6, 0.46, tela.t, 0, PAREDE_H + 0.25, 8.51, 0, f);
  g.userData.fachada = f;
}
function tapete(g, w, d, cor, x, z) { caixa(w, 0.02, d, cor, x, 0.012, z, g).castShadow = false; }

/** Parede de vidro reta (ao longo de x ou de z), com vão de porta opcional [de, até]. */
function paredeVidro(g, eixo, fixo, de, ate, porta = null, h = 2.7) {
  const trechos = porta ? [[de, porta[0]], [porta[1], ate]] : [[de, ate]];
  for (const [a, b] of trechos) {
    if (b - a < 0.05) continue;
    const meio = (a + b) / 2, w = b - a;
    const v = new THREE.Mesh(new THREE.PlaneGeometry(w, h), vidroMat);
    if (eixo === 'x') { v.position.set(meio, h / 2, fixo); } else { v.position.set(fixo, h / 2, meio); v.rotation.y = PI / 2; }
    g.add(v);
    const [cx, cz, sx, sz] = eixo === 'x' ? [meio, fixo, w, 0.08] : [fixo, meio, 0.08, w];
    caixa(sx, 0.1, sz, 0x1a1a1a, cx, h, cz, g);
    caixa(sx, 0.08, sz, 0x1a1a1a, cx, 0.04, cz, g);
    caixa(eixo === 'x' ? w : 0.04, 0.1, eixo === 'x' ? 0.04 : w, AMARELO, cx, 1.15, cz, g);
    for (const p of [a, b]) caixa(0.1, h, 0.1, 0x1a1a1a, eixo === 'x' ? p : fixo, h / 2, eixo === 'x' ? fixo : p, g);
  }
  if (porta) { // folha da porta aberta
    const folha = new THREE.Mesh(new THREE.PlaneGeometry(0.9, h - 0.15), vidroMat);
    const base = porta[0];
    if (eixo === 'x') { folha.position.set(base + 0.32, (h - 0.15) / 2, fixo + 0.32); folha.rotation.y = -PI / 4; }
    else { folha.position.set(fixo + 0.32, (h - 0.15) / 2, base + 0.32); folha.rotation.y = PI / 4; }
    g.add(folha);
  }
}
/** Plaquinha com o nome da sala, presa no vidro. */
function placaSala(g, texto, x, z, rotY = 0) {
  const t = letreiro({ w: 512, h: 96, titulo: texto, tamanho: 44 });
  placa(1.6, 0.3, t.t, x, 2.35, z, rotY, g);
}
/** Notebook aberto: devolve a tela (canvas) para animar. rot = para onde a tela olha. */
export function notebook(g, x, z, rot) {
  const n = grupo(x, 0.84, z, g);
  n.rotation.y = rot;
  caixa(0.62, 0.03, 0.42, 0xb8bcc2, 0, 0.015, 0, n);
  caixa(0.5, 0.005, 0.2, 0x2b2b2b, 0, 0.032, 0.03, n);
  const tampa = grupo(0, 0.03, -0.2, n);
  tampa.rotation.x = -0.25;
  caixa(0.62, 0.42, 0.02, 0xb8bcc2, 0, 0.21, 0, tampa);
  const tela = telaCanvas(256, 160);
  placa(0.56, 0.36, tela.t, 0, 0.21, 0.012, 0, tampa);
  return tela;
}
function copa(g, x, z, { geladeira = true } = {}) {
  // balcão encostado na direita (frente para o -x), cafeteira, canecas e geladeira
  caixa(0.8, 0.95, 2.2, 0x3a2a1a, x, 0.475, z, g);
  caixa(0.9, 0.05, 2.3, 0xf2f2f2, x, 0.97, z, g);
  caixa(0.4, 0.55, 0.4, 0x111111, x + 0.05, 1.27, z - 0.5, g);
  caixa(0.1, 0.08, 0.1, AMARELO, x - 0.18, 1.3, z - 0.5, g);
  caneca(g, x - 0.1, z + 0.2, 0.99);
  caneca(g, x + 0.1, z + 0.5, 0.99);
  if (geladeira) caixa(0.8, 1.9, 0.8, 0xe8e8e8, x, 0.95, z + 1.6, g);
}
function sofa(g, x, z, rot, cor = 0x3a3a3a, w = 2.6) {
  const s = grupo(x, 0, z, g);
  s.rotation.y = rot;
  caixa(w, 0.42, 0.9, cor, 0, 0.21, 0, s);
  caixa(w, 0.55, 0.22, cor, 0, 0.62, -0.36, s);
  for (const l of [-1, 1]) caixa(0.22, 0.6, 0.9, cor, l * (w / 2 - 0.11), 0.3, 0, s);
  caixa(0.5, 0.35, 0.15, AMARELO, -w / 4, 0.6, -0.2, s);
}

// ======================================================================
// 1º andar · Loja RB TECH
// ======================================================================
export function montarLoja(g, telas) {
  casca(g, { tons: ['#e9e4dc', '#dedad2', '#f2eee6', '#e4dfd6'], parede: 0x111111, lado: 0xf2f2f2 });
  faixaDaFachada(g, 'RB TECH', 'iPhones e celulares · Florianópolis');
  caixa(10, 3.0, 0.05, AMARELO, 0, 1.9, -7.97, g);
  const logo = letreiro({ w: 1024, h: 256, fundo: '#ffd60a', titulo: 'RB TECH', cor: '#0f0f0f', tamanho: 150 });
  placa(5.2, 1.3, logo.t, 0, 2.6, -7.93, 0, g);
  const cores = [0x1c1c1c, 0xf2f2f2, 0x3b6fd6, 0xe8d5c4, 0x6b5b95, 0x2f4f4f, 0xc0c0c0, 0xd4af37];
  for (let i = 0; i < 16; i++) { caixa(0.32, 0.6, 0.05, cores[i % 8], -4.2 + i * 0.55, 1.25, -7.92, g); caixa(0.26, 0.48, 0.01, 0x0a0a0a, -4.2 + i * 0.55, 1.25, -7.89, g); }
  // balcão de atendimento
  caixa(12, 1.0, 0.9, PRETO, 0, 0.5, -4.5, g);
  caixa(12, 0.06, 1.0, 0xf2f2f2, 0, 1.03, -4.5, g);
  caixa(12, 0.12, 0.02, AMARELO, 0, 0.75, -4.04, g);
  for (const x of [-2, 2.5]) caixa(0.5, 0.35, 0.03, 0x111111, x, 1.24, -4.6, g);
  // vitrines
  for (const x of [-4, 4]) {
    caixa(3.6, 0.8, 0.9, 0xf4f4f4, x, 0.4, 2.5, g);
    const v = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.35, 0.9), new THREE.MeshLambertMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.25 }));
    v.position.set(x, 0.98, 2.5);
    g.add(v);
    for (let i = 0; i < 6; i++) caixa(0.28, 0.03, 0.5, [0x1c1c1c, 0xf2f2f2, 0x3b6fd6, 0xd4af37][i % 4], x - 1.35 + i * 0.54, 0.82, 2.5, g);
  }
  // caixa (pagamento)
  caixa(1.2, 1.05, 2.0, PRETO, 9.2, 0.52, -4.2, g);
  caixa(1.3, 0.06, 2.1, AMARELO, 9.2, 1.07, -4.2, g);
  caixa(0.35, 0.3, 0.25, 0x222222, 9.1, 1.25, -4.4, g);
  // estoque
  mesa(g, -9.5, -5.5, 2.4, 1.2, 0xf2f2f2, 0x2b2b2b);
  cadeira(g, -9.5, -4.3, PI);
  telas.estoque = monitor(g, -9.5, -5.75, 0);
  for (const y of [0.6, 1.3, 2.0]) {
    caixa(0.5, 0.06, 4, 0x8b5e3c, -11.7, y, -5.5, g);
    for (let i = 0; i < 7; i++) caixa(0.3, 0.42, 0.18, i % 3 ? 0xffffff : 0x1c1c1c, -11.7, y + 0.24, -7.2 + i * 0.55, g);
  }
  // sala fechada do gerente da loja (frente esquerda)
  paredeVidro(g, 'z', -6.6, 1.6, 7.95);
  paredeVidro(g, 'x', 1.6, -12, -6.6, [-10.3, -8.1]);
  paredeVidro(g, 'x', 7.95, -12, -6.6);
  placaSala(g, 'GERENTE DA LOJA', -7.6, 1.56, 0);
  tapete(g, 5.2, 6.2, 0x2a2a2a, -9.3, 4.8);
  mesa(g, -9, 3.5, 2.4, 1.2, 0x2d2d2d, 0x161616);
  cadeira(g, -9, 4.7, PI, true);
  telas.gerente_loja = notebook(g, -9, 3.55, 0);
  caneca(g, -8.1, 3.3);
  planta(g, -11.3, 7.3, 1.0);
  // copa da equipe (atrás do balcão) e espera dos clientes
  caixa(1.3, 0.95, 0.6, 0x3a2a1a, 5.4, 0.475, -7.5, g);
  caixa(0.4, 0.55, 0.35, 0x111111, 5.2, 1.22, -7.5, g);
  caneca(g, 5.8, -7.5, 0.95);
  sofa(g, 7.6, 7.2, PI, 0x3a3a3a, 3.0);
  caixa(0.8, 0.45, 0.8, AMARELO, 7.6, 0.23, 5.6, g);
  tapete(g, 2.0, 1.0, AMARELO, 0, 7.2);
  planta(g, 11.3, 7.3, 1.2);
  planta(g, 4.4, -7.3, 1.0);
}

// ======================================================================
// 2º andar · Agência RBTech (tráfego e crescimento)
// ======================================================================
export function montarAgencia(g, telas) {
  casca(g, { tons: ['#c9a27a', '#bf956b', '#d2ad86', '#c49a70'], janela: true });
  faixaDaFachada(g, 'AGÊNCIA RBTECH', 'tráfego pago e crescimento');
  // sala fechada do chefe de tráfego (fundo direito)
  paredeVidro(g, 'z', 4, -8, -2.6);
  paredeVidro(g, 'x', -2.6, 4, 12, [6.4, 9.6]);
  placaSala(g, 'TRÁFEGO', 5.2, -2.56, 0);
  const sign = letreiro({ w: 640, h: 160, titulo: 'RBTECH', tamanho: 92 });
  caixa(3.4, 0.95, 0.08, PRETO, 8, 2.45, -7.96, g);
  placa(3.3, 0.85, sign.t, 8, 2.45, -7.91, 0, g);
  tapete(g, 4.4, 3.2, 0x2a2a2a, 8, -5.2);
  mesa(g, 8, -5, 3.0, 1.4, 0x2d2d2d, 0x161616);
  cadeira(g, 8, -6.2, 0, true);
  telas.chefe = notebook(g, 8, -5.05, PI);
  caneca(g, 7.0, -4.7);
  planta(g, 11.3, -7.3, 1.2);
  // sala fechada do gerente de crescimento (fundo esquerdo, na janela)
  paredeVidro(g, 'z', -4.5, -8, -2.6);
  paredeVidro(g, 'x', -2.6, -12, -4.5, [-9.4, -6.6]);
  placaSala(g, 'CRESCIMENTO', -5.6, -2.56, 0);
  tapete(g, 4.4, 3.2, 0x4a2350, -8.2, -5.2);
  mesa(g, -8.2, -5, 3.0, 1.4, 0x2d2d2d, 0x161616);
  cadeira(g, -8.2, -6.2, 0, true);
  telas.gerente_crescimento = notebook(g, -8.2, -5.05, PI);
  caneca(g, -7.2, -4.7);
  planta(g, -11.2, -7.3, 1.2);
  // placar e mesa de reunião no meio
  telas.placar = telaCanvas(640, 360);
  caixa(3.3, 1.95, 0.12, 0x111111, 1.4, 1.95, -7.94, g);
  placa(3.1, 1.75, telas.placar.t, 1.4, 1.95, -7.87, 0, g);
  mesa(g, -0.5, -4.6, 3.4, 1.6, 0x8b5e3c, 0x3a2a1a);
  for (const x of [-1.6, -0.5, 0.6]) { cadeira(g, x, -3.5, PI); cadeira(g, x, -5.7, 0); }
  // quadro de regras e prateleira
  const regras = telaCanvas(320, 400);
  desenharRegras(regras);
  document.fonts?.ready.then(() => desenharRegras(regras));
  caixa(0.06, 2.1, 1.75, 0x1a1a1a, -11.97, 1.75, -1.0, g);
  placa(1.65, 2.0, regras.t, -11.93, 1.75, -1.0, PI / 2, g);
  caixa(0.5, 0.08, 3.2, 0x8b5e3c, -11.75, 1.55, 3.6, g);
  caixa(0.5, 0.08, 3.2, 0x8b5e3c, -11.75, 2.25, 3.6, g);
  for (let i = 0; i < 6; i++) {
    caixa(0.3, 0.42, 0.18, i % 3 ? 0xffffff : 0x1c1c1c, -11.75, 1.8, 2.3 + i * 0.5, g);
    caixa(0.3, 0.42, 0.18, i % 2 ? 0xffffff : 0xf2e6d0, -11.75, 2.5, 2.3 + i * 0.5, g);
  }
  // mesas da equipe
  for (const [papel, x] of [['copywriter', -8], ['roteirista', -4], ['analista', 3], ['revisor', 8]]) {
    mesa(g, x, 3, 2.4, 1.2, 0xf2f2f2, 0x2b2b2b);
    cadeira(g, x, 4.3, PI);
    telas[papel] = monitor(g, x, 2.75, 0);
    if (papel === 'analista') { monitorEnfeite(g, x - 0.95, 2.85, 0.35); monitorEnfeite(g, x + 0.95, 2.85, -0.35); }
    caixa(0.7, 0.03, 0.22, 0x2b2b2b, x, 0.855, 3.25, g);
    caneca(g, x + 0.85, 3.25);
  }
  caixa(0.05, 1.3, 0.05, 0x222222, -2.6, 0.65, 1.6, g); // tripé do roteirista
  caixa(0.4, 0.4, 0.02, 0xfff3c4, -2.6, 1.45, 1.55, g, { emissive: 0xffe680, emissiveIntensity: 0.6 });
  // especialista de crescimento e o contador de seguidores
  mesa(g, 4.6, 6.4, 2.4, 1.2, 0xf2f2f2, 0x2b2b2b);
  cadeira(g, 4.6, 7.6, PI);
  telas.especialista = monitor(g, 4.6, 6.15, 0);
  telas.seguidores = telaCanvas(256, 400);
  desenharSeguidores(telas.seguidores, null);
  caixa(1.3, 2.1, 0.12, 0x111111, 1.9, 1.15, 6.6, g);
  placa(1.2, 1.9, telas.seguidores.t, 1.9, 1.2, 6.67, 0, g);
  // copa e cantinho do sofá (frente direita)
  tapete(g, 4.6, 3.0, 0x3a3a3a, 9.1, 6.6);
  copa(g, 11.4, 5.4);
  sofa(g, 8.6, 7.5, PI, 0x2f4f4f);
  caixa(1.2, 0.35, 0.7, 0x8b5e3c, 8.6, 0.18, 6.3, g);
  // camas do Peter e da Bibi
  camaCachorro(g, -3.3, -7.0, 1.2, 0x1c1c1c, AMARELO);
  camaCachorro(g, -10.4, 6.6, 0.9, 0xd96b8a, 0xffd1dc);
  caixa(0.3, 0.08, 0.3, 0x3b6fd6, -2.2, 0.04, -7.4, g);
  planta(g, 3.4, -7.3, 1.0);
}

// ======================================================================
// 3º andar · Time de vendas e gestão dos sistemas SaaS
// ======================================================================
export function montarVendas(g, telas) {
  casca(g, { tons: ['#5b6270', '#646b79', '#555c69', '#6a7280'], parede: 0xe8eaee, lado: 0xdfe2e8 });
  faixaDaFachada(g, 'VENDAS & SAAS', 'time de vendas e gestão dos sistemas criados');
  telas.saas = telaCanvas(640, 360);
  desenharSaas(telas.saas, 0);
  caixa(3.6, 2.1, 0.12, 0x111111, 2.0, 2.0, -7.94, g);
  placa(3.4, 1.9, telas.saas.t, 2.0, 2.0, -7.87, 0, g);
  // sala fechada do head de vendas
  paredeVidro(g, 'z', -3.6, -8, -2.6);
  paredeVidro(g, 'x', -2.6, -12, -3.6, [-8.4, -5.4]);
  placaSala(g, 'HEAD DE VENDAS', -4.6, -2.56, 0);
  tapete(g, 4.6, 3.2, 0x2a2a2a, -7, -5.2);
  mesa(g, -7, -5, 3.0, 1.4, 0x2d2d2d, 0x161616);
  cadeira(g, -7, -6.2, 0, true);
  telas.head_vendas = notebook(g, -7, -5.05, PI);
  caneca(g, -6.0, -4.7);
  planta(g, -11.2, -7.3, 1.1);
  const quadro = letreiro({ w: 512, h: 256, fundo: '#ffffff', titulo: 'FUNIL', cor: '#0f0f0f', tamanho: 110 });
  caixa(0.06, 1.6, 2.6, 0xdddddd, -11.97, 1.8, 2.5, g);
  placa(2.5, 1.25, quadro.t, -11.93, 2.1, 2.5, PI / 2, g);
  for (let i = 0; i < 6; i++) caixa(0.02, 0.22, 0.22, [0xffd60a, 0xff9f43, 0x2fd17a][i % 3], -11.92, 1.25 + (i % 2) * 0.3, 1.6 + i * 0.35, g);
  // mesas do time de vendas
  for (const [papel, x] of [['sdr', -8], ['closer', -4], ['sucesso', 0]]) {
    mesa(g, x, 3, 2.4, 1.2, 0xf2f2f2, 0x2b2b2b);
    cadeira(g, x, 4.3, PI);
    telas[papel] = monitor(g, x, 2.75, 0);
    caixa(0.7, 0.03, 0.22, 0x2b2b2b, x, 0.855, 3.25, g);
  }
  // gestão de sistemas
  mesa(g, 6, -4.6, 3.0, 1.4, 0xf2f2f2, 0x2b2b2b);
  cadeira(g, 6, -5.8, 0);
  telas.produto = monitor(g, 6, -4.4, PI);
  monitorEnfeite(g, 5.0, -4.3, PI - 0.35, 'codigo');
  monitorEnfeite(g, 7.0, -4.3, PI + 0.35, 'codigo');
  caixa(1.0, 2.3, 1.0, 0x1a1a1a, 11.0, 1.15, -6.6, g);
  telas.leds = [];
  for (let i = 0; i < 10; i++) {
    telas.leds.push(caixa(0.08, 0.05, 0.02, 0x2fd17a, 10.7 + (i % 2) * 0.5, 0.5 + Math.floor(i / 2) * 0.4, -6.08, g, { emissive: 0x2fd17a, emissiveIntensity: 1 }));
  }
  // sino das vendas
  caixa(0.1, 1.5, 0.1, 0x333333, 3.6, 0.75, -1.8, g);
  caixa(0.36, 0.3, 0.36, AMARELO, 3.6, 1.65, -1.8, g);
  // copa e sofá (frente direita), bebedouro
  tapete(g, 4.6, 3.0, 0x2a2a2a, 9.1, 6.6);
  copa(g, 11.4, 5.4);
  sofa(g, 8.6, 7.5, PI, 0x1f2a44);
  caixa(1.2, 0.35, 0.7, 0x8b5e3c, 8.6, 0.18, 6.3, g);
  caixa(0.5, 1.1, 0.5, 0xe8eaee, -11.2, 0.55, 6.8, g);
  caixa(0.4, 0.5, 0.4, 0x7fc4ff, -11.2, 1.35, 6.8, g, { transparent: true, opacity: 0.7 });
  planta(g, 11.3, 1.2, 1.0);
  planta(g, -2.8, -7.3, 1.0);
}

// ======================================================================
// Terraço · sala fechada do Israel (Boss), copa e área de lazer
// ======================================================================
export function montarTerraco(g, telas) {
  piso(g, texturaPiso(['#8a6a4a', '#7d5f41', '#94744f'], 'rgba(30,20,10,.4)', 9));
  caixa(24.6, 0.9, 0.2, 0xd9d4ca, 0, 0.45, -8.1, g);
  caixa(0.2, 0.9, 16.4, 0xd9d4ca, -12.1, 0.45, 0, g);
  caixa(24.6, 0.25, 0.2, 0xd9d4ca, 0, 0.12, 8.1, g);
  // letreiro gigante
  const topo = letreiro({ w: 2048, h: 384, titulo: 'RB TECH', tamanho: 300 });
  caixa(10, 2.2, 0.2, PRETO, -6.6, 2.1, -7.7, g);
  placa(9.8, 1.9, topo.t, -6.6, 2.1, -7.58, 0, g);
  for (const x of [-10.5, -2.7]) caixa(0.15, 1.0, 0.15, 0x333333, x, 0.5, -7.7, g);
  // sala fechada do Israel
  paredeVidro(g, 'z', -1.5, -8, -0.75);
  paredeVidro(g, 'z', 6.5, -8, -0.75);
  paredeVidro(g, 'x', -0.75, -1.5, 6.5, [1.0, 3.9]);
  paredeVidro(g, 'x', -7.95, -1.5, 6.5);
  placaSala(g, 'ISRAEL · BOSS', 5.2, -0.71, 0);
  tapete(g, 7.8, 7.0, 0x111111, 2.5, -4.4);
  mesa(g, 2.5, -5, 3.2, 1.4, 0x111111, 0x111111);
  caixa(3.2, 0.03, 1.4, AMARELO, 2.5, 0.86, -5, g);
  cadeira(g, 2.5, -6.2, 0, true);
  telas.israel = notebook(g, 2.5, -5.05, PI);
  for (let i = 0; i < 3; i++) caneca(g, 3.6 + i * 0.16, -4.6 + (i % 2) * 0.15); // canecas acumuladas do Boss
  telas.boss = telaCanvas(640, 300);
  desenharBoss(telas.boss, 0, 0);
  caixa(3.4, 1.65, 0.1, 0x111111, 2.5, 2.0, -7.7, g);
  placa(3.2, 1.5, telas.boss.t, 2.5, 2.0, -7.64, 0, g);
  // mesa de reunião do Israel com os chefes (em frente à sala)
  mesa(g, 2.5, 3.6, 3.6, 1.6, 0x111111, 0x111111);
  caixa(3.6, 0.03, 1.6, AMARELO, 2.5, 0.86, 3.6, g);
  for (let i = 0; i < 5; i++) caneca(g, 1.0 + i * 0.75, 3.6 + (i % 2 ? 0.3 : -0.3));
  // máquina de espresso particular do Boss
  caixa(0.8, 0.95, 1.6, 0x111111, 5.9, 0.475, -5.5, g);
  caixa(0.9, 0.05, 1.7, AMARELO, 5.9, 0.97, -5.5, g);
  caixa(0.5, 0.6, 0.45, 0xc0c0c0, 5.95, 1.3, -5.7, g);
  caixa(0.12, 0.1, 0.12, 0x111111, 5.7, 1.2, -5.7, g);
  caneca(g, 5.8, -5.0, 0.99);
  // copa do terraço (esquerda)
  const cg = grupo(0, 0, 0, g);
  caixa(0.8, 0.95, 3.0, 0x3a2a1a, -11.4, 0.475, -3.6, cg);
  caixa(0.9, 0.05, 3.1, 0xf2f2f2, -11.4, 0.97, -3.6, cg);
  caixa(0.4, 0.55, 0.4, 0x111111, -11.35, 1.27, -3.6, cg);
  caixa(0.8, 1.9, 0.8, 0xe8e8e8, -11.4, 0.95, -5.9, cg);
  caneca(g, -11.3, -2.7, 0.99);
  mesa(g, -8, -3.6, 1.8, 1.0, 0xf2f2f2, 0x2b2b2b);
  for (const [x, z] of [[-8.5, -4.4], [-7.5, -4.4], [-8.5, -2.8], [-7.5, -2.8]]) caixa(0.4, 0.5, 0.4, AMARELO, x, 0.25, z, g);
  // área de lazer: sofás, TV com videogame, pebolim, guarda-sol
  tapete(g, 6.2, 4.2, 0x2f4f4f, -8.5, 4.8);
  caixa(0.3, 1.0, 2.2, 0x111111, -11.6, 1.3, 4.6, g);
  const tv = letreiro({ w: 512, h: 256, fundo: '#16213e', titulo: '🎮 PLAY', cor: '#ffd60a', tamanho: 90 });
  placa(2.0, 0.95, tv.t, -11.44, 1.3, 4.6, PI / 2, g);
  caixa(0.5, 0.5, 1.6, 0x2b2b2b, -11.5, 0.25, 4.6, g);
  sofa(g, -8.2, 4.6, -PI / 2, 0xf2f2f2, 2.8);
  sofa(g, -9.6, 6.6, PI, 0xf2f2f2, 2.2);
  caixa(1.4, 0.8, 0.8, 0x2f7a2c, -4.5, 0.6, 6.0, g); // pebolim
  caixa(1.5, 0.1, 0.9, 0x5a3a20, -4.5, 1.02, 6.0, g);
  for (let i = 0; i < 4; i++) caixa(0.03, 0.03, 1.2, 0x999999, -5.0 + i * 0.33, 1.1, 6.0, g);
  caixa(0.15, 2.4, 0.15, 0x333333, 8.6, 1.2, 4.0, g);
  caixa(2.6, 0.1, 2.6, AMARELO, 8.6, 2.4, 4.0, g);
  for (const x of [7.6, 9.6]) { caixa(0.8, 0.3, 1.8, 0xf2f2f2, x, 0.3, 5.6, g); caixa(0.8, 0.5, 0.25, 0xf2f2f2, x, 0.55, 6.5, g); }
  for (const [x, z] of [[9.6, -6.5], [10.9, -6.5]]) caixa(1.1, 0.9, 1.1, 0xbfbfbf, x, 0.45, z, g); // ar-condicionado
  planta(g, -11.2, -7.0, 1.3);
  planta(g, -1, 7.2, 1.1);
  planta(g, 4.5, 7.2, 1.1);
  planta(g, 11.3, 7.3, 1.2);
}

// ======================================================================
// Rua, calçada e o elevador de vidro
// ======================================================================
export function montarRua(cena) {
  caixa(120, 0.2, 120, 0x2c2f33, 0, -0.62, 0, cena).castShadow = false;
  caixa(34, 0.12, 4, 0x9a9a96, 2, -0.06, 10.2, cena).castShadow = false;
  caixa(60, 0.1, 9, 0x232528, 0, -0.52, 16.6, cena).castShadow = false;
  for (let i = -6; i <= 6; i++) caixa(1.6, 0.02, 0.18, AMARELO, i * 4, -0.46, 16.6, cena).castShadow = false;
  for (const x of [-14, 18]) {
    caixa(0.18, 5, 0.18, 0x333333, x, 2.0, 11.9, cena);
    caixa(1.0, 0.15, 0.3, 0x333333, x - 0.4, 4.5, 11.9, cena);
    caixa(0.4, 0.1, 0.3, 0xfff3c4, x - 0.8, 4.4, 11.9, cena, { emissive: 0xfff0b0, emissiveIntensity: 0.8 });
  }
  for (const x of [-17, 17, 22]) { caixa(0.3, 1.6, 0.3, 0x5a3a20, x, 0.75, 11.8, cena); caixa(1.6, 1.4, 1.6, 0x3f8f3a, x, 2.2, 11.8, cena); }
}
export function montarElevador(predio) {
  const { x, z } = ELEVADOR;
  const alturaTotal = ALT * 3 + 3.2;
  for (const [dx, dz] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) caixa(0.12, alturaTotal, 0.12, 0x222222, x + dx, alturaTotal / 2 - 0.5, z + dz, predio);
  caixa(1.9, 0.12, 1.9, 0x222222, x, alturaTotal - 0.5, z, predio);
  const cabine = grupo(x, 0, z, predio);
  caixa(1.5, 0.1, 1.5, 0x333333, 0, 0.05, 0, cabine);
  caixa(1.5, 0.1, 1.5, 0x333333, 0, 2.45, 0, cabine);
  for (const [px, pz, ry] of [[0.74, 0, PI / 2], [0, 0.74, 0], [0, -0.74, 0]]) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.3), vidroMat);
    v.position.set(px, 1.25, pz); v.rotation.y = ry; cabine.add(v);
  }
  caixa(0.04, 0.1, 1.5, AMARELO, 0.74, 1.2, 0, cabine);
  return cabine;
}

// ======================================================================
// Quem trabalha onde. assento: [x, z]; olhar: 0 = virado para a rua; rota: do posto até o corredor (z = 0);
// visita: pontos (depois do corredor) até ficar diante do chefe.
// ======================================================================
const ap = (pele, cabelo, penteado, camisa, calca, sapato, extra = {}) => ({ pele, cabelo, penteado, camisa, calca, sapato, ...extra });
export const PESSOAS_3D = {
  // 1º andar
  gerente_loja: { andar: 0, ap: ap(0xd9a27a, 0x1a1a1a, 'curto', 0x1c1c1c, 0x1c1c1c, 0x0c0c0c, { frente: 0xffffff, gravata: AMARELO, barba: true }),
    posto: { assento: [-9, 4.7], olhar: PI, rota: [[-9, 4.7], [-10.8, 4.7], [-10.8, 2.2], [-9.9, 2.2], [-9.9, 0]] } },
  atendimento: { andar: 0, ap: ap(0xf0c8a0, 0x6b3a1f, 'longo', AMARELO, 0x1c1c1c, 0xffffff),
    posto: { assento: [-2, -5.5], olhar: 0, empe: true, rota: [[-2, -5.5], [-6.6, -5.5], [-6.6, 0]] }, visita: [[-9.6, 0], [-9.6, 2.3]], olharVisita: 0 },
  vendedor: { andar: 0, decor: true, ap: ap(0x8d5a3b, 0x111111, 'curto', AMARELO, 0x1c1c1c, 0xffffff),
    posto: { assento: [2.5, -5.5], olhar: 0, empe: true, rota: [[2.5, -5.5], [6.6, -5.5], [6.6, 0]] } },
  posvenda: { andar: 0, ap: ap(0xe8b48a, 0x3a2618, 'coque', 0x2fb8a6, 0x30343c, 0xf2f2f2),
    posto: { assento: [10.4, -4.2], olhar: -PI / 2, empe: true, rota: [[10.4, -4.2], [10.4, 0]] }, visita: [[-8.4, 0], [-8.4, 2.3]], olharVisita: 0 },
  estoque: { andar: 0, ap: ap(0xc68a5e, 0x2b1d14, 'topete', 0x5a6270, 0x2d3446, 0x222222, { bone: 0x2b2b2b }),
    posto: { assento: [-9.5, -4.3], olhar: PI, rota: [[-9.5, -4.3], [-7.8, -4.3], [-7.8, 0]] }, visita: [[-9.0, 0], [-9.0, 2.3]], olharVisita: 0 },
  // 2º andar
  chefe: { andar: 1, ap: ap(0xc68a5e, 0x2b1d14, 'longo', 0x1c1c1c, 0x1c1c1c, 0x0c0c0c, { frente: 0xf4f4f4, gravata: AMARELO }),
    posto: { assento: [8, -6.2], olhar: 0, rota: [[8, -6.2], [9.9, -6.2], [9.9, -3.1], [9.2, -3.1], [9.2, 0]] } },
  analista: { andar: 1, ap: ap(0xf0c8a0, 0x1a1a1a, 'curto', 0x3b6fd6, 0x2d3446, 0x222222, { oculos: true }),
    posto: { assento: [3, 4.3], olhar: PI, rota: [[3, 4.3], [5.5, 4.3], [5.5, 0]] }, visita: [[6.8, 0], [6.8, -3.6]], olharVisita: PI },
  copywriter: { andar: 1, ap: ap(0xe8b48a, 0xa8432a, 'longo', 0x2fb8a6, 0x30343c, 0xf2f2f2),
    posto: { assento: [-8, 4.3], olhar: PI, rota: [[-8, 4.3], [-6, 4.3], [-6, 0]] }, visita: [[7.5, 0], [7.5, -3.6]], olharVisita: PI },
  roteirista: { andar: 1, ap: ap(0x8d5a3b, 0x111111, 'curto', 0x161616, 0x5a6270, 0xffffff, { bone: AMARELO, fone: true }),
    posto: { assento: [-4, 4.3], olhar: PI, rota: [[-4, 4.3], [-2, 4.3], [-2, 0]] }, visita: [[8.2, 0], [8.2, -3.6]], olharVisita: PI },
  revisor: { andar: 1, ap: ap(0xf3d2b3, 0x5a3b26, 'coque', 0x9b6bd1, 0x2a2a2a, 0x3a2a1a, { oculos: true }),
    posto: { assento: [8, 4.3], olhar: PI, rota: [[8, 4.3], [9.9, 4.3], [9.9, 0]] }, visita: [[8.9, 0], [8.9, -3.6]], olharVisita: PI },
  gerente_crescimento: { andar: 1, ap: ap(0xe0ac85, 0x2b1d14, 'longo', 0xc13584, 0x1c1c1c, 0x0c0c0c, { frente: 0xffffff }),
    posto: { assento: [-8.2, -6.2], olhar: 0, rota: [[-8.2, -6.2], [-10.4, -6.2], [-10.4, -3.1], [-9.0, -3.1], [-9.0, 0]] } },
  especialista: { andar: 1, ap: ap(0x6e4430, 0x111111, 'topete', 0xff8a3d, 0x2f3b55, 0xffffff, { fone: true }),
    posto: { assento: [4.6, 7.6], olhar: PI, rota: [[4.6, 7.6], [6.4, 7.6], [6.4, 0]] }, visita: [[-7.6, 0], [-7.6, -3.6]], olharVisita: PI },
  estagiario: { andar: 1, ap: ap(0xd9a27a, 0x3a2618, 'topete', AMARELO, 0x2f3b55, 0xffffff),
    posto: { assento: [-0.3, 7.2], olhar: PI, rota: [[-0.3, 7.2], [1.0, 7.2], [1.0, 0]] } },
  // 3º andar
  head_vendas: { andar: 2, ap: ap(0xf0c8a0, 0x3a2618, 'coque', 0x1f2a44, 0x1c1c1c, 0x0c0c0c, { frente: 0xffffff, oculos: true }),
    posto: { assento: [-7, -6.2], olhar: 0, rota: [[-7, -6.2], [-9.6, -6.2], [-9.6, -3.1], [-8.0, -3.1], [-8.0, 0]] } },
  sdr: { andar: 2, ap: ap(0xd9a27a, 0x111111, 'curto', 0xff5a5a, 0x2d3446, 0xffffff, { fone: true }),
    posto: { assento: [-8, 4.3], olhar: PI, rota: [[-8, 4.3], [-6, 4.3], [-6, 0]] }, visita: [[-7.9, 0], [-7.9, -3.6]], olharVisita: PI },
  closer: { andar: 2, ap: ap(0x8d5a3b, 0x1a1a1a, 'curto', 0x1c1c1c, 0x1c1c1c, 0x0c0c0c, { frente: 0xffffff, gravata: 0xff5a5a, fone: true }),
    posto: { assento: [-4, 4.3], olhar: PI, rota: [[-4, 4.3], [-2, 4.3], [-2, 0]] }, visita: [[-7.2, 0], [-7.2, -3.6]], olharVisita: PI },
  sucesso: { andar: 2, ap: ap(0xf3d2b3, 0xd4a017, 'longo', 0x2fd17a, 0x30343c, 0xf2f2f2, { fone: true }),
    posto: { assento: [0, 4.3], olhar: PI, rota: [[0, 4.3], [2, 4.3], [2, 0]] }, visita: [[-6.5, 0], [-6.5, -3.6]], olharVisita: PI },
  produto: { andar: 2, ap: ap(0xc68a5e, 0x111111, 'topete', 0x161616, 0x5a6270, 0x3a3a3a, { oculos: true }),
    posto: { assento: [6, -5.8], olhar: 0, rota: [[6, -5.8], [8.2, -5.8], [8.2, 0]] }, visita: [[-5.8, 0], [-5.8, -3.6]], olharVisita: PI },
  // terraço
  israel: { andar: 3, ap: ap(0xd2a07a, 0x1a1a1a, 'curto', 0x111111, 0x111111, 0x0c0c0c, { frente: 0xffffff, gravata: AMARELO, oculos: true }),
    posto: { assento: [2.5, -6.2], olhar: 0, rota: [[2.5, -6.2], [0.0, -6.2], [0.0, -1.9], [2.0, -1.9], [2.0, 0]] } },
};

/** Onde cada chefe fica em pé diante da mesa do Israel. */
export const DIANTE_DO_ISRAEL = { gerente_loja: 1.3, chefe: 2.0, gerente_crescimento: 2.7, head_vendas: 3.4 };
/** Lugares na mesa de reunião do terraço: [x, z, olhar]. */
export const REUNIAO = {
  gerente_loja: [1.3, 2.3, 0], chefe: [2.5, 2.3, 0], gerente_crescimento: [3.7, 2.3, 0], head_vendas: [0.1, 3.6, PI / 2], israel: [4.9, 3.6, -PI / 2],
};
/** Caminho do Israel até a máquina de espresso dele (sem sair da sala). */
export const ESPRESSO = { ida: [[4.8, -6.2], [5.05, -5.5]], volta: [[4.8, -6.2], [2.5, -6.2]], olhar: PI / 2 };

/** Pausas: lugares (com o que se fala lá). Cada andar tem copa; o terraço tem o lazer. */
export const PAUSAS = {
  0: [{ p: [5.4, -6.8], c: [[6.6, 0], [6.6, -6.8], [5.4, -6.8]], o: PI, f: ['☕ cafezinho rápido', '☕ bora!'] }, { p: [9.5, 5.6], o: 0, f: ['🛋️ dois minutinhos'] }],
  1: [{ p: [10.6, 4.9], o: PI / 2, f: ['☕ cafezinho', '☕ alguém quer café?'] }, { p: [10.0, 6.4], o: -PI / 2, f: ['🛋️ pausa rápida', '😮‍💨 respirando'] }, { p: [-10, -1.9], o: PI, f: ['🌉 que vista!'] }],
  2: [{ p: [10.6, 4.9], o: PI / 2, f: ['☕ café pra ligar o cérebro', '☕ mais um!'] }, { p: [8.6, 5.6], o: PI, f: ['🛋️ pausa merecida'] }, { p: [-10.7, 6.0], o: -PI / 2, f: ['💧 hidratando'] }],
  3: [{ p: [-10.6, -3.6], o: -PI / 2, f: ['☕ café da copa do terraço', '☕ esse é o melhor café do prédio'] }, { p: [-9.4, 3.6], o: -PI / 2, f: ['🎮 só uma partidinha', '🎮 GOOOL!'] },
      { p: [-4.5, 5.1], o: 0, f: ['⚽ pebolim!', '⚽ rodou não vale!'] }, { p: [-3.3, 6.0], o: -PI / 2, f: ['⚽ 2 a 1 pra mim'] }, { p: [8.6, 2.6], o: 0, f: ['😎 sol de Floripa', '🌴 respirando'] },
      { p: [-8, -1.9], o: PI, f: ['🥪 lanchinho'] }],
};
/** Lugares por onde Peter e Bibi passeiam. */
export const LUGARES_CAES = {
  0: [[-1, 6.2], [3, 6.2], [0, -2.6], [5.8, -2.6], [-4, 5.2], [10.6, 6.2]],
  1: [[-3.2, -1.6], [0.5, 1.6], [-6, 6.8], [10.8, 1.5], [2.5, -1.3], [-2.0, 5.6], [10.0, 6.6]],
  2: [[-1, -2.5], [4, 6.4], [10.5, -3.0], [-10.7, 6.0], [8.6, 5.6]],
  3: [[-8, 6.0], [8.6, 2.8], [-1, 6.0], [-6.2, 3.0], [-5, -2.0], [9.4, 1.0]],
};
export const CAMAS = { peter: [1, -3.3, -7.0], bibi: [1, -10.4, 6.6] };
