// Prédio RBTech em 3D: 3 andares e terraço, equipes, Peter e Bibi, elevador, pausas e câmeras.
// Cada personagem existe uma vez só: para trocar de andar, entra na fila do elevador.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { AMARELO, PI, caixa, grupo, suave, anguloAlvo, aleatorio, sortear } from './blocos.js';
import {
  ALT, ELEVADOR, montarLoja, montarAgencia, montarVendas, montarTerraco, montarRua, montarElevador,
  PESSOAS_3D, DIANTE_DO_ISRAEL, ESPRESSO, PAUSAS, LUGARES_CAES, CAMAS, REUNIAO,
} from './andares.js';
import { desenharPlacar, desenharMonitor, desenharSeguidores, desenharSaas, desenharBoss, desenharTv, desenharTag } from './telas.js';

const NOMES = {
  gerente_loja: 'Rael · Loja', atendimento: 'Atendimento', tecnico: 'Técnico',
  chefe: 'Pamella · Tráfego', analista: 'Analista', copywriter: 'Copywriter', roteirista: 'Roteirista', revisor: 'Revisor',
  gerente_crescimento: 'Helena · Crescimento', especialista: 'Especialista', estagiario: 'Estagiário', estrategista_saas: 'Estrategista SaaS',
  head_vendas: 'Head de vendas', sdr: 'SDR', closer: 'Closer', sucesso: 'Sucesso', produto: 'Produto',
  israel: 'Israel · Boss', peter: 'Peter', bibi: 'Bibi', cliente: 'Cliente',
};
const GESTOR_DE = {
  atendimento: 'gerente_loja', tecnico: 'gerente_loja',
  analista: 'chefe', copywriter: 'chefe', roteirista: 'chefe', revisor: 'chefe', estrategista_saas: 'chefe',
  especialista: 'gerente_crescimento', sdr: 'head_vendas', closer: 'head_vendas', sucesso: 'head_vendas', produto: 'head_vendas',
};
const CHEFES = ['gerente_loja', 'chefe', 'gerente_crescimento', 'head_vendas'];

// câmeras: pos/alvo relativos ao andar; limite = até qual andar fica visível
// câmeras por setor. pos/alvo relativos ao andar (abs: em coordenadas do prédio); limite = até qual andar fica visível
export const SETORES = [
  { id: 'predio', nome: 'Prédio' }, { id: 'loja', nome: '1º Loja' }, { id: 'agencia', nome: '2º Agência' },
  { id: 'vendas', nome: '3º Vendas' }, { id: 'terraco', nome: 'Terraço' }, { id: 'caes', nome: 'Peter e Bibi' },
];
const C = (setor, id, botao, andar, pos, alvo, extra = {}) => ({ setor, id, botao, nome: botao.toUpperCase(), andar, limite: andar, pos, alvo, ...extra });
export const CAMERAS = [
  // prédio por fora
  C('predio', 'predio', 'Fachada', 0, [34, 22, 42], [0, 6.5, 0], { abs: true, limite: 3, largura: 1.3, alvoEmPe: [0, 7, 0], nome: 'PRÉDIO RBTECH' }),
  C('predio', 'predio_rua', 'Da rua', 0, [5, 1.6, 23], [1, 5.5, 0], { abs: true, limite: 3, largura: 1.1 }),
  C('predio', 'predio_lateral', 'Lateral e elevador', 0, [32, 9, -8], [7, 6.5, -1], { abs: true, limite: 3, largura: 1.2 }),
  C('predio', 'predio_aerea', 'Aérea', 0, [6, 50, 20], [0, 7, 0], { abs: true, limite: 3, largura: 1.2 }),
  C('predio', 'bairro', 'Bairro (Colônia Santana)', 0, [170, 140, 290], [0, 6, 0], { abs: true, limite: 3, largura: 1.2 }),
  C('predio', 'sc281', 'Chegando pela SC-281', 0, [-64, 2.2, 22.6], [0, 5.5, 6], { abs: true, limite: 3, largura: 1.1 }),
  // 1º andar · loja
  C('loja', 'loja', 'Visão geral', 0, [17, 15, 19], [0, 0, -0.5], { largura: 1.5, alvoEmPe: [0.7, 0, -1], nome: 'LOJA RB TECH' }),
  C('loja', 'loja_porta', 'Entrada', 0, [0, 3.0, 13], [0, 1.3, 1.5]),
  C('loja', 'balcao', 'Balcão', 0, [1, 4.4, 5.4], [0, 1.2, -3.0]),
  C('loja', 'loja_vitrine', 'Vitrines', 0, [6, 3.0, 1.6], [-1, 0.9, -2.4]),
  C('loja', 'loja_negociacao', 'Mesa de negociação', 0, [-5.0, 3.4, 5.4], [-9.6, 1.0, 2.2]),
  C('loja', 'loja_cafe', 'Café do cliente', 0, [-1.2, 3.0, 2.8], [-6, 0.8, 7]),
  C('loja', 'loja_grama', 'Grama e TV', 0, [-3.5, 3.4, 0.4], [-11.5, 2.2, 1.5]),
  C('loja', 'loja_neon', 'Neon e selfie', 0, [4.5, 3.0, 2.2], [11.5, 1.6, 4.5]),
  C('loja', 'reparo', 'Laboratório', 0, [-2.75, 16.9, -0.2], [-2.75, 0.9, -6.2], { largura: 1.7, nome: 'LABORATÓRIO DE REPAROS' }),
  C('loja', 'reparo_bancada', 'Bancada', 0, [-6.3, 3.3, -4.6], [-6.3, 0.9, -7.6]),
  C('loja', 'reparo_os', 'Prateleiras de OS', 0, [6.0, 2.6, -4.6], [3.0, 1.0, -7.7]),
  // 2º andar · agência
  C('agencia', 'geral', 'Visão geral', 1, [17, 15, 19], [0, 0, -0.5], { largura: 1.5, alvoEmPe: [0.7, 0, -1], nome: 'AGÊNCIA RBTECH' }),
  C('agencia', 'chefe', 'Sala da Pamella', 1, [7.4, 4.4, 2.4], [8, 1.3, -5.6]),
  C('agencia', 'crescimento', 'Sala da Helena', 1, [-7.6, 4.4, 2.4], [-8.2, 1.3, -5.6]),
  C('agencia', 'criacao', 'Criação', 1, [-6, 4.6, 10.8], [-6, 1.1, 3]),
  C('agencia', 'analise', 'Análise e Instagram', 1, [5.5, 4.8, 12], [5, 1.1, 4.4]),
  C('agencia', 'ag_placar', 'Placar e reunião', 1, [-0.5, 3.6, 0.8], [0.8, 1.6, -7.8]),
  C('agencia', 'ag_janela', 'Janela', 1, [-3, 4.2, 2.5], [-7, 1.2, -5]),
  C('agencia', 'ag_saas', 'Estratégia SaaS', 1, [-1.0, 2.9, 8.8], [-4.6, 1.0, 6.3]),
  C('agencia', 'ag_copa', 'Copa e sofá', 1, [6, 3.4, 2.4], [10.5, 0.9, 6.2]),
  C('agencia', 'ag_corredor', 'Corredor', 1, [-11, 3.0, 0.4], [6, 1.0, 0]),
  // 3º andar · vendas e SaaS
  C('vendas', 'vendas', 'Visão geral', 2, [17, 15, 19], [0, 0, -0.5], { largura: 1.5, alvoEmPe: [0.7, 0, -1], nome: 'VENDAS E SAAS' }),
  C('vendas', 'vd_head', 'Sala do head', 2, [-7.4, 4.4, 2.4], [-7, 1.3, -5.6]),
  C('vendas', 'vd_time', 'Time de vendas', 2, [-4, 4.4, 10.8], [-4, 1.1, 3]),
  C('vendas', 'saas', 'Sistemas', 2, [4.5, 4.6, 2.2], [4.5, 1.4, -6]),
  C('vendas', 'vd_sino', 'Sino e painel SaaS', 2, [6, 3.2, 3.5], [2.5, 1.6, -6]),
  C('vendas', 'vd_servidor', 'Servidor', 2, [7.5, 2.6, -2.5], [11, 1.2, -6.6]),
  C('vendas', 'vd_copa', 'Copa', 2, [6, 3.4, 2.4], [10.5, 0.9, 6.2]),
  // terraço
  C('terraco', 'terraco', 'Visão geral', 3, [15, 13, 15], [0, 0, -1], { largura: 1.4, alvoEmPe: [1, 0, -1], nome: 'TERRAÇO E DIRETORIA' }),
  C('terraco', 'boss', 'Sala do Israel', 3, [2.5, 4.6, 3.6], [2.5, 1.2, -5.4]),
  C('terraco', 'tr_espresso', 'Espresso do Boss', 3, [3.0, 2.8, -1.8], [5.9, 1.1, -5.5]),
  C('terraco', 'tr_reuniao', 'Mesa de reunião', 3, [2.5, 4.0, 8.6], [2.5, 0.9, 3.6]),
  C('terraco', 'tr_lazer', 'Lazer e videogame', 3, [-4.5, 3.4, 1.4], [-10, 1, 5]),
  C('terraco', 'tr_pebolim', 'Pebolim', 3, [-2.4, 2.6, 4.0], [-4.5, 1.0, 6.0]),
  C('terraco', 'tr_copa', 'Copa do terraço', 3, [-6, 3.0, 0.4], [-11, 1.0, -3.6]),
  // Peter e Bibi
  { setor: 'caes', id: 'caes', botao: 'Seguir os cães', nome: 'PETER E BIBI', segue: true },
];
CAMERAS.forEach((c, i) => { c.nome = `CAM ${String(i + 1).padStart(2, '0')} · ${c.nome}`; });
/** Uma câmera de cada setor (e as principais) para o mosaico "Todos". */
export const MOSAICO_TODOS = ['predio', 'loja', 'balcao', 'reparo', 'geral', 'chefe', 'crescimento', 'vendas', 'saas', 'terraco', 'boss', 'caes'];
const CAM_DE = {
  gerente_loja: 'loja', atendimento: 'balcao', tecnico: 'reparo',
  chefe: 'chefe', analista: 'analise', copywriter: 'criacao', roteirista: 'criacao', revisor: 'analise',
  gerente_crescimento: 'crescimento', especialista: 'analise', estrategista_saas: 'ag_saas', head_vendas: 'vendas', sdr: 'vendas', closer: 'vendas',
  sucesso: 'vendas', produto: 'saas', israel: 'boss',
};

export function criarEscritorio(container, camada) {
  const celular = matchMedia('(max-width: 760px)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, celular ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // clima de cidade tropical no fim de tarde: tons de filme (ACES) e brilho nos neons e no sol
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  container.appendChild(renderer.domElement);

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.3, 6000); // longe: os morros de Colônia Santana
  const controles = new OrbitControls(camera, renderer.domElement);
  controles.enableDamping = true;
  controles.maxPolarAngle = 1.45;
  controles.minDistance = 3;
  controles.maxDistance = 1400; // dá para afastar e ver o bairro inteiro
  // Toque: 1 dedo arrasta a visão. 2 dedos: o primeiro movimento decide o gesto (como nos mapas), e ele não se mistura:
  //   pinça = zoom · girar os dedos = gira o prédio · arrastar os dois para cima/baixo = inclina.
  // Mouse: esquerdo arrasta, direito (ou Ctrl/Shift + esquerdo) gira, rodinha = zoom.
  controles.touches = { ONE: THREE.TOUCH.PAN, TWO: null }; // os 2 dedos ficam com o gesto abaixo
  controles.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controles.screenSpacePanning = true;
  let aoMexer = null;
  controles.addEventListener('start', () => { transicao = null; aoMexer?.(); });
  {
    const toques = new Map();
    const EIXO_Y = new THREE.Vector3(0, 1, 0);
    const esf = new THREE.Spherical();
    let gesto = null; // { dist, ang, meioY, modo: null | 'zoom' | 'girar' | 'inclinar' }
    const el = renderer.domElement;
    const medir = () => {
      const [[x1, y1], [x2, y2]] = [...toques.values()];
      return { dist: Math.hypot(x2 - x1, y2 - y1), ang: Math.atan2(y2 - y1, x2 - x1), meioY: (y1 + y2) / 2 };
    };
    const volta = a => (a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a);
    el.addEventListener('gesturestart', e => e.preventDefault()); // Safari: não dar zoom na página
    el.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return;
      toques.set(e.pointerId, [e.clientX, e.clientY]);
      if (toques.size === 2) { gesto = { ...medir(), modo: null }; transicao = null; aoMexer?.(); }
      else gesto = null;
    });
    el.addEventListener('pointermove', e => {
      if (e.pointerType !== 'touch' || !toques.has(e.pointerId)) return;
      toques.set(e.pointerId, [e.clientX, e.clientY]);
      if (toques.size !== 2 || !gesto || jogo) return;
      const m = medir();
      if (!gesto.modo) {
        // espera o movimento ficar claro e trava o gesto (evita girar ou inclinar sem querer durante o zoom)
        const escala = Math.abs(Math.log(m.dist / gesto.dist));
        const giro = Math.abs(volta(m.ang - gesto.ang));
        const desloc = Math.abs(m.meioY - gesto.meioY);
        if (escala > 0.06) gesto.modo = 'zoom';
        else if (giro > 0.16) gesto.modo = 'girar';
        else if (desloc > 10) gesto.modo = 'inclinar';
        else return;
        Object.assign(gesto, m); // começa do ponto atual, sem pulo
        return;
      }
      const off = camera.position.clone().sub(controles.target);
      if (gesto.modo === 'zoom') {
        const d = THREE.MathUtils.clamp(off.length() * (gesto.dist / m.dist), controles.minDistance, controles.maxDistance);
        off.setLength(d);
      } else if (gesto.modo === 'girar') {
        off.applyAxisAngle(EIXO_Y, volta(m.ang - gesto.ang));
      } else {
        esf.setFromVector3(off);
        esf.phi = THREE.MathUtils.clamp(esf.phi - (m.meioY - gesto.meioY) * (0.6 * Math.PI / Math.max(300, el.clientHeight)), 0.12, controles.maxPolarAngle); // arrastar ~70% da altura da tela vai de rente ao chão até a vista de cima
        off.setFromSpherical(esf);
      }
      camera.position.copy(controles.target).add(off);
      Object.assign(gesto, m);
    });
    const soltar = e => { toques.delete(e.pointerId); gesto = null; };
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
  }

  // luz de pôr do sol: céu quente, chão arroxeado, sol baixo e alaranjado (vindo do oeste) e um contraluz azul-piscina
  cena.add(new THREE.HemisphereLight(0xffc9a8, 0x3b2350, 1.25));
  const contraluz = new THREE.DirectionalLight(0x5ad8ff, 0.55);
  contraluz.position.set(24, 12, -26);
  cena.add(contraluz);
  const sol = new THREE.DirectionalLight(0xffa766, 2.3);
  sol.position.set(-30, 18, 22);
  sol.target.position.set(0, 6, 0);
  cena.add(sol.target);
  sol.castShadow = true;
  sol.shadow.mapSize.set(celular ? 1024 : 2048, celular ? 1024 : 2048);
  Object.assign(sol.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 120 });
  sol.shadow.bias = -0.0008;
  sol.shadow.normalBias = 0.03;
  cena.add(sol);

  // ---------- prédio ----------
  const rua = montarRua(cena);
  // mundo aberto: São José inteira em volta da loja (carrega por quadrados perto da câmera ou de você no jogo)
  let bairro = null, transito = null, jogo = null;
  const obstaculosDoAndar = new Map();
  import('./mundo.js').then(m => m.montarMundo(cena, { celular })).then(async v => {
    if (!v) return;
    bairro = v;
    for (const o of rua.genericos) o.visible = false;
    try { transito = (await import('./jogo.js')).criarTransito({ cena, dados: v.dados }); } catch (e) { console.warn('trânsito:', e); }
    container.dispatchEvent(new CustomEvent('bairro', { detail: { fonte: v.fonte, loja: v.loja } }));
  }).catch(e => console.warn('bairro:', e));
  const predio = grupo(0, 0, 0, cena);
  const telas = {};
  const andares = [0, 1, 2, 3].map(i => grupo(0, i * ALT, 0, predio));
  montarLoja(andares[0], telas);
  montarAgencia(andares[1], telas);
  montarVendas(andares[2], telas);
  montarTerraco(andares[3], telas);
  const cabine = montarElevador(predio);
  // neon nas bordas de cada andar (rosa e azul-piscina, alternando) e nas quinas da fachada
  {
    const neon = (cor, w, h, d, x, y, z, pai) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(cor).multiplyScalar(1.7), fog: false }));
      m.position.set(x, y, z); pai.add(m); return m;
    };
    andares.forEach((g, i) => {
      const cor = i % 2 ? 0x2ee6ff : 0xff3ea5, y = i === 3 ? 0.06 : ALT - 0.12;
      neon(cor, 25, 0.1, 0.1, 0, y, 8.62, g);
      for (const l of [-1, 1]) {
        neon(cor, 0.1, 0.1, 17, l * 12.55, y, 0, g);
        if (i < 3) neon(i % 2 ? 0xff3ea5 : 0x2ee6ff, 0.1, ALT, 0.1, l * 12.55, ALT / 2, 8.62, g);
      }
    });
  }
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
      if (ent.controlado || !ent.andando || !ent.caminho.length) return false;
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
      if (p.falandoVoz) p.cabeca.rotation.x = Math.sin(t * 14) * 0.06; // mexe a cabeça enquanto fala
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
          if (d.chamado) { // alguém chamou (modo jogo): vai até a pessoa, no andar dela
            const quem = d.chamado;
            d.chamado = null;
            const alvo = quem();
            if (alvo) {
              d.modo = 'andando';
              await d.irPara(alvo.andar, [[alvo.x, alvo.z]]);
              const agora2 = quem();
              if (agora2 && agora2.andar === d.andar) await d.caminhar([[agora2.x + 0.9, agora2.z + 0.9]]);
              d.falar(id === 'peter' ? 'Au au! Cheguei 🐾' : 'Arf arf! Tô aqui! 🐶', 2600);
              d.modo = 'sentado';
              await d.descansar(9000);
            }
            continue;
          }
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
      const modo = d.controlado ? d.modoControle || 'parado' : movendo ? 'andando' : d.modo;
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
  /** Um cliente entra pela porta automática e faz uma visita: café, vitrine, balcão e compra, troca ou reparo. */
  async function visitaDeCliente(c) {
    const sx = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 6);
    const dx = (c.indice - 1) * 0.5;
    c.raiz.position.set(sx, 0, 10.8);
    c.sacola.visible = false;
    c.emCasa = false; c.trilha = null; c.andar = 0;
    c.ativo = true;
    const atendente = pessoas.atendimento, tecnico = pessoas.tecnico, rael = pessoas.gerente_loja;
    const livre = q => q.emCasa && !q.andando;
    await c.caminhar([[sx, 9.4], [dx, 9.3], [dx, 6.4]]);
    if (Math.random() < 0.35) { // café do cliente e espera nas cadeiras
      await c.caminhar([[-3.4 + dx * 0.5, 6.3]]);
      c.rotAlvo = 0; c.bebendo = true;
      c.falar(sortear(['☕ cafezinho da casa!', '☕ que gentileza']), 2400);
      await esperar(3000);
      c.bebendo = false;
      await c.caminhar([[-5.8 - c.indice * 1.2, 6.2]]);
      c.rotAlvo = PI;
      c.falar('📱 esperando ser atendido', 2400);
      await esperar(3500);
    }
    const lado = Math.random() < 0.5 ? -1 : 1;
    const vx = lado * (3.6 + (Math.random() - 0.5) * 2.4);
    await c.caminhar([[vx, -1.3]]);
    c.rotAlvo = PI;
    c.falar(sortear(['😍 olha esse!', '📱 que cor linda', '🤔 qual eu levo?', '🎧 tem fone também?']), 2400);
    await esperar(2800);
    const bx = dx * 1.4;
    await c.caminhar([[bx, -1.35]]);
    c.rotAlvo = PI;
    const r = Math.random();
    if (r < 0.45) { // compra
      c.falar(sortear(['Tem o 15 em azul?', 'Posso ver o Pro?', 'Quero uma capinha também']), 2600);
      await esperar(1300);
      if (livre(atendente)) atendente.falar(sortear(['Tenho sim! 📦', 'Bora ver! 📱', 'Te mostro já! ✨']), 2600);
      await esperar(3000);
      c.falar(sortear(['💳 Pix!', '💳 no cartão', '🛍️ vou levar!']), 2400);
      await esperar(1300);
      if (livre(atendente)) atendente.falar(sortear(['⭐ Avalia a gente no Google?', '🎁 Indica um amigo!', '💛 Obrigado!']), 2600);
      c.sacola.visible = true;
      await esperar(2500);
      c.falar('🛍️ Valeu, RB Tech!', 2200);
    } else if (r < 0.65) { // troca do usado na mesa de negociação
      c.falar('Quero trocar meu celular ⇄', 2600);
      await esperar(1300);
      if (livre(atendente)) atendente.falar('O Rael avalia seu usado 🔎', 2600);
      await esperar(2000);
      await c.caminhar([[bx, 0], [-7.4, 0], [-7.4, 2.6]]);
      c.rotAlvo = -PI / 2;
      if (livre(rael)) rael.falar(sortear(['🔎 deixa eu avaliar seu usado', '📱 bateria e tela, vamos ver']), 2800);
      await esperar(3500);
      c.falar(sortear(['Fechado! ⇄', 'Vou pensar 🤔']), 2400);
      if (livre(rael)) rael.falar('🤝 boa troca!', 2200);
      await esperar(2500);
      await c.caminhar([[-7.4, 0]]);
    } else if (r < 0.85) { // reparo
      c.falar(sortear(['📱 minha tela quebrou', '🔋 a bateria não segura', '🔌 não carrega mais']), 2600);
      await esperar(1300);
      if (livre(atendente)) atendente.falar('🔧 vou chamar o técnico', 2400);
      if (ordens.fonte === 'saas') {
        if (livre(atendente)) setTimeout(() => atendente.falar('📝 vou abrir a OS no sistema', 2400), 1500);
      } else if (livre(tecnico) && !tecnico.trabalhando && !tecnico.pendentes) {
        tecnico.enfileirar(async () => {
          const ida = [[-6.3, -5.4], [7.0, -5.4], [6.2, -3.4], [1.0, -3.4]];
          await tecnico.caminhar(ida); tecnico.emCasa = false; tecnico.rotAlvo = 0;
          const nova = ordens.fonte === 'exemplo' ? { os: String(++ultimaOs), modelo: sortear(['iPhone 11', 'iPhone 12', 'iPhone 13', 'iPhone 14', 'iPhone 15 Pro']), status: 'analise' } : null;
          tecnico.falar(nova ? `🔧 abri a OS ${nova.os}` : '🔧 deixa comigo!', 2600);
          await esperar(2600);
          await tecnico.caminhar([...ida.slice(0, -1).reverse(), [-6.3, -6.6]]);
          tecnico.sentarJa();
          if (nova && ordens.aguardando.length < 8) { ordens.aguardando.push(nova); desenharVagas(); }
        });
      }
      await esperar(5000);
      c.falar('👍 volto pra buscar', 2200);
    } else {
      c.falar('Vou pensar 🤔', 2000);
    }
    await esperar(1200);
    await c.caminhar([[dx, c.raiz.position.z > 0 ? c.raiz.position.z : 0], [dx, 6.4], [dx, 9.3], [sx, 10.8]]);
  }

  // ---------- balões e etiquetas ----------
  function criarEtiqueta(e) {
    const el = document.createElement('div');
    el.className = 'ent' + (e.cachorro ? ' ent-cao' : '') + (e.id === 'israel' ? ' ent-boss' : '') + (e.id === 'cliente' ? ' ent-cliente' : '') + (e.id === 'jogador' ? ' ent-jogador' : '');
    el.innerHTML = `<div class="balao vazio"></div><div class="tag"><span class="tag-humor"></span>${e.nome}</div>`;
    camada.appendChild(el);
    e.el = el;
    e.elBalao = el.querySelector('.balao');
    e.elHumor = el.querySelector('.tag-humor');
  }
  entidades.forEach(criarEtiqueta);
  const andarVisual = e => (e.noElevador ? Math.floor(cabine.position.y / ALT + 0.01) : e.andar);
  const visivel = e => e.ativo !== false && andarVisual(e) <= limite;

  // ---------- telas ----------
  const MONITORES = ['gerente_loja', 'atendimento', 'tecnico', 'chefe', 'analista', 'copywriter', 'roteirista', 'revisor', 'gerente_crescimento', 'especialista', 'estrategista_saas', 'head_vendas', 'sdr', 'closer', 'sucesso', 'produto', 'israel'];
  const estadoTela = Object.fromEntries(MONITORES.map(k => [k, { modo: 'livre', desde: 0 }]));
  const telaModo = (papel, modo) => { if (estadoTela[papel]) estadoTela[papel] = { modo, desde: agora() }; };
  let sinos = 0, cafesDoBoss = 0, pendentesBoss = 0, reunioes = 0;
  let saasAtual = null;
  // ordens de serviço do laboratório: exemplo até o ReparoSimples ser ligado; depois, as OS reais da loja RB Tech
  let ordens = {
    fonte: 'exemplo',
    aguardando: [{ os: '1041', modelo: 'iPhone 13', status: 'analise' }, { os: '1042', modelo: 'iPhone 11', status: 'peca' }, { os: '1043', modelo: 'iPhone 14 Pro', status: 'analise' }],
    bancada: [],
    retirada: [{ os: '1038', modelo: 'iPhone 12', status: 'concluido' }, { os: '1039', modelo: 'iPhone XR', status: 'concluido' }],
  };
  let ultimaOs = 1043;
  const grupoDoStatus = st => ({ analise: 'aguardando', peca: 'aguardando', servico: 'bancada', concluido: 'retirada' }[st] || null);
  function desenharVagas() {
    for (const lista of ['aguardando', 'bancada', 'retirada']) {
      telas.vagas[lista].forEach((vaga, i) => {
        const item = ordens[lista][i];
        vaga.aparelho.visible = vaga.placaTag.visible = !!item;
        if (item) desenharTag(vaga.tag, item, lista);
      });
    }
    const t = pessoas.tecnico;
    if (t && ordens.fonte === 'saas') { // o status do técnico acompanha o que está na bancada
      const naBancada = ordens.bancada[0];
      t.status = naBancada ? `🔧 OS ${naBancada.os}${naBancada.modelo ? ' · ' + naBancada.modelo : ''}` : '';
      t.digitando = !!naBancada && t.emCasa;
      telaModo('tecnico', naBancada ? 'trabalhando' : 'livre');
    }
  }
  /** Tira a OS de onde estiver e coloca na lista nova (ou some, se lista for null). */
  function moverOs(item, lista) {
    for (const l of ['aguardando', 'bancada', 'retirada']) ordens[l] = ordens[l].filter(x => x.os !== item.os);
    if (lista) ordens[lista].push(item);
    desenharVagas();
  }
  desenharVagas();
  document.fonts?.ready.then(desenharVagas);
  // caminhos do laboratório
  const LAB = {
    assento: [-6.3, -6.6],
    aoBalcao: [[-6.3, -5.4], [7.0, -5.4], [6.2, -3.4], [1.0, -3.4]],
    prateleira: x => [[-6.3, -5.4], [x, -5.4], [x, -7.0]],
  };
  async function tecnicoVai(pontos, olhar) { const t = pessoas.tecnico; await t.caminhar(pontos); t.emCasa = false; t.rotAlvo = olhar; }
  async function tecnicoVolta(de) { const t = pessoas.tecnico; await t.caminhar([...de.slice(0, -1).reverse(), LAB.assento]); t.sentarJa(); }
  /** Animação de uma mudança vinda do ReparoSimples; a vaga só muda quando o aparelho chega no lugar. */
  function animarMudanca(ev) {
    const t = pessoas.tecnico, a = pessoas.atendimento;
    const { item, de, para } = ev;
    if (!para && de === 'retirada') { // entregue ao cliente: o atendente busca na prateleira de retirada
      a.enfileirar(async () => {
        const ida = [[6.0, -3.4], [7.0, -5.4], [4.6, -5.4], [4.6, -7.0]];
        await a.caminhar(ida); a.emCasa = false; a.rotAlvo = PI;
        a.falar(`📦 pegando a OS ${item.os}`, 2000);
        await esperar(1500);
        moverOs(item, null);
        await a.caminhar([...ida.slice(0, -1).reverse(), a.posto.assento]); a.sentarJa();
        a.falar(`🛍️ OS ${item.os} entregue!`, 2600);
      });
      return;
    }
    if (!para) { moverOs(item, null); return; } // interrompida ou apagada
    t.enfileirar(async () => {
      if (!de) { // OS nova: o técnico busca o aparelho no balcão
        a.falar(`📝 OS ${item.os} aberta`, 2400);
        await tecnicoVai(LAB.aoBalcao, 0);
        t.falar(`🔧 recebendo OS ${item.os}`, 2200);
        await esperar(2200);
        await tecnicoVolta(LAB.aoBalcao);
      } else if (de === 'aguardando') {
        await tecnicoVai(LAB.prateleira(1.5), PI);
        t.falar(`📱 pegando a OS ${item.os}`, 2000);
        await esperar(1300);
        await tecnicoVolta(LAB.prateleira(1.5));
      } else if (de === 'retirada') {
        await tecnicoVai(LAB.prateleira(4.6), PI);
        await esperar(1000);
        await tecnicoVolta(LAB.prateleira(4.6));
      }
      if (para === 'bancada') { moverOs(item, 'bancada'); t.falar(`🔧 começando a OS ${item.os}`, 2400); return; }
      const x = para === 'retirada' ? 4.6 : 1.5;
      await tecnicoVai(LAB.prateleira(x), PI);
      moverOs(item, para);
      t.falar(para === 'retirada' ? `✅ OS ${item.os} pronta pra retirada` : item.status === 'peca' ? `📦 OS ${item.os} aguardando peça` : `📱 OS ${item.os} na fila`, 2600);
      await esperar(1800);
      await tecnicoVolta(LAB.prateleira(x));
      desenharVagas();
    });
  }

  // ---------- câmeras ----------
  let camAtual = CAMERAS[0];
  let transicao = null;
  let caoSeguido = 'bibi';
  let ultimoAspecto = 0;
  const fator = (cam, aspecto = camera.aspect) => Math.max(1, (cam.largura ?? 0.8) / aspecto);
  function aplicarLimite(n) {
    limite = n;
    andares.forEach((g, i) => {
      g.visible = i <= n;
      if (g.userData.fachada) g.userData.fachada.visible = i < n;
    });
  }
  function posicaoCamera(cam, aspecto = camera.aspect) {
    if (cam.segue) {
      const d = caes[caoSeguido];
      const m = d.raiz.position;
      const alvo = new THREE.Vector3(m.x, m.y + 0.5, m.z);
      return [alvo.clone().add(new THREE.Vector3(2.4, 2.6, 3.8).multiplyScalar(fator(cam, aspecto))), alvo];
    }
    const dy = cam.abs ? 0 : (cam.andar || 0) * ALT;
    const alvo = new THREE.Vector3(cam.alvo[0], cam.alvo[1] + dy, cam.alvo[2]);
    const off = new THREE.Vector3(cam.pos[0] - cam.alvo[0], cam.pos[1] - cam.alvo[1], cam.pos[2] - cam.alvo[2]).multiplyScalar(fator(cam, aspecto));
    if (cam.alvoEmPe && aspecto < 0.8) alvo.set(cam.alvoEmPe[0], cam.alvoEmPe[1] + dy, cam.alvoEmPe[2]);
    return [alvo.clone().add(off), alvo];
  }
  const limiteDe = cam => (cam.segue ? (caes[caoSeguido].noElevador ? 3 : caes[caoSeguido].andar) : cam.limite);

  // ---------- mosaico: várias câmeras ao vivo na mesma tela (estilo central de monitoramento) ----------
  let mosaico = null; // { grade, cams: Map(id → PerspectiveCamera), prox }
  const FUNDO_QUADRO = new THREE.Color(0x1b1a13);
  function abrirMosaico(grade) {
    mosaico = { grade, cams: new Map(), prox: 0 };
    camada.style.display = 'none';
    renderer.setScissorTest(false);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(); // os vãos entre os quadros ficam transparentes (fundo escuro da moldura)
  }
  function fecharMosaico() {
    if (!mosaico) return;
    mosaico = null;
    camada.style.display = '';
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.autoUpdate = true;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, container.clientWidth, container.clientHeight);
    aplicarLimite(limiteDe(camAtual));
    for (const e of entidades) e.raiz.visible = visivel(e);
  }
  function renderizarMosaico() {
    const tela = renderer.domElement.getBoundingClientRect();
    const quadros = [...mosaico.grade.querySelectorAll('[data-cam]')];
    if (!quadros.length) return;
    // a sombra só é recalculada uma vez por quadro (ou quando muda o andar visível)
    renderer.shadowMap.autoUpdate = false;
    let limSombra = null;
    renderer.setScissorTest(true);
    renderer.setClearColor(FUNDO_QUADRO, 1);
    const porQuadro = Math.min(quadros.length, celular ? 2 : 4); // poucas câmeras por quadro: as outras mantêm a última imagem
    for (let k = 0; k < porQuadro; k++) {
      const el = quadros[(mosaico.prox + k) % quadros.length];
      const cam = CAMERAS.find(c => c.id === el.dataset.cam);
      if (!cam) continue;
      const r = el.getBoundingClientRect();
      const x = r.left - tela.left, y = tela.bottom - r.bottom, w = r.width, h = r.height;
      if (w < 4 || h < 4) continue;
      let camQuadro = mosaico.cams.get(cam.id);
      if (!camQuadro) mosaico.cams.set(cam.id, (camQuadro = new THREE.PerspectiveCamera(40, 1, 0.3, 6000)));
      camQuadro.aspect = w / h;
      camQuadro.updateProjectionMatrix();
      const [pos, alvo] = posicaoCamera(cam, camQuadro.aspect);
      camQuadro.position.copy(pos);
      camQuadro.lookAt(alvo);
      const lim = limiteDe(cam);
      aplicarLimite(lim);
      for (const e of entidades) e.raiz.visible = visivel(e);
      if (lim !== limSombra) { renderer.shadowMap.needsUpdate = true; limSombra = lim; }
      renderer.setViewport(x, y, w, h);
      renderer.setScissor(x, y, w, h);
      renderer.render(cena, camQuadro);
    }
    mosaico.prox = (mosaico.prox + porQuadro) % quadros.length;
    renderer.setScissorTest(false);
    renderer.setClearColor(0x000000, 0);
  }
  function irParaCamera(id, instantaneo = false) {
    if (jogo) return camAtual; // no jogo a câmera é sua
    const cam = CAMERAS.find(c => c.id === id) || CAMERAS[0];
    if (cam.segue && cam !== camAtual) {
      const acordados = ['peter', 'bibi'].filter(k => caes[k].modo !== 'dormindo');
      caoSeguido = acordados.length === 1 ? acordados[0] : caoSeguido === 'bibi' ? 'peter' : 'bibi';
    }
    camAtual = cam;
    if (!mosaico) aplicarLimite(cam.segue ? caes[caoSeguido].andar : cam.limite);
    const [pos, alvo] = posicaoCamera(cam);
    if (instantaneo) { camera.position.copy(pos); controles.target.copy(alvo); transicao = null; }
    else transicao = { t: 0, de: camera.position.clone(), deAlvo: controles.target.clone(), para: pos, paraAlvo: alvo };
    return cam;
  }
  // brilho (bloom) só no que é muito claro: neons, sol e luzes
  let composer = null;
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(cena, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), celular ? 0.5 : 0.6, 0.55, 0.92));
    composer.addPass(new OutputPass());
  } catch (e) { console.warn('sem brilho:', e); composer = null; }
  function redimensionar() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio() * (celular ? 0.75 : 1)); composer.setSize(w, h); }
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (mosaico) renderer.setViewport(0, 0, w, h);
    if (Math.abs(camera.aspect - ultimoAspecto) > 0.05 && !jogo) { ultimoAspecto = camera.aspect; irParaCamera(camAtual.id, true); }
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
        sinos++; desenharSaas(telas.saas, sinos, saasAtual);
        await esperar(2400);
        return p.voltarAoPosto();
      }
      p.falar(sortear(['📞 Alô! Aqui é da RBTech…', '📞 conhece o ReparoSimples?', '📞 posso te mostrar o Sorteia Aí?', '📞 te mando a proposta!', '✍️ anotando no CRM']), 3200);
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
    if (p.id === 'atendimento' && Math.random() < 0.5) { // busca no painel atrás do balcão
      const [x, z] = p.posto.assento;
      await p.caminhar([[x + (Math.random() - 0.5) * 3, -3.85]]); p.emCasa = false; p.rotAlvo = PI;
      p.falar(sortear(['📦 pegando uma capinha', '📦 buscando o aparelho no estoque', '🎧 separando um fone']), 2200);
      await esperar(2400);
      await p.caminhar([[x, z]]); p.sentarJa();
      return;
    }
    if (p.id === 'tecnico' && ordens.fonte === 'exemplo' && ordens.aguardando.length && Math.random() < 0.6) { // pega o próximo da fila, conserta e leva para a retirada
      const item = ordens.aguardando[0];
      const ir = async x => { await p.caminhar([[-6.3, -5.4], [x, -5.4], [x, -7.0]]); p.emCasa = false; p.rotAlvo = PI; };
      const voltar = async x => { await p.caminhar([[x, -5.4], [-6.3, -5.4], [-6.3, -6.6]]); p.sentarJa(); };
      await ir(1.5);
      p.falar(`📱 pegando a OS ${item.os}`, 2200);
      await esperar(1500);
      ordens.aguardando = ordens.aguardando.filter(x => x !== item);
      desenharVagas();
      await voltar(1.5);
      p.digitando = true; p.status = `🔧 OS ${item.os} · ${item.modelo || 'reparo'}`;
      telaModo('tecnico', 'trabalhando');
      await esperar(10000 + Math.random() * 6000);
      p.digitando = false; p.status = '';
      telaModo('tecnico', 'pronto');
      await ir(4.6);
      item.status = 'concluido';
      ordens.retirada.push(item);
      if (ordens.retirada.length > 8) ordens.retirada.shift();
      desenharVagas();
      p.falar(`✅ OS ${item.os} pronta pra retirada`, 2600);
      await esperar(1800);
      await voltar(4.6);
      telaModo('tecnico', 'livre');
      return;
    }
    if (p.id === 'tecnico' && Math.random() < 0.65) { // na bancada
      p.digitando = true; p.status = sortear(['🔧 trocando a tela', '🔬 diagnóstico', '🔋 trocando a bateria', '🧪 testando o Face ID']);
      telaModo('tecnico', 'trabalhando');
      await esperar(8000 + Math.random() * 6000);
      p.digitando = false; p.status = '';
      telaModo('tecnico', 'livre');
      return;
    }
    if (p.id === 'gerente_loja' && Math.random() < 0.5) {
      p.digitando = true; telaModo('gerente_loja', 'trabalhando');
      p.falar(sortear(['📊 conferindo as vendas do dia', '⇄ simulando uma troca', '📲 respondendo cliente']), 2600);
      await esperar(6000);
      p.digitando = false; telaModo('gerente_loja', 'livre');
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
  // ---------- laço de animação ----------
  let ultimoDesenho = 0, ultimoMundo = 0;
  let aberturaPorta = 0;
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
    transito?.atualizar(dt);
    if (jogo) jogo.atualizar(dt);
    // o mundo carrega em volta de onde você está (no jogo) ou de para onde a câmera olha
    if (bairro && t - ultimoMundo > 0.4) { ultimoMundo = t; bairro.atualizar(jogo ? jogo.foco() : controles.target); }
    // porta automática da loja: abre quando alguém chega perto
    if (telas.portas) {
      const perto = entidades.some(e => e.ativo !== false && e.andar === 0 && !e.noElevador && Math.abs(e.raiz.position.x) < 2.2 && Math.abs(e.raiz.position.z - 7.85) < 2.0);
      aberturaPorta = suave(aberturaPorta, perto ? 1 : 0, Math.min(1, dt * 5));
      telas.portas[0].position.x = -0.63 - 1.2 * aberturaPorta;
      telas.portas[1].position.x = 0.63 + 1.2 * aberturaPorta;
    }
    if (telas.leds) telas.leds.forEach((l, i) => { l.visible = Math.sin(t * 3 + i * 1.7) > -0.6; });

    if (jogo) {
      // a câmera segue você (jogo.atualizar já posicionou)
    } else if (transicao) {
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
      if (a !== limite && !mosaico) aplicarLimite(a);
    }
    if (!jogo) controles.update();
    if (t - ultimoDesenho > 0.25) {
      ultimoDesenho = t;
      if (telas.tvLoja && limite >= 0) desenharTv(telas.tvLoja, t);
      for (const papel of MONITORES) {
        const tela = telas[papel];
        if (!tela) continue;
        const st = estadoTela[papel];
        if (st.modo === 'livre' && tela.desenhado === 'livre') continue;
        desenharMonitor(tela, papel, st.modo, t - st.desde);
        tela.desenhado = st.modo;
      }
    }
    if (mosaico) renderizarMosaico();
    else { if (composer) composer.render(); else renderer.render(cena, camera); posicionarBaloes(); }
    requestAnimationFrame(quadro);
  }
  const v = new THREE.Vector3();
  function posicionarBaloes() {
    const w = container.clientWidth, h = container.clientHeight;
    const foco = jogo ? jogo.focoAndar() : camAtual.setor === 'predio' ? null : camAtual.segue ? caes[caoSeguido].andar : camAtual.andar;
    camada.classList.toggle('sem-nomes', !jogo && camAtual.setor === 'predio'); // visão do prédio sem os nomes, para não poluir
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
    setores: SETORES,
    mosaicoTodos: MOSAICO_TODOS,
    abrirMosaico,
    fecharMosaico,
    mosaicoAberto: () => !!mosaico,
    irParaCamera,
    cameraAtual: () => camAtual,
    estadoCamera: () => ({ pos: camera.position.toArray(), alvo: controles.target.toArray() }),
    /** Avisa o app quando você mexe na câmera com o dedo ou o mouse. */
    aoMexerNaCamera(fn) { aoMexer = fn; },
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
      p.falar(tipo === 'imagens' ? '🎨 gerando as imagens da arte…' : tipo.includes('posts') ? '📱 lendo os posts…' : tipo.includes('instagram') ? '📈 lendo o Instagram…' : '📊 lendo o Meta Ads…', 4000);
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
    /** ReparoSimples (SaaS): números, última revisão dos servidores e lojas novas (o sino toca e o time comemora). */
    definirSaas(saas, novas = []) {
      saasAtual = saas;
      const cor = { ok: 0x2fd17a, atencao: 0xffb020, falha: 0xff4d4d }[saas?.revisao?.status] ?? 0x2fd17a;
      for (const l of telas.leds || []) { l.material.color.setHex(cor); l.material.emissive?.setHex(cor); }
      if (novas.length) {
        sinos += novas.length;
        const quem = ['head_vendas', 'sucesso', 'produto'].map(k => pessoas[k]).filter(Boolean);
        quem[0]?.falar(`🔔 Loja nova no ReparoSimples: ${resumo(novas[0].nome)}!`, 5000);
        for (const q of quem.slice(1)) if (q.emCasa) q.falar('👏👏 bem-vinda!', 2600);
      }
      desenharSaas(telas.saas, sinos, saas);
    },
    /**
     * OS em andamento da loja RB Tech, vindas do ReparoSimples: [{ os, modelo, status }].
     * Na primeira carga as prateleiras são preenchidas direto; depois, cada OS nova ou mudança de status vira animação.
     */
    definirOrdensDeServico(lista) {
      const atual = new Map(['aguardando', 'bancada', 'retirada'].flatMap(l => ordens[l].map(x => [x.os, { item: x, grupo: l }])));
      const novo = (lista || []).map(o => ({ os: String(o.os), modelo: o.modelo || '', status: o.status }));
      if (ordens.fonte !== 'saas') {
        ordens = { fonte: 'saas', aguardando: [], bancada: [], retirada: [] };
        for (const o of novo) { const g = grupoDoStatus(o.status); if (g && ordens[g].length < (g === 'bancada' ? 3 : 8)) ordens[g].push(o); }
        desenharVagas();
        return;
      }
      const eventos = [];
      const vistos = new Set();
      for (const o of novo) {
        vistos.add(o.os);
        const antes = atual.get(o.os);
        const para = grupoDoStatus(o.status);
        if (!antes) eventos.push({ item: o, de: null, para });
        else if (antes.grupo !== para) eventos.push({ item: o, de: antes.grupo, para });
        else if (antes.item.status !== o.status || antes.item.modelo !== o.modelo) { Object.assign(antes.item, o); desenharVagas(); }
      }
      for (const [os, antes] of atual) if (!vistos.has(os)) eventos.push({ item: antes.item, de: antes.grupo, para: null });
      eventos.slice(0, 8).forEach(animarMudanca);
      for (const ev of eventos.slice(8)) moverOs(ev.item, ev.para); // muitas de uma vez: aplica direto
    },
    falando(papel, sim) {
      const p = pessoas[papel];
      if (!p) return;
      p.falandoVoz = sim;
      if (sim) p.falar('🔊 falando…', 120000); else p.falaAte = 0;
    },
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

    // ---------- modo jogo ----------
    jogoAtivo: () => !!jogo,
    /** Liga o jogo: você dirige até a loja, estaciona, entra e anda pelo prédio. eventos: { aoSair(), aoPedir({ gestor, texto }) }. */
    async iniciarJogo(eventos = {}) {
      if (jogo) return;
      if (mosaico) fecharMosaico();
      const { criarJogo } = await import('./jogo.js');
      transicao = null;
      controles.enabled = false;
      const ctx = {
        cena, camera, renderer, container, pessoas, caes, clientes, entidades,
        ALT, ELEVADOR, PESSOAS_3D, GESTOR_DE, CHEFES, NOMES,
        criarPessoa(id, def, opcoes) { const p = new Pessoa(id, def, opcoes); criarEtiqueta(p); return p; },
        removerPessoa(p) {
          const i = entidades.indexOf(p);
          if (i >= 0) entidades.splice(i, 1);
          predio.remove(p.raiz);
          p.el?.remove();
        },
        aplicarLimite,
        viajarJogador: (ent, destino) => viajar(ent, destino),
        /** Móveis e paredes de vidro de um andar, na altura do corpo: [xMin, xMax, zMin, zMax] (calculado uma vez). */
        obstaculos(andar) {
          if (obstaculosDoAndar.has(andar)) return obstaculosDoAndar.get(andar);
          const lista = [], piso = andar * ALT, g = andares[andar], fachada = g.userData.fachada;
          const portas = new Set(telas.portas || []), b = new THREE.Box3();
          predio.updateMatrixWorld(true);
          g.traverse(o => {
            if (!o.isMesh || portas.has(o) || o.userData.semColisao) return;
            for (let a = o; a && a !== g; a = a.parent) if (a === fachada) return;
            b.setFromObject(o);
            if (b.min.y - piso > 1.2 || b.max.y - piso < 0.3) return; // acima da cabeça ou rente ao chão (tapetes)
            if (b.max.x - b.min.x > 14 || b.max.z - b.min.z > 14) return; // piso, teto e paredes externas: o jogo já trata
            lista.push([b.min.x, b.max.x, b.min.z, b.max.z]);
          });
          obstaculosDoAndar.set(andar, lista);
          return lista;
        },
        chao: () => (bairro ? bairro.chao : [rua.chao]).concat(rua.calcada),
        dados: () => bairro?.dados || null,
        alturaTerreno: (x, z) => (bairro ? bairro.altura(x, z) : -0.62),
        casasPerto: (x, z) => (bairro ? bairro.casasPerto(x, z) : []),
        transito: () => transito,
        chamarCao(id, quem) { const d = caes[id]; d.chamado = quem; d.acordar = true; },
        emitir(tipo, dados) { return tipo === 'pedido' ? eventos.aoPedir?.(dados) : undefined; },
        sair: () => api.sairDoJogo(),
      };
      jogo = criarJogo(ctx);
      jogo.aoSair = eventos.aoSair;
      jogo.inicio();
    },
    sairDoJogo() {
      if (!jogo) return;
      const j = jogo;
      jogo = null;
      j.destruir();
      controles.enabled = true;
      ultimoAspecto = 0;
      redimensionar();
      irParaCamera('predio');
      j.aoSair?.();
    },
    /** Mensagem rápida na tela do jogo (ex.: a resposta de um chefe). */
    avisoJogo(texto, ms) { jogo?.aviso(texto, ms); },
    _jogo: () => jogo, // para testes
  };
  document.fonts?.ready.then(() => { desenharBoss(telas.boss, pendentesBoss, cafesDoBoss); desenharSaas(telas.saas, sinos, saasAtual); });
  return api;
}

const FRASES = {
  gerente_loja: ['Loja cheia hoje! 🛍️', 'Bora bater a meta 💪', 'Traz o usado que eu avalio ⇄'],
  atendimento: ['Posso ajudar? 😊', 'Esse sai muito! 📱', 'Te passo no WhatsApp 💬', 'Avalia a gente! ⭐'],
  tecnico: ['Tela nova em 1 hora 🔧', 'IMEI conferido ✅', 'Bateria 100% 🔋', 'Microscópio é vida 🔬'],
  chefe: ['Bora vender iPhone! 📈', 'Cadê o revisor? 👀', 'Meta do dia batida?'],
  analista: ['O CTR subiu! 📊', 'Planilha é vida.'],
  copywriter: ['Tenho um gancho novo ✍️', 'Primeira frase é tudo.'],
  roteirista: ['3 segundos pra prender! 🎬', 'Corta pro card amarelo!'],
  revisor: ['Preço confere? 🔎', 'Isso o Meta reprova.'],
  gerente_crescimento: ['Bora crescer! 📈', 'Engajamento é rei 👑'],
  especialista: ['Esse reels bombou! 🔥', 'Salvamentos subindo 📌'],
  estrategista_saas: ['Teste grátis → assinatura 🎯', 'Post sem rosto, só tela 🎥', 'Assistência é nosso público 🔧'],
  estagiario: ['Primeiro dia! 😅', 'Onde fica o café?'],
  head_vendas: ['Funil cheio! 🎯', 'Quem fechou hoje?'],
  sdr: ['Mais um lead! 🎯', 'Agendei uma demo 📅'],
  closer: ['Proposta enviada 🤝', 'Fechou! 🔔'],
  sucesso: ['Cliente ativado ✅', 'Zero cancelamento 💛'],
  produto: ['Deploy feito 🚀', 'Bug resolvido 🐛'],
  israel: ['☕ cadê meu café?', 'Mostra os números 📊', 'Aprovado… talvez 🧐', 'O prédio tá voando! 🚀'],
  cliente: ['Só olhando 👀', 'Quero um iPhone! 📱'],
};
