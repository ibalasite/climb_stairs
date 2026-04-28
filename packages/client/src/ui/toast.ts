type ToastKind = 'error' | 'success' | 'info';

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string, kind: ToastKind = 'info'): void {
  const el = document.getElementById('toast');
  if (!el) return;

  el.textContent = msg;
  el.className = `toast-${kind} show`;

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    el.classList.remove('show');
  }, 3500);
}
