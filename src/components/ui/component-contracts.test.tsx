import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Alert } from "./alert";
import { Button } from "./button";
import { Card } from "./card";
import { Input } from "./input";
import { Textarea } from "./textarea";

describe("UI component contracts", () => {
  it("keeps destructive buttons inside guarded contrast contexts", () => {
    const markup = renderToStaticMarkup(
      <Button variant="danger" data-contrast-context="background">
        Delete item
      </Button>,
    );

    expect(markup).toContain('data-contrast-context="card"');
    expect(markup).toContain('data-contrast-hover-context="raised"');
    expect(markup).toContain("text-danger");
    expect(markup).not.toContain("text-white");
    expect(markup).not.toContain("hover:opacity");
  });

  it("does not let callers replace a card's contrast context", () => {
    const markup = renderToStaticMarkup(
      <Card data-contrast-context="background">Content</Card>,
    );

    expect(markup).toContain('data-contrast-context="card"');
    expect(markup).not.toContain('data-contrast-context="background"');
  });

  it("leaves alert announcement behavior to the caller", () => {
    const staticAlert = renderToStaticMarkup(
      <Alert title="Saved">The record was saved.</Alert>,
    );
    const liveAlert = renderToStaticMarkup(
      <Alert title="Failed" role="alert" data-contrast-context="background">
        Try again.
      </Alert>,
    );

    expect(staticAlert).not.toContain('role="status"');
    expect(staticAlert).not.toContain('role="alert"');
    expect(liveAlert).toContain('role="alert"');
    expect(liveAlert).toContain('data-contrast-context="card"');
    expect(liveAlert).not.toContain('data-contrast-context="background"');
  });

  it("renders placeholders without contrast-reducing opacity", () => {
    const input = renderToStaticMarkup(<Input placeholder="Name" />);
    const textarea = renderToStaticMarkup(
      <Textarea placeholder="Description" />,
    );

    expect(input).toContain("placeholder:text-muted");
    expect(textarea).toContain("placeholder:text-muted");
    expect(input).not.toContain("placeholder:text-muted/70");
    expect(textarea).not.toContain("placeholder:text-muted/70");
  });
});
