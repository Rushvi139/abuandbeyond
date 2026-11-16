import { Suspense } from "react";
import { FinanceTabs } from "@/components/admin/finance-tabs";

/** Every Finance screen shares the tab row; each page still checks its own role. */
export default function AccountsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={<div className="h-10 border-b border-line" />}>
        <FinanceTabs />
      </Suspense>
      {children}
    </div>
  );
}
