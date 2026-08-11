import React from "react";
import { Provenance } from "@grimoire3d/ir";
import { FileText, CheckCircle2, AlertTriangle, Edit, XCircle, Award } from "lucide-react";

interface ProvenanceInspectorProps {
  provenance?: Provenance;
  onUpdateReviewStatus?: (status: "unreviewed" | "accepted" | "edited" | "rejected") => void;
}

export const ProvenanceInspector: React.FC<ProvenanceInspectorProps> = ({
  provenance,
  onUpdateReviewStatus,
}) => {
  if (!provenance) {
    return (
      <div className="w-full h-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 flex items-center justify-center">
        No provenance quote anchored to this element.
      </div>
    );
  }

  const confidencePct = Math.round((provenance.extraction.confidence || 1.0) * 100);

  const getStatusBadge = () => {
    switch (provenance.review.status) {
      case "accepted":
        return <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Accepted</span>;
      case "edited":
        return <span className="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800 text-xs rounded flex items-center gap-1"><Edit className="w-3 h-3" /> Edited</span>;
      case "rejected":
        return <span className="px-2 py-0.5 bg-red-950 text-red-400 border border-red-800 text-xs rounded flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 text-xs rounded flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Unreviewed</span>;
    }
  };

  return (
    <div className="w-full h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-slate-100 text-sm tracking-wide">Source Provenance</h3>
        </div>
        {getStatusBadge()}
      </div>

      <div className="flex-1 p-4 overflow-auto space-y-4 text-xs">
        {/* Source Quote */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-medium uppercase tracking-wider">Source Quote (Page {provenance.page || 1})</span>
            <span className="font-mono text-indigo-400">ID: {provenance.sourceId}</span>
          </div>
          <blockquote className="p-3 bg-indigo-950/20 border-l-2 border-indigo-500 italic text-indigo-200 rounded-r">
            "{provenance.quote || "No exact text quote available."}"
          </blockquote>
        </div>

        {/* Confidence & Method */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2.5 bg-slate-900 border border-slate-800 rounded space-y-1">
            <span className="text-slate-400 text-[11px] block">Extraction Method</span>
            <span className="font-semibold text-slate-200 uppercase">{provenance.extraction.method}</span>
          </div>
          <div className="p-2.5 bg-slate-900 border border-slate-800 rounded space-y-1">
            <span className="text-slate-400 text-[11px] block">Confidence Score</span>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
              <span className="font-semibold text-indigo-300">{confidencePct}%</span>
            </div>
          </div>
        </div>

        {/* Review Actions */}
        {onUpdateReviewStatus && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-slate-400 font-medium block">Review Actions</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onUpdateReviewStatus("accepted")}
                className="py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded font-medium transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => onUpdateReviewStatus("edited")}
                className="py-1.5 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 rounded font-medium transition-colors"
              >
                Mark Edited
              </button>
              <button
                onClick={() => onUpdateReviewStatus("rejected")}
                className="py-1.5 bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 rounded font-medium transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
