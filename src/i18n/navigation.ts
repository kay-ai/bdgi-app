import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

/**
 * A live session page, always opened with a full page load: the camera and microphone rule
 * (Permissions-Policy) belongs to the document, so moving there inside the app would keep the
 * Hub's rule, which blocks them, and the call couldn't use them (D-025).
 */
export const sessionHref = (id: string, locale: string) => getPathname({ href: `/app/session/${id}`, locale });
