// Gera um relatório HTML organizado com as ideias de crescimento entregues pelo time da Helena.
// O arquivo é independente (CSS embutido): abre numa aba, imprime e pode ser baixado e enviado.
import { markdown } from './markdown.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const comQuebras = s => esc(s).replace(/\n/g, '<br>');
const TIPOS = {
  reels: ['🎬', 'Reels'], post: ['🖼️', 'Post'], carrossel: ['🗂️', 'Carrossel'], stories: ['⏱️', 'Stories'],
  edicao: ['✍️', 'Edição'], engajamento: ['💬', 'Engajamento'], parceria: ['🤝', 'Parceria'], outro: ['✨', 'Outro'],
};
const PRIORIDADES = [['alta', 'Prioridade alta', 'Fazer primeiro'], ['media', 'Prioridade média', 'Fazer em seguida'], ['baixa', 'Prioridade baixa', 'Quando der']];

export function gerarHtmlIdeias(entrega, { autor = 'Time da Helena', usuario = '' } = {}) {
  const d = entrega.ideias || {};
  const ideias = Array.isArray(d.ideias) ? d.ideias : [];
  const numeros = Array.isArray(d.numeros_chave) ? d.numeros_chave : [];
  const data = new Date(entrega.quando || Date.now()).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  const tiposUsados = [...new Set(ideias.map(i => i.tipo))].filter(t => TIPOS[t]);
  const contagem = Object.fromEntries(PRIORIDADES.map(([p]) => [p, ideias.filter(i => i.prioridade === p).length]));

  const card = (i, n) => {
    const [icone, nomeTipo] = TIPOS[i.tipo] || TIPOS.outro;
    return `<article class="ideia" data-tipo="${esc(i.tipo)}">
      <header><span class="tipo">${icone} ${esc(nomeTipo)}</span><label class="feito"><input type="checkbox" data-chave="${esc(entrega.id)}-${n}"> feito</label></header>
      <h3>${esc(i.titulo)}</h3>
      ${i.gancho ? `<blockquote>${comQuebras(i.gancho)}</blockquote>` : ''}
      <dl>
        <dt>Como fazer</dt><dd>${comQuebras(i.como_fazer)}</dd>
        <dt>Por quê</dt><dd>${comQuebras(i.por_que)}</dd>
        <dt>Como medir</dt><dd>${comQuebras(i.como_medir)}</dd>
      </dl>
    </article>`;
  };
  let n = 0;
  const grupos = PRIORIDADES.filter(([p]) => contagem[p]).map(([p, titulo, sub]) => `
    <section class="grupo ${p}">
      <h2>${titulo} <small>${sub} · ${contagem[p]}</small></h2>
      <div class="ideias">${ideias.filter(i => i.prioridade === p).map(i => card(i, n++)).join('')}</div>
    </section>`).join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.titulo || 'Ideias de crescimento')} · RBTech</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  :root { --amarelo: #ffd60a; --preto: #0f0f0f; --fundo: #f6f5f1; --cartao: #ffffff; --texto: #1a1a1a; --texto-2: #5f5f5f; --linha: #e4e1d8; --verde: #1e9e5a; }
  @media (prefers-color-scheme: dark) { :root { --fundo: #121212; --cartao: #1c1c1c; --texto: #f2f2f2; --texto-2: #a9a9a9; --linha: #2c2c2c; --verde: #2fd17a; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--fundo); color: var(--texto); font: 15px/1.55 "Poppins", system-ui, sans-serif; }
  .topo { background: var(--preto); color: #fff; padding: 28px 16px; }
  .topo .in, main { max-width: 1040px; margin: 0 auto; }
  .marca { display: flex; align-items: center; gap: 10px; color: var(--amarelo); font-weight: 800; letter-spacing: .04em; font-size: 13px; text-transform: uppercase; }
  .logo { width: 34px; height: 34px; display: grid; place-items: center; background: var(--amarelo); color: var(--preto); border-radius: 8px; font-weight: 800; }
  h1 { font-size: clamp(24px, 4vw, 36px); line-height: 1.15; margin: 14px 0 8px; }
  .meta { color: #bdbdbd; font-size: 13px; }
  main { padding: 24px 16px 60px; }
  .resumo { background: var(--cartao); border: 1px solid var(--linha); border-left: 6px solid var(--amarelo); border-radius: 12px; padding: 16px 18px; font-size: 16px; }
  .numeros { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin: 20px 0 8px; }
  .numero { background: var(--cartao); border: 1px solid var(--linha); border-radius: 12px; padding: 14px 16px; }
  .numero b { display: block; font-size: 26px; font-weight: 800; }
  .numero span { color: var(--texto-2); font-size: 13px; }
  .numero em { display: block; font-style: normal; font-size: 13px; margin-top: 4px; }
  .barra { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 26px 0 6px; }
  .barra button { font: inherit; font-size: 13px; font-weight: 600; border: 1px solid var(--linha); background: var(--cartao); color: var(--texto); border-radius: 999px; padding: 6px 12px; cursor: pointer; }
  .barra button.ativo { background: var(--amarelo); color: var(--preto); border-color: var(--amarelo); }
  .barra .acoes { margin-left: auto; }
  .grupo h2 { font-size: 20px; margin: 28px 0 12px; display: flex; align-items: baseline; gap: 10px; }
  .grupo h2 small { font-size: 13px; color: var(--texto-2); font-weight: 600; }
  .grupo.alta h2::before { content: ""; width: 12px; height: 12px; border-radius: 50%; background: #ff5a5a; }
  .grupo.media h2::before { content: ""; width: 12px; height: 12px; border-radius: 50%; background: var(--amarelo); }
  .grupo.baixa h2::before { content: ""; width: 12px; height: 12px; border-radius: 50%; background: #9aa4b2; }
  .ideias { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
  .ideia { background: var(--cartao); border: 1px solid var(--linha); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; }
  .ideia.feita { opacity: .55; }
  .ideia header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .tipo { font-size: 12px; font-weight: 700; background: var(--fundo); border: 1px solid var(--linha); border-radius: 999px; padding: 2px 10px; }
  .feito { font-size: 12px; color: var(--texto-2); display: flex; gap: 4px; align-items: center; cursor: pointer; }
  .feito input { accent-color: var(--verde); }
  .ideia h3 { font-size: 17px; margin: 10px 0 6px; line-height: 1.3; }
  blockquote { margin: 0 0 8px; padding: 8px 12px; border-left: 4px solid var(--amarelo); background: var(--fundo); border-radius: 0 8px 8px 0; font-weight: 600; }
  dl { margin: 6px 0 0; }
  dt { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--texto-2); margin-top: 10px; }
  dd { margin: 2px 0 0; }
  details { margin-top: 30px; background: var(--cartao); border: 1px solid var(--linha); border-radius: 12px; padding: 12px 16px; }
  summary { cursor: pointer; font-weight: 700; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; } th, td { border: 1px solid var(--linha); padding: 6px; text-align: left; }
  footer { color: var(--texto-2); font-size: 12px; text-align: center; margin-top: 40px; }
  @media print { .barra, .feito { display: none; } body { background: #fff; } .ideia { break-inside: avoid; } }
</style>
</head>
<body>
<header class="topo"><div class="in">
  <div class="marca"><span class="logo">RB</span> RBTech · Crescimento no Instagram${usuario ? ` · @${esc(usuario)}` : ''}</div>
  <h1>${esc(d.titulo || 'Ideias de crescimento')}</h1>
  <div class="meta">${esc(autor)} · ${esc(data)} · entrega ${esc(entrega.id)}${entrega.ensaio ? ' · ENSAIO (números de mentira)' : ''}</div>
</div></header>
<main>
  ${d.resumo ? `<p class="resumo">${comQuebras(d.resumo)}</p>` : ''}
  ${numeros.length ? `<section class="numeros">${numeros.map(x => `<div class="numero"><span>${esc(x.nome)}</span><b>${esc(x.valor)}</b><em>${esc(x.leitura)}</em></div>`).join('')}</section>` : ''}
  <nav class="barra" aria-label="Filtrar ideias">
    <button type="button" class="ativo" data-filtro="">Todas (${ideias.length})</button>
    ${tiposUsados.map(t => `<button type="button" data-filtro="${t}">${TIPOS[t][0]} ${TIPOS[t][1]}</button>`).join('')}
    <span class="acoes"><button type="button" onclick="print()">🖨️ Imprimir / PDF</button></span>
  </nav>
  ${grupos || '<p>Nenhuma ideia nesta entrega.</p>'}
  ${entrega.texto ? `<details><summary>Texto completo da entrega</summary>${markdown(entrega.texto)}</details>` : ''}
  <footer>Gerado pelo Prédio RBTech · as ideias são sugestões: nada foi publicado sem a aprovação do Israel.</footer>
</main>
<script>
  for (const b of document.querySelectorAll('[data-filtro]')) b.onclick = () => {
    document.querySelectorAll('[data-filtro]').forEach(x => x.classList.toggle('ativo', x === b));
    document.querySelectorAll('.ideia').forEach(c => { c.hidden = !!b.dataset.filtro && c.dataset.tipo !== b.dataset.filtro; });
    document.querySelectorAll('.grupo').forEach(g => { g.hidden = ![...g.querySelectorAll('.ideia')].some(c => !c.hidden); });
  };
  for (const c of document.querySelectorAll('[data-chave]')) {
    try { c.checked = localStorage.getItem('ideia.' + c.dataset.chave) === '1'; } catch {}
    c.closest('.ideia').classList.toggle('feita', c.checked);
    c.onchange = () => { c.closest('.ideia').classList.toggle('feita', c.checked); try { localStorage.setItem('ideia.' + c.dataset.chave, c.checked ? '1' : '0'); } catch {} };
  }
</script>
</body>
</html>`;
}

/** Abre o relatório numa aba nova. */
export function abrirRelatorio(entrega, opcoes) {
  const url = URL.createObjectURL(new Blob([gerarHtmlIdeias(entrega, opcoes)], { type: 'text/html' }));
  const aba = window.open(url, '_blank');
  if (!aba) location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
/** Baixa o relatório como arquivo .html. */
export function baixarRelatorio(entrega, opcoes) {
  const url = URL.createObjectURL(new Blob([gerarHtmlIdeias(entrega, opcoes)], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `ideias-rbtech-${entrega.id}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ======================================================================
// Relatório HTML de qualquer equipe: o relatório final do chefe + as entregas citadas.
// ======================================================================
const ESTILO_TRABALHO = `
  :root { --amarelo: #ffd60a; --preto: #0f0f0f; --fundo: #f6f5f1; --cartao: #ffffff; --texto: #1a1a1a; --texto-2: #5f5f5f; --linha: #e4e1d8; }
  @media (prefers-color-scheme: dark) { :root { --fundo: #121212; --cartao: #1c1c1c; --texto: #f2f2f2; --texto-2: #a9a9a9; --linha: #2c2c2c; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--fundo); color: var(--texto); font: 15px/1.6 "Poppins", system-ui, sans-serif; }
  .topo { background: var(--preto); color: #fff; padding: 28px 16px; }
  .topo .in, main { max-width: 920px; margin: 0 auto; }
  .marca { display: flex; align-items: center; gap: 10px; color: var(--amarelo); font-weight: 800; letter-spacing: .04em; font-size: 13px; text-transform: uppercase; }
  .logo { width: 34px; height: 34px; display: grid; place-items: center; background: var(--amarelo); color: var(--preto); border-radius: 8px; font-weight: 800; }
  h1 { font-size: clamp(24px, 4vw, 34px); line-height: 1.15; margin: 14px 0 8px; }
  .meta { color: #bdbdbd; font-size: 13px; }
  main { padding: 24px 16px 60px; }
  .barra { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
  .barra button { font: inherit; font-size: 13px; font-weight: 600; border: 1px solid var(--linha); background: var(--cartao); color: var(--texto); border-radius: 999px; padding: 6px 14px; cursor: pointer; }
  .pedido { background: var(--cartao); border: 1px solid var(--linha); border-left: 6px solid var(--amarelo); border-radius: 12px; padding: 14px 18px; margin-bottom: 18px; }
  .pedido b { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--texto-2); }
  nav.indice { background: var(--cartao); border: 1px solid var(--linha); border-radius: 12px; padding: 12px 18px; margin-bottom: 18px; }
  nav.indice ol { margin: 6px 0 0; padding-left: 20px; }
  nav.indice a { color: inherit; }
  section.bloco { background: var(--cartao); border: 1px solid var(--linha); border-radius: 14px; padding: 18px 20px; margin-bottom: 16px; }
  section.bloco > header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; border-bottom: 1px solid var(--linha); padding-bottom: 10px; margin-bottom: 8px; }
  .codigo { background: var(--amarelo); color: var(--preto); font-weight: 800; border-radius: 6px; padding: 0 8px; font-size: 13px; }
  .quem { font-weight: 700; }
  .hora { color: var(--texto-2); font-size: 12px; margin-left: auto; }
  .copiar { font: inherit; font-size: 12px; border: 1px solid var(--linha); background: transparent; color: var(--texto); border-radius: 8px; padding: 3px 10px; cursor: pointer; }
  section.bloco h2, section.bloco h3, section.bloco h4 { line-height: 1.3; margin: 16px 0 6px; }
  section.bloco p { margin: 0 0 10px; }
  section.bloco ul, section.bloco ol { padding-left: 22px; margin: 4px 0 10px; }
  details.pedido-entrega { color: var(--texto-2); font-size: 13px; margin-bottom: 8px; }
  details.pedido-entrega summary { cursor: pointer; }
  blockquote { margin: 0 0 10px; padding: 8px 12px; border-left: 4px solid var(--amarelo); background: var(--fundo); border-radius: 0 8px 8px 0; }
  code { background: var(--fundo); padding: 1px 5px; border-radius: 4px; font-size: 13px; }
  .tabela { overflow-x: auto; } table { border-collapse: collapse; width: 100%; font-size: 13px; margin: 6px 0 12px; } th, td { border: 1px solid var(--linha); padding: 6px 8px; text-align: left; vertical-align: top; } th { background: var(--fundo); }
  footer { color: var(--texto-2); font-size: 12px; text-align: center; margin-top: 40px; }
  @media print { .barra, .copiar { display: none; } body { background: #fff; } section.bloco { break-inside: avoid-page; } }
`;
const dataLonga = t => new Date(t || Date.now()).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });

/**
 * Página HTML com o trabalho de uma equipe.
 * @param {{titulo, equipe, autor, quando, pedido, relatorio, entregas: Array<{id, autor, quando, pedido, texto}>, ensaio}} t
 */
export function gerarHtmlTrabalho(t) {
  const entregas = t.entregas || [];
  const blocos = [];
  if (t.relatorio) blocos.push({ ancora: 'relatorio', titulo: `Relatório de ${t.autor}`, html: `<section class="bloco" id="relatorio"><header><span class="quem">📋 Relatório de ${esc(t.autor)}</span><span class="hora">${esc(dataLonga(t.quando))}</span><button class="copiar" type="button" data-copiar="relatorio">Copiar</button></header>${markdown(t.relatorio)}</section>` });
  for (const e of entregas) {
    blocos.push({ ancora: `e-${e.id}`, titulo: `${e.id} · ${e.autor}`, html: `<section class="bloco" id="e-${esc(e.id)}"><header><span class="codigo">${esc(e.id)}</span><span class="quem">${esc(e.autor)}</span><span class="hora">${esc(dataLonga(e.quando))}</span><button class="copiar" type="button" data-copiar="e-${esc(e.id)}">Copiar</button></header>${e.pedido ? `<details class="pedido-entrega"><summary>O que foi pedido</summary>${comQuebras(e.pedido)}</details>` : ''}${markdown(e.texto || '')}</section>` });
  }
  const textos = Object.fromEntries([['relatorio', t.relatorio || ''], ...entregas.map(e => [`e-${e.id}`, e.texto || ''])]);
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.titulo)} · RBTech</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${ESTILO_TRABALHO}</style>
</head>
<body>
<header class="topo"><div class="in">
  <div class="marca"><span class="logo">RB</span> Prédio RBTech · ${esc(t.equipe)}</div>
  <h1>${esc(t.titulo)}</h1>
  <div class="meta">${esc(t.autor)} · ${esc(dataLonga(t.quando))}${entregas.length ? ` · ${entregas.length} entrega(s) da equipe` : ''}${t.ensaio ? ' · ENSAIO (respostas de mentira)' : ''}</div>
</div></header>
<main>
  <div class="barra"><button type="button" onclick="print()">🖨️ Imprimir / salvar PDF</button></div>
  ${t.pedido ? `<div class="pedido"><b>Pedido do Israel</b>${comQuebras(t.pedido)}</div>` : ''}
  ${blocos.length > 1 ? `<nav class="indice"><b>Nesta página</b><ol>${blocos.map(b => `<li><a href="#${esc(b.ancora)}">${esc(b.titulo)}</a></li>`).join('')}</ol></nav>` : ''}
  ${blocos.map(b => b.html).join('\n')}
  <footer>Gerado pelo Prédio RBTech · a equipe só sugere: nada foi publicado, enviado ou gasto sem a aprovação do Israel.</footer>
</main>
<script>
  const TEXTOS = ${JSON.stringify(textos).replace(/</g, '\\u003c')};
  for (const b of document.querySelectorAll('[data-copiar]')) b.onclick = async () => {
    try { await navigator.clipboard.writeText(TEXTOS[b.dataset.copiar] || ''); b.textContent = 'Copiado ✓'; } catch { b.textContent = 'Não deu'; }
    setTimeout(() => { b.textContent = 'Copiar'; }, 1600);
  };
</script>
</body>
</html>`;
}

/** Abre um HTML pronto numa aba nova. */
export function abrirHtml(html) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const aba = window.open(url, '_blank');
  if (!aba) location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
/** Baixa um HTML pronto como arquivo. */
export function baixarHtml(html, arquivo) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
