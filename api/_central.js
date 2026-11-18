// Ações no sistema da loja RB Tech pela API do RB Central do ReparoSimples (/api/central/...).
// Os chefes só PROPÕEM as ações dentro de uma decisão; elas acontecem quando o Israel aprova na Diretoria.
// A API do RB Central é presa a uma loja só (CENTRAL_LOJA no projeto do ReparoSimples) e segue as mesmas regras
// da tela "Editar OS". Ela nunca marca OS como paga por aqui (pagamento fica com a loja).
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

// ---------- ações que os chefes podem propor ----------
export const TIPOS_ACAO = ['avisar_cliente', 'aviso_pronto', 'mudar_status', 'editar_os'];
export const STATUS_PERMITIDOS = ['analise', 'peca', 'servico', 'concluido', 'interrompido'];
export const CAMPOS_EDITAVEIS = ['previsao_entrega', 'tecnico', 'observacoes', 'servico', 'defeito', 'valor', 'garantia_dias', 'acessorios'];
const NOMES_STATUS = { analise: 'Em análise', peca: 'Aguardando peça', servico: 'Em serviço', concluido: 'Concluído', interrompido: 'Interrompido' };

/** Limpa as ações que vieram do Claude (ou do app): só os tipos, campos e tamanhos permitidos. */
export function limparAcoes(acoes) {
  if (!Array.isArray(acoes)) return [];
  const saida = [];
  for (const a of acoes.slice(0, 30)) {
    if (!a || !TIPOS_ACAO.includes(a.tipo)) continue;
    const os = String(a.os ?? '').replace(/^#/, '').trim();
    if (!/^\d{1,9}$/.test(os)) continue;
    const acao = { tipo: a.tipo, os };
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
export function descreverAcao(a) {
  if (a.tipo === 'avisar_cliente') return `WhatsApp para o cliente da OS ${a.os}: "${a.mensagem}"`;
  if (a.tipo === 'aviso_pronto') return `Aviso de "aparelho pronto" (com link e garantia) para o cliente da OS ${a.os}`;
  if (a.tipo === 'mudar_status') return `OS ${a.os} → ${NOMES_STATUS[a.status] || a.status}`;
  return `OS ${a.os}: ${a.campos.map(c => `${c.campo.replace('_', ' ')} = ${c.valor || '(apagar)'}`).join(', ')}`;
}

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
