// /api/os — OS em andamento da loja RB Tech no ReparoSimples, para o laboratório do prédio.
//   GET               → { configurado, ordens: [{ os, modelo, status, atualizado }], contador }
//   GET ?lojas=1      → lista de lojas do ReparoSimples (para achar o REPARO_LOJA_ID)
//   GET ?gatilho=1    → SQL do gatilho para colar no Supabase (conta as OS em tempo real, com o app fechado)
//   POST ?evento=1    → chamado pelo gatilho do Supabase a cada OS nova ou mudança de status (chave no cabeçalho)
// A cada 10 atualizações de OS, a loja (Rael, atendimento e técnico) faz uma rodada sozinha.
import { waitUntil } from '@vercel/functions';
import { responder, autenticado, chaveDerivada, lerCorpo, NAO_AUTENTICADO } from './_agentes.js';
import {
  reparoConfigurado, reparoConectavel, lerOrdensAbertas, listarLojas, lojaRbTech, ErroReparo,
  registrarAtualizacoesOs, compararComRetrato, estadoContadorOs, textoUltimasAtualizacoes, sqlDoGatilho,
} from './_reparo.js';
import { gravarValor, travar, soltar } from './_armazem.js';
import { centralLigada } from './_central.js';

const CHAVE_GATILHO = () => chaveDerivada('reparo-os');

/** Rodada da loja em segundo plano (uma por vez). */
async function rodadaDaLoja() {
  if (!process.env.ANTHROPIC_API_KEY) return;
  if (!(await travar('loja_rodando', 330))) return;
  try {
    const { executarRotina } = await import('./_rotinas.js');
    await executarRotina('loja', 'automatica', { extra: await textoUltimasAtualizacoes() });
  } finally {
    await soltar('loja_rodando');
  }
}
const emSegundoPlano = () => waitUntil(rodadaDaLoja().catch(e => console.error('rotina da loja:', e)));

export default async function handler(req, res) {
  // aviso do gatilho do Supabase (sem login: confere a chave)
  if (req.method === 'POST' && req.query?.evento === '1') {
    if (req.headers['x-predio-chave'] !== CHAVE_GATILHO()) return responder(res, 401, { erro: 'chave inválida' });
    const c = lerCorpo(req) || {};
    await gravarValor('os_gatilho', Date.now());
    const { disparar, total } = await registrarAtualizacoesOs([{ os: String(c.os || '?'), modelo: String(c.modelo || ''), de: c.de || null, para: String(c.para || ''), tipo: c.de ? 'status' : 'nova' }]);
    if (disparar) emSegundoPlano();
    return responder(res, 200, { ok: true, total, rodadaDaLoja: disparar });
  }
  if (req.method !== 'GET') return responder(res, 405, { erro: 'Use GET.' });
  if (!autenticado(req)) return responder(res, 401, NAO_AUTENTICADO);
  try {
    if (req.query?.lojas === '1') return responder(res, 200, { lojas: await listarLojas() });
    if (!reparoConfigurado()) return responder(res, 200, { configurado: false, conectavel: reparoConectavel(), ordens: [] });
    if (req.query?.gatilho === '1') {
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const proto = req.headers['x-forwarded-proto'] || (String(host).startsWith('localhost') ? 'http' : 'https');
      const endereco = `${proto}://${host}`;
      return responder(res, 200, { endereco, sql: sqlDoGatilho({ endereco, lojaId: (await lojaRbTech()).id, chave: CHAVE_GATILHO() }) });
    }
    const ordens = await lerOrdensAbertas();
    let rodadaDaLojaIniciada = false;
    try {
      const { disparar } = await registrarAtualizacoesOs(await compararComRetrato(ordens));
      if (disparar) { emSegundoPlano(); rodadaDaLojaIniciada = true; }
    } catch (e) { console.error('contador de OS:', e); }
    const loja = await lojaRbTech();
    return responder(res, 200, { configurado: true, loja: loja.nome, lojaId: loja.id, ordens, contador: await estadoContadorOs().catch(() => null), rodadaDaLoja: rodadaDaLojaIniciada, central: centralLigada() });
  } catch (e) {
    if (!(e instanceof ErroReparo)) console.error(e);
    return responder(res, e instanceof ErroReparo ? 422 : 502, { erro: e.message || 'Erro ao ler o ReparoSimples.' });
  }
}
