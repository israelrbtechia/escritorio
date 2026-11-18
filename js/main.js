// Liga o prédio 3D, os chats com os chefes de cada andar, as entregas, a diretoria (auditoria do Israel),
// o placar, a Meta e as rotinas automáticas.
import { criarAgencia, PESSOAS, GESTORES, ler, gravar, linkUpload } from './agencia.js';
import { markdown } from './markdown.js';
import { abrirRelatorio, baixarRelatorio, gerarHtmlTrabalho, abrirHtml, baixarHtml } from './relatorio.js';
import { criarVoz } from './voz.js';

const $ = id => document.getElementById(id);
const CHAVE_PLACAR = 'agencia.placar';
const CHAVE_ENSAIO = 'agencia.ensaio';
const CHAVE_GESTOR = 'agencia.gestorAtual';
const CHAVE_ROTINAS_VISTAS = 'agencia.rotinasVistas';
const chaveChat = g => (g === 'chefe' ? 'agencia.chat' : 'agencia.chat.' + g);
const PLACAR_EXEMPLO = { conversasHoje: 23, investimentoHoje: 180, metaCusto: 9, diasNaMeta: 4, ehExemplo: true };

const brl = n => (Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '–');
const hora = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const nome = p => (p === 'reuniao' ? 'Reunião geral' : PESSOAS[p]?.nome || p);
const CANAIS = ['reuniao', ...Object.keys(GESTORES)];
const REUNIAO = {
  titulo: '🏛️ Reunião geral',
  boasVindas: 'Israel, aqui você convoca os chefes. Escreva a pauta: Rael, Pamella, Helena e o head de vendas sobem até a mesa do terraço e cada um responde pelo seu andar.',
  sugestoes: ['Como está cada andar hoje? Prioridade de cada um?', 'Onde estamos perdendo dinheiro?', 'O que cada andar precisa de mim esta semana?'],
};
const canalInfo = g => (g === 'reuniao' ? REUNIAO : GESTORES[g]);

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

// ---------- ReparoSimples: OS da loja RB Tech no laboratório do térreo ----------
let reparoLigado = false;
async function sincronizarOs() {
  if (semServidor) { $('statusReparo').textContent = 'Prévia sem servidor: o ReparoSimples só aparece no site publicado na Vercel.'; return; }
  if (chkEnsaio.checked) { $('statusReparo').textContent = 'Modo ensaio ligado: desmarque “Modo ensaio” aqui em cima para ver as OS reais da loja.'; return; }
  $('statusReparo').textContent = 'Consultando o ReparoSimples…';
  try {
    const r = await chamarApi('/api/os', null, 'GET');
    if (r.configurado) {
      reparoLigado = true;
      cena.definirOrdensDeServico(r.ordens);
      const n = s => r.ordens.filter(o => o.status === s).length;
      $('statusReparo').textContent = `✅ Ligado à loja “${r.loja || 'RB Tech'}” · ${r.ordens.length} OS em andamento (${n('analise') + n('peca')} na fila, ${n('servico')} em reparo, ${n('concluido')} prontas). Atualiza a cada 1 min.`;
    } else {
      $('statusReparo').textContent = 'Não ligado: crie REPARO_SUPABASE_URL e REPARO_SUPABASE_SERVICE_KEY na Vercel. Enquanto isso o laboratório mostra OS de exemplo.';
    }
  } catch (e) {
    $('statusReparo').textContent = `ReparoSimples: ${e.message}`;
  }
}

// ---------- ReparoSimples como SaaS (3º andar): lojas, pagantes, receita, lojas novas e servidores ----------
const CHAVE_SAAS_VISTO = 'saas.vistoAte';
const CHAVE_REVISAO_VISTA = 'saas.revisaoVista';
const SIT_SAAS = { ativa: ['ativa', 'verde'], teste: ['em teste', 'amarelo'], inadimplente: ['inadimplente', 'laranja'], expirada: ['expirada', 'cinza'], somente_leitura: ['só leitura', 'cinza'], bloqueada: ['bloqueada', 'vermelho'] };
const NIVEL = { ok: ['🟢', 'tudo certo'], atencao: ['🟡', 'atenção'], falha: ['🔴', 'falha'] };
const reais = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
let saas = null;
function saasDeExemplo() {
  const h = Date.now();
  return {
    exemplo: true,
    numeros: { lojas: 64, ativas: 31, emTeste: 18, inadimplentes: 2, expiradas: 12, bloqueadas: 1, pagantes: 27, pagantesPorPlano: { Essencial: 15, Pro: 11, 'Pro Max': 1 }, porOrigem: { kiwify: 24, hotmart: 3 },
      receitaMensal: { reais: 1456.75, hotmart: null }, novasNoMes: 9, novas7dias: 3,
      recentes: [{ nome: 'Assistência Exemplo', criada: new Date(h - 3 * 36e5).toISOString(), plano: 'Pro', situacao: 'teste' }, { nome: 'Cell Fix Exemplo', criada: new Date(h - 30 * 36e5).toISOString(), plano: 'Essencial', situacao: 'ativa' }] },
    revisao: { quando: h - 2 * 36e5, status: 'ok', origem: 'automatica', checagens: [{ nome: 'Banco de dados (Supabase)', nivel: 'ok', ms: 180, detalhe: '' }, { nome: 'Login das lojas (Supabase Auth)', nivel: 'ok', ms: 120, detalhe: '' }] },
  };
}
function desenharSaasPainel() {
  const n = saas?.numeros;
  $('kpisSaas').innerHTML = !n ? '' : [
    ['Lojas ativas', n.ativas], ['Pagantes', n.pagantes], ['Receita mensal', reais(n.receitaMensal?.reais)],
    ['Em teste', n.emTeste], ['Inadimplentes', n.inadimplentes], ['Novas no mês', n.novasNoMes],
  ].map(([r, v]) => `<div class="kpi-saas"><b>${esc(v)}</b><small>${r}</small></div>`).join('');
  const planos = Object.entries(n?.pagantesPorPlano || {}).map(([p, q]) => `${esc(p)} ${q}`).join(' · ');
  const hot = n?.receitaMensal?.hotmart ? ` · Hotmart: ${esc(n.receitaMensal.hotmart.moeda)} ${Number(n.receitaMensal.hotmart.valor).toLocaleString('pt-BR')}/mês` : '';
  $('detalheSaas').innerHTML = !n ? '' : `${n.lojas} lojas cadastradas · ${n.expiradas} expiradas · ${n.bloqueadas} bloqueadas · ${n.novas7dias} novas em 7 dias<br>Pagantes por plano: ${planos || '—'}${hot}${n.pagamentosPendentes ? `<br>⚠️ ${n.pagamentosPendentes} pagamento(s) esperando revisão no painel admin` : ''}`;
  $('listaLojasSaas').innerHTML = (n?.recentes || []).map(l => {
    const [rot, cor] = SIT_SAAS[l.situacao] || [l.situacao, 'cinza'];
    return `<div class="loja-saas"><div><b>${esc(l.nome)}</b><small>${hora(l.criada)} · ${esc(l.plano)}</small></div><span class="pill-saas ${cor}">${esc(rot)}</span></div>`;
  }).join('') || '<p class="vazio-lista">Nenhuma loja ainda.</p>';
  const revs = saas?.revisoes?.length ? saas.revisoes : saas?.revisao ? [saas.revisao] : [];
  $('revisoesSaas').innerHTML = revs.map((r, i) => {
    const [bola, texto] = NIVEL[r.status] || ['⚪', r.status];
    const itens = (r.checagens || []).map(c => `<li>${(NIVEL[c.nivel] || ['⚪'])[0]} ${esc(c.nome)}${c.ms ? ` <small>${c.ms} ms</small>` : ''}${c.detalhe ? ` · <small>${esc(c.detalhe)}</small>` : ''}</li>`).join('');
    const novas = r.novas?.length ? `<p>🏪 Lojas novas desde a revisão anterior: ${r.novas.map(l => esc(l.nome)).join(', ')}</p>` : '';
    return `<details class="entrega" ${i === 0 ? 'open' : ''}><summary>${bola} <b>${texto}</b> · ${hora(r.quando)} · ${r.origem === 'automatica' ? 'automática' : 'manual'}</summary><ul class="checagens">${itens}</ul>${novas}</details>`;
  }).join('') || '<p class="vazio-lista">Nenhuma revisão ainda. A primeira roda às 8h41 ou 20h41, ou toque em "Revisar agora".</p>';
  $('btAvisosSaas').hidden = !('Notification' in window) || Notification.permission !== 'default';
}
function notificar(titulo, corpo) {
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification(titulo, { body: corpo, tag: titulo + corpo }); } catch { /* sem aviso */ }
}
function avisosDoSaas(novas, revisao) {
  for (const l of novas) {
    const [rot] = SIT_SAAS[l.situacao] || [l.situacao];
    adicionarChat('head_vendas', { quem: 'evento', html: true, texto: `🔔 <b>Loja nova no ReparoSimples:</b> ${esc(l.nome)} (${esc(l.plano)}, ${esc(rot)})` });
    notificar('🔔 Loja nova no ReparoSimples', `${l.nome} · ${l.plano}`);
  }
  if (novas.length) { $('numSaas').textContent = String(Number($('numSaas').textContent || 0) + novas.length); focarAuto('saas'); }
  if (revisao && revisao.id && revisao.id !== ler(CHAVE_REVISAO_VISTA, '')) {
    gravar(CHAVE_REVISAO_VISTA, revisao.id);
    if (revisao.status !== 'ok') {
      const ruins = revisao.checagens.filter(c => c.nivel !== 'ok').map(c => `${c.nome}: ${c.detalhe || c.nivel}`).join('; ');
      adicionarChat('head_vendas', { quem: 'aviso', texto: `Revisão dos servidores do ReparoSimples (${hora(revisao.quando)}): ${revisao.status === 'falha' ? 'FALHA' : 'atenção'}. ${ruins}` });
      notificar(revisao.status === 'falha' ? '🔴 ReparoSimples com falha' : '🟡 ReparoSimples pede atenção', ruins);
    }
  }
}
async function sincronizarSaas() {
  if (semServidor || chkEnsaio.checked) {
    saas = saasDeExemplo();
    $('statusSaas').textContent = semServidor ? 'Prévia sem servidor: números de EXEMPLO.' : 'Modo ensaio: números de EXEMPLO. Desligue o modo ensaio para ver os reais.';
    cena.definirSaas(saas);
    return desenharSaasPainel();
  }
  try {
    const r = await chamarApi('/api/saas', null, 'GET');
    if (!r.configurado) {
      $('statusSaas').textContent = 'Não ligado: o ReparoSimples usa as mesmas variáveis do laboratório (REPARO_SUPABASE_URL e REPARO_SUPABASE_SERVICE_KEY).';
      return;
    }
    saas = { numeros: r.numeros || saas?.numeros || null, revisao: r.revisoes?.[0] || null, revisoes: r.revisoes || [] };
    $('statusSaas').textContent = r.erro ? `ReparoSimples: ${r.erro}` : `✅ Atualizado ${hora(Date.now())}.`;
    let novas = [];
    const recentes = r.numeros?.recentes || [];
    if (recentes.length) {
      const maisNova = Math.max(...recentes.map(l => Date.parse(l.criada) || 0));
      const visto = ler(CHAVE_SAAS_VISTO, 0);
      if (!visto) gravar(CHAVE_SAAS_VISTO, maisNova); // primeira vez: só marca, sem aviso
      else {
        novas = recentes.filter(l => (Date.parse(l.criada) || 0) > visto);
        if (novas.length) gravar(CHAVE_SAAS_VISTO, maisNova);
      }
    }
    cena.definirSaas(saas, novas);
    avisosDoSaas(novas, saas.revisao);
    desenharSaasPainel();
  } catch (e) {
    $('statusSaas').textContent = `ReparoSimples: ${e.message}`;
  }
}
$('btRevisar').addEventListener('click', async () => {
  if (semServidor || chkEnsaio.checked) { $('statusSaas').textContent = 'A revisão real só roda fora do modo ensaio, no site publicado.'; return; }
  $('btRevisar').disabled = true;
  $('statusSaas').textContent = 'Revisando os servidores do ReparoSimples…';
  try {
    const r = await chamarApi('/api/saas?revisar=1', {});
    if (!r.configurado) $('statusSaas').textContent = 'O ReparoSimples ainda não está ligado.';
    else await sincronizarSaas();
    if (r.revisao && !r.salvo) {
      saas = { ...(saas || {}), revisao: r.revisao, revisoes: [r.revisao, ...(saas?.revisoes || [])].slice(0, 6) };
      cena.definirSaas(saas);
      desenharSaasPainel();
      $('statusSaas').textContent = 'Revisão feita. Para guardar o histórico das revisões, ligue o Redis (Upstash) na Vercel.';
    }
  } catch (e) {
    $('statusSaas').textContent = `Revisão: ${e.message}`;
  } finally {
    $('btRevisar').disabled = false;
  }
});
$('btAvisosSaas').addEventListener('click', async () => {
  try { await Notification.requestPermission(); } catch { /* navegador sem aviso */ }
  desenharSaasPainel();
});

// ---------- câmeras ----------
const autoCam = $('autoCam');
let timerCam = null;
let ultimoFoco = Date.now();
let setorMostrado = null;
function desenharAngulos(setor) {
  setorMostrado = setor;
  for (const b of $('camSetores').querySelectorAll('[data-setor]')) b.classList.toggle('ativa', b.dataset.setor === setor);
  const caixa = $('camAngulos');
  caixa.textContent = '';
  for (const cam of escritorio.cameras.filter(c => c.setor === setor)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.cam = cam.id;
    b.textContent = cam.botao;
    b.title = cam.nome;
    b.addEventListener('click', () => { autoCam.checked = false; focar(cam.id); });
    caixa.appendChild(b);
  }
}
function marcarCamera(cam) {
  $('camNome').textContent = cam.nome;
  if (!escritorio) return;
  if (cam.setor !== setorMostrado) desenharAngulos(cam.setor);
  for (const b of $('camAngulos').children) b.classList.toggle('ativa', b.dataset.cam === cam.id);
  for (const q of $('mosaicoGrade').children) q.classList.toggle('atual', q.dataset.cam === cam.id);
}
function focar(id, atraso = 0) {
  if (!id) return;
  clearTimeout(timerCam);
  ultimoFoco = Date.now() + atraso;
  timerCam = setTimeout(() => { if (escritorio) marcarCamera(escritorio.irParaCamera(id)); }, atraso);
}
if (new URLSearchParams(location.search).has('debug')) window.predio = escritorio; // só para testes
let mexeuAte = 0; // depois que você mexe na câmera, a câmera automática espera um pouco antes de trocar
const focarAuto = (id, atraso = 0) => { if (autoCam.checked && Date.now() > mexeuAte) focar(id, atraso); };
escritorio?.aoMexerNaCamera?.(() => { mexeuAte = Date.now() + 20_000; ultimoFoco = Date.now(); clearTimeout(timerCam); });
const cameraDe = papel => (escritorio?.cameraDe ? escritorio.cameraDe(papel) : { analista: 'analise', revisor: 'analise', copywriter: 'criacao', roteirista: 'criacao', chefe: 'chefe' }[papel] || 'geral');
if (escritorio) {
  for (const setor of escritorio.setores) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.setor = setor.id;
    b.textContent = setor.nome;
    b.addEventListener('click', () => {
      autoCam.checked = false;
      desenharAngulos(setor.id);
      focar(escritorio.cameras.find(c => c.setor === setor.id).id);
    });
    $('camSetores').appendChild(b);
  }
  marcarCamera(escritorio.cameraAtual());
} else {
  $('btMosaico').hidden = true;
}

// ---------- mosaico: central com várias câmeras ao vivo ----------
const ABAS_MOSAICO = [{ id: 'todos', nome: 'Todos' }, ...(escritorio?.setores || []).filter(s => s.id !== 'caes')];
let abaMosaico = 'todos';
function camerasDaAba(aba) {
  if (aba === 'todos') return escritorio.mosaicoTodos.map(id => escritorio.cameras.find(c => c.id === id)).filter(Boolean);
  return escritorio.cameras.filter(c => c.setor === aba);
}
/** Escolhe o número de colunas que deixa cada quadro mais perto de 16:10, sem rolar. */
function ajustarGrade() {
  const grade = $('mosaicoGrade');
  const n = grade.children.length;
  if (!n) return;
  const w = grade.clientWidth, h = grade.clientHeight;
  let melhor = 1, nota = Infinity;
  for (let cols = 1; cols <= Math.min(n, 6); cols++) {
    const linhas = Math.ceil(n / cols);
    const a = (w / cols) / (h / linhas);
    const vazios = cols * linhas - n;
    const d = Math.abs(Math.log(a / 1.6)) + vazios * 0.08;
    if (d < nota) { nota = d; melhor = cols; }
  }
  grade.style.gridTemplateColumns = `repeat(${melhor}, minmax(0, 1fr))`;
  grade.style.gridTemplateRows = `repeat(${Math.ceil(n / melhor)}, minmax(0, 1fr))`;
}
function desenharMosaico() {
  const abas = $('mosaicoAbas');
  abas.textContent = '';
  for (const aba of ABAS_MOSAICO) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(aba.id === abaMosaico));
    b.className = aba.id === abaMosaico ? 'ativa' : '';
    b.textContent = aba.nome;
    b.addEventListener('click', () => { abaMosaico = aba.id; desenharMosaico(); });
    abas.appendChild(b);
  }
  const grade = $('mosaicoGrade');
  grade.textContent = '';
  const atual = escritorio.cameraAtual().id;
  for (const cam of camerasDaAba(abaMosaico)) {
    const q = document.createElement('button');
    q.type = 'button';
    q.className = 'quadro' + (cam.id === atual ? ' atual' : '');
    q.dataset.cam = cam.id;
    q.title = `Abrir ${cam.nome}`;
    const nome = document.createElement('span');
    nome.className = 'quadro-nome';
    const [num, resto] = cam.nome.split(' · ');
    const elNum = document.createElement('span');
    elNum.className = 'quadro-num';
    elNum.textContent = `${num} · `;
    nome.append(elNum, resto || '');
    const setor = document.createElement('span');
    setor.className = 'quadro-setor';
    setor.textContent = escritorio.setores.find(s => s.id === cam.setor)?.nome || '';
    q.append(nome, setor);
    q.addEventListener('click', () => { fecharMosaico(); autoCam.checked = false; focar(cam.id); });
    grade.appendChild(q);
  }
  ajustarGrade();
  if (escritorio.mosaicoAberto()) escritorio.abrirMosaico(grade); // limpa a imagem dos quadros antigos
}
function abrirMosaico() {
  if (!escritorio) return;
  $('mosaico').hidden = false;
  $('moldura').classList.add('com-mosaico');
  $('btMosaico').classList.add('ativa');
  desenharMosaico();
  escritorio.abrirMosaico($('mosaicoGrade'));
}
function fecharMosaico() {
  if (!escritorio?.mosaicoAberto()) return;
  escritorio.fecharMosaico();
  $('mosaico').hidden = true;
  $('moldura').classList.remove('com-mosaico');
  $('btMosaico').classList.remove('ativa');
}
$('btMosaico').addEventListener('click', () => (escritorio?.mosaicoAberto() ? fecharMosaico() : abrirMosaico()));
$('btFecharMosaico').addEventListener('click', fecharMosaico);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && escritorio?.mosaicoAberto()) fecharMosaico(); });
new ResizeObserver(() => { if (escritorio?.mosaicoAberto()) ajustarGrade(); }).observe($('mosaicoGrade'));

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
  if (nomeAba === 'saas') $('numSaas').textContent = '0';
  for (const b of document.querySelectorAll('.aba-bt')) b.classList.toggle('ativa', b.dataset.aba === nomeAba);
  for (const s of document.querySelectorAll('.aba')) s.classList.toggle('ativa', s.id === 'aba-' + nomeAba);
}
for (const b of document.querySelectorAll('.aba-bt')) b.addEventListener('click', () => abrirAba(b.dataset.aba));

// ---------- login ----------
let loginPendente = null;
function pedirLogin() {
  if (loginPendente) return loginPendente;
  const tela = $('telaLogin');
  tela.hidden = false;
  $('loginUsuario').focus();
  loginPendente = new Promise(res => {
    $('formLogin').onsubmit = async e => {
      e.preventDefault();
      $('loginErro').textContent = '';
      $('btEntrar').disabled = true;
      try {
        const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario: $('loginUsuario').value, senha: $('loginSenha').value }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.erro || 'Não deu para entrar.');
        gravar('agencia.token', d.token || '');
        $('loginSenha').value = '';
        tela.hidden = true;
        loginPendente = null;
        res(true);
      } catch (err) {
        $('loginErro').textContent = err.message;
      } finally {
        $('btEntrar').disabled = false;
      }
    };
  });
  return loginPendente;
}
let semServidor = false;
async function conferirLogin() {
  try {
    const r = await fetch('/api/login', { headers: { authorization: `Bearer ${ler('agencia.token', '')}` } });
    const json = (r.headers.get('content-type') || '').includes('json');
    if (!r.ok || !json) { semServidor = true; return; }
    const d = await r.json();
    if (d.exigeLogin && !d.valido) await pedirLogin();
  } catch { semServidor = true; }
}
/** Sem o servidor da Vercel (prévia), tudo roda em modo ensaio. */
function modoPrevia() {
  if (!semServidor) return;
  chkEnsaio.checked = true;
  chkEnsaio.disabled = true;
  $('seloEnsaio').hidden = false;
  $('seloEnsaio').textContent = 'PRÉVIA · sem servidor, modo ensaio';
  $('statusMeta').textContent = 'Prévia: a Meta só funciona com o site publicado na Vercel.';
}
async function chamarApi(caminho, corpo, metodo = 'POST') {
  const resp = await fetch(caminho, {
    method: metodo,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${ler('agencia.token', '')}` },
    ...(metodo === 'POST' ? { body: JSON.stringify(corpo) } : {}),
  });
  const dados = await resp.json().catch(() => null);
  if (resp.status === 401 && dados?.precisaLogin) {
    await pedirLogin();
    return chamarApi(caminho, corpo, metodo);
  }
  if (!resp.ok || !dados) throw new Error(dados?.erro || (resp.status === 404 ? 'Servidor não encontrado (publique na Vercel).' : `Erro ${resp.status}.`));
  return dados;
}

// ---------- chats (um por chefe) ----------
let gestorAtual = CANAIS.includes(ler(CHAVE_GESTOR, 'chefe')) ? ler(CHAVE_GESTOR, 'chefe') : 'chefe';
const chats = {};
for (const g of CANAIS) chats[g] = ler(chaveChat(g), []);
let reuniaoAtiva = false;
const canalOcupado = g => (g === 'reuniao' ? reuniaoAtiva : agencia?.ocupado(g));
let indicador = null;

function desenharSeletor() {
  const s = $('gestores');
  s.innerHTML = '';
  for (const g of CANAIS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gestor-bt' + (g === gestorAtual ? ' ativo' : '') + (canalOcupado(g) ? ' trabalhando' : '') + (g === 'reuniao' ? ' reuniao' : '');
    b.textContent = canalInfo(g).titulo;
    b.addEventListener('click', () => trocarGestor(g));
    s.appendChild(b);
  }
}
function trocarGestor(g, focarCamera = true) {
  gestorAtual = g;
  gravar(CHAVE_GESTOR, g);
  desenharChat();
  desenharSeletor();
  $('btEnviar').disabled = canalOcupado(g);
  $('entrada').placeholder = g === 'reuniao' ? 'Escreva a pauta da reunião… (Enter envia)' : `Fale com ${nome(g)}… (Enter envia)`;
  if (focarCamera) focarAuto(cameraDe(g));
}
const CODIGOS = /\b(?:R[a-z0-9]+-)?E\d+\b/g; // códigos das entregas (E1, E2… e os das rotinas)
const temHtml = item => item.quem === 'chefe' && (item.final || (item.texto || '').length > 500 || /\b(?:R[a-z0-9]+-)?E\d+\b/.test(item.texto || ''));
function elementoMsg(item, gestor) {
  const el = document.createElement('div');
  el.className = 'msg ' + item.quem;
  if (item.quem === 'chefe') el.innerHTML = `<div class="quem">${item.titulo || nome(gestor)}</div>${markdown(item.texto)}${temHtml(item) ? `<div class="msg-acoes"><button type="button" data-html-chat="abrir" data-quando="${item.quando}">📄 Abrir em HTML</button><button type="button" class="bt-sec" data-html-chat="baixar" data-quando="${item.quando}">⬇️ Baixar</button></div>` : ''}`;
  else if (item.html) el.innerHTML = item.texto;
  else el.textContent = item.texto;
  return el;
}
function desenharChat() {
  const c = $('chat');
  c.innerHTML = '';
  indicador = null;
  if (!chats[gestorAtual].length) adicionarChat(gestorAtual, { quem: gestorAtual === 'reuniao' ? 'evento' : 'chefe', texto: canalInfo(gestorAtual).boasVindas });
  else for (const m of chats[gestorAtual]) c.appendChild(elementoMsg(m, gestorAtual));
  if (canalOcupado(gestorAtual)) mostrarDigitando(true);
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
    indicador.innerHTML = `<div class="quem">${gestorAtual === 'reuniao' ? 'Chefes' : nome(gestorAtual)}</div><span class="digitando"><i></i><i></i><i></i></span>`;
    $('chat').appendChild(indicador);
    $('chat').scrollTop = $('chat').scrollHeight;
  } else if (!ligar && indicador) { indicador.remove(); indicador = null; }
}
function atualizarSugestoes() {
  const s = $('sugestoes');
  s.innerHTML = '';
  if (chats[gestorAtual].some(m => m.quem === 'voce')) return;
  for (const texto of canalInfo(gestorAtual).sugestoes) {
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
      <div class="entrega-acoes"><button type="button" class="bt-sec">Copiar texto</button><button type="button" data-html="abrir">📄 Abrir em HTML</button><button type="button" class="bt-sec" data-html="baixar">⬇️ Baixar HTML</button></div>`;
    card.querySelector('.entrega-id').textContent = e.id;
    card.querySelector('.entrega-quem').textContent = nome(e.papel);
    card.querySelector('.entrega-hora').textContent = hora(e.quando);
    const ped = card.querySelector('.entrega-pedido');
    ped.textContent = `${nome(e.gestor || 'chefe')} pediu: ${e.pedido}${e.anexos?.length ? `\n\nAnexos: ${e.anexos.join(', ')}` : ''}`;
    ped.style.whiteSpace = 'pre-wrap';
    card.querySelector('[data-html="abrir"]').addEventListener('click', () => (e.ideias ? abrirRelatorio(e, opcoesRelatorio(e)) : abrirHtml(htmlDaEntrega(e))));
    card.querySelector('[data-html="baixar"]').addEventListener('click', () => (e.ideias ? baixarRelatorio(e, opcoesRelatorio(e)) : baixarHtml(htmlDaEntrega(e), `entrega-rbtech-${e.id}.html`)));
    const bt = card.querySelector('button');
    bt.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(e.texto); bt.textContent = 'Copiado ✓'; } catch { bt.textContent = 'Não deu para copiar'; }
      setTimeout(() => { bt.textContent = 'Copiar texto'; }, 1800);
    });
    box.appendChild(card);
  }
}

// ---------- Instagram: pedidos de mídia, edições manuais e relatórios de ideias ----------
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const opcoesRelatorio = e => ({ autor: e.papel === 'gerente_crescimento' ? 'Helena · gerente de crescimento' : `${nome(e.papel)} · time da Helena`, usuario: metaStatus?.instagram?.usuario || '' });
const NOME_TIPO = { reels: '🎬 Reels', post: '🖼️ Post', carrossel: '🗂️ Carrossel', stories: '⏱️ Stories' };
const STATUS_PEDIDO = { aguardando_midia: ['AGUARDANDO SEU ARQUIVO', 'pendente'], midia_recebida: ['ARQUIVO RECEBIDO', 'pendente'], processando: ['META PROCESSANDO', 'pendente'], publicado: ['PUBLICADO', 'aprovada'] };
const ONDE = { bio: 'Bio do perfil', link_bio: 'Link da bio', legenda: 'Legenda de post', destaques: 'Destaques', fixado: 'Post fixado', capa: 'Capa de reels', outro: 'Outro' };
function desenharInstagram() {
  agencia.recarregarLocal();
  const pedidos = agencia.pedidos();
  const edicoes = agencia.edicoes();
  const relatorios = agencia.entregas().filter(e => e.ideias).reverse();
  const pendentes = pedidos.filter(p => p.status !== 'publicado').length + edicoes.filter(e => !e.feito).length;
  $('numInsta').textContent = pendentes;
  $('numInsta').classList.toggle('alerta', pendentes > 0);

  const bp = $('listaPedidos');
  bp.innerHTML = pedidos.length ? '' : '<div class="vazio-lista">Nenhum pedido de mídia. Quando a Helena precisar de um vídeo ou foto, o link aparece aqui.</div>';
  for (const p of pedidos) {
    const [st, cls] = STATUS_PEDIDO[p.status] || STATUS_PEDIDO.aguardando_midia;
    const card = document.createElement('article');
    card.className = 'entrega';
    card.innerHTML = `<div class="entrega-topo"><span class="entrega-id">${esc(p.id)}</span><span class="entrega-quem">${NOME_TIPO[p.tipo] || esc(p.tipo)}</span><span class="selo selo-${cls}">${st}</span>${p.ensaio ? '<span class="selo">ENSAIO</span>' : ''}<span class="entrega-hora">${hora(p.quando)}</span></div>
      <h4 class="decisao-titulo">${esc(p.titulo)}</h4>
      <div class="entrega-texto"><p>${esc(p.briefing).replace(/\n/g, '<br>')}</p>${p.quando_publicar ? `<p><b>Quando:</b> ${esc(p.quando_publicar)}</p>` : ''}</div>
      <div class="entrega-acoes">${p.status === 'publicado'
        ? (p.permalink ? `<a class="bt-link" href="${esc(p.permalink)}" target="_blank" rel="noopener">Ver no Instagram</a>` : '')
        : `<a class="bt-link primario" href="${esc(linkUpload(p))}" target="_blank" rel="noopener">⬆️ Abrir página de upload</a><button type="button" class="bt-sec">Copiar link</button>`}</div>`;
    card.querySelector('button')?.addEventListener('click', async ev => {
      try { await navigator.clipboard.writeText(linkUpload(p)); ev.target.textContent = 'Copiado ✓'; } catch { ev.target.textContent = 'Não deu para copiar'; }
    });
    bp.appendChild(card);
  }

  const be = $('listaEdicoes');
  be.innerHTML = edicoes.length ? '' : '<div class="vazio-lista">Nenhuma edição manual sugerida ainda.</div>';
  const perfil = metaStatus?.instagram?.usuario ? `https://www.instagram.com/${metaStatus.instagram.usuario}/` : 'https://www.instagram.com/';
  for (const e of edicoes) {
    const card = document.createElement('article');
    card.className = 'entrega edicao' + (e.feito ? ' feita' : '');
    card.innerHTML = `<div class="entrega-topo"><span class="entrega-id">${esc(e.id)}</span><span class="entrega-quem">✍️ ${esc(ONDE[e.onde] || e.onde)}</span>${e.feito ? '<span class="selo selo-aprovada">FEITO</span>' : '<span class="selo selo-pendente">APLICAR</span>'}${e.ensaio ? '<span class="selo">ENSAIO</span>' : ''}<span class="entrega-hora">${hora(e.quando)}</span></div>
      <p class="dica" style="margin:6px 0">${esc(e.motivo)}</p>
      ${e.texto_atual ? `<details><summary>Como está hoje</summary><div class="texto-colar antigo">${esc(e.texto_atual)}</div></details>` : ''}
      <div class="texto-colar">${esc(e.texto_novo)}</div>
      <div class="entrega-acoes"><button type="button" data-a="copiar">📋 Copiar texto novo</button><a class="bt-link" href="${esc(e.link || perfil)}" target="_blank" rel="noopener">Abrir no Instagram</a>
        <label class="chave" style="margin-left:auto"><input type="checkbox" ${e.feito ? 'checked' : ''}><span>Feito</span></label></div>`;
    card.querySelector('[data-a="copiar"]').addEventListener('click', async ev => {
      try { await navigator.clipboard.writeText(e.texto_novo); ev.target.textContent = 'Copiado ✓'; } catch { ev.target.textContent = 'Não deu para copiar'; }
      setTimeout(() => { ev.target.textContent = '📋 Copiar texto novo'; }, 1800);
    });
    card.querySelector('input').addEventListener('change', ev => { agencia.marcarEdicao(e.id, ev.target.checked); desenharInstagram(); });
    be.appendChild(card);
  }

  const br = $('listaRelatorios');
  br.innerHTML = relatorios.length ? '' : '<div class="vazio-lista">Os relatórios de ideias do time da Helena aparecem aqui.</div>';
  for (const e of relatorios) {
    const card = document.createElement('article');
    card.className = 'entrega';
    const n = e.ideias.ideias?.length || 0;
    card.innerHTML = `<div class="entrega-topo"><span class="entrega-id">${esc(e.id)}</span><span class="entrega-quem">📄 ${esc(e.ideias.titulo || 'Ideias de crescimento')}</span>${e.ensaio ? '<span class="selo">ENSAIO</span>' : ''}<span class="entrega-hora">${hora(e.quando)}</span></div>
      <p class="dica" style="margin:6px 0">${n} ideias · ${esc(nome(e.papel))}</p>
      <div class="entrega-acoes"><button type="button" data-a="abrir">Abrir relatório HTML</button><button type="button" class="bt-sec" data-a="baixar">⬇️ Baixar</button></div>`;
    card.querySelector('[data-a="abrir"]').addEventListener('click', () => abrirRelatorio(e, opcoesRelatorio(e)));
    card.querySelector('[data-a="baixar"]').addEventListener('click', () => baixarRelatorio(e, opcoesRelatorio(e)));
    br.appendChild(card);
  }
}
// a página de upload grava o andamento no navegador: atualiza a aba quando ela mudar
addEventListener('storage', ev => { if (ev.key === 'agencia.pedidos') desenharInstagram(); });
addEventListener('focus', () => desenharInstagram());
// ---------- relatórios em HTML de qualquer equipe ----------
const EQUIPE_DE = { gerente_loja: '1º andar · Loja RB TECH', chefe: '2º andar · Tráfego', gerente_crescimento: '2º andar · Crescimento', head_vendas: '3º andar · Vendas e SaaS', reuniao: 'Reunião geral no terraço' };
const GESTOR_PADRAO = Object.fromEntries(Object.entries(GESTORES).flatMap(([g, x]) => x.equipe.map(p => [p, g])));
const paraHtml = e => ({ id: e.id, autor: nome(e.papel), quando: e.quando, pedido: e.pedido, texto: e.texto });
function htmlDaEntrega(e) {
  const g = e.gestor || GESTOR_PADRAO[e.papel] || e.papel;
  const pedido = String(e.pedido || '').replace(/\s+/g, ' ');
  return gerarHtmlTrabalho({ titulo: `${e.id} · ${nome(e.papel)}`, equipe: EQUIPE_DE[g] || nome(g), autor: nome(e.papel), quando: e.quando, entregas: [{ ...paraHtml(e), pedido }], ensaio: e.ensaio });
}
function htmlDoChat(item, canal) {
  const todas = agencia.entregas();
  const codigos = [...new Set(item.texto.match(CODIGOS) || [])];
  let entregas = codigos.map(c => todas.find(e => e.id === c)).filter(Boolean);
  if (!entregas.length && canal !== 'reuniao') {
    entregas = todas.filter(e => (e.gestor || GESTOR_PADRAO[e.papel]) === canal && e.quando <= item.quando + 2000 && e.quando > item.quando - 45 * 60_000);
  }
  const pedido = [...chats[canal]].reverse().find(m => m.quem === 'voce' && m.quando <= item.quando)?.texto || '';
  const curto = pedido.replace(/\s+/g, ' ').trim();
  const titulo = curto ? (curto.length > 90 ? curto.slice(0, 88) + '…' : curto) : (item.texto.match(/^#{1,3}\s+(.+)$/m)?.[1] || `Relatório de ${item.titulo || nome(canal)}`).replace(/[*_`]/g, '');
  return gerarHtmlTrabalho({
    titulo, equipe: EQUIPE_DE[canal] || nome(canal), autor: item.titulo || nome(canal), quando: item.quando,
    pedido, relatorio: item.texto, entregas: entregas.map(paraHtml), ensaio: entregas.some(e => e.ensaio),
  });
}
$('chat').addEventListener('click', ev => {
  const b = ev.target.closest('[data-html-chat]');
  if (!b) return;
  const item = chats[gestorAtual].find(m => m.quem === 'chefe' && String(m.quando) === b.dataset.quando);
  if (!item) return;
  const html = htmlDoChat(item, gestorAtual);
  if (b.dataset.htmlChat === 'abrir') abrirHtml(html);
  else baixarHtml(html, `relatorio-rbtech-${gestorAtual}-${new Date(item.quando).toISOString().slice(0, 16).replace(/[:T]/g, '-')}.html`);
});
// links de relatório dentro do chat
$('chat').addEventListener('click', ev => {
  const a = ev.target.closest('[data-relatorio]');
  if (!a) return;
  ev.preventDefault();
  const e = agencia.entregas().find(x => x.id === a.dataset.relatorio);
  if (e) abrirRelatorio(e, opcoesRelatorio(e));
});

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

const CHAVE_VOZES = 'agencia.vozes';
const chkVozes = $('chkVozes');
chkVozes.checked = ler(CHAVE_VOZES, true);
const CHAVE_VOZ_REAL = 'agencia.vozReal';
const chkVozReal = $('chkVozReal');
chkVozReal.checked = ler(CHAVE_VOZ_REAL, false); // economia: começa desligada
const voz = criarVoz({
  token: () => ler('agencia.token', ''),
  ensaio: () => chkEnsaio.checked,
  premium: () => chkVozReal.checked,
  aoFalar: (papel, sim) => cena.falando(papel, sim),
});
voz.ligar(chkVozes.checked);
async function atualizarStatusVozes() {
  await voz.verificar();
  $('statusVozes').textContent = !chkVozes.checked ? 'Vozes desligadas.'
    : voz.usaElevenlabs() ? 'Vozes do ElevenLabs (uma voz para cada funcionário). Perguntas por áudio transcritas pelo ElevenLabs e revisadas pelo Claude Haiku.'
    : 'Vozes do navegador, grátis (tom diferente para cada um). Perguntas por áudio: reconhecimento do navegador + revisão do Claude Haiku.';
  $('btMic').hidden = !voz.podeOuvir();
}
chkVozes.addEventListener('change', () => { gravar(CHAVE_VOZES, chkVozes.checked); voz.ligar(chkVozes.checked); atualizarStatusVozes(); });
chkVozReal.addEventListener('change', () => { gravar(CHAVE_VOZ_REAL, chkVozReal.checked); atualizarStatusVozes(); });

const agencia = criarAgencia({
  ensaio: () => chkEnsaio.checked,
  placarTexto,
  pedirLogin,
  aoEvento(ev) {
    const g = ev.gestor;
    const canal = ev.canal || g;
    switch (ev.tipo) {
      case 'ocupado':
        if (g === gestorAtual) { $('btEnviar').disabled = ev.ocupado; mostrarDigitando(ev.ocupado); }
        desenharSeletor();
        break;
      case 'reuniao':
        reuniaoAtiva = ev.estado === 'inicio';
        if (reuniaoAtiva) {
          cena.reuniao(ev.participantes);
          adicionarChat('reuniao', { quem: 'evento', html: true, texto: `🏛️ ${ev.participantes.map(nome).join(', ')} subindo para a mesa do terraço` });
          focarAuto('terraco', 1500);
        } else {
          cena.fimReuniao();
          adicionarChat('reuniao', { quem: 'evento', html: true, texto: '👏 <b>Reunião encerrada.</b> Cada um voltou para o seu andar.' });
        }
        if (gestorAtual === 'reuniao') { $('btEnviar').disabled = reuniaoAtiva; mostrarDigitando(reuniaoAtiva); }
        desenharSeletor();
        break;
      case 'chefe':
        cena.gestor(g, ev.estado);
        if (ev.estado === 'pensando') focarAuto(cameraDe(g));
        break;
      case 'chefeTexto':
        adicionarChat(canal, { quem: 'chefe', titulo: canal === 'reuniao' ? (PESSOAS[g].cargo ? `${nome(g)} · ${PESSOAS[g].cargo}` : nome(g)) : undefined, texto: ev.texto, final: !!ev.final });
        if (ev.final) { cena.comemorar(g); focarAuto(cameraDe(g)); voz.falar(g, ev.texto); }
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
        adicionarChat(g, { quem: 'evento', html: true, texto: `📄 <b>${nome(ev.entrega.papel)}</b> entregou <b>${ev.entrega.id}</b>${ev.entrega.ideias ? ` · <a href="#" data-relatorio="${esc(ev.entrega.id)}">abrir relatório de ideias</a>` : ''}` });
        desenharEntregas();
        if (ev.entrega.ideias) desenharInstagram();
        focarAuto(cameraDe(ev.entrega.papel));
        break;
      case 'meta':
        cena.consultar(ev.papel, ev.tipo);
        break;
      case 'pedido':
        cena.fala(ev.pedido.solicitante, `📎 pedi um ${ev.pedido.tipo} pro Israel`);
        adicionarChat(g, { quem: 'evento', html: true, texto: `📎 ${esc(nome(ev.pedido.solicitante))} pediu um <b>${esc(NOME_TIPO[ev.pedido.tipo] || ev.pedido.tipo)}</b>: “${esc(ev.pedido.titulo)}” · <a href="${esc(linkUpload(ev.pedido))}" target="_blank" rel="noopener">abrir página de upload</a>` });
        desenharInstagram();
        break;
      case 'edicao':
        adicionarChat(g, { quem: 'evento', html: true, texto: `✍️ Card para aplicar à mão no Instagram: <b>${esc(ONDE[ev.edicao.onde] || ev.edicao.onde)}</b> (aba Instagram)` });
        desenharInstagram();
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
        adicionarChat(canal || gestorAtual, { quem: 'aviso', texto: (canal === 'reuniao' ? `${nome(g)}: ` : '') + ev.texto });
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
  if (!texto || canalOcupado(gestorAtual)) return;
  $('entrada').value = '';
  adicionarChat(gestorAtual, { quem: 'voce', texto });
  if (gestorAtual === 'reuniao') agencia.reuniao(texto);
  else agencia.enviar(gestorAtual, texto);
});
// ---------- pergunta por áudio ----------
let pararDeOuvir = null;
$('btMic').addEventListener('click', async () => {
  const bt = $('btMic');
  if (pararDeOuvir) {
    const parar = pararDeOuvir;
    pararDeOuvir = null;
    bt.classList.remove('gravando');
    bt.textContent = '⏳';
    try {
      const ouvido = (await parar()).trim();
      if (!ouvido) { bt.textContent = '🎙️'; return; }
      $('entrada').value = ouvido;
      $('entrada').value = await voz.revisar(ouvido); // o Claude Haiku corrige nomes e pontuação
      $('form').requestSubmit();
    } catch (e) {
      adicionarChat(gestorAtual, { quem: 'aviso', texto: `Áudio: ${e.message}` });
    }
    bt.textContent = '🎙️';
    return;
  }
  try {
    voz.calar();
    pararDeOuvir = await voz.comecarAOuvir(parcial => { $('entrada').value = parcial; });
    bt.classList.add('gravando');
    bt.textContent = '⏹';
  } catch (e) {
    adicionarChat(gestorAtual, { quem: 'aviso', texto: `Microfone: ${e.message}` });
  }
});

$('entrada').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('form').requestSubmit(); }
});

// ---------- rotinas (a equipe trabalha com o app fechado) ----------
function mostrarRotina(r, nova) {
  const quando = hora(r.inicio);
  const titulo = `${nome(r.gestor)} · rotina ${r.origem === 'manual' ? 'manual' : 'automática'} de ${quando}`;
  if (r.status !== 'ok') adicionarChat(r.gestor, { quem: 'aviso', texto: `Rotina de ${quando} falhou: ${r.erro || 'erro desconhecido'}` });
  else adicionarChat(r.gestor, { quem: 'chefe', titulo, texto: r.relatorio || '(sem relatório)', final: true });
  if (nova) cena.reviverRotina(r);
}
async function sincronizar(inicial = false) {
  const { rotinas, armazem, ativas, erro } = await agencia.sincronizar().catch(e => ({ rotinas: [], erro: e.message }));
  const vistas = new Set(ler(CHAVE_ROTINAS_VISTAS, []));
  const novas = rotinas.filter(r => !vistas.has(r.id)).reverse();
  for (const r of novas) { mostrarRotina(r, true); vistas.add(r.id); }
  gravar(CHAVE_ROTINAS_VISTAS, [...vistas].slice(-200));
  if (novas.length && inicial) {
    const resumo = novas.map(r => `${nome(r.gestor)} (${(r.entregas || []).length} entregas, ${(r.decisoes || []).length} decisões)`).join(', ');
    adicionarChat(gestorAtual, { quem: 'evento', html: true, texto: `🌙 <b>Enquanto o app estava fechado</b> a equipe trabalhou: ${resumo}` });
  }
  const standby = !Array.isArray(ativas) ? '' : ativas.length ? `Automáticas ligadas: ${ativas.join(', ')}. ` : '💤 Automáticas em standby (economia): só rodam quando você aperta um botão. ';
  $('statusRotinas').textContent = chkEnsaio.checked ? 'Modo ensaio: rotinas não são consultadas.'
    : erro ? `Rotinas: ${erro}`
    : standby + (armazem === false ? 'Para guardar os relatórios, ligue o Redis (Upstash) na Vercel.'
      : `Última rotina: ${rotinas[0] ? hora(rotinas[0].inicio) + ' · ' + nome(rotinas[0].gestor) : 'nenhuma ainda'}`);
  desenharEntregas();
  desenharDiretoria();
  desenharInstagram();
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
  sincronizarOs();
  sincronizarSaas();
});
$('btZerarGasto').addEventListener('click', () => agencia.zerarGasto());
$('btNova').addEventListener('click', () => {
  if (canalOcupado(gestorAtual)) return;
  if (gestorAtual !== 'reuniao') agencia.novaReuniao(gestorAtual);
  chats[gestorAtual] = [];
  gravar(chaveChat(gestorAtual), []);
  desenharChat();
  abrirAba('chefe');
});
$('btSair').addEventListener('click', () => { gravar('agencia.token', ''); location.reload(); });
$('btApagar').addEventListener('click', () => {
  if (agencia.ocupado() || !confirm('Apagar as entregas deste navegador?')) return;
  agencia.apagarEntregas();
  desenharEntregas();
});

// ---------- início ----------
await conferirLogin();
modoPrevia();
atualizarStatusVozes();
aplicarPlacar();
$('gasto').textContent = 'US$ ' + agencia.gasto().toFixed(2).replace('.', ',');
trocarGestor(gestorAtual, false);
desenharEntregas();
desenharDiretoria();
desenharInstagram();
if (!semServidor) { verificarMeta(); sincronizar(true); sincronizarOs(); }
sincronizarSaas();
setInterval(() => { if (!document.hidden) sincronizarSaas(); }, 5 * 60 * 1000); // só leitura do banco, sem IA
setInterval(() => { if (!document.hidden) sincronizarOs(); }, 60000); // economia: 1 consulta por minuto
setInterval(() => { if (!document.hidden) sincronizar(); }, 5 * 60 * 1000);
