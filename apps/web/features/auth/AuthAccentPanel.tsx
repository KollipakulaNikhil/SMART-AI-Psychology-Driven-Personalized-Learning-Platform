import { Underlined } from "@/components/ui/marks";

const NOTES: { number: string; text: string }[] = [
  { number: "01", text: "Six quick activities reveal how you actually learn" },
  { number: "02", text: "Every lesson is rebuilt around your profile" },
  { number: "03", text: "Pace, tone and depth adapt as you go" },
];

/** A tiny contents page — what the notebook fills up with once you start. */
const CONTENTS: [string, string][] = [
  ["Discovery", "p. 1"],
  ["Your learning profile", "p. 2"],
  ["First lesson", "p. 3"],
  ["Review, the next day", "p. 4"],
];

/**
 * The right-hand page of the login spread: a ruled notebook leaf with a red
 * margin. Static — no orbs, no particles; it is paper. Every block of type
 * sits on its own patch of clean paper so the rules never cross a word; the
 * list keeps its own hairlines on that patch, so nothing doubles up.
 */
export function AuthAccentPanel() {
  return (
    <aside
      className="ruled relative hidden h-full w-full overflow-hidden border-l-2 border-foreground lg:block"
      style={{ ["--rule-gap" as string]: "3rem", ["--paper-bg" as string]: "hsl(var(--elevated))" }}
    >
      <span aria-hidden className="absolute inset-y-0 left-16 w-px bg-mark/70 xl:left-20" />

      <div className="relative flex h-full flex-col justify-between gap-12 py-12 pl-24 pr-12 xl:py-16 xl:pl-32 xl:pr-20">
        <p className="paper label-mono w-fit py-1 pr-2">A learning notebook</p>

        <div className="max-w-xl">
          <h2 className="paper w-fit py-2 pr-3 text-balance text-[2.75rem] font-normal leading-[1.02] tracking-tight xl:text-6xl">
            Learning that finally moves at{" "}
            <Underlined>
              <em>your</em>
            </Underlined>{" "}
            pace.
          </h2>
          <p className="paper mt-6 w-fit max-w-md py-1 pr-2 text-base leading-relaxed text-muted-foreground">
            One topic, written differently for every mind. SMART AI finds out how you think before
            it teaches you anything.
          </p>

          <ol className="paper mt-10 border-t-2 border-foreground">
            {NOTES.map(({ number, text }) => (
              <li
                key={number}
                className="flex items-baseline gap-4 border-b border-foreground/25 py-3.5 text-[15px] last:border-b-0"
              >
                <span className="font-mono text-xs text-primary">{number}</span>
                {text}
              </li>
            ))}
          </ol>
        </div>

        {/* bottom of the page: a contents block with dotted leaders and a pen note */}
        <div className="grid max-w-xl grid-cols-[1fr_auto] items-end gap-8">
          <dl className="paper py-1 pr-2 text-sm">
            <dt className="label-mono mb-2">Contents</dt>
            {CONTENTS.map(([entry, page]) => (
              <dd key={entry} className="flex items-baseline gap-2 py-1">
                <span>{entry}</span>
                <span aria-hidden className="flex-1 translate-y-[-3px] border-b border-dotted border-foreground/40" />
                <span className="font-mono text-xs text-muted-foreground">{page}</span>
              </dd>
            ))}
          </dl>
          <p className="paper max-w-[11rem] -rotate-2 px-1 font-hand text-lg leading-snug text-primary">
            Page one starts the moment you sign in.
          </p>
        </div>
      </div>
    </aside>
  );
}
