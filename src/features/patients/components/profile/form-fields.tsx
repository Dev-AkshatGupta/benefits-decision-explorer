import { useId, type ComponentProps } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
type Shared = {
  label: string;
  registration: UseFormRegisterReturn;
  error?: string | undefined;
  optional?: boolean;
};
export function InputField({
  label,
  registration,
  error,
  optional = false,
  ...props
}: Shared & Omit<ComponentProps<'input'>, 'name'>) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}{' '}
        <span className="text-xs font-normal text-muted-foreground">
          ({optional ? 'optional' : 'required'})
        </span>
      </label>
      <input
        {...props}
        {...registration}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? id + '-error' : undefined}
        className="form-control w-full read-only:bg-background"
        required={!optional}
      />
      {error && (
        <p
          id={id + '-error'}
          role="alert"
          className="mt-1 text-sm text-warning"
        >
          {error}
        </p>
      )}
    </div>
  );
}
export function SelectField({
  label,
  registration,
  error,
  optional = false,
  children,
  ...props
}: Shared & Omit<ComponentProps<'select'>, 'name'>) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}{' '}
        <span className="text-xs font-normal text-muted-foreground">
          ({optional ? 'optional' : 'required'})
        </span>
      </label>
      <select
        {...props}
        {...registration}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? id + '-error' : undefined}
        className="form-control w-full"
        required={!optional}
      >
        {children}
      </select>
      {error && (
        <p
          id={id + '-error'}
          role="alert"
          className="mt-1 text-sm text-warning"
        >
          {error}
        </p>
      )}
    </div>
  );
}
