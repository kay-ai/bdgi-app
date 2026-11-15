import { Link } from "@/i18n/navigation";

/** close-type: the h2, one line, the large button across the wrap. */
export function Close({ title, lead, cta, href }: { title: string; lead: string; cta: string; href: string }) {
  return (
    <section className="screen" aria-labelledby="close-h" data-journey-end>
      <div className="wrap justify-center">
        <div className="grid gap-8 border-t border-line pt-16">
          <h2 id="close-h" className="t-h1 max-w-[18ch]">
            {title}
          </h2>
          <p className="t-lead max-w-[52ch] text-muted">{lead}</p>
          <div>
            <Link href={href} className="btn btn--lg">
              {cta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Page head for inner pages: h1 and a lead, text left, picture right (splits never mirror). */
export function PageHead({ title, lead, children }: { title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <section className="screen">
      <div className="wrap">
        <div className="grid12 flex-1 items-center">
          <div className="col-span-6 lg:col-span-5 grid gap-6 self-start">
            <h1 className="t-h1">{title}</h1>
            {lead && <p className="t-lead text-muted">{lead}</p>}
          </div>
          {children && <div className="col-span-6 lg:col-start-7">{children}</div>}
        </div>
      </div>
    </section>
  );
}
