// Diretor de arte e revisor visual das artes da Helena (Claude).
// A Helena define o conteúdo de cada tela; o diretor de arte decide a composição exata (posição, tamanho,
// alinhamento e camadas) e escreve a tela em SVG. O navegador desenha esse SVG com as fontes e as imagens de verdade,
// e o revisor olha a imagem pronta e corrige sobreposições, cortes e textos ilegíveis.
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const modelo = () => process.env.AGENCIA_MODELO_ARTE || process.env.AGENCIA_MODELO || 'claude-opus-5-5';
const esforco = () => (['low', 'medium', 'high'].includes(process.env.AGENCIA_ESFORCO_ARTE) ? process.env.AGENCIA_ESFORCO_ARTE : 'medium');

const REGRAS = `Você é diretor de arte sênior de uma agência premium de Instagram. Você desenha telas de carrossel, post, stories e reels da RB Tech Celulares (loja de iPhones e celulares em São José/SC) no nível dos melhores designers brasileiros do Instagram.

## Saída
Responda SÓ com um SVG completo, de <svg ...> até </svg>, sem markdown e sem explicação.
- <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="LARGURA" height="ALTURA" viewBox="0 0 LARGURA ALTURA"> com o tamanho informado.
- Proibido: <script>, foreignObject, eventos (onclick…), links externos, imagens da internet. Imagens só pelos endereços {{logo}} e {{imagem:N}} informados, em <image href="..." x y width height preserveAspectRatio>.
- Pode usar <defs> com linearGradient, radialGradient, filter (feGaussianBlur, feDropShadow, feColorMatrix), clipPath e mask.

## Fontes (já carregadas)
- "Anton": títulos. Condensada, só maiúsculas. Para o título em bloco, cada linha com textLength igual à largura da coluna e lengthAdjust="spacingAndGlyphs" (a linha fica exatamente da largura da coluna). Altura visível da letra ≈ 0,74 × font-size; espaço entre linhas ≈ 0,92 × font-size.
- "Allison": cursiva de destaque (uma palavra, grande: 220 a 420 px), levemente inclinada (rotate -6 a -10), cruzando a composição sem cobrir texto importante.
- "Poppins" (400, 600, 700, 800): textos de apoio. Use <tspan font-weight="700"> para negrito e fill amarelo para as palavras-chave. Quebre as linhas à mão com <tspan x dy>: em 40 px, cerca de 30 caracteres a cada 600 px de largura (conte!). Mínimo 34 px no feed e 40 px no stories.

## Identidade da marca
- Fundo quase preto (#070707) com luz dourada; amarelo da marca #FFD60A; branco #FFFFFF; dourado #E8B13A. Telas amarelas (#FFD000, texto preto) para quebrar o ritmo, quando o conteúdo pedir.
- Selo de perfil: círculo com a logo ({{logo}} recortada em círculo por clipPath, 64 a 76 px, borda amarela) + nome em Poppins 700 + @ em Poppins 500 menor. Sem selo de verificado.
- Carrossel: bolinhas de página (anterior pequena branca, atual maior amarela com o número em preto, próxima pequena branca).

## Composição (o que separa o amador do profissional)
- Grade: margens de 80 px; uma coluna de texto clara (cerca de 55 a 62% da largura quando há imagem lateral; centralizada quando a imagem está atrás).
- Hierarquia: 1 título dominante (o título em bloco é a maior coisa da tela), 1 texto de apoio curto, 1 assinatura em cursiva (quando houver), selo e bolinhas pequenos. Nunca dois elementos competindo.
- NADA de texto sobre texto. Texto sobre a imagem só onde ela está escura ou desfocada; nunca sobre o rosto, a tela ou o detalhe principal do produto. Se precisar, ponha um degradê escuro por trás do texto.
- A imagem de destaque é grande e corajosa (55 a 90% da altura), pode sair pela borda da tela; brilho dourado (radialGradient) atrás dela; sombra suave embaixo.
- Acabamentos de tecnologia, com moderação: quadradinhos de pixel em escada perto da imagem, 2 ou 3 bolhas de luz desfocadas, um brilho de lente, um feixe de luz fino, linhas finas de grade. Nunca por cima do texto.
- Respiro: deixe áreas vazias; não encha a tela. Alinhe tudo pela mesma linha (esquerda ou centro).
- Tudo dentro da tela: nenhum texto cortado na borda (só a cursiva e a imagem podem sangrar).
- Escreva os textos exatamente como vieram (pode quebrar linhas). Não invente preços, números nem informações.`;

function extrairSvg(texto) {
  const m = String(texto || '').match(/<svg[\s\S]*<\/svg>/i);
  return m ? m[0] : '';
}
async function pedirSvg(conteudo) {
  const r = await client.beta.messages.create({
    model: modelo(),
    max_tokens: 14000,
    ...(/haiku/i.test(modelo()) ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }),
    output_config: { effort: esforco() },
    cache_control: { type: 'ephemeral' },
    system: REGRAS,
    messages: [{ role: 'user', content: conteudo }],
  });
  const texto = (r.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  return { texto, usage: r.usage };
}

function briefing(plano, indice) {
  const s = plano.slides[indice];
  const [largura, altura] = plano.tamanho;
  const linhas = [
    `Formato: ${plano.tipo} · tela ${indice + 1} de ${plano.slides.length} · ${largura}×${altura} px.`,
    `Perfil do selo: nome "${plano.perfil}"${plano.arroba ? `, @ "${plano.arroba}"` : ''}. Logo: {{logo}} (${plano.logo[0]}×${plano.logo[1]} px, fundo preto).`,
    '',
    '## O que a Helena pediu para esta tela',
    `- Intenção do layout: ${s.layout} · tema: ${s.tema} · clima do fundo: ${s.efeito}`,
    s.chamada && `- Chamada (linha pequena acima do título): ${s.chamada}`,
    `- Título (linhas separadas por \\n; *linha* = amarela, ~linha~ = contorno, +linha = palavrinha pequena): ${JSON.stringify(s.titulo)}`,
    s.texto && `- Texto de apoio (**negrito**, *amarelo*): ${JSON.stringify(s.texto)}`,
    s.destaque && `- Destaque (botão, número gigante ou cabeçalho "A | B"): ${s.destaque}`,
    s.assinatura && `- Cursiva: ${s.assinatura}`,
    s.emoji && `- Emojis (como figurinha, pequenos e com intenção): ${s.emoji}`,
    s.rodape && `- Rodapé: ${s.rodape}`,
    plano.imagens[indice] ? `- Imagem de destaque desta tela: {{imagem:${indice}}} (PNG recortado, fundo transparente, ${plano.imagens[indice].w}×${plano.imagens[indice].h} px; mantenha a proporção). Pedido: ${plano.imagens[indice].descricao}. Lado sugerido: ${s.imagem_lado}.` : '- Esta tela não tem imagem de destaque própria.',
  ];
  for (const f of plano.fixos.filter(f => f.telas.includes(indice))) {
    linhas.push(`- Elemento FIXO (aparece igual na tela vizinha para o carrossel parecer contínuo; use exatamente esta posição e tamanho): <image href="{{imagem:${f.imagem}}}" x="${Math.round(f.x - indice * largura)}" y="${Math.round(f.y)}" width="${Math.round(f.w)}" height="${Math.round(f.h)}"/>. Componha o texto em volta dele.`);
  }
  if (plano.slides.length > 1) {
    linhas.push('', '## O carrossel inteiro (para manter o mesmo estilo e o ritmo)');
    plano.slides.forEach((o, k) => linhas.push(`${k + 1}. ${o.layout} · ${o.tema} · ${String(o.titulo).replace(/\n/g, ' / ')}${plano.imagens[k] ? ' · com imagem' : ''}`));
  }
  return linhas.filter(Boolean).join('\n');
}

/** O diretor de arte desenha a tela `indice` do plano. */
export async function desenharTelaSvg(plano, indice) {
  const { texto, usage } = await pedirSvg(briefing(plano, indice));
  const svg = extrairSvg(texto);
  if (!svg) throw new Error('o diretor de arte não devolveu a tela em SVG');
  return { svg, usage };
}

/** O revisor olha a tela desenhada e devolve o SVG corrigido (ou o mesmo, se estiver bom). */
export async function revisarTelaSvg(plano, indice, svg, jpegBase64) {
  const conteudo = [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpegBase64 } },
    {
      type: 'text', text: `${briefing(plano, indice)}

## Revisão
A imagem acima é a tela que você desenhou, já renderizada com as fontes e as imagens reais. Olhe como um diretor de arte exigente:
1. Algum texto encostando ou por cima de outro texto, do selo, das bolinhas ou de um emoji?
2. Texto por cima da parte importante da imagem, ou sem contraste para ler?
3. Algo cortado na borda (fora a cursiva e a imagem), linha estourando a coluna, letra pequena demais?
4. Hierarquia confusa, elementos sem alinhamento, tela poluída?
Corrija TUDO o que encontrar e responda só com o SVG completo corrigido. Se a tela já estiver impecável, devolva o mesmo SVG.

SVG atual:
${svg}`,
    },
  ];
  const { texto, usage } = await pedirSvg(conteudo);
  return { svg: extrairSvg(texto) || svg, usage };
}
