import { PageHeader } from "@/components/common/page-header";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { requireSession } from "@/server/session";

export const metadata = { title: "Impostazioni" };

export default async function SettingsPage() {
  const session = await requireSession();

  const { data: demo } = await session.supabase
    .from("workspaces")
    .select("id, name")
    .eq("owner_id", session.userId)
    .like("slug", "demo-%")
    .maybeSingle();

  return (
    <>
      <PageHeader
        title="Impostazioni"
        description="Profilo, aspetto e contenuto dimostrativo."
      />
      <ProfileSettings
        fullName={session.profile?.full_name ?? ""}
        email={session.email}
        guidanceLevel={session.profile?.guidance_level ?? "balanced"}
        hasDemo={Boolean(demo)}
      />
    </>
  );
}
