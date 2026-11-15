import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** 404 body: the message, the main routes as plain links, and the way home (spec/04 §6.14). */
export async function NotFoundView() {
  const t = await getTranslations("notFound");
  const tn = await getTranslations("nav");
  const links = [
    ["/programmes", tn("programmes")],
    ["/impact", tn("impact")],
    ["/get-involved", tn("getInvolved")],
    ["/about", tn("about")],
  ] as const;
  return (
    <section className="screen" aria-labelledby="nf-h">
      <div className="wrap justify-center">
        <div className="grid max-w-[720px] gap-8">
          <span className="t-label">404</span>
          <h1 id="nf-h" className="t-h1">
            {t("title")}
          </h1>
          <p className="t-lead text-muted">{t("lead")}</p>
          <ul className="flex flex-wrap gap-x-8 gap-y-3" role="list">
            {links.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="uline">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <div>
            <Link href="/" className="btn btn--lg">
              {t("home")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
