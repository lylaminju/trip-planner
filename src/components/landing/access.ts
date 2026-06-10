import { SERVICE_TITLE } from "@/lib/service-brand";

export const ACCESS_EMAIL = "mjuudev@gmail.com";

const ACCESS_SUBJECT = `${SERVICE_TITLE} access request`;
const ACCESS_BODY = `Hi, I would like to request access to ${SERVICE_TITLE}.`;

export const requestAccessHref = `mailto:${ACCESS_EMAIL}?subject=${encodeURIComponent(
  ACCESS_SUBJECT,
)}&body=${encodeURIComponent(ACCESS_BODY)}`;
