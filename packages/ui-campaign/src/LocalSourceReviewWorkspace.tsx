import React, { useState } from "react";
import { LocalSourceProvenance } from "@grimoire3d/campaign-ir";
import { LocalSourceManifest } from "@grimoire3d/importers";
import { FileSearch, CheckCircle2, XCircle, Edit3, ShieldAlert, Sparkles } from "lucide-react";

interface LocalSourceReviewWorkspaceProps {
  manifest?: LocalSourceManifest;
}

export const LocalSourceReviewWorkspace: React.FC<LocalSourceReviewWorkspaceProps> = ({ manifest }) => {
  const [candidateList, setCandidateList] = useState<
    Array<{
      id: string;
      kind: string;
      label: string;
      provenance: LocalSourceProvenance;
    }>
  >([
    {
      id: "cand-hub-1",
      kind: "Hub Service Candidate",
      label: "Border Keep Armorer",
      provenance: {
        sourceId: manifest?.sourceId || "local-pdf-01",
        documentHash: manifest?.documentHash || "doc-hash-123",
        page: 4,
        quoteHash: "qhash-8812",
        quotePreview: "The keep armorer sells chain mail for 40 gp and shields for 10 gp...",
        extractionMethod: "text-parser",
        confidence: 0.9,
        review: { status: "unreviewed" },
      },
    },
    {
      id: "cand-dungeon-1",
      kind: "Dungeon Room Candidate",
      label: "Guard Post Alcove",
      provenance: {
        sourceId: manifest?.sourceId || "local-pdf-01",
        documentHash: manifest?.documentHash || "doc-hash-123",
        page: 12,
        quoteHash: "qhash-9901",
        quotePreview: "Four goblin guards watch the corridor from behind low stone barricades...",
        extractionMethod: "manual",
        confidence: 0.95,
        review: { status: "unreviewed" },
      },
    },
  ]);

  const handleUpdateStatus = (id: string, newStatus: "accepted" | "edited" | "rejected") => {
    setCandidateList((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            provenance: {
              ...c.provenance,
              review: { status: newStatus, reviewedAt: new Date().toISOString() },
            },
          };
        }
        return c;
      })
    );
  };

  return (
    <div className="w-full h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col p-4 space-y-4">
      <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-800">
        <div className="flex items-center gap-2">
          <FileSearch className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-slate-100 text-sm">Local Source Review Workspace (Local-Only)</h3>
          <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-mono">
            QUARANTINED WORKSPACE
          </span>
        </div>
        {manifest && (
          <span className="text-xs font-mono text-slate-400">
            Source: {manifest.sourceId} ({manifest.pageCount} Pages)
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto space-y-3">
        {candidateList.map((cand) => (
          <div key={cand.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-indigo-300">{cand.label}</span>
              <span className="text-[10px] text-slate-400 uppercase font-mono">
                Status: {cand.provenance.review.status} • Page {cand.provenance.page}
              </span>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950 p-2 rounded border border-slate-800 font-mono">
              "{cand.provenance.quotePreview}"
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleUpdateStatus(cand.id, "accepted")}
                className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-xs rounded flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3" /> Accept Candidate
              </button>
              <button
                onClick={() => handleUpdateStatus(cand.id, "edited")}
                className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 text-xs rounded flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" /> Edit
              </button>
              <button
                onClick={() => handleUpdateStatus(cand.id, "rejected")}
                className="px-2.5 py-1 bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 text-xs rounded flex items-center gap-1"
              >
                <XCircle className="w-3 h-3" /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
