// Personagens 3D com proporção humana (Universal Base Characters + Universal Animation Library, Quaternius, CC0).
// Os corpos vêm sem roupa; a roupa é pintada aqui, por regiões do corpo (camisa ou paletó, gravata, cinto, calça e sapato),
// nas cores de cada pessoa do prédio. Pele e cabelo também são pintados por cima da textura em tons de cinza.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as clonarComOssos } from 'three/addons/utils/SkeletonUtils.js';

const ARQ = nome => new URL(`../assets/personagens/${nome}`, import.meta.url).href;
let pronto = null;

/** Mede o corpo na pose de origem (em T): alturas do tornozelo, cintura e pescoço, e o pulso e o cotovelo no braço. */
function medir(cena) {
  cena.updateMatrixWorld(true);
  let corpo = null;
  cena.traverse(o => { if (o.isSkinnedMesh && (!corpo || o.geometry.attributes.position.count > corpo.geometry.attributes.position.count)) corpo = o; });
  const inv = new THREE.Matrix4().copy(corpo.matrixWorld).invert();
  const osso = nome => {
    const b = corpo.skeleton.bones.find(x => x.name === nome);
    return b ? new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).applyMatrix4(inv) : null;
  };
  const pe = osso('foot_l'), maoE = osso('hand_l');
  // o modelo é Y para cima, X para o lado e Z para a frente (glTF); o corpo não está centrado no zero
  const cima = new THREE.Vector3(0, 1, 0), lado = new THREE.Vector3(1, 0, 0), frente = new THREE.Vector3(0, 0, 1);
  const em = (v, eixo) => v.dot(eixo);
  const pelvis = osso('pelvis'), pescoco = osso('neck_01'), cotovelo = osso('lowerarm_l'), braco = osso('upperarm_l');
  const chao = em(pe, cima) - 0.08;
  // centro do peito pelos vértices (a gravata e o decote ficam no meio de verdade)
  const peito = em(osso('spine_03'), cima), pos = corpo.geometry.attributes.position, v = new THREE.Vector3();
  let soma = 0, n = 0, zMin = Infinity, zMax = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (Math.abs(v.y - peito) < 0.05 && Math.abs(v.x - pelvis.x) < 0.2) { soma += v.x; n++; zMin = Math.min(zMin, v.z); zMax = Math.max(zMax, v.z); }
  }
  const cx = n ? soma / n : pelvis.x;
  return {
    corpo, cima, lado, frente, centro: new THREE.Vector2(cx, n ? (zMin + zMax) / 2 : pelvis.z),
    tornozelo: em(pe, cima) + 0.03,
    cintura: em(pelvis, cima) + 0.06,
    pescoco: em(pescoco, cima) + 0.02,
    pulso: Math.abs(em(maoE, lado) - cx) - 0.04,
    cotovelo: Math.abs(em(cotovelo, lado) - cx),
    ombro: Math.abs(em(braco, lado) - cx) + 0.06,
    chao,
  };
}

const penteados = new Map();
function carregarPenteado(nome) {
  if (!penteados.has(nome)) penteados.set(nome, new GLTFLoader().loadAsync(ARQ(`${nome}.glb`)).then(g => g.scene).catch(() => null));
  return penteados.get(nome);
}
/** Prende um penteado (malha com ossos) no esqueleto do personagem, osso por osso pelo nome. */
async function vestirPenteado(raiz, esqueleto, nome, corCabelo) {
  const cena = await carregarPenteado(nome);
  if (!cena) return;
  const copia = clonarComOssos(cena);
  const porNome = new Map(esqueleto.bones.map(b => [b.name, b]));
  copia.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const ossos = o.skeleton.bones.map(b => porNome.get(b.name) || b);
    const m = o.material.clone();
    m.color = cor(corCabelo).multiplyScalar(2.0); m.roughness = 0.65; m.metalness = 0;
    const malha = new THREE.SkinnedMesh(o.geometry, m);
    malha.castShadow = true; malha.frustumCulled = false;
    raiz.add(malha);
    malha.bind(new THREE.Skeleton(ossos, o.skeleton.boneInverses), o.bindMatrix);
  });
}

export function carregarPersonagens() {
  pronto ||= (async () => {
    const l = new GLTFLoader();
    const [h, m, a] = await Promise.all(['homem.glb', 'mulher.glb', 'animacoes.glb'].map(n => l.loadAsync(ARQ(n))));
    const clips = Object.fromEntries(a.animations.map(c => [c.name, c]));
    return { homem: { cena: h.scene, marcos: medir(h.scene) }, mulher: { cena: m.scene, marcos: medir(m.scene) }, clips };
  })();
  return pronto;
}

const cor = v => new THREE.Color(v ?? 0xffffff);
/** Material do corpo com a roupa pintada por regiões. */
function materialDoCorpo(original, marcos, roupa) {
  const mat = original.clone();
  mat.roughness = 1; mat.metalness = 0;
  const u = {
    uCima: { value: marcos.cima }, uLado: { value: marcos.lado }, uFrente: { value: marcos.frente }, uCentro: { value: marcos.centro },
    uMarcos: { value: new THREE.Vector4(marcos.tornozelo, marcos.cintura, marcos.pescoco, marcos.pulso) },
    uManga: { value: roupa.mangaCurta ? marcos.ombro + 0.1 : marcos.pulso - 0.02 },
    uPele: { value: cor(roupa.pele) }, uCamisa: { value: cor(roupa.camisa) }, uCalca: { value: cor(roupa.calca) },
    uSapato: { value: cor(roupa.sapato) }, uTerno: { value: cor(roupa.terno ?? roupa.camisa) }, uFrenteCor: { value: cor(roupa.frente ?? 0xffffff) },
    uGravata: { value: cor(roupa.gravata ?? 0) }, uOpcoes: { value: new THREE.Vector3(roupa.terno != null ? 1 : 0, roupa.gravata != null ? 1 : 0, roupa.saia ? 1 : 0) },
  };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vBind;
uniform vec3 uCima, uLado, uFrente, uPele, uCamisa, uCalca, uSapato, uTerno, uFrenteCor, uGravata, uOpcoes;
uniform vec4 uMarcos; uniform float uManga; uniform vec2 uCentro;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
float alt = dot(vBind, uCima), lad = abs(dot(vBind, uLado) - uCentro.x), fre = dot(vBind, uFrente) - uCentro.y;
float detalhe = clamp(diffuseColor.r * 1.8, 0.35, 1.35);
vec3 tinta = uPele * detalhe;
float roupa = 0.0;
if (lad < uMarcos.w || alt < uMarcos.z) {
  if (alt < uMarcos.x) { tinta = uSapato; roupa = 1.0; }
  else if (alt < uMarcos.y - 0.025) { tinta = uCalca; roupa = 1.0; }
  else if (alt < uMarcos.y + 0.02) { tinta = vec3(0.05); roupa = 1.0; }
  else if (alt < uMarcos.z && lad < uManga) {
    roupa = 1.0;
    tinta = uOpcoes.x > 0.5 ? uTerno : uCamisa;
    float decote = mix(0.015, 0.085, smoothstep(uMarcos.y + 0.12, uMarcos.z, alt));
    if (uOpcoes.x > 0.5 && fre > 0.0 && lad < decote) tinta = uFrenteCor;
    if (uOpcoes.y > 0.5 && fre > 0.0 && lad < 0.022 && alt > uMarcos.y + 0.1) tinta = uGravata;
  }
}
diffuseColor.rgb = roupa > 0.5 ? tinta * (0.82 + 0.18 * detalhe) : tinta;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.85, roupa);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, roupa * 0.9));');
  };
  mat.customProgramCacheKey = () => 'corpo-com-roupa';
  return mat;
}

/**
 * Cria um personagem pronto para animar. roupa: { sexo: 'm'|'f', pele, cabelo, camisa, calca, sapato, terno?, frente?, gravata?, mangaCurta? }.
 * Devolve { raiz, tocar(nome), atualizar(dt) }.
 */
export async function criarPersonagem(roupa) {
  const base = await carregarPersonagens();
  const modelo = roupa.sexo === 'f' ? base.mulher : base.homem;
  const raiz = clonarComOssos(modelo.cena);
  raiz.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    const nome = (o.material?.name || '').toLowerCase();
    if (o.isSkinnedMesh && o.geometry.attributes.position.count === modelo.marcos.corpo.geometry.attributes.position.count && !nome.includes('hair') && !nome.includes('eye')) {
      o.material = materialDoCorpo(o.material, modelo.marcos, roupa);
    } else if (nome.includes('hair')) { // sobrancelhas
      const m = o.material.clone();
      m.color = cor(roupa.cabelo).multiplyScalar(1.6); m.roughness = 0.8; m.metalness = 0;
      o.material = m;
    }
  });
  // cabelo (e barba): penteados do mesmo esqueleto
  let esqueleto = null;
  raiz.traverse(o => { if (o.isSkinnedMesh && !esqueleto && o.skeleton.bones.length > 50) esqueleto = o.skeleton; });
  const penteado = roupa.penteado ?? (roupa.sexo === 'f' ? 'long' : 'simpleparted');
  if (esqueleto && penteado && !roupa.careca) await vestirPenteado(raiz, esqueleto, penteado, roupa.cabelo);
  if (esqueleto && roupa.barba) await vestirPenteado(raiz, esqueleto, 'beard', roupa.cabelo);
  const mixer = new THREE.AnimationMixer(raiz);
  const acoes = {};
  for (const [nome, clip] of Object.entries(base.clips)) acoes[nome] = mixer.clipAction(clip);
  for (const n of ['Sitting_Enter', 'Sitting_Exit']) if (acoes[n]) { acoes[n].setLoop(THREE.LoopOnce); acoes[n].clampWhenFinished = true; }
  let atual = null;
  function tocar(nome, transicao = 0.3) {
    const a = acoes[nome];
    if (!a || a === atual) return;
    a.reset().fadeIn(transicao).play();
    if (atual) atual.fadeOut(transicao);
    atual = a;
  }
  tocar('Idle_Loop', 0);
  return { raiz, tocar, atualizar: dt => mixer.update(dt), acoes };
}

/** Roupa a partir da aparência dos bonecos de blocos (cores de PESSOAS_3D). */
export function roupaDe(ap, extra = {}) {
  const feminino = ap.penteado === 'longo' || ap.penteado === 'coque';
  const penteado = { longo: 'long', coque: 'buns', curto: 'simpleparted', topete: 'buzzed' }[ap.penteado] || (feminino ? 'long' : 'simpleparted');
  return {
    sexo: feminino ? 'f' : 'm', penteado, barba: !!ap.barba, pele: ap.pele, cabelo: ap.cabelo, camisa: ap.camisa, calca: ap.calca, sapato: ap.sapato,
    ...(ap.frente ? { terno: ap.camisa, frente: ap.frente } : {}),
    ...(ap.gravata ? { gravata: ap.gravata } : {}),
    ...extra,
  };
}
