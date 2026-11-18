// Escritório 3D "blocadinho" da agência: móveis, equipe, Peter e Bibi, telas e câmeras.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const AMARELO = 0xffd60a;
const PRETO = 0x0f0f0f;
const PI = Math.PI;

// ---------- utilidades de blocos ----------
const cacheMat = new Map();
function mat(cor, extra) {
  const k = cor + (extra ? JSON.stringify(extra) : '');
  if (!cacheMat.has(k)) cacheMat.set(k, new THREE.MeshLambertMaterial({ color: cor, ...extra }));
  return cacheMat.get(k);
}
const cacheGeo = new Map();
function geo(w, h, d) {
  const k = `${w}|${h}|${d}`;
  if (!cacheGeo.has(k)) cacheGeo.set(k, new THREE.BoxGeometry(w, h, d));
  return cacheGeo.get(k);
}
function caixa(w, h, d, cor, x = 0, y = 0, z = 0, pai = null, extra = null) {
  const m = new THREE.Mesh(geo(w, h, d), typeof cor === 'object' ? cor : mat(cor, extra));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (pai) pai.add(m);
  return m;
}
function grupo(x = 0, y = 0, z = 0, pai = null) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (pai) pai.add(g);
  return g;
}
function telaCanvas(w, h, pixel = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (pixel) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; }
  else t.anisotropy = 4;
  return { c, ctx: c.getContext('2d'), t };
}
function placa(w, h, textura, x, y, z, rotY = 0, pai) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textura, toneMapped: false }));
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  pai.add(m);
  return m;
}
// gerador aleatório com semente (mesma bagunça de pelo toda vez)
function aleatorio(semente) {
  let s = semente;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const suave = (a, b, k) => a + (b - a) * k;
function anguloAlvo(atual, alvo, k) {
  let d = alvo - atual;
  while (d > PI) d -= 2 * PI;
  while (d < -PI) d += 2 * PI;
  return atual + d * k;
}
const FONTE = '"Poppins", system-ui, sans-serif';

// ---------- postos de trabalho ----------
// assento: onde a pessoa senta; olhar: rotação (0 = olhando para +z); rota: do assento até o corredor (z = 0)
const POSTOS = {
  chefe:      { assento: [8, -6.2],  olhar: 0,  rota: [[8, -6.2], [10.2, -6.2], [10.2, 0]] },
  analista:   { assento: [3, 4.3],   olhar: PI, rota: [[3, 4.3], [5.5, 4.3], [5.5, 0]],   visita: [6.8, -3.6] },
  copywriter: { assento: [-8, 4.3],  olhar: PI, rota: [[-8, 4.3], [-6, 4.3], [-6, 0]],    visita: [7.6, -3.6] },
  roteirista: { assento: [-4, 4.3],  olhar: PI, rota: [[-4, 4.3], [-2, 4.3], [-2, 0]],    visita: [8.4, -3.6] },
  revisor:    { assento: [8, 4.3],   olhar: PI, rota: [[8, 4.3], [9.9, 4.3], [9.9, 0]],   visita: [9.2, -3.6] },
  estagiario: { assento: [-0.3, 7.2], olhar: PI, rota: [[-0.3, 7.2], [1.2, 7.2], [1.2, 0]] },
};

const NOMES = {
  chefe: 'Chefe', analista: 'Analista', copywriter: 'Copywriter', roteirista: 'Roteirista',
  revisor: 'Revisor', estagiario: 'Estagiário', peter: 'Peter', bibi: 'Bibi',
};

// ---------- câmeras ----------
export const CAMERAS = [
  { id: 'geral',    nome: 'CAM 01 · VISÃO GERAL',      pos: [17, 15, 19],  alvo: [0, 0, -0.5], largura: 1.5, alvoEmPe: [0.7, 0, -1] },
  { id: 'chefe',    nome: 'CAM 02 · SALA DO CHEFE',    pos: [7.2, 4.4, 2.6], alvo: [8, 1.3, -5.6] },
  { id: 'criacao',  nome: 'CAM 03 · CRIAÇÃO',          pos: [-6, 4.6, 10.5], alvo: [-6, 1.1, 3] },
  { id: 'analise',  nome: 'CAM 04 · ANÁLISE E REVISÃO', pos: [5.5, 4.6, 10.5], alvo: [5.5, 1.1, 3] },
  { id: 'reuniao',  nome: 'CAM 05 · JANELA',           pos: [-3, 4.2, 2.5], alvo: [-7, 1.2, -5] },
  { id: 'caes',     nome: 'CAM 06 · PETER E BIBI',     pos: [0, 0, 0],     alvo: [0, 0, 0], segue: true },
];

export function criarEscritorio(container, camada) {
  // ---------- renderizador ----------
  const celular = matchMedia('(max-width: 760px)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  const controles = new OrbitControls(camera, renderer.domElement);
  controles.enableDamping = true;
  controles.maxPolarAngle = 1.42;
  controles.minDistance = 3;
  controles.maxDistance = 110;

  // luz
  cena.add(new THREE.HemisphereLight(0xfff6e5, 0x3a3226, 1.25));
  const sol = new THREE.DirectionalLight(0xfff1d6, 1.9);
  sol.position.set(12, 22, 10);
  sol.castShadow = true;
  sol.shadow.mapSize.set(celular ? 1024 : 2048, celular ? 1024 : 2048);
  Object.assign(sol.shadow.camera, { left: -16, right: 16, top: 14, bottom: -14, near: 1, far: 60 });
  sol.shadow.bias = -0.0008;
  sol.shadow.normalBias = 0.02;
  cena.add(sol);

  const mundo = grupo(0, 0, 0, cena);
  const telas = {};
  const entidades = []; // pessoas e cachorros (para balões e cliques)

  montarSala(mundo, telas);

  // ---------- equipe ----------
  const pessoas = {
    chefe: new Pessoa('chefe', {
      pele: 0xc68a5e, cabelo: 0x2b1d14, penteado: 'curto', barba: true,
      camisa: 0x1c1c1c, frente: 0xf4f4f4, gravata: AMARELO, calca: 0x1c1c1c, sapato: 0x0c0c0c,
    }),
    analista: new Pessoa('analista', {
      pele: 0xf0c8a0, cabelo: 0x1a1a1a, penteado: 'curto', oculos: true,
      camisa: 0x3b6fd6, calca: 0x2d3446, sapato: 0x222222,
    }),
    copywriter: new Pessoa('copywriter', {
      pele: 0xe8b48a, cabelo: 0xa8432a, penteado: 'longo',
      camisa: 0x2fb8a6, calca: 0x30343c, sapato: 0xf2f2f2,
    }),
    roteirista: new Pessoa('roteirista', {
      pele: 0x8d5a3b, cabelo: 0x111111, penteado: 'curto', bone: AMARELO, fone: true,
      camisa: 0x161616, calca: 0x5a6270, sapato: 0xffffff,
    }),
    revisor: new Pessoa('revisor', {
      pele: 0xf3d2b3, cabelo: 0x5a3b26, penteado: 'coque', oculos: true,
      camisa: 0x9b6bd1, calca: 0x2a2a2a, sapato: 0x3a2a1a,
    }),
    estagiario: new Pessoa('estagiario', {
      pele: 0xd9a27a, cabelo: 0x3a2618, penteado: 'topete',
      camisa: AMARELO, calca: 0x2f3b55, sapato: 0xffffff,
    }),
  };
  for (const p of Object.values(pessoas)) { mundo.add(p.raiz); p.sentarJa(); }
  pessoas.estagiario.raiz.visible = false;
  const mesaEstagiario = montarMesaEstagiario(mundo, telas);
  mesaEstagiario.visible = false;

  const caes = {
    peter: new Cachorro('peter'),
    bibi: new Cachorro('bibi'),
  };
  caes.peter.colocar(10.9, -7.0, 'dormindo');
  caes.bibi.colocar(-10.4, 6.6, 'sentado');
  for (const c of Object.values(caes)) mundo.add(c.raiz);

  // ---------- balões e etiquetas (HTML sobre o 3D) ----------
  for (const e of entidades) {
    const el = document.createElement('div');
    el.className = 'ent ' + (e.cachorro ? 'ent-cao' : '');
    el.innerHTML = `<div class="balao"></div><div class="tag"><span class="tag-humor"></span>${NOMES[e.id]}</div>`;
    camada.appendChild(el);
    e.el = el;
    e.elBalao = el.querySelector('.balao');
    e.elHumor = el.querySelector('.tag-humor');
  }

  // ---------- estado vindo do app ----------
  let placar = null;
  let humor = 'normal';
  const MONITORES = ['chefe', 'analista', 'copywriter', 'roteirista', 'revisor', 'estagiario'];
  const estadoTela = {}; // papel -> { modo: 'livre'|'trabalhando'|'pronto', desde }
  for (const k of MONITORES) estadoTela[k] = { modo: 'livre', desde: 0 };

  // ---------- câmera ----------
  let camAtual = CAMERAS[0];
  let transicao = null;
  // tela em pé (celular ou modo vídeo 9:16): afasta a câmera para caber o que importa
  const fator = cam => Math.max(1, (cam.largura ?? 0.8) / camera.aspect);
  let ultimoAspecto = 0;
  let caoSeguido = 'bibi';
  function irParaCamera(id, instantaneo = false) {
    const cam = CAMERAS.find(c => c.id === id) || CAMERAS[0];
    if (cam.segue && cam !== camAtual) {
      // prefere quem está acordado; se os dois estiverem, alterna
      const acordados = ['peter', 'bibi'].filter(k => caes[k].modo !== 'dormindo');
      caoSeguido = acordados.length === 1 ? acordados[0] : caoSeguido === 'bibi' ? 'peter' : 'bibi';
    }
    camAtual = cam;
    const [pos, alvo] = posicaoCamera(cam);
    if (instantaneo) {
      camera.position.copy(pos);
      controles.target.copy(alvo);
      transicao = null;
    } else {
      transicao = { t: 0, de: camera.position.clone(), deAlvo: controles.target.clone(), para: pos, paraAlvo: alvo };
    }
    return cam;
  }
  function posicaoCamera(cam) {
    if (cam.segue) {
      const m = caes[caoSeguido].raiz.position;
      const alvo = new THREE.Vector3(m.x, 0.5, m.z);
      const pos = alvo.clone().add(new THREE.Vector3(2.2, 2.4, 3.6).multiplyScalar(fator(cam)));
      return [pos, alvo];
    }
    const alvo = new THREE.Vector3(...cam.alvo);
    const off = new THREE.Vector3(...cam.pos).sub(alvo).multiplyScalar(fator(cam));
    // em pé, a sala do chefe (à direita) sai do quadro: recentraliza mantendo o mesmo ângulo
    if (cam.alvoEmPe && camera.aspect < 0.8) alvo.set(...cam.alvoEmPe);
    return [alvo.clone().add(off), alvo];
  }

  function redimensionar() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (Math.abs(camera.aspect - ultimoAspecto) > 0.05) {
      ultimoAspecto = camera.aspect;
      irParaCamera(camAtual.id, true);
    }
  }
  new ResizeObserver(redimensionar).observe(container);
  redimensionar();
  irParaCamera('geral', true);

  // ---------- cliques nos personagens ----------
  const raio = new THREE.Raycaster();
  const ponteiro = new THREE.Vector2();
  let toqueInicio = null;
  renderer.domElement.addEventListener('pointerdown', e => { toqueInicio = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!toqueInicio || Math.hypot(e.clientX - toqueInicio[0], e.clientY - toqueInicio[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ponteiro.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raio.setFromCamera(ponteiro, camera);
    const hits = raio.intersectObjects(entidades.filter(x => x.raiz.visible).map(x => x.raiz), true);
    if (!hits.length) return;
    let o = hits[0].object;
    while (o && !o.userData.ent) o = o.parent;
    o?.userData.ent.cutucar();
  });

  // ---------- laço de animação ----------
  const relogio = new THREE.Clock();
  let ultimoDesenhoTelas = 0;
  function quadro() {
    const dt = Math.min(relogio.getDelta(), 0.05);
    const t = relogio.elapsedTime;
    for (const p of Object.values(pessoas)) p.atualizar(dt, t);
    for (const c of Object.values(caes)) c.atualizar(dt, t);

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
    }
    controles.update();

    if (t - ultimoDesenhoTelas > 0.25) {
      ultimoDesenhoTelas = t;
      for (const papel of MONITORES) {
        const tela = telas[papel];
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
    const w = container.clientWidth;
    const h = container.clientHeight;
    for (const e of entidades) {
      if (!e.raiz.visible) { e.el.style.display = 'none'; continue; }
      e.raiz.getWorldPosition(v);
      v.y += e.alturaEtiqueta();
      v.project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.3 || Math.abs(v.y) > 1.3) { e.el.style.display = 'none'; continue; }
      e.el.style.display = '';
      e.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
      const texto = e.textoBalao();
      if (texto !== e._ultimoTexto) {
        e._ultimoTexto = texto;
        e.elBalao.textContent = texto || '';
        e.elBalao.classList.toggle('vazio', !texto);
      }
    }
  }
  requestAnimationFrame(quadro);

  // ======================================================================
  // Classes dos personagens (dentro da função para enxergar a cena)
  // ======================================================================
  function Pessoa(id, a) {
    const p = this;
    p.id = id;
    p.posto = POSTOS[id];
    p.raiz = new THREE.Group();
    p.raiz.userData.ent = p;
    p.corpo = grupo(0, 0, 0, p.raiz);
    p.velocidade = 2.5;
    p.caminho = [];
    p.aoChegar = null;
    p.modo = 'sentado';     // sentado | andando | parado
    p.digitando = false;
    p.status = '';
    p.fala = '';
    p.falaAte = 0;
    p.fila = Promise.resolve();
    p.humor = '';
    entidades.push(p);

    // pernas
    p.pernas = [-0.14, 0.14].map(x => {
      const g = grupo(x, 0.62, 0, p.corpo);
      caixa(0.24, 0.62, 0.28, a.calca, 0, -0.31, 0, g);
      caixa(0.26, 0.12, 0.36, a.sapato, 0, -0.56, 0.04, g);
      return g;
    });
    // tronco
    caixa(0.6, 0.68, 0.34, a.camisa, 0, 0.96, 0, p.corpo);
    if (a.frente) caixa(0.2, 0.6, 0.02, a.frente, 0, 0.99, 0.172, p.corpo);
    if (a.gravata) caixa(0.09, 0.44, 0.02, a.gravata, 0, 0.98, 0.185, p.corpo);
    if (id === 'estagiario') caixa(0.3, 0.08, 0.02, PRETO, 0, 1.1, 0.172, p.corpo);
    // braços
    p.bracos = [-1, 1].map(lado => {
      const g = grupo(lado * 0.39, 1.24, 0, p.corpo);
      caixa(0.18, 0.5, 0.22, a.camisa, 0, -0.24, 0, g);
      caixa(0.16, 0.14, 0.2, a.pele, 0, -0.55, 0, g);
      return g;
    });
    // cabeça
    p.cabeca = grupo(0, 1.3, 0, p.corpo);
    const c = p.cabeca;
    caixa(0.6, 0.58, 0.54, a.pele, 0, 0.29, 0, c);
    for (const lado of [-1, 1]) caixa(0.09, 0.12, 0.02, 0x1a1a1a, lado * 0.13, 0.32, 0.275, c);
    caixa(0.16, 0.04, 0.02, 0x7a3b2e, 0, 0.14, 0.275, c);
    const cab = a.cabelo;
    if (a.penteado === 'curto' || a.penteado === 'coque') {
      caixa(0.64, 0.14, 0.58, cab, 0, 0.6, 0, c);
      caixa(0.64, 0.4, 0.1, cab, 0, 0.42, -0.27, c);
      for (const lado of [-1, 1]) caixa(0.06, 0.22, 0.5, cab, lado * 0.31, 0.47, -0.02, c);
      if (a.penteado === 'coque') caixa(0.28, 0.28, 0.28, cab, 0, 0.74, -0.22, c);
    } else if (a.penteado === 'longo') {
      caixa(0.64, 0.14, 0.58, cab, 0, 0.6, 0, c);
      caixa(0.66, 0.78, 0.12, cab, 0, 0.24, -0.28, c);
      for (const lado of [-1, 1]) caixa(0.07, 0.6, 0.42, cab, lado * 0.32, 0.3, -0.06, c);
      caixa(0.6, 0.1, 0.06, cab, 0, 0.53, 0.27, c);
    } else if (a.penteado === 'topete') {
      caixa(0.64, 0.12, 0.58, cab, 0, 0.6, 0, c);
      caixa(0.5, 0.18, 0.2, cab, 0, 0.72, 0.18, c);
      caixa(0.64, 0.36, 0.1, cab, 0, 0.42, -0.27, c);
    }
    if (a.barba) {
      caixa(0.62, 0.18, 0.06, cab, 0, 0.07, 0.27, c);
      for (const lado of [-1, 1]) caixa(0.06, 0.28, 0.3, cab, lado * 0.31, 0.16, 0.12, c);
      caixa(0.16, 0.04, 0.02, 0x7a3b2e, 0, 0.17, 0.302, c);
    }
    if (a.oculos) {
      caixa(0.52, 0.035, 0.03, 0x111111, 0, 0.39, 0.29, c);
      for (const lado of [-1, 1]) caixa(0.19, 0.14, 0.02, 0x9fd0ff, lado * 0.13, 0.32, 0.29, c, { transparent: true, opacity: 0.45 });
    }
    if (a.bone) {
      caixa(0.64, 0.17, 0.58, a.bone, 0, 0.64, 0, c);
      caixa(0.5, 0.04, 0.3, a.bone, 0, 0.6, -0.42, c); // aba virada para trás
    }
    if (a.fone) {
      caixa(0.68, 0.06, 0.1, 0x111111, 0, 0.75, 0, c);
      for (const lado of [-1, 1]) caixa(0.08, 0.22, 0.22, 0x111111, lado * 0.34, 0.38, 0, c);
    }

    p.alturaEtiqueta = () => (p.modo === 'sentado' ? 2.05 : 2.2);
    p.textoBalao = () => {
      if (p.fala && performance.now() < p.falaAte) return p.fala;
      return p.status;
    };
    p.cutucar = () => {
      const frases = {
        chefe: ['Bora vender iPhone! 📈', 'Me passa a meta do dia?', 'Cadê o revisor? 👀'],
        analista: ['O CTR subiu! 📊', 'Custo por conversa conferido.', 'Planilha é vida.'],
        copywriter: ['Tenho um gancho novo ✍️', 'Primeira frase é tudo.', 'Café e copy ☕'],
        roteirista: ['3 segundos pra prender! 🎬', 'Gravei mentalmente.', 'Corta pro card amarelo!'],
        revisor: ['Preço confere? 🔎', 'Aprovado com ressalvas.', 'Isso o Meta reprova.'],
        estagiario: ['Primeiro dia! 😅', 'Posso ajudar?', 'Onde fica o café?'],
      };
      const lista = frases[id];
      p.falar(lista[Math.floor(Math.random() * lista.length)], 2600);
    };

    p.falar = (texto, ms = 2600) => { p.fala = texto; p.falaAte = performance.now() + ms; };
    p.enfileirar = fn => (p.fila = p.fila.then(fn).catch(err => console.error(err)));

    p.sentarJa = () => {
      const [x, z] = p.posto.assento;
      p.raiz.position.set(x, 0, z);
      p.raiz.rotation.y = p.posto.olhar;
      p.modo = 'sentado';
    };
    p.andar = pontos => new Promise(res => {
      p.modo = 'andando';
      p.digitando = false;
      p.caminho = pontos.map(([x, z]) => new THREE.Vector3(x, 0, z));
      p.aoChegar = res;
    });
    p.esperar = ms => new Promise(r => setTimeout(r, ms));
    p.olharPara = rot => { p.rotAlvo = rot; };

    // rota do assento até um ponto de visita na sala do chefe
    p.irAoChefe = async () => {
      const [vx, vz] = p.posto.visita;
      const ida = [...p.posto.rota.slice(1), [vx, 0], [vx, vz]];
      p.raiz.position.y = 0;
      await p.andar(ida);
      p.olharPara(PI);
      p.modo = 'parado';
    };
    p.voltarAoPosto = async () => {
      const [vx] = p.posto.visita;
      const volta = [[vx, 0], ...p.posto.rota.slice().reverse()];
      await p.andar(volta);
      p.sentarJa();
    };

    p.atualizar = (dt, t) => {
      const r = p.raiz;
      if (p.modo === 'andando' && p.caminho.length) {
        const alvo = p.caminho[0];
        const dx = alvo.x - r.position.x;
        const dz = alvo.z - r.position.z;
        const dist = Math.hypot(dx, dz);
        const passo = p.velocidade * dt;
        if (dist <= passo) {
          r.position.x = alvo.x; r.position.z = alvo.z;
          p.caminho.shift();
          if (!p.caminho.length) {
            p.modo = 'parado';
            const cb = p.aoChegar; p.aoChegar = null; cb?.();
          }
        } else {
          r.position.x += (dx / dist) * passo;
          r.position.z += (dz / dist) * passo;
          r.rotation.y = anguloAlvo(r.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 12));
        }
      }
      if (p.modo === 'parado' && p.rotAlvo != null) r.rotation.y = anguloAlvo(r.rotation.y, p.rotAlvo, Math.min(1, dt * 8));
      if (p.modo !== 'parado') p.rotAlvo = null;

      const [pe, pd] = p.pernas;
      const [be, bd] = p.bracos;
      if (p.modo === 'andando') {
        const s = Math.sin(t * 10);
        r.position.y = 0;
        pe.rotation.x = s * 0.6; pd.rotation.x = -s * 0.6;
        be.rotation.x = -s * 0.5; bd.rotation.x = s * 0.5;
        p.corpo.position.y = Math.abs(Math.cos(t * 10)) * 0.05;
        p.cabeca.rotation.x = 0;
      } else if (p.modo === 'sentado') {
        r.position.y = -0.1;
        pe.rotation.x = pd.rotation.x = -PI / 2;
        p.corpo.position.y = 0;
        if (p.digitando) {
          be.rotation.x = -1.15 + Math.sin(t * 18) * 0.08;
          bd.rotation.x = -1.15 + Math.sin(t * 18 + 1.6) * 0.08;
          p.cabeca.rotation.x = 0.12 + Math.sin(t * 2) * 0.03;
        } else {
          be.rotation.x = suave(be.rotation.x, -0.5, 0.1);
          bd.rotation.x = suave(bd.rotation.x, -0.5, 0.1);
          p.cabeca.rotation.x = Math.sin(t * 0.7 + p.raiz.position.x) * 0.05;
          p.cabeca.rotation.y = Math.sin(t * 0.4 + p.raiz.position.x) * 0.25;
        }
      } else {
        r.position.y = 0;
        pe.rotation.x = suave(pe.rotation.x, 0, 0.2);
        pd.rotation.x = suave(pd.rotation.x, 0, 0.2);
        be.rotation.x = suave(be.rotation.x, 0, 0.2);
        bd.rotation.x = suave(bd.rotation.x, 0, 0.2);
        p.corpo.position.y = Math.sin(t * 2) * 0.01;
        p.cabeca.rotation.x = 0;
      }
      if (p.humor && p.elHumor && p.elHumor.textContent !== p.humor) p.elHumor.textContent = p.humor + ' ';
    };
  }

  function Cachorro(id) {
    const d = this;
    d.id = id;
    d.cachorro = true;
    d.raiz = new THREE.Group();
    d.raiz.userData.ent = d;
    d.corpo = grupo(0, 0, 0, d.raiz);
    d.caminho = [];
    d.modo = 'parado';  // andando | parado | sentado | dormindo
    d.timer = 2 + Math.random() * 3;
    d.fala = ''; d.falaAte = 0;
    d.seguindo = null;
    entidades.push(d);

    if (id === 'peter') {
      // pastor belga malinois: dourado com máscara e orelhas pretas, orelhas em pé
      const ouro = 0xc8914a, escuro = 0x1d1510, dorso = 0xa8733a;
      d.velocidade = 2.7;
      d.alturaBase = 0.55;
      caixa(0.46, 0.42, 1.0, ouro, 0, 0.74, 0, d.corpo);
      caixa(0.47, 0.07, 0.62, dorso, 0, 0.97, -0.08, d.corpo);
      caixa(0.4, 0.34, 0.28, 0xd8a560, 0, 0.66, 0.42, d.corpo);
      d.pernas = [[-0.15, 0.36], [0.15, 0.36], [-0.15, -0.36], [0.15, -0.36]].map(([x, z]) => {
        const g = grupo(x, 0.58, z, d.corpo);
        caixa(0.13, 0.52, 0.13, ouro, 0, -0.26, 0, g);
        caixa(0.15, 0.08, 0.19, 0x8a5e2c, 0, -0.52, 0.02, g);
        return g;
      });
      caixa(0.3, 0.36, 0.3, ouro, 0, 0.98, 0.5, d.corpo).rotation.x = -0.4;
      caixa(0.34, 0.09, 0.34, AMARELO, 0, 0.95, 0.47, d.corpo).rotation.x = -0.4; // coleira RBTech
      d.cabeca = grupo(0, 1.14, 0.62, d.corpo);
      caixa(0.36, 0.34, 0.38, ouro, 0, 0, 0, d.cabeca);
      caixa(0.37, 0.12, 0.04, escuro, 0, 0.03, 0.19, d.cabeca);
      caixa(0.22, 0.18, 0.28, escuro, 0, -0.07, 0.3, d.cabeca);
      caixa(0.1, 0.07, 0.05, 0x050505, 0, -0.01, 0.45, d.cabeca);
      for (const l of [-1, 1]) {
        caixa(0.06, 0.06, 0.02, 0xffffff, l * 0.1, 0.07, 0.215, d.cabeca);
        caixa(0.04, 0.04, 0.02, 0x050505, l * 0.1, 0.07, 0.225, d.cabeca);
        const o = caixa(0.11, 0.26, 0.06, escuro, l * 0.12, 0.28, -0.05, d.cabeca);
        o.rotation.z = -l * 0.22;
      }
      d.rabo = grupo(0, 0.86, -0.5, d.corpo);
      caixa(0.09, 0.09, 0.5, ouro, 0, 0, -0.25, d.rabo);
      caixa(0.1, 0.1, 0.12, escuro, 0, 0, -0.5, d.rabo);
      d.rabo.rotation.x = 0.7;
    } else {
      // vira-latinha fiapuda: pequena, bege acinzentada, franja nos olhos, barbinha, bandana vermelha
      const pelo = 0xd8cbb2, cinza = 0xb5a78c, claro = 0xefe6d4;
      d.velocidade = 2.1;
      d.alturaBase = 0.3;
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
      caixa(0.32, 0.07, 0.3, 0xd7263d, 0, 0.58, 0.27, d.corpo); // bandana
      caixa(0.12, 0.12, 0.04, 0xd7263d, 0, 0.5, 0.42, d.corpo);
      d.cabeca = grupo(0, 0.7, 0.36, d.corpo);
      caixa(0.32, 0.3, 0.3, pelo, 0, 0, 0, d.cabeca);
      caixa(0.17, 0.13, 0.15, claro, 0, -0.06, 0.2, d.cabeca);
      caixa(0.08, 0.06, 0.04, 0x111111, 0, -0.01, 0.29, d.cabeca);
      for (const l of [-1, 1]) {
        caixa(0.05, 0.05, 0.02, 0x111111, l * 0.08, 0.05, 0.155, d.cabeca);
        const o = caixa(0.07, 0.22, 0.15, cinza, l * 0.19, -0.02, -0.02, d.cabeca);
        o.rotation.z = l * 0.15;
      }
      for (let i = 0; i < 5; i++) caixa(0.075, 0.1, 0.05, i % 2 ? cinza : claro, -0.15 + i * 0.075, 0.12, 0.16, d.cabeca); // franja
      for (let i = 0; i < 3; i++) caixa(0.06, 0.1, 0.05, claro, -0.06 + i * 0.06, -0.15, 0.25, d.cabeca); // barbinha
      caixa(0.1, 0.08, 0.1, claro, 0, 0.17, 0.02, d.cabeca); // topete
      d.rabo = grupo(0, 0.55, -0.3, d.corpo);
      caixa(0.08, 0.2, 0.08, pelo, 0, 0.1, 0, d.rabo);
      caixa(0.08, 0.08, 0.14, claro, 0, 0.2, 0.06, d.rabo);
      d.rabo.rotation.x = -0.4;
    }

    d.cabecaY = d.cabeca.position.y;
    d.alturaEtiqueta = () => (id === 'peter' ? 1.75 : 1.15) - (d.modo === 'dormindo' ? 0.6 : 0);
    d.textoBalao = () => {
      if (d.fala && performance.now() < d.falaAte) return d.fala;
      return d.modo === 'dormindo' ? 'zzz… 💤' : '';
    };
    d.falar = (texto, ms = 2200) => { d.fala = texto; d.falaAte = performance.now() + ms; };
    d.cutucar = () => {
      const f = id === 'peter'
        ? ['Au! 🐾', 'Au au! Vigiando o escritório.', '🦴?', 'Au! Bom trabalho, equipe!']
        : ['Arf! 🐶', 'Arf arf! Carinho?', 'Cadê meu petisco? 🍖', '*abana o rabo*'];
      if (d.modo === 'dormindo') d.modo = 'parado';
      d.falar(f[Math.floor(Math.random() * f.length)]);
      d.timer = 3;
    };
    d.colocar = (x, z, modo) => {
      d.raiz.position.set(x, 0, z);
      d.modo = modo;
      d.raiz.rotation.y = Math.random() * PI * 2;
    };
    const LUGARES = [
      [10.9, -7.0], [-10.4, 6.6], [-10.6, -6.6], [-3.2, -2.0], [0.5, 1.6], [6.0, 6.6], [-6, 6.8],
      [10.8, 1.5], [-11, 1.2], [8, -3.4], [2.5, -1.3], [-1.2, 6.0],
    ];
    const CAMA = id === 'peter' ? [10.9, -7.0] : [-10.4, 6.6];
    d.irPara = destino => {
      const [x, z] = destino;
      const p = d.raiz.position;
      const pontos = [];
      if (Math.abs(p.z) > 0.6) pontos.push([p.x, 0.0 + (Math.random() - 0.5) * 0.6]);
      pontos.push([x, (Math.random() - 0.5) * 0.6]);
      pontos.push([x, z]);
      d.caminho = pontos.map(([a, b]) => new THREE.Vector3(a, 0, b));
      d.modo = 'andando';
    };
    d.decidir = () => {
      if (d.seguindo) return;
      const r = Math.random();
      if (r < 0.18) { d.irPara(CAMA); d.depois = 'dormir'; }
      else if (r < 0.6) { d.irPara(LUGARES[Math.floor(Math.random() * LUGARES.length)]); d.depois = null; }
      else if (r < 0.8) { d.modo = 'sentado'; d.timer = 4 + Math.random() * 5; }
      else { d.modo = 'parado'; d.timer = 2 + Math.random() * 4; if (Math.random() < 0.4) d.falar(id === 'peter' ? 'Au!' : 'Arf!', 1400); }
    };
    d.seguir = pessoa => { d.seguindo = pessoa; d.modo = 'andando'; d.timerSeguir = 6; };

    d.atualizar = (dt, t) => {
      const r = d.raiz;
      if (d.seguindo) {
        d.timerSeguir -= dt;
        const alvo = d.seguindo.raiz.position;
        const dx = alvo.x - r.position.x, dz = alvo.z - r.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 1.1) {
          const passo = d.velocidade * dt;
          r.position.x += (dx / dist) * passo; r.position.z += (dz / dist) * passo;
          r.rotation.y = anguloAlvo(r.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 10));
          d.modo = 'andando';
        } else d.modo = 'parado';
        if (d.timerSeguir <= 0) { d.seguindo = null; d.modo = 'parado'; d.timer = 2; }
      } else if (d.modo === 'andando') {
        const alvo = d.caminho[0];
        if (!alvo) { d.modo = 'parado'; d.timer = 2; }
        else {
          const dx = alvo.x - r.position.x, dz = alvo.z - r.position.z;
          const dist = Math.hypot(dx, dz);
          const passo = d.velocidade * dt;
          if (dist <= passo) {
            r.position.x = alvo.x; r.position.z = alvo.z;
            d.caminho.shift();
            if (!d.caminho.length) {
              if (d.depois === 'dormir') { d.modo = 'dormindo'; d.timer = 14 + Math.random() * 16; }
              else { d.modo = 'parado'; d.timer = 2 + Math.random() * 3; }
              d.depois = null;
            }
          } else {
            r.position.x += (dx / dist) * passo; r.position.z += (dz / dist) * passo;
            r.rotation.y = anguloAlvo(r.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 10));
          }
        }
      } else {
        d.timer -= dt;
        if (d.timer <= 0) d.decidir();
      }

      // pose
      const andando = d.modo === 'andando';
      const ritmo = id === 'peter' ? 11 : 15;
      d.pernas.forEach((g, i) => {
        const fase = i === 0 || i === 3 ? 0 : PI;
        g.rotation.x = andando ? Math.sin(t * ritmo + fase) * 0.55 : suave(g.rotation.x, 0, 0.2);
      });
      let alvoY = 0, alvoPitch = 0;
      if (d.modo === 'sentado') { alvoPitch = -0.35; alvoY = -d.alturaBase * 0.22; }
      if (d.modo === 'dormindo') { alvoY = -d.alturaBase * 0.78; alvoPitch = 0; }
      d.corpo.position.y = suave(d.corpo.position.y, alvoY + (andando ? Math.abs(Math.sin(t * ritmo)) * 0.03 : 0), 0.15);
      d.corpo.rotation.x = suave(d.corpo.rotation.x, alvoPitch, 0.12);
      if (d.modo === 'sentado') {
        d.pernas[2].rotation.x = d.pernas[3].rotation.x = -1.2;
        d.pernas[0].rotation.x = d.pernas[1].rotation.x = 0.35;
      }
      d.cabeca.position.y = suave(d.cabeca.position.y, d.cabecaY - (d.modo === 'dormindo' ? d.alturaBase * 0.45 : 0), 0.1);
      if (d.modo === 'dormindo') {
        d.pernas.forEach((g, i) => { g.rotation.x = i < 2 ? -1.4 : 1.4; });
        d.cabeca.rotation.x = suave(d.cabeca.rotation.x, 0.75, 0.1);
        d.corpo.scale.y = 1 + Math.sin(t * 2) * 0.03;
      } else {
        d.corpo.scale.y = 1;
        d.cabeca.rotation.x = suave(d.cabeca.rotation.x, Math.sin(t * 1.3) * 0.08, 0.1);
        d.cabeca.rotation.z = Math.sin(t * 0.9 + (id === 'bibi' ? 2 : 0)) * (d.modo === 'parado' ? 0.18 : 0.04);
      }
      const abanando = d.modo !== 'dormindo';
      d.rabo.rotation.y = abanando ? Math.sin(t * (d.fala && performance.now() < d.falaAte ? 26 : 9)) * 0.55 : 0;
    };
  }

  // ======================================================================
  // API usada pelo app
  // ======================================================================
  function chamarPeter(pessoa) {
    if (Math.random() < 0.5 && caes.peter.modo !== 'dormindo') caes.peter.seguir(pessoa);
    else if (Math.random() < 0.4 && caes.bibi.modo !== 'dormindo') caes.bibi.seguir(pessoa);
  }

  const api = {
    cameras: CAMERAS,
    irParaCamera,
    cameraAtual: () => camAtual,
    pessoas,
    caes,

    /** Chefe pensando, esperando ou livre. */
    chefe(estado) {
      const c = pessoas.chefe;
      const textos = {
        pensando: '🤔 planejando…', esperando: '⏳ esperando a equipe', relatorio: '📝 escrevendo o relatório',
        livre: '', pronto: '✅ relatório pronto!',
      };
      c.status = textos[estado] ?? '';
      c.digitando = estado === 'pensando' || estado === 'relatorio';
      estadoTela.chefe && (estadoTela.chefe = { modo: c.digitando ? 'trabalhando' : 'livre', desde: relogio.elapsedTime });
      if (estado === 'pronto') setTimeout(() => { if (c.status.startsWith('✅')) c.status = ''; }, 6000);
    },
    chefeFala(texto, ms = 3500) { pessoas.chefe.falar(texto, ms); },
    gestor(g, estado) { if (g === 'chefe') api.chefe(estado); },
    fala(g, texto) { if (g === 'chefe') pessoas.chefe.falar(texto, 3500); },

    /** O chefe chama alguém: a pessoa vai até a mesa dele, volta e começa a trabalhar. */
    acionar(papel, gestor, resumo, tarefaTexto) {
      const p = pessoas[papel];
      if (!p) return;
      pessoas.chefe.falar(`📣 ${NOMES[papel]}, vem cá!`, 2200);
      p.enfileirar(async () => {
        p.status = '';
        p.falar('Indo! 🏃', 1500);
        chamarPeter(p);
        await p.irAoChefe();
        pessoas.chefe.falar(resumo, 3200);
        p.falar('Entendido! 👍', 2600);
        await p.esperar(2600);
        await p.voltarAoPosto();
        p.digitando = true;
        p.status = tarefaTexto;
        estadoTela[papel] = { modo: 'trabalhando', desde: relogio.elapsedTime };
      });
    },
    /** A entrega ficou pronta: leva até o chefe e volta. */
    entregar(papel, codigo) {
      const p = pessoas[papel];
      if (!p) return;
      p.enfileirar(async () => {
        p.digitando = false;
        p.status = '';
        estadoTela[papel] = { modo: 'pronto', desde: relogio.elapsedTime };
        p.falar('✅ Pronto!', 1600);
        await p.esperar(900);
        await p.irAoChefe();
        p.falar(`📄 Entrega ${codigo}`, 2600);
        pessoas.chefe.falar('Valeu! 👍', 2000);
        await p.esperar(2200);
        await p.voltarAoPosto();
        setTimeout(() => {
          if (estadoTela[papel]?.modo === 'pronto') estadoTela[papel] = { modo: 'livre', desde: relogio.elapsedTime };
        }, 8000);
      });
    },
    erro(papel) {
      const p = pessoas[papel];
      if (!p) return;
      p.enfileirar(async () => {
        p.digitando = false;
        p.status = '';
        estadoTela[papel] = { modo: 'livre', desde: relogio.elapsedTime };
        p.falar('⚠️ Deu erro aqui', 3000);
      });
    },
    comemorar() {
      caes.peter.falar('Au au! 🎉', 2600);
      caes.bibi.falar('Arf arf! 🎉', 2600);
      if (caes.peter.modo === 'dormindo') caes.peter.modo = 'parado';
      if (caes.bibi.modo === 'dormindo') caes.bibi.modo = 'parado';
      caes.peter.seguir(pessoas.chefe);
      caes.bibi.seguir(pessoas.chefe);
    },
    /** Quem está trabalhando agora (para a câmera automática). */
    ocupados() {
      return Object.values(pessoas).filter(p => p.digitando || p.modo !== 'sentado').map(p => p.id);
    },
    definirPlacar(dados, humorAtual) {
      placar = dados;
      humor = humorAtual;
      desenharPlacar(telas.placar, placar, humor);
      const icones = { confiante: '😎', normal: '🙂', alerta: '😬', incendio: '🔥' };
      pessoas.chefe.humor = icones[humor.id] || '';
      const temEstagiario = (dados?.diasNaMeta ?? 0) >= 10;
      pessoas.estagiario.raiz.visible = temEstagiario;
      mesaEstagiario.visible = temEstagiario;
    },
    foto() {
      renderer.render(cena, camera);
      return renderer.domElement.toDataURL('image/png');
    },
  };

  // fontes podem chegar depois: redesenha placas com texto
  document.fonts?.ready.then(() => {
    desenharLetreiro(telas.letreiro);
    desenharRegras(telas.regras);
    if (placar) desenharPlacar(telas.placar, placar, humor);
  });

  return api;
}

// ======================================================================
// Sala: chão, paredes, janela com a ponte, móveis
// ======================================================================
function montarSala(m, telas) {
  // laje (não projeta sombra: fica colada embaixo do piso)
  caixa(24.8, 0.5, 16.8, 0x24211d, 0, -0.26, 0, m).castShadow = false;
  // piso de madeira
  const piso = telaCanvas(512, 512);
  {
    const g = piso.ctx;
    const tons = ['#c9a27a', '#bf956b', '#d2ad86', '#c49a70'];
    const rnd = aleatorio(3);
    for (let y = 0; y < 512; y += 32) {
      let x = -Math.floor(rnd() * 120);
      while (x < 512) {
        const w = 120 + Math.floor(rnd() * 140);
        g.fillStyle = tons[Math.floor(rnd() * tons.length)];
        g.fillRect(x, y, w, 32);
        g.fillStyle = 'rgba(70,40,20,.35)';
        g.fillRect(x, y, 2, 32);
        x += w;
      }
      g.fillStyle = 'rgba(70,40,20,.35)';
      g.fillRect(0, y, 512, 2);
    }
    piso.t.wrapS = piso.t.wrapT = THREE.RepeatWrapping;
    piso.t.repeat.set(4, 2.7);
  }
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(24, 16), new THREE.MeshLambertMaterial({ map: piso.t }));
  chao.rotation.x = -PI / 2;
  chao.position.y = 0.001;
  chao.receiveShadow = true;
  m.add(chao);

  const PAREDE = 0xede6d8;
  // parede do fundo (direita sólida)
  caixa(13.6, 3.2, 0.3, PAREDE, 5.2, 1.6, -8.15, m);
  caixa(13.6, 0.16, 0.34, 0x3a332b, 5.2, 0.08, -7.98, m);
  // janela do fundo (esquerda) com vista para a ponte
  const JX = -6.75, JW = 10.5;
  caixa(JW, 0.9, 0.3, PAREDE, JX, 0.45, -8.15, m);
  caixa(JW, 0.4, 0.3, PAREDE, JX, 3.0, -8.15, m);
  for (let i = 0; i <= 4; i++) caixa(0.12, 1.9, 0.34, 0x2b2b2b, -12 + i * (JW / 4), 1.85, -8.12, m);
  caixa(JW, 0.1, 0.36, 0x2b2b2b, JX, 0.92, -8.1, m);
  caixa(JW, 0.1, 0.36, 0x2b2b2b, JX, 2.8, -8.1, m);
  const vidro = new THREE.Mesh(new THREE.PlaneGeometry(JW, 1.9),
    new THREE.MeshLambertMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.12 }));
  vidro.position.set(JX, 1.85, -8.05);
  m.add(vidro);
  telas.vista = telaCanvas(320, 150, true);
  desenharVista(telas.vista);
  // mostra só a faixa do meio do desenho (céu baixo, ponte e mar) com a proporção da janela
  telas.vista.t.repeat.set(1, (1.95 / 10.6) * (320 / 150));
  telas.vista.t.offset.set(0, 0.27);
  placa(10.6, 1.95, telas.vista.t, JX, 1.86, -8.42, 0, m);
  setInterval(() => desenharVista(telas.vista), 10 * 60 * 1000);

  // parede da esquerda
  caixa(0.3, 3.2, 16.3, 0xe4dccb, -12.15, 1.6, 0, m);
  caixa(0.34, 0.16, 16.3, 0x3a332b, -11.98, 0.08, 0, m);

  // letreiro RBTech atrás do chefe
  telas.letreiro = telaCanvas(640, 160);
  desenharLetreiro(telas.letreiro);
  caixa(3.4, 0.95, 0.08, PRETO, 8, 2.45, -7.96, m);
  placa(3.3, 0.85, telas.letreiro.t, 8, 2.45, -7.91, 0, m);

  // TV do placar
  telas.placar = telaCanvas(640, 360);
  caixa(3.3, 1.95, 0.12, 0x111111, 1.4, 1.95, -7.94, m);
  placa(3.1, 1.75, telas.placar.t, 1.4, 1.95, -7.87, 0, m);

  // quadro de regras na parede da esquerda
  telas.regras = telaCanvas(320, 400);
  desenharRegras(telas.regras);
  caixa(0.06, 2.1, 1.75, 0x1a1a1a, -11.97, 1.75, -1.6, m);
  placa(1.65, 2.0, telas.regras.t, -11.93, 1.75, -1.6, PI / 2, m);

  // prateleira com caixinhas de iPhone
  caixa(0.5, 0.08, 3.2, 0x8b5e3c, -11.75, 1.55, 3.6, m);
  caixa(0.5, 0.08, 3.2, 0x8b5e3c, -11.75, 2.25, 3.6, m);
  const cores = [0xffffff, 0xffffff, 0x1c1c1c, 0xffffff, 0xf2e6d0, 0xffffff];
  for (let i = 0; i < 6; i++) {
    caixa(0.3, 0.42, 0.18, cores[i], -11.75, 1.8, 2.3 + i * 0.5, m);
    caixa(0.3, 0.42, 0.18, cores[(i + 2) % 6], -11.75, 2.5, 2.3 + i * 0.5, m);
  }

  // divisória de vidro da sala do chefe
  for (const z of [-8, -5.25, -2.6]) caixa(0.12, 2.7, 0.12, 0x2b2b2b, 4, 1.35, z, m);
  caixa(0.12, 0.1, 5.5, 0x2b2b2b, 4, 2.7, -5.3, m);
  const vidro2 = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.6),
    new THREE.MeshLambertMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
  vidro2.rotation.y = PI / 2;
  vidro2.position.set(4, 1.35, -5.3);
  m.add(vidro2);
  caixa(0.04, 0.12, 5.4, AMARELO, 4, 1.2, -5.3, m); // faixa amarela no vidro

  // tapetes
  caixa(4.4, 0.02, 3.2, 0x2a2a2a, 8, 0.012, -5.2, m);
  caixa(5.8, 0.02, 3.4, 0xe9c63a, -6.6, 0.012, -4.6, m);

  // mesa do chefe
  mesa(m, 8, -5, 3.0, 1.4, 0x2d2d2d, 0x161616);
  cadeira(m, 8, -6.2, 0, true);
  telas.chefe = monitor(m, 8.55, -5.25, PI, 0x111111);
  caixa(0.6, 0.03, 0.42, 0x9aa0a6, 7.3, 0.85, -5.0, m); // notebook
  caneca(m, 7.0, -4.7);
  planta(m, 4.8, -7.4, 1.2);

  // mesas da equipe
  const cliente = { analista: [3, 3], copywriter: [-8, 3], roteirista: [-4, 3], revisor: [8, 3] };
  for (const [papel, [x, z]] of Object.entries(cliente)) {
    mesa(m, x, z, 2.4, 1.2, 0xf2f2f2, 0x2b2b2b);
    cadeira(m, x, z + 1.3, PI);
    if (papel === 'analista') {
      telas.analista = monitor(m, x, z - 0.25, 0, 0x111111);
      monitorEnfeite(m, x - 0.95, z - 0.15, 0.35);
      monitorEnfeite(m, x + 0.95, z - 0.15, -0.35);
    } else telas[papel] = monitor(m, x, z - 0.25, 0, 0x111111);
    caixa(0.7, 0.03, 0.22, 0x2b2b2b, x, 0.855, z + 0.25, m); // teclado
    caneca(m, x + 0.85, z + 0.25);
  }
  // celulares/iPhones de teste na mesa do roteirista
  caixa(0.14, 0.02, 0.28, 0x111111, -3.2, 0.85, 3.25, m);
  caixa(0.14, 0.02, 0.28, 0xe8e8e8, -3.0, 0.85, 3.2, m);
  // tripé com celular (roteirista grava reels)
  caixa(0.05, 1.3, 0.05, 0x222222, -2.6, 0.65, 1.6, m);
  caixa(0.16, 0.3, 0.03, 0x111111, -2.6, 1.42, 1.6, m);
  caixa(0.4, 0.4, 0.02, 0xfff3c4, -2.6, 1.45, 1.55, m, { emissive: 0xffe680, emissiveIntensity: 0.6 }); // ring light

  // mesa de reunião na janela
  mesa(m, -6.6, -4.6, 4, 1.8, 0x8b5e3c, 0x3a2a1a);
  for (const [x, z, r] of [[-7.9, -3.4, PI], [-6.6, -3.4, PI], [-5.3, -3.4, PI], [-7.9, -5.8, 0], [-6.6, -5.8, 0], [-5.3, -5.8, 0]]) {
    cadeira(m, x, z, r);
  }
  caixa(0.5, 0.04, 0.35, 0x111111, -6.2, 0.85, -4.5, m);

  // cantinho do café
  caixa(1.4, 0.95, 0.7, 0x3a2a1a, 11.1, 0.475, 6.5, m);
  caixa(0.45, 0.6, 0.4, 0x111111, 10.8, 1.25, 6.5, m);
  caixa(0.12, 0.08, 0.12, AMARELO, 10.8, 1.3, 6.72, m);
  caneca(m, 11.4, 6.4, 0.95);
  caneca(m, 11.6, 6.6, 0.95);

  // camas do Peter e da Bibi
  camaCachorro(m, 10.9, -7.0, 1.2, 0x1c1c1c, AMARELO);
  camaCachorro(m, -10.4, 6.6, 0.9, 0xd96b8a, 0xffd1dc);
  caixa(0.3, 0.08, 0.3, 0x3b6fd6, 10.0, 0.04, -7.4, m); // pote de água
  caixa(0.22, 0.03, 0.22, 0x7fc4ff, 10.0, 0.09, -7.4, m);

  // plantas
  planta(m, -11.2, -7.2, 1.4);
  planta(m, 11.3, 0.8, 1.1);
  planta(m, -11.3, 0.8, 1.0);
  planta(m, 3.4, -7.3, 1.0);
  planta(m, 11.3, 7.4, 1.3);
}

function mesa(m, x, z, w, d, corTampo, corPe) {
  caixa(w, 0.08, d, corTampo, x, 0.8, z, m);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    caixa(0.08, 0.78, 0.08, corPe, x + sx * (w / 2 - 0.1), 0.39, z + sz * (d / 2 - 0.1), m);
  }
}
function cadeira(m, x, z, rot, chefe = false) {
  const g = grupo(x, 0, z, m);
  g.rotation.y = rot;
  const cor = chefe ? 0x111111 : 0x2a2a2a;
  caixa(0.62, 0.1, 0.6, cor, 0, 0.48, 0, g);
  caixa(0.62, chefe ? 0.95 : 0.7, 0.09, cor, 0, chefe ? 1.0 : 0.88, -0.32, g);
  caixa(0.07, 0.4, 0.07, 0x555555, 0, 0.25, 0, g);
  caixa(0.55, 0.05, 0.08, 0x555555, 0, 0.04, 0, g);
  caixa(0.08, 0.05, 0.55, 0x555555, 0, 0.04, 0, g);
}
function caneca(m, x, z, y = 0.84) {
  caixa(0.12, 0.14, 0.12, 0xffffff, x, y + 0.07, z, m);
  caixa(0.1, 0.02, 0.1, 0x5a3a20, x, y + 0.14, z, m);
}
function planta(m, x, z, s) {
  caixa(0.5 * s, 0.5 * s, 0.5 * s, 0x2b2b2b, x, 0.25 * s, z, m);
  const verdes = [0x3f8f3a, 0x4fa64a, 0x2f7a2c];
  const rnd = aleatorio(Math.floor(x * 100 + z * 7) + 99);
  for (let i = 0; i < 6; i++) {
    const k = 0.25 + rnd() * 0.25;
    caixa(k * s, k * s, k * s, verdes[i % 3], x + (rnd() - 0.5) * 0.45 * s, (0.6 + rnd() * 0.7) * s, z + (rnd() - 0.5) * 0.45 * s, m);
  }
}
function camaCachorro(m, x, z, s, cor, almofada) {
  caixa(1.2 * s, 0.12, 0.95 * s, cor, x, 0.06, z, m);
  caixa(1.0 * s, 0.06, 0.75 * s, almofada, x, 0.14, z, m);
  caixa(1.2 * s, 0.24, 0.12, cor, x, 0.18, z - 0.42 * s, m);
  caixa(0.12, 0.24, 0.95 * s, cor, x - 0.54 * s, 0.18, z, m);
  caixa(0.12, 0.24, 0.95 * s, cor, x + 0.54 * s, 0.18, z, m);
}
function monitor(m, x, z, rot, cor) {
  const g = grupo(x, 0.84, z, m);
  g.rotation.y = rot;
  caixa(0.08, 0.3, 0.08, 0x333333, 0, 0.15, -0.02, g);
  caixa(0.36, 0.03, 0.22, 0x333333, 0, 0.015, -0.02, g);
  caixa(1.0, 0.62, 0.05, cor, 0, 0.6, 0, g);
  const tela = telaCanvas(256, 160);
  placa(0.94, 0.56, tela.t, 0, 0.6, 0.027, 0, g);
  return tela;
}
function monitorEnfeite(m, x, z, rot) {
  const g = grupo(x, 0.84, z, m);
  g.rotation.y = rot;
  caixa(0.06, 0.3, 0.06, 0x333333, 0, 0.15, 0, g);
  caixa(0.8, 0.5, 0.05, 0x111111, 0, 0.52, 0, g);
  const tela = telaCanvas(128, 80);
  const c = tela.ctx;
  c.fillStyle = '#0e1622'; c.fillRect(0, 0, 128, 80);
  c.strokeStyle = '#ffd60a'; c.lineWidth = 3; c.beginPath();
  [70, 62, 66, 50, 44, 38, 30, 22].forEach((y, i) => (i ? c.lineTo(8 + i * 16, y) : c.moveTo(8, y)));
  c.stroke();
  c.fillStyle = '#2fd17a';
  for (let i = 0; i < 6; i++) c.fillRect(10 + i * 19, 74 - (i + 2) * 5, 10, (i + 2) * 5);
  tela.t.needsUpdate = true;
  placa(0.75, 0.45, tela.t, 0, 0.52, 0.027, 0, g);
}
function montarMesaEstagiario(m, telas) {
  const g = grupo(0, 0, 0, m);
  mesa(g, -0.3, 6.0, 1.8, 1.0, 0xf2f2f2, 0x2b2b2b);
  cadeira(g, -0.3, 7.2, PI);
  telas.estagiario = monitor(g, -0.3, 5.8, 0, 0x111111);
  // balão "bem-vindo"
  caixa(0.06, 1.2, 0.06, 0xffffff, 0.5, 1.4, 5.7, g);
  caixa(0.35, 0.42, 0.35, AMARELO, 0.5, 2.15, 5.7, g);
  return g;
}

// ======================================================================
// Desenhos das telas (canvas)
// ======================================================================
function desenharVista(tela) {
  const g = tela.ctx;
  const W = 320, H = 150;
  const hora = new Date().getHours();
  const periodo = hora >= 7 && hora < 17 ? 'dia' : (hora >= 17 && hora < 19) || (hora >= 5 && hora < 7) ? 'tarde' : 'noite';
  const ceus = {
    dia: ['#7cc4f2', '#a9dcf7', '#d7f0fb'],
    tarde: ['#3d3b7a', '#e2766a', '#ffc27a'],
    noite: ['#070b1c', '#101a38', '#1d2a50'],
  }[periodo];
  for (let i = 0; i < 3; i++) { g.fillStyle = ceus[i]; g.fillRect(0, i * 26, W, 26); }
  g.fillStyle = ceus[2]; g.fillRect(0, 78, W, 20);
  if (periodo === 'noite') {
    g.fillStyle = '#fff';
    const rnd = aleatorio(11);
    for (let i = 0; i < 40; i++) g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * 70), 1, 1);
    g.fillStyle = '#f4f1da'; g.fillRect(260, 14, 10, 10);
  } else {
    g.fillStyle = periodo === 'dia' ? '#fff6c2' : '#ffd36a';
    g.fillRect(periodo === 'dia' ? 250 : 40, periodo === 'dia' ? 12 : 60, 14, 14);
  }
  // morros do continente
  g.fillStyle = periodo === 'noite' ? '#0e1a14' : periodo === 'tarde' ? '#3d4a3a' : '#4f7d52';
  for (let x = 0; x < W; x += 4) {
    const h = 14 + Math.round(Math.sin(x / 37) * 6 + Math.sin(x / 13) * 3);
    g.fillRect(x, 96 - h, 4, h);
  }
  // mar
  g.fillStyle = periodo === 'noite' ? '#0b1a33' : periodo === 'tarde' ? '#5a5f8f' : '#2f7fb8';
  g.fillRect(0, 96, W, 54);
  g.fillStyle = periodo === 'noite' ? '#1b2d55' : '#5aa3d6';
  const rnd = aleatorio(5);
  for (let i = 0; i < 50; i++) g.fillRect(Math.floor(rnd() * W), 100 + Math.floor(rnd() * 50), 6, 1);
  // ponte pênsil: duas torres, cabo principal e tabuleiro
  const ponte = periodo === 'noite' ? '#c9b98a' : '#d9d9d9';
  const deckY = 100;
  g.fillStyle = ponte;
  g.fillRect(20, deckY, 280, 3);
  for (const tx of [110, 210]) { g.fillRect(tx - 3, 52, 3, 52); g.fillRect(tx + 3, 52, 3, 52); g.fillRect(tx - 3, 52, 9, 3); }
  const cabo = x => {
    if (x < 110) return 54 + ((110 - x) / 90) * 44;
    if (x > 210) return 54 + ((x - 210) / 90) * 44;
    const u = (x - 160) / 50;
    return 54 + (1 - u * u) * 38;
  };
  for (let x = 20; x <= 300; x++) {
    const y = Math.round(cabo(x));
    g.fillStyle = ponte;
    g.fillRect(x, y, 1, 2);
    if (x % 6 === 0 && y < deckY) { g.fillStyle = periodo === 'noite' ? '#8a7f60' : '#bcbcbc'; g.fillRect(x, y, 1, deckY - y); }
    if (periodo === 'noite' && x % 10 === 0) { g.fillStyle = '#ffe680'; g.fillRect(x, y - 1, 2, 2); }
  }
  // prédios da ilha
  const rb = aleatorio(21);
  for (let x = 0; x < W; x += 9) {
    if (x > 40 && x < 280) continue;
    const h = 10 + Math.floor(rb() * 26);
    g.fillStyle = periodo === 'noite' ? '#151b2a' : '#c9c2b6';
    g.fillRect(x, 98 - h, 8, h);
    g.fillStyle = periodo === 'noite' ? '#ffd86b' : '#8fa6b8';
    for (let y = 98 - h + 2; y < 96; y += 4) for (let k = 1; k < 7; k += 3) if (rb() < (periodo === 'noite' ? 0.5 : 0.8)) g.fillRect(x + k, y, 1, 2);
  }
  tela.t.needsUpdate = true;
}

function desenharLetreiro(tela) {
  const g = tela.ctx;
  g.fillStyle = '#0f0f0f'; g.fillRect(0, 0, 640, 160);
  g.fillStyle = '#ffd60a';
  g.font = `800 92px ${FONTE}`;
  g.textBaseline = 'middle';
  g.fillText('RBTECH', 30, 70);
  g.fillStyle = '#f4f4f4';
  g.font = `600 26px ${FONTE}`;
  g.fillText('AGÊNCIA DE TRÁFEGO', 30, 132);
  g.fillStyle = '#ffd60a';
  g.fillRect(560, 30, 50, 50);
  g.fillStyle = '#0f0f0f';
  g.font = `800 34px ${FONTE}`;
  g.fillText('▶', 572, 57);
  tela.t.needsUpdate = true;
}

function desenharRegras(tela) {
  const g = tela.ctx;
  g.fillStyle = '#ffd60a'; g.fillRect(0, 0, 320, 400);
  g.fillStyle = '#0f0f0f';
  g.font = `800 34px ${FONTE}`;
  g.fillText('REGRAS', 24, 58);
  g.font = `600 17px ${FONTE}`;
  g.fillText('DA AGÊNCIA', 24, 84);
  const regras = ['Nada sai sem o', 'revisor.', '', 'Preço é só o que', 'a loja passou.', '', 'Quem aprova verba', 'é o dono.', '', 'Petisco só depois', 'da meta. 🐾'];
  g.font = `600 20px ${FONTE}`;
  let y = 140, n = 1;
  for (const linha of regras) {
    if (!linha) { y += 12; continue; }
    const novo = regras[regras.indexOf(linha) - 1] === '' || regras.indexOf(linha) === 0;
    g.fillText((novo ? `${n++}. ` : '    ') + linha, 24, y);
    y += 26;
  }
  tela.t.needsUpdate = true;
}

const brl = n => 'R$ ' + (Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : '–');

function desenharPlacar(tela, p, humor) {
  if (!tela) return;
  const g = tela.ctx;
  g.fillStyle = '#0f0f0f'; g.fillRect(0, 0, 640, 360);
  g.fillStyle = '#ffd60a';
  g.font = `700 22px ${FONTE}`;
  g.fillText('● PLACAR DE HOJE', 28, 44);
  if (!p) { tela.t.needsUpdate = true; return; }
  g.fillStyle = '#9a9a9a';
  g.font = `500 18px ${FONTE}`;
  g.textAlign = 'right';
  g.fillText(new Date().toLocaleDateString('pt-BR'), 612, 44);
  g.textAlign = 'left';

  g.fillStyle = '#ffffff';
  g.font = `800 96px ${FONTE}`;
  g.fillText(String(p.conversasHoje ?? 0), 28, 152);
  g.fillStyle = '#bdbdbd';
  g.font = `600 20px ${FONTE}`;
  g.fillText('conversas no WhatsApp', 30, 182);

  const custo = p.conversasHoje > 0 ? p.investimentoHoje / p.conversasHoje : NaN;
  const bom = custo <= p.metaCusto;
  g.fillStyle = bom ? '#2fd17a' : '#ff5a5a';
  g.font = `800 54px ${FONTE}`;
  g.fillText(brl(custo), 340, 124);
  g.fillStyle = '#bdbdbd';
  g.font = `600 18px ${FONTE}`;
  g.fillText(`por conversa · meta ${brl(p.metaCusto)}`, 342, 152);
  g.fillText(`investido hoje ${brl(p.investimentoHoje)}`, 342, 178);

  // sequência de dias na meta
  g.fillStyle = '#ffd60a';
  g.font = `700 18px ${FONTE}`;
  g.fillText(`DIAS NA META: ${Math.min(p.diasNaMeta, 10)}/10 → ESTAGIÁRIO NOVO`, 28, 236);
  for (let i = 0; i < 10; i++) {
    g.fillStyle = i < p.diasNaMeta ? '#ffd60a' : '#2b2b2b';
    g.fillRect(28 + i * 58, 252, 48, 22);
  }
  // humor do chefe
  g.fillStyle = humor?.cor || '#fff';
  g.font = `700 22px ${FONTE}`;
  g.fillText(`HUMOR DO CHEFE: ${(humor?.nome || '').toUpperCase()}`, 28, 322);
  if (p.ehExemplo) {
    g.fillStyle = '#ffd60a';
    g.fillRect(470, 300, 142, 34);
    g.fillStyle = '#0f0f0f';
    g.font = `800 18px ${FONTE}`;
    g.fillText('EXEMPLO', 498, 324);
  }
  tela.t.needsUpdate = true;
}

function desenharMonitor(tela, papel, modo, tempo) {
  const g = tela.ctx;
  const W = 256, H = 160;
  if (modo === 'livre') {
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#141414'); grad.addColorStop(1, '#262626');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffd60a'; g.fillRect(98, 52, 60, 40);
    g.fillStyle = '#0f0f0f'; g.font = `800 22px ${FONTE}`; g.fillText('RB', 112, 80);
    g.fillStyle = '#777'; g.font = `500 12px ${FONTE}`; g.fillText(NOMES[papel] || '', 10, 150);
    tela.t.needsUpdate = true;
    return;
  }
  if (modo === 'pronto') {
    g.fillStyle = '#0f2a1b'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2fd17a'; g.font = `800 64px ${FONTE}`; g.fillText('✓', 104, 92);
    g.font = `700 20px ${FONTE}`; g.fillText('PRONTO', 90, 128);
    tela.t.needsUpdate = true;
    return;
  }
  const ciclo = (tempo % 24) / 24;
  if (papel === 'copywriter' || papel === 'chefe') {
    g.fillStyle = '#fbfbf7'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffd60a'; g.fillRect(0, 0, W, 18);
    g.fillStyle = '#111'; g.font = `700 11px ${FONTE}`;
    g.fillText(papel === 'chefe' ? 'Plano da semana' : `Anúncio · variação ${1 + Math.floor(tempo / 24) % 3}`, 8, 13);
    const linhas = Math.floor(ciclo * 14);
    for (let i = 0; i < linhas; i++) {
      g.fillStyle = i % 5 === 0 ? '#222' : '#9a9a9a';
      g.fillRect(12, 30 + i * 9, 60 + ((i * 53) % 160), i % 5 === 0 ? 5 : 4);
    }
    if (Math.floor(tempo * 2) % 2) { g.fillStyle = '#111'; g.fillRect(14 + ((linhas * 53) % 160) + 50, 28 + linhas * 9, 2, 8); }
  } else if (papel === 'roteirista') {
    g.fillStyle = '#121212'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      const on = ciclo * 5 > i;
      g.fillStyle = on ? (i % 2 ? '#ffd60a' : '#f4f4f4') : '#2a2a2a';
      g.fillRect(14 + i * 60, 18, 48, 84);
      if (on) { g.fillStyle = '#111'; g.fillRect(20 + i * 60, 74, 36, 6); g.fillRect(20 + i * 60, 84, 26, 5); }
    }
    g.fillStyle = '#2a2a2a'; g.fillRect(14, 120, 228, 10);
    g.fillStyle = '#ff5a5a'; g.fillRect(14 + ciclo * 228, 114, 3, 22);
    g.fillStyle = '#ffd60a'; g.fillRect(14, 120, ciclo * 228, 10);
  } else if (papel === 'analista') {
    g.fillStyle = '#0e1622'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#9fb3c8'; g.font = `600 11px ${FONTE}`; g.fillText('Meta Ads · últimos 7 dias', 10, 16);
    for (let i = 0; i < 7; i++) {
      const h = (20 + ((i * 37) % 60)) * Math.min(1, ciclo * 3 - i * 0.2 + 0.4);
      g.fillStyle = i === 6 ? '#ffd60a' : '#3b6fd6';
      g.fillRect(14 + i * 33, 140 - Math.max(0, h), 22, Math.max(0, h));
    }
    g.strokeStyle = '#2fd17a'; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i < 7; i++) { const y = 60 - Math.sin(i + tempo) * 10 - i * 4; i ? g.lineTo(25 + i * 33, y) : g.moveTo(25, y); }
    g.stroke();
  } else if (papel === 'revisor') {
    g.fillStyle = '#fbfbf7'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#111'; g.font = `700 12px ${FONTE}`; g.fillText('Revisão', 10, 16);
    const itens = ['Preço e condições', 'Regras do Meta', 'Clareza do gancho', 'Chamada WhatsApp', 'Português'];
    g.font = `500 12px ${FONTE}`;
    itens.forEach((t, i) => {
      const ok = ciclo * 6 > i + 1;
      g.fillStyle = ok ? '#1e9e5a' : '#bbb';
      g.fillText(ok ? '✓' : '○', 12, 40 + i * 24);
      g.fillStyle = '#333';
      g.fillText(t, 30, 40 + i * 24);
    });
  } else {
    g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, W, H);
  }
  tela.t.needsUpdate = true;
}
