// Prédio RBTech em 3D: 3 andares e terraço, equipes, Peter e Bibi, elevador, pausas e câmeras.
// Cada personagem existe uma vez só: para trocar de andar, entra na fila do elevador.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AMARELO, PI, caixa, grupo, suave, anguloAlvo, aleatorio, sortear } from './blocos.js';
import {
  ALT, ELEVADOR, montarLoja, montarAgencia, montarVendas, montarTerraco, montarRua, montarElevador,
  PESSOAS_3D, DIANTE_DO_ISRAEL, ESPRESSO, PAUSAS, LUGARES_CAES, CAMAS, REUNIAO,
} from './andares.js';
import { desenharPlacar, desenharMonitor, desenharSeguidores, desenharSaas, desenharBoss } from './telas.js';

const NOMES = {
  gerente_loja: 'Rael · Loja', atendimento: 'Consultor', vendedor: 'Vendedor', posvenda: 'Pós-venda', estoque: 'Estoque',
  chefe: 'Pamella · Tráfego', analista: 'Analista', copywriter: 'Copywriter', roteirista: 'Roteirista', revisor: 'Revisor',
  gerente_crescimento: 'Helena · Crescimento', especialista: 'Especialista', estagiario: 'Estagiário',
  head_vendas: 'Head de vendas', sdr: 'SDR', closer: 'Closer', sucesso: 'Sucesso', produto: 'Produto',
  israel: 'Israel · Boss', peter: 'Peter', bibi: 'Bibi', cliente: 'Cliente',
};
const GESTOR_DE = {
  atendimento: 'gerente_loja', posvenda: 'gerente_loja', estoque: 'gerente_loja',
  analista: 'chefe', copywriter: 'chefe', roteirista: 'chefe', revisor: 'chefe',
  especialista: 'gerente_crescimento', sdr: 'head_vendas', closer: 'head_vendas', sucesso: 'head_vendas', produto: 'head_vendas',
};
const CHEFES = ['gerente_loja', 'chefe', 'gerente_crescimento', 'head_vendas'];

// câmeras: pos/alvo relativos ao andar; limite = até qual andar fica visível
export const CAMERAS = [
  { id: 'predio',      nome: 'CAM 00 · PRÉDIO RBTECH',     botao: 'Prédio',      andar: 0, limite: 3, pos: [34, 22, 42], alvo: [0, 6.5, 0], largura: 1.3, alvoEmPe: [0, 7, 0] },
  { id: 'loja',        nome: 'CAM 01 · LOJA RB TECH',      botao: '1º Loja',     andar: 0, limite: 0, pos: [17, 15, 19], alvo: [0, 0, -0.5], largura: 1.5, alvoEmPe: [0.7, 0, -1] },
  { id: 'balcao',      nome: 'CAM 02 · BALCÃO',            botao: 'Balcão',      andar: 0, limite: 0, pos: [1, 4.6, 4.6], alvo: [0, 1.2, -4.6] },
  { id: 'geral',       nome: 'CAM 03 · AGÊNCIA',           botao: '2º Agência',  andar: 1, limite: 1, pos: [17, 15, 19], alvo: [0, 0, -0.5], largura: 1.5, alvoEmPe: [0.7, 0, -1] },
  { id: 'chefe',       nome: 'CAM 04 · SALA DO TRÁFEGO',   botao: 'Tráfego',     andar: 1, limite: 1, pos: [7.4, 4.4, 2.4], alvo: [8, 1.3, -5.6] },
  { id: 'crescimento', nome: 'CAM 05 · SALA DO CRESCIMENTO', botao: 'Crescimento', andar: 1, limite: 1, pos: [-7.6, 4.4, 2.4], alvo: [-8.2, 1.3, -5.6] },
  { id: 'criacao',     nome: 'CAM 06 · CRIAÇÃO',           botao: 'Criação',     andar: 1, limite: 1, pos: [-6, 4.6, 10.8], alvo: [-6, 1.1, 3] },
  { id: 'analise',     nome: 'CAM 07 · ANÁLISE E INSTAGRAM', botao: 'Análise',   andar: 1, limite: 1, pos: [5.5, 4.8, 12], alvo: [5, 1.1, 4.4] },
  { id: 'vendas',      nome: 'CAM 08 · VENDAS E SAAS',     botao: '3º Vendas',   andar: 2, limite: 2, pos: [17, 15, 19], alvo: [0, 0, -0.5], largura: 1.5, alvoEmPe: [0.7, 0, -1] },
  { id: 'saas',        nome: 'CAM 09 · SISTEMAS',          botao: 'Sistemas',    andar: 2, limite: 2, pos: [4.5, 4.6, 2.2], alvo: [4.5, 1.4, -6] },
  { id: 'terraco',     nome: 'CAM 10 · TERRAÇO E DIRETORIA', botao: 'Terraço',   andar: 3, limite: 3, pos: [15, 13, 15], alvo: [0, 0, -1], largura: 1.4, alvoEmPe: [1, 0, -1] },
  { id: 'boss',        nome: 'CAM 11 · SALA DO ISRAEL',    botao: 'Boss',        andar: 3, limite: 3, pos: [2.5, 4.6, 3.6], alvo: [2.5, 1.2, -5.4] },
  { id: 'caes',        nome: 'CAM 12 · PETER E BIBI',      botao: 'Peter e Bibi', segue: true },
];
const CAM_DE = {
  gerente_loja: 'loja', atendimento: 'balcao', vendedor: 'balcao', posvenda: 'loja', estoque: 'loja',
  chefe: 'chefe', analista: 'analise', copywriter: 'criacao', roteirista: 'criacao', revisor: 'analise',
  gerente_crescimento: 'crescimento', especialista: 'analise', head_vendas: 'vendas', sdr: 'vendas', closer: 'vendas',
  sucesso: 'vendas', produto: 'saas', israel: 'boss',
};

export function criarEscritorio(container, camada) {
  const celular = matchMedia('(max-width: 760px)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, celular ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
  const controles = new OrbitControls(camera, renderer.domElement);
  controles.enableDamping = true;
  controles.maxPolarAngle = 1.45;
  controles.minDistance = 3;
  controles.maxDistance = 160;

  cena.add(new THREE.HemisphereLight(0xfff6e5, 0x3a3226, 1.35));
  const sol = new THREE.DirectionalLight(0xfff1d6, 1.8);
  sol.position.set(16, 34, 18);
  sol.target.position.set(0, 6, 0);
  cena.add(sol.target);
  sol.castShadow = true;
  sol.shadow.mapSize.set(celular ? 1024 : 2048, celular ? 1024 : 2048);
  Object.assign(sol.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 120 });
  sol.shadow.bias = -0.0008;
  sol.shadow.normalBias = 0.03;
  cena.add(sol);

  // ---------- prédio ----------
  montarRua(cena);
  const predio = grupo(0, 0, 0, cena);
  const telas = {};
  const andares = [0, 1, 2, 3].map(i => grupo(0, i * ALT, 0, predio));
  montarLoja(andares[0], telas);
  montarAgencia(andares[1], telas);
  montarVendas(andares[2], telas);
  montarTerraco(andares[3], telas);
  const cabine = montarElevador(predio);
  let limite = 3;

  const relogio = new THREE.Clock();
  const agora = () => relogio.elapsedTime;
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  const entidades = [];

  // ---------- elevador (uma viagem por vez) ----------
  const elevador = { y: 0, alvo: 0, aoChegar: null, fila: Promise.resolve() };
  const moverCabine = andar => new Promise(res => { elevador.alvo = andar * ALT; elevador.aoChegar = res; });
  function viajar(ent, destino) {
    const tarefa = elevador.fila.then(async () => {
      await moverCabine(ent.andar);
      await ent.caminhar([[ELEVADOR.x, ELEVADOR.z]]);
      ent.noElevador = true;
      await esperar(150);
      await moverCabine(destino);
      ent.andar = destino;
      ent.noElevador = false;
      await ent.caminhar([ELEVADOR.porta]);
    });
    elevador.fila = tarefa.catch(() => {});
    return tarefa;
  }

  // ======================================================================
  // Personagem (pessoa ou cachorro): andar, caminhar, ir a qualquer andar
  // ======================================================================
  function Andarilho(ent, velocidade) {
    ent.velocidade = velocidade;
    ent.caminho = [];
    ent.andando = false;
    ent.noElevador = false;
    ent.fala = ''; ent.falaAte = 0; ent.status = '';
    ent.fila = Promise.resolve();
    ent.pendentes = 0;
    ent.trilha = null; // pontos depois do corredor até onde está agora (para voltar pelo mesmo caminho)
    ent.caminhar = pontos => new Promise(res => {
      ent.caminho = pontos.map(([x, z]) => new THREE.Vector3(x, 0, z));
      ent.andando = true;
      ent.aoChegar = res;
    });
    ent.falar = (texto, ms = 2600) => { ent.fala = texto; ent.falaAte = performance.now() + ms; };
    ent.enfileirar = fn => {
      ent.pendentes++;
      ent.fila = ent.fila.then(fn).catch(e => console.error(e)).finally(() => { ent.pendentes--; });
      return ent.fila;
    };
    /** Vai até `destino` (pontos depois do corredor) no andar pedido, usando o elevador se precisar. */
    ent.irPara = async (andar, destino, olhar) => {
      let pts = ent.saida();
      if (andar !== ent.andar) {
        await ent.caminhar([...pts, [11.0, 0], ELEVADOR.porta]);
        await viajar(ent, andar);
        pts = [[11.0, 0]];
      }
      await ent.caminhar([...pts, [destino[0][0], 0], ...destino]);
      ent.trilha = destino;
      ent.emCasa = false;
      if (olhar != null) ent.rotAlvo = olhar;
    };
    /** Pontos para sair de onde está até o corredor. */
    ent.saida = () => {
      if (ent.emCasa && ent.posto) return ent.posto.rota.slice(1);
      if (ent.trilha) return [...ent.trilha.slice(0, -1).reverse(), [ent.trilha[0][0], 0]];
      return [[ent.raiz.position.x, 0]];
    };
    ent.moverPasso = dt => {
      const r = ent.raiz;
      if (!ent.andando || !ent.caminho.length) return false;
      const alvo = ent.caminho[0];
      const dx = alvo.x - r.position.x, dz = alvo.z - r.position.z;
      const dist = Math.hypot(dx, dz);
      const passo = ent.velocidade * dt;
      if (dist <= passo) {
        r.position.x = alvo.x; r.position.z = alvo.z;
        ent.caminho.shift();
        if (!ent.caminho.length) { ent.andando = false; const cb = ent.aoChegar; ent.aoChegar = null; cb?.(); }
      } else {
        r.position.x += (dx / dist) * passo;
        r.position.z += (dz / dist) * passo;
        r.rotation.y = anguloAlvo(r.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 12));
      }
      return true;
    };
    ent.alturaBase = () => (ent.noElevador ? cabine.position.y : ent.andar * ALT);
    ent.textoBalao = () => (ent.fala && performance.now() < ent.falaAte ? ent.fala : ent.status);
  }

  function Pessoa(id, def, opcoes = {}) {
    const p = this;
    const a = def.ap;
    p.id = id;
    p.posto = def.posto;
    p.casa = def.andar;
    p.andar = def.andar;
    p.visita = def.visita;
    p.olharVisita = def.olharVisita;
    p.decor = !!def.decor;
    p.nome = opcoes.nome || NOMES[id] || id;
    p.raiz = new THREE.Group();
    p.raiz.userData.ent = p;
    p.corpo = grupo(0, 0, 0, p.raiz);
    p.digitando = false;
    p.trabalhando = false;
    p.humor = '';
    Andarilho(p, 2.6);
    entidades.push(p);
    predio.add(p.raiz);

    p.pernas = [-0.14, 0.14].map(x => {
      const g = grupo(x, 0.62, 0, p.corpo);
      caixa(0.24, 0.62, 0.28, a.calca, 0, -0.31, 0, g);
      caixa(0.26, 0.12, 0.36, a.sapato, 0, -0.56, 0.04, g);
      return g;
    });
    caixa(0.6, 0.68, 0.34, a.camisa, 0, 0.96, 0, p.corpo);
    if (a.frente) caixa(0.2, 0.6, 0.02, a.frente, 0, 0.99, 0.172, p.corpo);
    if (a.gravata) caixa(0.09, 0.44, 0.02, a.gravata, 0, 0.98, 0.185, p.corpo);
    p.bracos = [-1, 1].map(lado => {
      const g = grupo(lado * 0.39, 1.24, 0, p.corpo);
      caixa(0.18, 0.5, 0.22, a.camisa, 0, -0.24, 0, g);
      caixa(0.16, 0.14, 0.2, a.pele, 0, -0.55, 0, g);
      return g;
    });
    p.cabeca = grupo(0, 1.3, 0, p.corpo);
    const c = p.cabeca;
    caixa(0.6, 0.58, 0.54, a.pele, 0, 0.29, 0, c);
    for (const l of [-1, 1]) caixa(0.09, 0.12, 0.02, 0x1a1a1a, l * 0.13, 0.32, 0.275, c);
    caixa(0.16, 0.04, 0.02, 0x7a3b2e, 0, 0.14, 0.275, c);
    const cab = a.cabelo;
    if (a.penteado === 'curto' || a.penteado === 'coque') {
      caixa(0.64, 0.14, 0.58, cab, 0, 0.6, 0, c);
      caixa(0.64, 0.4, 0.1, cab, 0, 0.42, -0.27, c);
      for (const l of [-1, 1]) caixa(0.06, 0.22, 0.5, cab, l * 0.31, 0.47, -0.02, c);
      if (a.penteado === 'coque') caixa(0.28, 0.28, 0.28, cab, 0, 0.74, -0.22, c);
    } else if (a.penteado === 'longo') {
      caixa(0.64, 0.14, 0.58, cab, 0, 0.6, 0, c);
      caixa(0.66, 0.78, 0.12, cab, 0, 0.24, -0.28, c);
      for (const l of [-1, 1]) caixa(0.07, 0.6, 0.42, cab, l * 0.32, 0.3, -0.06, c);
      caixa(0.6, 0.1, 0.06, cab, 0, 0.53, 0.27, c);
    } else if (a.penteado === 'topete') {
      caixa(0.64, 0.12, 0.58, cab, 0, 0.6, 0, c);
      caixa(0.5, 0.18, 0.2, cab, 0, 0.72, 0.18, c);
      caixa(0.64, 0.36, 0.1, cab, 0, 0.42, -0.27, c);
    }
    if (a.barba) {
      caixa(0.62, 0.18, 0.06, cab, 0, 0.07, 0.27, c);
      for (const l of [-1, 1]) caixa(0.06, 0.28, 0.3, cab, l * 0.31, 0.16, 0.12, c);
      caixa(0.16, 0.04, 0.02, 0x7a3b2e, 0, 0.17, 0.302, c);
    }
    if (a.oculos) {
      caixa(0.52, 0.035, 0.03, 0x111111, 0, 0.39, 0.29, c);
      for (const l of [-1, 1]) caixa(0.19, 0.14, 0.02, 0x9fd0ff, l * 0.13, 0.32, 0.29, c, { transparent: true, opacity: 0.45 });
    }
    if (a.bone) { caixa(0.64, 0.17, 0.58, a.bone, 0, 0.64, 0, c); caixa(0.5, 0.04, 0.3, a.bone, 0, 0.6, -0.42, c); }
    if (a.fone) { caixa(0.68, 0.06, 0.1, 0x111111, 0, 0.75, 0, c); for (const l of [-1, 1]) caixa(0.08, 0.22, 0.22, 0x111111, l * 0.34, 0.38, 0, c); }
    if (opcoes.sacola) { p.sacola = caixa(0.3, 0.32, 0.12, AMARELO, 0.42, 0.62, 0.08, p.corpo); p.sacola.visible = false; }

    p.sentado = () => p.emCasa && !p.posto.empe && !p.andando;
    p.sentarJa = () => {
      const [x, z] = p.posto.assento;
      p.raiz.position.x = x; p.raiz.position.z = z;
      p.raiz.rotation.y = p.posto.olhar;
      p.rotAlvo = p.posto.olhar;
      p.andar = p.casa;
      p.emCasa = true;
      p.trilha = null;
    };
    p.voltarAoPosto = async () => {
      if (p.emCasa) return;
      await p.irPara(p.casa, p.posto.rota.slice().reverse());
      p.sentarJa();
    };
    p.ativo = true;
    p.livre = () => p.pendentes === 0 && !p.trabalhando && !p.decor && p.ativo && !p.ocupadoGestor;
    p.cutucar = () => p.falar(sortear(FRASES[id] || ['Oi! 👋']), 2600);

    p.atualizar = (dt, t) => {
      const r = p.raiz;
      const movendo = p.moverPasso(dt);
      if (!movendo && p.rotAlvo != null && !p.sentado()) r.rotation.y = anguloAlvo(r.rotation.y, p.rotAlvo, Math.min(1, dt * 8));
      const [pe, pd] = p.pernas;
      const [be, bd] = p.bracos;
      const base = p.alturaBase();
      if (movendo) {
        const s = Math.sin(t * 10);
        r.position.y = base;
        pe.rotation.x = s * 0.6; pd.rotation.x = -s * 0.6;
        be.rotation.x = -s * 0.5; bd.rotation.x = s * 0.5;
        p.corpo.position.y = Math.abs(Math.cos(t * 10)) * 0.05;
        p.cabeca.rotation.x = 0;
      } else if (p.sentado()) {
        r.position.y = base - 0.1;
        pe.rotation.x = pd.rotation.x = -PI / 2;
        p.corpo.position.y = 0;
        if (p.digitando) {
          be.rotation.x = -1.15 + Math.sin(t * 18) * 0.08;
          bd.rotation.x = -1.15 + Math.sin(t * 18 + 1.6) * 0.08;
          p.cabeca.rotation.x = 0.12 + Math.sin(t * 2) * 0.03;
        } else if (p.alongando) {
          be.rotation.x = bd.rotation.x = suave(be.rotation.x, -2.9, 0.15);
        } else {
          be.rotation.x = suave(be.rotation.x, -0.5, 0.1);
          bd.rotation.x = suave(bd.rotation.x, -0.5, 0.1);
          p.cabeca.rotation.x = Math.sin(t * 0.7 + r.position.x) * 0.05;
          p.cabeca.rotation.y = Math.sin(t * 0.4 + r.position.x) * 0.25;
        }
      } else {
        r.position.y = base;
        pe.rotation.x = suave(pe.rotation.x, 0, 0.2);
        pd.rotation.x = suave(pd.rotation.x, 0, 0.2);
        const braco = p.alongando ? -2.9 : p.bebendo ? -1.4 : 0;
        be.rotation.x = suave(be.rotation.x, p.digitando ? -1.0 : 0, 0.2);
        bd.rotation.x = suave(bd.rotation.x, p.digitando ? -1.0 : braco, 0.2);
        p.corpo.position.y = Math.sin(t * 2) * 0.01;
        p.cabeca.rotation.x = 0;
      }
      if (p.elHumor && p.elHumor.textContent !== (p.humor ? p.humor + ' ' : '')) p.elHumor.textContent = p.humor ? p.humor + ' ' : '';
    };
  }

  function Cachorro(id) {
    const d = this;
    d.id = id;
    d.cachorro = true;
    d.nome = NOMES[id];
    d.raiz = new THREE.Group();
    d.raiz.userData.ent = d;
    d.corpo = grupo(0, 0, 0, d.raiz);
    d.modo = 'parado';
    Andarilho(d, id === 'peter' ? 2.8 : 2.2);
    entidades.push(d);
    predio.add(d.raiz);
    const [andarCama, cx, cz] = CAMAS[id];
    d.andar = andarCama;
    d.raiz.position.set(cx, 0, cz);

    if (id === 'peter') {
      const ouro = 0xc8914a, escuro = 0x1d1510;
      d.alturaCorpo = 0.55;
      caixa(0.46, 0.42, 1.0, ouro, 0, 0.74, 0, d.corpo);
      caixa(0.47, 0.07, 0.62, 0xa8733a, 0, 0.97, -0.08, d.corpo);
      caixa(0.4, 0.34, 0.28, 0xd8a560, 0, 0.66, 0.42, d.corpo);
      d.pernas = [[-0.15, 0.36], [0.15, 0.36], [-0.15, -0.36], [0.15, -0.36]].map(([x, z]) => {
        const g = grupo(x, 0.58, z, d.corpo);
        caixa(0.13, 0.52, 0.13, ouro, 0, -0.26, 0, g);
        caixa(0.15, 0.08, 0.19, 0x8a5e2c, 0, -0.52, 0.02, g);
        return g;
      });
      caixa(0.3, 0.36, 0.3, ouro, 0, 0.98, 0.5, d.corpo).rotation.x = -0.4;
      caixa(0.34, 0.09, 0.34, AMARELO, 0, 0.95, 0.47, d.corpo).rotation.x = -0.4;
      d.cabeca = grupo(0, 1.14, 0.62, d.corpo);
      caixa(0.36, 0.34, 0.38, ouro, 0, 0, 0, d.cabeca);
      caixa(0.37, 0.12, 0.04, escuro, 0, 0.03, 0.19, d.cabeca);
      caixa(0.22, 0.18, 0.28, escuro, 0, -0.07, 0.3, d.cabeca);
      caixa(0.1, 0.07, 0.05, 0x050505, 0, -0.01, 0.45, d.cabeca);
      for (const l of [-1, 1]) {
        caixa(0.06, 0.06, 0.02, 0xffffff, l * 0.1, 0.07, 0.215, d.cabeca);
        caixa(0.04, 0.04, 0.02, 0x050505, l * 0.1, 0.07, 0.225, d.cabeca);
        caixa(0.11, 0.26, 0.06, escuro, l * 0.12, 0.28, -0.05, d.cabeca).rotation.z = -l * 0.22;
      }
      d.rabo = grupo(0, 0.86, -0.5, d.corpo);
      caixa(0.09, 0.09, 0.5, ouro, 0, 0, -0.25, d.rabo);
      caixa(0.1, 0.1, 0.12, escuro, 0, 0, -0.5, d.rabo);
      d.rabo.rotation.x = 0.7;
    } else {
      const pelo = 0xd8cbb2, cinza = 0xb5a78c, claro = 0xefe6d4;
      d.alturaCorpo = 0.3;
      caixa(0.36, 0.3, 0.6, pelo, 0, 0.44, 0, d.corpo);
      const rnd = aleatorio(7);
      for (let i = 0; i < 18; i++) {
        const s = 0.07 + rnd() * 0.06;
        const lado = rnd() < 0.5 ? -1 : 1;
        const tipo = rnd();
        const x = tipo < 0.45 ? lado * (0.18 + rnd() * 0.02) : (rnd() - 0.5) * 0.34;
        const y = tipo < 0.45 ? 0.32 + rnd() * 0.24 : 0.6 + rnd() * 0.02;
        caixa(s, s, s, rnd() < 0.5 ? cinza : claro, x, y, (rnd() - 0.5) * 0.56, d.corpo);
      }
      d.pernas = [[-0.11, 0.2], [0.11, 0.2], [-0.11, -0.2], [0.11, -0.2]].map(([x, z]) => {
        const g = grupo(x, 0.32, z, d.corpo);
        caixa(0.1, 0.28, 0.1, pelo, 0, -0.14, 0, g);
        caixa(0.12, 0.06, 0.13, cinza, 0, -0.29, 0.01, g);
        return g;
      });
      caixa(0.32, 0.07, 0.3, 0xd7263d, 0, 0.58, 0.27, d.corpo);
      caixa(0.12, 0.12, 0.04, 0xd7263d, 0, 0.5, 0.42, d.corpo);
      d.cabeca = grupo(0, 0.7, 0.36, d.corpo);
      caixa(0.32, 0.3, 0.3, pelo, 0, 0, 0, d.cabeca);
      caixa(0.17, 0.13, 0.15, claro, 0, -0.06, 0.2, d.cabeca);
      caixa(0.08, 0.06, 0.04, 0x111111, 0, -0.01, 0.29, d.cabeca);
      for (const l of [-1, 1]) {
        caixa(0.05, 0.05, 0.02, 0x111111, l * 0.08, 0.05, 0.155, d.cabeca);
        caixa(0.07, 0.22, 0.15, cinza, l * 0.19, -0.02, -0.02, d.cabeca).rotation.z = l * 0.15;
      }
      for (let i = 0; i < 5; i++) caixa(0.075, 0.1, 0.05, i % 2 ? cinza : claro, -0.15 + i * 0.075, 0.12, 0.16, d.cabeca);
      for (let i = 0; i < 3; i++) caixa(0.06, 0.1, 0.05, claro, -0.06 + i * 0.06, -0.15, 0.25, d.cabeca);
      caixa(0.1, 0.08, 0.1, claro, 0, 0.17, 0.02, d.cabeca);
      d.rabo = grupo(0, 0.55, -0.3, d.corpo);
      caixa(0.08, 0.2, 0.08, pelo, 0, 0.1, 0, d.rabo);
      caixa(0.08, 0.08, 0.14, claro, 0, 0.2, 0.06, d.rabo);
      d.rabo.rotation.x = -0.4;
    }
    d.cabecaY = d.cabeca.position.y;
    d.textoBalao = () => (d.fala && performance.now() < d.falaAte ? d.fala : d.modo === 'dormindo' ? 'zzz… 💤' : '');
    d.cutucar = () => {
      d.acordar = true;
      d.falar(sortear(id === 'peter' ? ['Au! 🐾', 'Au au! Vigiando o prédio.', '🦴?', 'Au! Bom trabalho!'] : ['Arf! 🐶', 'Arf arf! Carinho?', 'Cadê meu petisco? 🍖', '*abana o rabo*']));
    };
    d.descansar = async ms => {
      d.acordar = false;
      const fim = performance.now() + ms;
      while (performance.now() < fim && !d.acordar) await esperar(250);
      if (d.modo === 'dormindo' || d.modo === 'sentado') d.modo = 'parado';
    };
    // a vida do cachorro: passear, dormir, visitar outros andares
    (async function vida() {
      await esperar(1500 + Math.random() * 3000);
      for (;;) {
        try {
          const r = Math.random();
          if (r < 0.15) {
            const [aC, x, z] = CAMAS[id];
            d.modo = 'andando';
            await d.irPara(aC, [[x, z]]);
            d.modo = 'dormindo';
            await d.descansar(15000 + Math.random() * 20000);
          } else if (r < 0.3) {
            const outro = sortear([0, 1, 2, 3].filter(a => a !== d.andar));
            d.modo = 'andando';
            await d.irPara(outro, [sortear(LUGARES_CAES[outro])]);
            d.falar(id === 'peter' ? 'Au! Cheguei 🐾' : 'Arf! Oi gente 🐶', 2000);
            d.modo = 'parado';
            await d.descansar(4000 + Math.random() * 5000);
          } else if (r < 0.75) {
            d.modo = 'andando';
            await d.irPara(d.andar, [sortear(LUGARES_CAES[d.andar])]);
            d.modo = Math.random() < 0.5 ? 'sentado' : 'parado';
            if (Math.random() < 0.3) d.falar(id === 'peter' ? 'Au!' : 'Arf!', 1400);
            await d.descansar(3000 + Math.random() * 6000);
          } else {
            d.modo = 'sentado';
            await d.descansar(3000 + Math.random() * 4000);
          }
        } catch (e) { console.error(e); await esperar(3000); }
      }
    })();

    d.atualizar = (dt, t) => {
      const r = d.raiz;
      const movendo = d.moverPasso(dt);
      r.position.y = d.alturaBase();
      const ritmo = id === 'peter' ? 11 : 15;
      d.pernas.forEach((g, i) => {
        const fase = i === 0 || i === 3 ? 0 : PI;
        g.rotation.x = movendo ? Math.sin(t * ritmo + fase) * 0.55 : suave(g.rotation.x, 0, 0.2);
      });
      const modo = movendo ? 'andando' : d.modo;
      let alvoY = 0, alvoPitch = 0;
      if (modo === 'sentado') { alvoPitch = -0.35; alvoY = -d.alturaCorpo * 0.22; }
      if (modo === 'dormindo') alvoY = -d.alturaCorpo * 0.78;
      d.corpo.position.y = suave(d.corpo.position.y, alvoY + (movendo ? Math.abs(Math.sin(t * ritmo)) * 0.03 : 0), 0.15);
      d.corpo.rotation.x = suave(d.corpo.rotation.x, alvoPitch, 0.12);
      if (modo === 'sentado') { d.pernas[2].rotation.x = d.pernas[3].rotation.x = -1.2; d.pernas[0].rotation.x = d.pernas[1].rotation.x = 0.35; }
      d.cabeca.position.y = suave(d.cabeca.position.y, d.cabecaY - (modo === 'dormindo' ? d.alturaCorpo * 0.45 : 0), 0.1);
      if (modo === 'dormindo') {
        d.pernas.forEach((g, i) => { g.rotation.x = i < 2 ? -1.4 : 1.4; });
        d.cabeca.rotation.x = suave(d.cabeca.rotation.x, 0.75, 0.1);
        d.corpo.scale.y = 1 + Math.sin(t * 2) * 0.03;
      } else {
        d.corpo.scale.y = 1;
        d.cabeca.rotation.x = suave(d.cabeca.rotation.x, Math.sin(t * 1.3) * 0.08, 0.1);
        d.cabeca.rotation.z = Math.sin(t * 0.9 + (id === 'bibi' ? 2 : 0)) * (modo === 'parado' ? 0.18 : 0.04);
      }
      d.rabo.rotation.y = modo !== 'dormindo' ? Math.sin(t * (d.fala && performance.now() < d.falaAte ? 26 : 9)) * 0.55 : 0;
    };
  }

  // ---------- quem está no prédio ----------
  const pessoas = {};
  for (const [id, def] of Object.entries(PESSOAS_3D)) {
    pessoas[id] = new Pessoa(id, def);
    pessoas[id].sentarJa();
  }
  pessoas.estagiario.ativo = false;
  const caes = { peter: new Cachorro('peter'), bibi: new Cachorro('bibi') };

  // clientes da loja entrando pela rua
  const CLIENTES = [
    { pele: 0xf0c8a0, cabelo: 0x3a2618, penteado: 'longo', camisa: 0x3b6fd6, calca: 0x2d3446, sapato: 0xffffff },
    { pele: 0x8d5a3b, cabelo: 0x111111, penteado: 'curto', camisa: 0xff8a3d, calca: 0x30343c, sapato: 0x222222 },
    { pele: 0xe8b48a, cabelo: 0xd4a017, penteado: 'coque', camisa: 0x9b6bd1, calca: 0x1c1c1c, sapato: 0xf2f2f2 },
  ];
  const clientes = CLIENTES.map((apar, i) => {
    const c = new Pessoa('cliente', { ap: apar, andar: 0, decor: true, posto: { assento: [0, 10.6], olhar: PI, empe: true, rota: [[0, 10.6], [0, 0]] } }, { sacola: true, nome: 'Cliente' });
    c.ativo = false;
    c.indice = i;
    return c;
  });
  clientes.forEach(c => (async () => {
    await esperar(2000 + c.indice * 6000);
    for (;;) {
      try { await visitaDeCliente(c); } catch (e) { console.error(e); }
      c.ativo = false;
      await esperar(4000 + Math.random() * 9000);
    }
  })());
  async function visitaDeCliente(c) {
    const sx = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 6);
    c.raiz.position.set(sx, 0, 10.8);
    c.sacola.visible = false;
    c.emCasa = false; c.trilha = null; c.andar = 0;
    c.ativo = true;
    const lado = Math.random() < 0.5 ? -1 : 1;
    const vit = lado * 4 + (Math.random() - 0.5) * 2.2;
    await c.caminhar([[sx, 9.0], [lado * 1.4, 6.6], [vit, 3.45]]);
    c.rotAlvo = PI;
    c.falar(sortear(['😍 olha esse!', '📱 que cor linda', '🤔 qual eu levo?']), 2400);
    await esperar(2800);
    const vendedor = lado < 0 ? pessoas.atendimento : pessoas.vendedor;
    const bx = vendedor.posto.assento[0] + (c.indice - 1) * 0.5;
    await c.caminhar([[lado * 1.6, 3.45], [lado * 1.6, 0], [bx, -3.6]]);
    c.rotAlvo = PI;
    c.falar(sortear(['Tem o 15 em azul?', 'Quero trocar meu celular', 'Como está a bateria desse?', 'Posso ver o Pro?']), 2600);
    await esperar(1400);
    if (vendedor.emCasa && !vendedor.andando) vendedor.falar(sortear(['Tenho sim! 📦', 'Bora ver! 📱', 'Te mostro já! ✨', 'Faço uma avaliação do seu 🔎']), 2600);
    await esperar(3200);
    if (Math.random() < 0.7) {
      await c.caminhar([[bx, -2.6], [7.9, -2.6], [7.9, -4.2]]);
      c.rotAlvo = PI / 2;
      c.falar(sortear(['💳 Pix!', '💳 no cartão', '🛍️ vou levar!']), 2400);
      await esperar(1200);
      if (pessoas.posvenda.emCasa && !pessoas.posvenda.andando) pessoas.posvenda.falar(sortear(['⭐ Avalia a gente no Google?', '🎁 Indica um amigo!', '💛 Obrigado!']), 2600);
      c.sacola.visible = true;
      await esperar(2600);
      c.falar('🛍️ Valeu, RB Tech!', 2200);
      await c.caminhar([[7.9, -2.6], [6.2, 0], [6.2, 6.6], [6.2, 9.0], [sx, 10.8]]);
    } else {
      c.falar('Vou pensar 🤔', 2000);
      await c.caminhar([[bx, -2.6], [0.3, 0], [0.3, 6.6], [0.3, 9.0], [sx, 10.8]]);
    }
  }

  // ---------- balões e etiquetas ----------
  for (const e of entidades) {
    const el = document.createElement('div');
    el.className = 'ent' + (e.cachorro ? ' ent-cao' : '') + (e.id === 'israel' ? ' ent-boss' : '') + (e.id === 'cliente' ? ' ent-cliente' : '');
    el.innerHTML = `<div class="balao vazio"></div><div class="tag"><span class="tag-humor"></span>${e.nome}</div>`;
    camada.appendChild(el);
    e.el = el;
    e.elBalao = el.querySelector('.balao');
    e.elHumor = el.querySelector('.tag-humor');
  }
  const andarVisual = e => (e.noElevador ? Math.floor(cabine.position.y / ALT + 0.01) : e.andar);
  const visivel = e => e.ativo !== false && andarVisual(e) <= limite;

  // ---------- telas ----------
  const MONITORES = ['gerente_loja', 'estoque', 'chefe', 'analista', 'copywriter', 'roteirista', 'revisor', 'gerente_crescimento', 'especialista', 'head_vendas', 'sdr', 'closer', 'sucesso', 'produto', 'israel'];
  const estadoTela = Object.fromEntries(MONITORES.map(k => [k, { modo: 'livre', desde: 0 }]));
  const telaModo = (papel, modo) => { if (estadoTela[papel]) estadoTela[papel] = { modo, desde: agora() }; };
  let sinos = 0, cafesDoBoss = 0, pendentesBoss = 0, reunioes = 0;

  // ---------- câmeras ----------
  let camAtual = CAMERAS[0];
  let transicao = null;
  let caoSeguido = 'bibi';
  let ultimoAspecto = 0;
  const fator = cam => Math.max(1, (cam.largura ?? 0.8) / camera.aspect);
  function aplicarLimite(n) {
    limite = n;
    andares.forEach((g, i) => {
      g.visible = i <= n;
      if (g.userData.fachada) g.userData.fachada.visible = i < n;
    });
  }
  function posicaoCamera(cam) {
    if (cam.segue) {
      const d = caes[caoSeguido];
      const m = d.raiz.position;
      const alvo = new THREE.Vector3(m.x, m.y + 0.5, m.z);
      return [alvo.clone().add(new THREE.Vector3(2.4, 2.6, 3.8).multiplyScalar(fator(cam))), alvo];
    }
    const dy = (cam.andar || 0) * ALT;
    const alvo = new THREE.Vector3(cam.alvo[0], cam.alvo[1] + (cam.id === 'predio' ? 0 : dy), cam.alvo[2]);
    const off = new THREE.Vector3(cam.pos[0] - cam.alvo[0], cam.pos[1] - cam.alvo[1], cam.pos[2] - cam.alvo[2]).multiplyScalar(fator(cam));
    if (cam.alvoEmPe && camera.aspect < 0.8) alvo.set(cam.alvoEmPe[0], cam.alvoEmPe[1] + (cam.id === 'predio' ? 0 : dy), cam.alvoEmPe[2]);
    return [alvo.clone().add(off), alvo];
  }
  function irParaCamera(id, instantaneo = false) {
    const cam = CAMERAS.find(c => c.id === id) || CAMERAS[0];
    if (cam.segue && cam !== camAtual) {
      const acordados = ['peter', 'bibi'].filter(k => caes[k].modo !== 'dormindo');
      caoSeguido = acordados.length === 1 ? acordados[0] : caoSeguido === 'bibi' ? 'peter' : 'bibi';
    }
    camAtual = cam;
    aplicarLimite(cam.segue ? caes[caoSeguido].andar : cam.limite);
    const [pos, alvo] = posicaoCamera(cam);
    if (instantaneo) { camera.position.copy(pos); controles.target.copy(alvo); transicao = null; }
    else transicao = { t: 0, de: camera.position.clone(), deAlvo: controles.target.clone(), para: pos, paraAlvo: alvo };
    return cam;
  }
  function redimensionar() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (Math.abs(camera.aspect - ultimoAspecto) > 0.05) { ultimoAspecto = camera.aspect; irParaCamera(camAtual.id, true); }
  }
  new ResizeObserver(redimensionar).observe(container);
  redimensionar();
  irParaCamera('predio', true);

  // ---------- cliques ----------
  const raio = new THREE.Raycaster();
  const ponteiro = new THREE.Vector2();
  let toqueInicio = null;
  renderer.domElement.addEventListener('pointerdown', e => { toqueInicio = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!toqueInicio || Math.hypot(e.clientX - toqueInicio[0], e.clientY - toqueInicio[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ponteiro.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raio.setFromCamera(ponteiro, camera);
    const hits = raio.intersectObjects(entidades.filter(visivel).map(x => x.raiz), true);
    if (!hits.length) return;
    let o = hits[0].object;
    while (o && !o.userData.ent) o = o.parent;
    o?.userData.ent.cutucar();
  });

  // ======================================================================
  // Vida no prédio: pausas, café, conversa, lazer no terraço (sempre em movimento)
  // ======================================================================
  async function pausa(p) {
    const r = Math.random();
    if (p.id === 'israel') return pausaDoBoss(p);
    if (r < 0.3) { // digitar um pouco (trabalho de rotina)
      p.digitando = true; telaModo(p.id, 'trabalhando');
      await esperar(6000 + Math.random() * 6000);
      p.digitando = false; telaModo(p.id, 'livre');
      return;
    }
    if (r < 0.4 && p.sentado()) { p.alongando = true; p.falar('🙆 alongando', 2200); await esperar(2400); p.alongando = false; return; }
    if (r < 0.55) return conversar(p);
    // pausa: copa do andar ou lazer no terraço
    const andar = Math.random() < 0.4 ? 3 : p.casa;
    const lugar = sortear(PAUSAS[andar]);
    const caminho = lugar.c || [[lugar.p[0], 0], lugar.p];
    await p.irPara(andar, caminho, lugar.o);
    p.bebendo = lugar.f[0].startsWith('☕');
    p.falar(sortear(lugar.f), 3000);
    await esperar(3500 + Math.random() * 3500);
    p.bebendo = false;
    await p.voltarAoPosto();
  }
  async function pausaDoBoss(p) {
    if (Math.random() < 0.65) { // viciado em café
      await p.caminhar(ESPRESSO.ida);
      p.emCasa = false; p.rotAlvo = ESPRESSO.olhar;
      p.falar(sortear(['☕ mais um espresso…', '☕ só mais um', '☕ café é vida', '☕ duplo, por favor']), 2800);
      p.bebendo = true;
      await esperar(3500);
      p.bebendo = false;
      cafesDoBoss++;
      desenharBoss(telas.boss, pendentesBoss, cafesDoBoss);
      await p.caminhar(ESPRESSO.volta);
      p.sentarJa();
      if (cafesDoBoss % 3 === 0) p.falar(`☕ ${cafesDoBoss}º café de hoje!`, 2600);
      return;
    }
    if (Math.random() < 0.5) { p.digitando = true; telaModo('israel', 'trabalhando'); await esperar(7000); p.digitando = false; telaModo('israel', 'livre'); return; }
    const lugar = sortear(PAUSAS[3]);
    await p.irPara(3, lugar.c || [[lugar.p[0], 0], lugar.p], lugar.o);
    p.falar(sortear(['😎 tudo sob controle', '🏙️ olhando o prédio', ...lugar.f]), 2800);
    await esperar(3500);
    await p.voltarAoPosto();
  }
  async function conversar(p) {
    const colegas = Object.values(pessoas).filter(q => q !== p && q.andar === p.andar && q.casa === p.casa && q.livre() && q.sentado()
      && q.posto.rota.length === 3 && q.posto.rota[1][0] === q.posto.rota[2][0]);
    if (!colegas.length) return;
    const q = sortear(colegas);
    const [sx, sz] = q.posto.rota[1];
    await p.irPara(p.casa, [[sx, 0], [sx, sz]], Math.atan2(q.posto.assento[0] - sx, q.posto.assento[1] - sz));
    p.falar(sortear(['💬 viu o reels de ontem?', '💬 me ajuda numa ideia?', '💬 bora almoçar?', '💬 o chefe gostou!', '💬 café depois?']), 2600);
    await esperar(2200);
    q.falar(sortear(['😂 vi sim!', '👍 bora!', '🤔 deixa eu ver…', '☕ fechado!']), 2400);
    await esperar(2600);
    await p.voltarAoPosto();
  }
  async function acaoDoAndar(p) {
    // ações típicas de cada andar
    if (p.casa === 2 && ['sdr', 'closer', 'sucesso'].includes(p.id)) {
      if (Math.random() < 0.18) {
        await p.irPara(2, [[3.6, 0], [3.6, -1.0]], PI);
        p.falar('🔔 VENDEU!', 2600);
        for (const q of Object.values(pessoas)) if (q.casa === 2 && q !== p && q.emCasa) q.falar('👏👏', 1800);
        sinos++; desenharSaas(telas.saas, sinos);
        await esperar(2400);
        return p.voltarAoPosto();
      }
      p.falar(sortear(['📞 Alô! Aqui é da RBTech…', '📞 posso te mostrar o Sorteia Aí?', '📞 te mando a proposta!', '✍️ anotando no CRM']), 3200);
      p.digitando = true; telaModo(p.id, 'trabalhando'); await esperar(5000); p.digitando = false; telaModo(p.id, 'livre');
      return;
    }
    if (p.id === 'produto' && Math.random() < 0.5) {
      await p.irPara(2, [[10.2, 0], [10.2, -5.6]], PI);
      p.falar('🛠️ checando o servidor', 2400);
      await esperar(2800);
      p.falar('✅ Sorteia Aí no ar', 2400);
      await esperar(1500);
      return p.voltarAoPosto();
    }
    if (p.id === 'estoque' && Math.random() < 0.5) {
      await p.irPara(0, [[-10.6, 0], [-10.6, -5.6]], -PI / 2);
      p.falar('📦 conferindo a prateleira', 2600);
      await esperar(3000);
      return p.voltarAoPosto();
    }
    if ((p.id === 'atendimento') && Math.random() < 0.5) {
      const [x, z] = p.posto.assento;
      await p.caminhar([[x, -7.3]]); p.emCasa = false; p.rotAlvo = PI;
      p.falar('📦 buscando um aparelho', 2200);
      await esperar(2400);
      await p.caminhar([[x, z]]); p.sentarJa();
      return;
    }
    return pausa(p);
  }
  setInterval(() => {
    if (reunioes > 0) return; // elevador livre para os chefes durante a reunião
    let comecaram = 0;
    for (const p of Object.values(pessoas)) {
      if (comecaram >= 3 || !p.livre()) continue;
      if ((p.proxima ?? 0) > performance.now()) continue;
      p.proxima = performance.now() + 14000 + Math.random() * 22000;
      if (Math.random() < 0.5) continue;
      comecaram++;
      p.enfileirar(() => acaoDoAndar(p));
    }
  }, 2500);
  // o vendedor de enfeite também se mexe
  setInterval(() => {
    const v = pessoas.vendedor;
    if (v.pendentes || Math.random() < 0.5) return;
    v.enfileirar(async () => {
      const [x, z] = v.posto.assento;
      await v.caminhar([[x, -7.3]]); v.emCasa = false; v.rotAlvo = PI;
      v.falar('📦 pegando no estoque', 2000);
      await esperar(2200);
      await v.caminhar([[x, z]]); v.sentarJa();
    });
  }, 12000);

  // ---------- laço de animação ----------
  let ultimoDesenho = 0;
  function quadro() {
    const dt = Math.min(relogio.getDelta(), 0.05);
    const t = relogio.elapsedTime;
    // elevador
    if (Math.abs(cabine.position.y - elevador.alvo) > 0.01) {
      const passo = 9 * dt;
      const d = elevador.alvo - cabine.position.y;
      cabine.position.y += Math.sign(d) * Math.min(Math.abs(d), passo);
    } else if (elevador.aoChegar) { cabine.position.y = elevador.alvo; const cb = elevador.aoChegar; elevador.aoChegar = null; cb(); }
    for (const e of entidades) { e.raiz.visible = visivel(e); e.atualizar(dt, t); }
    if (telas.leds) telas.leds.forEach((l, i) => { l.visible = Math.sin(t * 3 + i * 1.7) > -0.6; });

    if (transicao) {
      transicao.t = Math.min(1, transicao.t + dt / 1.3);
      const k = transicao.t < 0.5 ? 2 * transicao.t ** 2 : 1 - (-2 * transicao.t + 2) ** 2 / 2;
      camera.position.lerpVectors(transicao.de, transicao.para, k);
      controles.target.lerpVectors(transicao.deAlvo, transicao.paraAlvo, k);
      if (transicao.t >= 1) transicao = null;
    } else if (camAtual.segue) {
      const [pos, alvo] = posicaoCamera(camAtual);
      camera.position.lerp(pos, 0.03);
      controles.target.lerp(alvo, 0.05);
      const a = caes[caoSeguido].noElevador ? 3 : caes[caoSeguido].andar;
      if (a !== limite) aplicarLimite(a);
    }
    controles.update();
    if (t - ultimoDesenho > 0.25) {
      ultimoDesenho = t;
      for (const papel of MONITORES) {
        const tela = telas[papel];
        if (!tela) continue;
        const st = estadoTela[papel];
        if (st.modo === 'livre' && tela.desenhado === 'livre') continue;
        desenharMonitor(tela, papel, st.modo, t - st.desde);
        tela.desenhado = st.modo;
      }
    }
    renderer.render(cena, camera);
    posicionarBaloes();
    requestAnimationFrame(quadro);
  }
  const v = new THREE.Vector3();
  function posicionarBaloes() {
    const w = container.clientWidth, h = container.clientHeight;
    const foco = camAtual.id === 'predio' ? null : camAtual.segue ? caes[caoSeguido].andar : camAtual.andar;
    for (const e of entidades) {
      if (!visivel(e) || (foco != null && andarVisual(e) !== foco && !e.noElevador)) { e.el.style.display = 'none'; continue; }
      e.raiz.getWorldPosition(v);
      v.y += e.cachorro ? (e.id === 'peter' ? 1.75 : 1.15) - (e.modo === 'dormindo' ? 0.6 : 0) : e.sentado?.() ? 2.05 : 2.2;
      v.project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.25 || Math.abs(v.y) > 1.25) { e.el.style.display = 'none'; continue; }
      e.el.style.display = '';
      e.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
      const texto = e.textoBalao();
      if (texto !== e._ultimoTexto) { e._ultimoTexto = texto; e.elBalao.textContent = texto || ''; e.elBalao.classList.toggle('vazio', !texto); }
    }
  }
  requestAnimationFrame(quadro);

  // ======================================================================
  // API usada pelo app
  // ======================================================================
  const resumo = s => (s.length > 44 ? s.slice(0, 42) + '…' : s);
  const api = {
    versao: 2,
    cameras: CAMERAS,
    irParaCamera,
    cameraAtual: () => camAtual,
    cameraDe: papel => CAM_DE[papel] || 'predio',

    gestor(g, estado) {
      const c = pessoas[g];
      if (!c) return;
      const textos = { pensando: '🤔 planejando…', esperando: '⏳ esperando a equipe', relatorio: '📝 escrevendo o relatório', livre: '', pronto: '✅ relatório pronto!' };
      c.status = textos[estado] ?? '';
      c.ocupadoGestor = estado === 'pensando' || estado === 'esperando' || estado === 'relatorio';
      c.digitando = estado === 'pensando' || estado === 'relatorio';
      telaModo(g, c.digitando ? 'trabalhando' : 'livre');
      if (estado === 'pronto') setTimeout(() => { if (c.status.startsWith('✅')) c.status = ''; }, 6000);
      if (c.ocupadoGestor && !c.emCasa && !c.pendentes) c.enfileirar(() => c.voltarAoPosto());
    },
    fala(g, texto) { pessoas[g]?.falar(resumo(texto), 3500); },
    acionar(papel, gestor, texto, tarefa) {
      const p = pessoas[papel];
      const c = pessoas[gestor || GESTOR_DE[papel]];
      if (!p || !c) return;
      c.falar(`📣 ${NOMES[papel]}, vem cá!`, 2200);
      p.enfileirar(async () => {
        p.status = '';
        p.falar('Indo! 🏃', 1500);
        if (p.visita) await p.irPara(p.casa, p.visita, p.olharVisita);
        c.falar(texto, 3200);
        p.falar('Entendido! 👍', 2600);
        await esperar(2600);
        await p.voltarAoPosto();
        p.trabalhando = true;
        p.digitando = true;
        p.status = tarefa || '💻 trabalhando';
        telaModo(papel, 'trabalhando');
      });
    },
    entregar(papel, codigo) {
      const p = pessoas[papel];
      if (!p) return;
      p.enfileirar(async () => {
        p.digitando = false; p.status = '';
        telaModo(papel, 'pronto');
        p.falar('✅ Pronto!', 1600);
        await esperar(900);
        if (p.visita) await p.irPara(p.casa, p.visita, p.olharVisita);
        p.falar(`📄 Entrega ${codigo}`, 2600);
        pessoas[GESTOR_DE[papel]]?.falar('Valeu! 👍', 2000);
        await esperar(2200);
        await p.voltarAoPosto();
        p.trabalhando = false;
        setTimeout(() => { if (estadoTela[papel]?.modo === 'pronto') telaModo(papel, 'livre'); }, 8000);
      });
    },
    erro(papel) {
      const p = pessoas[papel];
      if (!p) return;
      p.enfileirar(async () => { p.digitando = false; p.trabalhando = false; p.status = ''; telaModo(papel, 'livre'); p.falar('⚠️ Deu erro aqui', 3000); });
    },
    consultar(papel, tipo) {
      const p = pessoas[papel];
      if (!p) return;
      p.falar(tipo.includes('posts') ? '📱 lendo os posts…' : tipo.includes('instagram') ? '📈 lendo o Instagram…' : '📊 lendo o Meta Ads…', 4000);
      telaModo(papel, 'trabalhando');
    },
    /** O chefe sobe de elevador até a sala do Israel com a decisão e volta. */
    levarDecisao(g, codigo) {
      const c = pessoas[g];
      const boss = pessoas.israel;
      if (!c) return;
      c.enfileirar(async () => {
        const status = c.status;
        c.status = `🏛️ levando ${codigo} ao Israel`;
        const x = DIANTE_DO_ISRAEL[g] ?? 2.5;
        await c.irPara(3, [[x, 0], [x, -3.6]], PI);
        c.falar(`📄 Decisão ${codigo} pra auditoria`, 2800);
        boss.falar(sortear(['🔍 vou auditar', '☕ deixa aí, já olho', '🧐 hmm, interessante']), 2800);
        await esperar(3000);
        c.status = status;
        await c.voltarAoPosto();
      });
    },
    auditada(id, status) {
      pessoas.israel.falar(status === 'aprovada' ? `✅ ${id} aprovada!` : `❌ ${id} recusada`, 3200);
    },
    definirDecisoesPendentes(n) {
      pendentesBoss = n;
      desenharBoss(telas.boss, n, cafesDoBoss);
      pessoas.israel.status = n ? `📥 ${n} para auditar` : '';
    },
    comemorar(g) {
      pessoas[g]?.falar('📝 Relatório pronto!', 3500);
      for (const d of Object.values(caes)) if (d.andar === pessoas[g]?.andar) { d.acordar = true; d.falar(d.id === 'peter' ? 'Au au! 🎉' : 'Arf arf! 🎉', 2600); }
    },
    definirPlacar(dados, humor) {
      desenharPlacar(telas.placar, dados, humor);
      const icones = { confiante: '😎', normal: '🙂', alerta: '😬', incendio: '🔥' };
      pessoas.chefe.humor = icones[humor?.id] || '';
      pessoas.estagiario.ativo = (dados?.diasNaMeta ?? 0) >= 10;
    },
    definirSeguidores(info) { desenharSeguidores(telas.seguidores, info); },
    /** O Israel convoca: os chefes sobem para a mesa de reunião do terraço. */
    reuniao(participantes) {
      for (const id of [...participantes, 'israel']) {
        const p = pessoas[id];
        const lugar = REUNIAO[id];
        if (!p || !lugar) continue;
        p.naReuniao = true;
        reunioes++;
        p.enfileirar(async () => {
          if (id !== 'israel') p.falar('🏛️ subindo pra reunião', 2200);
          await p.irPara(3, [[lugar[0], 0], [lugar[0], lugar[1]]], lugar[2]);
          if (id === 'israel') p.falar('☕ Bora começar a reunião!', 3000);
          const chegou = performance.now();
          while (p.naReuniao || performance.now() - chegou < 9000) await esperar(500);
          await p.voltarAoPosto();
          reunioes--;
        });
      }
    },
    fimReuniao() {
      pessoas.israel.falar('👏 Reunião encerrada!', 3000);
      for (const p of Object.values(pessoas)) p.naReuniao = false;
    },
    /** Mostra o que a equipe fez numa rotina enquanto o app estava fechado. */
    reviverRotina(r) {
      for (const e of r.entregas || []) {
        api.acionar(e.papel, r.gestor, '📋 rotina do dia', '💻 rotina do dia');
        api.entregar(e.papel, e.id);
      }
      for (const d of r.decisoes || []) api.levarDecisao(r.gestor, d.id);
    },
    foto() { renderer.render(cena, camera); return renderer.domElement.toDataURL('image/png'); },
  };
  document.fonts?.ready.then(() => { desenharBoss(telas.boss, pendentesBoss, cafesDoBoss); desenharSaas(telas.saas, sinos); });
  return api;
}

const FRASES = {
  gerente_loja: ['Loja cheia hoje! 🛍️', 'Bora bater a meta 💪', 'Cadê o estoque do 15? 📦'],
  atendimento: ['Posso ajudar? 😊', 'Esse sai muito! 📱', 'Te passo no WhatsApp 💬'],
  vendedor: ['Olha esse azul! 💙', 'Bateria 100% 🔋'],
  posvenda: ['Avalia a gente! ⭐', 'Cliente feliz volta 💛'],
  estoque: ['Chegou mercadoria! 📦', 'IMEI conferido ✅'],
  chefe: ['Bora vender iPhone! 📈', 'Cadê o revisor? 👀', 'Meta do dia batida?'],
  analista: ['O CTR subiu! 📊', 'Planilha é vida.'],
  copywriter: ['Tenho um gancho novo ✍️', 'Primeira frase é tudo.'],
  roteirista: ['3 segundos pra prender! 🎬', 'Corta pro card amarelo!'],
  revisor: ['Preço confere? 🔎', 'Isso o Meta reprova.'],
  gerente_crescimento: ['Bora crescer! 📈', 'Engajamento é rei 👑'],
  especialista: ['Esse reels bombou! 🔥', 'Salvamentos subindo 📌'],
  estagiario: ['Primeiro dia! 😅', 'Onde fica o café?'],
  head_vendas: ['Funil cheio! 🎯', 'Quem fechou hoje?'],
  sdr: ['Mais um lead! 🎯', 'Agendei uma demo 📅'],
  closer: ['Proposta enviada 🤝', 'Fechou! 🔔'],
  sucesso: ['Cliente ativado ✅', 'Zero cancelamento 💛'],
  produto: ['Deploy feito 🚀', 'Bug resolvido 🐛'],
  israel: ['☕ cadê meu café?', 'Mostra os números 📊', 'Aprovado… talvez 🧐', 'O prédio tá voando! 🚀'],
  cliente: ['Só olhando 👀', 'Quero um iPhone! 📱'],
};
