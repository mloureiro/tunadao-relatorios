import { createTypstCompiler } from '@myriaddreamin/typst.ts/compiler';
import type { WebAssemblyModuleRef } from '@myriaddreamin/typst.ts/wasm';
import { REPORT_DATA_PATH, mainTemplatePath } from './assets';
import type { RenderResult, Renderer, TemplateId } from './renderer';

export interface EngineInputs {
  wasm: WebAssemblyModuleRef;
  fonts: readonly Uint8Array[];
  files: ReadonlyMap<string, Uint8Array>;
}

// The stock font loaders construct a dynamic-import helper with `new Function`
// and fall back to remote font assets; this one only feeds the bytes it is given.
function bundledFontLoader(fonts: readonly Uint8Array[]) {
  const loader = async (
    _stage: unknown,
    context: { builder: { add_raw_font(bytes: Uint8Array): Promise<void> } },
  ) => {
    for (const font of fonts) await context.builder.add_raw_font(font);
  };
  loader._kind = 'fontLoader';
  loader._preloadRemoteFontOptions = { assets: false as const };
  return loader;
}

interface Diagnostic {
  severity: string;
  path: string;
  range: string;
  message: string;
}

function locate({ path, range }: Diagnostic, fallbackPath: string): string {
  const start = /^(\d+):(\d+)/.exec(range);
  const position = start
    ? `:${String(Number(start[1]) + 1)}:${String(Number(start[2]) + 1)}`
    : '';
  return `${path || fallbackPath}${position}`;
}

function describe(diagnostic: Diagnostic, fallbackPath: string): string {
  return `${diagnostic.severity}: ${locate(diagnostic, fallbackPath)}: ${diagnostic.message}`;
}

export async function createTypstSession(
  inputs: EngineInputs,
): Promise<Renderer> {
  const compiler = createTypstCompiler();
  await compiler.init({
    getWrapper: async () => {
      const wrapper = await import('@myriaddreamin/typst-ts-web-compiler');
      return {
        ...wrapper,
        default: (module: WebAssemblyModuleRef) =>
          wrapper.default({ module_or_path: module }),
      };
    },
    getModule: () => inputs.wasm,
    beforeBuild: [bundledFontLoader(inputs.fonts)],
  });

  const encoder = new TextEncoder();
  let queue: Promise<unknown> = Promise.resolve();

  async function renderNow(
    templateId: TemplateId,
    report: unknown,
  ): Promise<RenderResult> {
    compiler.resetShadow();
    for (const [path, bytes] of inputs.files) {
      compiler.mapShadow(`/${path}`, bytes);
    }
    compiler.mapShadow(
      `/${REPORT_DATA_PATH}`,
      encoder.encode(JSON.stringify(report)),
    );

    const mainFilePath = `/${mainTemplatePath(templateId)}`;
    return compiler.runWithWorld({ mainFilePath, root: '/' }, async (world) => {
      const { hasError, diagnostics = [] } = await world.compile({
        diagnostics: 'full',
      });
      if (hasError) {
        const errors = diagnostics.filter((d) => d.severity === 'error');
        throw new Error(
          `Typst compilation failed:\n${errors.map((d) => describe(d, mainFilePath)).join('\n')}`,
        );
      }
      const { result } = await world.pdf({ diagnostics: 'full' });
      if (!result) throw new Error('Typst produced no PDF');
      return {
        pdf: result,
        warnings: diagnostics.map((d) => describe(d, mainFilePath)),
      };
    });
  }

  return {
    render(templateId, report) {
      const run = queue.then(() => renderNow(templateId, report));
      queue = run.catch(() => undefined);
      return run;
    },
  };
}
