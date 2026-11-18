// Vozes da equipe e perguntas por áudio.
// Falar: ElevenLabs (voz própria de cada funcionário) ou, sem ele, a voz do navegador com tom diferente por pessoa.
// Ouvir: ElevenLabs Scribe (grava e manda o áudio) ou o reconhecimento de voz do navegador; depois o Claude Haiku revisa o texto.

// tom e ritmo de cada um quando a voz é a do navegador
const TOM = {
  chefe: [1.15, 1.05], gerente_crescimento: [1.25, 1.08], gerente_loja: [0.85, 1.0], head_vendas: [0.9, 1.02], israel: [0.75, 0.95],
  analista: [0.95, 1.0], copywriter: [1.2, 1.05], roteirista: [1.0, 1.1], revisor: [1.1, 0.95], especialista: [1.05, 1.1],
  atendimento: [1.25, 1.05], tecnico: [0.9, 1.0], sdr: [1.05, 1.1], closer: [0.85, 1.0], sucesso: [1.2, 1.0], produto: [0.95, 1.0],
};

/** Tira o markdown e corta num fim de frase, para a fala não ficar longa demais. */
export function textoParaFalar(md, limite = 650) {
  const limpo = String(md || '')
    .split('\n')
    .filter(l => !/^\s*\|/.test(l) && !/^\s*-{3,}\s*$/.test(l))
    .join('. ')
    .replace(/[*_#`>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\bE(\d+)\b/g, 'E $1')
    .replace(/\s*\.\s*\.+/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
  if (limpo.length <= limite) return limpo;
  const corte = limpo.slice(0, limite);
  const fim = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('! '), corte.lastIndexOf('? '));
  return (fim > limite * 0.5 ? corte.slice(0, fim + 1) : corte + '…') + ' Os detalhes estão no chat.';
}

export function criarVoz({ token, ensaio, aoFalar }) {
  let elevenlabs = false;
  let ligada = true;
  let fila = Promise.resolve();
  let audioAtual = null;
  const cabecalhos = () => ({ 'content-type': 'application/json', authorization: `Bearer ${token()}` });

  async function verificar() {
    try {
      const r = await fetch('/api/voz', { headers: cabecalhos() });
      elevenlabs = r.ok && (await r.json()).elevenlabs === true;
    } catch { elevenlabs = false; }
    return elevenlabs;
  }

  function vozDoNavegador() {
    const vozes = speechSynthesis.getVoices();
    return vozes.find(v => v.lang === 'pt-BR' && /google|natural|online/i.test(v.name)) || vozes.find(v => v.lang === 'pt-BR') || vozes.find(v => v.lang?.startsWith('pt'));
  }
  function falarNoNavegador(papel, texto) {
    return new Promise(res => {
      if (!('speechSynthesis' in window)) return res();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      const v = vozDoNavegador();
      if (v) u.voice = v;
      const [tom, ritmo] = TOM[papel] || [1, 1];
      u.pitch = tom; u.rate = ritmo;
      const limite = setTimeout(() => { speechSynthesis.cancel(); res(); }, 2500 + texto.length * 90); // alguns navegadores não avisam o fim
      u.onend = u.onerror = () => { clearTimeout(limite); res(); };
      speechSynthesis.speak(u);
    });
  }
  async function falarComElevenlabs(papel, texto) {
    const r = await fetch('/api/voz', { method: 'POST', headers: cabecalhos(), body: JSON.stringify({ acao: 'falar', papel, texto }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || `voz ${r.status}`);
    const url = URL.createObjectURL(await r.blob());
    await new Promise(res => {
      audioAtual = new Audio(url);
      audioAtual.onended = audioAtual.onerror = () => { URL.revokeObjectURL(url); res(); };
      audioAtual.play().catch(() => res());
    });
    audioAtual = null;
  }

  /** Coloca a fala na fila (uma pessoa fala de cada vez). */
  function falar(papel, md) {
    if (!ligada) return;
    const texto = textoParaFalar(md);
    if (!texto) return;
    fila = fila.then(async () => {
      if (!ligada) return;
      aoFalar?.(papel, true);
      try {
        if (elevenlabs && !ensaio()) await falarComElevenlabs(papel, texto);
        else await falarNoNavegador(papel, texto);
      } catch (e) {
        console.warn('voz:', e.message);
        await falarNoNavegador(papel, texto);
      } finally {
        aoFalar?.(papel, false);
      }
    });
  }
  function calar() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (audioAtual) { audioAtual.pause(); audioAtual.onended?.(); }
    fila = Promise.resolve();
  }

  // ---------- ouvir ----------
  let gravador = null, pedacos = [], reconhecimento = null;
  const temReconhecimento = () => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  const podeOuvir = () => (elevenlabs && !ensaio() && !!navigator.mediaDevices?.getUserMedia && 'MediaRecorder' in window) || temReconhecimento();

  /** Começa a ouvir. Chama aoParcial(texto) durante a fala (só no navegador). Devolve uma função que para e entrega o texto. */
  async function comecarAOuvir(aoParcial) {
    if (elevenlabs && !ensaio() && navigator.mediaDevices?.getUserMedia && 'MediaRecorder' in window) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      pedacos = [];
      gravador = new MediaRecorder(stream);
      gravador.ondataavailable = e => { if (e.data.size) pedacos.push(e.data); };
      gravador.start();
      return () => new Promise((res, rej) => {
        gravador.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          try {
            const blob = new Blob(pedacos, { type: gravador.mimeType || 'audio/webm' });
            const b64 = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
            const r = await fetch('/api/voz', { method: 'POST', headers: cabecalhos(), body: JSON.stringify({ acao: 'ouvir', audio: b64, tipo: blob.type }) });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.erro || 'Não deu para transcrever.');
            res(j.texto || '');
          } catch (e) { rej(e); }
        };
        gravador.stop();
      });
    }
    if (!temReconhecimento()) throw new Error('Este navegador não reconhece voz. Use o Chrome ou ligue o ElevenLabs.');
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    reconhecimento = new R();
    reconhecimento.lang = 'pt-BR';
    reconhecimento.interimResults = true;
    reconhecimento.continuous = true;
    let final = '';
    reconhecimento.onresult = e => {
      let parcial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
        else parcial += e.results[i][0].transcript;
      }
      aoParcial?.((final + parcial).trim());
    };
    const terminou = new Promise(res => { reconhecimento.onend = () => res(final.trim()); reconhecimento.onerror = () => res(final.trim()); });
    reconhecimento.start();
    return () => { reconhecimento.stop(); return terminou; };
  }

  /** O Claude Haiku corrige a transcrição (nomes, pontuação). Sem servidor, devolve o texto como está. */
  async function revisar(texto) {
    if (!texto || ensaio()) return texto;
    try {
      const r = await fetch('/api/voz', { method: 'POST', headers: cabecalhos(), body: JSON.stringify({ acao: 'revisar', texto }) });
      if (!r.ok) return texto;
      return (await r.json()).texto || texto;
    } catch { return texto; }
  }

  return {
    verificar, falar, calar, comecarAOuvir, revisar, podeOuvir,
    usaElevenlabs: () => elevenlabs && !ensaio(),
    ligada: () => ligada,
    ligar(v) { ligada = v; if (!v) calar(); },
  };
}
