"use client";

import {
  cloneElement,
  useId,
  type AriaAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

type FieldControlProps = Pick<
  AriaAttributes,
  "aria-describedby" | "aria-errormessage" | "aria-invalid"
> & {
  id?: string;
};

type FieldProps = {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  children: ReactElement<FieldControlProps>;
  className?: string;
};

function joinIds(...values: Array<string | undefined>): string | undefined {
  const ids = values
    .flatMap((value) => value?.split(/\s+/) ?? [])
    .filter(Boolean);

  return ids.length > 0 ? [...new Set(ids)].join(" ") : undefined;
}

/**
 * Wires a label, supporting description, validation message, and one native
 * form control into a single accessible field.
 *
 * Identity is generated here rather than left to each form so the relationship
 * cannot drift as copy or validation state changes. A caller-supplied control
 * id and ARIA references are preserved.
 */
export function Field({
  label,
  description,
  error,
  children,
  className = "",
}: FieldProps) {
  const generatedId = useId();
  const controlId = children.props.id ?? `field-${generatedId}`;
  const hasDescription = description !== undefined && description !== null;
  const hasError = error !== undefined && error !== null && error !== false;
  const descriptionId = hasDescription
    ? `${controlId}-description`
    : undefined;
  const errorId = hasError ? `${controlId}-error` : undefined;
  const describedBy = joinIds(
    children.props["aria-describedby"],
    descriptionId,
    errorId,
  );
  const controlProps: FieldControlProps = {
    id: controlId,
  };

  if (describedBy) {
    controlProps["aria-describedby"] = describedBy;
  }
  if (errorId) {
    controlProps["aria-errormessage"] = errorId;
    controlProps["aria-invalid"] = true;
  }

  return (
    <div className={`grid gap-2 ${className}`}>
      <label htmlFor={controlId} className="text-sm font-medium">
        {label}
      </label>
      {cloneElement(children, controlProps)}
      {hasDescription ? (
        <p id={descriptionId} className="text-xs leading-5 text-muted">
          {description}
        </p>
      ) : null}
      {hasError ? (
        <p
          id={errorId}
          role="alert"
          className="text-xs leading-5 text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
