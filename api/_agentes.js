// Peças compartilhadas pelo servidor: uma rodada com o Claude e uma reunião inteira sem navegador (rotinas).
import Anthropic from '@anthropic-ai/sdk';
import { PAPEIS, EQUIPES } from './_equipe.js';
import { executarFerramentaMeta } from './_meta.js';
import { salvarDecisao } from './_armazem.js';

const client = new Anthropic();

export function responder(res, status, corpo) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(corpo);
}

/** Confere o código de acesso do site (variável AGENCIA_CODIGO). */
export function codigoOk(req) {
  const codigo = process.env.AGENCIA_CODIGO;
  return !codigo || req.headers['x-agencia-codigo'] === codigo;
}

export function lerCorpo(req) {
  let c = req.body;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { return null; } }
  return c || {};
}

/** Uma rodada de conversa de um funcionário. */
export async function rodada(papel, messages) {
  const p = PAPEIS[papel];
  const r = await client.beta.messages.create({
    model: process.env.AGENCIA_MODELO || 'claude-opus-5-5',
    max_tokens: 16000,
    // se o modelo recusar por política de segurança, a própria API tenta de novo num modelo reserva
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: p.esforco },
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

  async function rodar(papel, messages, maxRodadas) {
    for (let i = 0; i < maxRodadas; i++) {
      const r = await rodada(papel, messages);
      registro.gasto += custo(r.usage);
      messages.push({ role: 'assistant', content: r.content });
      if (r.stop_reason === 'refusal') return '(O filtro de segurança do Claude recusou esta tarefa.)';
      const chamados = r.content.filter(b => b.type === 'tool_use');
      if (!chamados.length) return textoDe(r.content);
      const resultados = await Promise.all(chamados.map(b => executar(papel, b)));
      messages.push({ role: 'user', content: resultados });
    }
    return '(Passou do limite de rodadas.)';
  }

  async function executar(papel, b) {
    const erro = msg => ({ type: 'tool_result', tool_use_id: b.id, is_error: true, content: msg });
    try {
      if (b.name === 'acionar_funcionario') {
        const { funcionario, pedido: tarefa, anexos = [] } = b.input || {};
        if (!EQUIPES[papel]?.includes(funcionario)) return erro('Esse funcionário não é da sua equipe.');
        if (pouco()) return erro('Sem tempo para mais tarefas nesta rotina: feche o relatório agora com o que já tem.');
        const usados = registro.entregas.filter(e => anexos.includes(e.id));
        const texto = tarefa + (usados.length ? '\n\n---\n## Anexos\n' + usados.map(e => `### ${e.id} — ${PAPEIS[e.papel].nome}\n${e.texto}`).join('\n\n') : '');
        passo(funcionario, `chamado: ${tarefa.slice(0, 120)}`);
        const resposta = await rodar(funcionario, [{ role: 'user', content: texto }], 6);
        const entrega = { id: 'E' + ++n, papel: funcionario, pedido: tarefa, anexos: usados.map(e => e.id), texto: resposta, quando: Date.now() };
        registro.entregas.push(entrega);
        passo(funcionario, `entregou ${entrega.id}`);
        return { type: 'tool_result', tool_use_id: b.id, content: `Entrega ${entrega.id} (${PAPEIS[funcionario].nome}):\n\n${resposta}` };
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
