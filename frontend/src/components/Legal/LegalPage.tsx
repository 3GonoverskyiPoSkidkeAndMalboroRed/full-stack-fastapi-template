import type { ReactNode } from "react"

export interface LegalSection {
  heading: string
  body: ReactNode
}

interface LegalPageProps {
  kicker: string
  title: string
  effectiveDate: string
  intro?: ReactNode
  sections: LegalSection[]
}

export function LegalPage({
  kicker,
  title,
  effectiveDate,
  intro,
  sections,
}: LegalPageProps) {
  return (
    <section>
      <header className="sec-head">
        <div>
          <div className="mono text-muted-foreground mb-3 text-[11px] tracking-[0.2em] uppercase">
            {kicker}
          </div>
          <h2>{title}</h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-muted-foreground text-[11px] tracking-[0.2em] uppercase">
            Действует с
          </span>
          <span className="mono text-[12px] tracking-[0.08em]">
            {effectiveDate}
          </span>
        </div>
      </header>

      <div className="frame max-w-[920px] py-10">
        {intro && (
          <p className="text-muted-foreground mb-10 text-[15px] leading-[1.55]">
            {intro}
          </p>
        )}
        <div className="space-y-10">
          {sections.map((section, index) => (
            <article
              key={section.heading}
              className="border-ink/20 border-b border-dashed pb-8 last:border-b-0"
            >
              <header className="mb-4 flex items-baseline gap-4">
                <span className="mono text-muted-foreground text-[12px] tracking-[0.12em]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-[22px] leading-[1.2] font-semibold tracking-[-0.01em]">
                  {section.heading}
                </h3>
              </header>
              <div className="text-[15px] leading-[1.65] [&_a]:underline [&_a]:underline-offset-2 [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p+p]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
                {section.body}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
