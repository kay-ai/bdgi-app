import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { choosePersonAction, signOutAction } from "@/app/actions/auth";
import { currentSession, safeNext } from "@/server/auth/current";
import { profilesForUser } from "@/server/auth/sessions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("signIn");
  return { title: t("whoTitle"), robots: { index: false } };
}

/** The profile chooser (spec/03 §1.1.4): one phone, several people. */
export default async function WhoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);
  const row = await currentSession();
  if (!row || row.session.stage !== "full") redirect("/sign-in");
  const profiles = await profilesForUser(row.user.id);
  if (!profiles.length) redirect("/join");
  const t = await getTranslations("signIn");
  const target = safeNext(next, "") || undefined;
  return (
    <section className="screen" aria-labelledby="sw-h">
      <div className="wrap justify-center">
        <div className="grid w-full max-w-[640px] gap-8">
          <h1 id="sw-h" className="t-h1">
            {t("whoTitle")}
          </h1>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="list">
            {profiles.map((p) => (
              <li key={p.personId}>
                <form action={choosePersonAction.bind(null, p.personId, target)}>
                  <button
                    type="submit"
                    className="card grid h-full w-full justify-items-center gap-3 !p-5 text-center"
                    aria-current={row.session.activePersonId === p.personId || undefined}
                  >
                    <Avatar avatarKey={p.avatarKey} size={72} />
                    <span className="t-h3 break-words">{p.firstName}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <form action={signOutAction}>
            <button type="submit" className="uline text-[15px]">
              {t("notYou")}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
