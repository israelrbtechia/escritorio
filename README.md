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
| `ELEVENLABS_API_KEY` | opcional: vozes reais para cada funcionário e transcrição das perguntas por áudio |
| `ELEVENLABS_VOZES` | opcional: troca vozes, em JSON (ex.: `{"chefe":"id-da-voz"}`) |

3. **Storage → Marketplace → Upstash (Redis)** → conecte ao projeto. Ele cria `KV_REST_API_URL` e `KV_REST_API_TOKEN` sozinho. É onde ficam guardados os relatórios das rotinas e as decisões auditadas.
4. **Deployments → Redeploy** para as variáveis valerem.

Sem `AGENCIA_USUARIO` e `AGENCIA_SENHA`, o site fica aberto: qualquer pessoa com o link gasta seus créditos. Trocar a senha encerra todos os logins.

### Token da Meta
1. Em business.facebook.com → **Configurações do negócio → Usuários do sistema**, crie um usuário do sistema (administrador).
2. Dê a ele acesso à **conta de anúncios** e à **conta do Instagram** da RBTech.
3. **Gerar token** com as permissões: `ads_read`, `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `business_management`. Escolha validade "nunca expira".
4. O id do Instagram aparece em **Configurações do negócio → Contas do Instagram**, ou pela Graph API em `/{id-da-página}?fields=instagram_business_account`.

A equipe só **lê** métricas: não publica, não edita posts e não mexe em orçamento.

### Rotinas (vercel.json)
| Horário (Brasília) | Andar |
|---|---|
| 08:07 | Loja |
| 08:17 | Tráfego |
| 09:27 | Crescimento |
| 09:37 | Vendas e SaaS |

No plano Hobby da Vercel, cada rotina roda uma vez por dia, e o horário pode variar dentro da hora.

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

## Vozes e perguntas por áudio
- Botão 🎙️ no chat: você fala, o texto aparece e o **Claude Haiku** corrige nomes e pontuação antes de enviar. O Claude não ouve áudio: quem transcreve é o ElevenLabs (com a chave) ou o próprio navegador (Chrome).
- Os chefes respondem em texto e em voz. Com `ELEVENLABS_API_KEY`, cada funcionário tem uma voz brasileira própria (lista em `api/voz.js`); sem ela, o app usa a voz do navegador com tom diferente para cada um.
- As vozes escolhidas vêm da biblioteca do ElevenLabs: se alguma não tocar, abra a voz na Voice Library e clique em **Add to my voices**.

## Custos
Uma reunião completa custa de alguns centavos a cerca de US$ 0,50; as 4 rotinas diárias, algo parecido cada. A aba Ajustes mostra o gasto estimado das reuniões feitas no app.
