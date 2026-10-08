# Dados fictícios de tesouraria

Tudo o que está aqui é inventado. Nenhuma linha vem de contas reais do TUNADÃO 1998.

## O que é

Uma tesouraria encadeada de janeiro de 2024 a setembro de 2026. Cada período abre onde o anterior fechou, por isso os cinco relatórios de exemplo (relatório e contas de 2025, fim de ano letivo 2025/26, passagem de pasta de setembro de 2026, relatório do 20º CITADÃO e ficha da Zumba na Caneca) saem dos mesmos movimentos.

Os ficheiros em `fixtures/generated/` são gerados com `npm run build:fixtures` e estão versionados. Um teste falha se deixarem de corresponder a este código.

## Ficheiros

- `listas.ts`: rubricas, sub-rubricas, atividades e meios (partilhados com o modelo descarregável).
- `movimentos-2024.ts`, `movimentos-2025.ts`, `movimentos-2026.ts`: os movimentos de cada ano, agrupados por atividade.
- `linhas.ts`: funções auxiliares (`entrada`, `saida`, `transferencia`) e a numeração dos documentos (R-, P- e T-, que recomeça em cada ano).
- `tesouraria.ts`: junta tudo com os pendentes, o orçamento, os géneros e os saldos.
- `invalid/`: um conjunto pequeno por classe de erro, com os erros colocados de propósito.
- `../params/`: parâmetros de cada relatório de exemplo. Os valores monetários dos parâmetros estão em euros.

## O que cada período reproduz

| Período             | Recebimentos | Pagamentos  | Saldo final |
| ------------------- | ------------ | ----------- | ----------- |
| 2024                | 21.700,00 €  | 19.660,45 € | 4.098,15 €  |
| 2025                | 24.445,30 €  | 22.311,90 € | 6.231,55 €  |
| 1 jan a 31 ago 2026 | 27.792,70 €  | 20.546,20 € | 13.478,05 € |
| setembro de 2026    | 720,00 €     | 354,00 €    | 13.844,05 € |

- **2024 e 2025**: totais por rubrica iguais aos do mapa de pagamentos e recebimentos de 2025. Cada rubrica tem poucas linhas, espalhadas por atividades e meses (incluindo janeiro a agosto de 2025, o período homólogo do ano letivo). O orçamento de 2025 é inventado.
- **Janeiro a agosto de 2026**: 20 recebimentos (R-001 a R-020) e 27 pagamentos (P-001 a P-027). Por atividade: Funcionamento 4.390,00 € / 1.311,80 €, Zumba na Caneca 2.927,50 € / 1.447,40 €, 20º CITADÃO 20.225,20 € / 15.927,00 € e Festivais 250,00 € / 1.860,00 €.
- **20º CITADÃO**: uma linha por sub-rubrica, igual ao orçado e realizado do relatório, com movimentos entre 20/02 e 15/06/2026. O orçamento tem o âmbito `20º CITADÃO`. Os três géneros somam 2.930,00 €.
- **Zumba na Caneca**: os dez movimentos do livro de caixa, mais a transferência de 2.529,50 € do numerário do evento para o banco a 16/03/2026 (duas linhas com o mesmo documento T-001, rubrica `Transferências internas`).
- **Setembro de 2026**: os sete movimentos da passagem de pasta. O reforço de 250,00 € do patrocinador do 20º CITADÃO (R-023, 18/09) está marcado com a atividade `20º CITADÃO`. Quem corre o relatório do evento com "contar até" 15/06/2026 e pendentes a 15/06/2026 deixa-o de fora e vê os 250,00 € por receber.

## Saldos

| Data       | Caixa    | Banco       | Total       |
| ---------- | -------- | ----------- | ----------- |
| 31/12/2023 | 150,00 € | 1.908,60 €  | 2.058,60 €  |
| 31/12/2024 | 185,40 € | 3.912,75 €  | 4.098,15 €  |
| 31/12/2025 | 240,00 € | 5.991,55 €  | 6.231,55 €  |
| 31/08/2026 | 258,30 € | 13.219,75 € | 13.478,05 € |
| 30/09/2026 | 579,00 € | 13.265,05 € | 13.844,05 € |

O saldo de 31/12/2023 só fixa o ponto de partida (a divisão entre caixa e banco foi escolhida). Os restantes são conferidos com os movimentos entre pontos de controlo consecutivos.

## Escolhas que o modelo não fixa

- **Rubricas das despesas do 20º CITADÃO e da Zumba**: Prémios e Júri em `Prémios e troféus`, cartazes em `Comunicação e gráfica`, licenças em `Taxas e licenças`, seguro em `Seguros e despesas bancárias`, diversos e a instrutora em `Outros pagamentos`. Com as despesas bancárias, a reparação de instrumentos e a taxa de registo do Funcionamento, o grupo "outros pagamentos" soma 2.941,20 €, que arredonda para os 2.941 € do painel visual.
- **Duas atividades extra** (`18º CITADÃO` e `19º CITADÃO`) para os eventos de 2024 e 2025, e as sub-rubricas `Inscrições` e `Despesas bancárias`.
- **Pendentes de 2025 liquidados em 2026**: o apoio da Câmara Municipal (1.000,00 €) e o saldo do fornecedor de som (450,00 €) entram em janeiro de 2026 em Funcionamento e Festivais, para o painel por atividade ficar só com as quatro atividades do período.
- **Transferências**: as duas linhas de cada depósito levam a atividade de origem do numerário.
- **Géneros**: datados de 30/04/2026 (início do evento), para não gerarem avisos de géneros sem data nos relatórios por período.
- **Documentos**: numerados por ordem cronológica dentro de cada ano, de modo que os números do livro de caixa da Zumba (P-003 a P-008, R-004 a R-007) e da passagem de pasta (R-021 a R-023, P-028 a P-031) coincidem com os dos modelos.
