/**
 * Hand-maintained mirror of supabase/migrations/*.sql.
 *
 * Regenerating with `supabase gen types typescript` produces the same
 * shape; this file exists so the project type-checks without a live
 * project. Keep it in sync when you add a migration — `npm run db:verify`
 * checks the SQL, this file checks the TypeScript.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** Insert = required columns + every other column optional. */
type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";
export type PlanTier = "free" | "personal" | "pro" | "team";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";
export type InboxKind = "text" | "url" | "image" | "file" | "audio";
export type InboxStatus = "unprocessed" | "processed" | "archived";
export type IdeaStatus =
  | "inbox"
  | "to_explore"
  | "analyzing"
  | "promising"
  | "converted"
  | "paused"
  | "discarded"
  | "archived";
export type IdeaMaturity = "spark" | "sketch" | "shaped" | "validated";
export type ProjectStatus =
  | "idea"
  | "exploration"
  | "validation"
  | "design"
  | "development"
  | "paused"
  | "completed"
  | "archived";
export type ProjectHealth = "unknown" | "on_track" | "at_risk" | "blocked";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type DecisionStatus = "proposed" | "approved" | "superseded";
export type SeverityLevel = "low" | "medium" | "high";
export type MilestoneStatus = "planned" | "in_progress" | "done" | "canceled";
export type EntityType =
  | "inbox_item"
  | "idea"
  | "project"
  | "document"
  | "goal"
  | "milestone"
  | "task"
  | "decision"
  | "risk"
  | "resource"
  | "canvas_node"
  | "note";
export type RelationType =
  | "derives_from"
  | "depends_on"
  | "supports"
  | "contradicts"
  | "part_of"
  | "blocks"
  | "replaces"
  | "relates_to";
export type CanvasNodeType =
  | "idea"
  | "project"
  | "note"
  | "goal"
  | "feature"
  | "task"
  | "decision"
  | "risk"
  | "resource"
  | "text"
  | "group";
export type AiRunStatus = "pending" | "running" | "succeeded" | "failed";
export type AiProposalStatus =
  | "pending"
  | "applied"
  | "partially_applied"
  | "rejected"
  | "expired";
export type ContentOrigin = "user" | "ai" | "import";

type Timestamps = {
  created_at: string;
  updated_at: string;
};

export type ProfileRow = Timestamps & {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  locale: string;
  primary_use: string | null;
  focus_areas: string[];
  guidance_level: "minimal" | "balanced" | "guided";
  onboarding_completed_at: string | null;
  onboarding_step: number;
  dashboard_modules: Json;
};

export type WorkspaceRow = Timestamps & {
  id: string;
  name: string;
  slug: string;
  is_personal: boolean;
  owner_id: string;
  plan: PlanTier;
  settings: Json;
  deleted_at: string | null;
};

export type WorkspaceMemberRow = Timestamps & {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  invited_by: string | null;
  accepted_at: string;
};

export type WorkspaceInvitationRow = Timestamps & {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
};

export type SubscriptionRow = Timestamps & {
  id: string;
  workspace_id: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
};

export type UsageLedgerRow = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  kind: "ai_credits" | "storage_bytes" | "export" | "import";
  amount: number;
  reference_type: EntityType | null;
  reference_id: string | null;
  metadata: Json;
  occurred_at: string;
};

export type FeatureFlagRow = Timestamps & {
  key: string;
  description: string | null;
  enabled: boolean;
  audience: Json;
};

export type InboxItemRow = Timestamps & {
  id: string;
  workspace_id: string;
  created_by: string;
  kind: InboxKind;
  content: string;
  url: string | null;
  url_title: string | null;
  url_metadata: Json;
  status: InboxStatus;
  project_id: string | null;
  idea_id: string | null;
  processed_at: string | null;
  deleted_at: string | null;
};

export type IdeaRow = Timestamps & {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  original_content: string;
  summary: string | null;
  problem: string | null;
  solution: string | null;
  audience: string | null;
  expected_value: string | null;
  personal_motivation: string | null;
  category: string | null;
  status: IdeaStatus;
  maturity: IdeaMaturity;
  project_id: string | null;
  source_inbox_item_id: string | null;
  is_favorite: boolean;
  last_ai_run_id: string | null;
  deleted_at: string | null;
};

export type IdeaScoreRow = Timestamps & {
  id: string;
  workspace_id: string;
  idea_id: string;
  criterion: string;
  value: number;
  weight: number;
  note: string | null;
};

export type ProjectRow = Timestamps & {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  emoji: string | null;
  color: string | null;
  short_description: string | null;
  vision: string | null;
  problem: string | null;
  solution: string | null;
  audience: string | null;
  value_proposition: string | null;
  website_url: string | null;
  domain: string | null;
  scope_in: string | null;
  scope_out: string | null;
  status: ProjectStatus;
  health: ProjectHealth;
  progress: number;
  cost_estimate: number | null;
  cost_currency: string;
  stack: string[];
  source_idea_id: string | null;
  parent_project_id: string | null;
  next_step: string | null;
  is_favorite: boolean;
  last_activity_at: string;
  deleted_at: string | null;
};

export type ProjectSectionRow = Timestamps & {
  id: string;
  workspace_id: string;
  project_id: string;
  key: string;
  title: string;
  content: string;
  origin: ContentOrigin;
  position: number;
  approved_at: string | null;
};

export type DocumentRow = Timestamps & {
  id: string;
  workspace_id: string;
  created_by: string;
  project_id: string | null;
  idea_id: string | null;
  title: string;
  content: Json;
  plain_text: string;
  revision: number;
  last_version_at: string;
  deleted_at: string | null;
};

export type DocumentVersionRow = {
  id: string;
  workspace_id: string;
  document_id: string;
  revision: number;
  content: Json;
  plain_text: string;
  content_hash: string;
  label: string | null;
  created_by: string | null;
  created_at: string;
};

export type GoalRow = Timestamps & {
  id: string;
  workspace_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  metric: string | null;
  target_value: string | null;
  current_value: string | null;
  due_date: string | null;
  is_achieved: boolean;
  position: number;
  deleted_at: string | null;
};

export type MilestoneRow = Timestamps & {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  description: string | null;
  phase: string | null;
  version_label: string | null;
  status: MilestoneStatus;
  starts_on: string | null;
  ends_on: string | null;
  progress: number;
  is_estimate: boolean;
  position: number;
  deleted_at: string | null;
};

export type ChecklistItem = { id: string; title: string; done: boolean };

export type TaskRow = Timestamps & {
  id: string;
  workspace_id: string;
  created_by: string;
  project_id: string | null;
  milestone_id: string | null;
  assignee_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  estimate_minutes: number | null;
  checklist: Json;
  origin_type: EntityType | null;
  origin_id: string | null;
  position: number;
  completed_at: string | null;
  deleted_at: string | null;
};

export type TaskDependencyRow = {
  task_id: string;
  depends_on_task_id: string;
  workspace_id: string;
  created_at: string;
};

export type DecisionRow = Timestamps & {
  id: string;
  workspace_id: string;
  created_by: string;
  project_id: string | null;
  title: string;
  context: string | null;
  alternatives: string | null;
  rationale: string | null;
  consequences: string | null;
  status: DecisionStatus;
  decided_on: string | null;
  supersedes_id: string | null;
  deleted_at: string | null;
};

export type RiskRow = Timestamps & {
  id: string;
  workspace_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  likelihood: SeverityLevel;
  impact: SeverityLevel;
  mitigation: string | null;
  is_open: boolean;
  deleted_at: string | null;
};

export type ResourceRow = Timestamps & {
  id: string;
  workspace_id: string;
  project_id: string | null;
  idea_id: string | null;
  title: string;
  url: string | null;
  kind: "link" | "file" | "person" | "tool" | "budget" | "note";
  notes: string | null;
  deleted_at: string | null;
};

export type CanvasRow = Timestamps & {
  id: string;
  workspace_id: string;
  project_id: string | null;
  idea_id: string | null;
  title: string;
  is_global: boolean;
  viewport: Json;
  deleted_at: string | null;
};

export type CanvasNodeRow = Timestamps & {
  id: string;
  workspace_id: string;
  canvas_id: string;
  type: CanvasNodeType;
  label: string;
  body: string | null;
  position_x: number;
  position_y: number;
  width: number | null;
  height: number | null;
  color: string | null;
  parent_node_id: string | null;
  entity_type: EntityType | null;
  entity_id: string | null;
  data: Json;
};

export type CanvasEdgeRow = Timestamps & {
  id: string;
  workspace_id: string;
  canvas_id: string;
  source_node_id: string;
  target_node_id: string;
  relation: RelationType;
  label: string | null;
  source_handle: "top" | "right" | "bottom" | "left";
  target_handle: "top" | "right" | "bottom" | "left";
  route_style: "smoothstep" | "bezier" | "straight";
  waypoint_x: number | null;
  waypoint_y: number | null;
};

export type TagRow = Timestamps & {
  id: string;
  workspace_id: string;
  name: string;
  color: string | null;
};

export type EntityTagRow = {
  workspace_id: string;
  tag_id: string;
  entity_type: EntityType;
  entity_id: string;
  created_at: string;
};

export type EntityRelationRow = Timestamps & {
  id: string;
  workspace_id: string;
  source_type: EntityType;
  source_id: string;
  target_type: EntityType;
  target_id: string;
  relation: RelationType;
  note: string | null;
  created_by: string | null;
};

export type AttachmentRow = {
  id: string;
  workspace_id: string;
  uploaded_by: string;
  entity_type: EntityType;
  entity_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  deleted_at: string | null;
};

export type AiRunRow = Timestamps & {
  id: string;
  workspace_id: string;
  user_id: string;
  feature: string;
  provider: string;
  model: string | null;
  status: AiRunStatus;
  entity_type: EntityType | null;
  entity_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  credits_charged: number;
  duration_ms: number | null;
  error_code: string | null;
  error_message: string | null;
};

export type AiProposalRow = Timestamps & {
  id: string;
  workspace_id: string;
  run_id: string | null;
  created_by: string;
  feature: string;
  entity_type: EntityType;
  entity_id: string;
  status: AiProposalStatus;
  sections: Json;
  accepted_keys: string[];
  rejected_keys: string[];
  assumptions: string[];
  questions: string[];
  citations: Json;
  applied_at: string | null;
  undo_payload: Json | null;
};

export type WeeklyReviewRow = Timestamps & {
  id: string;
  workspace_id: string;
  user_id: string;
  week_start: string;
  summary: string;
  focus_items: Json;
  stats: Json;
  completed_at: string | null;
};

export type SavedViewRow = Timestamps & {
  id: string;
  workspace_id: string;
  user_id: string;
  scope: "ideas" | "projects" | "tasks" | "search";
  name: string;
  filters: Json;
  is_shared: boolean;
};

export type NotificationRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  entity_type: EntityType | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type ActivityLogRow = {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  action: string;
  entity_type: EntityType;
  entity_id: string;
  summary: string | null;
  metadata: Json;
  created_at: string;
};

export type StripeEventRow = {
  id: string;
  type: string;
  processed_at: string;
  payload: Json | null;
};

export type FeedbackRow = {
  id: string;
  workspace_id: string | null;
  user_id: string | null;
  kind: "general" | "bug" | "idea" | "ai_quality";
  message: string;
  context: Json;
  created_at: string;
};

export type SearchResultRow = {
  entity_type: EntityType;
  entity_id: string;
  title: string;
  excerpt: string | null;
  status: string | null;
  project_id: string | null;
  updated_at: string;
  rank: number;
  headline: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "id">;
      workspaces: Table<WorkspaceRow, "name" | "slug" | "owner_id">;
      workspace_members: Table<
        WorkspaceMemberRow,
        "workspace_id" | "user_id"
      >;
      workspace_invitations: Table<
        WorkspaceInvitationRow,
        "workspace_id" | "email" | "invited_by"
      >;
      subscriptions: Table<SubscriptionRow, "workspace_id">;
      usage_ledger: Table<UsageLedgerRow, "workspace_id" | "kind" | "amount">;
      feature_flags: Table<FeatureFlagRow, "key">;
      inbox_items: Table<InboxItemRow, "workspace_id" | "created_by">;
      ideas: Table<IdeaRow, "workspace_id" | "created_by" | "title">;
      idea_scores: Table<
        IdeaScoreRow,
        "workspace_id" | "idea_id" | "criterion" | "value"
      >;
      projects: Table<ProjectRow, "workspace_id" | "created_by" | "name">;
      project_sections: Table<
        ProjectSectionRow,
        "workspace_id" | "project_id" | "key" | "title"
      >;
      documents: Table<DocumentRow, "workspace_id" | "created_by">;
      document_versions: Table<
        DocumentVersionRow,
        "workspace_id" | "document_id" | "revision" | "content" | "content_hash"
      >;
      goals: Table<GoalRow, "workspace_id" | "title">;
      milestones: Table<MilestoneRow, "workspace_id" | "project_id" | "title">;
      tasks: Table<TaskRow, "workspace_id" | "created_by" | "title">;
      task_dependencies: Table<
        TaskDependencyRow,
        "task_id" | "depends_on_task_id" | "workspace_id"
      >;
      decisions: Table<DecisionRow, "workspace_id" | "created_by" | "title">;
      risks: Table<RiskRow, "workspace_id" | "title">;
      resources: Table<ResourceRow, "workspace_id" | "title">;
      canvases: Table<CanvasRow, "workspace_id">;
      canvas_nodes: Table<CanvasNodeRow, "workspace_id" | "canvas_id">;
      canvas_edges: Table<
        CanvasEdgeRow,
        "workspace_id" | "canvas_id" | "source_node_id" | "target_node_id"
      >;
      tags: Table<TagRow, "workspace_id" | "name">;
      entity_tags: Table<
        EntityTagRow,
        "workspace_id" | "tag_id" | "entity_type" | "entity_id"
      >;
      entity_relations: Table<
        EntityRelationRow,
        "workspace_id" | "source_type" | "source_id" | "target_type" | "target_id"
      >;
      attachments: Table<
        AttachmentRow,
        | "workspace_id"
        | "uploaded_by"
        | "entity_type"
        | "entity_id"
        | "storage_path"
        | "file_name"
        | "mime_type"
        | "size_bytes"
      >;
      ai_runs: Table<AiRunRow, "workspace_id" | "user_id" | "feature">;
      ai_proposals: Table<
        AiProposalRow,
        | "workspace_id"
        | "created_by"
        | "feature"
        | "entity_type"
        | "entity_id"
      >;
      weekly_reviews: Table<
        WeeklyReviewRow,
        "workspace_id" | "user_id" | "week_start"
      >;
      saved_views: Table<
        SavedViewRow,
        "workspace_id" | "user_id" | "scope" | "name"
      >;
      notifications: Table<
        NotificationRow,
        "workspace_id" | "user_id" | "kind" | "title"
      >;
      activity_log: Table<
        ActivityLogRow,
        "workspace_id" | "action" | "entity_type" | "entity_id"
      >;
      feedback: Table<FeedbackRow, "message">;
      stripe_events: Table<StripeEventRow, "id" | "type">;
    };
    Views: {
      search_index: {
        Row: {
          entity_type: EntityType;
          entity_id: string;
          workspace_id: string;
          title: string;
          excerpt: string | null;
          status: string | null;
          project_id: string | null;
          updated_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      ensure_workspace: {
        Args: Record<string, never>;
        Returns: string;
      };
      seed_demo_workspace: {
        Args: Record<string, never>;
        Returns: string;
      };
      remove_demo_workspace: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      snapshot_document: {
        Args: {
          p_document_id: string;
          p_label?: string | null;
          p_min_interval?: string;
        };
        Returns: string | null;
      };
      charge_ai_credits: {
        Args: {
          p_workspace_id: string;
          p_amount: number;
          p_feature: string;
          p_monthly_limit: number;
        };
        Returns: number;
      };
      search_workspace: {
        Args: {
          p_workspace_id: string;
          p_query: string;
          p_types?: EntityType[] | null;
          p_limit?: number;
        };
        Returns: SearchResultRow[];
      };
    };
    Enums: {
      workspace_role: WorkspaceRole;
      plan_tier: PlanTier;
      idea_status: IdeaStatus;
      project_status: ProjectStatus;
      task_status: TaskStatus;
      entity_type: EntityType;
      relation_type: RelationType;
      canvas_node_type: CanvasNodeType;
    };
    CompositeTypes: Record<string, never>;
  };
};
