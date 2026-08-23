-- ===================================================================
-- Mindraft · 0009 RPC helpers and the optional demo workspace
-- ===================================================================

-- Called by the app right after sign-in. Idempotent: it repairs accounts
-- created before the trigger existed and is a no-op afterwards.
create or replace function public.ensure_workspace()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  email text;
  meta_name text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select u.email, coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')
  into email, meta_name
  from auth.users u where u.id = uid;

  return app.bootstrap_user(uid, email, meta_name);
end;
$$;

-- AI credit accounting in one atomic statement: the ledger row and the
-- balance check cannot drift apart.
create or replace function public.charge_ai_credits(
  p_workspace_id uuid,
  p_amount integer,
  p_feature text,
  p_monthly_limit integer
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  used integer;
begin
  if not app.can_write(p_workspace_id) then
    raise exception 'not allowed to spend credits in this workspace' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(sum(amount), 0) into used
  from public.usage_ledger
  where workspace_id = p_workspace_id
    and kind = 'ai_credits'
    and occurred_at >= date_trunc('month', now());

  if p_monthly_limit >= 0 and used + p_amount > p_monthly_limit then
    raise exception 'AI credit limit reached (% / %)', used, p_monthly_limit
      using errcode = 'check_violation';
  end if;

  insert into public.usage_ledger (workspace_id, user_id, kind, amount, metadata)
  values (p_workspace_id, auth.uid(), 'ai_credits', p_amount, jsonb_build_object('feature', p_feature));

  return used + p_amount;
end;
$$;

-- --------------------------------------------------------- demo seed
-- Optional and clearly separated from real data: every row it creates
-- is tagged with metadata->>'demo' = 'true' or belongs to the demo
-- workspace, so it can be removed in one statement.

create or replace function public.seed_demo_workspace()
returns uuid
language plpgsql
-- SECURITY DEFINER: the function only ever writes into a workspace it
-- has just created for the authenticated caller, and it needs to insert
-- the subscription row that end users are not allowed to write.
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  ws uuid;
  idea_radar uuid;
  idea_voice uuid;
  idea_news uuid;
  proj uuid;
  doc uuid;
  cv uuid;
  ms_discovery uuid;
  ms_mvp uuid;
  n_problem uuid;
  n_solution uuid;
  n_mvp uuid;
  n_risk uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select w.id into ws
  from public.workspaces w
  where w.owner_id = uid and w.slug like 'demo-%' and w.deleted_at is null
  limit 1;

  if ws is not null then
    return ws;
  end if;

  insert into public.workspaces (name, slug, is_personal, owner_id, settings)
  values ('Spazio dimostrativo', 'demo-' || substr(replace(uid::text, '-', ''), 1, 12), false, uid,
          jsonb_build_object('demo', true))
  returning id into ws;

  insert into public.workspace_members (workspace_id, user_id, role) values (ws, uid, 'owner');
  insert into public.subscriptions (workspace_id, plan, status) values (ws, 'free', 'active');

  -- ----------------------------------------------------------- inbox
  insert into public.inbox_items (workspace_id, created_by, kind, content, status)
  values
    (ws, uid, 'text',
     'Continuo a perdere le idee che mi vengono mentre cammino. Serve qualcosa che le prenda in 3 secondi e poi le riordini da solo.',
     'unprocessed'),
    (ws, uid, 'text',
     'Domanda: la gente paga per uno strumento che "pensa con te" o vuole solo un posto dove scrivere? Chiedere a 5 freelance.',
     'unprocessed'),
    (ws, uid, 'url',
     'Da leggere: come strutturano i decision log i team di prodotto.',
     'unprocessed');

  update public.inbox_items set url = 'https://example.com/decision-records', url_title = 'Architecture decision records in pratica'
  where workspace_id = ws and kind = 'url';

  -- ----------------------------------------------------------- ideas
  insert into public.ideas (workspace_id, created_by, title, original_content, summary, problem, solution,
                            audience, expected_value, personal_motivation, category, status, maturity)
  values (
    ws, uid,
    'Radar: capire quali idee meritano tempo',
    'Ho 40 idee in tre app diverse. Ogni volta che ne apro una perdo mezz''ora a ricostruire perché mi interessava. Vorrei un radar che me le mostri per impatto e fattibilità e mi dica quale ha senso oggi.',
    'Un cruscotto che ordina le idee per impatto e fattibilità e propone quella su cui lavorare adesso.',
    'Le idee sono sparse e senza contesto: la selezione costa più della realizzazione.',
    'Punteggio trasparente su criteri configurabili, più una matrice impatto/fattibilità confrontabile.',
    'Freelance e founder che gestiscono più progetti in parallelo.',
    'Meno tempo speso a ricordare, più tempo speso a decidere.',
    'È il problema che ho ogni domenica sera.',
    'Prodotto', 'promising', 'shaped'
  ) returning id into idea_radar;

  insert into public.ideas (workspace_id, created_by, title, original_content, summary, status, maturity, category)
  values (
    ws, uid,
    'Cattura vocale mentre cammino',
    'Registrare 20 secondi di voce, trascrizione automatica, e la sera ritrovo tutto già diviso per progetto.',
    'Nota vocale con trascrizione e smistamento automatico per progetto.',
    'to_explore', 'sketch', 'Prodotto'
  ) returning id into idea_voice;

  insert into public.ideas (workspace_id, created_by, title, original_content, status, maturity, category)
  values (
    ws, uid,
    'Newsletter settimanale sul lavoro creativo',
    'Una mail il venerdì con una cosa che ho capito questa settimana. Forse è solo un modo per procrastinare sul prodotto.',
    'inbox', 'spark', 'Contenuti'
  ) returning id into idea_news;

  insert into public.idea_scores (workspace_id, idea_id, criterion, value, weight)
  values
    (ws, idea_radar, 'impact', 8, 1.5),
    (ws, idea_radar, 'feasibility', 6, 1.2),
    (ws, idea_radar, 'personal_interest', 9, 1.0),
    (ws, idea_radar, 'time_required', 4, 0.8),
    (ws, idea_radar, 'differentiation', 7, 1.0),
    (ws, idea_voice, 'impact', 6, 1.5),
    (ws, idea_voice, 'feasibility', 4, 1.2),
    (ws, idea_voice, 'personal_interest', 7, 1.0),
    (ws, idea_news, 'impact', 3, 1.5),
    (ws, idea_news, 'feasibility', 9, 1.2),
    (ws, idea_news, 'personal_interest', 5, 1.0);

  -- --------------------------------------------------------- project
  insert into public.projects (workspace_id, created_by, name, emoji, color, short_description, vision,
                               problem, solution, audience, value_proposition, scope_in, scope_out,
                               status, health, progress, source_idea_id, next_step, stack)
  values (
    ws, uid, 'Radar delle idee', '🧭', '#5B5CE2',
    'Cruscotto che ordina le idee per impatto e fattibilità.',
    'Ogni domenica so su cosa lavorare lunedì, senza rileggere quaranta note.',
    'Le idee vivono in posti diversi e perdono il contesto che le rendeva interessanti.',
    'Punteggio configurabile, matrice di confronto e un suggerimento motivato del prossimo passo.',
    'Chi porta avanti più progetti personali in parallelo.',
    'Dalla nota sparsa alla decisione in meno di cinque minuti.',
    'Punteggio, matrice, confronto fino a cinque idee, suggerimento del prossimo passo.',
    'Collaborazione in tempo reale, app mobile nativa, integrazioni esterne.',
    'development', 'on_track', 35, idea_radar,
    'Validare i pesi predefiniti con tre utenti reali.',
    array['Next.js', 'Supabase', 'TypeScript']
  ) returning id into proj;

  update public.ideas set project_id = proj, status = 'converted' where id = idea_radar;

  insert into public.project_sections (workspace_id, project_id, key, title, content, origin, position, approved_at)
  values
    (ws, proj, 'vision', 'Visione', 'Sapere ogni lunedì su cosa lavorare, senza rileggere quaranta note.', 'user', 0, now()),
    (ws, proj, 'problem', 'Problema', 'Selezionare costa più che eseguire: il contesto di ogni idea va ricostruito da zero.', 'ai', 1, now()),
    (ws, proj, 'solution', 'Soluzione', 'Punteggio trasparente su criteri configurabili più una matrice di confronto.', 'ai', 2, now()),
    (ws, proj, 'users', 'Utenti', 'Freelance, indie maker e product manager con più progetti aperti.', 'ai', 3, null),
    (ws, proj, 'mvp', 'MVP', 'Punteggio, matrice, confronto e suggerimento del prossimo passo. Nient''altro.', 'user', 4, now());

  insert into public.goals (workspace_id, project_id, title, metric, target_value, current_value, due_date, position)
  values
    (ws, proj, 'Ridurre il tempo di selezione', 'minuti per decisione', '5', '18', current_date + 45, 0),
    (ws, proj, 'Tre utenti che lo usano ogni settimana', 'utenti attivi settimanali', '3', '1', current_date + 60, 1);

  insert into public.milestones (workspace_id, project_id, title, description, phase, status, starts_on, ends_on, progress, is_estimate, position)
  values
    (ws, proj, 'Discovery', 'Interviste e definizione dei criteri di valutazione.', 'Fase 1', 'done',
     current_date - 21, current_date - 7, 100, false, 0)
  returning id into ms_discovery;

  insert into public.milestones (workspace_id, project_id, title, description, phase, version_label, status, starts_on, ends_on, progress, is_estimate, position)
  values
    (ws, proj, 'MVP interno', 'Punteggio e matrice utilizzabili sui dati reali.', 'Fase 2', 'v0.1', 'in_progress',
     current_date - 6, current_date + 14, 40, true, 1)
  returning id into ms_mvp;

  insert into public.tasks (workspace_id, created_by, project_id, milestone_id, title, description, status, priority, due_date, estimate_minutes, position, origin_type, origin_id)
  values
    (ws, uid, proj, ms_mvp, 'Definire i pesi predefiniti dei criteri', 'Partire da impatto 1.5 e fattibilità 1.2, poi verificare.', 'in_progress', 'high', current_date + 2, 90, 0, 'idea', idea_radar),
    (ws, uid, proj, ms_mvp, 'Matrice impatto/fattibilità cliccabile', null, 'todo', 'medium', current_date + 6, 180, 1, null, null),
    (ws, uid, proj, ms_mvp, 'Intervistare tre freelance', 'Domanda chiave: come scelgono su cosa lavorare la settimana dopo.', 'blocked', 'high', current_date - 1, 120, 2, null, null),
    (ws, uid, proj, ms_discovery, 'Elencare i criteri candidati', null, 'done', 'medium', current_date - 12, 60, 3, null, null);

  insert into public.decisions (workspace_id, created_by, project_id, title, context, alternatives, rationale, consequences, status, decided_on)
  values (
    ws, uid, proj,
    'Il punteggio resta modificabile a mano',
    'Un punteggio calcolato al 100% dalla AI sembrava più pulito, ma nasconde il ragionamento.',
    'A) punteggio automatico non modificabile · B) punteggio automatico con override · C) solo manuale',
    'Se non posso spostare un peso, smetto di fidarmi del numero. Meglio un calcolo trasparente e correggibile.',
    'Serve mostrare sempre la formula e conservare i pesi per idea.',
    'approved', current_date - 9
  );

  insert into public.risks (workspace_id, project_id, title, description, likelihood, impact, mitigation)
  values
    (ws, proj, 'Il punteggio diventa un rituale inutile', 'Se valutare costa più che decidere, nessuno lo compila.', 'medium', 'high',
     'Valori predefiniti sensati e valutazione parziale sempre ammessa.'),
    (ws, proj, 'Troppa AI toglie fiducia', 'Proposte non spiegate vengono ignorate.', 'medium', 'medium',
     'Ogni proposta mostra criteri, incertezze e fonti interne.');

  insert into public.resources (workspace_id, project_id, title, url, kind, notes)
  values
    (ws, proj, 'Note interviste discovery', null, 'note', 'Tre conversazioni, pattern ricorrente: "non so da dove ripartire".'),
    (ws, proj, 'Architecture decision records in pratica', 'https://example.com/decision-records', 'link', null);

  -- -------------------------------------------------------- document
  insert into public.documents (workspace_id, created_by, project_id, title, content, plain_text)
  values (
    ws, uid, proj, 'Radar delle idee — documento di progetto',
    jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 2),
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Visione'))),
        jsonb_build_object('type', 'paragraph',
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text',
            'Ogni domenica so su cosa lavorare lunedì, senza rileggere quaranta note.'))),
        jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 2),
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Problema'))),
        jsonb_build_object('type', 'paragraph',
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text',
            'Selezionare costa più che eseguire. Il contesto di ogni idea va ricostruito da zero ogni volta.'))),
        jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 2),
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'MVP'))),
        jsonb_build_object('type', 'bulletList', 'content', jsonb_build_array(
          jsonb_build_object('type', 'listItem', 'content', jsonb_build_array(
            jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
              jsonb_build_object('type', 'text', 'text', 'Punteggio configurabile e trasparente'))))),
          jsonb_build_object('type', 'listItem', 'content', jsonb_build_array(
            jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
              jsonb_build_object('type', 'text', 'text', 'Matrice impatto/fattibilità'))))),
          jsonb_build_object('type', 'listItem', 'content', jsonb_build_array(
            jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
              jsonb_build_object('type', 'text', 'text', 'Suggerimento motivato del prossimo passo')))))
        ))
      )
    ),
    'Visione. Ogni domenica so su cosa lavorare lunedì, senza rileggere quaranta note. Problema. Selezionare costa più che eseguire. MVP. Punteggio configurabile e trasparente, matrice impatto/fattibilità, suggerimento motivato del prossimo passo.'
  ) returning id into doc;

  perform public.snapshot_document(doc, 'Prima stesura');

  -- ---------------------------------------------------------- canvas
  insert into public.canvases (workspace_id, project_id, title)
  values (ws, proj, 'Mappa del progetto') returning id into cv;

  insert into public.canvas_nodes (workspace_id, canvas_id, type, label, body, position_x, position_y, entity_type, entity_id)
  values (ws, cv, 'project', 'Radar delle idee', 'Cruscotto di selezione', 0, 0, 'project', proj);

  insert into public.canvas_nodes (workspace_id, canvas_id, type, label, body, position_x, position_y)
  values (ws, cv, 'note', 'Problema', 'Selezionare costa più che eseguire.', -280, 160)
  returning id into n_problem;

  insert into public.canvas_nodes (workspace_id, canvas_id, type, label, body, position_x, position_y)
  values (ws, cv, 'note', 'Soluzione', 'Punteggio trasparente + matrice.', 280, 160)
  returning id into n_solution;

  insert into public.canvas_nodes (workspace_id, canvas_id, type, label, body, position_x, position_y)
  values (ws, cv, 'goal', 'MVP interno', '5 minuti per decidere.', 0, 320)
  returning id into n_mvp;

  insert into public.canvas_nodes (workspace_id, canvas_id, type, label, body, position_x, position_y)
  values (ws, cv, 'risk', 'Rituale inutile', 'Se valutare costa troppo, nessuno lo fa.', 320, 380)
  returning id into n_risk;

  insert into public.canvas_edges (workspace_id, canvas_id, source_node_id, target_node_id, relation, label)
  select ws, cv, p.id, n_solution, 'derives_from', 'genera'
  from public.canvas_nodes p where p.canvas_id = cv and p.type = 'project' limit 1;

  insert into public.canvas_edges (workspace_id, canvas_id, source_node_id, target_node_id, relation, label)
  values
    (ws, cv, n_problem, n_solution, 'supports', 'motiva'),
    (ws, cv, n_solution, n_mvp, 'part_of', 'confluisce in'),
    (ws, cv, n_risk, n_mvp, 'blocks', 'minaccia');

  -- ------------------------------------------------------ relations
  insert into public.entity_relations (workspace_id, source_type, source_id, target_type, target_id, relation, created_by)
  values
    (ws, 'idea', idea_voice, 'idea', idea_radar, 'supports', uid),
    (ws, 'project', proj, 'idea', idea_radar, 'derives_from', uid);

  -- ---------------------------------------------------------- tags
  insert into public.tags (workspace_id, name, color) values
    (ws, 'prodotto', '#5B5CE2'),
    (ws, 'da validare', '#2DD4BF'),
    (ws, 'contenuti', '#F59E0B')
  on conflict do nothing;

  insert into public.entity_tags (workspace_id, tag_id, entity_type, entity_id)
  select ws, t.id, 'idea', idea_radar from public.tags t where t.workspace_id = ws and t.name = 'prodotto';
  insert into public.entity_tags (workspace_id, tag_id, entity_type, entity_id)
  select ws, t.id, 'idea', idea_news from public.tags t where t.workspace_id = ws and t.name = 'contenuti';

  -- ------------------------------------------------- weekly review
  insert into public.weekly_reviews (workspace_id, user_id, week_start, summary, focus_items, stats, completed_at)
  values (
    ws, uid, date_trunc('week', now() - interval '7 days')::date,
    'Settimana di discovery. Tre interviste, un criterio in meno. La matrice resta il pezzo che convince di più.',
    jsonb_build_array(
      jsonb_build_object('title', 'Chiudere i pesi predefiniti', 'done', true),
      jsonb_build_object('title', 'Prototipo matrice', 'done', false),
      jsonb_build_object('title', 'Terza intervista', 'done', false)
    ),
    jsonb_build_object('ideas_captured', 3, 'tasks_completed', 1, 'decisions', 1),
    now() - interval '6 days'
  );

  insert into public.activity_log (workspace_id, actor_id, action, entity_type, entity_id, summary)
  values
    (ws, uid, 'created', 'project', proj, 'Progetto creato da un''idea'),
    (ws, uid, 'decided', 'decision', proj, 'Il punteggio resta modificabile a mano');

  return ws;
end;
$$;

-- Removes the demo workspace and everything inside it.
create or replace function public.remove_demo_workspace()
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  delete from public.workspaces w
  where w.owner_id = auth.uid()
    and w.settings ->> 'demo' = 'true';
$$;
