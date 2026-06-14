"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { archiveConversation, blockUser } from "@/lib/actions";

const supabase = createClient();

type Profile = { id: string; full_name: string | null; role: string; company: string | null };
type Conversation = {
  id: string;
  last_message_at: string | null;
  last_message_text: string | null;
  other_user: Profile | null;
  unread_count: number;
};
type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  status: "sent" | "delivered" | "read";
  created_at: string;
  signed_url?: string | null;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (diff < 7 * 86400) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function Avatar({ name, size = 40 }: { name: string | null; size?: number }) {
  return (
    <div className="rounded-full bg-parchment border border-line flex items-center justify-center font-normal text-ink/70 shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials(name)}
    </div>
  );
}

function FileAttachment({ msg }: { msg: Message }) {
  const [url, setUrl] = useState<string | null>(msg.signed_url ?? null);
  useEffect(() => {
    if (!url && msg.attachment_path) {
      supabase.storage.from("attachments").createSignedUrl(msg.attachment_path, 3600)
        .then(({ data }) => setUrl(data?.signedUrl ?? null));
    }
  }, [msg.attachment_path, url]);

  if (!url) return <span className="text-[12px] text-ash">Loading…</span>;

  if (msg.attachment_type?.startsWith("image/")) {
    return <img src={url} alt={msg.attachment_name ?? "image"} className="max-w-[220px] rounded-card mt-1" />;
  }

  const icon = msg.attachment_type?.includes("pdf") ? "ti-file-type-pdf"
    : msg.attachment_type?.includes("word") || msg.attachment_type?.includes("docx") ? "ti-file-type-doc"
    : msg.attachment_type?.includes("presentation") || msg.attachment_type?.includes("ppt") ? "ti-presentation"
    : "ti-file-text";

  return (
    <a href={url} target="_blank" rel="noreferrer" download={msg.attachment_name}
      className="flex items-center gap-3 px-4 py-3 bg-ivory border border-line rounded-card hover:border-gold transition-colors mt-1"
      style={{ maxWidth: 240 }}>
      <i className={`ti ${icon} text-gold`} style={{ fontSize: 22 }} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[13px] font-normal truncate">{msg.attachment_name}</p>
        <p className="text-[11px] text-ash">{formatSize(msg.attachment_size)}</p>
      </div>
    </a>
  );
}

export default function MessagesClient({
  currentUser,
  initialConversations,
  initialConvId,
}: {
  currentUser: Profile | null;
  initialConversations: Conversation[];
  initialConvId: string | null;
}) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(initialConvId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(!!initialConvId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedConv = conversations.find((c) => c.id === selectedConvId);
  const otherUser = selectedConv?.other_user ?? null;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [messageText]);

  const markAsRead = useCallback(async (convId: string) => {
    if (!currentUser) return;
    await supabase.from("messages").update({ status: "read" })
      .eq("conversation_id", convId).neq("sender_id", currentUser.id).neq("status", "read");
    await supabase.from("conversation_participants").update({ unread_count: 0 })
      .eq("conversation_id", convId).eq("user_id", currentUser.id);
    setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, unread_count: 0 } : c));
  }, [currentUser]);

  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    const { data } = await supabase.from("messages").select("*")
      .eq("conversation_id", convId).order("created_at", { ascending: true }).limit(100);
    setMessages(data ?? []);
    setLoadingMsgs(false);
    markAsRead(convId);
  }, [markAsRead]);

  // Load messages when conversation selected
  useEffect(() => {
    if (selectedConvId) loadMessages(selectedConvId);
  }, [selectedConvId, loadMessages]);

  // Real-time: messages in selected conversation
  useEffect(() => {
    if (!selectedConvId) return;
    const channel = supabase.channel(`msgs-${selectedConvId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages",
        filter: `conversation_id=eq.${selectedConvId}` }, (payload) => {
        const msg = payload.new as Message;
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (msg.sender_id !== currentUser?.id) markAsRead(selectedConvId);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages",
        filter: `conversation_id=eq.${selectedConvId}` }, (payload) => {
        setMessages((prev) => prev.map((m) => m.id === payload.new.id ? { ...m, ...payload.new } : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConvId, currentUser?.id, markAsRead]);

  // Real-time: conversation list updates (new messages from other convs)
  useEffect(() => {
    const channel = supabase.channel("conv-list-updates")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, (payload) => {
        setConversations((prev) => {
          const updated = prev.map((c) => c.id === payload.new.id
            ? { ...c, last_message_text: payload.new.last_message_text, last_message_at: payload.new.last_message_at }
            : c
          ).sort((a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime());
          return updated;
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_participants",
        filter: `user_id=eq.${currentUser?.id}` }, (payload) => {
        if (payload.new.user_id === currentUser?.id) {
          setConversations((prev) => prev.map((c) =>
            c.id === payload.new.conversation_id ? { ...c, unread_count: payload.new.unread_count } : c
          ));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  async function handleSend() {
    if (!selectedConvId || !messageText.trim() || !currentUser) return;
    const text = messageText.trim();
    setMessageText("");
    await supabase.from("messages").insert({
      conversation_id: selectedConvId,
      sender_id: currentUser.id,
      body: text,
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedConvId || !currentUser) return;
    if (file.size > 25 * 1024 * 1024) { alert("File must be under 25 MB."); return; }
    setUploading(true);
    const path = `${currentUser.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
    if (!error) {
      await supabase.from("messages").insert({
        conversation_id: selectedConvId, sender_id: currentUser.id,
        attachment_path: path, attachment_name: file.name,
        attachment_type: file.type, attachment_size: file.size,
      });
    }
    setUploading(false);
    e.target.value = "";
  }

  function selectConversation(id: string) {
    setSelectedConvId(id);
    setMobileShowChat(true);
    setShowMenu(false);
    router.replace(`/dashboard/messages?conv=${id}`, { scroll: false });
  }

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const name = c.other_user?.full_name?.toLowerCase() ?? "";
    const company = c.other_user?.company?.toLowerCase() ?? "";
    const q = search.toLowerCase();
    return name.includes(q) || company.includes(q);
  });

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count ?? 0), 0);

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden bg-ivory" style={{ minHeight: 600 }}>
      {/* ── LEFT PANEL ── */}
      <div className={`${mobileShowChat ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 border-r border-line bg-white shrink-0`}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-line">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-[20px]">
              Messages {totalUnread > 0 && (
                <span className="ml-2 text-[12px] font-normal bg-ink text-ivory px-2 py-0.5 rounded-full">{totalUnread}</span>
              )}
            </h2>
          </div>
          <div className="relative">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-ash" style={{ fontSize: 15 }} aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or company…"
              className="field !pl-9 !py-2 text-[13px] w-full"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-5 py-12 text-center">
              <i className="ti ti-message-dots text-ash" style={{ fontSize: 32 }} aria-hidden="true" />
              <p className="text-[14px] text-ash mt-3">
                {search ? "No conversations match." : "No messages yet. Start a conversation from a project or profile."}
              </p>
            </div>
          )}
          {filtered.map((conv) => (
            <button key={conv.id} onClick={() => selectConversation(conv.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-line/50 hover:bg-ivory transition-colors text-left ${selectedConvId === conv.id ? "bg-ivory border-l-2 border-l-gold" : ""}`}>
              <Avatar name={conv.other_user?.full_name ?? null} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-normal text-[14px] truncate">{conv.other_user?.full_name ?? "Unknown"}</span>
                  {conv.last_message_at && (
                    <span className="text-[11px] text-ash shrink-0">{formatTime(conv.last_message_at)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-[12px] text-ash truncate">{conv.last_message_text ?? "Start the conversation"}</p>
                  {(conv.unread_count ?? 0) > 0 && (
                    <span className="bg-ink text-ivory text-[10px] rounded-full px-1.5 py-0.5 shrink-0">{conv.unread_count}</span>
                  )}
                </div>
                <p className="text-[11px] text-ash/60 mt-0.5 capitalize">{conv.other_user?.role ?? ""}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className={`${!mobileShowChat ? "hidden md:flex" : "flex"} flex-col flex-1 min-w-0`}>
        {!selectedConvId || !otherUser ? (
          <div className="flex-1 flex items-center justify-center text-center px-8">
            <div>
              <i className="ti ti-messages text-ash" style={{ fontSize: 48 }} aria-hidden="true" />
              <p className="font-display text-[22px] mt-4">Select a conversation</p>
              <p className="text-[14px] text-ash mt-2">Choose a conversation from the left to start messaging.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-line bg-white">
              <button onClick={() => { setMobileShowChat(false); setSelectedConvId(null); }}
                className="md:hidden text-ash hover:text-ink mr-1">
                <i className="ti ti-arrow-left" style={{ fontSize: 20 }} aria-hidden="true" />
              </button>
              <Avatar name={otherUser.full_name} size={40} />
              <div className="flex-1 min-w-0">
                <p className="font-normal text-[15px]">{otherUser.full_name}</p>
                <p className="text-[12px] text-ash capitalize">{otherUser.role}{otherUser.company ? ` · ${otherUser.company}` : ""}</p>
              </div>

              {/* Chat menu */}
              <div className="relative">
                <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-card hover:bg-ivory transition-colors" aria-label="Chat options">
                  <i className="ti ti-dots-vertical text-ash" style={{ fontSize: 18 }} aria-hidden="true" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-line rounded-card shadow-sm z-10">
                    <form action={archiveConversation}>
                      <input type="hidden" name="conversation_id" value={selectedConvId} />
                      <button type="submit" onClick={() => setShowMenu(false)}
                        className="w-full text-left px-4 py-3 text-[13px] hover:bg-ivory transition-colors flex items-center gap-3">
                        <i className="ti ti-archive" style={{ fontSize: 15 }} aria-hidden="true" />
                        Archive chat
                      </button>
                    </form>
                    <form action={blockUser}>
                      <input type="hidden" name="blocked_id" value={otherUser.id} />
                      <button type="submit" onClick={() => setShowMenu(false)}
                        className="w-full text-left px-4 py-3 text-[13px] text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3">
                        <i className="ti ti-ban" style={{ fontSize: 15 }} aria-hidden="true" />
                        Block user
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" onClick={() => setShowMenu(false)}>
              {loadingMsgs && (
                <div className="text-center py-8 text-ash text-[13px]">Loading messages…</div>
              )}
              {!loadingMsgs && messages.length === 0 && (
                <div className="text-center py-12 text-ash text-[14px]">
                  No messages yet. Say hello!
                </div>
              )}
              {messages.map((msg, i) => {
                const isMine = msg.sender_id === currentUser?.id;
                const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString();
                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="text-center py-2">
                        <span className="text-[11px] text-ash bg-ivory px-3 py-1 rounded-full">
                          {new Date(msg.created_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div style={{ maxWidth: "72%" }}>
                        <div className={`px-4 py-2.5 rounded-card ${isMine ? "bg-ink text-ivory rounded-br-sm" : "bg-white border border-line text-ink rounded-bl-sm"}`}>
                          {msg.body && <p className="text-[14px] leading-[1.55] whitespace-pre-wrap">{msg.body}</p>}
                          {msg.attachment_path && <FileAttachment msg={msg} />}
                        </div>
                        <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
                          <span className="text-[10px] text-ash">
                            {new Date(msg.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {isMine && (
                            <span className="text-[10px]" title={msg.status}>
                              {msg.status === "read" ? <span className="text-gold">✓✓</span>
                                : msg.status === "delivered" ? <span className="text-ash">✓✓</span>
                                : <span className="text-ash/50">✓</span>}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-line bg-white px-4 py-3">
              {uploading && (
                <div className="text-[12px] text-ash mb-2 flex items-center gap-2">
                  <i className="ti ti-loader animate-spin" style={{ fontSize: 14 }} aria-hidden="true" /> Uploading file…
                </div>
              )}
              <div className="flex items-end gap-3">
                <button onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-card hover:bg-ivory transition-colors text-ash hover:text-ink shrink-0" aria-label="Attach file">
                  <i className="ti ti-paperclip" style={{ fontSize: 20 }} aria-hidden="true" />
                </button>
                <input ref={fileInputRef} type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp"
                  className="hidden" onChange={handleFileUpload} />
                <textarea
                  ref={textareaRef}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                  rows={1}
                  className="field flex-1 resize-none !py-2.5 text-[14px] overflow-hidden"
                  style={{ lineHeight: "1.5" }}
                />
                <button onClick={handleSend}
                  disabled={!messageText.trim()}
                  className="p-2.5 rounded-card bg-ink text-ivory hover:bg-ink/80 disabled:opacity-30 transition-colors shrink-0" aria-label="Send message">
                  <i className="ti ti-send" style={{ fontSize: 18 }} aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
