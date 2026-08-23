# Architettura di Mindraft

Documento per chi deve modificare il codice. Il README copre il setup; qui c'è
il perché.

---

## 1. Quadro d'insieme

```
                         ┌──────────────────────────────┐
   Browser               │  Next.js (App Router)        │
   ┌────────────┐        │                              │
   │ Client     │  RSC   │  Server Components  ─────────┼──► Supabase
   │ Components │◄───────┤  Server Actions               │   (Postgres + RLS)
   │            │ action │  Route Handlers               │
   └────────────┘───────►│  Middleware (sessione)        │
                         │                              │
                         │  lib/ai ────────────────────►│──► OpenAI | mock
                         └──────────────────────────────┘
```

Nessuna chiamata al database parte dal browser. Il client Supabase del browser
esiste solo per l'autenticazione; **tutte** le letture avvengono in Server
Components e **tutte** le scritture passano da server action o route handler.

### Confini dei moduli

| Livello | Cartella | Regola |
| --- | --- | --- |
| UI pura | `components/ui` | Nessun import da `server/` o `lib/domain`. Solo props. |
| UI di dominio | `components/<area>` | Può importare tipi di dominio e server action. Mai il client Supabase. |
| Dominio | `lib/domain` | Funzioni pure e testabili. Nessun I/O. |
| Validazione | `lib/validation` | Schemi Zod condivisi fra form e server action. |
| AI | `lib/ai` | Provider astratto. I prompt non lasciano mai il server. |
| Lettura | `server/queries` | `server-only`. Riceve il client, non lo crea. |
| Scrittura | `server/actions` | `"use server"`. Valida, autorizza, scrive, rivalida. |

I moduli marcati `server-only` che accettano un client Supabase (`server/tags.ts`,
`server/provision.ts`, `server/ai-context.ts`) sono deliberatamente **fuori** dai
file `"use server"`: ogni export di un file `"use server"` diventa un endpoint
pubblico, e un helper che accetta un client non deve esserlo.

---

## 2. Autorizzazione: tre livelli indipendenti

```
1. Middleware        redirect a /login   ← comodità, non sicurezza
2. Server action     requireWriteSession ← ruolo verificato sul server
3. RLS Postgres      policy per membership e ruolo ← l'ultima parola
```

Il livello 3 è quello che conta e viene verificato da `npm run db:verify`, che
esegue le policy contro un Postgres reale: due utenti, due workspace, e le
assertion che una `SELECT` incrociata restituisce zero righe, che una `INSERT`
incrociata viene rifiutata e che `UPDATE`/`DELETE` incrociate toccano zero righe.

### Helper di membership

`app.is_member()`, `app.member_role()`, `app.can_write()`, `app.can_admin()`
sono `SECURITY DEFINER` su `workspace_members`: senza questo, la policy su
`workspace_members` che interroga `workspace_members` andrebbe in ricorsione.

`FORCE ROW LEVEL SECURITY` **non** è attivo di proposito: le tabelle sono di
proprietà di `postgres`, ruolo con cui nessun percorso applicativo si connette,
e forzarlo romperebbe gli helper `SECURITY DEFINER` e l'editor SQL di Supabase.

### Tabelle append-only

`usage_ledger` e `activity_log` hanno `REVOKE UPDATE, DELETE ... FROM authenticated`.
`subscriptions` è in sola lettura per gli utenti: la scrive solo il webhook
Stripe con il service role.

---

## 3. Il testo originale è immutabile

```sql
create trigger ideas_original_content_immutable
  before update on public.ideas
  for each row execute function app.protect_original_content();
```

Il trigger rifiuta ogni `UPDATE` che modifichi `original_content`, a meno che
la sessione non imposti esplicitamente `mindraft.allow_original_edit = on`
(nessun percorso applicativo lo fa). In più, `ideaUpdateSchema` non contiene
il campo: anche un payload malevolo viene semplicemente ignorato dallo schema
Zod prima di arrivare al database.

L'AI scrive solo in colonne derivate: `summary`, `problem`, `solution`,
`audience`, `expected_value`, `personal_motivation`.

---

## 4. Il flusso Idea-to-Project

È la funzionalità distintiva, quindi vale la pena seguirla per intero.

```
proposeIdeaToProjectAction(ideaId)
  │
  ├─ buildIdeaContext()        legge solo ciò che l'utente può leggere (RLS)
  ├─ charge_ai_credits()       conta e scrive nella stessa transazione
  ├─ ai_runs INSERT            status = running
  ├─ provider.generate()       mock | openai → validato con Zod
  ├─ ai_runs UPDATE            succeeded/failed + telemetria (mai il contenuto)
  └─ ai_proposals INSERT       status = pending
       sections: [{ key, label, current, proposed, kind, confidence, rationale, data }]
       assumptions, questions, citations

                 ▼  l'utente vede il diff e spunta ciò che vuole

applyIdeaToProjectAction({ proposalId, acceptedKeys })
  │
  ├─ verifica: proposta pending, idea non già collegata
  ├─ provisionProject()        progetto + documento + canvas + 13 sezioni
  ├─ per ogni sezione accettata:
  │    project_field  → colonna del progetto
  │    project_section→ project_sections (origin = 'ai') + documento TipTap
  │    plan           → milestones / tasks / risks
  │    map            → canvas_nodes + canvas_edges
  ├─ ideas UPDATE              project_id, status = converted (original intatto)
  ├─ entity_relations INSERT   project derives_from idea
  └─ ai_proposals UPDATE       applied | partially_applied
       accepted_keys, rejected_keys, undo_payload ◄── scritto PRIMA di uscire

undoProposalAction(proposalId)
  ├─ ripristina i campi dell'idea da undo_payload
  ├─ soft delete del progetto creato (recuperabile dall'Archivio)
  └─ proposta → rejected
```

Il campo `current` di ogni sezione è il motivo per cui il diff è onesto: viene
dal database al momento della proposta, non da ciò che l'AI dichiara.
`isOverwrite()` decide quali sezioni **non** sono pre-approvate — sostituire il
testo dell'utente non è mai opt-out.

---

## 5. Versionamento dei documenti

Il requisito è versionare senza salvare una copia a ogni battuta.

```
autosave (1.4s di debounce)  →  UPDATE documents  (una riga, zero versioni)
                             →  snapshot_document()
                                  ├─ hash identico?          → nessuna versione
                                  ├─ niente label e ultima
                                  │  versione < 10 minuti fa? → nessuna versione
                                  └─ altrimenti              → document_versions
```

`snapshot_document()` calcola `sha256` del contenuto e lo confronta con
l'ultima versione. Una versione nasce quando: l'utente la chiede
(«Salva versione», ⌘S), un'operazione importante la giustifica (applicazione di
una proposta AI, ripristino), oppure è passato l'intervallo minimo.

**Concorrenza ottimistica**: il client invia `baseRevision`, la revisione da cui
è partito. Se non coincide, il salvataggio viene rifiutato con un messaggio
comprensibile e l'autosave si ferma, invece di sovrascrivere silenziosamente il
lavoro di un'altra scheda.

---

## 6. Canvas ed entità

Un `canvas_node` può avere `entity_type` + `entity_id`. Quando li ha:

- l'etichetta modificata nel canvas aggiorna il titolo dell'entità
  (`syncEntityLabel`, una sola direzione esplicita e prevedibile);
- il nodo mostra un'icona che apre l'entità.

`promoteNodeAction()` fa il contrario: prende un nodo libero e crea l'idea,
l'attività, la decisione o il rischio corrispondente, poi collega i due. È il
punto in cui la mappa smette di essere un disegno.

Il **grafo globale** (`/map`) non è il canvas: è costruito da idee, progetti,
decisioni e `entity_relations`, con un filtro «orfani» che risponde alla
domanda operativa «cosa non è collegato a niente?».

---

## 7. Il livello AI

```
lib/ai/
├── provider.ts   interfaccia + AiError tipizzato + messaggi utente
├── mock.ts       euristiche locali deterministiche
├── openai.ts     JSON mode, un retry controllato, timeout, no storm
├── prompts.ts    system prompt con le regole non negoziabili
├── context.ts    forma tipizzata di ciò che il modello vede
├── schemas.ts    schemi Zod: nessun output non validato tocca il DB
└── index.ts      runAiFeature: crediti → run → provider → validazione → esito
```

**Perché il mock è un'implementazione vera.** Se fosse uno stub che restituisce
testo finto, l'app senza chiave API sarebbe una demo e i test end-to-end
avrebbero bisogno di un modello. Invece applica euristiche sul testo
dell'utente — frasi che contengono indizi di problema, di soluzione, di
pubblico — e produce output conformi agli stessi schemi. Quando non trova un
indizio **lo dice**: la sezione «Utenti» diventa «Non ancora dichiarato nel
testo» con confidenza bassa.

**Errori.** `AiError` ha un codice (`timeout`, `rate_limited`, `invalid_output`,
`provider_error`, `limit_reached`) e un messaggio già pronto per l'utente. Il
fallback non è mai distruttivo: se il provider fallisce, `ai_runs` registra
l'errore e **nessun dato viene scritto**.

**Privacy.** `ai_runs` conserva funzione, provider, modello, durata, token e
crediti. Mai prompt né completion.

---

## 8. Ricerca

Colonne `tsvector` generate su `ideas`, `projects`, `tasks`, `decisions`,
`documents`, `inbox_items`, indicizzate con GIN. La vista `search_index` le
unisce; `security_invoker = on` lascia le policy RLS al comando.

`search_workspace()` restituisce righe ordinate per `ts_rank` con un
`ts_headline` evidenziato. L'HTML del frammento viene **escapato e poi
riabilitato solo per `<mark>`** prima di essere renderizzato.

Dizionario `simple`: le catture mescolano italiano e inglese. La ricerca
semantica con pgvector è progettata come seconda lista da fondere con questa,
non come sostituto — testuale e semantica rispondono a domande diverse.

---

## 9. Stati dell'interfaccia

| Stato | Dove |
| --- | --- |
| loading | `Skeleton`, `SkeletonList`, `loading` dei `dynamic()` |
| empty | `EmptyState`, sempre con un'azione reale |
| errore recuperabile | `ErrorState` con «Riprova», `ActionResult.error` nei toast |
| errore di autorizzazione | `requireWriteSession` → messaggio esplicito sul ruolo |
| offline | `SaveIndicator` stato `offline` |
| salvataggio | `SaveIndicator`: saving → saved, `aria-live` |
| conflitto di versione | messaggio dedicato dall'autosave del documento |
| limite di piano | messaggio che nomina piano e limite, non un errore generico |
| errore inatteso | `ErrorBoundary` attorno a editor e canvas |

Nessuna schermata usa dati finti e nessun pulsante è senza effetto: le funzioni
non implementate stanno nel backlog del README, non nell'interfaccia.

---

## 10. Prestazioni

- Server Components ovunque tranne dove serve interazione
- `dynamic(..., { ssr: false })` per editor, canvas e grafo (i tre bundle
  pesanti) con skeleton coerenti
- Paginazione a cursore su Inbox e Idee
- Query selettive: la lista non chiede mai i campi lunghi
- Autosave con debounce; il layout del canvas si salva una volta per gesto
- Indici su `(workspace_id, status, updated_at)` e sulle date
- `charge_ai_credits()` in una sola andata e ritorno

---

## 11. Accessibilità

- Semantica HTML: `nav`, `main`, `aside`, `section` con `aria-label`
- Skip link verso `#contenuto`
- Focus visibile globale (`:focus-visible`)
- Il colore non è mai l'unico indicatore: ogni badge ha l'etichetta testuale
- Il kanban ha il drag and drop **e** una `select` per ogni card
- `aria-live` su indicatori di salvataggio e stati di caricamento
- `prefers-reduced-motion` azzera animazioni e transizioni
- Dialog Radix: focus trap, `Esc`, titolo obbligatorio

---

## 12. Aggiungere una migrazione

1. Crea `supabase/migrations/00NN_nome.sql` (idempotente dove possibile).
2. Aggiorna `src/types/database.ts` — è lo specchio TypeScript dello schema.
3. Aggiungi le policy RLS: nessuna tabella esposta resta senza.
4. Estendi `scripts/db-test/99_rls_tests.sql` se il comportamento è nuovo.
5. `npm run db:verify && npm run typecheck`.
