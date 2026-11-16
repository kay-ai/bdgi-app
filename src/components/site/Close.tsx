import { Link } from "@/i18n/navigation";
import type { PhotoKey } from "@/content/photos";
import { Photo } from "./Photo";

/** close-photo: the head row (h2, one line, the main action), then a photograph from line to line. */
export function Close({
  title,
  lead,
  cta,
  href,
  photo = "stage",
}: {
  title: string;
  lead: string;
  cta: string;
  href: string;
  photo?: PhotoKey;
}) {
  return (
    <section className="close-photo" aria-labelledby="close-h" data-journey-end>
      <div className="wrap">
        <div className="close-photo__head">
          <div>
            <h2 id="close-h" className="t-h1 max-w-[16ch]">
              {title}
            </h2>
            <p className="t-lead max-w-[52ch] text-muted">{lead}</p>
          </div>
          <div>
            <Link href={href} className="btn btn--lg">
              {cta}
            </Link>
          </div>
        </div>
        <div className="close-photo__img">
          <Photo slot={photo} alt="" sizes="(max-width: 1440px) 100vw, 1280px" />
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
