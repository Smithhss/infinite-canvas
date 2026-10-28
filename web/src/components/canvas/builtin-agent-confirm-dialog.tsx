import { AlertTriangle, Image as ImageIcon, PencilLine } from "lucide-react";
import { Modal } from "antd";
import { useTranslation } from "react-i18next";

import type { BuiltinAgentConfirmation } from "@/lib/canvas/builtin-canvas-agent/ui-state";

export function BuiltinAgentConfirmDialog({
    confirmation,
    onConfirm,
    onCancel,
}: {
    confirmation: BuiltinAgentConfirmation | null;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const { t } = useTranslation();
    const request = confirmation?.request;
    return (
        <Modal
            open={Boolean(confirmation)}
            centered
            title={t("canvas.builtinAgent.confirmTitle")}
            okText={t("canvas.builtinAgent.confirmRun")}
            cancelText={t("common.cancel")}
            onOk={onConfirm}
            onCancel={onCancel}
            destroyOnHidden
        >
            {confirmation && request ? (
                <div className="space-y-4 pt-2 text-sm">
                    <div className="flex items-start gap-3 rounded-xl border p-3">
                        {request.requiresPayment ? <ImageIcon className="mt-0.5 size-4 shrink-0" /> : <PencilLine className="mt-0.5 size-4 shrink-0" />}
                        <div className="min-w-0">
                            <div className="font-medium">{t(`canvas.builtinAgent.actions.${request.actionName}`)}</div>
                            <div className="mt-1 break-words opacity-60">{confirmation.action.name}</div>
                        </div>
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                        <dt className="opacity-60">{t("canvas.builtinAgent.affectedNodes")}</dt>
                        <dd>
                            {request.targetTitles.length
                                ? t("canvas.builtinAgent.nodeCount", { count: request.targetTitles.length, names: request.targetTitles.join("、") })
                                : request.targetIds.length || t("canvas.builtinAgent.currentCanvas")}
                        </dd>
                        <dt className="opacity-60">{t("canvas.builtinAgent.imageOutputs")}</dt>
                        <dd>{request.imageOutputs}</dd>
                        <dt className="opacity-60">{t("canvas.builtinAgent.budgetAfter")}</dt>
                        <dd>
                            {t("canvas.builtinAgent.budgetSummary", {
                                writes: request.budget.writeActions + (request.writesCanvas ? 1 : 0),
                                media: request.budget.mediaTasks + request.mediaTasks,
                                images: request.budget.imageOutputs + request.imageOutputs,
                            })}
                        </dd>
                    </dl>
                    {request.requiresPayment ? (
                        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-200">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                            <span>{t("canvas.builtinAgent.paymentWarning")}</span>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </Modal>
    );
}
