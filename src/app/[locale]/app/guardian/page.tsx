import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AiPracticeSwitch } from "@/components/hub/AiPracticeSwitch";
import { requireActor } from "@/server/auth/current";
import { hasRole, homeFor } from "@/server/permissions/can";
import { guardianChildren } from "@/server/services/guardian";

// Personal to the signed-in guardian: never pre-rendered or cached.
export const dynamic = "force-dynamic";

/** Guardian home: each child, where their sign-up stands, and the AI speech practice switch. Attendance arrives later. */
export default async function GuardianHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requireActor("/app/guardian");
  if (!hasRole(actor, "guardian")) {
    const home = homeFor(actor.roles.map((r) => r.role));
    redirect(home === "/app/guardian" ? "/sign-in/no-access" : home);
  }
  const t = await getTranslations("hub");
  const children = await guardianChildren(actor);
  return (
    <>
      <h1 className="t-h2">{t("hello", { name: actor.firstName })}</h1>
      {children.length === 0 ? (
        <div className="card grid gap-2 !p-6">
          <p className="font-medium">{t("guardianTitle")}</p>
          <p className="text-muted">{t("guardianLead")}</p>
        </div>
      ) : (
        <section aria-labelledby="children-h" className="grid gap-4">
          <h2 id="children-h" className="t-h3">
            {t("childrenTitle")}
          </h2>
          <ul className="grid gap-4" role="list">
            {children.map((c) => (
              <li key={c.id} className="card grid gap-4 !p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="t-h3">{c.firstName}</span>
                  <span className={`badge badge--${c.status}`}>{t(`childStatus.${c.status}` as "childStatus.active")}</span>
                </div>
                {c.canSetAi ? (
                  <AiPracticeSwitch studentId={c.id} name={c.firstName} initial={c.aiPractice} />
                ) : (
                  <p className="text-muted">{t("needsPermission", { name: c.firstName })}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
