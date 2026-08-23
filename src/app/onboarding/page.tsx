import { redirect } from "next/navigation";

import { requireSession } from "@/server/session";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata = { title: "Iniziamo" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await requireSession();
  if (session.profile?.onboarding_completed_at) redirect("/home");

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-10">
      <main id="contenuto">
        <OnboardingFlow
          defaultName={session.profile?.full_name ?? ""}
          startStep={session.profile?.onboarding_step ?? 0}
        />
      </main>
    </div>
  );
}
