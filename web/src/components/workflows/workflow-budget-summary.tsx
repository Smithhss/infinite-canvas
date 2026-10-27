import { Calculator, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { WorkflowBudget } from "@/lib/creative-workflow";

export function WorkflowBudgetSummary({ budget }: { budget: WorkflowBudget }) {
    const { t } = useTranslation();
    return (
        <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 dark:border-stone-800 dark:bg-stone-900/50">
            <div className="flex items-center gap-2 text-xs font-medium text-stone-700 dark:text-stone-200">
                <Calculator className="size-3.5" />
                {t("workflow.budgetTitle")}
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">
                {t("workflow.budgetSummary", { calls: budget.calls, generations: budget.generations, tasks: budget.taskCount })}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] leading-4 text-stone-400">
                <ShieldCheck className="size-3.5 shrink-0" />
                {budget.estimatedQuota === undefined ? t("workflow.noQuote") : t("workflow.quote", { quota: budget.estimatedQuota })}
            </p>
        </div>
    );
}
