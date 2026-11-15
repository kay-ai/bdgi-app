import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Cover } from "@/components/site/Cover";
import { Close } from "@/components/site/Close";
import { formatDate } from "@/lib/format";
import { bodyParagraphs, getStory } from "@/server/services/content";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await getStory(slug);
  return s ? { title: s.titleEn, description: s.excerptEn } : {};
}

export default async function StoryPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const story = await getStory(slug);
  if (!story) notFound();
  const t = await getTranslations("stories");
  const th = await getTranslations("home");
  const tc = await getTranslations("common");
  const paras = bodyParagraphs(story.bodyEn);
  const minutes = Math.max(1, Math.round(paras.join(" ").split(/\s+/).length / 200));

  return (
    <>
      <article className="wrap py-16 lg:py-24">
        <Link href="/stories" className="uline t-small text-muted">
          {t("back")}
        </Link>
        <header className="mt-8 grid max-w-[760px] gap-4">
          <h1 className="t-h1">{story.titleEn}</h1>
          <p className="t-lead text-muted">{story.excerptEn}</p>
          <p className="t-small text-muted">
            {[story.authorName, story.publishedAt && formatDate(story.publishedAt, locale), t("minutes", { n: minutes })].filter(Boolean).join(" · ")}
          </p>
        </header>
        <div className="frame mt-10 aspect-[16/9] w-full">
          <Cover src={story.coverKey} alt={story.coverAlt ?? ""} fallback="storyA" priority />
        </div>
        <div className="mt-12 grid max-w-[680px] gap-6 text-[18px] leading-[1.7]">
          {paras.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </article>
      <Close title={th("close.title")} lead={th("close.lead")} cta={tc("joinProgramme")} href="/join" />
    </>
  );
}
