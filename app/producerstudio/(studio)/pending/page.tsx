import { redirect } from "next/navigation";

// Producer approval removed — everyone has access.
export default function ProducerPendingPage() {
  redirect("/producerstudio");
}
