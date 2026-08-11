import React, { useState } from "react";
import { ValidationResult, ValidationIssue } from "@grimoire3d/validator";
import { ShieldCheck, ShieldAlert, AlertTriangle, Info, ChevronRight } from "lucide-react";

interface ValidationPanelProps {
  validationResult: ValidationResult;
  onFocusEntity: (entityId: string, entityType: string) => void;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({
  validationResult,
  onFocusEntity,
}) => {
  const [filter, setFilter] = useState<"all" | "error" | "warning" | "info">("all");

  const issues = validationResult.issues.filter((i) => (filter === "all" ? true : i.severity === filter));
  const errorCount = validationResult.issues.filter((i) => i.severity === "error").length;
  const warningCount = validationResult.issues.filter((i) => i.severity === "warning").length;

  return (
    <div className="w-full h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {errorCount > 0 ? (
            <ShieldAlert className="w-5 h-5 text-red-400" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          )}
          <h3 className="font-semibold text-slate-100 text-sm tracking-wide">Deterministic Validation</h3>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-800 p-0.5 rounded border border-slate-700">
          <button
            onClick={() => setFilter("all")}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              filter === "all" ? "bg-slate-700 text-white font-medium" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All ({validationResult.issues.length})
          </button>
          <button
            onClick={() => setFilter("error")}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              filter === "error" ? "bg-red-950 text-red-300 font-medium border border-red-800" : "text-red-400 hover:text-red-300"
            }`}
          >
            Errors ({errorCount})
          </button>
          <button
            onClick={() => setFilter("warning")}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              filter === "warning" ? "bg-amber-950 text-amber-300 font-medium border border-amber-800" : "text-amber-400 hover:text-amber-300"
            }`}
          >
            Warnings ({warningCount})
          </button>
        </div>
      </div>

      <div className="flex-1 p-3 overflow-auto space-y-2 text-xs">
        {issues.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
            <ShieldCheck className="w-10 h-10 text-emerald-400" />
            <p className="font-medium text-emerald-300">Adventure graph is 100% valid!</p>
            <p className="text-slate-400 text-[11px]">All exits resolve, key/lock state-space search passed, and start node connectivity verified.</p>
          </div>
        ) : (
          issues.map((issue, idx) => {
            let bgClass = "bg-slate-900 border-slate-800";
            let icon = <Info className="w-4 h-4 text-sky-400 shrink-0" />;

            if (issue.severity === "error") {
              bgClass = "bg-red-950/30 border-red-800/80 text-red-200 hover:bg-red-950/50";
              icon = <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />;
            } else if (issue.severity === "warning") {
              bgClass = "bg-amber-950/30 border-amber-800/80 text-amber-200 hover:bg-amber-950/50";
              icon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
            }

            return (
              <div
                key={`issue-${idx}`}
                onClick={() => onFocusEntity(issue.entityId, issue.entityType)}
                className={`p-3 rounded border ${bgClass} cursor-pointer transition-all duration-200 flex items-start justify-between gap-3 group`}
              >
                <div className="flex items-start gap-2.5">
                  {icon}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100 uppercase tracking-wide font-mono text-[11px]">
                        {issue.code}
                      </span>
                      <span className="px-1.5 py-0.2 text-[10px] bg-slate-800 text-slate-300 rounded border border-slate-700">
                        {issue.entityType}: {issue.entityId}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-snug">{issue.message}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
