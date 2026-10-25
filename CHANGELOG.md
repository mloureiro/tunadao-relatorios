# Changelog

## Por publicar

- Os PDFs usam o papel timbrado da tuna: barra azul, marca d'água e selo no cabeçalho, e no rodapé o nome, a morada e o
  NIPC (`org.address` e `org.nipc` em `config/config.json`).
- Na ponte de saldos, o saldo inicial que vem de uma linha de Saldos com Fonte «Declarado» passa a dizer-se declarado:
  «Saldo inicial (declarado)», ou só da caixa ou do banco (a contagem ou o extrato do mesmo dia prevalecem).
- As páginas são numeradas `1/3`, `2/3`, `3/3`, para que cada página possa ser rubricada.

## 2.0.0

- A Tesouraria passa a ser o único sítio onde se escreve um relatório. A página já não tem formulários: carrega-se o
  `.xlsx` e cada folha de relatório do ficheiro aparece com o estado, as datas por extenso, os valores principais e os
  erros com a célula (`Folha "Pegada 2026", célula B8`).
- Cada relatório é uma folha do ficheiro (pegada, evento, fim de ano letivo, fim de ano fiscal), reconhecida pela célula
  «Relatório» e não pelo nome. O modelo traz uma folha em branco de cada tipo, que também se descarrega à parte, e as
  datas deixadas em branco que o ficheiro já conhece são deduzidas e escritas por extenso.
- «Descarregar todos (.zip)» gera todos os relatórios prontos e guarda-os num só ficheiro.
- «Próximas folhas»: a pegada e o fim de ano letivo seguintes, já com as datas e a direção cessante preenchidas.
- Os nomes dos signatários vêm da folha (bloco Assinaturas) e cada linha de assinatura tem data.
- O CLI escolhe o relatório pela folha (`--folha`) e lista-as com `--listar`, que escreve tudo no stdout. Já não há
  `--tipo`, `--param` nem `--params`.
- Correções nos PDFs: período do evento, resultado acumulado e totais dos reembolsos no livro de caixa, lista de
  movimentos com atividade e rubrica, notas compridas que continuam na página seguinte, pegada com os pendentes e as
  assinaturas na mesma página.
- Pedir um PDF logo após a primeira visita já não descarrega o motor duas vezes.
- Removido: os ficheiros CSV já não são aceites; só `.xlsx`.
- Removido: o saldo de abertura escrito no navegador. Declara-se em Saldos, com a fonte «Declarado». O saldo do extrato
  bancário da pegada escreve-se na folha da pegada.
- Os nomes das colunas calculadas do modelo foram renomeados, a lista de sub-rubricas passa a depender da rubrica e as linhas de exemplo do modelo
  antigo passam a ser erros. Os nomes antigos continuam a ser aceites.
- README com o novo guia, as capturas do novo ecrã e a organização da Tesouraria.

## 1.0.0

- Página que lê a folha de Tesouraria (`.xlsx` ou CSV), valida os dados com a linha e a coluna de cada problema e gera os
  quatro relatórios em PDF: relatório de evento, pegada de direção, fim de ano letivo e fim de ano fiscal.
- CLI `npm run gerar` com o mesmo pipeline e o mesmo motor de PDF da página.
- Funcionamento offline depois da primeira visita, com aviso de nova versão.
- O motor de PDF começa a carregar quando o navegador está livre e mostra o progresso se ainda não estiver pronto ao
  gerar.
- README em português com o guia de utilização, o CLI, a personalização e a publicação.
