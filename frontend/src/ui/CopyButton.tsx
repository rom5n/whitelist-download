import { useEffect, useRef, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { copyText } from '../clipboard';
import { useTranslation } from '../i18n';
import Button, { type ButtonVariant } from './Button';

type CopyState = 'idle' | 'copied' | 'failed';

interface CopyButtonProps {
  text: string;
  variant?: ButtonVariant;
  className?: string;
  disabled?: boolean;
}

/**
 * Copies the text and confirms it right on the button: the icon pops into a check mark
 * and a ring expands from it. The result is also announced to screen readers.
 */
export default function CopyButton({ text, variant = 'primary', className = '', disabled = false }: CopyButtonProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<CopyState>('idle');
  const [burst, setBurst] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    window.clearTimeout(timer.current);
    try {
      await copyText(text);
      setState('copied');
      setBurst(n => n + 1);
    } catch (err) {
      console.error('Failed to copy', err);
      setState('failed');
    }
    timer.current = window.setTimeout(() => setState('idle'), 1800);
  };

  const Icon = state === 'copied' ? Check : state === 'failed' ? X : Copy;

  return (
    <Button
      variant={state === 'failed' ? 'danger' : variant}
      onClick={copy}
      disabled={disabled || !text}
      className={`min-w-36 ${className}`}
      icon={
        <span className="relative inline-flex size-4 items-center justify-center">
          <Icon key={state} className="size-4 animate-pop" aria-hidden="true" />
          {burst > 0 && state === 'copied' && (
            <span
              key={burst}
              aria-hidden="true"
              className="absolute inset-[-6px] rounded-full border-2 border-current opacity-0 [animation:copy-burst_520ms_var(--ease-out)]"
            />
          )}
        </span>
      }
    >
      <span aria-live="polite">{state === 'copied' ? t('sub.copied') : state === 'failed' ? t('control.error') : t('sub.copyLink')}</span>
    </Button>
  );
}
