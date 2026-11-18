# Prédio RBTech

Um prédio 3D "blocadinho" onde cada andar tem uma equipe de IA, e toda decisão dos chefes sobe para a auditoria do Israel, no terraço.

| Andar | Chefe | Equipe |
|---|---|---|
| 1º · Loja RB TECH | **Rael** (na mesa de negociação) | Atendimento (vendas, pós-venda e estoque) e Técnico (reparo e avaliação de usados) |
| 2º · Agência RBTech (tráfego) | **Pamella** | Analista, Copywriter, Roteirista, Revisor |
| 2º · Agência RBTech (crescimento) | **Helena** | Especialista de crescimento |
| 3º · Vendas e SaaS | Head de vendas e produtos | Prospecção (SDR), Executivo de vendas, Sucesso do cliente, Gestor de produto |
| Terraço · Diretoria | **Israel (Boss)** | audita toda decisão; tem a própria máquina de espresso |

- A loja tem porta automática, café e cadeiras do cliente na entrada, parede de grama com quadros e a mesa de negociação, balcão central com vitrines dos dois lados, painel de acessórios e estoque e, atrás dele, o setor de reparo com a bancada do técnico. Na parede de vidro da direita: neon RB TECH, ponto de selfie e estação para carregar o celular.
- Os chefes da agência e de vendas têm sala fechada de vidro com notebook. Cada andar tem copa; o terraço tem área de lazer (sofás, videogame, pebolim) e a copa do prédio.
- A equipe está sempre em movimento: pausas para o café, conversas, lazer no terraço. Pessoas e cachorros (Peter e Bibi) trocam de andar pelo elevador de vidro, um por vez: ninguém fica em dois lugares ao mesmo tempo.
- **Chefes**: escolha com qual chefe falar. Ele chama a equipe (em paralelo quando dá), lê as métricas da Meta e manda as decisões para o Israel.
- **Reunião geral**: o Israel escreve a pauta; os chefes sobem para a mesa do terraço e cada um responde pelo seu andar.
- **Diretoria**: a sua sala. Nada é executado antes da sua aprovação, e os chefes leem as suas auditorias antes de decidir de novo.
- **Entregas**: tudo que as equipes produziram (E1, E2…), com botão de copiar.
- **Placar**: com o Meta Ads ligado, preenche sozinho (conversas no WhatsApp, investimento, dias na meta).
- **Ajustes**: modo ensaio (sem IA, não gasta créditos), rotinas, gasto estimado, nova reunião.
- **Rotinas automáticas**: todo dia de manhã cada andar trabalha sozinho, mesmo com o app fechado, e deixa relatório, entregas e decisões para você ver ao abrir.

## Colocar no ar (Vercel)

1. **Add New → Project** → escolha o repositório `escritorio` (branch `main`) → **Deploy**.
2. **Settings → Environment Variables**:

| Variável | Para quê |
|---|---|
| `ANTHROPIC_API_KEY` | chave da API do Claude (obrigatória) |
| `AGENCIA_USUARIO` | usuário do login (ex.: `rbtech`) |
| `AGENCIA_SENHA` | senha do login. **Só aqui, nunca no código**: este repositório é público |
| `CRON_SECRET` | um texto secreto qualquer; a Vercel usa para disparar as rotinas automáticas |
| `META_ACCESS_TOKEN` | token da Meta (veja abaixo) |
| `META_AD_ACCOUNT_ID` | id da conta de anúncios (com ou sem `act_`) |
| `META_IG_USER_ID` | id da conta profissional do Instagram (número, não o @) |
| `META_APP_SECRET` | opcional: chave secreta do app da Meta (assina as chamadas) |
| `AGENCIA_MODELO` | opcional: padrão `claude-opus-5-5` |
| `AGENCIA_MODELO_EQUIPE` | opcional: modelo só dos funcionários (os chefes continuam no `AGENCIA_MODELO`). Ex.: `claude-sonnet-5-5`, que custa metade |
| `AGENCIA_ESFORCO_CHEFES` / `AGENCIA_ESFORCO_EQUIPE` | opcional: `low`, `medium`, `high`… Padrão: chefes `medium`, equipe `low` |
| `REPARO_SITE_URL` | opcional: endereço do site do ReparoSimples, para a revisão dos servidores conferir se está no ar |
| `ROTINAS_ATIVAS` | opcional: escolhe as rotinas automáticas. Ex.: `stories,reels,trafego` ou `todas`. Sem ela, rodam stories, reels, tráfego, crescimento e vendas (a loja roda pelo contador de OS) |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_DESTINATARIOS` | opcional: avisam no WhatsApp quando o relatório de reels fica pronto (veja Central de conteúdo) |
| `ELEVENLABS_API_KEY` | opcional: vozes reais para cada funcionário e transcrição das perguntas por áudio |
| `ELEVENLABS_VOZES` | opcional: troca vozes, em JSON (ex.: `{"chefe":"id-da-voz"}`) |

3. **Storage → Create Database → Upstash for Redis** → crie e conecte ao projeto do prédio (marque Production). Ele cria `KV_REST_API_URL` e `KV_REST_API_TOKEN` sozinho; se você escolher outro prefixo, o prédio acha do mesmo jeito. A integração **Redis** (Redis Cloud), que cria só `REDIS_URL`, também funciona. É onde ficam os relatórios das rotinas, as decisões auditadas, a central de conteúdo e o gestor.
4. **Deployments → Redeploy** para as variáveis valerem.

Sem `AGENCIA_USUARIO` e `AGENCIA_SENHA`, o site fica aberto: qualquer pessoa com o link gasta seus créditos. Trocar a senha encerra todos os logins.

### Token da Meta
1. Em business.facebook.com → **Configurações do negócio → Usuários do sistema**, crie um usuário do sistema (administrador).
2. Dê a ele acesso à **conta de anúncios** e à **conta do Instagram** da RBTech.
3. **Gerar token** com as permissões: `ads_read`, `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `business_management`. Escolha validade "nunca expira".
4. O id do Instagram aparece em **Configurações do negócio → Contas do Instagram**, ou pela Graph API em `/{id-da-página}?fields=instagram_business_account`.

A equipe só **lê** métricas: não publica, não edita posts e não mexe em orçamento.

**Prospecção por hashtag (SDR do 3º andar):** para achar lojas que fizeram sorteio, o SDR busca posts por hashtag (ex.: #sorteio).
- A Meta exige o recurso **Instagram Public Content Access** no app (em developers.facebook.com → seu app → Revisão do app).
- Ela limita a busca a 30 hashtags diferentes por semana.
- Sem esse recurso, o SDR avisa que não conseguiu, em vez de inventar perfis.

### Rotinas (vercel.json)
| Rotina | Quando (Brasília) | Quem |
|---|---|---|
| Tráfego | 4x ao dia: 8h17, 12h17, 16h17, 20h17 | Pamella e equipe |
| Crescimento | 4x ao dia: 8h27, 12h27, 16h27, 20h27 | Helena e especialista |
| Vendas e SaaS | 4x ao dia: 8h37, 12h37, 16h37, 20h37 | Head de vendas e equipe |
| Loja | a cada 10 atualizações de OS no ReparoSimples (OS nova ou mudança de status) | Rael, atendimento e técnico |
| Stories | todo dia, 8h03 | Especialista de crescimento |
| Reels | segunda, 8h13 | Roteirista |
| Revisão dos servidores do ReparoSimples | 8h41 e 20h41 (sem IA) | — |

- **Economia:** a cada turno, o chefe recebe o relatório do turno anterior. Se nada mudou, ele fecha um relatório curto sem chamar a equipe.
- **Rodada da loja:** cada OS nova ou mudança de status conta 1. Na 10ª, Rael faz a rodada com a lista das 10 atualizações.
  - Para contar em tempo real, mesmo com o app fechado: abra Ajustes → ReparoSimples → **Contar as OS em tempo real**, copie o SQL e rode uma vez no SQL Editor do Supabase do ReparoSimples.
  - Sem isso, o prédio só conta enquanto o app está aberto (compara as OS a cada minuto).
- **Para mudar quais rodam sozinhas:** crie `ROTINAS_ATIVAS` na Vercel (ex.: `stories,reels,trafego` ou `todas`). Os botões "Rodar …" da aba Ajustes funcionam sempre.

No plano Hobby da Vercel, cada horário é um agendamento separado (16 ao todo), e o horário pode variar dentro da hora.

## Instagram: publicar, aplicar à mão e relatórios de ideias
- **Pedidos de mídia**: quando a Helena precisa de um vídeo ou foto, ela deixa no chat um link para `/upload.html`. Lá você vê o briefing, sobe o MP4 ou a foto, revisa a legenda e clica em **Aprovar e publicar**. O app publica pela API oficial (reels, post, carrossel ou stories). Nada é publicado sem esse clique.
- **Aplicar à mão**: o que a API não deixa mudar (bio, link da bio, legenda de post antigo, destaques, fixado, capa) vira um card na aba **Insta**, com o texto pronto, botão de copiar, link e "Feito".
- **Relatórios de ideias**: cada entrega de ideias do time da Helena vira um relatório HTML organizado (resumo, números-chave, ideias por prioridade, filtros, imprimir/PDF), para abrir ou baixar.

Para publicar de verdade:
1. **Storage → Blob → Create** e conecte ao projeto (cria `BLOB_READ_WRITE_TOKEN`). É onde o vídeo fica para a Meta buscar.
2. No token da Meta, inclua também `instagram_content_publish` (além de `instagram_basic` e `instagram_manage_insights`).
3. Redeploy.

## ReparoSimples (assistência da loja RB Tech)
O laboratório do térreo mostra as OS reais da loja RB Tech no ReparoSimples (repositório REPARORBTECH):
- OS nova → o atendente avisa e o técnico busca o aparelho no balcão; ele entra na prateleira **AGUARDANDO REPARO** com a tag da OS.
- Em análise (laranja) / aguardando peça (vermelha) → prateleira de espera · em reparo (roxa) → na bancada, com o técnico trabalhando nela · pronto (verde) → **PRONTO · RETIRADA** · entregue → o atendente busca e entrega · interrompida ou na lixeira → sai.
- Atualiza a cada 15 segundos. Só lê número da OS, aparelho, status, defeito e previsão: nenhum dado de cliente.
- O Rael e o técnico também consultam as OS (atrasadas, prontas, na fila) pela ferramenta `ler_ordens_de_servico`.

Variáveis na Vercel (projeto do prédio):
| Variável | Valor |
|---|---|
| `REPARO_SUPABASE_URL` | o endereço do Supabase do ReparoSimples (o mesmo do `js/config.js` do REPARORBTECH) |
| `REPARO_SUPABASE_SERVICE_KEY` | a chave secreta do Supabase (Project Settings → API Keys → secret / service_role). A mesma `SUPABASE_SERVICE_ROLE_KEY` do projeto REPARORBTECH na Vercel |
| `REPARO_LOJA_ID` | opcional: o prédio acha sozinho a loja com "RB Tech" no nome. Só precisa se houver mais de uma loja com esse nome |

A chave secreta dá acesso total ao banco: deixe o login do prédio ligado (`AGENCIA_USUARIO` e `AGENCIA_SENHA`).

## O bairro real em volta do prédio (Colônia Santana, São José/SC)
O prédio fica no lugar da loja, na **Rodovia SC-281, 7955** (no mapa: Rodovia Eugênio Raulino Koerich), de frente para a rodovia. Em volta, no mesmo estilo de blocos, está o que existe de verdade:
- **casas:** 669, nos lugares e tamanhos reais (contorno por satélite), com telhado de 4 águas e 1 ou 2 andares conforme o tamanho; galpões com telhado de metal;
- **ruas e rios:** a SC-281 com faixa amarela, as ruas do bairro (asfalto ou terra), os rios e córregos;
- **relevo e mata:** os morros reais em volta do vale, até 319 m, com Mata Atlântica, e céu de dia.

Câmeras: **Prédio → Bairro (Colônia Santana)** e **Chegando pela SC-281**. Dá para afastar o zoom até ver o bairro inteiro.

Sobre a posição: o número 7955 não está no mapa. Ele foi estimado pelo CEP (o trecho de Colônia Santana começa no 6001) e pelo comprimento da rodovia, do lado ímpar. Para usar o ponto exato do Google Maps:
1. Troque `LOJA` em `scripts/gerar-vizinhanca.py`.
2. Rode o script com os dados baixados (ele explica como).

Dados: © OpenStreetMap contributors (ODbL) · Microsoft Global ML Building Footprints (ODbL) · relevo SRTM. O crédito aparece no canto da tela 3D.

## Ações no ReparoSimples depois do seu ok (igual ao RB Central)
A equipe da loja **lê à vontade** o mesmo que o RB Central:
- OS com valor, previsão, técnico e cliente;
- relatório do dia, metas e vendas (também de aparelhos);
- pedidos de peças e configuração.

Para **mudar** algo, o Rael coloca **ações** dentro de uma decisão. Elas aparecem na Diretoria e só acontecem quando você toca em **Aprovar e executar**:
- **WhatsApp ao cliente da OS:** com o texto que ele escreveu, que você confere antes.
- **Aviso oficial de aparelho pronto:** com o link de acompanhamento e a garantia.
- **Mudar status** e **editar a OS:** previsão, técnico, observações, serviço, defeito, valor, garantia ou acessórios.
- **Registrar pagamento:** marca a OS como paga e lança a receita no financeiro, no caixa aberto.
- **Abrir OS nova.**
- **Pedidos de peças:** pôr ou tirar da lista do fornecedor e mandar a cotação ou o pedido pelo WhatsApp.
- **Mudar uma meta do mês.**

Depois da execução, a decisão mostra o resultado de cada ação. Se o WhatsApp não sair, aparece um link para você enviar à mão. Só a exclusão de OS fica com a loja.

Tudo passa pela **API do RB Central** do ReparoSimples, a mesma que segue as regras da tela "Editar OS" e só enxerga a loja RB Tech. Para ligar:
O token é uma senha que você mesmo cria. O ReparoSimples só aceita pedidos do prédio que mandarem essa senha, por isso ela tem o **mesmo valor** nos dois projetos (o nome muda: `CENTRAL_API_TOKEN` lá e `REPARO_CENTRAL_TOKEN` aqui). Para criar: **Ajustes → ReparoSimples → 🔑 Gerar o token do RB Central**. A senha é gerada no seu aparelho, não passa pelo servidor e não fica salva. A mesma caixa mostra o id da loja RB Tech para o `CENTRAL_LOJA`.

1. **No projeto do ReparoSimples na Vercel:**
   - `CENTRAL_LOJA`: o id da loja RB Tech;
   - `CENTRAL_API_TOKEN`: uma senha longa, com 40 caracteres ou mais.

   Se o RB Central já estiver ligado, essas variáveis já existem.
2. **No projeto do prédio:**
   - `REPARO_CENTRAL_URL`: o endereço do site do ReparoSimples;
   - `REPARO_CENTRAL_TOKEN`: o mesmo valor do `CENTRAL_API_TOKEN`.
3. **WhatsApp:** no ReparoSimples, em Configurações → WhatsApp, conecte a **API oficial da Meta**. As mensagens saem por esse número.
4. Faça **Redeploy** nos dois projetos.

Com o RB Central ligado, a leitura das OS da equipe também passa a trazer valor, previsão, técnico e nome do cliente (nunca o telefone).

## 🎨 Artes da Helena (post, carrossel, stories e reels animado)
Peça para a Helena no chat: "cria um carrossel sobre troca de bateria", "faz um reels animado da promoção" ou "cria e publica um post do iPhone 15".
- **Quem desenha:** a Helena (Claude) escreve e dirige a arte; o app desenha no seu navegador com acabamento de designer: título em bloco com letra condensada gigante (Anton), linhas em amarelo, em contorno ou pequenas; cursiva (Allison) cruzando a tela; texto com negrito e destaque; selo de perfil com a logo **RB Tech Celulares** (a mesma do ReparoSimples, em `img/logo-rbtech.jpg`); bolinhas de página; brilhos de lente, feixe de luz, quadradinhos de pixel e grão de filme. No carrossel as telas formam um painel contínuo: a imagem e a cursiva atravessam de uma tela para a outra.
- **Diretor de arte e revisor visual (Claude):** a composição de cada tela (onde fica cada texto, a imagem, a cursiva, o selo e as bolinhas, com tamanho e alinhamento) é decidida pelo Claude, que escreve a tela em SVG (`/api/arte`). O navegador desenha com as fontes e as imagens reais, e um segundo Claude olha a tela pronta e corrige sobreposições, textos cortados ou sem contraste. As telas são desenhadas em paralelo (leva de 1 a 3 minutos; deixe o app aberto). Se o diretor falhar numa tela, ela sai no molde padrão do app. Opcional: `AGENCIA_MODELO_ARTE` e `AGENCIA_ESFORCO_ARTE` (padrão `medium`).
- **Imagem de destaque (opcional, recomendada):** com `OPENAI_API_KEY` na Vercel, a Helena descreve a imagem de cada tela (o iPhone certo, de três quartos, com luz de recorte, ou um elemento do tema) e ela sai recortada, sem fundo, guardada no Blob. Custa alguns centavos de dólar por imagem, cobrados na conta da OpenAI. Sem a chave, entra um iPhone 3D desenhado pelo app. `OPENAI_IMAGEM_MODELO` (padrão `gpt-image-1`) e `OPENAI_IMAGEM_QUALIDADE` (padrão `high`) são opcionais.
- **Formatos:** post e carrossel em JPG 1080×1350; stories em 1080×1920. Reels e stories animados viram **vídeo MP4**: o texto entra deslizando, os emojis estalam, o fundo se mexe e as telas trocam com uma passagem amarela. O vídeo é gravado no próprio aparelho (Chrome ou Safari atualizados), em tempo real: não troque de tela enquanto grava.
- **No chat:** a arte aparece com as miniaturas e os botões **✅ Publicar no Instagram**, **▶ Ver animação** e **Ver em tamanho real**.
- **Publicar:** um toque em "Publicar" já publica (o app sobe as imagens ou o vídeo para o Blob e publica pela API oficial). Se na sua mensagem você pediu para publicar ("cria e publica…"), o app conta 10 segundos, com botão para cancelar, e publica sozinho. Nas rotinas automáticas a arte fica pronta, mas nada é publicado sem o seu toque.
- **Precisa:** Instagram ligado (`META_ACCESS_TOKEN` e `META_IG_USER_ID`) e o Blob da Vercel conectado ao projeto.

## 🎮 Modo jogo
Botão **🎮 Jogar** no topo. Você vira um boneco jogável (o Israel) e começa de carro na SC-281, 140 m antes da loja, no meio do trânsito.
- **Dirigir:** WASD ou setas (no celular, o joystick). Espaço é o freio de mão. Os carros da rodovia andam nas duas mãos e freiam para você.
- **Estacionar e sair:** parado, toque em **🚪 Sair do carro** (tecla E). Perto do carro aparece **🚗 Entrar no carro**.
- **Andar:** a porta automática abre quando você chega perto. Dentro do prédio você bate nos móveis e nas paredes de vidro e escorrega ao longo deles. Shift corre.
- **Elevador:** na porta do elevador aparecem os botões dos andares. Se outra pessoa estiver usando, você espera a vez.
- **Conversar:** perto de alguém, **💬 Conversar**. Perto de um chefe ou de alguém do time dele, **📋 Pedir algo**: o pedido vai para o chat daquele chefe, igual a digitar lá. A resposta aparece na tela do jogo e fica completa no chat.
- **Peter e Bibi:** **📣 Peter / 📣 Bibi** chama o cão até você (ele pega o elevador se precisar). Perto dele: **🐾 Carinho**, **🎾 Jogar bolinha** (ele busca e traz) e **🤸 Brincar**.
- **Câmera:** fica atrás de você. Arraste para girar e use a rodinha ou a pinça para aproximar.

O trânsito da SC-281 roda também fora do jogo (veja a câmera "Chegando pela SC-281").

## Central de conteúdo do Instagram (antigo Agente de Reels e Stories)
O antigo agente (repositório `agente-`) agora roda dentro do prédio. As rotinas são as mesmas, só que feitas pelos times:
- **Stories do dia:** todo dia antes das 9h, o **Especialista de crescimento** (time da Helena) entrega o roteiro dos stories do dia. Ele usa a época, os posts de ontem das lojas de referência, os prints que você subiu, os stories da RBTech e o estoque.
- **Reels da semana:** toda segunda de manhã, o **Roteirista** (time da Pamella) entrega o relatório dos reels que viralizaram nas lojas de referência, com roteiros para gravar.
- **Ideias de trend:** o especialista pesquisa na internet o que está em alta e cria 1 story, 1 reels e 1 post.
- **Prints, Reels, Configurações e Gestor:** as mesmas telas do agente, em `/conteudo/`. Abra pela aba Insta, botão "Abrir central". O login é o mesmo do prédio.
- Cada entrega aparece no chat do chefe e na aba Entregas, com o HTML. Os chefes leem a central (ferramenta `ler_central_de_conteudo`) antes de criar algo parecido.

Para economizar, cada rotina é **uma chamada só**, sem reunião do chefe. O esforço segue `AGENCIA_ESFORCO_EQUIPE`, que por padrão é `low`; use `medium` se quiser o mesmo do agente antigo.

**Migrar do agente antigo (uma vez):**
1. Copie as configurações do site antigo (lojas de referência, estoque, sobre a loja, transcrições) para a Central de conteúdo, em Configurações.
2. Use as mesmas chaves da Meta. O `IG_USER_ID` do agente aqui se chama `META_IG_USER_ID`. O token precisa de `instagram_basic`, `instagram_manage_insights` e `pages_read_engagement`.
3. Para os prints, ligue o Blob na Vercel (o mesmo das mídias do Instagram).
4. **WhatsApp (opcional):** copie para o projeto do prédio as mesmas variáveis do agente:
   - `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_DESTINATARIOS`;
   - `WHATSAPP_MODO`, `WHATSAPP_TEMPLATE`, `WHATSAPP_TEMPLATE_IDIOMA`;
   - `WHATSAPP_VERIFY_TOKEN` e `META_APP_SECRET`.

   No app da Meta, troque a URL do webhook para `https://SEU-PREDIO.vercel.app/api/conteudo?r=whatsapp`.
5. Depois disso, desligue o projeto do agente antigo na Vercel. Assim as rotinas não rodam duas vezes nem gastam em dobro.

## ReparoSimples como SaaS (3º andar)
O ReparoSimples é o SaaS principal do prédio. A aba **SaaS** e o painel do 3º andar mostram, calculados como no painel admin:
- lojas ativas, em teste, inadimplentes, expiradas e bloqueadas;
- pagantes por plano e por plataforma (Kiwify e Hotmart);
- receita mensal recorrente (em reais e, da Hotmart, na moeda dela);
- lojas novas no mês e as últimas cadastradas.

Usa as mesmas variáveis do laboratório (`REPARO_SUPABASE_URL` e `REPARO_SUPABASE_SERVICE_KEY`), porque é o mesmo banco.

- **Loja nova**: com o app aberto, ele confere a cada 5 minutos. Quando entra uma loja, o sino toca no 3º andar, aparece um aviso no chat de Vendas e SaaS e, se você ativar, chega uma notificação do navegador. Com o app fechado, o aviso aparece quando você abrir.
- **Revisão dos servidores**: 2 vezes por dia (8h41 e 20h41, cron da Vercel), sem IA. Confere o banco, o login das lojas, os pagamentos travados, os avisos da plataforma e, com `REPARO_SITE_URL` (opcional, ex.: o endereço do site do ReparoSimples), o site no ar. O resultado fica na aba SaaS e acende os LEDs do servidor no 3º andar (verde, amarelo ou vermelho). Para guardar o histórico, ligue o Redis (Upstash).
- **Equipe**: o head de vendas, o gestor de produto e o novo **Estrategista SaaS** (time da Pamella, 2º andar) leem esses números sozinhos. O estrategista pensa como vender o ReparoSimples e como alimentar o Instagram dele sem ninguém aparecer.

## Vozes e perguntas por áudio
- Botão 🎙️ no chat: você fala, o texto aparece e o **Claude Haiku** corrige nomes e pontuação antes de enviar. O Claude não ouve áudio: quem transcreve é o ElevenLabs (com a chave) ou o próprio navegador (Chrome).
- Os chefes respondem em texto e em voz. Por padrão usam a voz do navegador (grátis), com tom diferente para cada um. Com `ELEVENLABS_API_KEY` **e** a chave "Voz realista (ElevenLabs)" ligada nos Ajustes, cada funcionário tem uma voz brasileira própria (lista em `api/voz.js`); isso gasta créditos do ElevenLabs a cada resposta.
- As vozes escolhidas vêm da biblioteca do ElevenLabs: se alguma não tocar, abra a voz na Voice Library e clique em **Add to my voices**.

## Custos
Uma reunião completa custa de alguns centavos a cerca de US$ 0,50. A aba Ajustes mostra o gasto estimado das reuniões feitas no app.

Modo econômico (padrão):
- rotinas automáticas em standby (`ROTINAS_ATIVAS` liga);
- funcionários com esforço baixo e chefes com esforço médio;
- voz do navegador no lugar do ElevenLabs;
- ReparoSimples consultado uma vez por minuto.

Para gastar ainda menos, use `AGENCIA_MODELO_EQUIPE=claude-sonnet-5-5`, ou o modo ensaio para testar sem IA.
