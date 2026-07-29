import type { Metadata } from "next";
import { TopNav } from "@/components/navigation/top-nav";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LotusMark } from "@/components/ui/lotus-mark";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getServerEnvironment } from "@/lib/env/server";

export const metadata: Metadata = {
  title: "Components",
  description:
    "An isolated workshop for previewing and refining Padma's stock interface components.",
};

function PreviewSection({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="grid gap-8 border-t border-border py-12 lg:grid-cols-[15rem_1fr]">
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default async function ComponentsPage() {
  // A design workshop is a development tool. Serving it in production adds
  // unauthenticated surface and advertises the stack for no product benefit.
  if (getServerEnvironment().NODE_ENV === "production") {
    notFound();
  }

  const session = await getCurrentSession();

  return (
    <>
      <TopNav
        authenticated={Boolean(session)}
        current="components"
      />

      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24 sm:px-10"
      >
        <header className="py-16 sm:py-20">
          <div className="flex items-center gap-3">
            <LotusMark className="size-8 text-primary" />
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Design workshop
            </p>
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
            Stock components, isolated.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            One stable place to tune the system without inheriting layout,
            state, or styling from a product feature. Change a primitive and
            inspect it here across every palette and color mode.
          </p>

          <nav
            aria-label="Component groups"
            className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-sm"
          >
            {[
              ["type", "Type"],
              ["buttons", "Buttons"],
              ["forms", "Forms"],
              ["badges", "Badges"],
              ["alerts", "Alerts"],
              ["cards", "Cards"],
              ["surfaces", "Surfaces"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={`#${href}`}
                className="text-muted underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-primary"
              >
                {label}
              </a>
            ))}
          </nav>
        </header>

        <PreviewSection
          id="type"
          eyebrow="01"
          title="Typography"
          description="The default hierarchy for product copy, labels, metadata, and machine-readable values."
        >
          <div
            data-contrast-context="surface"
            className="rounded-[var(--radius-lg)] border border-border bg-surface p-6 sm:p-8"
          >
            <p className="text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">
              Display heading
            </p>
            <h3 className="mt-8 text-3xl font-semibold tracking-tight">
              Section heading
            </h3>
            <h4 className="mt-6 text-xl font-semibold">Component heading</h4>
            <p className="mt-4 max-w-2xl text-base leading-7">
              Body copy stays calm and readable. It provides context without
              competing with the action a user came to complete.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Muted copy is reserved for supporting detail, timestamps, and
              information that should remain available without becoming loud.
            </p>
            <p className="mt-6 font-mono text-xs uppercase tracking-[0.18em] text-primary">
              Metadata · resource:action · 2026-07-28
            </p>
          </div>
        </PreviewSection>

        <PreviewSection
          id="buttons"
          eyebrow="02"
          title="Buttons"
          description="A small action hierarchy with consistent size, focus, hover, disabled, and destructive states."
        >
          <div
            data-contrast-context="surface"
            className="rounded-[var(--radius-lg)] border border-border bg-surface p-6 sm:p-8"
          >
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primary action</Button>
              <Button variant="secondary">Secondary action</Button>
              <Button variant="ghost">Ghost action</Button>
              <Button variant="danger">Delete item</Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button disabled>Primary disabled</Button>
              <Button variant="secondary" disabled>
                Secondary disabled
              </Button>
              <Button className="min-h-11 px-5">Comfortable size</Button>
            </div>
          </div>
        </PreviewSection>

        <PreviewSection
          id="forms"
          eyebrow="03"
          title="Form controls"
          description="Native controls with shared dimensions and semantic focus, error, placeholder, and disabled treatments."
        >
          <div
            data-contrast-context="surface"
            className="grid gap-6 rounded-[var(--radius-lg)] border border-border bg-surface p-6 sm:grid-cols-2 sm:p-8"
          >
            <Field
              label="Display name"
              description="This is shown wherever your profile is visible."
            >
              <Input placeholder="Ada Lovelace" />
            </Field>

            <Field label="Role">
              <Select defaultValue="editor">
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="administrator">Administrator</option>
              </Select>
            </Field>

            <Field label="Description" className="sm:col-span-2">
              <Textarea
                placeholder="Add a short, useful description."
              />
            </Field>

            <Field
              label="Validation state"
              error="Enter a valid email address."
            >
              <Input
                defaultValue="not-an-email"
              />
            </Field>

            <Field label="Disabled state">
              <Input
                defaultValue="System managed"
                disabled
              />
            </Field>

            <div className="flex flex-wrap gap-x-6 gap-y-3 sm:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox defaultChecked />
                Email updates
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox />
                Product announcements
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-muted">
                <Checkbox disabled />
                System required
              </label>
            </div>
          </div>
        </PreviewSection>

        <PreviewSection
          id="badges"
          eyebrow="04"
          title="Badges"
          description="Compact status and category labels that support nearby content instead of dominating it."
        >
          <div
            data-contrast-context="surface"
            className="flex flex-wrap gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-6 sm:p-8"
          >
            <Badge>Draft</Badge>
            <Badge variant="primary">In review</Badge>
            <Badge variant="success">Active</Badge>
            <Badge variant="danger">Action required</Badge>
          </div>
        </PreviewSection>

        <PreviewSection
          id="alerts"
          eyebrow="05"
          title="Alerts"
          description="Short feedback blocks with restrained color and a clear text hierarchy."
        >
          <div className="grid gap-4">
            <Alert title="Settings saved">
              Your changes are available immediately.
            </Alert>
            <Alert title="Connection healthy" variant="success">
              The last delivery completed without retries.
            </Alert>
            <Alert title="Verification failed" variant="danger">
              Check the supplied value and try again.
            </Alert>
          </div>
        </PreviewSection>

        <PreviewSection
          id="cards"
          eyebrow="06"
          title="Cards"
          description="A neutral grouping surface. Cards organize related content without turning every section into a floating panel."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <Badge variant="primary">Foundation</Badge>
              <h3 className="mt-5 text-xl font-semibold">Default card</h3>
              <p className="mt-2 leading-7 text-muted">
                Use the standard surface for a focused unit of information or
                action.
              </p>
              <Button variant="secondary" className="mt-6">
                Review details
              </Button>
            </Card>
            <Card>
              <p className="font-mono text-xs text-primary">02</p>
              <h3 className="mt-5 text-xl font-semibold">Metric card</h3>
              <p className="mt-5 text-4xl font-semibold tracking-tight">2,418</p>
              <p className="mt-1 text-sm text-muted">Successful deliveries</p>
            </Card>
          </div>
        </PreviewSection>

        <PreviewSection
          id="surfaces"
          eyebrow="07"
          title="Semantic surfaces"
          description="The generated layers used by layout and atomic components. Palette colors are never selected directly here."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Background", "bg-background", "background"],
              ["Surface", "bg-surface", "surface"],
              ["Card", "bg-card-surface", "card"],
              ["Raised", "bg-surface-raised", "raised"],
            ].map(([label, background, context]) => (
              <div
                key={label}
                data-contrast-context={context}
                className={`min-h-32 rounded-[var(--radius-lg)] border border-border p-5 ${background}`}
              >
                <p className="font-semibold">{label}</p>
                <p className="mt-2 text-sm text-muted">
                  Semantic layer preview
                </p>
              </div>
            ))}
          </div>
        </PreviewSection>
      </main>
    </>
  );
}
