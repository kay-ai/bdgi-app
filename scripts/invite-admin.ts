/**
 * Create the first admin (spec/03 §5): there is no sign-up for staff, so someone with database
 * access runs this once. It emails a 72-hour link to set a password and prints it as well.
 *
 *   pnpm auth:invite-admin -- --email you@example.org --first Ada --surname Obi
 */
import { inviteStaff, staffInviteInput } from "../src/server/auth/staff";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const input = staffInviteInput.safeParse({
    email: arg("email"),
    firstName: arg("first"),
    surname: arg("surname"),
    roles: ["admin"],
  });
  if (!input.success) {
    console.error("Usage: pnpm auth:invite-admin -- --email you@example.org --first Ada --surname Obi");
    process.exit(1);
  }
  const r = await inviteStaff(null, input.data, { bootstrap: true });
  if (!r.ok) {
    console.error(`Could not invite: ${r.code}`);
    process.exit(1);
  }
  console.info("Invite sent. The link is valid for 72 hours:");
  console.info(r.link);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
