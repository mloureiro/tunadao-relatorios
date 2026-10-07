const KNOWN_DYNAMIC_FUNCTIONS = `function typstGlueClosure(...parts) {
  switch (JSON.stringify(parts)) {
    case '["return 0"]':
      return () => 0;
    case '["return true"]':
      return () => true;
    case '["path","return path"]':
      return (path) => path;
    case '["throw new Error(\\'Dummy AccessModel, please initialize compiler with withAccessModel()\\')"]':
      return () => {
        throw new Error('Dummy AccessModel, please initialize compiler with withAccessModel()');
      };
    case '["throw new Error(\\'Dummy Registry, please initialize compiler with withPackageRegistry()\\')"]':
      return () => {
        throw new Error('Dummy Registry, please initialize compiler with withPackageRegistry()');
      };
    default:
      throw new Error('Unsupported dynamic function in the Typst glue: ' + JSON.stringify(parts));
  }
}
`;

const NO_ARGS = 'new Function(getStringFromWasm0(arg0, arg1))';
const WITH_ARGS =
  'new Function(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3))';
const DYNAMIC_IMPORT_HELPER = "new Function('m', 'return import(m)')";
const NO_DYNAMIC_IMPORT =
  "((m) => { throw new Error('Dynamic import is not available: ' + m); })";

function replaceOnce(code: string, needle: string, replacement: string) {
  const parts = code.split(needle);
  if (parts.length !== 2) {
    throw new Error(
      `Typst glue changed: expected exactly one \`${needle}\`, found ${String(parts.length - 1)}`,
    );
  }
  return parts.join(replacement);
}

export function patchWebCompilerGlue(code: string): string {
  const patched = replaceOnce(
    replaceOnce(
      code,
      NO_ARGS,
      'typstGlueClosure(getStringFromWasm0(arg0, arg1))',
    ),
    WITH_ARGS,
    'typstGlueClosure(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3))',
  );
  return `${patched}\n${KNOWN_DYNAMIC_FUNCTIONS}`;
}

export function patchDynamicImportHelper(code: string): string {
  return replaceOnce(code, DYNAMIC_IMPORT_HELPER, NO_DYNAMIC_IMPORT);
}

export const PINNED_TYPST_VERSION = '0.7.0';

export function assertPinnedVersion(name: string, version: string): void {
  if (version !== PINNED_TYPST_VERSION) {
    throw new Error(
      `${name} must be exactly ${PINNED_TYPST_VERSION} (found ${version}); the glue patch only knows that release`,
    );
  }
}

export type GlueFile = 'web-compiler-glue' | 'dynamic-import-helper';

export function patchGlueFile(kind: GlueFile, code: string): string {
  if (kind === 'web-compiler-glue') {
    return code.includes('function typstGlueClosure')
      ? code
      : patchWebCompilerGlue(code);
  }
  return code.includes(NO_DYNAMIC_IMPORT)
    ? code
    : patchDynamicImportHelper(code);
}
