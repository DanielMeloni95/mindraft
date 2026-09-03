"use client";

import * as React from "react";
import { CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createCheckoutSessionAction, createCustomerPortalAction } from "@/server/actions/billing";
import type { PlanTier } from "@/types/database";

export function BillingActions({ plan, currentPlan, hasCustomer, enabled, canManage }: { plan: PlanTier; currentPlan: PlanTier; hasCustomer: boolean; enabled: boolean; canManage: boolean }) {
  const [pending, startTransition] = React.useTransition();
  if (!enabled || !canManage || plan === "free" || plan === "team") return null;
  return <Button className="mt-3 w-full" variant={plan === currentPlan ? "secondary" : "primary"} loading={pending} onClick={() => startTransition(async () => {
    const result = plan === currentPlan && hasCustomer ? await createCustomerPortalAction() : await createCheckoutSessionAction(plan);
    if (!result.ok) return void toast.error(result.error);
    window.location.assign(result.data.url);
  })}>{plan === currentPlan && hasCustomer ? <><ExternalLink /> Gestisci abbonamento</> : <><CreditCard /> Passa a questo piano</>}</Button>;
}

export function CustomerPortalButton({ enabled, canManage }: { enabled:boolean; canManage:boolean }) {
  const [pending,startTransition]=React.useTransition();
  if (!enabled || !canManage) return null;
  return <Button variant="secondary" loading={pending} onClick={() => startTransition(async()=>{ const result=await createCustomerPortalAction(); if(!result.ok)return void toast.error(result.error); window.location.assign(result.data.url); })}><ExternalLink /> Portale clienti</Button>;
}

