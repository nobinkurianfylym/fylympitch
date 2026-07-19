"use server";

// Thin server-action wrapper so the pipeline form can live inside a client
// component while keeping lib/actions out of any static import graph
// (Cloudflare Workers CPU rule: heavy modules load via await import()).
export async function addToPipeline(formData: FormData) {
  const { upsertProducerProject } = await import("@/lib/actions");
  await upsertProducerProject(formData);
}
