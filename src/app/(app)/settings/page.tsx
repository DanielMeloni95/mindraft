import { PageHeader } from "@/components/common/page-header";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { WorkspaceCollaboration } from "@/components/settings/workspace-collaboration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [{data:members},{data:invitations}]=await Promise.all([
    session.supabase.from("workspace_members").select("user_id,role").eq("workspace_id",session.workspace.id),
    session.supabase.from("workspace_invitations").select("id,email,role,expires_at").eq("workspace_id",session.workspace.id).is("accepted_at",null).order("created_at",{ascending:false}),
  ]);
  const {data:memberProfiles}=members?.length?await session.supabase.from("profiles").select("id,full_name").in("id",members.map(m=>m.user_id)):{data:[]};

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
      <Card className="mt-4"><CardHeader><CardTitle>Collaborazione · {session.workspace.name}</CardTitle></CardHeader><CardContent><WorkspaceCollaboration canAdmin={["owner","admin"].includes(session.role)} members={(members??[]).map((m)=>({id:m.user_id,role:m.role,name:memberProfiles?.find(p=>p.id===m.user_id)?.full_name??"Membro"}))} pendingInvites={invitations??[]}/></CardContent></Card>
    </>
  );
}
