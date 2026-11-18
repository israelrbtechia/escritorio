// Markdown simples e seguro (escapa todo HTML antes de formatar): títulos, listas, tabelas, negrito, itálico, código.

const escapar = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function emLinha(s) {
  return escapar(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])\*([^*]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
}

export function markdown(texto) {
  const linhas = String(texto || '').replace(/\r/g, '').split('\n');
  const html = [];
  let lista = null; // 'ul' | 'ol'
  let paragrafo = [];
  const fecharParagrafo = () => { if (paragrafo.length) { html.push(`<p>${paragrafo.map(emLinha).join('<br>')}</p>`); paragrafo = []; } };
  const fecharLista = () => { if (lista) { html.push(`</${lista}>`); lista = null; } };

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    const t = l.trim();
    if (!t) { fecharParagrafo(); fecharLista(); continue; }
    // tabela: linha com | seguida de separador |---|
    if (t.startsWith('|') && /^\|?\s*:?-{2,}/.test((linhas[i + 1] || '').trim())) {
      fecharParagrafo(); fecharLista();
      const celulas = x => x.trim().replace(/^\||\|$/g, '').split('|').map(c => emLinha(c.trim()));
      const cab = celulas(t);
      i += 1;
      const corpo = [];
      while (i + 1 < linhas.length && linhas[i + 1].trim().startsWith('|')) corpo.push(celulas(linhas[++i]));
      html.push('<div class="tabela"><table><thead><tr>' + cab.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
        corpo.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }
    const titulo = t.match(/^(#{1,4})\s+(.*)$/);
    if (titulo) { fecharParagrafo(); fecharLista(); html.push(`<h4>${emLinha(titulo[2])}</h4>`); continue; }
    if (/^(-{3,}|\*{3,})$/.test(t)) { fecharParagrafo(); fecharLista(); html.push('<hr>'); continue; }
    const ul = t.match(/^[-*•]\s+(.*)$/);
    const ol = t.match(/^\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      fecharParagrafo();
      const tipo = ul ? 'ul' : 'ol';
      if (lista !== tipo) { fecharLista(); html.push(`<${tipo}>`); lista = tipo; }
      html.push(`<li>${emLinha((ul || ol)[1])}</li>`);
      continue;
    }
    if (lista && /^\s{2,}/.test(l)) { html[html.length - 1] = html[html.length - 1].replace(/<\/li>$/, `<br>${emLinha(t)}</li>`); continue; }
    fecharLista();
    paragrafo.push(t);
  }
  fecharParagrafo();
  fecharLista();
  return html.join('');
}
