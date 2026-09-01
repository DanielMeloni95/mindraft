import { notFound } from "next/navigation";

import { DocumentWorkspace, type JsonDoc } from "@/components/editor/document-workspace";
import { getProjectDocument, listDocumentVersions } from "@/server/queries/documents";
import { requireSession } from "@/server/session";

export const metadata = { title: "Documento agentico" };

export default async function ProjectAgenticDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const document = await getProjectDocument(session.supabase, session.workspace.id, id, "agentic");
  if (!document) notFound();
  const versions = await listDocumentVersions(session.supabase, document.id, 15);

  return <DocumentWorkspace documentId={document.id} projectId={id} title={document.title}
    initialContent={document.content as JsonDoc} initialRevision={document.revision}
    versions={versions} canWrite={session.canWrite} agentic />;
}
