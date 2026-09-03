"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PLANS } from "@/lib/domain/plans";
import { publicEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fail, guard, ok, parseInput, type ActionResult } from "@/server/action-result";
import { requireSession, requireWriteSession } from "@/server/session";

const inviteSchema=z.object({email:z.string().trim().email().max(320),role:z.enum(["admin","editor","viewer"])});
const commentSchema=z.object({projectId:z.string().uuid(),documentId:z.string().uuid().nullable().optional(),body:z.string().trim().min(1).max(5000),parentId:z.string().uuid().nullable().optional()});

export async function inviteWorkspaceMemberAction(input:unknown):Promise<ActionResult<{email:string}>>{
 return guard(async()=>{const parsed=parseInput(inviteSchema,input);if(!parsed.ok)return parsed.result;const session=await requireWriteSession();
  if(!["owner","admin"].includes(session.role))return fail("Solo Owner e Admin possono invitare membri.");
  const limit=PLANS[session.plan].limits.members;const [{count:members},{count:pending}]=await Promise.all([
   session.supabase.from("workspace_members").select("user_id",{count:"exact",head:true}).eq("workspace_id",session.workspace.id),
   session.supabase.from("workspace_invitations").select("id",{count:"exact",head:true}).eq("workspace_id",session.workspace.id).is("accepted_at",null).gt("expires_at",new Date().toISOString())]);
  if(limit>=0&&(members??0)+(pending??0)>=limit)return fail(`Il piano ${PLANS[session.plan].name} consente ${limit} membri.`);
  const admin=createSupabaseAdminClient();if(!admin)return fail("Inviti email non configurati: manca SUPABASE_SERVICE_ROLE_KEY.");
  const email=parsed.data.email.toLocaleLowerCase();const {data:invitation,error}=await session.supabase.from("workspace_invitations").upsert({workspace_id:session.workspace.id,email,role:parsed.data.role,invited_by:session.userId,accepted_at:null,expires_at:new Date(Date.now()+14*86400000).toISOString()},{onConflict:"workspace_id,email"}).select("token").single();
  if(error||!invitation)return fail(`Invito non salvato: ${error?.message}`);
  const next=`/invitations/accept?token=${encodeURIComponent(invitation.token)}`;
  const {error:mailError}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:`${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,data:{workspace_id:session.workspace.id,workspace_name:session.workspace.name}});
  if(mailError)return fail(`Invito salvato ma email non inviata: ${mailError.message}`);
  revalidatePath("/settings");return ok({email});});
}

export async function acceptWorkspaceInvitationAction(token:string):Promise<ActionResult<{workspaceId:string}>>{
 return guard(async()=>{const parsed=parseInput(z.string().min(20).max(200),token);if(!parsed.ok)return parsed.result;const session=await requireSession();
  const {data,error}=await session.supabase.rpc("accept_workspace_invitation",{p_token:parsed.data});if(error||!data)return fail("Invito non valido, scaduto o destinato a un altro indirizzo.");
  revalidatePath("/home");return ok({workspaceId:data});});
}

export async function createCommentAction(input:unknown):Promise<ActionResult<{id:string}>>{
 return guard(async()=>{const parsed=parseInput(commentSchema,input);if(!parsed.ok)return parsed.result;const session=await requireWriteSession();
  const {data:project}=await session.supabase.from("projects").select("id").eq("id",parsed.data.projectId).eq("workspace_id",session.workspace.id).is("deleted_at",null).maybeSingle();if(!project)return fail("Progetto non accessibile.");
  const {data:comment,error}=await session.supabase.from("comments").insert({workspace_id:session.workspace.id,project_id:project.id,document_id:parsed.data.documentId??null,author_id:session.userId,parent_id:parsed.data.parentId??null,body:parsed.data.body}).select("id").single();if(error||!comment)return fail(`Commento non salvato: ${error?.message}`);
  const {data:members}=await session.supabase.from("workspace_members").select("user_id").eq("workspace_id",session.workspace.id);const {data:profiles}=members?.length?await session.supabase.from("profiles").select("id,full_name").in("id",members.map(m=>m.user_id)): {data:[]};
  const normalized=parsed.data.body.toLocaleLowerCase("it");const mentioned=(members??[]).filter((member)=>{const name=profiles?.find(p=>p.id===member.user_id)?.full_name?.trim().toLocaleLowerCase("it");return member.user_id!==session.userId&&name&&normalized.includes(`@${name}`);});
  if(mentioned.length){await session.supabase.from("comment_mentions").insert(mentioned.map((m)=>({comment_id:comment.id,workspace_id:session.workspace.id,user_id:m.user_id})));await session.supabase.from("notifications").insert(mentioned.map((m)=>({workspace_id:session.workspace.id,user_id:m.user_id,kind:"mention",title:`${session.profile?.full_name??"Un membro"} ti ha menzionato`,body:parsed.data.body.slice(0,300),entity_type:"project" as const,entity_id:project.id})));}
  revalidatePath(`/projects/${project.id}/collaboration`);return ok({id:comment.id});});
}

export async function archiveCommentAction(id:string):Promise<ActionResult<undefined>>{return guard(async()=>{const parsed=parseInput(z.string().uuid(),id);if(!parsed.ok)return parsed.result;const session=await requireWriteSession();const {data,error}=await session.supabase.from("comments").update({deleted_at:new Date().toISOString()}).eq("id",parsed.data).eq("author_id",session.userId).select("project_id").maybeSingle();if(error)return fail(error.message);if(!data)return fail("Puoi archiviare solo i tuoi commenti.");revalidatePath(`/projects/${data.project_id}/collaboration`);return ok();});}
