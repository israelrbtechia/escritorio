// /api/voz — vozes da equipe e perguntas por áudio.
//   GET                                   → { elevenlabs: true/false }
//   POST { acao: "falar", papel, texto }  → áudio MP3 na voz daquele funcionário (ElevenLabs)
//   POST { acao: "ouvir", audio, tipo }   → { texto } transcrição do áudio (ElevenLabs Scribe); audio em base64
//   POST { acao: "revisar", texto }       → { texto } transcrição corrigida pelo Claude Haiku
//
// O Claude não recebe áudio: quem transcreve é o ElevenLabs (ou o próprio navegador), e o Haiku revisa o texto.
// Variáveis: ELEVENLABS_API_KEY; opcionais ELEVENLABS_VOZES (JSON {papel: voice_id}), ELEVENLABS_TTS_MODELO, ELEVENLABS_STT_MODELO.
import Anthropic from '@anthropic-ai/sdk';
import { responder, autenticado, lerCorpo, NAO_AUTENTICADO } from './_agentes.js';

// Vozes da biblioteca do ElevenLabs (português do Brasil). Para usar pela API, adicione cada uma em "My Voices".
export const VOZES = {
  chefe: 'Pxxu743NJcLUqO1QxfD6',               // Isabela · Pamella
  gerente_crescimento: 'xMGbstDe7gGBMg3DqxOc', // Alice · Helena
  gerente_loja: '6PhbMr9YjdeOaTNz9y24',        // Davi Leão · Rael
  head_vendas: 'Syyu1vmlwMvReaY0sRnN',         // Caio
  israel: 'WjLshZDgXgxLxYRcotEO',              // Naldo Araújo
  analista: 'tgdUjOYNdMYKFLKpkiG6',            // Victor
  copywriter: 'GnqzyReddm0LsE9vIeJ5',          // Francisca
  roteirista: 'mQTtm28IjDcoO2sbXmov',          // Filipe
  revisor: 'dxIMMSJYSsbUSMhioLNb',             // Juliana Moreira
  especialista: 'urYO2UqU0Q6zAxYEYEYV',        // Gabriel
  atendimento: 'RPK3rjRcGgrmLKag7pHZ',         // Viviane
  estoque: 'EyPnkQPpWceKpqcMOSpZ',             // Leandro
  posvenda: '44fUMcpIJ6WAyoptgPuM',            // Rayane
  sdr: '8KoOqokYEtaOaWYjC7vp',                 // Dhieider
  closer: 'jyRzzBWbHll8EUfOjmhe',              // Fernando Machado
  sucesso: 'YLbVGkIB1qwI47brsSiF',             // Mônica
  produto: 'fjYrCoyeYNBCYTQF6ax2',             // Isaias
};
function vozDe(papel) {
  let extras = {};
  try { extras = JSON.parse(process.env.ELEVENLABS_VOZES || '{}'); } catch { /* ignora JSON inválido */ }
  return extras[papel] || VOZES[papel] || VOZES.chefe;
}

const client = new Anthropic();
const chave = () => process.env.ELEVENLABS_API_KEY;

export default async function handler(req, res) {
  if (!autenticado(req)) return responder(res, 401, NAO_AUTENTICADO);
  if (req.method === 'GET') return responder(res, 200, { elevenlabs: !!chave() });
  if (req.method !== 'POST') return responder(res, 405, { erro: 'Use GET ou POST.' });
  const c = lerCorpo(req);
  if (!c) return responder(res, 400, { erro: 'JSON inválido.' });

  try {
    if (c.acao === 'revisar') {
      const texto = String(c.texto || '').slice(0, 4000);
      if (!texto.trim() || !process.env.ANTHROPIC_API_KEY) return responder(res, 200, { texto });
      const r = await client.messages.create({
        model: process.env.AGENCIA_MODELO_VOZ || 'claude-haiku-5-5',
        max_tokens: 2000,
        output_config: { effort: 'low' },
        system: 'Você revisa transcrições de áudio do Israel, dono da RBTech (loja de iPhones em Florianópolis). Corrija pontuação, letras maiúsculas e palavras que o reconhecimento de voz errou (iPhone, RBTech, RB Tech, Instagram, WhatsApp, reels, stories, Meta Ads, Sorteia Aí, Pamella, Helena, Rael, nomes de modelos de iPhone). Não mude o sentido, não responda à pergunta e não acrescente nada. Devolva só o texto corrigido.',
        messages: [{ role: 'user', content: texto }],
      });
      const revisado = r.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
      return responder(res, 200, { texto: r.stop_reason === 'refusal' || !revisado ? texto : revisado });
    }

    if (!chave()) return responder(res, 400, { erro: 'Falta a variável ELEVENLABS_API_KEY na Vercel.', semElevenlabs: true });

    if (c.acao === 'falar') {
      const texto = String(c.texto || '').slice(0, 900);
      if (!texto.trim()) return responder(res, 400, { erro: 'Texto vazio.' });
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vozDe(c.papel)}?output_format=mp3_44100_64`, {
        method: 'POST',
        headers: { 'xi-api-key': chave(), 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text: texto, model_id: process.env.ELEVENLABS_TTS_MODELO || 'eleven_flash_v2_5', language_code: 'pt' }),
        signal: AbortSignal.timeout(45000),
      });
      if (!r.ok) {
        const erro = await r.text().catch(() => '');
        return responder(res, 502, { erro: `ElevenLabs recusou a voz (${r.status}). Confira se a voz está em "My Voices". ${erro.slice(0, 200)}` });
      }
      const audio = Buffer.from(await r.arrayBuffer());
      res.setHeader('content-type', 'audio/mpeg');
      res.setHeader('cache-control', 'no-store');
      return res.status(200).send(audio);
    }

    if (c.acao === 'ouvir') {
      const audio = Buffer.from(String(c.audio || ''), 'base64');
      if (!audio.length) return responder(res, 400, { erro: 'Áudio vazio.' });
      if (audio.length > 3_500_000) return responder(res, 413, { erro: 'Áudio longo demais. Fale em até 1 minuto.' });
      const tipo = String(c.tipo || 'audio/webm').split(';')[0];
      const form = new FormData();
      form.append('model_id', process.env.ELEVENLABS_STT_MODELO || 'scribe_v1');
      form.append('language_code', 'por');
      form.append('file', new Blob([audio], { type: tipo }), `pergunta.${tipo.includes('mp4') ? 'mp4' : tipo.includes('ogg') ? 'ogg' : 'webm'}`);
      const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST', headers: { 'xi-api-key': chave() }, body: form, signal: AbortSignal.timeout(45000),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return responder(res, 502, { erro: `ElevenLabs não transcreveu (${r.status}).` });
      return responder(res, 200, { texto: j.text || '' });
    }
    return responder(res, 400, { erro: 'Ação desconhecida.' });
  } catch (e) {
    console.error(e);
    return responder(res, 502, { erro: e.message || 'Erro na voz.' });
  }
}
