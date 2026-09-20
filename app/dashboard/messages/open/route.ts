import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Opening a conversation from a notification.
//
// A "producer interest" notification used to link to the filmmaker's own
// project page, which told them nothing they did not already know. What they
// want is to reply to the producer -- and that cannot be a plain href, because
// the conversation may not exist yet and has to be created first.
//
// So the notification links here. This resolves (project, producer) to a
// conversation and forwards to the inbox, which keeps the notification row a
// single ordinary link: no client JS, no button nested inside an anchor.
//
// initiate_project_conversation is idempotent -- a UNIQUE constraint on
// (project, producer, filmmaker) means a second click returns the same
// conversation rather than making another one.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Always land somewhere sensible. A failure here is a dead notification, not
 *  an error page: send them to the inbox and let them find the thread. */
function inbox(req: NextRequest, conv?: string) {
  const url = new URL("/dashboard/messages", req.nextUrl.origin);
  if (conv) url.searchParams.set("conv", conv);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const projectId  = req.nextUrl.searchParams.get("project");
  const producerId = req.nextUrl.searchParams.get("producer");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(login);
  }

  if (!projectId || !producerId || !UUID.test(projectId) || !UUID.test(producerId)) {
    return inbox(req);
  }

  // The caller is the filmmaker here. The RPC re-checks everything that
  // matters -- caller is one of the two parties, the two are not the same
  // person, and the project really is owned by the filmmaker -- so passing
  // user.id is a claim it verifies rather than one it trusts.
  const { data: conversationId, error } = await supabase.rpc("initiate_project_conversation", {
    p_project_id:   projectId,
    p_producer_id:  producerId,
    p_filmmaker_id: user.id,
  });

  if (error || !conversationId) {
    console.error("[messages/open] could not open conversation:", error?.message);
    return inbox(req);
  }

  return inbox(req, conversationId as string);
}
