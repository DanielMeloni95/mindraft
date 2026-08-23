import type { EntityType } from "@/types/database";

/** Shared by the search page, the command palette and the graph. */
export function hrefForResult(result: {
  entity_type: EntityType;
  entity_id: string;
  project_id?: string | null;
}): string {
  switch (result.entity_type) {
    case "idea":
      return `/ideas/${result.entity_id}`;
    case "project":
      return `/projects/${result.entity_id}`;
    case "document":
      return result.project_id ? `/projects/${result.project_id}/document` : "/projects";
    case "task":
      return result.project_id ? `/projects/${result.project_id}/tasks` : "/tasks";
    case "decision":
      return result.project_id ? `/projects/${result.project_id}/decisions` : "/projects";
    case "inbox_item":
      return "/inbox";
    default:
      return "/search";
  }
}
