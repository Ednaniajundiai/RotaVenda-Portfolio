<div align="center">

# RotaVenda

**Plataforma de gestão de vendas, rota e crédito da D'Lucri**

Digitalizou o controle de crédito a prazo de uma operação de distribuição
com dois canais de venda, substituindo cadernos manuscritos por saldo
auditável, rota guiada e cobrança rastreada.

**Em produção desde julho de 2026.**

![Status](https://img.shields.io/badge/status-em%20produção-2E7D4F?style=flat-square)
![Backend](https://img.shields.io/badge/FastAPI-Python%203.11-14537D?style=flat-square)
![Frontend](https://img.shields.io/badge/Next.js%2015-TypeScript-14537D?style=flat-square)
![Banco](https://img.shields.io/badge/PostgreSQL-16-14537D?style=flat-square)
![Licença](https://img.shields.io/badge/licença-MIT-8A94A0?style=flat-square)

</div>

> **Sobre este repositório.** Esta é a vitrine técnica do RotaVenda — arquitetura,
> decisões de projeto e resultados de um sistema em operação real. O código-fonte
> é mantido em repositório privado por conter dados cadastrais e financeiros de
> clientes. A leitura técnica aprofundada está em **[ARCHITECTURE.md](ARCHITECTURE.md)**;
> as decisões formais, em **[docs/adr/](docs/adr/)**.
>
> Disponibilizo acesso ao código mediante solicitação, em processos seletivos.

---

## O problema

A D'Lucri distribui produtos de limpeza por dois canais: **rota externa**, com
vendedores percorrendo bairros a pé, e **venda direta no balcão**. A maior parte
do faturamento é a prazo — o crédito informal conhecido como "fiado" — e esse
crédito era controlado em cadernos manuscritos, um por bairro.

O modelo tinha quatro falhas estruturais:

| Falha | Consequência operacional |
| --- | --- |
| Saldo recalculado à mão a cada visita | Divergência entre caderno e realidade; perda silenciosa de receita |
| Histórico preso ao papel | Vendedor em campo sem saber o que o cliente devia ou já havia pago |
| Ausência de visão consolidada | Impossível dimensionar a inadimplência total ou priorizar cobrança |
| Caderno como ponto único de falha | Perda, chuva ou rasura destruía o registro de crédito |

Duas restrições moldaram o projeto: o sistema precisava funcionar **em tablet,
na rua, com uma mão** — e precisava **absorver o acervo de papel acumulado**,
sem perder um único registro de dívida.

---

## Números

<div align="center">

| Migração do acervo | Escala do sistema |
| :--- | :--- |
| **160** folhas de caderno digitalizadas | **107** endpoints de API |
| **680** registros de crédito migrados | **22** tabelas modeladas |
| **4** bairros mapeados e roteirizados | **27** migrations reversíveis |
| **~R$ 31 mil**¹ em crédito reconciliado | **31** suítes de teste automatizado |

</div>

<sub>¹ Saldo pendente consolidado nos três levantamentos com total fechado na
origem (Almerinda, Varjão 1 e Varjão 2). O quarto bairro foi migrado por ordem
de rota, sem consolidação de saldo no caderno original.</sub>

**A migração foi um projeto em si.** Não houve carga em massa: cada folha foi
fotografada, transcrita, validada contra o saldo declarado e só então promovida
para produção — através de um fluxo em que o gestor aprova lote a lote antes de
o dado ficar visível ao vendedor. Rasuras, nomes apagados e valores ambíguos
foram tratados como casos de negócio explícitos, com regra de resolução
documentada, e não como falha de importação.

---

## Capacidades

<table>
<tr><td width="50%" valign="top">

**Crédito e cobrança**

- Parcelamento com baixa automática **FIFO** por vencimento — um pagamento
  atravessa várias parcelas em uma única transação
- Saldo **calculado em tempo de execução**, jamais armazenado
- Crédito a favor do cliente quando o pagamento excede a dívida, com
  aplicação explícita e rastreável
- Estorno que reverte a alocação nas parcelas preservando o histórico
- Relatório consolidado de cobrança em XLSX
- Recibo e régua de cobrança via WhatsApp

</td><td width="50%" valign="top">

**Operação de rota**

- Rota modelada como **sequência de paradas**, não como lista de ruas:
  a mesma via pode ser percorrida na ida e na volta, com clientes
  distintos em cada passagem
- Execução guiada, uma parada por vez, com avanço automático
- Templates reutilizáveis, clonados a cada dia de trabalho
- Múltiplas rotas por vendedor no mesmo dia
- Visão consolidada parada → rua → cliente para o gestor

</td></tr>
<tr><td width="50%" valign="top">

**Venda e catálogo**

- Wizard de três passos — cliente, produtos, pagamento — compartilhado
  entre balcão e rua
- Total sempre derivado dos itens no servidor; o cliente nunca envia valor
- Edição com trava condicional quando já existe parcela paga
- Bloqueio de crédito por cliente, independente da exclusão lógica
- Venda a consumidor avulso, sem cadastro

</td><td width="50%" valign="top">

**Governança**

- Três papéis com escopos distintos: ADMIN, GERENTE e VENDEDOR
- Trilha de auditoria imutável das operações sensíveis
- Idempotência em criação de venda e pagamento
- Exportações em CSV, PDF e XLSX por cliente e por vendedor
- Rotina de backup e restauração documentada

</td></tr>
</table>

---

## Stack

| Camada | Tecnologia | Justificativa |
| --- | --- | --- |
| API | FastAPI · Python 3.11 | Validação declarativa via Pydantic; OpenAPI derivado do próprio código |
| Persistência | SQLAlchemy · Alembic · PostgreSQL 16 | Migrations versionadas e reversíveis; integridade transacional no crédito |
| Interface | Next.js 15 (App Router) · TypeScript · Tailwind | Renderização híbrida e tipagem ponta a ponta |
| Estado remoto | TanStack Query v5 | Cache e invalidação explícita; nenhum estado de servidor em `useState` |
| Formulários | react-hook-form · Zod | Mesmo schema de validação no formulário e no contrato da API |
| Documentos | reportlab · openpyxl | Geração de PDF e planilha no servidor |
| Infraestrutura | Docker Compose · EasyPanel | Paridade entre desenvolvimento e produção |

---

## Decisões técnicas

As cinco decisões abaixo foram as que mais moldaram o sistema. O raciocínio
completo — incluindo o que foi sacrificado em cada uma — está em
**[ARCHITECTURE.md](ARCHITECTURE.md)** e nos [ADRs](docs/adr/).

### 1 · O saldo do cliente nunca é armazenado

Não existe coluna `saldo` na tabela de clientes. O valor é derivado a cada
leitura como `débito − crédito`, a partir das parcelas em aberto e dos
pagamentos ainda não alocados.

**Motivação.** Saldo materializado é a origem clássica de divergência: qualquer
caminho de escrita que esqueça de atualizá-lo — um estorno, uma edição de venda,
uma correção manual — corrompe o número de forma permanente e silenciosa. Em um
sistema cuja proposta de valor é ser mais confiável que um caderno, essa classe
de defeito inviabiliza o produto.

**Custo aceito.** Cada leitura paga o preço de uma agregação. Mitigado com
cálculo em lote nas listagens e uma única implementação canônica da fórmula, à
qual todos os demais serviços delegam — a duplicação dessa regra em quatro
pontos foi, inclusive, uma dívida técnica identificada e paga.

### 2 · Baixa de pagamento em FIFO por vencimento

Um pagamento não pertence a uma parcela. Ele é consumido pelas parcelas em
aberto na ordem de vencimento, atravessando quantas forem necessárias, através
de uma tabela de ligação que registra quanto de cada pagamento foi para cada
parcela.

**Motivação.** É como a cobrança funciona na prática: o cliente paga "o que dá"
e o valor abate a dívida mais antiga. Modelar de outra forma obrigaria o
vendedor a fazer a conta na rua — exatamente o erro que o sistema veio eliminar.

**Consequência de projeto.** A alocação passa a ser o registro auditável. O
estorno não apaga nada: reverte as alocações e devolve as parcelas ao estado
anterior, deixando rastro.

### 3 · Imutabilidade condicional na edição de venda

Uma venda é corrigível livremente enquanto ninguém pagou nada. A partir da
primeira parcela com valor pago, itens e desconto ficam travados.

**Motivação.** Alterar o total de uma venda que já recebeu pagamento invalida
retroativamente as alocações FIFO. A regra converte um defeito silencioso de
consistência em uma mensagem clara na interface, com caminho alternativo
explícito: estornar e relançar.

### 4 · Idempotência na criação de venda e pagamento

Os endpoints de criação aceitam uma chave de idempotência. A mesma chave retorna
o recurso já criado, sem duplicar.

**Motivação.** O vendedor opera sob rede móvel instável. Sem essa garantia, um
timeout seguido de nova tentativa gera uma venda fantasma no crédito de uma
pessoa real — e o erro só apareceria no fechamento do mês, sem rastro da causa.

### 5 · Autenticação em duas camadas

Token de acesso de vida curta no navegador; token de renovação em cookie
`httpOnly`, inacessível a JavaScript. A autorização efetiva é verificada no
servidor a cada requisição.

**Motivação.** Defesa em profundidade — um XSS não captura o token de renovação.
O roteamento no cliente usa um cookie de papel separado e não sensível,
empregado apenas para decidir o que renderizar, nunca como base de autorização.

---

## Engenharia do processo

**Spec-Driven Development.** Vinte e uma especificações formais precedem a
implementação, cada uma com requisitos numerados, plano técnico e lista de
tarefas derivada. O código serve à especificação — o que preserva
rastreabilidade entre uma decisão de negócio e as linhas que a implementam.

**Integração contínua.** Todo push executa, contra um PostgreSQL efêmero:
verificação de formatação, aplicação completa das migrations e a suíte de testes
com cobertura. No frontend, lint e build de produção.

**Testes com isolamento transacional.** Cada teste roda dentro de uma transação
revertida ao final, via savepoints. Sem banco dedicado, sem seed, sem limpeza
entre casos — e sem o custo de recriar o schema a cada execução.

**Migrations reversíveis.** Todas as 27 migrations implementam o caminho de
volta. Em um sistema que carrega crédito real de centenas de pessoas, reverter
não é um luxo.

**Disciplina de versionamento.** Conventional Commits em escopos definidos,
nenhum commit direto na branch principal, todo trabalho via Pull Request.

---

## Interface

O sistema foi desenhado para uso em campo antes de ser desenhado para desktop.

- Alvos de toque de no mínimo 44px em toda a interface móvel
- Cores com significado fixo, nunca decorativo: âmbar para dívida em aberto,
  verde para quitado e crédito, vermelho para bloqueio
- Densidade calibrada para leitura sob sol, em pé, com o tablet em uma mão
- Layout mestre-detalhe a partir do breakpoint largo, aproveitando a tela do
  gestor sem penalizar o vendedor

<!-- TODO: inserir capturas de tela em docs/screenshots/ e referenciá-las aqui.
     Sugestão de três imagens, nesta ordem:
       1. Execução de rota — parada atual com lista de clientes
       2. Wizard de venda — passo de produtos
       3. Extrato do cliente — saldo, parcelas e histórico
-->

---

## Licença

[MIT](LICENSE) — aplicável ao conteúdo documental deste repositório.

---

<div align="center">

**Ednan Ferreira** — arquitetura e desenvolvimento

</div>
