import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Field } from "./field";
import { Input } from "./input";

describe("Field", () => {
  it("connects its label and description to the control", () => {
    const markup = renderToStaticMarkup(
      <Field
        label="Display name"
        description="Shown anywhere your profile is visible."
      >
        <Input id="display-name" />
      </Field>,
    );

    expect(markup).toContain('<label for="display-name"');
    expect(markup).toContain('id="display-name"');
    expect(markup).toContain(
      'aria-describedby="display-name-description"',
    );
    expect(markup).toContain('id="display-name-description"');
  });

  it("marks invalid controls and announces their validation message", () => {
    const markup = renderToStaticMarkup(
      <Field label="Email" error="Enter a valid email address.">
        <Input id="email" aria-describedby="privacy-note" />
      </Field>,
    );

    expect(markup).toContain(
      'aria-describedby="privacy-note email-error"',
    );
    expect(markup).toContain('aria-errormessage="email-error"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('id="email-error" role="alert"');
  });

  it("generates a stable relationship when the control has no id", () => {
    const markup = renderToStaticMarkup(
      <Field label="Title">
        <Input />
      </Field>,
    );
    const labelTarget = markup.match(/<label for="([^"]+)"/)?.[1];

    expect(labelTarget).toBeTruthy();
    expect(markup).toContain(`id="${labelTarget}"`);
  });
});
