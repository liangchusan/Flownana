import {
  AlertTriangle,
  ArrowRight,
  Check,
  Image as ImageIcon,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const colors = [
  { name: "Canvas", className: "bg-background border border-border" },
  { name: "Soft", className: "bg-surface-soft" },
  { name: "Card", className: "bg-card" },
  { name: "Strong", className: "bg-surface-strong" },
  { name: "Primary", className: "bg-primary" },
  { name: "Dark", className: "bg-surface-dark" },
];

export function DesignSystemShowcase() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <Badge variant="primary">MVP visual baseline</Badge>
          <h1 className="mt-6 max-w-4xl font-display text-5xl font-medium leading-none tracking-tight md:text-display-xl">
            A warm, editorial workspace for visual creation.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            This page is the rendered reference for Flownana&apos;s Claude-inspired
            tokens, primitives, product states, and responsive visual floor.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg">
              Start creating
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline">
              View examples
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl space-y-16 px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Color roles
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {colors.map((color) => (
              <div key={color.name}>
                <div className={`h-24 rounded-ui-lg ${color.className}`} />
                <p className="mt-2 text-sm font-medium">{color.name}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)]">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Typography
            </p>
            <div className="mt-5 space-y-5 border-y border-border py-8">
              <p className="font-display text-display-lg font-medium">Display large</p>
              <p className="font-display text-display-md font-medium">Display medium</p>
              <p className="text-lg font-medium">Functional panel title</p>
              <p className="max-w-2xl leading-relaxed text-stone-700">
                Body text stays calm and highly readable. Generated media—not
                decorative interface chrome—carries the visual energy.
              </p>
              <p className="font-mono text-sm text-muted-foreground">
                generation.status = &quot;ready&quot;
              </p>
            </div>
          </div>

          <Card tone="editorial">
            <CardHeader>
              <CardTitle className="font-display text-display-sm font-medium">
                Quiet surface, clear hierarchy
              </CardTitle>
              <CardDescription>
                Editorial cards use warm surface contrast instead of heavy shadow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-ui bg-background p-4 text-sm leading-relaxed text-stone-700">
                One surface, one purpose, and one obvious next action.
              </div>
            </CardContent>
            <CardFooter>
              <Button>Primary action</Button>
              <Button variant="ghost">Learn more</Button>
            </CardFooter>
          </Card>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Controls
          </p>
          <Card className="mt-5 max-w-3xl">
            <CardHeader>
              <CardTitle>Create an image</CardTitle>
              <CardDescription>
                Labels stay visible and focus states use the primary semantic ring.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="showcase-title">
                  Project name
                </label>
                <Input id="showcase-title" placeholder="Summer campaign" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="showcase-prompt">
                  Prompt
                </label>
                <Textarea
                  id="showcase-prompt"
                  placeholder="A quiet coastal scene at golden hour..."
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate
                </Button>
                <Button variant="secondary">Save draft</Button>
                <Button variant="outline">Cancel</Button>
                <Button disabled>Unavailable</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Creation states
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StateCard
              icon={<ImageIcon className="h-5 w-5" />}
              title="Empty"
              copy="Describe an image to begin."
            />
            <StateCard
              icon={<Loader2 className="h-5 w-5 animate-spin" />}
              title="Generating"
              copy="Your image is being prepared."
            />
            <StateCard
              icon={<Check className="h-5 w-5 text-success" />}
              title="Ready"
              copy="The result is ready to review."
            />
            <StateCard
              icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
              title="Needs attention"
              copy="Generation stopped. Try again."
            />
          </div>
        </div>

        <Card tone="dark" className="overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[0.75fr_1.25fr]">
            <div className="flex flex-col justify-between p-8 md:p-12">
              <div>
                <Badge className="bg-surface-elevated text-background">
                  Generated result
                </Badge>
                <h2 className="mt-6 font-display text-display-md font-medium">
                  The image stays at the center.
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-stone-400">
                  Dark framing supports media review while nearby controls stay quiet
                  and predictable.
                </p>
              </div>
              <Button className="mt-8 w-fit">Download result</Button>
            </div>
            <div className="m-4 flex min-h-80 items-center justify-center rounded-ui-xl bg-surface-elevated p-8 lg:m-6">
              <div className="flex aspect-square w-full max-w-sm items-center justify-center rounded-ui-lg bg-gradient-to-br from-primary/80 via-surface-strong to-background text-foreground shadow-soft">
                <ImageIcon className="h-12 w-12" />
              </div>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}

function StateCard({
  icon,
  title,
  copy,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-soft">
          {icon}
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{copy}</CardDescription>
      </CardHeader>
    </Card>
  );
}
