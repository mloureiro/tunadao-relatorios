import { useEffect, useRef, useState } from 'preact/hooks';

export function useObjectUrl(): [
  string | null,
  (blob: Blob | null) => string | null,
] {
  const current = useRef<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  function revoke(): void {
    if (current.current !== null) URL.revokeObjectURL(current.current);
    current.current = null;
  }

  function replace(blob: Blob | null): string | null {
    revoke();
    current.current = blob === null ? null : URL.createObjectURL(blob);
    setUrl(current.current);
    return current.current;
  }

  useEffect(() => {
    window.addEventListener('pagehide', revoke);
    return () => {
      window.removeEventListener('pagehide', revoke);
      revoke();
    };
  }, []);

  return [url, replace];
}
