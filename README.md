# Gerador de relatórios financeiros — TUNADÃO 1998

Página estática e CLI que leem a folha de Tesouraria (`.xlsx` ou CSV) e geram os relatórios financeiros da tuna em PDF,
tudo no navegador e sem enviar dados para lado nenhum.

**Em construção.**

## Desenvolvimento

### Motor de PDF

O PDF é composto por Typst, compilado em WebAssembly com `@myriaddreamin/typst.ts` e `@myriaddreamin/typst-ts-web-compiler`
(ambos fixados em `0.7.0`, que embute o Typst **0.14.2**). Os modelos usam apenas funcionalidades do Typst 0.14. O CI
compila `templates/hello.typ` com o Typst CLI 0.14.2 e confirma que o PDF só embute Lato e Carter One.

- `src/engine/typst-session.ts` constrói o compilador a partir de bytes (wasm, tipos de letra, modelos) e implementa
  `render(templateId, report)`. É partilhado pelo navegador e pelo Node.
- No navegador, `src/engine/typst-web.ts` lança um Web Worker (`render.worker.ts`) que descarrega o wasm e os ficheiros
  do próprio site; o carregamento só começa no primeiro `warmUp()` ou `render()`.
- No Node, `src/engine/typst-node.ts` lê **os mesmos bytes wasm** de `node_modules`; não é preciso
  `@myriaddreamin/typst-ts-node-compiler`.
- Os tipos de letra do Typst são passados como bytes e o carregamento de tipos de letra remotos fica desligado: os
  carregadores de série do typst.ts usam `new Function` (bloqueado pela CSP) e vão buscar tipos de letra a um CDN.
- A versão 0.7.0 só devolve avisos do compilador quando a compilação falha. Por isso `render` compila através de
  `runWithWorld`, onde os avisos (por exemplo `unknown font family`) chegam também em caso de sucesso. Glifos em falta
  não geram aviso nenhum; a cobertura de glifos é verificada pelo job `typst-cli`, que falha se o PDF embutir qualquer
  tipo de letra que não seja Lato ou Carter One.
- `assets/logo.svg` é um marcador provisório até haver o logótipo real.

### Tamanhos medidos

| Ficheiro                                | Tamanho                 |
| --------------------------------------- | ----------------------- |
| `typst_ts_web_compiler_bg.wasm` (bruto) | 28 325 178 B (27,0 MiB) |
| mesmo ficheiro, gzip -9                 | 10 733 234 B (10,2 MiB) |
| tipos de letra (5 TTF)                  | 2 800 908 B (2,7 MiB)   |

O primeiro PDF de teste, medido em `vite preview` local (sem rede real), fica pronto cerca de 0,1 s após o wasm
carregar e demora cerca de 0,2 s a compor. O tamanho transferido e o `content-encoding` no GitHub Pages ainda não foram
medidos: só é possível no URL publicado, depois do primeiro deploy deste motor.

Licença: Apache-2.0.
