import { useEffect, useRef, useState } from 'preact/hooks';

const carriesFiles = (event: DragEvent): boolean =>
  event.dataTransfer?.types.includes('Files') === true;

export function useWindowDrop(
  onFiles: (files: File[]) => void,
  announce: (message: string) => void,
): boolean {
  const [over, setOver] = useState(false);
  const handlers = useRef({ onFiles, announce });
  handlers.current = { onFiles, announce };

  useEffect(() => {
    let depth = 0;
    const enter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth += 1;
      if (depth === 1) {
        setOver(true);
        handlers.current.announce('Largue o ficheiro para o carregar.');
      }
    };
    const leave = (event: DragEvent) => {
      if (!carriesFiles(event) || depth === 0) return;
      depth -= 1;
      if (depth === 0) {
        setOver(false);
        handlers.current.announce('Saiu da zona de largar.');
      }
    };
    const hover = (event: DragEvent) => {
      if (carriesFiles(event)) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setOver(false);
      handlers.current.onFiles(Array.from(event.dataTransfer?.files ?? []));
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', hover);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', hover);
      window.removeEventListener('drop', drop);
    };
  }, []);

  return over;
}
