"use client";

import { useEffect, useState } from "react";
import { PlanCard } from "@/components/setup/plan-card";
import { Notice } from "@/components/setup/ui";

export default function BillingPage() {
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const checkout = new URLSearchParams(window.location.search).get("checkout");
    if (checkout) {
      setResult(checkout);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Billing</h1>
        <p className="mt-1 text-sm text-muted">Change your card, cancel, or download invoices under Manage billing.</p>
      </div>
      {result === "success" && <Notice kind="success">Thanks! Your plan is active. It can take a few seconds to show here.</Notice>}
      {result === "cancelled" && <Notice kind="info">Checkout was cancelled. Nothing was charged.</Notice>}
      <PlanCard />
    </div>
  );
}
