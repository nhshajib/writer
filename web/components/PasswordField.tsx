"use client";

import { type InputHTMLAttributes, useState } from "react";

/** A password input with a Show/Hide button, so a long password can be checked before sending it. */
export function PasswordField(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { id: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="password-field">
      <input {...props} type={shown ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button type="button" className="password-toggle" aria-controls={props.id} aria-pressed={shown} onClick={() => setShown((s) => !s)}>
        {shown ? "Hide" : "Show"}
      </button>
    </span>
  );
}
