import { LegalPage, legalMetadata } from "@/components/site/LegalPage";

export const metadata = legalMetadata("terms");

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <LegalPage docKey="terms" locale={locale} />;
}
