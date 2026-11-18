// Conduz as reuniões do prédio RBTech: cada chefe de andar conversa com o dono, chama a equipe (em paralelo
// quando dá), lê as métricas da Meta e manda as decisões para a auditoria do Israel, no terraço.
// O navegador executa as ferramentas; assim o 3D acompanha cada passo.

export const PESSOAS = {
  // 1º andar · Loja RB TECH
  gerente_loja: { nome: 'Rael', cargo: 'gerente da loja', andar: 0, gestor: true },
  atendimento:  { nome: 'Atendimento', andar: 0, tarefa: '💬 preparando o atendimento' },
  tecnico:      { nome: 'Técnico', andar: 0, tarefa: '🔧 na bancada' },
  // 2º andar · Agência RBTech
  chefe:        { nome: 'Pamella', cargo: 'chefe de tráfego', andar: 1, gestor: true },
  analista:     { nome: 'Analista', andar: 1, tarefa: '📊 analisando os números' },
  copywriter:   { nome: 'Copywriter', andar: 1, tarefa: '✍️ escrevendo os anúncios' },
  roteirista:   { nome: 'Roteirista', andar: 1, tarefa: '🎬 escrevendo o roteiro' },
  revisor:      { nome: 'Revisor', andar: 1, tarefa: '🔎 revisando tudo' },
  gerente_crescimento: { nome: 'Helena', cargo: 'gerente de crescimento', andar: 1, gestor: true },
  especialista: { nome: 'Especialista de crescimento', andar: 1, tarefa: '📱 estudando o Instagram' },
  estrategista_saas: { nome: 'Estrategista SaaS', andar: 1, tarefa: '🧩 planejando como vender o ReparoSimples' },
  // 3º andar · Vendas e SaaS
  head_vendas:  { nome: 'Head de vendas', andar: 2, gestor: true },
  sdr:          { nome: 'Prospecção (SDR)', andar: 2, tarefa: '🎯 achando clientes' },
  closer:       { nome: 'Executivo de vendas', andar: 2, tarefa: '🤝 preparando a proposta' },
  sucesso:      { nome: 'Sucesso do cliente', andar: 2, tarefa: '💛 cuidando da base' },
  produto:      { nome: 'Gestor de produto', andar: 2, tarefa: '🛠️ priorizando o roadmap' },
  // terraço
  israel:       { nome: 'Israel', cargo: 'Boss', andar: 3 },
};
export const EQUIPE = PESSOAS; // nomes usados pela interface

export const GESTORES = {
  gerente_loja: {
    titulo: '1º · Rael · Loja', equipe: ['atendimento', 'tecnico'], rotina: 'loja',
    boasVindas: 'Oi, Israel! Aqui é Rael, da loja RB TECH no 1º andar. Fico na mesa de negociação; no balcão está o atendimento e, no reparo, o técnico. O que você precisa?',
    sugestoes: ['Monta o roteiro de atendimento do balcão e do WhatsApp', 'Checklist para avaliar iPhone usado na troca', 'Mensagens para clientes do conserto'],
  },
  chefe: {
    titulo: '2º · Pamella · Tráfego', equipe: ['analista', 'copywriter', 'roteirista', 'revisor', 'estrategista_saas'], rotina: 'trafego', placar: true,
    boasVindas: 'Oi, Israel! Aqui é Pamella, do tráfego no 2º andar. Me diga o que você quer vender ou o que te preocupa nos anúncios, e eu coloco a equipe para trabalhar.',
    sugestoes: ['Como estão os anúncios? O que você faria?', 'Cria 3 anúncios para o iPhone 15 com chamada pro WhatsApp', 'Monta a estratégia para vender o ReparoSimples e um mês de posts sem aparecer'],
  },
  gerente_crescimento: {
    titulo: '2º · Helena · Crescimento', equipe: ['especialista'], rotina: 'crescimento',
    boasVindas: 'Oi, Israel! Aqui é a Helena, do crescimento no 2º andar. Meu departamento só pensa em uma coisa: fazer a RBTech crescer no Instagram (seguidores, engajamento e melhorias no que já está publicado).',
    sugestoes: ['Lê todas as métricas do Instagram e me dá um plano', 'Quais posts eu devo editar ou repostar?', 'Como ganhar mais seguidores este mês?'],
  },
  head_vendas: {
    titulo: '3º · Vendas e SaaS', equipe: ['sdr', 'closer', 'sucesso', 'produto'], rotina: 'vendas',
    boasVindas: 'Oi, Israel! Aqui é o head de vendas e produtos, no 3º andar. Cuidamos dos sistemas SaaS da RBTech, com o ReparoSimples na frente (também o Sorteia Aí e a própria Agência). Os números do ReparoSimples estão na aba SaaS.',
    sugestoes: ['Como está o ReparoSimples? Lojas, pagantes e receita', 'Monta o plano para converter as lojas em teste em pagantes', 'Qual a melhoria mais importante do ReparoSimples?'],
  },
};

const CHAVE = { entregas: 'agencia.entregas', decisoes: 'agencia.decisoes', token: 'agencia.token', gasto: 'agencia.gasto', pedidos: 'agencia.pedidos', edicoes: 'agencia.edicoes' };

/** Link da página de upload: leva o pedido no próprio endereço (funciona em qualquer aparelho). */
export function linkUpload(pedido) {
  const dados = { id: pedido.id, tipo: pedido.tipo, titulo: pedido.titulo, briefing: pedido.briefing, legenda: pedido.legenda, quando_publicar: pedido.quando_publicar, solicitante: pedido.solicitante, quando: pedido.quando };
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(dados)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${location.origin}/upload.html?p=${b64}`;
}
const chaveConversa = g => (g === 'chefe' ? 'agencia.conversa' : 'agencia.conversa.' + g);
const PRECO = { entrada: 4, saida: 20 }; // por milhão de tokens (estimativa)

export function ler(chave, padrao) {
  try { const v = localStorage.getItem(chave); return v == null ? padrao : JSON.parse(v); } catch { return padrao; }
}
export function gravar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento: segue na memória */ }
}

export function criarAgencia({ ensaio, placarTexto, pedirLogin, aoEvento }) {
  const conversas = {};
  for (const g of Object.keys(GESTORES)) conversas[g] = ler(chaveConversa(g), []);
  let entregas = ler(CHAVE.entregas, []);
  let decisoes = ler(CHAVE.decisoes, []);
  let pedidos = ler(CHAVE.pedidos, []);
  let edicoes = ler(CHAVE.edicoes, []);
  let pedidosServidor = [];
  let edicoesServidor = [];
  let entregasRotina = [];
  let decisoesServidor = [];
  let centralLigada = false; // ações no ReparoSimples (API do RB Central) ligadas no servidor
  let gasto = ler(CHAVE.gasto, { usd: 0 });
  const ocupados = new Set();
  const emitir = (tipo, dados = {}) => aoEvento({ tipo, ...dados });

  const salvar = () => {
    for (const g of Object.keys(conversas)) gravar(chaveConversa(g), conversas[g]);
    gravar(CHAVE.entregas, entregas);
    gravar(CHAVE.decisoes, decisoes);
    gravar(CHAVE.pedidos, pedidos);
    gravar(CHAVE.edicoes, edicoes);
    gravar(CHAVE.gasto, gasto);
  };
  function somarGasto(u) {
    if (!u) return;
    const entrada = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1;
    gasto.usd += (entrada * PRECO.entrada + (u.output_tokens || 0) * PRECO.saida) / 1e6;
    emitir('gasto', { usd: gasto.usd });
  }
  const textoDe = c => (c || []).filter(b => b.type === 'text').map(b => b.text).join('\n\n').trim();
  const proximo = (lista, prefixo) => prefixo + (lista.reduce((m, e) => Math.max(m, Number(String(e.id).replace(prefixo, '')) || 0), 0) + 1);
  const todasEntregas = () => [...entregas, ...entregasRotina];
  const todasDecisoes = () => {
    const mapa = new Map(decisoesServidor.map(d => [d.id, d]));
    for (const d of decisoes) mapa.set(d.id, { ...mapa.get(d.id), ...d });
    return [...mapa.values()].sort((a, b) => b.quando - a.quando);
  };

  function consertarPendencias(msgs) {
    const ultima = msgs[msgs.length - 1];
    if (ultima?.role !== 'assistant' || !Array.isArray(ultima.content)) return;
    const pendentes = ultima.content.filter(b => b.type === 'tool_use');
    if (pendentes.length) {
      msgs.push({ role: 'user', content: pendentes.map(b => ({ type: 'tool_result', tool_use_id: b.id, is_error: true, content: 'Interrompido: a página foi fechada antes desta tarefa terminar.' })) });
    }
  }

  /** Espera a tela voltar (o iPhone pausa o app com a tela bloqueada). */
  const quandoVisivel = () => (document.visibilityState === 'visible' ? Promise.resolve()
    : new Promise(r => document.addEventListener('visibilitychange', function f() { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', f); r(); } })));
  const CAIU = 'A conexão com o servidor caiu (a internet oscilou ou o celular bloqueou a tela). Mande de novo: o que a equipe já entregou fica guardado.';

  async function api(caminho, corpo, metodo = 'POST', tentativa = 1) {
    let resp;
    try {
      resp = await fetch(caminho, {
        method: metodo,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${ler(CHAVE.token, '')}` },
        ...(metodo === 'POST' ? { body: JSON.stringify(corpo) } : {}),
      });
    } catch {
      // conexão caiu ("Load failed" no iPhone): tenta de novo o mesmo pedido quando a tela voltar.
      // Uma rodada com idRodada não é cobrada duas vezes: o servidor devolve o resultado guardado.
      const repetivel = metodo === 'GET' || caminho === '/api/meta' || !!corpo?.idRodada;
      if (repetivel && tentativa < 4) {
        await quandoVisivel();
        await esperar(1500 * tentativa);
        return api(caminho, corpo, metodo, tentativa + 1);
      }
      throw new Error(CAIU);
    }
    let dados = null;
    try { dados = await resp.json(); } catch { /* sem JSON */ }
    if (resp.status === 401 && dados?.precisaLogin) {
      if (!(await pedirLogin())) throw new Error('Faça login para a equipe trabalhar.');
      return api(caminho, corpo, metodo);
    }
    if (!resp.ok || !dados) {
      if (resp.status === 504) throw new Error('O servidor demorou demais para responder. Tente um pedido menor.');
      if (resp.status === 404) throw new Error('Não achei o servidor da agência. Use o modo ensaio ou publique na Vercel.');
      if (resp.ok && !dados) throw new Error(CAIU); // a resposta veio cortada
      throw new Error(dados?.erro || `Erro ${resp.status} no servidor.`);
    }
    if (dados.erro && dados.status >= 400) throw new Error(dados.erro); // erro avisado depois do sinal de vida
    return dados;
  }
  const novoId = () => (crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
  const chamar = corpo => (ensaio() ? simular(corpo) : api('/api/agente', { ...corpo, idRodada: novoId() }));

  function auditoriaTexto(gestor) {
    const minhas = todasDecisoes().filter(d => d.gestor === gestor && d.status && d.status !== 'pendente').slice(0, 6);
    if (!minhas.length) return '';
    return '[AUDITORIA]\n' + minhas.map(d => `- ${d.id} "${d.titulo}": ${d.status === 'aprovada' ? 'APROVADA' : 'RECUSADA'}${d.comentario ? ` — comentário do Israel: ${d.comentario}` : ''}`).join('\n') + '\n[/AUDITORIA]\n\n';
  }

  // ---------- o laço de um funcionário (gestor ou não) ----------
  async function rodar(papel, msgs, ctx) {
    const limite = PESSOAS[papel].gestor ? 14 : 6;
    for (let i = 0; i < limite; i++) {
      if (ctx.gestor === papel) emitir('chefe', { gestor: papel, estado: i === 0 ? 'pensando' : 'relatorio' });
      const r = await chamar({ papel, messages: msgs });
      msgs.push({ role: 'assistant', content: r.content });
      if (ctx.persistir) salvar();
      somarGasto(r.usage);
      if (r.stop_reason === 'refusal') return { texto: 'O filtro de segurança do Claude recusou este pedido. Tente explicar de outro jeito.' };
      const falas = textoDe(r.content);
      const chamados = (r.content || []).filter(b => b.type === 'tool_use');
      if (!chamados.length) return { texto: falas + (r.stop_reason === 'max_tokens' ? '\n\n_(A resposta foi cortada por ser longa demais.)_' : '') };
      if (falas && ctx.gestor === papel) emitir('chefeTexto', { gestor: papel, canal: ctx.canal, texto: falas, final: false });
      if (ctx.gestor === papel) emitir('chefe', { gestor: papel, estado: 'esperando' });
      const resultados = await Promise.all(chamados.map(b => executar(papel, b, ctx)));
      msgs.push({ role: 'user', content: resultados });
      if (ctx.persistir) salvar();
    }
    return { texto: '', limite: true };
  }

  async function executar(papel, b, ctx) {
    const erro = msg => ({ type: 'tool_result', tool_use_id: b.id, is_error: true, content: msg });
    const ent = b.input || {};
    try {
      if (b.name === 'acionar_funcionario') {
        const func = ent.funcionario;
        if (!GESTORES[papel]?.equipe.includes(func) || typeof ent.pedido !== 'string') return erro('Funcionário ou pedido inválido.');
        const anexos = (Array.isArray(ent.anexos) ? ent.anexos : [])
          .map(id => todasEntregas().find(e => e.id === String(id).trim().toUpperCase() || e.id === String(id).trim())).filter(Boolean);
        emitir('acionar', { gestor: papel, papel: func, pedido: ent.pedido, anexos: anexos.map(a => a.id) });
        const pedido = ent.pedido + (anexos.length
          ? '\n\n---\n## Anexos\n' + anexos.map(a => `### ${a.id} — ${PESSOAS[a.papel]?.nome || a.papel}\n${a.texto}`).join('\n\n') : '');
        const coleta = {};
        const r = await rodar(func, [{ role: 'user', content: pedido }], { ...ctx, persistir: false, coleta });
        if (!r.texto) throw new Error(r.limite ? 'passou do limite de rodadas' : 'a resposta veio vazia');
        const entrega = { id: proximo(entregas, 'E'), papel: func, gestor: papel, pedido: ent.pedido, anexos: anexos.map(a => a.id), texto: r.texto, quando: Date.now(), ensaio: !!ensaio(), ...(coleta.ideias ? { ideias: coleta.ideias } : {}) };
        entregas.push(entrega);
        salvar();
        emitir('entrega', { gestor: papel, entrega });
        return { type: 'tool_result', tool_use_id: b.id, content: `Entrega ${entrega.id} (${PESSOAS[func].nome}):\n\n${r.texto}` };
      }
      if (b.name === 'entregar_ideias') {
        if (ctx.coleta) ctx.coleta.ideias = ent;
        else {
          const entrega = { id: proximo(entregas, 'E'), papel, gestor: papel, pedido: 'Ideias de crescimento', anexos: [], texto: ent.resumo || '', ideias: ent, quando: Date.now(), ensaio: !!ensaio() };
          entregas.push(entrega);
          salvar();
          emitir('entrega', { gestor: papel, entrega });
        }
        return { type: 'tool_result', tool_use_id: b.id, content: 'Ideias registradas: o Israel vai ver o relatório organizado em HTML. Agora escreva só um resumo curto.' };
      }
      if (b.name === 'pedir_midia') {
        const pedido = { ...ent, id: proximo(pedidos, 'P'), solicitante: papel, quando: Date.now(), status: 'aguardando_midia', ensaio: !!ensaio() };
        pedidos.push(pedido);
        salvar();
        if (!ensaio()) api('/api/instagram', { acao: 'salvar_pedido', pedido }).catch(() => {});
        emitir('pedido', { gestor: ctx.gestor, pedido });
        return { type: 'tool_result', tool_use_id: b.id, content: `Pedido ${pedido.id} criado. O Israel recebeu o link de upload; ele sobe o arquivo, revisa a legenda e aprova a publicação. Não diga que já foi publicado.` };
      }
      if (b.name === 'sugerir_edicao_manual') {
        const edicao = { ...ent, id: proximo(edicoes, 'M'), autor: papel, quando: Date.now(), feito: false, ensaio: !!ensaio() };
        edicoes.push(edicao);
        salvar();
        if (!ensaio()) api('/api/instagram', { acao: 'salvar_edicao', edicao }).catch(() => {});
        emitir('edicao', { gestor: ctx.gestor, edicao });
        return { type: 'tool_result', tool_use_id: b.id, content: `Edição ${edicao.id} registrada como card para o Israel aplicar no Instagram.` };
      }
      if (b.name === 'enviar_para_israel') {
        const d = {
          id: proximo(decisoes, 'D'), gestor: papel, andar: PESSOAS[papel].andar,
          titulo: String(ent.titulo || 'Decisão').slice(0, 140), decisao: ent.decisao || '', motivo: ent.motivo || '', riscos: ent.riscos || '',
          urgencia: ent.urgencia || 'media', entregas: ent.entregas || [], acoes: Array.isArray(ent.acoes) ? ent.acoes.slice(0, 30) : [],
          status: 'pendente', comentario: '', quando: Date.now(), origem: 'app', ensaio: !!ensaio(),
        };
        decisoes.push(d);
        salvar();
        emitir('decisao', { gestor: papel, decisao: d });
        if (!ensaio()) api('/api/decisoes', { acao: 'salvar', decisao: d }).catch(() => {});
        return { type: 'tool_result', tool_use_id: b.id, content: `Decisão ${d.id} entregue na sala do Israel, no terraço${d.acoes.length ? `, com ${d.acoes.length} ação(ões) no ReparoSimples que acontecem quando ele aprovar` : ''}. Status: pendente de auditoria. Não execute nada antes da aprovação; siga com o relatório.` };
      }
      if (b.name.startsWith('ler_')) {
        emitir('meta', { papel, tipo: b.name });
        const dados = ensaio() ? metaDeEnsaio(b.name) : await api('/api/meta', { consulta: b.name, ...ent });
        return { type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(dados).slice(0, 40000) };
      }
      return erro('Ferramenta desconhecida.');
    } catch (e) {
      if (b.name === 'acionar_funcionario') emitir('erroFuncionario', { gestor: papel, papel: ent.funcionario, erro: e.message });
      return erro(`Não deu certo: ${e.message}`);
    }
  }

  /** Reunião convocada pelo Israel: cada chefe responde pelo seu andar (em paralelo). */
  async function reuniao(texto, participantes = Object.keys(GESTORES)) {
    const livres = participantes.filter(g => !ocupados.has(g));
    if (!livres.length || !texto.trim()) return;
    emitir('reuniao', { estado: 'inicio', participantes: livres });
    const pauta = `[REUNIÃO CONVOCADA PELO ISRAEL, NA MESA DO TERRAÇO, COM OS CHEFES DE TODOS OS ANDARES]
Pauta do Israel: ${texto.trim()}
Responda pelo seu andar em até 8 linhas: como está, o que você propõe e o que precisa do Israel. Acione a equipe ou envie decisões só se for indispensável.`;
    await Promise.allSettled(livres.map(g => enviar(g, pauta, 'reuniao')));
    emitir('reuniao', { estado: 'fim', participantes: livres });
  }

  async function enviar(gestor, texto, canal = null) {
    if (ocupados.has(gestor) || !texto.trim() || !GESTORES[gestor]) return;
    ocupados.add(gestor);
    emitir('ocupado', { gestor, ocupado: true });
    const msgs = conversas[gestor];
    consertarPendencias(msgs);
    const placar = GESTORES[gestor].placar ? `[PLACAR]\n${placarTexto()}\n[/PLACAR]\n\n` : '';
    msgs.push({ role: 'user', content: placar + auditoriaTexto(gestor) + texto.trim() });
    salvar();
    let terminou = false;
    try {
      const r = await rodar(gestor, msgs, { gestor, persistir: true, canal });
      if (r.limite) emitir('aviso', { gestor, canal, texto: 'Passou do limite de rodadas. Peça para fechar o relatório.' });
      else { emitir('chefeTexto', { gestor, canal, texto: r.texto || '(sem resposta)', final: true }); terminou = true; }
    } catch (e) {
      emitir('aviso', { gestor, canal, texto: e.message });
    } finally {
      ocupados.delete(gestor);
      emitir('chefe', { gestor, estado: terminou ? 'pronto' : 'livre' });
      emitir('ocupado', { gestor, ocupado: false });
    }
  }

  // ---------- rotinas e auditoria guardadas no servidor ----------
  async function sincronizar() {
    if (ensaio()) return { rotinas: [], armazem: null };
    const [rot, dec, ins] = await Promise.allSettled([api('/api/rotina', null, 'GET'), api('/api/decisoes', null, 'GET'), api('/api/instagram', null, 'GET')]);
    const rotinas = rot.status === 'fulfilled' ? rot.value.rotinas || [] : [];
    if (dec.status === 'fulfilled') { decisoesServidor = dec.value.decisoes || []; centralLigada = !!dec.value.central; }
    if (ins.status === 'fulfilled') { pedidosServidor = ins.value.pedidos || []; edicoesServidor = ins.value.edicoes || []; }
    for (const r of rotinas) {
      for (const p of r.pedidos || []) if (!pedidosServidor.some(x => x.id === p.id)) pedidosServidor.push(p);
      for (const e of r.edicoes || []) if (!edicoesServidor.some(x => x.id === e.id)) edicoesServidor.push(e);
    }
    for (const r of rotinas) for (const d of r.decisoes || []) if (!decisoesServidor.some(x => x.id === d.id)) decisoesServidor.push(d);
    entregasRotina = rotinas.flatMap(r => (r.entregas || []).map(e => ({ ...e, gestor: r.gestor, rotina: r.id })));
    return { rotinas, armazem: rot.status === 'fulfilled' ? rot.value.armazem : null, ativas: rot.status === 'fulfilled' ? rot.value.ativas : null, erro: rot.status === 'rejected' ? rot.reason.message : null };
  }
  async function rodarRotina(equipe) {
    return api(`/api/rotina?equipe=${encodeURIComponent(equipe)}&executar=1`, {});
  }
  /** Aprova ou recusa. Aprovada com ações: o servidor executa no ReparoSimples e devolve o resultado de cada uma. */
  async function auditar(id, status, comentario) {
    let local = decisoes.find(d => d.id === id);
    if (local) Object.assign(local, { status, comentario, auditadaEm: Date.now() });
    else { local = { ...(decisoesServidor.find(d => d.id === id) || { id }), status, comentario, auditadaEm: Date.now() }; decisoes.push(local); }
    salvar();
    if (ensaio() || local.ensaio) return local;
    try {
      const r = await api('/api/decisoes', { acao: 'auditar', id, status, comentario, decisao: local });
      if (r?.decisao?.execucao) { Object.assign(local, { execucao: r.decisao.execucao, executadaEm: r.decisao.executadaEm }); salvar(); }
    } catch (e) {
      if (status === 'aprovada' && local.acoes?.length) { local.execucao = [{ acao: 'Executar as ações', ok: false, detalhe: e.message }]; salvar(); }
    }
    return local;
  }

  // ---------- modo ensaio: respostas de mentira para ver a animação sem gastar créditos ----------
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  const PLANO_ENSAIO = {
    chefe: [['analista'], ['copywriter', 'roteirista'], ['revisor'], ['israel']],
    gerente_crescimento: [['meta:ler_metricas_instagram', 'especialista'], ['midia'], ['israel']],
    gerente_loja: [['meta:ler_ordens_de_servico', 'atendimento', 'tecnico'], ['israel']],
    head_vendas: [['sdr', 'produto'], ['closer', 'sucesso'], ['israel']],
  };
  async function simular(corpo) {
    const vazio = { input_tokens: 0, output_tokens: 0 };
    const id = () => 'ensaio_' + Math.random().toString(36).slice(2, 10);
    const papel = corpo.papel;
    if (!PESSOAS[papel].gestor) {
      await esperar(4000 + Math.random() * 4000);
      const leitura = { analista: 'ler_metricas_anuncios', especialista: 'ler_posts_instagram' }[papel];
      if (papel === 'especialista' && corpo.messages.length === 3) return { stop_reason: 'tool_use', usage: vazio, content: IDEIAS_ENSAIO(id) };
      if (leitura && corpo.messages.length === 1) {
        return { stop_reason: 'tool_use', usage: vazio, content: [{ type: 'tool_use', id: id(), name: leitura, input: leitura === 'ler_posts_instagram' ? { quantidade: 12 } : { periodo: '7dias', nivel: 'conta' } }] };
      }
      return { stop_reason: 'end_turn', usage: vazio, content: [{ type: 'text', text: `**${PESSOAS[papel].nome}** (ensaio)\n\nEsta é uma entrega de mentira, só para ver o escritório funcionando. Desligue o modo ensaio para a equipe trabalhar de verdade.\n\n- Item 1 do trabalho\n- Item 2 do trabalho\n- Item 3 do trabalho` }] };
    }
    await esperar(2000 + Math.random() * 1500);
    let etapa = 0;
    for (let i = corpo.messages.length - 1; i >= 0; i--) {
      const m = corpo.messages[i];
      if (m.role !== 'user') continue;
      if (Array.isArray(m.content) && m.content.some(b => b.type === 'tool_result')) etapa++; else break;
    }
    const plano = PLANO_ENSAIO[papel];
    if (etapa < plano.length) {
      const blocos = plano[etapa].map(item => {
        if (item === 'israel') {
          const acoes = papel === 'gerente_loja' ? [
            { tipo: 'avisar_cliente', os: '371', mensagem: 'Oi! Aqui é da RB Tech: seu iPhone já está pronto para retirada. Quando passar, te esperamos! (ensaio)', status: '', campos: [] },
            { tipo: 'editar_os', os: '408', mensagem: '', status: '', campos: [{ campo: 'previsao_entrega', valor: '2026-11-22' }] },
          ] : [];
          return { type: 'tool_use', id: id(), name: 'enviar_para_israel', input: { titulo: papel === 'gerente_loja' ? 'Mutirão de avisos das OS prontas (ensaio)' : 'Testar a sugestão da equipe por 7 dias (ensaio)', decisao: 'Aplicar a melhoria principal sugerida pela equipe e medir por 7 dias.', motivo: 'Entregas da equipe nesta reunião (ensaio).', riscos: 'Nenhum dado real ainda: é um ensaio.', urgencia: 'media', entregas: entregas.slice(-2).map(e => e.id), acoes } };
        }
        if (item === 'midia') {
          return { type: 'tool_use', id: id(), name: 'pedir_midia', input: { tipo: 'reels', titulo: 'Unboxing do iPhone 15 na loja (ensaio)', briefing: 'Grave 20 segundos na vertical: a mão abrindo a caixa, o aparelho girando na luz da janela e você dizendo "chegou na RB Tech!". Termine apontando para a câmera.', legenda: 'Chegou na RB Tech 📦✨ Qual cor você levaria? Comenta aqui 👇 e chama no WhatsApp para saber condições. #iphone #florianopolis #rbtech', quando_publicar: 'quinta às 19h (horário de mais alcance nos últimos posts)' } };
        }
        if (item.startsWith('meta:')) return { type: 'tool_use', id: id(), name: item.slice(5), input: { periodo: '7dias' } };
        return { type: 'tool_use', id: id(), name: 'acionar_funcionario', input: { funcionario: item, pedido: `Tarefa de ensaio para ${PESSOAS[item].nome}.`, anexos: etapa > 0 ? entregas.slice(-2).map(e => e.id) : [] } };
      });
      const fala = etapa === 0 ? [{ type: 'text', text: 'Beleza! Vou colocar a equipe para trabalhar. _(ensaio: respostas de mentira, sem IA)_' }] : [];
      return { stop_reason: 'tool_use', usage: vazio, content: [...fala, ...blocos] };
    }
    const minhas = entregas.filter(e => e.gestor === papel).slice(-4).map(e => `- ${e.id}: ${PESSOAS[e.papel].nome}`).join('\n');
    const dec = decisoes.filter(d => d.gestor === papel).slice(-1).map(d => d.id).join(', ');
    return { stop_reason: 'end_turn', usage: vazio, content: [{ type: 'text', text: `**Resumo** (ensaio)\nReunião de mentira, só para ver o prédio funcionando.\n\n**O que a equipe entregou**\n${minhas}\n\n**Decisões enviadas ao Israel**\n- ${dec || 'nenhuma'}\n\n**Próximo passo**\nDesligue o modo ensaio para a equipe trabalhar de verdade.` }] };
  }
  function IDEIAS_ENSAIO(id) {
    return [
      { type: 'tool_use', id: id(), name: 'entregar_ideias', input: {
        titulo: 'Plano de crescimento da semana (ensaio)',
        resumo: 'Relatório de ensaio, com números de mentira, só para mostrar o formato. Reels de bastidores e de unboxing puxam mais alcance; carrosséis de comparação puxam mais salvamentos.',
        numeros_chave: [
          { nome: 'Seguidores', valor: '12.000', leitura: 'base atual (ensaio)' },
          { nome: 'Alcance 7 dias', valor: '31 mil', leitura: '3x os seguidores: reels levando para fora da base' },
          { nome: 'Salvamentos por carrossel', valor: '22', leitura: 'conteúdo útil é guardado' },
        ],
        ideias: [
          { titulo: 'Unboxing semanal "chegou na RB Tech"', tipo: 'reels', prioridade: 'alta', gancho: 'Olha o que acabou de chegar 👀', como_fazer: 'Toda quinta, 20 s na vertical abrindo a caixa do aparelho da semana.', por_que: 'Reels de produto tiveram o maior alcance do mês (ensaio).', como_medir: 'Alcance e compartilhamentos; meta: 5 mil de alcance.' },
          { titulo: 'Carrossel "qual iPhone é para você"', tipo: 'carrossel', prioridade: 'alta', gancho: 'Não sabe qual iPhone comprar? Salva esse post.', como_fazer: '6 cards comparando modelos por uso: câmera, bateria, preço [PREÇO].', por_que: 'Carrosséis úteis geram salvamentos.', como_medir: 'Salvamentos; meta: 40.' },
          { titulo: 'Caixinha de perguntas nos stories', tipo: 'stories', prioridade: 'media', gancho: 'Pergunta qualquer coisa sobre iPhone 📱', como_fazer: 'Toda segunda, responder 5 perguntas com vídeo curto.', por_que: 'Respostas aproximam e puxam DMs.', como_medir: 'Respostas e mensagens no direct.' },
          { titulo: 'Bio com chamada clara para o WhatsApp', tipo: 'edicao', prioridade: 'alta', gancho: '', como_fazer: 'Trocar a bio pelo texto do card de edição.', por_que: 'A bio é a primeira coisa que o visitante lê.', como_medir: 'Cliques no link da bio.' },
        ],
      } },
      { type: 'tool_use', id: id(), name: 'sugerir_edicao_manual', input: { onde: 'bio', link: '', texto_atual: '', texto_novo: '📱 iPhones e celulares em Florianópolis\n💬 Chama no WhatsApp 👇 [LINK DO WHATSAPP]', motivo: 'Ensaio: a bio precisa dizer o que a loja vende e chamar para o WhatsApp.' } },
    ];
  }
  function metaDeEnsaio(nome) {
    const base = { ensaio: true, aviso: 'Números de ENSAIO, não são reais.' };
    if (nome === 'ler_metricas_anuncios') return { ...base, linhas: [{ investimento: 180, conversasWhatsApp: 23, custoPorConversa: 7.83, ctr: 1.9, cpm: 21.4, frequencia: 1.6 }] };
    if (nome === 'ler_ordens_de_servico') return { ...base, total: 3, ordens: [{ os: '371', status: 'pronta para retirada', modelo: 'iPhone 13', cliente: 'Cliente Exemplo', valor: 350 }] };
    if (nome === 'ler_sorteios_no_instagram') return { ...base, perfisCitados: [{ perfil: '@loja_exemplo', posts: 2, exemplo: 'https://instagram.com/p/exemplo' }], posts: [], avisos: [] };
    if (nome === 'ler_central_de_conteudo') return { ...base, storiesDeHoje: { estrategia: { estrategiaDoDia: 'Aquecer a Black Friday (exemplo).' } }, ultimoRelatorioDeReels: 'nenhum ainda', estoqueDaSemana: '13 128 seminovo (exemplo)' };
    if (nome === 'ler_saas_reparo') return { ...base, lojas: 64, ativas: 31, emTeste: 18, pagantes: 27, receitaMensal: { reais: 1880 }, novasNoMes: 9, recentes: [{ nome: 'Assistência Exemplo', plano: 'Pro', situacao: 'teste' }] };
    if (nome === 'ler_posts_instagram') return { ...base, posts: [{ tipo: 'reels', curtidas: 210, comentarios: 18, numeros: { reach: 5400, shares: 31, saved: 22 } }] };
    return { ...base, perfil: { usuario: 'rbtech', seguidores: 12000 }, numerosDoPeriodo: { reach: 31000, accounts_engaged: 1400 } };
  }

  return {
    enviar, reuniao, sincronizar, rodarRotina, auditar,
    centralLigada: () => centralLigada,
    ocupado: g => (g ? ocupados.has(g) : ocupados.size > 0),
    entregas: () => todasEntregas().sort((a, b) => a.quando - b.quando),
    decisoes: todasDecisoes,
    pedidos() {
      const mapa = new Map(pedidosServidor.map(p => [p.id, p]));
      for (const p of pedidos) mapa.set(p.id, { ...p, ...(mapa.get(p.id) || {}), ...(p.status === 'publicado' ? p : {}) });
      return [...mapa.values()].sort((a, b) => b.quando - a.quando);
    },
    edicoes() {
      const mapa = new Map(edicoesServidor.map(e => [e.id, e]));
      for (const e of edicoes) mapa.set(e.id, { ...(mapa.get(e.id) || {}), ...e });
      return [...mapa.values()].sort((a, b) => b.quando - a.quando);
    },
    marcarEdicao(id, feito) {
      const local = edicoes.find(e => e.id === id);
      if (local) local.feito = feito;
      else edicoes.push({ ...(edicoesServidor.find(e => e.id === id) || { id }), feito });
      salvar();
      if (!ensaio()) api('/api/instagram', { acao: 'marcar_edicao', id, feito }).catch(() => {});
    },
    recarregarLocal() { pedidos = ler(CHAVE.pedidos, []); edicoes = ler(CHAVE.edicoes, []); },
    gasto: () => gasto.usd,
    zerarGasto() { gasto = { usd: 0 }; salvar(); emitir('gasto', { usd: 0 }); },
    novaReuniao(g) { if (!ocupados.has(g)) { conversas[g] = []; salvar(); } },
    apagarEntregas() { if (!ocupados.size) { entregas = []; salvar(); } },
  };
}
