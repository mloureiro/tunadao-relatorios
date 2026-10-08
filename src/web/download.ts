export function saveFile(href: string, filename: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
}

export function saveText(text: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  saveFile(url, filename);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
