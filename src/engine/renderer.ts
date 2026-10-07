export type TemplateId = 'hello' | 'evento' | 'pegada' | 'letivo' | 'fiscal';

export interface RenderResult {
  pdf: Uint8Array;
  warnings: string[];
}

export interface Renderer {
  render(templateId: TemplateId, report: unknown): Promise<RenderResult>;
}
