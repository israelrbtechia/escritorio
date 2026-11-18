// Desenhos das telas do prédio (canvas): vista da janela, placar, monitores, painéis de cada andar.
import { aleatorio, FONTE } from './blocos.js';

const brl = n => 'R$ ' + (Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : '–');

export function desenharVista(tela) {
  const g = tela.ctx;
  const W = 320;
  const hora = new Date().getHours();
  const periodo = hora >= 7 && hora < 17 ? 'dia' : (hora >= 17 && hora < 19) || (hora >= 5 && hora < 7) ? 'tarde' : 'noite';
  const ceus = { dia: ['#7cc4f2', '#a9dcf7', '#d7f0fb'], tarde: ['#3d3b7a', '#e2766a', '#ffc27a'], noite: ['#070b1c', '#101a38', '#1d2a50'] }[periodo];
  for (let i = 0; i < 3; i++) { g.fillStyle = ceus[i]; g.fillRect(0, i * 26, W, 26); }
  g.fillStyle = ceus[2]; g.fillRect(0, 78, W, 20);
  if (periodo === 'noite') {
    g.fillStyle = '#fff';
    const rnd = aleatorio(11);
    for (let i = 0; i < 40; i++) g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * 70), 1, 1);
    g.fillStyle = '#f4f1da'; g.fillRect(260, 14, 10, 10);
  } else {
    g.fillStyle = periodo === 'dia' ? '#fff6c2' : '#ffd36a';
    g.fillRect(periodo === 'dia' ? 250 : 40, periodo === 'dia' ? 12 : 60, 14, 14);
  }
  g.fillStyle = periodo === 'noite' ? '#0e1a14' : periodo === 'tarde' ? '#3d4a3a' : '#4f7d52';
  for (let x = 0; x < W; x += 4) { const h = 14 + Math.round(Math.sin(x / 37) * 6 + Math.sin(x / 13) * 3); g.fillRect(x, 96 - h, 4, h); }
  g.fillStyle = periodo === 'noite' ? '#0b1a33' : periodo === 'tarde' ? '#5a5f8f' : '#2f7fb8';
  g.fillRect(0, 96, W, 54);
  g.fillStyle = periodo === 'noite' ? '#1b2d55' : '#5aa3d6';
  const rnd = aleatorio(5);
  for (let i = 0; i < 50; i++) g.fillRect(Math.floor(rnd() * W), 100 + Math.floor(rnd() * 50), 6, 1);
  // ponte Hercílio Luz: duas torres, cabo principal e tabuleiro
  const ponte = periodo === 'noite' ? '#c9b98a' : '#d9d9d9';
  const deckY = 100;
  g.fillStyle = ponte;
  g.fillRect(20, deckY, 280, 3);
  for (const tx of [110, 210]) { g.fillRect(tx - 3, 52, 3, 52); g.fillRect(tx + 3, 52, 3, 52); g.fillRect(tx - 3, 52, 9, 3); }
  const cabo = x => {
    if (x < 110) return 54 + ((110 - x) / 90) * 44;
    if (x > 210) return 54 + ((x - 210) / 90) * 44;
    const u = (x - 160) / 50;
    return 54 + (1 - u * u) * 38;
  };
  for (let x = 20; x <= 300; x++) {
    const y = Math.round(cabo(x));
    g.fillStyle = ponte; g.fillRect(x, y, 1, 2);
    if (x % 6 === 0 && y < deckY) { g.fillStyle = periodo === 'noite' ? '#8a7f60' : '#bcbcbc'; g.fillRect(x, y, 1, deckY - y); }
    if (periodo === 'noite' && x % 10 === 0) { g.fillStyle = '#ffe680'; g.fillRect(x, y - 1, 2, 2); }
  }
  const rb = aleatorio(21);
  for (let x = 0; x < W; x += 9) {
    if (x > 40 && x < 280) continue;
    const h = 10 + Math.floor(rb() * 26);
    g.fillStyle = periodo === 'noite' ? '#151b2a' : '#c9c2b6';
    g.fillRect(x, 98 - h, 8, h);
    g.fillStyle = periodo === 'noite' ? '#ffd86b' : '#8fa6b8';
    for (let y = 98 - h + 2; y < 96; y += 4) for (let k = 1; k < 7; k += 3) if (rb() < (periodo === 'noite' ? 0.5 : 0.8)) g.fillRect(x + k, y, 1, 2);
  }
  tela.t.needsUpdate = true;
}

export function desenharRegras(tela) {
  const g = tela.ctx;
  g.fillStyle = '#ffd60a'; g.fillRect(0, 0, 320, 400);
  g.fillStyle = '#0f0f0f';
  g.font = `800 34px ${FONTE}`; g.fillText('REGRAS', 24, 58);
  g.font = `600 17px ${FONTE}`; g.fillText('DO PRÉDIO', 24, 84);
  const regras = [['Nada sai sem o', 'revisor.'], ['Toda decisão sobe', 'para o Israel.'], ['Preço é só o que', 'a loja passou.'], ['Petisco só depois', 'da meta. 🐾']];
  g.font = `600 20px ${FONTE}`;
  let y = 136;
  regras.forEach(([a, b], i) => { g.fillText(`${i + 1}. ${a}`, 24, y); g.fillText(`    ${b}`, 24, y + 26); y += 64; });
  tela.t.needsUpdate = true;
}

export function desenharPlacar(tela, p, humor) {
  if (!tela) return;
  const g = tela.ctx;
  g.fillStyle = '#0f0f0f'; g.fillRect(0, 0, 640, 360);
  g.fillStyle = '#ffd60a'; g.font = `700 22px ${FONTE}`; g.fillText('● PLACAR DE HOJE', 28, 44);
  if (!p) { tela.t.needsUpdate = true; return; }
  g.fillStyle = '#9a9a9a'; g.font = `500 18px ${FONTE}`; g.textAlign = 'right';
  g.fillText(new Date().toLocaleDateString('pt-BR'), 612, 44);
  g.textAlign = 'left';
  g.fillStyle = '#ffffff'; g.font = `800 96px ${FONTE}`; g.fillText(String(p.conversasHoje ?? 0), 28, 152);
  g.fillStyle = '#bdbdbd'; g.font = `600 20px ${FONTE}`; g.fillText('conversas no WhatsApp', 30, 182);
  const custo = p.conversasHoje > 0 ? p.investimentoHoje / p.conversasHoje : NaN;
  g.fillStyle = custo <= p.metaCusto ? '#2fd17a' : '#ff5a5a';
  g.font = `800 54px ${FONTE}`; g.fillText(brl(custo), 340, 124);
  g.fillStyle = '#bdbdbd'; g.font = `600 18px ${FONTE}`;
  g.fillText(`por conversa · meta ${brl(p.metaCusto)}`, 342, 152);
  g.fillText(`investido hoje ${brl(p.investimentoHoje)}`, 342, 178);
  g.fillStyle = '#ffd60a'; g.font = `700 18px ${FONTE}`;
  g.fillText(`DIAS NA META: ${Math.min(p.diasNaMeta, 10)}/10 → ESTAGIÁRIO NOVO`, 28, 236);
  for (let i = 0; i < 10; i++) { g.fillStyle = i < p.diasNaMeta ? '#ffd60a' : '#2b2b2b'; g.fillRect(28 + i * 58, 252, 48, 22); }
  g.fillStyle = humor?.cor || '#fff'; g.font = `700 22px ${FONTE}`;
  g.fillText(`HUMOR DO CHEFE: ${(humor?.nome || '').toUpperCase()}`, 28, 322);
  if (p.ehExemplo || p.daMeta) {
    g.fillStyle = p.daMeta ? '#2fd17a' : '#ffd60a'; g.fillRect(470, 300, 142, 34);
    g.fillStyle = '#0f0f0f'; g.font = `800 18px ${FONTE}`; g.fillText(p.daMeta ? 'META ADS' : 'EXEMPLO', p.daMeta ? 488 : 498, 324);
  }
  tela.t.needsUpdate = true;
}

export function desenharSeguidores(tela, info) {
  const g = tela.ctx;
  const grad = g.createLinearGradient(0, 0, 256, 400);
  grad.addColorStop(0, '#833ab4'); grad.addColorStop(0.5, '#e1306c'); grad.addColorStop(1, '#fcaf45');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 400);
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = `700 22px ${FONTE}`; g.fillText(info?.usuario ? '@' + info.usuario : '@rbtech', 128, 60);
  g.font = `600 18px ${FONTE}`; g.fillText('SEGUIDORES', 128, 150);
  g.font = `800 ${info?.seguidores >= 100000 ? 44 : 54}px ${FONTE}`;
  g.fillText(info?.seguidores != null ? info.seguidores.toLocaleString('pt-BR') : '—', 128, 215);
  g.font = `600 16px ${FONTE}`;
  g.fillText(info?.seguidores != null ? 'ao vivo da Meta' : 'ligue a Meta', 128, 255);
  g.font = `800 26px ${FONTE}`; g.fillText('CRESCIMENTO', 128, 350);
  g.textAlign = 'left';
  tela.t.needsUpdate = true;
}

export function desenharSaas(tela, sinos = 0) {
  const g = tela.ctx;
  g.fillStyle = '#0d1117'; g.fillRect(0, 0, 640, 360);
  g.fillStyle = '#ffd60a'; g.font = `800 28px ${FONTE}`; g.fillText('SISTEMAS SAAS RBTECH', 28, 50);
  const sistemas = [['Sorteia Aí', 'sorteios de comentários do Instagram'], ['Agência RBTech', 'este prédio com equipes de IA'], ['Próximo sistema', 'em ideação pelo time de produto']];
  sistemas.forEach(([nome, desc], i) => {
    const y = 110 + i * 70;
    g.fillStyle = i < 2 ? '#2fd17a' : '#555'; g.beginPath(); g.arc(44, y - 8, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = `700 26px ${FONTE}`; g.fillText(nome, 66, y);
    g.fillStyle = '#9aa4b2'; g.font = `500 18px ${FONTE}`; g.fillText(desc, 66, y + 26);
  });
  g.fillStyle = '#ffd60a'; g.font = `700 20px ${FONTE}`; g.fillText(`🔔 sinos do time hoje: ${sinos}`, 28, 336);
  tela.t.needsUpdate = true;
}

export function desenharBoss(tela, pendentes = 0, cafes = 0) {
  const g = tela.ctx;
  g.fillStyle = '#0f0f0f'; g.fillRect(0, 0, 640, 300);
  g.fillStyle = '#ffd60a'; g.font = `800 40px ${FONTE}`; g.fillText('DIRETORIA · ISRAEL', 30, 70);
  g.fillStyle = '#bdbdbd'; g.font = `600 22px ${FONTE}`; g.fillText('auditoria de todas as decisões', 32, 110);
  g.fillStyle = pendentes ? '#ff5a5a' : '#2fd17a'; g.font = `800 90px ${FONTE}`; g.fillText(String(pendentes), 30, 230);
  g.fillStyle = '#fff'; g.font = `700 24px ${FONTE}`; g.fillText(pendentes === 1 ? 'decisão esperando auditoria' : 'decisões esperando auditoria', 150, 210);
  g.fillStyle = '#ffd60a'; g.font = `700 24px ${FONTE}`; g.fillText(`☕ cafés do Boss hoje: ${cafes}`, 32, 275);
  tela.t.needsUpdate = true;
}

const NOME_TELA = {
  chefe: 'Tráfego', analista: 'Analista', copywriter: 'Copy', roteirista: 'Roteiro', revisor: 'Revisão',
  gerente_crescimento: 'Crescimento', especialista: 'Instagram', estagiario: 'Estagiário',
  gerente_loja: 'Loja', estoque: 'Estoque', head_vendas: 'Vendas', sdr: 'Prospecção', closer: 'Propostas',
  sucesso: 'Clientes', produto: 'Produto', israel: 'Diretoria',
};
export function desenharMonitor(tela, papel, modo, tempo) {
  const g = tela.ctx;
  const W = 256, H = 160;
  if (modo === 'livre') {
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#141414'); grad.addColorStop(1, '#262626');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffd60a'; g.fillRect(98, 52, 60, 40);
    g.fillStyle = '#0f0f0f'; g.font = `800 22px ${FONTE}`; g.fillText('RB', 112, 80);
    g.fillStyle = '#777'; g.font = `500 12px ${FONTE}`; g.fillText(NOME_TELA[papel] || '', 10, 150);
    tela.t.needsUpdate = true;
    return;
  }
  if (modo === 'pronto') {
    g.fillStyle = '#0f2a1b'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2fd17a'; g.font = `800 64px ${FONTE}`; g.fillText('✓', 104, 92);
    g.font = `700 20px ${FONTE}`; g.fillText('PRONTO', 90, 128);
    tela.t.needsUpdate = true;
    return;
  }
  const ciclo = (tempo % 24) / 24;
  const tipo = {
    copywriter: 'texto', chefe: 'texto', gerente_loja: 'texto', head_vendas: 'texto', sdr: 'lista', closer: 'texto', sucesso: 'lista',
    roteirista: 'story', analista: 'grafico', gerente_crescimento: 'grafico', especialista: 'insta', estoque: 'lista',
    revisor: 'check', israel: 'check', produto: 'codigo', estagiario: 'texto',
  }[papel] || 'texto';
  if (tipo === 'texto' || tipo === 'lista') {
    g.fillStyle = '#fbfbf7'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffd60a'; g.fillRect(0, 0, W, 18);
    g.fillStyle = '#111'; g.font = `700 11px ${FONTE}`; g.fillText(NOME_TELA[papel] || 'Documento', 8, 13);
    const linhas = Math.floor(ciclo * 14);
    for (let i = 0; i < linhas; i++) {
      if (tipo === 'lista') { g.fillStyle = i % 3 === 0 ? '#2fd17a' : '#ccc'; g.fillRect(12, 29 + i * 9, 5, 5); }
      g.fillStyle = i % 5 === 0 ? '#222' : '#9a9a9a';
      g.fillRect(tipo === 'lista' ? 22 : 12, 30 + i * 9, 60 + ((i * 53) % 160), i % 5 === 0 ? 5 : 4);
    }
  } else if (tipo === 'story') {
    g.fillStyle = '#121212'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      const on = ciclo * 5 > i;
      g.fillStyle = on ? (i % 2 ? '#ffd60a' : '#f4f4f4') : '#2a2a2a';
      g.fillRect(14 + i * 60, 18, 48, 84);
      if (on) { g.fillStyle = '#111'; g.fillRect(20 + i * 60, 74, 36, 6); g.fillRect(20 + i * 60, 84, 26, 5); }
    }
    g.fillStyle = '#2a2a2a'; g.fillRect(14, 120, 228, 10);
    g.fillStyle = '#ffd60a'; g.fillRect(14, 120, ciclo * 228, 10);
  } else if (tipo === 'grafico') {
    g.fillStyle = '#0e1622'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#9fb3c8'; g.font = `600 11px ${FONTE}`; g.fillText(papel === 'gerente_crescimento' ? 'Instagram · seguidores' : 'Meta Ads · 7 dias', 10, 16);
    for (let i = 0; i < 7; i++) {
      const h = (20 + ((i * 37) % 60)) * Math.min(1, ciclo * 3 - i * 0.2 + 0.4);
      g.fillStyle = i === 6 ? '#ffd60a' : papel === 'gerente_crescimento' ? '#e1306c' : '#3b6fd6';
      g.fillRect(14 + i * 33, 140 - Math.max(0, h), 22, Math.max(0, h));
    }
  } else if (tipo === 'insta') {
    g.fillStyle = '#fafafa'; g.fillRect(0, 0, W, H);
    const cores = ['#e1306c', '#ffd60a', '#833ab4', '#fcaf45', '#111', '#3b6fd6'];
    for (let i = 0; i < 9; i++) {
      const x = 40 + (i % 3) * 60, y = 8 + Math.floor(i / 3) * 50;
      g.fillStyle = cores[i % cores.length]; g.fillRect(x, y, 54, 44);
      if (ciclo * 10 > i) { g.fillStyle = '#fff'; g.font = `700 12px ${FONTE}`; g.fillText('♥', x + 4, y + 14); }
    }
  } else if (tipo === 'codigo') {
    g.fillStyle = '#0d1117'; g.fillRect(0, 0, W, H);
    const cores = ['#ff7b72', '#79c0ff', '#d2a8ff', '#7ee787', '#e6edf3'];
    const linhas = Math.floor(ciclo * 15);
    for (let i = 0; i < linhas; i++) { g.fillStyle = cores[i % 5]; g.fillRect(10 + (i % 4) * 10, 8 + i * 10, 40 + ((i * 41) % 150), 5); }
  } else {
    g.fillStyle = '#fbfbf7'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#111'; g.font = `700 12px ${FONTE}`; g.fillText(papel === 'israel' ? 'Auditoria' : 'Revisão', 10, 16);
    const itens = papel === 'israel' ? ['Decisão clara', 'Motivo com números', 'Risco medido', 'Cabe no caixa', 'Aprovar?'] : ['Preço e condições', 'Regras do Meta', 'Clareza do gancho', 'Chamada WhatsApp', 'Português'];
    g.font = `500 12px ${FONTE}`;
    itens.forEach((t, i) => {
      const ok = ciclo * 6 > i + 1;
      g.fillStyle = ok ? '#1e9e5a' : '#bbb'; g.fillText(ok ? '✓' : '○', 12, 40 + i * 24);
      g.fillStyle = '#333'; g.fillText(t, 30, 40 + i * 24);
    });
  }
  tela.t.needsUpdate = true;
}
