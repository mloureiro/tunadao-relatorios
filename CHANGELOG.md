# Changelog

## 1.0.0

- Página que lê a folha de Tesouraria (`.xlsx` ou CSV), valida os dados com a linha e a coluna de cada problema e gera os
  quatro relatórios em PDF: relatório de evento, pegada de direção, fim de ano letivo e fim de ano fiscal.
- CLI `npm run gerar` com o mesmo pipeline e o mesmo motor de PDF da página.
- Funcionamento offline depois da primeira visita, com aviso de nova versão.
- O motor de PDF começa a carregar quando o navegador está livre e mostra o progresso se ainda não estiver pronto ao
  gerar.
- A causa de uma falha ao compor o PDF fica na consola do navegador.
- As mensagens de erro de parâmetros do CLI deixam de ter um ponto antes do valor recebido.
- README em português com o guia de utilização, o CLI, a personalização e a publicação.
