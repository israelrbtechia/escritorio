// Liga o prédio 3D, os chats com os chefes de cada andar, as entregas, a diretoria (auditoria do Israel),
// o placar, a Meta e as rotinas automáticas.
import { criarAgencia, PESSOAS, GESTORES, ler, gravar } from './agencia.js';
import { markdown } from './markdown.js';

const $ = id => document.getElementById(id);
const CHAVE_PLACAR = 'agencia.placar';
const CHAVE_ENSAIO = 'agencia.ensaio';
const CHAVE_GESTOR = 'agencia.gestorAtual';
const CHAVE_ROTINAS_VISTAS = 'agencia.rotinasVistas';
const chaveChat = g => (g === 'chefe' ? 'agencia.chat' : 'agencia.chat.' + g);
const PLACAR_EXEMPLO = { conversasHoje: 23, investimentoHoje: 180, metaCusto: 9, diasNaMeta: 4, ehExemplo: true };

const brl = n => (Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '–');
const hora = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const nome = p => PESSOAS[p]?.nome || p;

// ---------- placar e humor do chefe de tráfego ----------
let placar = { ...PLACAR_EXEMPLO, ...ler(CHAVE_PLACAR, {}) };
const custoPorConversa = p => (p.conversasHoje > 0 ? p.investimentoHoje / p.conversasHoje : NaN);
function humorDoChefe(p) {
  const c = custoPorConversa(p);
  if (!Number.isFinite(c)) {
    return p.investimentoHoje > 0 ? { id: 'incendio', nome: 'apagando incêndio', cor: '#ff5a5a' } : { id: 'normal', nome: 'normal', cor: '#f2f2f2' };
  }
  const r = c / p.metaCusto;
  if (r <= 0.85) return { id: 'confiante', nome: 'confiante', cor: '#2fd17a' };
  if (r <= 1) return { id: 'normal', nome: 'normal', cor: '#ffd60a' };
  if (r <= 1.3) return { id: 'alerta', nome: 'alerta', cor: '#ff9f43' };
  return { id: 'incendio', nome: 'apagando incêndio', cor: '#ff5a5a' };
}
function placarTexto() {
  const p = placar;
  return [
    p.ehExemplo ? 'Números de EXEMPLO (o dono ainda não digitou os reais nem ligou a Meta).' : p.daMeta ? 'Números reais puxados do Meta Ads.' : 'Números reais digitados pelo dono.',
    `Conversas no WhatsApp hoje: ${p.conversasHoje}`,
    `Investimento hoje: ${brl(p.investimentoHoje)}`,
    `Custo por conversa: ${brl(custoPorConversa(p))} (meta ${brl(p.metaCusto)})`,
    `Dias seguidos na meta: ${p.diasNaMeta}/10`,
  ].join('\n');
}

// ---------- prédio 3D ----------
let escritorio = null;
try {
  const { criarEscritorio } = await import('./escritorio.js');
  escritorio = criarEscritorio($('cena3d'), $('camada'));
} catch (e) {
  console.error(e);
  $('sem3d').hidden = false;
}
const cena = new Proxy({}, { get: (_, k) => (escritorio && typeof escritorio[k] === 'function' ? escritorio[k].bind(escritorio) : () => {}) });

function aplicarPlacar() {
  cena.definirPlacar(placar, humorDoChefe(placar));
  const f = $('formPlacar');
  for (const k of ['conversasHoje', 'investimentoHoje', 'metaCusto', 'diasNaMeta']) f.elements[k].value = placar[k];
  f.elements.reais.checked = !placar.ehExemplo;
  atualizarResumoPlacar();
}
function lerFormPlacar(f) {
  const n = (k, padrao) => { const v = parseFloat(f.elements[k].value); return Number.isFinite(v) && v >= 0 ? v : padrao; };
  return {
    conversasHoje: Math.round(n('conversasHoje', 0)), investimentoHoje: n('investimentoHoje', 0),
    metaCusto: n('metaCusto', 0) || PLACAR_EXEMPLO.metaCusto, diasNaMeta: Math.round(n('diasNaMeta', 0)),
    ehExemplo: !f.elements.reais.checked,
  };
}
function atualizarResumoPlacar() {
  const p = lerFormPlacar($('formPlacar'));
  const c = custoPorConversa(p);
  const h = humorDoChefe(p);
  $('resumoPlacar').innerHTML = `Custo por conversa: <b class="${c <= p.metaCusto ? 'bom' : 'ruim'}">${brl(c)}</b><br>Humor do chefe: <b style="color:${h.cor}">${h.nome}</b>`;
}
$('formPlacar').addEventListener('input', atualizarResumoPlacar);
$('formPlacar').addEventListener('submit', e => {
  e.preventDefault();
  placar = lerFormPlacar(e.target);
  gravar(CHAVE_PLACAR, placar);
  aplicarPlacar();
  adicionarChat('chefe', { quem: 'evento', html: true, texto: `Placar atualizado: <b>${placar.conversasHoje}</b> conversas, ${brl(custoPorConversa(placar))} por conversa.` });
});

// ---------- Meta ----------
let metaStatus = null;
async function puxarPlacarDaMeta(avisar = true) {
  try {
    const r = await chamarApi('/api/meta', { consulta: 'placar' });
    const meta = $('formPlacar').elements.metaCusto.value ? parseFloat($('formPlacar').elements.metaCusto.value) : placar.metaCusto;
    let seguidos = 0;
    for (const d of [...r.dias].reverse()) {
      if (d.data === new Date().toISOString().slice(0, 10)) continue;
      if (d.conversas > 0 && d.investimento / d.conversas <= meta) seguidos++; else break;
    }
    placar = { conversasHoje: r.hoje.conversas, investimentoHoje: r.hoje.investimento, metaCusto: meta || 9, diasNaMeta: seguidos, ehExemplo: false, daMeta: true };
    gravar(CHAVE_PLACAR, placar);
    aplicarPlacar();
    if (avisar) $('statusMeta').textContent = `Placar puxado do Meta Ads às ${new Date().toLocaleTimeString('pt-BR')}.`;
  } catch (e) {
    if (avisar) $('statusMeta').textContent = e.message;
  }
}
async function verificarMeta() {
  if (chkEnsaio.checked) { $('statusMeta').textContent = 'Modo ensaio: a Meta não é consultada.'; return; }
  try {
    metaStatus = await chamarApi('/api/meta', { consulta: 'status' });
    const partes = [];
    partes.push(metaStatus.ligado.anuncios ? '✅ anúncios ligados' : '⚪ anúncios não ligados');
    partes.push(metaStatus.ligado.instagram ? `✅ Instagram ligado${metaStatus.instagram ? ` (@${metaStatus.instagram.usuario}, ${metaStatus.instagram.seguidores.toLocaleString('pt-BR')} seguidores)` : ''}` : '⚪ Instagram não ligado');
    $('statusMeta').textContent = partes.join(' · ') + (metaStatus.erroInstagram ? ` · ${metaStatus.erroInstagram}` : '');
    $('btMeta').disabled = !metaStatus.ligado.anuncios;
    if (metaStatus.instagram) cena.definirSeguidores(metaStatus.instagram);
    if (metaStatus.ligado.anuncios) puxarPlacarDaMeta(false);
  } catch (e) {
    $('statusMeta').textContent = `Meta: ${e.message}`;
  }
}
$('btMeta').addEventListener('click', () => puxarPlacarDaMeta(true));

// ---------- câmeras ----------
const autoCam = $('autoCam');
let timerCam = null;
let ultimoFoco = Date.now();
function marcarCamera(cam) {
  $('camNome').textContent = cam.nome;
  for (const b of $('cams').children) b.classList.toggle('ativa', b.dataset.cam === cam.id);
}
function focar(id, atraso = 0) {
  if (!id) return;
  clearTimeout(timerCam);
  ultimoFoco = Date.now() + atraso;
  timerCam = setTimeout(() => { if (escritorio) marcarCamera(escritorio.irParaCamera(id)); }, atraso);
}
const focarAuto = (id, atraso = 0) => { if (autoCam.checked) focar(id, atraso); };
const cameraDe = papel => (escritorio?.cameraDe ? escritorio.cameraDe(papel) : { analista: 'analise', revisor: 'analise', copywriter: 'criacao', roteirista: 'criacao', chefe: 'chefe' }[papel] || 'geral');
if (escritorio) {
  for (const cam of escritorio.cameras) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.cam = cam.id;
    b.textContent = cam.botao || cam.nome.replace(/^CAM \d+ · /, '').toLowerCase().replace(/^./, c => c.toUpperCase());
    b.addEventListener('click', () => { autoCam.checked = false; focar(cam.id); });
    $('cams').appendChild(b);
  }
  marcarCamera(escritorio.cameraAtual());
}
setInterval(() => {
  $('camHora').textContent = new Date().toLocaleTimeString('pt-BR');
  if (autoCam.checked && escritorio && !agencia.ocupado() && Date.now() - ultimoFoco > 25000 && Math.random() < 0.05) {
    const ids = escritorio.cameras.map(c => c.id);
    focar(ids[Math.floor(Math.random() * ids.length)]);
  }
}, 1000);

// ---------- modo vídeo 9:16 ----------
function modoVideo(ligar) {
  document.body.classList.toggle('modo-video', ligar);
  $('btSairVideo').hidden = !ligar;
  if (ligar) document.documentElement.requestFullscreen?.().catch(() => {});
  else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}
$('btVideo').addEventListener('click', () => modoVideo(true));
$('btSairVideo').addEventListener('click', () => modoVideo(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('modo-video')) modoVideo(false); });

// ---------- abas ----------
function abrirAba(nomeAba) {
  for (const b of document.querySelectorAll('.aba-bt')) b.classList.toggle('ativa', b.dataset.aba === nomeAba);
  for (const s of document.querySelectorAll('.aba')) s.classList.toggle('ativa', s.id === 'aba-' + nomeAba);
}
for (const b of document.querySelectorAll('.aba-bt')) b.addEventListener('click', () => abrirAba(b.dataset.aba));

// ---------- código de acesso ----------
function pedirCodigo() {
  const dlg = $('dlgCodigo');
  $('campoCodigo').value = '';
  return new Promise(res => {
    dlg.addEventListener('close', () => res(dlg.returnValue === 'ok' ? $('campoCodigo').value.trim() : ''), { once: true });
    dlg.showModal();
  });
}
async function chamarApi(caminho, corpo, metodo = 'POST') {
  const resp = await fetch(caminho, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'x-agencia-codigo': ler('agencia.codigo', '') },
    ...(metodo === 'POST' ? { body: JSON.stringify(corpo) } : {}),
  });
  const dados = await resp.json().catch(() => null);
  if (resp.status === 401 && dados?.precisaCodigo) {
    const novo = await pedirCodigo();
    if (!novo) throw new Error('Sem o código de acesso.');
    gravar('agencia.codigo', novo);
    return chamarApi(caminho, corpo, metodo);
  }
  if (!resp.ok || !dados) throw new Error(dados?.erro || (resp.status === 404 ? 'Servidor não encontrado (publique na Vercel).' : `Erro ${resp.status}.`));
  return dados;
}

// ---------- chats (um por chefe) ----------
let gestorAtual = GESTORES[ler(CHAVE_GESTOR, 'chefe')] ? ler(CHAVE_GESTOR, 'chefe') : 'chefe';
const chats = {};
for (const g of Object.keys(GESTORES)) chats[g] = ler(chaveChat(g), []);
let indicador = null;

function desenharSeletor() {
  const s = $('gestores');
  s.innerHTML = '';
  for (const [g, info] of Object.entries(GESTORES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gestor-bt' + (g === gestorAtual ? ' ativo' : '') + (agencia?.ocupado(g) ? ' trabalhando' : '');
    b.textContent = info.titulo;
    b.addEventListener('click', () => trocarGestor(g));
    s.appendChild(b);
  }
}
function trocarGestor(g) {
  gestorAtual = g;
  gravar(CHAVE_GESTOR, g);
  desenharChat();
  desenharSeletor();
  $('btEnviar').disabled = agencia.ocupado(g);
  $('entrada').placeholder = `Fale com o ${nome(g).toLowerCase()}… (Enter envia)`;
  focarAuto(cameraDe(g));
}
function elementoMsg(item, gestor) {
  const el = document.createElement('div');
  el.className = 'msg ' + item.quem;
  if (item.quem === 'chefe') el.innerHTML = `<div class="quem">${item.titulo || nome(gestor)}</div>${markdown(item.texto)}`;
  else if (item.html) el.innerHTML = item.texto;
  else el.textContent = item.texto;
  return el;
}
function desenharChat() {
  const c = $('chat');
  c.innerHTML = '';
  indicador = null;
  if (!chats[gestorAtual].length) adicionarChat(gestorAtual, { quem: 'chefe', texto: GESTORES[gestorAtual].boasVindas });
  else for (const m of chats[gestorAtual]) c.appendChild(elementoMsg(m, gestorAtual));
  if (agencia?.ocupado(gestorAtual)) mostrarDigitando(true);
  c.scrollTop = c.scrollHeight;
  atualizarSugestoes();
}
function adicionarChat(gestor, item) {
  item.quando ??= Date.now();
  const lista = chats[gestor];
  lista.push(item);
  if (lista.length > 300) lista.splice(0, lista.length - 300);
  gravar(chaveChat(gestor), lista);
  if (gestor !== gestorAtual) { desenharSeletor(); return; }
  const c = $('chat');
  c.insertBefore(elementoMsg(item, gestor), indicador);
  c.scrollTop = c.scrollHeight;
  atualizarSugestoes();
}
function mostrarDigitando(ligar) {
  if (ligar && !indicador) {
    indicador = document.createElement('div');
    indicador.className = 'msg chefe';
    indicador.innerHTML = `<div class="quem">${nome(gestorAtual)}</div><span class="digitando"><i></i><i></i><i></i></span>`;
    $('chat').appendChild(indicador);
    $('chat').scrollTop = $('chat').scrollHeight;
  } else if (!ligar && indicador) { indicador.remove(); indicador = null; }
}
function atualizarSugestoes() {
  const s = $('sugestoes');
  s.innerHTML = '';
  if (chats[gestorAtual].some(m => m.quem === 'voce')) return;
  for (const texto of GESTORES[gestorAtual].sugestoes) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = texto;
    b.addEventListener('click', () => { $('entrada').value = texto; $('entrada').focus(); });
    s.appendChild(b);
  }
}

// ---------- entregas ----------
function desenharEntregas() {
  const lista = agencia.entregas();
  $('numEntregas').textContent = lista.length;
  const box = $('listaEntregas');
  box.innerHTML = '';
  if (!lista.length) { box.innerHTML = '<div class="vazio-lista">Nada por aqui ainda. Peça algo a um chefe.</div>'; return; }
  for (const e of [...lista].reverse()) {
    const card = document.createElement('article');
    card.className = 'entrega';
    card.innerHTML = `
      <div class="entrega-topo">
        <span class="entrega-id"></span><span class="entrega-quem"></span>
        ${e.ensaio ? '<span class="selo">ENSAIO</span>' : ''}${e.rotina ? '<span class="selo">ROTINA</span>' : ''}
        <span class="entrega-hora"></span>
      </div>
      <details><summary>Pedido</summary><div class="entrega-pedido"></div></details>
      <div class="entrega-texto">${markdown(e.texto)}</div>
      <div class="entrega-acoes"><button type="button" class="bt-sec">Copiar texto</button></div>`;
    card.querySelector('.entrega-id').textContent = e.id;
    card.querySelector('.entrega-quem').textContent = nome(e.papel);
    card.querySelector('.entrega-hora').textContent = hora(e.quando);
    const ped = card.querySelector('.entrega-pedido');
    ped.textContent = `${nome(e.gestor || 'chefe')} pediu: ${e.pedido}${e.anexos?.length ? `\n\nAnexos: ${e.anexos.join(', ')}` : ''}`;
    ped.style.whiteSpace = 'pre-wrap';
    const bt = card.querySelector('button');
    bt.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(e.texto); bt.textContent = 'Copiado ✓'; } catch { bt.textContent = 'Não deu para copiar'; }
      setTimeout(() => { bt.textContent = 'Copiar texto'; }, 1800);
    });
    box.appendChild(card);
  }
}

// ---------- diretoria: auditoria do Israel ----------
function desenharDiretoria() {
  const lista = agencia.decisoes();
  const pendentes = lista.filter(d => !d.status || d.status === 'pendente').length;
  $('numDecisoes').textContent = pendentes;
  $('numDecisoes').classList.toggle('alerta', pendentes > 0);
  cena.definirDecisoesPendentes(pendentes);
  const box = $('listaDecisoes');
  box.innerHTML = '';
  if (!lista.length) { box.innerHTML = '<div class="vazio-lista">Nenhuma decisão chegou à sala do Israel ainda.</div>'; return; }
  for (const d of lista) {
    const st = d.status || 'pendente';
    const card = document.createElement('article');
    card.className = `entrega decisao ${st}`;
    card.innerHTML = `
      <div class="entrega-topo">
        <span class="entrega-id"></span><span class="entrega-quem"></span>
        <span class="selo selo-${st}">${st.toUpperCase()}</span>${d.urgencia === 'alta' ? '<span class="selo selo-recusada">URGENTE</span>' : ''}
        ${d.ensaio ? '<span class="selo">ENSAIO</span>' : ''}${d.origem === 'rotina' ? '<span class="selo">ROTINA</span>' : ''}
        <span class="entrega-hora"></span>
      </div>
      <h4 class="decisao-titulo"></h4>
      <div class="entrega-texto"><p><b>Decisão:</b> <span data-c="decisao"></span></p><p><b>Motivo:</b> <span data-c="motivo"></span></p><p><b>Riscos e medida:</b> <span data-c="riscos"></span></p></div>
      <div class="decisao-auditoria"></div>`;
    card.querySelector('.entrega-id').textContent = d.id;
    card.querySelector('.entrega-quem').textContent = nome(d.gestor);
    card.querySelector('.entrega-hora').textContent = hora(d.quando);
    card.querySelector('.decisao-titulo').textContent = d.titulo;
    for (const k of ['decisao', 'motivo', 'riscos']) card.querySelector(`[data-c="${k}"]`).textContent = d[k] || '–';
    const aud = card.querySelector('.decisao-auditoria');
    if (st === 'pendente') {
      aud.innerHTML = `<textarea rows="2" placeholder="Comentário do Israel (opcional)"></textarea>
        <div class="entrega-acoes"><button type="button" data-s="aprovada">✓ Aprovar</button><button type="button" class="bt-perigo" data-s="recusada">✕ Recusar</button></div>`;
      for (const b of aud.querySelectorAll('button')) {
        b.addEventListener('click', async () => {
          await agencia.auditar(d.id, b.dataset.s, aud.querySelector('textarea').value.trim());
          cena.auditada(d.id, b.dataset.s, d.gestor);
          adicionarChat(d.gestor, { quem: 'evento', html: true, texto: `🏛️ Israel <b>${b.dataset.s === 'aprovada' ? 'aprovou' : 'recusou'}</b> a decisão <b>${d.id}</b>` });
          desenharDiretoria();
        });
      }
    } else {
      aud.textContent = d.comentario ? `Comentário do Israel: ${d.comentario}` : '';
    }
    box.appendChild(card);
  }
}

// ---------- agência ----------
const chkEnsaio = $('chkEnsaio');
chkEnsaio.checked = ler(CHAVE_ENSAIO, false);
$('seloEnsaio').hidden = !chkEnsaio.checked;

const agencia = criarAgencia({
  ensaio: () => chkEnsaio.checked,
  placarTexto,
  pedirCodigo,
  aoEvento(ev) {
    const g = ev.gestor;
    switch (ev.tipo) {
      case 'ocupado':
        if (g === gestorAtual) { $('btEnviar').disabled = ev.ocupado; mostrarDigitando(ev.ocupado); }
        desenharSeletor();
        break;
      case 'chefe':
        cena.gestor(g, ev.estado);
        if (ev.estado === 'pensando') focarAuto(cameraDe(g));
        break;
      case 'chefeTexto':
        adicionarChat(g, { quem: 'chefe', texto: ev.texto });
        if (ev.final) { cena.comemorar(g); focarAuto(cameraDe(g)); }
        else cena.fala(g, ev.texto.split('\n')[0].replace(/[*_#`]/g, '').slice(0, 46));
        break;
      case 'acionar': {
        const resumo = ev.pedido.replace(/\s+/g, ' ');
        cena.acionar(ev.papel, g, '📋 ' + (resumo.length > 44 ? resumo.slice(0, 42) + '…' : resumo), PESSOAS[ev.papel].tarefa);
        adicionarChat(g, { quem: 'evento', html: true, texto: `📣 ${nome(g)} chamou <b>${nome(ev.papel)}</b>${ev.anexos.length ? ` com ${ev.anexos.join(', ')}` : ''}` });
        focarAuto(cameraDe(g));
        focarAuto(cameraDe(ev.papel), 7500);
        break;
      }
      case 'entrega':
        cena.entregar(ev.entrega.papel, ev.entrega.id);
        adicionarChat(g, { quem: 'evento', html: true, texto: `📄 <b>${nome(ev.entrega.papel)}</b> entregou <b>${ev.entrega.id}</b>` });
        desenharEntregas();
        focarAuto(cameraDe(ev.entrega.papel));
        break;
      case 'meta':
        cena.consultar(ev.papel, ev.tipo);
        break;
      case 'decisao':
        cena.levarDecisao(g, ev.decisao.id);
        adicionarChat(g, { quem: 'evento', html: true, texto: `🏛️ ${nome(g)} levou a decisão <b>${ev.decisao.id}</b> para o Israel, no terraço` });
        desenharDiretoria();
        focarAuto('terraco', 4000);
        break;
      case 'erroFuncionario':
        cena.erro(ev.papel);
        adicionarChat(g, { quem: 'aviso', texto: `${nome(ev.papel)}: ${ev.erro}` });
        break;
      case 'aviso':
        adicionarChat(g || gestorAtual, { quem: 'aviso', texto: ev.texto });
        break;
      case 'gasto':
        $('gasto').textContent = 'US$ ' + ev.usd.toFixed(2).replace('.', ',');
        break;
    }
  },
});

$('form').addEventListener('submit', e => {
  e.preventDefault();
  const texto = $('entrada').value.trim();
  if (!texto || agencia.ocupado(gestorAtual)) return;
  $('entrada').value = '';
  adicionarChat(gestorAtual, { quem: 'voce', texto });
  agencia.enviar(gestorAtual, texto);
});
$('entrada').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('form').requestSubmit(); }
});

// ---------- rotinas (a equipe trabalha com o app fechado) ----------
function mostrarRotina(r, nova) {
  const quando = hora(r.inicio);
  const titulo = `${nome(r.gestor)} · rotina ${r.origem === 'manual' ? 'manual' : 'automática'} de ${quando}`;
  if (r.status !== 'ok') adicionarChat(r.gestor, { quem: 'aviso', texto: `Rotina de ${quando} falhou: ${r.erro || 'erro desconhecido'}` });
  else adicionarChat(r.gestor, { quem: 'chefe', titulo, texto: r.relatorio || '(sem relatório)' });
  if (nova) cena.reviverRotina(r);
}
async function sincronizar(inicial = false) {
  const { rotinas, armazem, erro } = await agencia.sincronizar().catch(e => ({ rotinas: [], erro: e.message }));
  const vistas = new Set(ler(CHAVE_ROTINAS_VISTAS, []));
  const novas = rotinas.filter(r => !vistas.has(r.id)).reverse();
  for (const r of novas) { mostrarRotina(r, true); vistas.add(r.id); }
  gravar(CHAVE_ROTINAS_VISTAS, [...vistas].slice(-200));
  if (novas.length && inicial) {
    const resumo = novas.map(r => `${nome(r.gestor)} (${(r.entregas || []).length} entregas, ${(r.decisoes || []).length} decisões)`).join(', ');
    adicionarChat(gestorAtual, { quem: 'evento', html: true, texto: `🌙 <b>Enquanto o app estava fechado</b> a equipe trabalhou: ${resumo}` });
  }
  $('statusRotinas').textContent = chkEnsaio.checked ? 'Modo ensaio: rotinas não são consultadas.'
    : erro ? `Rotinas: ${erro}`
    : armazem === false ? 'As rotinas rodam, mas para guardar os relatórios ligue o Redis (Upstash) na Vercel.'
    : `Última rotina: ${rotinas[0] ? hora(rotinas[0].inicio) + ' · ' + nome(rotinas[0].gestor) : 'nenhuma ainda'}`;
  desenharEntregas();
  desenharDiretoria();
}
for (const b of document.querySelectorAll('[data-rotina]')) {
  b.addEventListener('click', async () => {
    if (chkEnsaio.checked) { $('statusRotinas').textContent = 'Desligue o modo ensaio para rodar uma rotina de verdade.'; return; }
    const original = b.textContent;
    b.disabled = true;
    b.textContent = 'Rodando… (até 5 min)';
    try {
      const r = await agencia.rodarRotina(b.dataset.rotina);
      await sincronizar();
      if (!r.salvo) { mostrarRotina(r.rotina, true); }
      $('statusRotinas').textContent = `Rotina concluída: ${(r.rotina.entregas || []).length} entregas, ${(r.rotina.decisoes || []).length} decisões.`;
    } catch (e) {
      $('statusRotinas').textContent = e.message;
    } finally {
      b.disabled = false;
      b.textContent = original;
    }
  });
}

// ---------- ajustes ----------
chkEnsaio.addEventListener('change', () => {
  gravar(CHAVE_ENSAIO, chkEnsaio.checked);
  $('seloEnsaio').hidden = !chkEnsaio.checked;
  for (const g of Object.keys(GESTORES)) {
    if (agencia.ocupado(g)) continue;
    agencia.novaReuniao(g);
    adicionarChat(g, { quem: 'evento', html: true, texto: chkEnsaio.checked ? '🎭 <b>Modo ensaio ligado.</b> Nova reunião começou.' : '🤖 <b>Modo ensaio desligado.</b> A equipe agora usa IA de verdade.' });
  }
  verificarMeta();
});
$('btZerarGasto').addEventListener('click', () => agencia.zerarGasto());
$('btNova').addEventListener('click', () => {
  if (agencia.ocupado(gestorAtual)) return;
  agencia.novaReuniao(gestorAtual);
  chats[gestorAtual] = [];
  gravar(chaveChat(gestorAtual), []);
  desenharChat();
  abrirAba('chefe');
});
$('btCodigo').addEventListener('click', async () => { const c = await pedirCodigo(); if (c) agencia.trocarCodigo(c); });
$('btApagar').addEventListener('click', () => {
  if (agencia.ocupado() || !confirm('Apagar as entregas deste navegador?')) return;
  agencia.apagarEntregas();
  desenharEntregas();
});

// ---------- início ----------
aplicarPlacar();
$('gasto').textContent = 'US$ ' + agencia.gasto().toFixed(2).replace('.', ',');
trocarGestor(gestorAtual);
desenharEntregas();
desenharDiretoria();
verificarMeta();
sincronizar(true);
setInterval(() => { if (!document.hidden) sincronizar(); }, 5 * 60 * 1000);
