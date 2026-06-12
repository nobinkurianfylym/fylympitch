import ProjectForm from "@/components/ProjectForm";

export const dynamic = "force-dynamic";

export default function NewProjectPage() {
  return (
    <div>
      <p className="eyebrow mb-3">New project</p>
      <h1 className="font-display text-[34px]">Submit your project</h1>
      <p className="mt-3 text-[14px] text-ash max-w-xl">
        The more complete the profile, the more accurate your matches. Files go to
        private storage — only verified industry accounts can request access.
      </p>
      <div className="mt-10">
        <ProjectForm />
      </div>
    </div>
  );
}
