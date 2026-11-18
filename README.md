# Prédio RBTech

Um prédio 3D "blocadinho" onde cada andar tem uma equipe de IA, e toda decisão dos chefes sobe para a auditoria do Israel, no terraço.

| Andar | Chefe | Equipe |
|---|---|---|
| 1º · Loja RB TECH | **Rael** | Consultor de vendas, Compras e estoque, Pós-venda e reputação (e os clientes entrando pela rua) |
| 2º · Agência RBTech (tráfego) | **Pamella** | Analista, Copywriter, Roteirista, Revisor |
| 2º · Agência RBTech (crescimento) | **Helena** | Especialista de crescimento |
| 3º · Vendas e SaaS | Head de vendas e produtos | Prospecção (SDR), Executivo de vendas, Sucesso do cliente, Gestor de produto |
| Terraço · Diretoria | **Israel (Boss)** | audita toda decisão; tem a própria máquina de espresso |

- Cada chefe tem sala fechada de vidro com notebook. Cada andar tem copa; o terraço tem área de lazer (sofás, videogame, pebolim) e a copa do prédio.
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

## Custos
Uma reunião completa custa de alguns centavos a cerca de US$ 0,50; as 4 rotinas diárias, algo parecido cada. A aba Ajustes mostra o gasto estimado das reuniões feitas no app.
