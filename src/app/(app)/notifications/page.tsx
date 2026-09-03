import { NotificationList } from "@/components/common/notification-list";
import { requireSession } from "@/server/session";

export const metadata = { title: "Notifiche" };

export default async function NotificationsPage() {
  const session = await requireSession();
  const { data } = await session.supabase
    .from("notifications")
    .select("*")
    .eq("workspace_id", session.workspace.id)
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(100);
  return <div className="mx-auto max-w-3xl space-y-5"><div><h1 className="font-display text-2xl font-semibold">Notifiche</h1><p className="mt-1 text-sm text-muted-foreground">Menzioni e aggiornamenti del workspace.</p></div><NotificationList notifications={data ?? []} /></div>;
}
