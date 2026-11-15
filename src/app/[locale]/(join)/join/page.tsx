import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Photo } from "@/components/site/Photo";
import type { PhotoKey } from "@/content/photos";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("join.chooser");
  return { title: t("title") };
}

const PATHS: { href: string; key: "student" | "volunteer" | "school"; photo: PhotoKey }[] = [
  { href: "/join/student", key: "student", photo: "programmeDebate" },
  { href: "/join/volunteer", key: "volunteer", photo: "volunteersArriving" },
  { href: "/join/school", key: "school", photo: "session" },
];

/** Join chooser (DESIGN.md §8.2): three full-width linked rows with a photograph thumbnail. */
export default async function JoinChooser({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("join.chooser");
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-[34px] sm:text-[44px]">{t("title")}</h1>
        <p className="text-muted">{t("lead")}</p>
      </div>
      <ul className="grid gap-3" role="list">
        {PATHS.map((p) => (
          <li key={p.key}>
            <Link href={p.href} className="card group flex items-center gap-4 !p-3 pr-5">
              <span className="frame relative block h-20 w-20 flex-none !rounded-[12px] sm:h-24 sm:w-24">
                <Photo slot={p.photo} alt="" sizes="96px" />
              </span>
              <span className="grid flex-1 gap-1">
                <span className="text-[18px] font-medium">{t(p.key)}</span>
                <span className="text-[15px] text-muted">{t(`${p.key}Line`)}</span>
              </span>
              <ArrowRight size={20} strokeWidth={1.5} className="flex-none transition-transform group-hover:translate-x-[3px]" />
            </Link>
          </li>
        ))}
      </ul>
      <p>
        <Link href="/sign-in" className="uline text-[15px]">
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
