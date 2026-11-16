import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Shape } from "@/components/site/Shape";
import { Cover } from "@/components/site/Cover";
import { formatDate } from "@/lib/format";
import { listStories } from "@/server/services/content";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("stories");
  return { title: t("title"), description: t("lead") };
}

export default async function StoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("stories");
  const stories = await listStories();
  const [featured, ...rest] = stories;

  if (!featured) {
    return (
      <section className="screen" aria-labelledby="stories-h">
        <div className="wrap">
          <div className="grid12 flex-1 items-center">
            <div className="col-span-6 grid gap-6 self-start lg:col-span-5">
              <h1 id="stories-h" className="t-h1">
                {t("title")}
              </h1>
              <p className="t-lead text-muted">{t("lead")}</p>
              <p>{t("empty")}</p>
              <div className="flex flex-wrap gap-6">
                <Link href="/programmes" className="link">
                  {t("programmesLink")}
                </Link>
                <Link href="/impact" className="link">
                  {t("impactLink")}
                </Link>
              </div>
            </div>
            <div className="col-span-6 lg:col-start-7">
              <Shape shape="arch" slot="storyA" alt={t("photoAlt")} priority />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="wrap py-16 lg:py-24">
      <div className="section-head">
        <h1 className="t-h1">{t("title")}</h1>
        <p className="t-lead">{t("lead")}</p>
      </div>
      <Link href={`/stories/${featured.slug}`} className="card group grid gap-8 !p-0 overflow-hidden lg:grid-cols-2">
        <div className="frame aspect-[4/3] !rounded-none">
          <Cover src={featured.coverKey} alt={featured.coverAlt ?? ""} fallback="storyA" priority />
        </div>
        <div className="grid content-center gap-4 p-6 lg:p-10">
          {featured.publishedAt && <span className="t-label">{formatDate(featured.publishedAt, locale)}</span>}
          <h2 className="t-h2">{featured.title}</h2>
          <p className="text-muted">{featured.excerpt}</p>
          <span className="link">{t("read")}</span>
        </div>
      </Link>
      {rest.length > 0 && (
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {rest.map((s) => (
            <li key={s.id}>
              <Link href={`/stories/${s.slug}`} className="card group grid h-full content-start gap-4 !p-0 overflow-hidden">
                <div className="frame aspect-[3/2] !rounded-none">
                  <Cover src={s.coverKey} alt={s.coverAlt ?? ""} fallback="storyB" />
                </div>
                <div className="grid gap-2 px-5 pb-6">
                  {s.publishedAt && <span className="t-label">{formatDate(s.publishedAt, locale)}</span>}
                  <h2 className="t-h3">{s.title}</h2>
                  <p className="text-muted">{s.excerpt}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
