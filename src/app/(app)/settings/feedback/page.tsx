import { PageHeader } from "@/components/common/page-header";
import { FeedbackForm } from "@/components/settings/feedback-form";
import { requireSession } from "@/server/session";

export const metadata = { title: "Aiuto e feedback" };

export default async function FeedbackPage() {
  await requireSession();

  return (
    <>
      <PageHeader
        title="Aiuto e feedback"
        description="Cosa non funziona, cosa manca, cosa ti ha fatto perdere tempo."
      />
      <FeedbackForm />
    </>
  );
}
