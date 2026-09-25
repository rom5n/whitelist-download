import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { inputClass, type FieldTone } from './styles';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: ReactNode;
  /** A hint under the field; replaced by the error when there is one */
  hint?: ReactNode;
  error?: ReactNode;
  /** Highlights a field whose change awaits a restart */
  warning?: ReactNode;
  mono?: boolean;
}

/** A labeled text input with a hint, an error or a warning linked through aria-describedby. */
export default function Field({ label, hint, error, warning, mono = false, className = '', ...rest }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? warning ?? hint;
  const tone: FieldTone = error ? 'error' : warning ? 'warn' : 'default';

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-fg-2">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className={inputClass(tone, mono)}
        {...rest}
      />
      {note && (
        <p
          id={noteId}
          key={tone}
          className={`mt-1.5 animate-fade text-xs ${error ? 'text-danger-text' : warning ? 'text-warn-text' : 'text-fg-3'}`}
          role={error ? 'alert' : undefined}
        >
          {note}
        </p>
      )}
    </div>
  );
}
