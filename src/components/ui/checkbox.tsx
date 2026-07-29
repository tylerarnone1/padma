import type { InputHTMLAttributes } from "react";

export function Checkbox({
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      type="checkbox"
      className={`size-4 shrink-0 accent-primary ${className}`}
      {...props}
    />
  );
}
