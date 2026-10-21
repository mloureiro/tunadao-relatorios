import { useEffect, useRef } from 'preact/hooks';

export function Notice({ message }: { readonly message: string }) {
  const element = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    element.current?.focus();
  }, []);
  return (
    <p class="notice" tabIndex={-1} ref={element}>
      {message}
    </p>
  );
}
