// Ações no sistema da loja RB Tech pela API do RB Central do ReparoSimples (/api/central/...).
// O prédio faz o mesmo que o RB Central: lê relatório, metas, vendas, OS e pedidos de peças à vontade, e
// ESCREVE (WhatsApp, status, edição, pagamento, OS nova, peças, metas) só quando o Israel aprova a decisão na Diretoria.
// A API do RB Central é presa a uma loja só (CENTRAL_LOJA no projeto do ReparoSimples) e segue as mesmas regras do app.
//
// Variáveis no projeto do PRÉDIO na Vercel:
//   REPARO_CENTRAL_URL    endereço do site do ReparoSimples (ex.: https://reparorbtech.vercel.app)
//   REPARO_CENTRAL_TOKEN  o mesmo valor de CENTRAL_API_TOKEN do projeto do ReparoSimples
// WhatsApp: a mensagem sai pelo WhatsApp conectado na loja (ReparoSimples → Configurações → WhatsApp, ex.: API oficial da Meta).

const base = () => String(process.env.REPARO_CENTRAL_URL || '').trim().replace(/\/api\/central.*$/i, '').replace(/\/+$/, '');
const token = () => String(process.env.REPARO_CENTRAL_TOKEN || '').trim();
export const centralLigada = () => (/^https:\/\//.test(base()) || /^http:\/\/localhost[:/]/.test(base())) && token().length >= 40;

export class ErroCentral extends Error {}

async function central(metodo, rota, corpo) {
  if (!centralLigada()) throw new ErroCentral('A API do RB Central não está ligada (faltam REPARO_CENTRAL_URL e REPARO_CENTRAL_TOKEN na Vercel do prédio).');
  let r;
  try {
    r = await fetch(`${base()}/api/central/${rota}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    throw new ErroCentral(`Não consegui falar com o ReparoSimples (${e.name === 'TimeoutError' ? 'demorou demais' : 'sem conexão'}).`);
  }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) throw new ErroCentral('O ReparoSimples recusou o token: confira se REPARO_CENTRAL_TOKEN é igual ao CENTRAL_API_TOKEN do ReparoSimples.');
  if (r.status === 503) throw new ErroCentral('A API do RB Central está desligada no ReparoSimples (falta CENTRAL_API_TOKEN ou CENTRAL_LOJA lá).');
  if (!r.ok) throw new ErroCentral(j.erro || `ReparoSimples respondeu ${r.status}.`);
  return j;
}

/** OS da loja pelo RB Central (com valor, previsão, técnico e nome do cliente; sem telefone). */
export async function listarOsCentral({ limite = 100 } = {}) {
  const { os = [] } = await central('GET', `os?limite=${Math.min(Math.max(limite, 1), 100)}`);
  return os.map(o => ({
    os: String(o.numero), status: o.status, modelo: o.aparelho?.modelo || o.modelo || '', cliente: o.cliente?.nome || '',
    temWhatsapp: !!o.cliente?.whatsapp, defeito: o.defeito || '', servico: o.servico || '', valor: o.valor ?? null,
    previsao: o.previsao_entrega || null, tecnico: o.tecnico || '', observacoes: o.observacoes || '',
    criadoEm: o.criado_em || null, atualizado: o.atualizado_em || null,
  }));
}

// ---------- leitura (sem aprovação): o mesmo que o RB Central vê ----------
const semTelefone = x => JSON.parse(JSON.stringify(x, (k, v) => (k === 'whatsapp' ? undefined : v)));
const dataOk = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
export async function lerSistemaDaLoja({ consulta, desde = '', ate = '' } = {}) {
  const q = new URLSearchParams();
  if (dataOk(desde)) q.set('desde', desde);
  if (dataOk(ate)) q.set('ate', ate);
  if (consulta === 'relatorio') return central('GET', `relatorio${dataOk(desde) ? `?dia=${desde}` : ''}`);
  if (consulta === 'metas') return central('GET', 'metas');
  if (consulta === 'vendas_aparelhos') { q.set('limite', '200'); return semTelefone(await central('GET', `vendas-aparelhos?${q}`)); }
  if (consulta === 'vendas') { q.set('limite', '300'); return semTelefone(await central('GET', `vendas?${q}`)); }
  if (consulta === 'pedidos_pecas') return central('GET', 'pedidos-pecas?status=todos');
  if (consulta === 'configuracao') return central('GET', 'status'); // status das OS, formas de pagamento, campos, fornecedores
  throw new ErroCentral('Consulta desconhecida. Use relatorio, metas, vendas, vendas_aparelhos, pedidos_pecas ou configuracao.');
}

// ---------- ações que os chefes podem propor (acontecem só com o ok do Israel) ----------
export const TIPOS_ACAO = ['avisar_cliente', 'aviso_pronto', 'mudar_status', 'editar_os', 'registrar_pagamento', 'criar_os', 'pedir_peca', 'remover_pedido_peca', 'enviar_pedido_pecas', 'definir_meta'];
export const STATUS_PERMITIDOS = ['analise', 'peca', 'servico', 'concluido', 'interrompido'];
export const CAMPOS_EDITAVEIS = ['previsao_entrega', 'tecnico', 'observacoes', 'servico', 'defeito', 'valor', 'garantia_dias', 'acessorios'];
export const FORMAS = ['dinheiro', 'pix', 'debito', 'credito', 'transferencia', 'outro'];
/** Parâmetros de cada tipo (vão em "campos": [{ campo, valor }]). */
const PARAMETROS = {
  registrar_pagamento: ['valor', 'forma'],
  criar_os: ['cliente_nome', 'cliente_whatsapp', 'modelo', 'defeito', 'valor'],
  pedir_peca: ['peca', 'quantidade'],
  remover_pedido_peca: ['pedido_id'],
  enviar_pedido_pecas: ['fornecedor', 'tipo_envio'],
  definir_meta: ['meta_id', 'valor'],
};
export const TODOS_OS_CAMPOS = [...new Set([...CAMPOS_EDITAVEIS, ...Object.values(PARAMETROS).flat()])];
const COM_OS = ['avisar_cliente', 'aviso_pronto', 'mudar_status', 'editar_os', 'registrar_pagamento'];
const NOMES_STATUS = { analise: 'Em análise', peca: 'Aguardando peça', servico: 'Em serviço', concluido: 'Concluído', interrompido: 'Interrompido' };

/** Limpa as ações que vieram do Claude (ou do app): só os tipos, campos e tamanhos permitidos. */
export function limparAcoes(acoes) {
  if (!Array.isArray(acoes)) return [];
  const saida = [];
  for (const a of acoes.slice(0, 30)) {
    if (!a || !TIPOS_ACAO.includes(a.tipo)) continue;
    const os = String(a.os ?? '').replace(/^#/, '').trim();
    if (COM_OS.includes(a.tipo) ? !/^\d{1,9}$/.test(os) : os && !/^\d{1,9}$/.test(os)) continue;
    const acao = { tipo: a.tipo, os };
    if (PARAMETROS[a.tipo]) {
      const dados = Object.fromEntries((Array.isArray(a.campos) ? a.campos : []).filter(c => c && PARAMETROS[a.tipo].includes(c.campo)).map(c => [c.campo, String(c.valor ?? '').trim().slice(0, 500)]));
      const falta = { registrar_pagamento: !dados.valor || !FORMAS.includes(dados.forma), criar_os: !dados.cliente_nome || !dados.modelo || !dados.defeito,
        pedir_peca: !dados.peca, remover_pedido_peca: !dados.pedido_id, enviar_pedido_pecas: !dados.fornecedor || !['cotacao', 'pedido'].includes(dados.tipo_envio),
        definir_meta: !dados.meta_id || !dados.valor }[a.tipo];
      if (falta) continue;
      acao.campos = Object.entries(dados).map(([campo, valor]) => ({ campo, valor }));
      saida.push(acao);
      continue;
    }
    if (a.tipo === 'avisar_cliente') {
      acao.mensagem = String(a.mensagem || '').trim().slice(0, 1500);
      if (!acao.mensagem) continue;
    }
    if (a.tipo === 'mudar_status') {
      if (!STATUS_PERMITIDOS.includes(a.status)) continue;
      acao.status = a.status;
    }
    if (a.tipo === 'editar_os') {
      const campos = (Array.isArray(a.campos) ? a.campos : []).filter(c => c && CAMPOS_EDITAVEIS.includes(c.campo)).slice(0, 8)
        .map(c => ({ campo: c.campo, valor: String(c.valor ?? '').slice(0, 1000) }));
      if (!campos.length) continue;
      acao.campos = campos;
    }
    saida.push(acao);
  }
  return saida;
}

/** Texto curto de uma ação, para a Diretoria e o histórico. */
const par = a => Object.fromEntries((a.campos || []).map(c => [c.campo, c.valor]));
export function descreverAcao(a) {
  const p = par(a);
  if (a.tipo === 'registrar_pagamento') return `OS ${a.os} paga: R$ ${String(p.valor).replace(/^R\$\s*/i, '')} no ${p.forma} (vai para o financeiro)`;
  if (a.tipo === 'criar_os') return `OS nova: ${p.cliente_nome}${p.cliente_whatsapp ? ` (${p.cliente_whatsapp})` : ''}, ${p.modelo}, "${p.defeito}"${p.valor ? `, R$ ${String(p.valor).replace(/^R\$\s*/i, '')}` : ''}`;
  if (a.tipo === 'pedir_peca') return `Peça na lista do fornecedor: ${p.quantidade || 1}x ${p.peca}${a.os ? ` (OS ${a.os})` : ''}`;
  if (a.tipo === 'remover_pedido_peca') return `Tirar da lista do fornecedor o pedido ${p.pedido_id}`;
  if (a.tipo === 'enviar_pedido_pecas') return `Mandar a lista de peças para ${p.fornecedor} no WhatsApp (${p.tipo_envio === 'pedido' ? 'pedido' : 'cotação'})`;
  if (a.tipo === 'definir_meta') return `Meta ${p.meta_id} = ${p.valor}`;
  if (a.tipo === 'avisar_cliente') return `WhatsApp para o cliente da OS ${a.os}: "${a.mensagem}"`;
  if (a.tipo === 'aviso_pronto') return `Aviso de "aparelho pronto" (com link e garantia) para o cliente da OS ${a.os}`;
  if (a.tipo === 'mudar_status') return `OS ${a.os} → ${NOMES_STATUS[a.status] || a.status}`;
  return `OS ${a.os}: ${a.campos.map(c => `${c.campo.replace('_', ' ')} = ${c.valor || '(apagar)'}`).join(', ')}`;
}

const numeroBR = (v, nome) => {
  const n = Number(String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw new ErroCentral(`${nome}: "${v}" não é um número`);
  return n;
};
function valorDoCampo(c) {
  if (c.campo === 'valor' || c.campo === 'garantia_dias') {
    const n = Number(String(c.valor).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) throw new ErroCentral(`${c.campo}: "${c.valor}" não é um número`);
    return c.campo === 'garantia_dias' ? Math.round(n) : n;
  }
  if (c.campo === 'previsao_entrega') {
    if (!c.valor) return null;
    const m = c.valor.match(/^(\d{4})-(\d{2})-(\d{2})$/) || c.valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) throw new ErroCentral(`previsão "${c.valor}" precisa ser AAAA-MM-DD ou DD/MM/AAAA`);
    return m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2]}-${m[1]}`;
  }
  return c.valor === '' ? null : c.valor;
}

async function executarUma(a) {
  const p = par(a);
  if (a.tipo === 'registrar_pagamento') {
    await central('POST', `os/${a.os}/pagamento`, { valor: numeroBR(p.valor, 'valor'), forma: p.forma });
    return { ok: true, detalhe: 'OS marcada como paga e receita lançada no financeiro' };
  }
  if (a.tipo === 'criar_os') {
    const r = await central('POST', 'os', { cliente: { nome: p.cliente_nome, whatsapp: p.cliente_whatsapp || '' }, aparelho: { modelo: p.modelo }, defeito: p.defeito, valor: p.valor ? numeroBR(p.valor, 'valor') : 0 });
    return { ok: true, detalhe: `OS ${r.os?.numero ?? ''} aberta` };
  }
  if (a.tipo === 'pedir_peca') {
    const q = p.quantidade ? Math.max(1, Math.round(numeroBR(p.quantidade, 'quantidade'))) : 1;
    await central('POST', 'pedidos-pecas', { peca: p.peca, quantidade: q, ...(a.os ? { os_numero: a.os } : {}) });
    return { ok: true, detalhe: 'peça na lista do fornecedor' };
  }
  if (a.tipo === 'remover_pedido_peca') {
    await central('POST', `pedidos-pecas/${encodeURIComponent(p.pedido_id)}/remover`);
    return { ok: true, detalhe: 'pedido removido da lista' };
  }
  if (a.tipo === 'enviar_pedido_pecas') {
    const r = await central('POST', 'pedidos-pecas/enviar', { fornecedor: p.fornecedor, tipo: p.tipo_envio });
    return r.enviado ? { ok: true, detalhe: `lista enviada para ${r.fornecedor || p.fornecedor} no WhatsApp` }
      : { ok: false, detalhe: 'o WhatsApp da loja não enviou: use o link', link: r.link_whatsapp || null };
  }
  if (a.tipo === 'definir_meta') {
    await central('PUT', `metas/${encodeURIComponent(p.meta_id)}`, { valor_meta: numeroBR(p.valor, 'valor') });
    return { ok: true, detalhe: 'meta atualizada' };
  }
  if (a.tipo === 'avisar_cliente') {
    const r = await central('POST', `os/${a.os}/avisar`, { mensagem: a.mensagem });
    return r.enviado ? { ok: true, detalhe: 'mensagem enviada no WhatsApp' }
      : { ok: false, detalhe: 'o WhatsApp da loja não enviou (não está conectado no ReparoSimples): use o link', link: r.link_whatsapp || null };
  }
  if (a.tipo === 'aviso_pronto') {
    const r = await central('POST', `os/${a.os}/aviso-pronto`);
    const msg = r.comando?.mensagem;
    if (!msg) return { ok: false, detalhe: 'o ReparoSimples não devolveu a mensagem de pronto' };
    const e = await central('POST', `os/${a.os}/avisar`, { mensagem: msg });
    return e.enviado ? { ok: true, detalhe: 'aviso de pronto enviado no WhatsApp' }
      : { ok: false, detalhe: 'o WhatsApp da loja não enviou: use o link', link: e.link_whatsapp || r.comando?.link_whatsapp || null };
  }
  if (a.tipo === 'mudar_status') {
    await central('PATCH', `os/${a.os}`, { status: a.status });
    return { ok: true, detalhe: `status mudou para ${NOMES_STATUS[a.status] || a.status}` };
  }
  const alterar = Object.fromEntries(a.campos.map(c => [c.campo, valorDoCampo(c)]));
  await central('POST', `os/${a.os}/editar`, { alterar });
  return { ok: true, detalhe: 'OS atualizada' };
}

/** Executa as ações aprovadas, uma por vez. Uma falha não impede as outras. */
export async function executarAcoes(acoes) {
  const resultados = [];
  for (const a of limparAcoes(acoes)) {
    try {
      resultados.push({ acao: descreverAcao(a), ...(await executarUma(a)) });
    } catch (e) {
      resultados.push({ acao: descreverAcao(a), ok: false, detalhe: e.message || String(e) });
    }
  }
  return resultados;
}
