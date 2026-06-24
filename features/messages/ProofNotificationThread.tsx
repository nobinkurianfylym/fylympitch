"use client";
// app/components/filmmaker/ProofNotificationThread.tsx
// Renders in Filmmaker Messages page as a "PITCH.FYLYM" system thread
// Shows certificate-ready notifications when Bitcoin anchoring completes
// Notification entries are created by check-proof-status Edge Function

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ProofNotification {
  id: string;
  project_id: string;
  proof_id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  project_proofs: {
    id: string;
    ots_status: string;
    bitcoin_block_height: number | null;
    version: number;
    proof_type: string;
    ots_anchored_path: string | null;
    ots_pending_path: string | null;
  } | null;
}

interface ProofNotificationThreadProps {
  filmakerId: string;
  onUnreadChange?: (count: number) => void;
}

export function ProofNotificationThread({
  filmakerId,
  onUnreadChange,
}: ProofNotificationThreadProps) {
  const [notifications, setNotifications] = useState<ProofNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    onUnreadChange?.(unreadCount);
  }, [unreadCount, onUnreadChange]);

  useEffect(() => {
    const supabase = createClient();

    async function fetchNotifications() {
      const { data } = await supabase
        .from("proof_notifications")
        .select(`
          id,
          project_id,
          proof_id,
          title,
          body,
          is_read,
          created_at,
          project_proofs!proof_id (
            id,
            ots_status,
            bitcoin_block_height,
            version,
            proof_type,
            ots_anchored_path,
            ots_pending_path
          )
        `)
        .eq("filmmaker_id", filmakerId)
        .order("created_at", { ascending: false })
        .limit(30);

      setNotifications((data as ProofNotification[]) ?? []);
      setLoading(false);

      // Auto-select first
      if (data && data.length > 0 && !selected) {
        setSelected(data[0].id);
      }
    }

    fetchNotifications();

    // Realtime subscription for new notifications
    const channel = supabase
      .channel("proof_notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "proof_notifications",
          filter: `filmmaker_id=eq.${filmakerId}`,
        },
        (payload) => {
          setNotifications((prev) => [
            payload.new as ProofNotification,
            ...prev,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filmakerId]);

  async function markRead(notificationId: string) {
    const supabase = createClient();
    await supabase
      .from("proof_notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, is_read: true } : n
      )
    );
  }

  async function handleSelect(notification: ProofNotification) {
    setSelected(notification.id);
    if (!notification.is_read) {
      await markRead(notification.id);
    }
  }

  async function downloadCertificate(proofId: string) {
    setDownloadingId(proofId);
    try {
      const res = await fetch(`/api/proofs/${proofId}/certificate`);
      const data = await res.json();
      if (data.url) {
        const a = document.createElement("a");
        a.href = data.url;
        a.download = data.filename || `proof-${proofId.slice(0, 8)}.ots`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } finally {
      setDownloadingId(null);
    }
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) {
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    }
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const selectedNotification = notifications.find((n) => n.id === selected);
  const proof = selectedNotification?.project_proofs;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p
          className="text-[12px] text-[#8A857C]"
          style={{ fontFamily: "Montserrat, sans-serif" }}
        >
          Loading…
        </p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-3"
        style={{ fontFamily: "Montserrat, sans-serif" }}
      >
        <span className="text-[#8A857C]/40 text-4xl">₿</span>
        <p className="text-[12px] text-[#8A857C]">
          Bitcoin anchoring notifications appear here
        </p>
        <p className="text-[11px] text-[#8A857C]/60 text-center max-w-[260px] leading-relaxed">
          When your project proof is anchored to the Bitcoin blockchain, you'll
          receive a certificate download link here.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex h-full"
      style={{ fontFamily: "Montserrat, sans-serif" }}
    >
      {/* Left: notification list */}
      <div className="w-72 border-r border-[#1A1815]/8 flex flex-col shrink-0">
        {/* Thread header */}
        <div className="px-5 py-4 border-b border-[#1A1815]/8">
          <div className="flex items-center gap-2">
            <span className="text-[#BF9953] text-[13px]">₿</span>
            <span
              className="text-[11px] uppercase tracking-[0.12em] text-[#1A1815] font-medium"
            >
              PITCH.FYLYM
            </span>
            {unreadCount > 0 && (
              <span className="ml-auto bg-[#BF9953] text-white text-[9px] rounded-full px-1.5 py-0.5">
                {unreadCount}
              </span>
            )}
          </div>
          <p className="text-[10px] text-[#8A857C] mt-0.5">
            Proof of Existence Certificates
          </p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleSelect(n)}
              className={`w-full text-left px-5 py-3.5 border-b border-[#1A1815]/5 transition-colors ${
                selected === n.id
                  ? "bg-[#BF9953]/8 border-l-2 border-l-[#BF9953]"
                  : "hover:bg-[#1A1815]/3 border-l-2 border-l-transparent"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {!n.is_read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#BF9953] shrink-0" />
                    )}
                    <p
                      className={`text-[11px] truncate ${
                        !n.is_read
                          ? "text-[#1A1815] font-medium"
                          : "text-[#1A1815]"
                      }`}
                    >
                      {n.title.replace("Bitcoin Proof Anchored — ", "")}
                    </p>
                  </div>
                  <p className="text-[10px] text-[#8A857C] truncate">
                    Proof anchored to Bitcoin
                  </p>
                </div>
                <span className="text-[10px] text-[#8A857C] shrink-0">
                  {formatDate(n.created_at)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: notification detail */}
      <div className="flex-1 flex flex-col">
        {selectedNotification ? (
          <>
            {/* Detail header */}
            <div className="px-8 py-5 border-b border-[#1A1815]/8">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[#BF9953]">₿</span>
                <h2
                  className="text-[14px] text-[#1A1815]"
                  style={{ fontFamily: "Playfair Display, serif" }}
                >
                  {selectedNotification.title}
                </h2>
              </div>
              <p className="text-[11px] text-[#8A857C]">
                {new Date(selectedNotification.created_at).toLocaleDateString(
                  "en-US",
                  {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}{" "}
                UTC
              </p>
            </div>

            {/* Body */}
            <div className="flex-1 px-8 py-6 overflow-y-auto">
              {/* Bitcoin anchor card */}
              {proof?.ots_status === "anchored" && (
                <div className="mb-6 border border-[#BF9953]/25 bg-[#BF9953]/5 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[#BF9953] text-xl">₿</span>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-[#BF9953]">
                        Bitcoin Anchored
                      </p>
                      <p className="text-[13px] text-[#1A1815]" style={{ fontFamily: "Playfair Display, serif" }}>
                        Proof of Existence Verified
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-5">
                    {proof.bitcoin_block_height && (
                      <div className="flex gap-4">
                        <span className="text-[10px] uppercase tracking-wider text-[#8A857C] w-24 shrink-0">
                          Block
                        </span>
                        <span className="text-[12px] font-mono text-[#1A1815]">
                          #{proof.bitcoin_block_height.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex gap-4">
                      <span className="text-[10px] uppercase tracking-wider text-[#8A857C] w-24 shrink-0">
                        Version
                      </span>
                      <span className="text-[12px] text-[#1A1815]">
                        {proof.proof_type === "file" ? "Pitch Deck" : "Project Data"} v{proof.version}
                      </span>
                    </div>
                  </div>

                  {/* Download button */}
                  <button
                    onClick={() => downloadCertificate(proof.id)}
                    disabled={downloadingId === proof.id}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1A1815] text-[#F5F5F0] text-[11px] uppercase tracking-[0.12em] hover:bg-[#BF9953] transition-colors disabled:opacity-50"
                  >
                    {downloadingId === proof.id ? (
                      "Generating link…"
                    ) : (
                      <>
                        <span>↓</span>
                        Download .ots Certificate
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Notification body text */}
              <div className="text-[12px] text-[#1A1815]/70 leading-relaxed whitespace-pre-line">
                {selectedNotification.body}
              </div>

              {/* What to do with it */}
              <div className="mt-6 border-t border-[#1A1815]/8 pt-5">
                <p className="text-[11px] uppercase tracking-wider text-[#8A857C] mb-3">
                  What is this certificate?
                </p>
                <div className="space-y-2 text-[11px] text-[#8A857C] leading-relaxed">
                  <p>
                    Your .ots certificate is an independently verifiable
                    cryptographic proof. Anyone with the certificate and your
                    original file can verify the timestamp at{" "}
                    <span className="text-[#1A1815]">opentimestamps.org</span>.
                  </p>
                  <p>
                    Keep this file safely. It works even if Pitch.Fylym no longer
                    exists, because the proof is anchored directly to the Bitcoin
                    blockchain — not our servers.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-[12px] text-[#8A857C]">
              Select a notification
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
