/**
 * Copies text to the clipboard. The dashboard is usually opened over plain http from another device,
 * where navigator.clipboard is unavailable, so it falls back to a hidden textarea.
 */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  const ok = document.execCommand('copy');
  textArea.remove();
  if (!ok) throw new Error('Copy command was rejected');
}
