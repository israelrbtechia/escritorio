// Modo jogo: você (Israel) dirige pela SC-281 no meio do trânsito, estaciona na frente da loja, sai do carro,
// entra pela porta automática, anda pelo prédio, sobe de elevador, conversa com a equipe e brinca com Peter e Bibi.
// Também tem o trânsito da rodovia, que roda sempre (mesmo fora do jogo).
// Teclado: WASD/setas andam ou dirigem · Shift corre · E entra/sai do carro · Espaço ou 1–4 fazem a ação mostrada.
// Celular: joystick à esquerda, botões de ação à direita, arraste a tela para girar a câmera e use a pinça para o zoom.
import * as THREE from 'three';

const AMARELO = 0xffd60a;
const caixa = (w, h, d, cor, x, y, z, pai) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: cor }));
  m.position.set(x, y, z); m.castShadow = true; pai.add(m); return m;
};
const suave = (a, b, k) => a + (b - a) * k;
const angulo = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };

/** Carro em blocos (a frente aponta para +z). */
export function montarCarro(cor = 0x3b6fd6) {
  const g = new THREE.Group();
  const corpo = new THREE.Group(); g.add(corpo);
  caixa(1.9, 0.62, 4.3, cor, 0, 0.62, 0, corpo);
  caixa(1.7, 0.58, 2.2, cor, 0, 1.2, -0.25, corpo);
  caixa(1.72, 0.44, 0.05, 0x1d2b36, 0, 1.2, 0.86, corpo);   // para-brisa
  caixa(1.72, 0.4, 0.05, 0x1d2b36, 0, 1.2, -1.36, corpo);   // vidro de trás
  for (const l of [-1, 1]) caixa(0.05, 0.38, 1.9, 0x1d2b36, l * 0.86, 1.22, -0.25, corpo); // janelas
  for (const l of [-1, 1]) {
    caixa(0.36, 0.16, 0.06, 0xfff3c4, l * 0.62, 0.72, 2.15, corpo);   // farol
    caixa(0.36, 0.14, 0.06, 0xd23a2a, l * 0.62, 0.74, -2.15, corpo);  // lanterna
  }
  caixa(1.95, 0.18, 0.12, 0x222222, 0, 0.36, 2.17, corpo);
  caixa(1.95, 0.18, 0.12, 0x222222, 0, 0.36, -2.17, corpo);
  g.userData.rodas = [[-0.92, 1.35], [0.92, 1.35], [-0.92, -1.35], [0.92, -1.35]].map(([x, z]) => {
    const r = new THREE.Group(); r.position.set(x, 0.36, z); g.add(r);
    caixa(0.3, 0.72, 0.72, 0x161616, 0, 0, 0, r);
    caixa(0.32, 0.3, 0.3, 0x9a9a9a, 0, 0, 0, r);
    return r;
  });
  return g;
}

/** Junta os pedaços da SC-281 (vias com faixa) numa linha só, com distância acumulada. */
function rotaDaRodovia(dados) {
  const pedacos = dados.vias.filter(v => v.faixa).map(v => { const p = []; for (let i = 0; i < v.p.length; i += 3) p.push([v.p[i], v.p[i + 1], v.p[i + 2]]); return p; });
  if (!pedacos.length) return null;
  pedacos.sort((a, b) => b.length - a.length);
  let linha = pedacos.shift();
  const perto = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]) < 4;
  for (let mudou = true; mudou && pedacos.length;) {
    mudou = false;
    for (const p of [...pedacos]) {
      if (perto(linha[linha.length - 1], p[0])) linha = linha.concat(p.slice(1));
      else if (perto(linha[linha.length - 1], p[p.length - 1])) linha = linha.concat(p.slice(0, -1).reverse());
      else if (perto(linha[0], p[p.length - 1])) linha = p.slice(0, -1).concat(linha);
      else if (perto(linha[0], p[0])) linha = p.slice(1).reverse().concat(linha);
      else continue;
      pedacos.splice(pedacos.indexOf(p), 1); mudou = true;
    }
  }
  const s = [0];
  for (let i = 1; i < linha.length; i++) s.push(s[i - 1] + Math.hypot(linha[i][0] - linha[i - 1][0], linha[i][2] - linha[i - 1][2]));
  const total = s[s.length - 1];
  /** Ponto, direção e altura na distância d (com deslocamento lateral: + = lado direito de quem anda no sentido crescente). */
  function ponto(d, lado = 0) {
    d = Math.min(Math.max(d, 0), total);
    let i = 1; while (i < s.length - 1 && s[i] < d) i++;
    const a = linha[i - 1], b = linha[i], t = (d - s[i - 1]) / ((s[i] - s[i - 1]) || 1);
    let fx = b[0] - a[0], fz = b[2] - a[2]; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    return { x: a[0] + (b[0] - a[0]) * t - fz * lado, y: a[1] + (b[1] - a[1]) * t, z: a[2] + (b[2] - a[2]) * t + fx * lado, fx, fz };
  }
  /** Distância ao longo da rodovia do ponto mais perto, e a distância lateral (assinada) até o centro. */
  function projetar(x, z) {
    let melhor = { d: 0, lat: Infinity };
    for (let i = 1; i < linha.length; i++) {
      const a = linha[i - 1], b = linha[i];
      const vx = b[0] - a[0], vz = b[2] - a[2], len2 = vx * vx + vz * vz || 1;
      const t = Math.min(1, Math.max(0, ((x - a[0]) * vx + (z - a[2]) * vz) / len2));
      const px = a[0] + vx * t, pz = a[2] + vz * t, dist = Math.hypot(x - px, z - pz);
      if (dist < Math.abs(melhor.lat)) {
        const l = Math.sqrt(len2);
        melhor = { d: s[i - 1] + t * l, lat: ((x - px) * (-vz / l) + (z - pz) * (vx / l)) || dist };
      }
    }
    return melhor;
  }
  return { total, ponto, projetar };
}

/** Trânsito da SC-281: carros nas duas mãos, freiam para quem está na frente (inclusive você). */
export function criarTransito({ cena, dados }) {
  const rota = rotaDaRodovia(dados);
  if (!rota || rota.total < 120) return null;
  const CORES = [0xff4fa0, 0xf6f2ea, 0x18d1e0, 0x1c1c1c, 0xff9f43, 0x8b5cf6, 0xd7263d, 0x3dd598]; // cores de carro de cidade tropical
  const carros = [];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const g = montarCarro(CORES[i % CORES.length]);
    cena.add(g);
    carros.push({ g, sentido: i % 2 ? -1 : 1, d: (rota.total / N) * i + 7, vel: 11, max: 10 + (i * 7) % 5, raio: 2.3 });
  }
  // dois carros parados no pátio da loja
  for (const [x, z, a, cor] of [[-16.5, 3.5, 0.15, 0xf2f2f2], [17, 1.5, -0.1, 0x1c1c1c]]) {
    const g = montarCarro(cor); g.position.set(x, -0.52, z); g.rotation.y = a; cena.add(g);
  }
  let alvos = []; // o que os carros precisam respeitar: { x, z } (seu carro, você a pé)
  return {
    rota,
    carros,
    definirObstaculos(lista) { alvos = lista; },
    /** Algum carro do trânsito encosta neste círculo? */
    colide(x, z, r) { return carros.some(c => c.g.visible && Math.hypot(c.g.position.x - x, c.g.position.z - z) < r + c.raio); },
    atualizar(dt) {
      const proj = alvos.map(a => rota.projetar(a.x, a.z));
      for (const c of carros) {
        // quem está à frente na mesma mão
        let livre = 40;
        for (const o of carros) {
          if (o === c || o.sentido !== c.sentido) continue;
          const dist = (o.d - c.d) * c.sentido;
          if (dist > 0 && dist < livre) livre = dist;
        }
        for (const p of proj) {
          if (Math.abs(p.lat - 2.4 * c.sentido) > 3.2) continue;
          const dist = (p.d - c.d) * c.sentido;
          if (dist > 0 && dist < livre) livre = dist;
        }
        const alvoVel = livre < 9 ? 0 : livre < 22 ? c.max * (livre - 9) / 13 : c.max;
        c.vel = suave(c.vel, alvoVel, Math.min(1, dt * (alvoVel < c.vel ? 3 : 0.8)));
        c.d += c.vel * c.sentido * dt;
        if (c.d > rota.total) c.d -= rota.total; else if (c.d < 0) c.d += rota.total;
        const p = rota.ponto(c.d, 2.4 * c.sentido);
        c.g.position.set(p.x, p.y - 0.05, p.z);
        c.g.rotation.y = Math.atan2(p.fx * c.sentido, p.fz * c.sentido);
        for (const r of c.g.userData.rodas) r.rotation.x += c.vel * dt / 0.36;
        c.g.visible = c.d > 3 && c.d < rota.total - 3;
      }
    },
  };
}

/**
 * Cria o jogo. ctx vem do escritório 3D: cena, camera, controles, renderer, container, pessoas, caes, clientes,
 * entidades, criarPessoa, aplicarLimite, viajarJogador, chao (malhas do chão), dados do bairro, transito, constantes e emitir.
 */
export function criarJogo(ctx) {
  const { cena, camera, pessoas, caes, ALT, ELEVADOR, GESTOR_DE, CHEFES, NOMES } = ctx;
  const toque = matchMedia('(pointer: coarse)').matches;
  const raio = new THREE.Raycaster();
  const baixo = new THREE.Vector3(0, -1, 0);

  // ---------- você e o seu carro ----------
  const eu = ctx.criarPessoa('jogador', { andar: 0, ap: ctx.PESSOAS_3D.israel.ap, decor: true, posto: { assento: [0, 12], olhar: 0, empe: true, rota: [[0, 12]] } }, { nome: 'Você · Israel' });
  eu.ativo = false; // começa dentro do carro
  pessoas.israel.ativo = false; // o Israel do terraço é você agora
  const carro = montarCarro(AMARELO);
  cena.add(carro);
  const placa = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.04), new THREE.MeshLambertMaterial({ color: 0x0f0f0f }));
  placa.position.set(0, 0.62, 2.2); carro.add(placa);

  const rota = ctx.transito()?.rota;
  const est = {
    noCarro: true,
    car: { x: 0, z: 30, y: 0, h: Math.PI / 2, v: 0 },
    camYaw: 0, camPitch: 0.42, camDist: 9.5, camAlvo: new THREE.Vector3(),
    teclas: new Set(), joy: { x: 0, y: 0 },
    acoes: [], chave: '', bola: null, cachorroControle: null,
    falandoCom: null,
  };
  // começa na SC-281, 140 m antes da loja, na mão de quem vai para a loja
  if (rota) {
    const loja = rota.projetar(0, 16.6);
    const sentido = loja.d > 140 ? 1 : -1;
    const p = rota.ponto(loja.d - 140 * sentido, 2.4 * sentido);
    Object.assign(est.car, { x: p.x, z: p.z, y: p.y, h: Math.atan2(p.fx * sentido, p.fz * sentido) });
  } else Object.assign(est.car, { x: -60, z: 21, h: Math.PI / 2 });
  est.camYaw = est.car.h;

  // ---------- chão, casas e prédio (colisão) ----------
  const origem = new THREE.Vector3();
  function alturaDoChao(x, z, padrao = 0) {
    raio.set(origem.set(x, 400, z), baixo);
    raio.far = 800;
    const hit = raio.intersectObjects(ctx.chao(), false)[0];
    return hit ? hit.point.y : padrao;
  }
  let casas = [], grade = null;
  function prepararCasas() {
    const dados = ctx.dados();
    if (grade || !dados) return;
    casas = dados.casas || [];
    grade = new Map();
    casas.forEach((c, i) => { const k = `${Math.floor(c[0] / 20)},${Math.floor(c[1] / 20)}`; if (!grade.has(k)) grade.set(k, []); grade.get(k).push(i); });
  }
  function bateEmCasa(x, z, r) {
    prepararCasas();
    if (!grade) return false;
    const gx = Math.floor(x / 20), gz = Math.floor(z / 20);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const k of grade.get(`${gx + i},${gz + j}`) || []) {
        const [cx, cz, ang, w, d] = casas[k];
        const dx = x - cx, dz = z - cz, c = Math.cos(ang), s = Math.sin(ang);
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) < w / 2 + r && Math.abs(lz) < d / 2 + r) return true;
      }
    }
    return false;
  }
  const naCasca = (x, z, r = 0) => (x > -12.4 - r && x < 12.4 + r && z > -8.4 - r && z < 8.4 + r) || (x >= 12.4 && x < 14.7 + r && z > -2.8 - r && z < -0.2 + r);
  const naPorta = x => Math.abs(x) < 1.15;

  // ---------- HUD ----------
  const hud = document.createElement('div');
  hud.className = 'hud-jogo';
  hud.innerHTML = `
    <div class="hud-topo"><strong>🎮 Prédio RBTech</strong><span class="hud-status"></span><span class="hud-caes"></span><button type="button" class="hud-sair">✕ Sair do jogo</button></div>
    <div class="hud-aviso" hidden></div>
    <div class="hud-dica">${toque ? 'Joystick: andar ou dirigir · arraste a tela para girar e inclinar a câmera · pinça: zoom' : 'WASD ou setas: andar/dirigir · Shift: correr · E: entrar/sair do carro · Espaço ou 1–4: ações · arraste: girar e inclinar a câmera · rodinha: zoom · 🎮 controle de PS4: aperte qualquer botão'}</div>
    <div class="hud-acoes"></div>
    <div class="hud-joy"${toque ? '' : ' hidden'}><div class="hud-joy-bola"></div></div>
    <form class="hud-pedido" hidden><span></span><input type="text" maxlength="500" placeholder="O que você quer pedir?" autocomplete="off"><button type="submit">Enviar</button><button type="button" class="hud-cancelar">✕</button></form>`;
  ctx.container.parentElement.appendChild(hud);
  const $h = s => hud.querySelector(s);
  let avisoAte = 0;
  function aviso(texto, ms = 3500) { const a = $h('.hud-aviso'); a.textContent = texto; a.hidden = false; avisoAte = performance.now() + ms; }
  $h('.hud-sair').addEventListener('click', () => ctx.sair());
  if (toque) setTimeout(() => { $h('.hud-dica').hidden = true; }, 15000);

  // joystick (toque)
  const joy = $h('.hud-joy'), bolaJoy = $h('.hud-joy-bola');
  let joyId = null, joyCentro = null;
  joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); const r = joy.getBoundingClientRect(); joyCentro = [r.left + r.width / 2, r.top + r.height / 2]; mexerJoy(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) mexerJoy(e); });
  const soltarJoy = e => { if (e.pointerId !== joyId) return; joyId = null; est.joy = { x: 0, y: 0 }; bolaJoy.style.transform = ''; };
  joy.addEventListener('pointerup', soltarJoy); joy.addEventListener('pointercancel', soltarJoy);
  function mexerJoy(e) {
    const R = 48;
    let dx = e.clientX - joyCentro[0], dy = e.clientY - joyCentro[1];
    const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
    est.joy = { x: dx / R, y: -dy / R };
    bolaJoy.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  // teclado
  const ehTexto = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  const tecla = e => {
    if (ehTexto(e)) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (e.type === 'keydown') {
      est.teclas.add(k);
      if (k === 'e') executar(est.acoes.find(a => a.tecla === 'e') || null);
      if (k === ' ' && !est.noCarro) executar(est.acoes[0] || null);
      if (/^[1-4]$/.test(k)) executar(est.acoes[Number(k) - 1] || null);
      if (k === 'escape') ctx.sair();
    } else est.teclas.delete(k);
  };
  const soltarTeclas = () => est.teclas.clear();
  addEventListener('keydown', tecla); addEventListener('keyup', tecla); addEventListener('blur', soltarTeclas);

  // câmera: arrastar gira, pinça e rodinha dão zoom
  const tela = ctx.renderer.domElement;
  const ponteiros = new Map();
  let pinca = null;
  const pd = e => { ponteiros.set(e.pointerId, [e.clientX, e.clientY]); if (ponteiros.size === 2) { const [a, b] = [...ponteiros.values()]; pinca = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), dist: est.camDist }; } };
  const pm = e => {
    const antes = ponteiros.get(e.pointerId); if (!antes) return;
    ponteiros.set(e.pointerId, [e.clientX, e.clientY]);
    if (ponteiros.size === 1) {
      // arrastar para os lados gira; para cima e para baixo inclina (de quase rente ao chão até olhar de cima)
      const k = Math.PI / Math.max(300, tela.clientHeight);
      est.camYaw -= (e.clientX - antes[0]) * 0.006;
      est.camPitch = THREE.MathUtils.clamp(est.camPitch + (e.clientY - antes[1]) * k, 0.05, 1.4);
    }
    else if (ponteiros.size === 2 && pinca) { const [a, b] = [...ponteiros.values()]; est.camDist = THREE.MathUtils.clamp(pinca.dist * pinca.d / Math.max(20, Math.hypot(a[0] - b[0], a[1] - b[1])), 3, 40); }
  };
  const pu = e => { ponteiros.delete(e.pointerId); pinca = null; };
  const roda = e => { e.preventDefault(); est.camDist = THREE.MathUtils.clamp(est.camDist * (e.deltaY > 0 ? 1.12 : 0.89), 3, 40); };
  tela.addEventListener('pointerdown', pd); tela.addEventListener('pointermove', pm);
  tela.addEventListener('pointerup', pu); tela.addEventListener('pointercancel', pu);
  tela.addEventListener('wheel', roda, { passive: false });

  // pedido para um chefe
  const form = $h('.hud-pedido');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const texto = form.querySelector('input').value.trim();
    if (!texto || !est.falandoCom) return;
    const r = ctx.emitir('pedido', { gestor: est.falandoCom, texto });
    if (r !== true) { aviso(typeof r === 'string' ? r : 'Não deu para enviar o pedido agora.', 5000); return; }
    pessoas[est.falandoCom]?.falar('📝 Anotado! Já coloco a equipe nisso.', 3500);
    aviso(`Pedido enviado para ${NOMES[est.falandoCom] || 'o chefe'}. A resposta aparece no balão e no chat.`, 5000);
    form.querySelector('input').value = ''; form.hidden = true; est.falandoCom = null;
  });
  $h('.hud-cancelar').addEventListener('click', () => { form.hidden = true; est.falandoCom = null; });

  // ---------- controle de PS4 (DualShock 4 sem fio, por Bluetooth) ou qualquer controle no padrão do navegador ----------
  // analógico esquerdo ou setas: andar/dirigir · R2: acelerar (a pé: correr) · L2: frear e ré · analógico direito: câmera
  // ✕ ação 1 · ⬜ ação 2 · ◯ ação 3 (no carro: freio de mão; com o pedido aberto: fechar) · △ entrar/sair do carro
  // L1: chamar o Peter · R1: chamar a Bibi · R3 (apertar o analógico direito): zoom · OPTIONS: sair do jogo
  const pad = { ativo: false, nome: '', x: 0, y: 0, rx: 0, ry: 0, acel: 0, freio: 0, correr: false, freioDeMao: false, antes: [] };
  const zonaMorta = v => (Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84);
  const controleAtual = () => {
    const lista = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    return lista.find(p => p.mapping === 'standard') || lista[0] || null;
  };
  function vibrar(forca = 0.6, ms = 200) {
    try { controleAtual()?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: forca, weakMagnitude: forca })?.catch?.(() => {}); } catch { /* sem vibração */ }
  }
  function lerControle(dt) {
    const g = controleAtual();
    if (!g) { if (pad.ativo) Object.assign(pad, { ativo: false, x: 0, y: 0, rx: 0, ry: 0, acel: 0, freio: 0, correr: false, freioDeMao: false, antes: [] }); return false; }
    const b = i => g.buttons[i] || { pressed: false, value: 0 };
    const ax = i => zonaMorta(g.axes[i] || 0);
    pad.ativo = true; pad.nome = g.id;
    pad.x = ax(0); pad.y = -ax(1);
    if (b(14).pressed) pad.x = -1; if (b(15).pressed) pad.x = 1;
    if (b(12).pressed) pad.y = 1; if (b(13).pressed) pad.y = -1;
    pad.acel = b(7).value || (b(7).pressed ? 1 : 0);
    pad.freio = b(6).value || (b(6).pressed ? 1 : 0);
    pad.correr = pad.acel > 0.3 || b(10).pressed;
    pad.rx = ax(2); pad.ry = ax(3);
    pad.freioDeMao = est.noCarro && b(1).pressed;
    const apertou = i => b(i).pressed && !pad.antes[i];
    pad.saiu = false;
    if (!form.hidden) {
      if (apertou(1)) { form.hidden = true; est.falandoCom = null; }
    } else {
      if (apertou(3)) executar(est.acoes.find(a => a.tecla === 'e') || null);
      if (!est.noCarro) {
        if (apertou(0)) executar(est.acoes[0] || null);
        if (apertou(2)) executar(est.acoes[1] || null);
        if (apertou(1)) executar(est.acoes[2] || null);
      }
      if (apertou(4)) chamar('peter');
      if (apertou(5)) chamar('bibi');
      if (apertou(11)) est.camDist = est.camDist < 6 ? 9.5 : est.camDist < 13 ? 18 : 4.5;
      if (apertou(9)) { pad.saiu = true; ctx.sair(); return true; }
    }
    pad.antes = g.buttons.map(x => x.pressed);
    // câmera no analógico direito
    est.camYaw -= pad.rx * dt * 2.4;
    est.camPitch = THREE.MathUtils.clamp(est.camPitch + pad.ry * dt * 1.4, 0.05, 1.4);
    return false;
  }
  const aoConectar = e => { aviso(`🎮 Controle conectado. Analógico esquerdo anda, R2 acelera, ✕ faz a ação, △ entra e sai do carro, OPTIONS sai do jogo.`, 7000); vibrar(0.4, 150); };
  const aoDesconectar = () => aviso('🎮 Controle desconectado. O teclado e o toque continuam funcionando.', 4000);
  addEventListener('gamepadconnected', aoConectar);
  addEventListener('gamepaddisconnected', aoDesconectar);

  // ---------- ações ----------
  function executar(a) { if (a) a.fazer(); }
  function sairDoCarro() {
    const c = est.car;
    const lado = { x: Math.cos(c.h) * 2.1, z: -Math.sin(c.h) * 2.1 }; // porta do motorista (lado esquerdo)
    let x = c.x + lado.x, z = c.z + lado.z;
    if (bateEmCasa(x, z, 0.4)) { x = c.x - lado.x; z = c.z - lado.z; }
    est.noCarro = false;
    eu.andar = 0; eu.ativo = true; eu.noElevador = false;
    eu.raiz.position.set(x, alturaDoChao(x, z), z);
    eu.raiz.rotation.y = c.h;
    est.camDist = 5.5;
    est.camPitch = 0.5;
    aviso('Você saiu do carro. A porta da loja abre sozinha quando você chega perto.');
  }
  function entrarNoCarro() { est.noCarro = true; eu.ativo = false; est.camDist = 9.5; est.camPitch = 0.42; est.camYaw = est.car.h; }
  function andarDoElevador(destino) {
    if (est.subindo) return;
    est.subindo = true;
    aviso(destino === 0 ? '🛗 Chamando o elevador… descendo para o térreo' : `🛗 Chamando o elevador… indo para o ${destino === 3 ? 'terraço' : destino + 1 + 'º andar'}`, 3500);
    est.viagem = ctx.viajarJogador(eu, destino).finally(() => { est.subindo = false; est.viagem = null; });
  }
  function voltarAoJogador(d) { d.controlado = false; d.modoControle = null; d.corpo.position.y = 0; }
  function brincarCom(d, tipo) {
    if (est.cachorroControle) voltarAoJogador(est.cachorroControle.d);
    d.controlado = true;
    const p = eu.raiz.position;
    if (tipo === 'carinho') {
      d.modoControle = 'sentado';
      d.raiz.rotation.y = Math.atan2(p.x - d.raiz.position.x, p.z - d.raiz.position.z);
      d.falar(d.id === 'peter' ? '❤️ Au… *fecha os olhos*' : '❤️ Arf! *abana o rabo*', 2600);
      est.cachorroControle = { d, tipo, fim: performance.now() + 2600 };
    } else if (tipo === 'brincar') {
      d.modoControle = 'parado';
      d.falar(d.id === 'peter' ? '🤸 Au au au!' : '🤸 Arf arf arf!', 2600);
      est.cachorroControle = { d, tipo, fim: performance.now() + 2600, giro0: d.raiz.rotation.y };
    } else if (tipo === 'bolinha') {
      if (!est.bola) {
        est.bola = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshLambertMaterial({ color: 0xc8f03c }));
        cena.add(est.bola);
      }
      d.modoControle = 'parado';
      const fx = Math.sin(eu.raiz.rotation.y), fz = Math.cos(eu.raiz.rotation.y);
      // os cães moram dentro do prédio: a bolinha cai lá dentro
      const ax = THREE.MathUtils.clamp(p.x + fx * 7, -11, 11), az = THREE.MathUtils.clamp(p.z + fz * 7, -7.2, 7.2);
      const y0 = d.andar * ALT;
      est.bola.visible = true;
      est.cachorroControle = { d, tipo, fase: 'voando', t: 0, de: new THREE.Vector3(p.x, y0 + 1.3, p.z), para: new THREE.Vector3(ax, y0 + 0.11, az) };
      d.falar(d.id === 'peter' ? 'Au?! 🎾' : 'Arf?! 🎾', 1500);
    }
  }
  function chamar(id) {
    const d = caes[id];
    if (eu.andar === 0 && !naCasca(eu.raiz.position.x, eu.raiz.position.z)) { aviso(`${NOMES[id]} fica dentro do prédio: entre pela porta da loja e chame de novo.`); return; }
    // o cão vai até onde você estiver (se sair do prédio, ele fica)
    ctx.chamarCao(id, () => (!est.noCarro && !eu.noElevador && (eu.andar > 0 || naCasca(eu.raiz.position.x, eu.raiz.position.z)) ? { andar: eu.andar, x: eu.raiz.position.x, z: eu.raiz.position.z } : null));
    aviso(`📣 ${NOMES[id]} ouviu e está vindo!`);
  }
  const chaesHud = $h('.hud-caes');
  for (const id of ['peter', 'bibi']) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = `📣 ${NOMES[id]}`;
    b.addEventListener('click', () => chamar(id));
    chaesHud.appendChild(b);
  }

  /** O que dá para fazer agora (perto de quem, onde). */
  function calcularAcoes() {
    const lista = [];
    if (est.noCarro) {
      if (Math.abs(est.car.v) < 1.5) lista.push({ id: 'sair', rotulo: '🚪 Sair do carro', tecla: 'e', fazer: sairDoCarro });
      return lista;
    }
    if (est.subindo) return lista;
    const p = eu.raiz.position;
    if (eu.andar === 0 && Math.hypot(p.x - est.car.x, p.z - est.car.z) < 3.6) lista.push({ id: 'entrar', rotulo: '🚗 Entrar no carro', tecla: 'e', fazer: entrarNoCarro });
    if (Math.hypot(p.x - ELEVADOR.porta[0], p.z - ELEVADOR.porta[1]) < 1.8) {
      for (const a of [0, 1, 2, 3]) if (a !== eu.andar) lista.push({ id: 'elev' + a, rotulo: `🛗 ${a === 0 ? 'Térreo' : a === 3 ? 'Terraço' : a + 1 + 'º'}`, fazer: () => andarDoElevador(a) });
    }
    // quem está perto (no mesmo andar)
    let perto = null, menor = 2.4;
    const candidatos = [...Object.values(pessoas), ...Object.values(caes), ...(ctx.clientes || [])];
    for (const e of candidatos) {
      if (e === eu || e.ativo === false || e.noElevador || e.andar !== eu.andar) continue;
      const d = Math.hypot(e.raiz.position.x - p.x, e.raiz.position.z - p.z);
      if (d < menor) { menor = d; perto = e; }
    }
    if (perto?.cachorro) {
      lista.push({ id: 'carinho', rotulo: `🐾 Carinho ${perto.id === 'peter' ? 'no Peter' : 'na Bibi'}`, fazer: () => brincarCom(perto, 'carinho') });
      lista.push({ id: 'bolinha', rotulo: '🎾 Jogar bolinha', fazer: () => brincarCom(perto, 'bolinha') });
      lista.push({ id: 'brincar', rotulo: '🤸 Brincar', fazer: () => brincarCom(perto, 'brincar') });
    } else if (perto) {
      lista.push({ id: 'conversar', rotulo: `💬 Conversar com ${perto.nome}`, fazer: () => {
        perto.rotAlvo = Math.atan2(p.x - perto.raiz.position.x, p.z - perto.raiz.position.z);
        perto.cutucar?.();
      } });
      const chefe = CHEFES.includes(perto.id) ? perto.id : GESTOR_DE[perto.id];
      if (chefe) lista.push({ id: 'pedir', rotulo: `📋 Pedir algo ${chefe === perto.id ? 'a ' + perto.nome.split(' ·')[0] : 'ao chefe (' + NOMES[chefe].split(' ·')[0] + ')'}`, fazer: () => {
        est.falandoCom = chefe;
        form.hidden = false;
        form.querySelector('span').textContent = `Pedido para ${NOMES[chefe]}`;
        form.querySelector('input').focus();
      } });
    }
    return lista;
  }
  function desenharAcoes(lista) {
    const chave = lista.map(a => a.id).join('|') + (pad.ativo ? '|pad' : '');
    est.acoes = lista;
    if (chave === est.chave) return;
    est.chave = chave;
    const box = $h('.hud-acoes');
    box.textContent = '';
    lista.forEach((a, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = pad.ativo ? `${a.rotulo} ${a.tecla === 'e' ? '△' : !est.noCarro && i < 3 ? ['✕', '⬜', '◯'][i] : ''}` : toque ? a.rotulo : `${a.rotulo} ${a.tecla === 'e' ? '[E]' : i < 4 ? `[${i + 1}]` : ''}`;
      b.addEventListener('click', () => a.fazer());
      box.appendChild(b);
    });
  }

  // ---------- movimento ----------
  const entrada = () => {
    const t = est.teclas;
    let x = est.joy.x, y = est.joy.y;
    if (t.has('w') || t.has('arrowup')) y = 1;
    if (t.has('s') || t.has('arrowdown')) y = -1;
    if (t.has('a') || t.has('arrowleft')) x = -1;
    if (t.has('d') || t.has('arrowright')) x = 1;
    if (pad.ativo) {
      if (Math.abs(pad.x) > Math.abs(x)) x = pad.x;
      if (Math.abs(pad.y) > Math.abs(y)) y = pad.y;
      if (est.noCarro && (pad.acel > 0.05 || pad.freio > 0.05)) y = pad.acel - pad.freio; // gatilhos: R2 acelera, L2 freia
    }
    return { x, y, correr: t.has('shift') || pad.correr };
  };
  function dirigir(dt) {
    const c = est.car, { x, y } = entrada();
    const acel = y > 0.15 ? y * 7 : y < -0.15 ? (c.v > 0.5 ? y * 12 : y * 4) : 0;
    c.v += acel * dt;
    if (!acel) c.v = suave(c.v, 0, Math.min(1, dt * 0.9));
    if (est.teclas.has(' ') || pad.freioDeMao) c.v = suave(c.v, 0, Math.min(1, dt * 5)); // freio de mão (Espaço ou ◯)
    c.v = THREE.MathUtils.clamp(c.v, -6, 19);
    const giro = -x * Math.min(1, Math.abs(c.v) / 5) * Math.sign(c.v || 1) * 1.6;
    c.h += giro * dt;
    const nx = c.x + Math.sin(c.h) * c.v * dt, nz = c.z + Math.cos(c.h) * c.v * dt;
    const preso = (x, z) => bateEmCasa(x, z, 1.6) || naCasca(x, z, 1.5) || ctx.transito()?.colide(x, z, 1.9);
    const bate = Math.hypot(nx, nz) > 460 || (preso(nx, nz) && !preso(c.x, c.z));
    if (bate) { if (Math.abs(c.v) > 6) { aviso('💥 Opa! Bateu.', 1500); vibrar(Math.min(1, Math.abs(c.v) / 14), 260); } c.v = -c.v * 0.25; }
    else { c.x = nx; c.z = nz; }
    c.y = suave(c.y, alturaDoChao(c.x, c.z, c.y), 0.5);
    carro.position.set(c.x, c.y, c.z);
    carro.rotation.y = c.h;
    for (const r of carro.userData.rodas) r.rotation.x += c.v * dt / 0.36;
  }
  function andar(dt) {
    if (est.subindo || eu.noElevador) return;
    const { x, y, correr } = entrada();
    const mag = Math.min(1, Math.hypot(x, y));
    const r = eu.raiz, p = r.position;
    eu.andandoJogo = mag > 0.1;
    if (mag > 0.1) {
      const ang = est.camYaw + Math.atan2(-x, y);
      const vel = (correr ? 6.5 : 4.2) * mag;
      const nx = p.x + Math.sin(ang) * vel * dt, nz = p.z + Math.cos(ang) * vel * dt;
      r.rotation.y = angulo(r.rotation.y, ang, Math.min(1, dt * 12));
      const dentroAgora = eu.andar > 0 || naCasca(p.x, p.z);
      const moveis = dentroAgora ? ctx.obstaculos(eu.andar) : null;
      const R = 0.26;
      const noMovel = (x, z) => moveis.some(([x0, x1, z0, z1]) => x > x0 - R && x < x1 + R && z > z0 - R && z < z1 + R);
      const corredorDoElevador = (x, z) => x < 12.6 && Math.abs(z - ELEVADOR.porta[1]) < 1;
      /** Dá para pisar em (x, z) vindo de onde você está? (se já estiver encostado em algo, sempre dá para sair) */
      const pode = (x, z) => {
        if (eu.andar > 0) {
          return x > -11.7 && z > -7.7 && z < 7.7 && (x < 11.7 || corredorDoElevador(x, z)) && (!noMovel(x, z) || noMovel(p.x, p.z));
        }
        if (dentroAgora) {
          if (!naCasca(x, z)) return naPorta(x) && p.z > 6.8; // só sai pela porta
          return x > -11.7 && z > -7.7 && (x < 11.7 || corredorDoElevador(x, z)) && (z < 7.7 || naPorta(x)) && (!noMovel(x, z) || noMovel(p.x, p.z));
        }
        const preso = (a, b) => bateEmCasa(a, b, 0.35) || Math.hypot(a - est.car.x, b - est.car.z) < 2.1 || ctx.transito()?.colide(a, b, 0.5);
        return Math.hypot(x, z) < 460 && (!preso(x, z) || preso(p.x, p.z)) && (!naCasca(x, z) || (naPorta(x) && z > 6.8));
      };
      // anda; se bater, escorrega ao longo do obstáculo
      if (pode(nx, nz)) { p.x = nx; p.z = nz; }
      else if (pode(nx, p.z)) p.x = nx;
      else if (pode(p.x, nz)) p.z = nz;
    }
    const dentro = eu.andar > 0 || naCasca(p.x, p.z);
    p.y = dentro ? eu.andar * ALT : alturaDoChao(p.x, p.z, 0);
    // anima as pernas (depois da animação normal do boneco)
    const t = performance.now() / 1000, [pe, pdir] = eu.pernas, [be, bd] = eu.bracos;
    if (eu.andandoJogo) {
      const s = Math.sin(t * (correr ? 14 : 10));
      pe.rotation.x = s * 0.6; pdir.rotation.x = -s * 0.6; be.rotation.x = -s * 0.5; bd.rotation.x = s * 0.5;
      eu.corpo.position.y = Math.abs(Math.cos(t * 10)) * 0.05;
    }
  }
  function cachorros(dt) {
    const cc = est.cachorroControle;
    if (!cc) return;
    const d = cc.d, r = d.raiz, p = eu.raiz.position;
    if (cc.tipo === 'carinho' || cc.tipo === 'brincar') {
      if (cc.tipo === 'brincar') {
        const k = (cc.fim - performance.now()) / 2600;
        r.rotation.y = cc.giro0 + (1 - k) * Math.PI * 4;
        d.corpo.position.y = Math.abs(Math.sin((1 - k) * Math.PI * 4)) * 0.5;
      }
      if (performance.now() > cc.fim) { d.corpo.position.y = 0; voltarAoJogador(d); est.cachorroControle = null; }
      return;
    }
    // bolinha: voa, o cão busca e traz
    const bola = est.bola;
    if (cc.fase === 'voando') {
      cc.t += dt / 0.7;
      const k = Math.min(1, cc.t);
      bola.position.lerpVectors(cc.de, cc.para, k);
      bola.position.y += Math.sin(k * Math.PI) * 2.2;
      if (k >= 1) cc.fase = 'buscando';
    } else if (cc.fase === 'buscando' || cc.fase === 'trazendo') {
      const alvo = cc.fase === 'buscando' ? cc.para : new THREE.Vector3(p.x + Math.sin(eu.raiz.rotation.y) * 1.1, 0, p.z + Math.cos(eu.raiz.rotation.y) * 1.1);
      const dx = alvo.x - r.position.x, dz = alvo.z - r.position.z, dist = Math.hypot(dx, dz);
      const vel = (d.id === 'peter' ? 6 : 5) * dt;
      // anima as pernas correndo
      d.pernas.forEach((g, i) => { g.rotation.x = Math.sin(performance.now() / 50 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.7; });
      if (dist > vel) {
        r.position.x += dx / dist * vel; r.position.z += dz / dist * vel;
        r.rotation.y = angulo(r.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 12));
      } else if (cc.fase === 'buscando') { cc.fase = 'trazendo'; d.falar('🎾!', 1200); }
      else {
        cc.fase = 'fim';
        bola.position.set(r.position.x + Math.sin(r.rotation.y) * 0.6, d.andar * ALT + 0.11, r.position.z + Math.cos(r.rotation.y) * 0.6);
        d.modoControle = 'sentado';
        d.falar(d.id === 'peter' ? 'Au! 🎾 De novo?' : 'Arf! 🎾 De novo? De novo?', 3000);
        cc.fim = performance.now() + 1500;
      }
      if (cc.fase === 'trazendo') bola.position.set(r.position.x + Math.sin(r.rotation.y) * (d.id === 'peter' ? 0.75 : 0.45), d.andar * ALT + (d.id === 'peter' ? 1.0 : 0.55), r.position.z + Math.cos(r.rotation.y) * (d.id === 'peter' ? 0.75 : 0.45));
    } else if (cc.fase === 'fim' && performance.now() > cc.fim) {
      voltarAoJogador(d); est.cachorroControle = null;
    }
  }
  const vAlvo = new THREE.Vector3(), vCam = new THREE.Vector3();
  function moverCamera(dt) {
    let alvo, dist = est.camDist, dentro = false;
    if (est.noCarro) {
      const c = est.car;
      if (Math.abs(c.v) > 2) est.camYaw = angulo(est.camYaw, c.h, Math.min(1, dt * 1.6));
      alvo = vAlvo.set(c.x, c.y + 1.4, c.z);
    } else {
      const p = eu.raiz.position;
      alvo = vAlvo.set(p.x, p.y + 1.5, p.z);
      dentro = eu.andar > 0 || naCasca(p.x, p.z);
      if (dentro) dist = Math.min(dist, 6.5);
    }
    const plano = dist * Math.cos(est.camPitch);
    vCam.set(alvo.x - Math.sin(est.camYaw) * plano, alvo.y + dist * Math.sin(est.camPitch), alvo.z - Math.cos(est.camYaw) * plano);
    // a câmera não entra no chão (na rua, segue o terreno; dentro do prédio, o piso do andar)
    const piso = dentro ? eu.andar * ALT : alturaDoChao(vCam.x, vCam.z, alvo.y - 1.5);
    if (vCam.y < piso + 0.4) vCam.y = piso + 0.4;
    camera.position.lerp(vCam, 1 - Math.exp(-dt * 7));
    est.camAlvo.lerp(alvo, 1 - Math.exp(-dt * 10));
    camera.lookAt(est.camAlvo);
  }

  const estado = $h('.hud-status');
  let andarVisto = -1;
  return {
    /** Andar que os balões mostram (fora do prédio: todos). */
    focoAndar: () => (!est.noCarro && (eu.andar > 0 || naCasca(eu.raiz.position.x, eu.raiz.position.z)) ? eu.andar : null),
    aviso,
    _teste: { est, eu, ctx }, // para testes automáticos
    atualizar(dt) {
      if (lerControle(dt)) return; // OPTIONS: saiu do jogo
      if (est.noCarro) dirigir(dt); else andar(dt);
      cachorros(dt);
      // o trânsito freia para você
      const obst = [{ x: est.car.x, z: est.car.z }];
      if (!est.noCarro && eu.andar === 0) obst.push({ x: eu.raiz.position.x, z: eu.raiz.position.z });
      ctx.transito()?.definirObstaculos(obst);
      // andares visíveis: dentro do prédio, só até o seu andar
      const dentro = !est.noCarro && (eu.andar > 0 || naCasca(eu.raiz.position.x, eu.raiz.position.z));
      const lim = dentro ? (eu.noElevador ? 3 : eu.andar) : 3;
      if (lim !== andarVisto) { andarVisto = lim; ctx.aplicarLimite(lim); }
      moverCamera(dt);
      desenharAcoes(calcularAcoes());
      estado.textContent = est.noCarro ? `🚗 ${Math.round(Math.abs(est.car.v) * 3.6)} km/h` : dentro ? `📍 ${eu.andar === 0 ? 'Loja RB TECH' : eu.andar === 1 ? '2º · Agência' : eu.andar === 2 ? '3º · Vendas e SaaS' : 'Terraço'}` : '📍 Rua';
      if (avisoAte && performance.now() > avisoAte) { $h('.hud-aviso').hidden = true; avisoAte = 0; }
    },
    destruir() {
      removeEventListener('keydown', tecla); removeEventListener('keyup', tecla); removeEventListener('blur', soltarTeclas);
      removeEventListener('gamepadconnected', aoConectar); removeEventListener('gamepaddisconnected', aoDesconectar);
      tela.removeEventListener('pointerdown', pd); tela.removeEventListener('pointermove', pm);
      tela.removeEventListener('pointerup', pu); tela.removeEventListener('pointercancel', pu);
      tela.removeEventListener('wheel', roda);
      hud.remove();
      cena.remove(carro);
      if (est.bola) cena.remove(est.bola);
      if (est.cachorroControle) voltarAoJogador(est.cachorroControle.d);
      for (const d of Object.values(caes)) d.chamado = null;
      eu.ativo = false;
      if (est.viagem) est.viagem.finally(() => ctx.removerPessoa(eu)); else ctx.removerPessoa(eu);
      pessoas.israel.ativo = true;
      ctx.transito()?.definirObstaculos([]);
    },
    inicio() { aviso(rota ? '🚗 Você está na SC-281. Dirija até a loja (prédio à frente) e estacione no pátio.' : '🚗 Dirija até o prédio e estacione na frente.', 6000); },
  };
}
