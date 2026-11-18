import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { DeactivateButton, InviteStaffForm } from "@/components/console/StaffAdmin";
import { requirePermission } from "@/server/auth/current";
import { listStaff, listStates } from "@/server/auth/staff";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("console");
  return { title: t("users") };
}

/** Staff accounts (spec/03 §5): invite, see who has 2-step on, deactivate. */
export default async function UsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await requirePermission("user.manage", "/console/admin/users");
  const t = await getTranslations("console");
  const format = await getFormatter();
  const [staff, states] = await Promise.all([listStaff(actor), listStates()]);
  return (
    <>
      <h1 className="t-h2">{t("users")}</h1>
      <section aria-labelledby="inv-h" className="grid gap-4">
        <h2 id="inv-h" className="t-h3">
          {t("inviteTitle")}
        </h2>
        <InviteStaffForm states={states} />
      </section>
      <section aria-labelledby="staff-h" className="grid gap-4">
        <h2 id="staff-h" className="t-h3">
          {t("staffList", { n: staff.length })}
        </h2>
        {staff.length === 0 ? (
          <p className="text-muted">{t("noStaff")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full min-w-[640px]">
              <thead>
                <tr>
                  <th scope="col">{t("name")}</th>
                  <th scope="col">{t("rolesCol")}</th>
                  <th scope="col">{t("status")}</th>
                  <th scope="col">{t("lastSignIn")}</th>
                  <th scope="col">
                    <span className="sr-only">{t("actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {staff.map((u) => (
                  <tr key={u.userId}>
                    <td>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-[14px] text-muted break-all">{u.email}</div>
                    </td>
                    <td>{u.roles.map((r) => t.has(`role_${r.split(" ")[0]}`) ? `${t(`role_${r.split(" ")[0]}`)}${r.includes(" (") ? r.slice(r.indexOf(" (")) : ""}` : r).join(", ") || "—"}</td>
                    <td>
                      <span className="badge">{t(`us_${u.status}`)}</span>
                    </td>
                    <td className="tabular">{u.lastSignInAt ? format.dateTime(u.lastSignInAt, { dateStyle: "medium" }) : "—"}</td>
                    <td>{u.status !== "deactivated" && u.userId !== actor.userId && <DeactivateButton userId={u.userId} name={u.name} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
