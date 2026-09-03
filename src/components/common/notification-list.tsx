"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/server/actions/notifications";
import type { NotificationRow } from "@/types/database";

export function NotificationList({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const destination = (item: NotificationRow) =>
    item.entity_type === "project" && item.entity_id
      ? `/projects/${item.entity_id}/collaboration`
      : "/home";

  return <div className="space-y-3">
    {notifications.some((item) => !item.read_at) && <div className="flex justify-end">
      <Button variant="secondary" loading={pending} onClick={() => startTransition(async () => {
        const result = await markAllNotificationsReadAction();
        if (!result.ok) return void toast.error(result.error);
        router.refresh();
      })}><CheckCheck /> Segna tutte come lette</Button>
    </div>}
    <ul className="space-y-2">{notifications.map((item) => <li key={item.id} className="surface-card p-4">
      <Link href={destination(item)} onClick={() => !item.read_at && startTransition(async () => {
        const result = await markNotificationReadAction(item.id);
        if (!result.ok) toast.error(result.error);
      })} className="block">
        <div className="flex items-start gap-3">
          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read_at ? "bg-border" : "bg-primary"}`} />
          <div><p className="text-sm font-semibold">{item.title}</p>{item.body && <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>}<time className="mt-2 block text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleString("it-IT")}</time></div>
        </div>
      </Link>
    </li>)}</ul>
    {notifications.length === 0 && <div className="surface-card p-8 text-center text-sm text-muted-foreground">Non ci sono ancora notifiche.</div>}
  </div>;
}
