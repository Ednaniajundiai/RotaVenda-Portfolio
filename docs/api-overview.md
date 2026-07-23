# Visão geral da API

Panorama do desenho da API do RotaVenda: como está organizada, quais invariantes
o servidor garante e quais convenções valem em toda a superfície.

A especificação OpenAPI é derivada do próprio código, em tempo de execução, e
serve como fonte autoritativa de contrato para quem opera o sistema. Este
documento cobre a **organização e o raciocínio** — o que uma especificação
gerada não expressa.

Todos os recursos vivem sob o prefixo `/api/v1`. São **107 endpoints** no total.

---

## Papéis e autorização

O sistema tem três papéis, em escopo crescente:

| Papel | Alcance |
| --- | --- |
| **VENDEDOR** | Rota do dia, vendas, pagamentos e consulta de clientes |
| **GERENTE** | Tudo do vendedor, mais catálogo, templates de rota, relatórios, exportações e cobrança |
| **ADMIN** | Tudo do gerente, mais gestão de usuários e liberação de lotes de migração |

Duas garantias estruturais:

1. **Existe uma porta única de autenticação.** Toda rota protegida passa pela
   mesma dependência, que resolve o usuário a partir do token. Não há caminho
   alternativo — contorná-la exigiria escrever um endpoint que deliberadamente
   não a declara.
2. **A autorização é sempre verificada no servidor, a cada requisição.** O
   frontend também guarda o papel em um cookie não sensível, mas ele serve
   exclusivamente para decidir o que renderizar. Nunca é base de decisão de
   acesso.

Ver [ADR 0002](adr/0002-refresh-token-cookie.md).

---

## Superfície por domínio

### Autenticação

Emissão de token de acesso, renovação a partir do cookie `httpOnly`,
encerramento de sessão e identificação do usuário corrente. O endpoint de login
é o único com limite de taxa — é o único exposto a força bruta.

### Cadastros

**Ruas** e **clientes**, com vínculo muitos-para-muitos entre eles: um cliente
pode residir em mais de uma via, cada vínculo com número e ordem de visita
próprios.

O cliente expõe ainda saldo calculado, extrato consolidado de vendas e
pagamentos, e as operações de bloqueio e desbloqueio de crédito — que são
distintas da exclusão lógica. Bloqueado, o cliente segue visível e comprando à
vista; apenas o crédito novo é negado.

### Rotas

Três recursos relacionados: **templates** (blueprints reutilizáveis), **rotas**
(instâncias de um dia, criadas por clonagem do template) e **paradas** (a
unidade de percurso, com seus próprios clientes alocados).

As operações relevantes incluem alocar e desalocar clientes em uma parada,
marcar cliente como pulado, reordenar paradas e dividir uma rua em duas
passagens. A edição estrutural é restrita a rotas ainda em rascunho — rota já
iniciada não muda de forma sob os pés de quem a executa.

Ver [ADR 0005](adr/0005-templates-imutaveis-de-rota.md) e
[ADR 0006](adr/0006-rota-por-paradas.md).

### Produtos

Catálogo com preço, unidade e estoque. O estoque **não é movimentado
automaticamente pela venda** — é ajustado pelo gestor. Decisão de negócio
consciente no momento, e registrada como dívida conhecida.

### Vendas

Invariantes garantidas pelo servidor, independentemente do que o cliente HTTP
enviar:

- **O valor total é sempre recalculado** como a soma dos subtotais dos itens
  menos o desconto. O cliente envia itens e quantidades — nunca o valor.
- **A soma das parcelas precisa bater com o total**, dentro da tolerância de um
  centavo. Diferenças de arredondamento são absorvidas na última parcela.
- **Venda a prazo para cliente bloqueado é recusada**; à vista, permitida.
- **Itens e desconto ficam travados** a partir da primeira parcela com valor
  pago. Ver [ADR 0008](adr/0008-imutabilidade-condicional-de-venda.md).
- **A criação aceita chave de idempotência.** Ver
  [ADR 0007](adr/0007-idempotencia-em-escritas-financeiras.md).

### Pagamentos

A criação aplica o valor nas parcelas em aberto **em ordem de vencimento**,
atravessando quantas forem necessárias e registrando cada alocação
individualmente. O excedente permanece como crédito do cliente, aplicável de
forma explícita em compra futura.

A edição é **de metadados apenas** — data, forma de recebimento e observação. O
valor não é editável, porque alterá-lo invalidaria as alocações já feitas; a
correção de valor se faz por estorno e relançamento. Pagamento estornado não
pode ser editado.

O estorno reverte as alocações e devolve as parcelas ao estado anterior,
deixando rastro.

### Crédito

Consulta do crédito disponível e aplicação explícita em uma venda. A distinção
entre crédito *disponível* e crédito *atribuível* importa: nem todo excedente
pode ser aplicado em qualquer venda.

### Relatórios e exportações

Resumo do período, desempenho por vendedor e série histórica. As exportações
cobrem histórico de cliente e de vendedor em CSV e PDF, além do relatório
consolidado de cobrança em planilha, com endereço e parcelas pendentes
ordenadas por vencimento — construído com consultas em lote, sem consulta por
cliente.

### Auditoria

Consulta à trilha imutável das operações sensíveis. Registros de auditoria não
são editáveis nem removíveis por nenhum caminho da API.

### Migração do acervo

Recursos de apoio ao levantamento em papel: lotes, folhas e registros
transcritos, com o fluxo de revisão e liberação descrito em
[ARCHITECTURE.md](../ARCHITECTURE.md#5--migração-do-acervo-em-papel). Um lote
nasce oculto e só se torna visível ao vendedor após aprovação explícita.

---

## Convenções gerais

| Aspecto | Convenção |
| --- | --- |
| **Códigos de status** | `200` leitura · `201` criação · `204` remoção sem corpo · `400` violação de regra de negócio · `401` não autenticado · `403` sem permissão · `404` não encontrado · `422` falha de validação de schema |
| **Identificadores** | UUID em todas as entidades |
| **Datas** | Data de venda, pagamento e vencimento são datas puras, sem hora — evita a classe de erro em que um registro salta de dia por conversão de fuso |
| **Timestamps** | Criação e atualização em UTC, serializados em ISO 8601 |
| **Valores monetários** | Decimais de precisão fixa no banco; serializados em JSON como número |
| **Telefones** | Armazenados como dígitos puros, normalizados e validados em um único ponto |
| **Exclusão** | Lógica nas entidades principais. Registros inativos somem das listagens. Ver [ADR 0004](adr/0004-soft-delete-via-is-active.md) |
| **Idempotência** | Disponível na criação de venda e de pagamento, via cabeçalho dedicado |

---

## Distinção que vale registrar

Três conceitos são frequentemente confundidos e, aqui, são deliberadamente
separados — cada um com sua própria coluna e semântica:

- **Inativo** — exclusão lógica. O registro desaparece das listagens.
- **Bloqueado** — o cliente continua plenamente visível e operante à vista;
  apenas crédito novo é negado.
- **Oculto** — aplicável a lotes da migração. O dado existe e está íntegro, mas
  aguarda aprovação do gestor antes de chegar ao vendedor.

Tratar os três com um único sinalizador foi um erro cometido cedo e corrigido:
cada um responde a uma pergunta diferente do negócio.
