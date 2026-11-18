// Peças compartilhadas pelo servidor: uma rodada com o Claude e uma reunião inteira sem navegador (rotinas).
import Anthropic from '@anthropic-ai/sdk';
import { PAPEIS, EQUIPES } from './_equipe.js';
import { executarFerramentaMeta } from './_meta.js';
import { salvarDecisao, salvarItem } from './_armazem.js';

const client = new Anthropic();

export function responder(res, status, corpo) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(corpo);
}

/**
 * Resposta para trabalho demorado (IA pensando, rotina, publicação).
 * O Safari do iPhone derruba a conexão ("Load failed") se o servidor passa uns 60 s sem mandar nada.
 * Aqui o servidor manda um espaço a cada 8 s (espaço antes do JSON é válido) e, no fim, o JSON.
 * Como o status 200 já foi enviado, um erro vem no corpo: { erro, status }.
 */
export async function responderDemorado(res, trabalho) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Accel-Buffering', 'no');
  res.write(' ');
  const pulso = setInterval(() => { try { res.write(' '); } catch { /* conexão fechada */ } }, 8000);
  let corpo;
  try {
    corpo = await trabalho();
  } catch (e) {
    console.error(e);
    const [status, erro] = erroDaApi(e);
    corpo = { erro, status };
  } finally {
    clearInterval(pulso);
  }
  res.end(JSON.stringify(corpo));
}

// ---------- login (usuário e senha nas variáveis AGENCIA_USUARIO e AGENCIA_SENHA da Vercel) ----------
import crypto from 'node:crypto';
const DIAS_DE_SESSAO = 30;
export const loginExigido = () => !!(process.env.AGENCIA_USUARIO && process.env.AGENCIA_SENHA);
function segredo() {
  return process.env.AGENCIA_SEGREDO || crypto.createHash('sha256').update(`predio-rbtech|${process.env.AGENCIA_USUARIO}|${process.env.AGENCIA_SENHA}`).digest('hex');
}
const assinar = dados => crypto.createHmac('sha256', segredo()).update(dados).digest('base64url');
/** Chave fixa para um uso (ex.: o gatilho de OS do Supabase), derivada do segredo do login. */
export const chaveDerivada = uso => crypto.createHmac('sha256', segredo()).update(`uso:${uso}`).digest('hex').slice(0, 40);
function igual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
export function conferirSenha(usuario, senha) {
  return igual(String(usuario || '').trim().toLowerCase(), process.env.AGENCIA_USUARIO.trim().toLowerCase()) && igual(senha, process.env.AGENCIA_SENHA);
}
export function criarSessao(usuario) {
  const dados = Buffer.from(JSON.stringify({ u: usuario, exp: Date.now() + DIAS_DE_SESSAO * 86400_000 })).toString('base64url');
  return `${dados}.${assinar(dados)}`;
}
function sessaoValida(token) {
  const [dados, assinatura] = String(token || '').split('.');
  if (!dados || !assinatura || !igual(assinatura, assinar(dados))) return false;
  try { return JSON.parse(Buffer.from(dados, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}
/** Quem chama a API precisa ter feito login (se AGENCIA_USUARIO e AGENCIA_SENHA estiverem definidos). */
export function autenticado(req) {
  if (!loginExigido()) return true;
  const h = req.headers.authorization || '';
  return sessaoValida(h.startsWith('Bearer ') ? h.slice(7) : '');
}
export const codigoOk = autenticado; // nome antigo, usado pelas outras rotas
export const NAO_AUTENTICADO = { erro: 'Faça login para continuar.', precisaLogin: true };

export function lerCorpo(req) {
  let c = req.body;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { return null; } }
  return c || {};
}

// ECONOMIA: chefes pensam com esforço médio; a equipe deles com esforço baixo (tarefas curtas e bem definidas).
// AGENCIA_MODELO_EQUIPE (opcional) troca só o modelo da equipe, sem mexer nos chefes.
const CHEFES = new Set(Object.keys(EQUIPES));
const ESFORCOS = ['low', 'medium', 'high', 'xhigh', 'max'];
export const esforcoDe = papel => {
  const env = String(process.env[CHEFES.has(papel) ? 'AGENCIA_ESFORCO_CHEFES' : 'AGENCIA_ESFORCO_EQUIPE'] || '').trim().toLowerCase();
  return ESFORCOS.includes(env) ? env : CHEFES.has(papel) ? 'medium' : 'low';
};
export const modeloDe = papel => (CHEFES.has(papel) ? '' : process.env.AGENCIA_MODELO_EQUIPE) || process.env.AGENCIA_MODELO || 'claude-opus-5-5';

/** Uma rodada de conversa de um funcionário. */
export async function rodada(papel, messages) {
  const p = PAPEIS[papel];
  const model = modeloDe(papel);
  const r = await client.beta.messages.create({
    model,
    max_tokens: 16000,
    // se o modelo recusar por política de segurança, a própria API tenta de novo num modelo reserva (o Haiku não tem reserva)
    ...(/haiku/i.test(model) ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }),
    output_config: { effort: esforcoDe(papel) },
    cache_control: { type: 'ephemeral' },
    system: p.sistema,
    ...(p.ferramentas ? { tools: p.ferramentas } : {}),
    messages,
  });
  return { content: r.content, stop_reason: r.stop_reason, stop_details: r.stop_details ?? null, model: r.model, usage: r.usage };
}

export function erroDaApi(e) {
  if (e instanceof Anthropic.AuthenticationError) return [500, 'A chave ANTHROPIC_API_KEY foi recusada. Confira o valor na Vercel.'];
  if (e instanceof Anthropic.RateLimitError) return [429, 'Muitos pedidos ao mesmo tempo. Espere um minuto e tente de novo.'];
  if (e instanceof Anthropic.BadRequestError) return [400, `Pedido recusado pela API: ${e.message}`];
  if (e instanceof Anthropic.APIError) return [502, `A API do Claude respondeu com erro ${e.status ?? ''}. Tente de novo.`];
  return [500, e?.message || 'Erro inesperado no servidor.'];
}

const PRECO = { entrada: 4, saida: 20 };
function custo(u) {
  if (!u) return 0;
  const entrada = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1;
  return (entrada * PRECO.entrada + (u.output_tokens || 0) * PRECO.saida) / 1e6;
}
const textoDe = content => (content || []).filter(b => b.type === 'text').map(b => b.text).join('\n\n').trim();

/**
 * Roda uma reunião inteira no servidor: o gestor pensa, chama a equipe, lê métricas e fecha o relatório.
 * `prazo` é o horário (ms) em que tudo precisa acabar, para caber no tempo limite da função.
 */
export async function reuniaoNoServidor(gestor, pedido, { prazo, idRotina }) {
  const registro = { relatorio: '', entregas: [], decisoes: [], passos: [], gasto: 0 };
  const passo = (papel, texto) => registro.passos.push({ quando: Date.now(), papel, texto });
  let n = 0;
  const pouco = () => Date.now() > prazo - 70_000; // sem tempo para mais um funcionário

  async function rodar(papel, messages, maxRodadas, coleta = {}) {
    for (let i = 0; i < maxRodadas; i++) {
      const r = await rodada(papel, messages);
      registro.gasto += custo(r.usage);
      messages.push({ role: 'assistant', content: r.content });
      if (r.stop_reason === 'refusal') return '(O filtro de segurança do Claude recusou esta tarefa.)';
      const chamados = r.content.filter(b => b.type === 'tool_use');
      if (!chamados.length) return textoDe(r.content);
      const resultados = await Promise.all(chamados.map(b => executar(papel, b, coleta)));
      messages.push({ role: 'user', content: resultados });
    }
    return '(Passou do limite de rodadas.)';
  }

  async function executar(papel, b, coleta = {}) {
    const erro = msg => ({ type: 'tool_result', tool_use_id: b.id, is_error: true, content: msg });
    try {
      if (b.name === 'acionar_funcionario') {
        const { funcionario, pedido: tarefa, anexos = [] } = b.input || {};
        if (!EQUIPES[papel]?.includes(funcionario)) return erro('Esse funcionário não é da sua equipe.');
        if (pouco()) return erro('Sem tempo para mais tarefas nesta rotina: feche o relatório agora com o que já tem.');
        const usados = registro.entregas.filter(e => anexos.includes(e.id));
        const texto = tarefa + (usados.length ? '\n\n---\n## Anexos\n' + usados.map(e => `### ${e.id} — ${PAPEIS[e.papel].nome}\n${e.texto}`).join('\n\n') : '');
        passo(funcionario, `chamado: ${tarefa.slice(0, 120)}`);
        const coletaFunc = {};
        const resposta = await rodar(funcionario, [{ role: 'user', content: texto }], 6, coletaFunc);
        const entrega = { id: 'E' + ++n, papel: funcionario, pedido: tarefa, anexos: usados.map(e => e.id), texto: resposta, quando: Date.now(), ...(coletaFunc.ideias ? { ideias: coletaFunc.ideias } : {}) };
        registro.entregas.push(entrega);
        passo(funcionario, `entregou ${entrega.id}`);
        return { type: 'tool_result', tool_use_id: b.id, content: `Entrega ${entrega.id} (${PAPEIS[funcionario].nome}):\n\n${resposta}` };
      }
      if (b.name === 'entregar_ideias') {
        coleta.ideias = b.input;
        if (papel === gestor) registro.entregas.push({ id: 'E' + ++n, papel, pedido: 'Ideias da gerente de crescimento', anexos: [], texto: b.input.resumo || '', ideias: b.input, quando: Date.now() });
        return { type: 'tool_result', tool_use_id: b.id, content: 'Ideias registradas: o Israel vai ver o relatório organizado. Agora escreva só um resumo curto.' };
      }
      if (b.name === 'pedir_midia') {
        registro.pedidos = registro.pedidos || [];
        const pedido = { ...b.input, id: `${idRotina}-P${registro.pedidos.length + 1}`, solicitante: papel, quando: Date.now(), status: 'aguardando_midia', origem: 'rotina' };
        registro.pedidos.push(pedido);
        try { await salvarItem('pedidos', pedido); } catch { /* fica no registro da rotina */ }
        passo(papel, `pediu ${pedido.tipo} ao Israel (${pedido.id})`);
        return { type: 'tool_result', tool_use_id: b.id, content: `Pedido ${pedido.id} criado. O Israel vai receber o link de upload ao abrir o app; só depois da aprovação dele o conteúdo é publicado.` };
      }
      if (b.name === 'sugerir_edicao_manual') {
        registro.edicoes = registro.edicoes || [];
        const edicao = { ...b.input, id: `${idRotina}-M${registro.edicoes.length + 1}`, autor: papel, quando: Date.now(), feito: false, origem: 'rotina' };
        registro.edicoes.push(edicao);
        try { await salvarItem('edicoes', edicao); } catch { /* fica no registro da rotina */ }
        return { type: 'tool_result', tool_use_id: b.id, content: `Edição ${edicao.id} registrada como card para o Israel aplicar.` };
      }
      if (b.name === 'enviar_para_israel') {
        const d = b.input || {};
        const decisao = {
          id: `${idRotina}-D${registro.decisoes.length + 1}`, gestor: papel, titulo: d.titulo, decisao: d.decisao, motivo: d.motivo,
          riscos: d.riscos, urgencia: d.urgencia, entregas: (d.entregas || []).map(e => `${idRotina}-${e}`),
          status: 'pendente', comentario: '', quando: Date.now(), origem: 'rotina',
        };
        registro.decisoes.push(decisao);
        try { await salvarDecisao(decisao); } catch { /* fica só no registro da rotina */ }
        passo(papel, `subiu ao terraço com a decisão ${decisao.id}`);
        return { type: 'tool_result', tool_use_id: b.id, content: `Decisão ${decisao.id} entregue na sala do Israel. Status: pendente de auditoria. Não execute nada antes da aprovação; siga com o relatório.` };
      }
      passo(papel, `leu ${b.name.replace('ler_', '').replace(/_/g, ' ')}`);
      const dados = await executarFerramentaMeta(b.name, b.input);
      return { type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(dados).slice(0, 40000) };
    } catch (e) {
      return erro(e.message || 'Não deu certo.');
    }
  }

  passo(gestor, 'começou a rotina');
  registro.relatorio = await rodar(gestor, [{ role: 'user', content: pedido }], 8);
  passo(gestor, 'fechou o relatório');
  return registro;
}
