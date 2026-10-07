# Gerador de relatórios financeiros · TUNADÃO 1998

Análise de viabilidade, decisão e especificação para um agente de desenvolvimento.
Data: 07/10/2026

---

## 1. Decisão

**GO, com âmbito fechado:**

| Componente | Decisão | Porquê |
|---|---|---|
| Entrada **XLSX** (exportação da folha Tesouraria) | **GO** (entrada principal) | Mantém os tipos (datas, números), traz todas as abas num ficheiro e o formato é controlado por nós |
| Entrada **CSV** (uma por tabela, ou extrato do banco) | **GO** | Simples, universal; exige cuidado com o locale pt-PT |
| Entrada **PDF** com tabela | **NO-GO na v1** | Extração de tabelas de PDF é heurística e frágil (ver 5.3). Fica para uma v2, só com um adaptador por formato conhecido e ficheiros de teste reais |
| **Página web estática** (tudo no browser) | **GO** (entrega principal) | Zero instalação para quem vier nas próximas direções, os dados não saem do computador, alojamento gratuito |
| **Script de linha de comandos** | **GO** (secundário) | Mesmo motor e mesmos modelos; serve para testes automáticos e para quem preferir terminal |
| Motor de composição | **Typst** (modelos `.typ`) | Tabelas com cabeçalho repetido por defeito, paginação determinística, tipografia de qualidade, lê dados (CSV/JSON) nativamente, compila no browser via WebAssembly |

**Resumo:** o problema que tivemos com Slides e Sheets (design limitado, ligações que não sobrevivem a cópias, paginação incontrolável) desaparece quando o documento é *gerado* a partir dos dados, em vez de *ligado* a eles. Cada relatório passa a ser um PDF autónomo e congelado, e o modelo é código versionado.

---

## 2. O que muda em relação ao que tentámos

| Problema encontrado | Slides + Sheets | Aba de Sheets para impressão | Gerador (Typst) |
|---|---|---|---|
| Design bonito e controlado | Limitado (scorecards feios, caixas) | Preso à grelha de células | Total: tipografia, margens, cores, logo |
| Gráficos alimentados pela tabela | Ligação manual, falha em cópias | Sim, mas visual pobre | Sim: tabela e gráfico vêm dos mesmos dados no mesmo processo |
| Cada relatório com os seus dados | Cópias ficam ligadas à folha original | Sim (cópia da folha) | Sim: cada PDF é um retrato dos dados que lhe deram origem |
| Tabelas longas (80+ movimentos) | Não pagina | Pagina, quebras imprevisíveis | Pagina com cabeçalho repetido, quebras controladas |
| Passos manuais | Muitos | Definições de impressão a cada exportação | Carregar ficheiro, escolher relatório, descarregar PDF |
| Apps Script | Necessário para automatizar | Não | Não |

---

## 3. Viabilidade

### 3.1 Técnica

Todas as peças críticas existem e são maduras:

- **Typst** está na versão 0.15 (junho de 2026) [5]. `table.header` e `table.footer` repetem-se em todas as páginas por defeito [1].
- `csv()` e `json()` aceitam bytes, e `csv()` tem delimitador configurável (útil para `;`) [2]. Os dados podem ir para o modelo como ficheiro JSON normalizado, sem lógica de parsing no Typst.
- **typst.ts** compila para PDF no browser (`$typst.pdf({ mainContent })`), com `addSource`/`mapShadow` para injetar o modelo, os dados e as imagens, e com fontes pré-carregadas (`preloadFontData`) [3]. Licença Apache 2.0 [4].
- Alternativa: **typst-wasm**, publicado em julho de 2026, com API em promessas para browser, Node e serverless [6]. O anúncio mostra saída SVG e é recente; tratar como plano B.
- **Gráficos:** o Lilaq 0.6.0 (março de 2026, MIT, Typst ≥ 0.13) faz gráficos de barras, linhas e outros [7]. Para as barras de composição (100 % empilhadas) e orçado vs realizado, desenhar com primitivas Typst (`rect` em `grid`) é simples e dá controlo total.
- **XLSX no browser:** SheetJS Community Edition 0.20.3, a instalar a partir da CDN oficial ou alojado no próprio site (a versão no registo npm está desatualizada) [8].
- **CLI:** o Typst CLI (`typst compile`) ou o pacote Python `typst` 0.15.0, com `sys_inputs` e saída em bytes [9]. Recomenda-se um CLI em Node que reutilize o mesmo código TypeScript do browser, para haver um único conversor de dados.

**Veredicto: viável.** O risco técnico concentra-se no tamanho do WASM, na versão do typst.ts e no parsing de dados, não na composição (ver secção 6).

### 3.2 Organizacional

- A tuna muda de direção com frequência. A página web tem de funcionar sem conhecimentos técnicos, e o modelo tem de ser alterável por alguém com noções básicas, seguindo um README.
- A parte difícil não é gerar o PDF: é **ter os movimentos bem classificados** (rubrica, atividade, meio). O gerador tem de validar e explicar os erros, não esconder lixo num PDF bonito.

### 3.3 Custos

- Alojamento: 0 €. Opções na UE: Codeberg Pages (Alemanha, sem fins lucrativos, repositórios públicos FLOSS) ou statichost.eu (infraestrutura europeia, recolha mínima de dados) [10].
- Domínio próprio: opcional.
- Manutenção: estimativa de baixa frequência (ajustar rubricas uma vez por ano, mudar a direção nos cabeçalhos).

---

## 4. Requisitos

### 4.1 Funcionais

**RF1. Entradas aceites**
- (a) `.xlsx` exportado da folha Tesouraria (abas `Movimentos`, `Pendentes`, `Orçamento`, `Géneros`, `Listas`).
- (b) Conjunto de `.csv` com os mesmos esquemas (um ficheiro por aba).
- (c) CSV genérico (ex.: extrato do banco), com um ecrã de mapeamento de colunas que pode ser guardado como perfil.

**RF2. Esquemas de entrada** (os atuais da folha Tesouraria):

`Movimentos`: `Data | N.º doc | Descrição | Atividade | Rubrica | Tipo (Entrada/Saída) | Meio (Caixa/Banco/MB Way/TPA) | Valor (€) | Conta | Valor com sinal (€) | Conta para o resultado (Sim/Não)`
- `Conta` deriva de `Meio` via `Listas` (MB Way e TPA → Banco).
- Rubricas especiais fora do resultado: `Saldo inicial`, `Transferências internas`.

`Pendentes`: `Tipo (A receber/A pagar) | Entidade | Descrição | Atividade | Valor (€) | Data de registo | Data de liquidação | Notas`

`Orçamento`: `Âmbito | Tipo | Rubrica | Orçado (€)` (âmbito = atividade ou período, ex.: "20º CITADÃO", "2026")

`Géneros`: `Atividade | Tipo | Quantidade | Em falta`

`Listas`: rubricas de entrada, rubricas de saída, atividades, meio → conta.

**RF3. Normalização** para um JSON canónico (ver 7.3) com datas ISO, valores em cêntimos (inteiros) e sinal coerente com o tipo.

**RF4. Validação, antes de gerar**, com relatório de erros legível (linha, coluna, problema, sugestão):
- datas inválidas ou fora do período;
- valor vazio ou não numérico;
- rubrica, atividade ou meio fora das `Listas`;
- tipo incoerente com o sinal;
- duplicados prováveis (mesma data, valor e descrição);
- saldo de caixa ou banco negativo em algum dia (aviso);
- soma das partes ≠ total;
- pendentes liquidados sem data.
- Distinguir **erros** (bloqueiam) de **avisos** (permitem gerar, mas aparecem no relatório de validação).

**RF5. Quatro tipos de relatório**, cada um com parâmetros:

| Relatório | Parâmetros | Conteúdo mínimo |
|---|---|---|
| Pegada de direção | data do último relatório, data da passagem, código, nomes da direção cessante e entrante, saldo do extrato bancário | resumo (saldo inicial, recebido, pago, saldo final), composição caixa / banco / a receber / dívidas, reconciliação banco vs extrato, contagem de caixa, pendentes, lista de movimentos (anexo), 3 linhas de assinaturas (cessante / entrante / conselho fiscal) |
| Fim de ano fiscal | ano civil, âmbito do orçamento, código | resumo, orçado vs realizado por rubrica (entradas e saídas), por atividade, pendentes a 31/12, lista de movimentos (anexo), mapa de recebimentos e pagamentos no formato ESNL (opcional) |
| Fim de ano letivo | início e fim do período, âmbito do orçamento, código | como o fiscal, mais a comparação com o período homólogo anterior (rubricas e totais) |
| Relatório de evento | atividade, âmbito do orçamento, data de referência dos pendentes, código | sumário no topo (recebido, pago, resultado, por receber, por pagar, resultado previsto), composição do recebido e do pago, orçado vs realizado, pendentes do evento, géneros, notas, assinaturas |

**RF6. Gráficos gerados dos mesmos dados das tabelas:** composição 100 % empilhada, orçado vs realizado em barras horizontais, gastos por atividade, comparação de anos em colunas. Nunca imagens coladas.

**RF7. Saída:** PDF A4 vertical, com cabeçalho (logo, nome, código do documento, período) e rodapé ("Página X de N") em todas as páginas. Tabelas longas partem com o cabeçalho repetido. Anexo de movimentos no fim, com subtotal por página (opcional).

**RF8. Rastreabilidade:** o PDF inclui, num rodapé discreto ou na última página, a data de geração, o hash SHA-256 do ficheiro de entrada e a versão do gerador. Idealmente, anexa o JSON normalizado ao PDF (anexos PDF do Typst; confirmar a função na versão usada), o que permite auditar o relatório mais tarde.

**RF9. Pré-visualização** no browser antes de descarregar (SVG ou PDF embutido).

**RF10. Narrativa:** campos de texto livre na página ("Notas da organização", "Destaques") que entram no PDF. Opcional: carregar um `.md` simples.

**RF11. CLI:** `gerar-relatorio --tipo evento --entrada tesouraria.xlsx --param atividade="20º CITADÃO" --saida relatorio.pdf`, com o mesmo resultado byte a byte que a página (salvo a data de geração).

### 4.2 Não funcionais

- **RNF1. Privacidade:** processamento 100 % local no browser. Sem backend, sem analytics, sem chamadas de rede depois do carregamento (fontes, pacotes Typst e logo empacotados). CSP restritiva.
- **RNF2. Funcionar offline** depois da primeira visita (service worker opcional).
- **RNF3. Desempenho:** primeiro carregamento abaixo de ~15 s em rede normal; geração abaixo de 5 s para 500 movimentos.
- **RNF4. Compatibilidade:** Chrome, Firefox e Safari recentes (desktop). Telemóvel não é requisito.
- **RNF5. Locale pt-PT:** números `1 234,56 €`, datas `dd/mm/aaaa`, ortografia pós-acordo.
- **RNF6. Manutenção:** configuração (rubricas, cores, nomes, cargos das assinaturas) num único `config.json` ou `config.typ`. README com "como mudar o logo / rubricas / cores".
- **RNF7. Testes:** fixtures com os dados de exemplo atuais (2025 e 2026, CITADÃO, 80+ movimentos). Testes de regressão visual (PDF → PNG, comparação) e testes unitários do parsing.
- **RNF8. Licenças compatíveis:** Typst (Apache 2.0), typst.ts (Apache 2.0), SheetJS CE (Apache 2.0), Lilaq (MIT), fontes Lato e Carter One (SIL OFL, permitem embutir).

---

## 5. Necessidades (o que é preciso ter antes de começar)

1. **Dados reais de teste:** exportação `.xlsx` da Tesouraria (já existe com dados realistas), mais 1 ou 2 extratos CSV do banco da tuna, se se quiser o modo extrato.
2. **Identidade visual:** logo em SVG (preferível) ou PNG em alta resolução, Carter One e Lato (ou outra fonte de corpo), cores (navy `#1D2F6F` e acentos vermelho e dourado do logo).
3. **Decisões de conteúdo** (já tomadas nesta conversa, ver RF5): modelos por relatório, gráficos pretendidos, assinaturas.
4. **Repositório git** e conta num alojamento estático (Codeberg ou outro).
5. **Uma pessoa responsável** na tuna pela "folha de estilo" e pelas rubricas (meia página de README chega).

---

## 6. Potenciais problemas e mitigação

### 6.1 Motor e browser

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| typst.ts atrasado face ao Typst (funções novas indisponíveis) | Média | Médio | Fixar versões; usar só funções estáveis (tabelas, grid, rect, csv/json); CI que compila os modelos com o Typst CLI **e** com o typst.ts |
| Pacote WASM grande (compilador + fontes) | Alta | Baixo/médio | Carregamento preguiçoso, cache do service worker, só as fontes necessárias, ecrã de "a preparar" |
| Pacotes Typst (Lilaq) descarregados da rede | Média | Médio | Copiar os pacotes para o repositório; desativar o registo remoto; preferir desenho nativo nos gráficos simples |
| Projeto typst.ts depende de poucos mantenedores | Média | Alto a prazo | Abstrair o motor atrás de uma interface `render(template, data) → pdf`; plano B: typst-wasm, ou Pyodide com o wheel `typst` (há wheels PyEmscripten [9]) |
| Diferenças de renderização entre browsers | Baixa | Baixo | O Typst gera o PDF por si; não depende do motor de impressão do browser (ao contrário de HTML + print) |

### 6.2 Dados

| Risco | Mitigação |
|---|---|
| CSV em pt-PT: `;` como separador, vírgula decimal, `€` e espaço de milhares no valor, encoding Windows-1252 vs UTF-8 com BOM | Deteção automática de delimitador e encoding, parser de números tolerante (`1 234,56 €`, `-1.234,56`, `(1 234,56)`), com testes por caso |
| CSV exportado do Google Sheets pode levar valores formatados como estão no ecrã | Preferir XLSX (tipos preservados); testar a exportação CSV real e documentar |
| Datas ambíguas (`03/04/2026`) | Assumir `dd/mm/aaaa`; avisar quando o dia é > 12 numa coluna dita mm/dd; aceitar números de série do Excel |
| Rubricas escritas de forma diferente ("Licenças, seguros e segurança" vs "Licencas…") | Normalização (minúsculas, sem acentos) e sugestão do item mais próximo da lista, mas nunca corrigir sem avisar |
| Movimentos sem atividade ou rubrica | Erro bloqueante, com lista das linhas |
| Saldos iniciais em falta ou duplicados | Validação específica: exatamente um saldo inicial por conta no início do período, ou cálculo a partir do histórico |
| Transferências caixa ↔ banco contadas como receita ou despesa | Rubrica `Transferências internas` com conta para o resultado = Não; validar que as duas pernas somam 0 |

### 6.3 Entrada PDF (porque fica para depois)

- Um PDF não tem tabelas, tem texto posicionado. A extração infere linhas e colunas pelas coordenadas, o que falha com descrições em várias linhas, colunas desalinhadas, cabeçalhos repetidos por página e totais intercalados.
- As bibliotecas JS para isto são poucas e imaturas: por exemplo, a pdftables-ts só corre em Node e não tem adoção visível [11]. As abordagens com pdf.js exigem heurísticas próprias [12].
- PDFs digitalizados precisam de OCR, que é outro problema.
- **Recomendação:** na v1, se alguém tiver só um PDF, a página diz como obter CSV ou Excel (homebanking ou a própria folha). Na v2, se houver um PDF recorrente (ex.: o extrato do banco da tuna), criar **um adaptador específico desse formato**, com 3 a 5 PDFs reais como fixtures. Pode ser em JS (pdf.js) ou em Python via Pyodide (pdfplumber).

### 6.4 Organização

| Risco | Mitigação |
|---|---|
| Ninguém sabe mexer no modelo daqui a 2 anos | Configuração separada do código; README curto; modelos simples e comentados |
| Dados continuam desorganizados na origem | O validador funciona como "auditor": o relatório só sai limpo quando os dados estão limpos |
| Expectativa de editar o PDF depois | Campos de narrativa na página; para correções de números, corrigir os dados e gerar de novo (é a forma certa) |

---

## 7. Arquitetura recomendada

### 7.1 Visão geral

```
[ficheiro .xlsx / .csv]
        │  (browser: SheetJS / PapaParse; CLI: as mesmas libs em Node)
        ▼
[parser + mapeamento de colunas]  →  [normalizador]  →  data.json (canónico)
        │                                   │
        │                           [validador] → relatório de erros/avisos (UI)
        ▼
[calculador] → report-<tipo>.json (totais, agregados, séries dos gráficos, tabelas)
        ▼
[motor Typst] (browser: typst.ts WASM; CLI: typst CLI ou typst.ts node)
   templates/<tipo>.typ + lib/*.typ + config + fontes + logo
        ▼
[PDF] → pré-visualização + download
```

**Princípio central:** o Typst recebe dados **já calculados** (`report.json`). Todos os cálculos financeiros vivem em TypeScript, testados unitariamente. O Typst só faz layout. Assim os números ficam testáveis e os modelos ficam simples.

### 7.2 Stack

- TypeScript, com Vite para o build da página estática.
- SheetJS CE 0.20.x (vendorizado), PapaParse para CSV.
- typst.ts (versão fixada) no browser; Typst CLI no CI e no CLI.
- Vitest para unidades; regressão visual com `pdftoppm` + pixelmatch no CI.
- Alojamento: Codeberg Pages ou statichost.eu; repositório no Codeberg (ou no GitHub, se a tuna preferir).

### 7.3 Esquema canónico (resumo)

```json
{
  "meta": {"org": "TUNADÃO 1998", "generatedAt": "ISO", "sourceSha256": "…", "generatorVersion": "x.y.z"},
  "lists": {"rubricasEntrada": [], "rubricasSaida": [], "atividades": [], "meioConta": {"MB Way": "Banco"}},
  "movimentos": [{"data": "2026-04-30", "doc": "E26-041", "descricao": "…", "atividade": "20º CITADÃO",
                  "rubrica": "Bar e bilheteira", "tipo": "Entrada", "meio": "TPA", "conta": "Banco",
                  "valorCents": 125000, "contaResultado": true, "linhaOrigem": 214}],
  "pendentes": [{"tipo": "A receber", "entidade": "…", "descricao": "…", "atividade": "…", "valorCents": 0,
                 "dataRegisto": "…", "dataLiquidacao": null}],
  "orcamento": [{"ambito": "20º CITADÃO", "tipo": "Entrada", "rubrica": "Patrocínios", "orcadoCents": 450000}],
  "generos": [{"atividade": "…", "tipo": "Barris", "quantidade": 10, "emFalta": 0}]
}
```

`report-<tipo>.json` contém: parâmetros, KPIs, tabelas já ordenadas (linhas e totais), séries dos gráficos, pendentes filtrados, movimentos do anexo e textos narrativos.

### 7.4 Regras de cálculo (as mesmas das abas Rel_* atuais)

- Saldo de uma conta numa data = soma de `valorCents` com sinal até essa data, incluindo saldos iniciais e transferências internas.
- Recebido / pago num período = soma de entradas / saídas com `contaResultado = true` e data no período.
- Pendentes numa data de referência: `dataRegisto ≤ ref` e (`dataLiquidacao` vazia ou `> ref`).
- Evento: movimentos com `atividade = X`, sem limite de datas salvo o parâmetro "contar até".
- Execução = realizado / orçado (vazio se orçado = 0). Desvio = realizado − orçado.
- Período homólogo (letivo): mesmas datas, 12 meses antes.
- Resultado previsto (evento) = resultado + por receber − por pagar.

---

## 8. Prós e contras das alternativas consideradas

| Opção | Prós | Contras | Veredicto |
|---|---|---|---|
| **Typst + página estática (recomendado)** | Bonito e determinístico; tabelas paginadas com cabeçalho; gratuito; privado; um modelo por relatório; PDF autónomo | Precisa de alguém técnico para mudar o design; WASM pesado no primeiro carregamento; dependência do typst.ts | **GO** |
| HTML + CSS de impressão (+ Paged.js) | Tecnologia conhecida; fácil de estilizar | O resultado depende do browser e do diálogo de impressão; quebras de página difíceis; Paged.js com evolução lenta | Plano B |
| pdfmake / jsPDF + autotable | Tudo em JS, leve | Layout de baixo nível; tipografia fraca; gráficos como imagens | Não |
| Python (pandas + typst/WeasyPrint) só em CLI | Ótimo para parsing (pdfplumber), robusto | Exige instalação; afasta quem não é técnico | Só como CLI opcional |
| Pyodide (Python no browser) com o wheel `typst` | Um só código Python para CLI e web; dá acesso a pdfplumber | 10 a 20 s de arranque; mais pesado | Plano C (sobretudo se a v2 com PDF avançar) |
| Google Slides / Sheets (o que tentámos) | Ferramentas que a tuna já usa | Ligações frágeis, design limitado, cópias partilham dados | Abandonar |
| Ferramentas SaaS de relatórios | Sem código | Dados financeiros num terceiro, custos, menos controlo | Não |

---

## 9. Plano por fases

| Fase | Entregável | Critério de aceitação |
|---|---|---|
| 0. Fundação | Repositório, build, typst.ts a compilar "olá" no browser e o Typst CLI no CI, fontes e logo empacotados | PDF gerado offline nos dois caminhos |
| 1. Dados | Parser XLSX/CSV, normalizador, validador, esquema JSON, testes | Os dados de exemplo passam sem erros; ficheiros com erros dão mensagens claras |
| 2. Relatório de evento | `evento.typ` + calculador + página com parâmetros | Totais iguais aos da folha atual (recebido 16 119,95 €, pago 17 386,61 € para o 20º CITADÃO) |
| 3. Pegada e letivo | `pegada.typ`, `letivo.typ`, anexo de movimentos paginado | 137 movimentos com cabeçalho repetido; reconciliação certa |
| 4. Fiscal + ESNL | `fiscal.typ`, mapa de recebimentos e pagamentos | Totais anuais iguais aos da folha |
| 5. Polimento | Pré-visualização, perfis de mapeamento CSV, PWA offline, README, regressão visual | Uma pessoa não técnica gera os 4 relatórios só com o README |
| 6. (Opcional v2) PDF | Adaptador para um formato de PDF específico | ≥ 99 % das linhas certas nas fixtures reais |

---

## 10. Prompt para o agente

```text
Contexto
És um engenheiro de software sénior. Vais construir, de raiz, um gerador de relatórios
financeiros em PDF para a TUNADÃO 1998 (Tuna do Instituto Politécnico de Viseu), uma associação
académica sem fins lucrativos em regime de caixa. Lê primeiro o documento
"gerador-relatorios-analise.md" (este ficheiro) inteiro: as secções 4 (requisitos), 6 (riscos),
7 (arquitetura e regras de cálculo) e 9 (fases) são vinculativas.

Objetivo
Uma página web estática que corre 100 % no browser (sem backend, sem chamadas de rede depois do
carregamento) e um CLI em Node que partilha o mesmo código. O utilizador carrega um .xlsx (ou
.csv) da folha "Tesouraria", escolhe o tipo de relatório (pegada de direção, fim de ano fiscal,
fim de ano letivo, relatório de evento), preenche os parâmetros e descarrega um PDF A4 bonito,
com tabelas paginadas (cabeçalho repetido) e gráficos gerados a partir dos mesmos dados.

Stack obrigatória
- TypeScript + Vite; Vitest.
- Parsing: SheetJS CE 0.20.x vendorizado (não usar o pacote "xlsx" do npm, que está
  desatualizado) e PapaParse.
- Composição: Typst. Browser: typst.ts (fixa uma versão e confirma que $typst.pdf funciona);
  CI/CLI: Typst CLI. Os modelos .typ têm de compilar de forma idêntica nos dois.
- Fontes (Lato, Carter One; SIL OFL), logo e quaisquer pacotes Typst empacotados no
  repositório. Nada é descarregado em tempo de execução.
- Encapsula o motor atrás de render(templateId, reportJson) -> Uint8Array, para o poder trocar
  (plano B: typst-wasm; plano C: Pyodide + wheel "typst").

Regras de arquitetura
1. Todos os cálculos financeiros em TypeScript puro, com testes unitários. O Typst recebe um
   report-<tipo>.json já calculado e só faz layout.
2. Valores em cêntimos (inteiros) até ao momento de formatar. Formatação pt-PT: "1 234,56 €",
   datas dd/mm/aaaa.
3. Validação antes de gerar, com erros (bloqueiam) e avisos (não bloqueiam), sempre com a
   linha e a coluna de origem. Ver lista em RF4.
4. Rastreabilidade (RF8): data de geração, SHA-256 da entrada e versão do gerador no PDF; anexa
   o JSON normalizado ao PDF se a versão do Typst usada o permitir.
5. Privacidade: CSP restritiva, sem analytics, sem fetch externo.

Dados de entrada
Esquemas exatos na secção 4.1 (RF2). Os dados de exemplo vêm da exportação .xlsx da folha
Tesouraria (vai ser fornecida em fixtures/tesouraria-exemplo.xlsx). Valores de controlo para
testes: 20º CITADÃO, recebido 16 119,95 €, pago 17 386,61 €, resultado -1 266,66 €, por
receber 7 346,12 €, por pagar 4 858,50 €, resultado previsto 1 220,96 €; saldo a 31/12/2025:
8 430,15 €.

Design
A4 vertical; cabeçalho com logo, "TUNADÃO 1998" em Carter One, subtítulo "Tuna do Instituto
Politécnico de Viseu", código do documento e período à direita; rodapé "Página X de N". Corpo em
Lato. Paleta: navy #1D2F6F, cinzento-claro #F3F5F9 para cartões e linhas de total, acentos do
logo com moderação. KPIs como cartões (rótulo pequeno, valor grande), não como gráficos.
Gráficos: composição 100 % empilhada e orçado vs realizado em barras horizontais desenhados com
primitivas Typst (rect/grid) ou Lilaq. Etiquetas de valor legíveis (≥ 8 pt), sem eixos poluídos.
Conteúdo de cada relatório: tabela em RF5.

Processo
Trabalha por fases (secção 9) e não avances sem o critério de aceitação da fase cumprido. No fim
de cada fase: corre os testes, gera os PDFs de exemplo em examples/, converte-os para PNG e
revê-os visualmente (sobreposições, cortes, quebras de página más, órfãs de cabeçalho). Corrige
antes de continuar.
Fora de âmbito na v1: entrada PDF, edição do PDF, assinaturas digitais, telemóvel.

Entregáveis
- Repositório com README em português (pt-PT, pós-acordo): como usar a página, como gerar pelo
  CLI, como mudar o logo, rubricas, cores e cargos das assinaturas, como publicar no alojamento
  estático.
- Página publicável em Codeberg Pages ou statichost.eu.
- examples/: os quatro PDFs gerados a partir das fixtures.
- CHANGELOG e testes a passar no CI.

Quando tiveres dúvidas de conteúdo financeiro ou de design que não estejam resolvidas neste
documento, pára e pergunta. Não inventes regras de cálculo.
```

---

## Fontes

1. [Typst · table (header/footer `repeat` por defeito)](https://typst.app/docs/reference/model/table/)
2. [Typst · csv()](https://typst.app/docs/reference/data-loading/csv/)
3. [typst.ts · All-in-one guide (`$typst.pdf`, `addSource`, `mapShadow`, fontes)](https://myriad-dreamin.github.io/typst.ts/cookery/guide/all-in-one.html)
4. [typst.ts no GitHub](https://github.com/Myriad-Dreamin/typst.ts)
5. [Typst 0.15 now available (fórum)](https://forum.typst.app/t/typst-0-15-now-available/9094)
6. [typst-wasm: compile Typst in browsers, Node, and serverless runtimes](https://forum.typst.app/t/typst-wasm-compile-typst-in-browsers-node-and-serverless-runtimes/9399)
7. [Lilaq no Typst Universe](https://typst.app/universe/package/lilaq) · [cetz-plot](https://www.typst.app/universe/package/cetz-plot)
8. [SheetJS · instalação standalone](https://docs.sheetjs.com/docs/getting-started/installation/standalone)
9. [typst (Python) no PyPI](https://pypi.org/project/typst/)
10. [INNOQ · Static site hosting without Big Tech (2026)](https://www.innoq.com/en/blog/2026/08/static-site-hosting-without-big-tech/)
11. [pdftables-ts](https://github.com/stevendecock/pdftables-ts)
12. [Extracting tables from PDFs in JavaScript with PDF.js](https://dzone.com/articles/extracting-tables-pdfs)
