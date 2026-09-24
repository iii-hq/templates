# ADE — estudo da primeira experiência e plano de ação

## Resumo executivo

A dificuldade não se limita aos nomes dos profiles. A primeira tela pede uma decisão sobre a arquitetura do produto antes de explicar os resultados que o usuário pode alcançar. Mistura agentes voltados a tarefas, identidades-base para herança e criação manual de agentes, enquanto um painel técnico recebe aproximadamente metade do espaço.

**Direção recomendada:** apresentar objetivos primeiro, revelar a especialização quando necessária e deixar claro o próximo passo. Não criar um tour obrigatório nem mais uma camada de configuração para começar.

## Escopo e limites

- Inspeção interativa de http://localhost:3123/: primeira tela, seleção de profile, editor manual de agente e seletor de projeto.
- Comparação com uma sessão privada: a mesma composição `chat + traces` apareceu. Isso elimina preferências locais do navegador como única explicação, mas NÃO comprova o padrão de uma instalação nova: o servidor continua sendo o mesmo e pode persistir o workspace.
- Inspeção em desktop (1280 px; também 1440 × 900) e tela estreita (390 × 844).
- Leitura de `iii/harness/template.yaml`, `worker-compose.yaml`, `README.md`, cinco profiles e referências de planejamento.
- Não foram enviadas mensagens ao modelo, salvos agentes, alteradas credenciais ou modificadas configurações do produto. O editor foi fechado sem salvar.
- Não foram testados instalação do zero, autenticação, primeira resposta do modelo, geração de um worker ou desempenho de usuários reais. Recomendações comportamentais derivam das instruções dos profiles, não de conversas executadas.
- Os textos propostos abaixo estão em português para discussão. A publicação deve seguir a política de idioma do produto; não misturar português e inglês arbitrariamente na mesma experiência.

## 1. Evidências e diagnóstico

| Evidência observada | Consequência provável para o iniciante | Prioridade |
| --- | --- | --- |
| A pergunta inicial é “What should we build in onboarding?”, seguida de quatro profiles e uma ação de criação. Não há explicação curta de iii/ADE nem objetivos exemplificados. | O usuário precisa imaginar sozinho o que a ferramenta permite construir. | P0 |
| `ADE Worker Builder` descreve entrevista, funções, triggers, configuração, Tech Lead e delegação. | A descrição explica a implementação do agente, não quando escolhê-lo. | P0 |
| `Agent Profile Creator` descreve limites, skills, funções e hierarquia. | A pessoa precisa conhecer os conceitos para decidir se precisa dessa opção. | P0 |
| `iii` e `iii-minimal` aparecem com o mesmo peso dos profiles de tarefa; um texto recomenda `extends: iii`. | Identidades de infraestrutura parecem escolhas comuns; “minimal” pode ser interpretado como opção recomendada para iniciantes. | P0 |
| Em 1280 px, dois painéis mediam 621 px cada. A lateral de conversas tinha 220 px; os cartões tinham apenas 367 px de largura. | A parte que explica como começar recebe uma fração pequena da tela. | P0 |
| As descrições dos dois primeiros cartões usam limite de três linhas. A primeira tinha 60 px visíveis para 140 px de conteúdo; a segunda, 60 para 120 px. | Informações necessárias à escolha ficam cortadas. Não é apenas um problema de redação. | P0 |
| Em 1440 × 900, a área rolável inicial terminava em y=733; o cartão `iii-minimal` ia de y=711 a 839 e a criação manual começava em y=851. | Mesmo em desktop parte do catálogo inicial depende de rolagem. | P1 |
| Clicar no Builder marcou o cartão como selecionado e mudou o cabeçalho, mas manteve a galeria e o campo genérico de mensagem. | Existe feedback de seleção, mas falta explicar o próximo passo e oferecer uma primeira mensagem. | P0 |
| `Agent Profile Creator` seleciona um agente de conversa; `Create a new agent` abre um painel Directory com nome, modelo, herança, prompt e skills. | Duas opções parecem fazer a mesma coisa, mas exigem níveis de conhecimento muito diferentes. | P0 |
| No editor manual, o catálogo tinha 46 skills neste ambiente. | O usuário sai da tarefa inicial e entra em configuração avançada cedo demais. | P1 |
| O painel de traces já mostra chamadas internas, filtros e “No traces carry this attribute yet.” antes da primeira mensagem. | O sistema parece ocupado, mas essa atividade não explica o progresso do usuário; o estado vazio pode parecer um problema. | P1 |
| A pasta aparece pelo nome no título e no composer; o seletor mostra projeto, namespace e “Add project”. | O efeito da escolha — onde o agente vai trabalhar — não está explícito no estado inicial. | P1 |
| Em 390 × 844, o chat ocupa a tela e traces fica em outro painel; os textos longos continuam cortados. | Há adaptação para celular que deve ser preservada; o principal problema de entendimento permanece. | P1 |

Essas consequências são hipóteses de usabilidade sustentadas pela inspeção, não taxas de erro medidas com usuários.

### O que já funciona e deve ser preservado

- Há um campo de mensagem disponível sem um wizard obrigatório.
- O projeto atual é visível.
- A seleção de profile tem estado visual e `aria-pressed`.
- O Tech Lead e os engenheiros do template já estão com `hidden: true`.
- A tela estreita apresenta os painéis em sequência, em vez de comprimir todos lado a lado.
- O Builder já possui planejamento, confirmação e verificação da entrega na UI. A melhoria deve tornar esse valor compreensível, não remover essas garantias.

## 2. Quick wins no template

### T1 — Nomes e descrições orientados a resultado

Alterar `name` e `description`, preservando os IDs/nomes dos arquivos, `extends`, skills, funções e delegações.

| ID estável | Nome sugerido | Descrição curta sugerida |
| --- | --- | --- |
| `ade-worker-builder` | Criar ferramenta no ADE | Use para criar workers com telas e formulários dentro do ADE. |
| `agent-profile-creator` | Criar agente personalizado | Use para criar um agente reutilizável, com instruções e habilidades para uma tarefa. |

Exemplos para o README e, depois, para a UI:

- Ferramenta no ADE: “Quero um painel de tarefas com título, responsável e status dentro do ADE.”
- Agente personalizado: “Quero um agente para revisar meus workers e sugerir testes.”

O nome visível pode mudar sem renomear `ade-worker-builder.md` ou `agent-profile-creator.md`. Renomear o arquivo mudaria o ID e criaria trabalho de migração desnecessário.

Os detalhes de orquestração continuam no corpo do profile e na documentação técnica. Não precisam estar na descrição da galeria. Não prometer criação de qualquer aplicativo: o Builder atual é especializado em workers com UI hospedada no ADE.

**Aceite:** os dois cartões comunicam resultado e uso sem exigir conhecimento de herança, funções internas ou hierarquia; a informação essencial permanece legível em 390 px e em painel estreito; IDs e comportamento permanecem compatíveis.

### T2 — README e próximos passos com uma única rota de entrada

O topo do README deve seguir esta sequência:

1. O que este template entrega: um ambiente para desenvolver com agentes e criar ferramentas integradas ao ADE.
2. Configurar um provedor de IA e iniciar o projeto pelo caminho mínimo validado.
3. Abrir a URL efetiva do ADE.
4. Escolher “Criar ferramenta no ADE” se o objetivo for criar uma tela integrada.
5. Copiar uma primeira mensagem concreta.
6. Entender o que acontece: esclarecer necessidade → confirmar plano → construir → verificar no ADE.

Mover a árvore de agentes, protocolo de estado, dependências e comandos alternativos para seções avançadas. Manter “Criar agente personalizado” como rota secundária, sem insinuar que seja um requisito para usar o sistema.

Atualizar `template.yaml` para recomendar o caminho principal, em vez de listar Builder, Tech Lead e engenheiros como escolhas equivalentes.

**Divergências a resolver antes de publicar:**

- O README diz que as cinco opções são listadas pelo seletor, mas três profiles estão ocultos.
- O README afirma que exportar chaves no shell ou usar `.env` funciona; os comentários de `worker-compose.yaml` afirmam que uma chave exportada no shell não chega ao router configurado com `env_file`. Validar o comportamento real e deixar uma instrução consistente.
- O README e o Builder citam a porta 3113, enquanto a instância inspecionada usa 3123. Isso não prova um bug de porta. Documentar como descobrir a URL efetiva e não presumir uma porta universal.
- Exemplos de containers e nomes `console`/`ade`, `shell`/`ide` e providers precisam refletir a configuração entregue.

**Aceite:** uma instalação limpa consegue seguir o caminho principal sem consultar a seção de arquitetura; tudo que os próximos passos mandam selecionar está visível.

### T3 — Primeira conversa menos técnica

Ajustar a orientação de entrada dos dois profiles:

- Explicar em uma frase o resultado que o agente ajuda a produzir.
- Fazer no máximo uma ou duas perguntas relevantes por rodada; não transformar as sete questões internas em um formulário para o usuário preencher.
- Inferir detalhes técnicos pelo projeto; perguntar pelo problema, público e comportamento desejado.
- Oferecer um exemplo quando o pedido for vago.
- Mostrar um resumo em linguagem de produto antes dos detalhes da especificação; preservar a confirmação antes de iniciar a implementação.
- No criador de profiles, inferir herança, funções e estratégia de delegação. Não exigir que iniciantes saibam responder por IDs.

**Aceite:** tarefas de exemplo executadas em sessões novas produzem uma primeira resposta útil, sem exigir jargão; nenhuma implementação começa antes da confirmação prevista pelo fluxo.

### T4 — Pequeno exemplo de primeira vitória

Documentar um exercício com escopo pequeno: painel de tarefas com criar item e mudar status, sem integração externa, credenciais adicionais ou instalação automática.

A entrega esperada deve ser explícita: uma página utilizável dentro do ADE e um resumo do que foi criado. Não prometer prazo de execução sem medição. Se o exercício virar arquivo próprio, incluí-lo em `template.yaml.files`.

**Aceite:** executar o exemplo de ponta a ponta em uma instalação limpa e observar o resultado; existência de README ou build verde não basta.

### Limite de responsabilidade do template

`iii` e `iii-minimal` não estão entre os cinco arquivos de profiles deste template: são bases fornecidas pelo sistema. Não tratar removê-las da galeria como uma simples alteração dos arquivos existentes. Priorizar a classificação no catálogo/ADE; se houver override local como mitigação, validar resolução, herança e atualização antes de adotá-lo. Não copiar grandes prompts-base para o template apenas para ocultar um cartão.

## 3. Melhorias na UI do ADE

### U1 — Entrada por objetivo, não por organograma

Estrutura sugerida, não um novo requisito de wizard:

```text
O que você quer construir?
Crie ferramentas no ADE ou agentes para trabalhar no seu projeto.

[Criar ferramenta no ADE]  Recomendado para este template
Telas e formulários integrados ao ADE.

[Criar agente personalizado]
Um agente reutilizável para uma tarefa específica.

Ou descreva o que você quer fazer: [campo de mensagem]

Ver todos os profiles · Configurar agente manualmente
Projeto: onboarding   [ver caminho / alterar]
```

- Uma recomendação contextual ao template, não um Builder obrigatório para qualquer projeto iii.
- Pergunta aberta continua disponível.
- Se houver “Não sei por onde começar”, ela precisa ter um fluxo implementado e testado. Não basta renomear `iii` para “Guia”: as instruções atuais precisariam sustentar essa promessa.
- O ADE genérico não deve depender de IDs hardcoded deste template. A curadoria pode vir de uma configuração/metadado, cuja existência precisa ser verificada; não inventar campos no YAML como se já fossem suportados.

**Aceite:** um iniciante identifica o resultado de cada opção e começa sem aprender o termo profile; quem já conhece o produto acessa o catálogo completo.

### U2 — Classificar opções e eliminar a ambiguidade da criação

- Recomendações: profiles voltados a tarefas.
- Bases técnicas: `iii` e `iii-minimal`, acessíveis em contexto avançado ou de herança.
- Perfis internos: Tech Lead e engenheiros continuam fora da galeria principal.
- Distinguir “Criar agente com ajuda” de “Configurar agente manualmente”. O editor manual não tem o mesmo destaque da rota assistida.
- Não transformar `hidden` em controle de segurança nem impedir execução/herança de um profile só porque ele saiu da galeria.

Se as bases continuarem visíveis provisoriamente, nomes como “iii — base completa (avançado)” e “iii-minimal — base mínima (avançado)” deixam clara a finalidade. Não chamar `iii-minimal` de opção para iniciantes.

**Aceite:** é possível explicar a diferença entre criar um agente por conversa e configurá-lo manualmente; os profiles-base continuam resolvendo para seus descendentes.

### U3 — Tornar explícito o próximo passo

Depois de selecionar uma opção:

- Exibir “Você vai criar uma ferramenta dentro do ADE”.
- Mostrar exemplo relevante e permitir preencher o campo com ele.
- Levar o foco ao campo quando apropriado, sem scroll inesperado.
- Manter ação clara para trocar a escolha antes do envio.
- Informar qual profile receberá a mensagem quando nenhum cartão tiver sido selecionado.
- Nunca enviar automaticamente a mensagem nem iniciar execução apenas por selecionar um cartão ou exemplo.

**Aceite:** seleção, troca, preenchimento e envio são distintos e previsíveis; teclado e leitor de tela recebem o estado selecionado e a orientação; nenhum clique exploratório consome modelo ou altera arquivos.

### U4 — Layout inicial focado na tarefa

- Para um workspace realmente novo, priorizar chat/entrada e deixar traces em “Ver atividade”.
- Traces permanece acessível; não remover a observabilidade, que é um diferencial do produto.
- Não substituir layouts personalizados de usuários existentes nem reabrir painéis fechados por eles.
- Evitar lateral de histórico dominante quando ainda não há conversas úteis.
- Resumo curto sempre visível; detalhes técnicos podem abrir sob demanda. Tooltip/hover não pode ser a única forma de entender o cartão.
- Reservar o cabeçalho técnico — modelo, contexto, estado — sem fazê-lo competir com a decisão principal.

**Aceite:** a proposta de valor, as escolhas principais e o início da ação ficam claros em 1280 × 800 e 390 × 844; testes incluem painel estreito, teclado, zoom 200% e ambos os temas. A preferência do usuário é preservada.

### U5 — Explicar contexto, prontidão e progresso

- Pasta: mostrar onde o agente trabalhará e oferecer caminho completo sob demanda; não prometer isolamento de arquivos que o runtime não garanta.
- Modelo/provedor: distinguir “serviços conectados”, “modelo selecionado” e “credenciais configuradas”. Não tratar o status `ready` como prova de uma chamada bem-sucedida ao modelo.
- Quando faltar configuração, fornecer correção contextual, não expor imediatamente um catálogo de providers.
- Durante uma tarefa, comunicar etapas compreensíveis: entender → planejar → construir → verificar. Derivar o estado de eventos reais, sem porcentagens fictícias.
- Ao terminar, oferecer “Abrir ferramenta” ou “Usar agente” conforme o resultado efetivo e mostrar onde foram salvos os artefatos.

**Aceite:** sucesso e falhas de credencial/modelo são testados; o usuário sabe onde trabalha, por que está bloqueado e onde encontrar o resultado. O progresso corresponde ao runtime.

## 4. Backlog priorizado

Estimativas relativas de escopo, não compromissos de prazo. Não foram criados tickets no kanban.

| Ordem | Entrega | Responsável sugerido | Porte | Dependência / evidência de conclusão |
| --- | --- | --- | --- | --- |
| P0.1 | T1: títulos e descrições orientados a resultado | Template + produto | Pequeno | Galeria real legível; IDs preservados |
| P0.2 | T2: README e próximos passos coerentes | Template + runtime | Pequeno | Fluxo de instalação limpa e configuração validados |
| P0.3 | U2: separar bases técnicas e criação manual | Directory + ADE | Médio | Catálogo curado sem quebrar herança ou acesso avançado |
| P0.4 | U3: exemplos e orientação após escolher | ADE | Médio | Seleção não executa; foco, troca e envio testados |
| P0.5 | U4: padrão inicial com foco no chat | ADE | Médio | Workspace novo validado; preferências antigas preservadas |
| P1.1 | T3: primeira conversa progressiva | Template + harness | Pequeno/médio | Sessões reais com pedidos vagos e objetivos |
| P1.2 | T4: primeiro exercício completo | Template + QA | Pequeno/médio | Ferramenta utilizável no ADE após instalação limpa |
| P1.3 | U1: estrutura por objetivos e curadoria configurável | Produto + ADE + Directory | Médio | Funciona neste template e em projeto sem seus IDs |
| P1.4 | U5: contexto, prontidão e fechamento da tarefa | ADE + harness/router | Médio | Caminhos de sucesso e falha observados |
| P2 | Ajuda contextual e encaminhamento por intenção | Produto + harness | A dimensionar | Só após validar se as mudanças anteriores ainda deixam dúvida |

**Primeiro pacote recomendado:** T1 + T2 + U2 + U3 + U4. Melhora entendimento, escolha e próximo passo sem começar por um redesenho completo. T1/T2 podem ser entregues primeiro, mas não eliminam sozinhos a competição visual nem a presença dos profiles-base.

## 5. Validação com novos usuários

Rodar um teste qualitativo com 5–8 desenvolvedores que nunca usaram iii, sem apresentação prévia. O CEO é um sinal importante, mas não representa sozinho todos os iniciantes.

Tarefas:

1. Após olhar a tela por 10 segundos, explicar o que o produto permite fazer.
2. Começar uma ferramenta com UI dentro do ADE.
3. Começar um agente personalizado e explicar a diferença em relação à tarefa anterior.
4. Dizer onde os arquivos serão criados e qual seria o próximo passo.
5. Encontrar a ferramenta/agente produzido ao fim de uma execução real.

Registrar: tempo até a primeira ação intencional, tempo até a primeira mensagem útil, escolhas equivocadas, pedidos de ajuda, ida acidental ao editor manual, conclusão e tempo até o primeiro resultado utilizável.

**Metas iniciais propostas, não resultados medidos:**

- Pelo menos 80% escolhem o caminho adequado sem ajuda.
- Pelo menos 80% explicam a diferença entre ferramenta e agente após 10 segundos.
- Mediana de até 60 segundos para iniciar uma solicitação relevante, com ambiente já configurado.
- Nenhuma execução disparada involuntariamente por escolha de cartão/exemplo.
- Zero regressões de herança, resolução de profiles e preferências salvas.

Fazer uma rodada com o estado atual para obter baseline e outra após as mudanças; com amostra pequena, apresentar contagens e observações, sem alegar significância estatística. Se houver instrumentação, coletar eventos mínimos de interação e sucesso, não conteúdo de prompts, caminhos locais completos ou credenciais.

## Referências locais

- `iii/harness/agents/ade-worker-builder.md`: frontmatter; First move; Interview before writing; Hand-off; Acceptance.
- `iii/harness/agents/agent-profile-creator.md`: frontmatter; Interview before drafting; The draft; Writing it.
- `iii/harness/agents/tech-lead.md`, `backend-engineer.md`, `frontend-engineer.md`: `hidden: true` e responsabilidades técnicas.
- `iii/harness/template.yaml`: lista explícita de arquivos e `next_steps`.
- `iii/harness/README.md`: autenticação, início, catálogo de profiles e hierarquia.
- `iii/harness/worker-compose.yaml`: `env_file`, providers e nomes de containers.
- `iii/harness/skills/harness/ade-worker-design/planning.md`: superfícies suportadas e critérios de aceitação.
- http://localhost:3123/: evidências visuais, árvore de acessibilidade e medições do DOM das sessões de inspeção.
