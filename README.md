# Mindraft

**Where ideas take shape.** Trasforma pensieri disordinati in progetti chiari, visuali e realizzabili.

Mindraft non è un'app di note e non è un project manager. È il posto in cui
un'intuizione diventa un progetto **senza perdere il motivo per cui ti era
venuta in mente**: il testo che scrivi resta intatto per sempre, l'AI propone
una struttura, e tu approvi sezione per sezione.

---

## Indice

- [Avvio rapido](#avvio-rapido)
- [Configurare Supabase](#configurare-supabase)
- [Configurare il provider AI](#configurare-il-provider-ai)
- [Configurare Stripe (opzionale)](#configurare-stripe-opzionale)
- [Comandi](#comandi)
- [Test](#test)
- [Architettura](#architettura)
- [Decisioni principali](#decisioni-principali)
- [Cosa è completo](#cosa-è-completo)
- [Backlog](#backlog)

---

## Avvio rapido

```bash
npm install
cp .env.example .env.local     # compila le due variabili Supabase
npm run dev                    # http://localhost:3000
```

Senza credenziali Supabase l'app **si avvia comunque** e mostra la schermata
`/setup`, che spiega cosa manca: nessuno stack trace, nessuna pagina bianca.

Requisiti: Node.js 20+ (testato su 22), npm 10+.

---

## Configurare Supabase

1. **Crea un progetto** su [supabase.com](https://supabase.com) (il piano
   gratuito è sufficiente).
2. **Copia le chiavi** da _Project Settings → API_ dentro `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Applica le migrazioni.** Con la CLI di Supabase:

   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

   In alternativa, apri _SQL Editor_ nella dashboard e incolla in un colpo
   solo **`supabase/schema.sql`**: è la concatenazione ordinata delle nove
   migrazioni, idempotente e senza `DROP`/`DELETE`, quindi la puoi rieseguire
   senza perdere dati. (I singoli file restano in `supabase/migrations/` per
   la CLI e per la cronologia.)

4. **Configura l'autenticazione** in _Authentication → URL Configuration_:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`

   Per i test end-to-end disattiva la conferma email in
   _Authentication → Providers → Email_.

5. **Verifica lo schema** (opzionale ma consigliato). Con un Postgres 15+
   raggiungibile:

   ```bash
   PGURL=postgres://postgres@localhost:5432/postgres npm run db:verify
   ```

   Lo script crea un database usa-e-getta, applica tutte le migrazioni e
   verifica 13 aspettative: bootstrap dell'utente, immutabilità del testo
   originale, isolamento fra workspace in lettura/scrittura/cancellazione,
   ruolo viewer, ricerca full-text, versionamento dei documenti, ledger
   append-only, limiti dei crediti AI e seed dimostrativo.

### Cosa creano le migrazioni

| File | Contenuto |
| --- | --- |
| `0001_foundation.sql` | Estensioni, 20 enum, trigger `updated_at`, ranking dei ruoli |
| `0002_workspaces.sql` | `profiles`, `workspaces`, `workspace_members`, inviti, `subscriptions`, `usage_ledger`, `feature_flags`, bootstrap automatico del nuovo utente |
| `0003_content.sql` | `inbox_items`, `ideas` (+ trigger di immutabilità), `idea_scores`, `projects`, `project_sections`, `documents`, `document_versions`, `snapshot_document()` |
| `0004_planning_and_canvas.sql` | `goals`, `milestones`, `tasks`, `task_dependencies`, `decisions`, `risks`, `resources`, `canvases`, `canvas_nodes`, `canvas_edges` |
| `0005_shared.sql` | `tags` + ponte polimorfico, `entity_relations`, `attachments`, `ai_runs`, `ai_proposals`, `weekly_reviews`, `saved_views`, `notifications`, `activity_log`, `feedback` |
| `0006_search.sql` | Colonne `tsvector` generate, indici GIN, vista `search_index`, funzione `search_workspace()` |
| `0007_rls.sql` | RLS su ogni tabella esposta, policy per membership e ruolo, grant e revoche |
| `0008_storage.sql` | Bucket privato `attachments` e policy basate sul primo segmento del path |
| `0009_rpc_and_demo.sql` | `ensure_workspace()`, `charge_ai_credits()`, `seed_demo_workspace()`, `remove_demo_workspace()` |

### Contenuto dimostrativo

_Impostazioni → Spazio dimostrativo → Crea_. Genera un **workspace separato**
(non tocca i tuoi dati) con tre catture disordinate, tre idee, un progetto
completo di documento, mappa, roadmap, attività, una decisione registrata, due
rischi e una revisione settimanale. Si rimuove con un clic.

---

## Configurare il provider AI

Il livello AI è astratto dietro un'interfaccia (`src/lib/ai/provider.ts`) con
due implementazioni:

| Provider | Quando | Cosa fa |
| --- | --- | --- |
| `mock` (default) | Nessuna `OPENAI_API_KEY` | Implementazione **locale e deterministica**: applica euristiche reali al tuo testo. Non è un finto successo: produce proposte valide, dichiara le assunzioni e alimenta i test. Nessun contenuto lascia il tuo server. |
| `openai` | `OPENAI_API_KEY` presente | Chiamate in JSON mode a qualunque endpoint compatibile con l'API chat-completions (`OPENAI_BASE_URL` per Azure/OpenRouter/modelli locali). |

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

L'interfaccia **dichiara sempre** quale motore ha prodotto una proposta
(etichetta «assistente locale» o «AI»), così nessuno scambia un'euristica per
un modello.

**Cosa viene inviato al provider**: solo il contenuto dell'elemento su cui
stai lavorando. Di ogni esecuzione conserviamo dati tecnici — funzione,
provider, durata, esito, crediti — **mai prompt né risposte**. Il dettaglio è
in _Impostazioni → Dati_.

---

## Configurare Stripe (opzionale)

Senza `STRIPE_SECRET_KEY` la pagina _Piano e utilizzo_ resta in sola lettura e
il webhook risponde `501`: **nessuna transazione viene simulata**.

Con le chiavi configurate:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PERSONAL=price_...
STRIPE_PRICE_PRO=price_...
SUPABASE_SERVICE_ROLE_KEY=...     # solo per il webhook
```

Il webhook (`POST /api/stripe/webhook`) verifica la firma in modo
timing-safe, rifiuta gli eventi più vecchi di cinque minuti ed è **idempotente**:
l'id dell'evento viene inserito in `stripe_events` e un replay diventa un no-op.

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Il flusso di Checkout (creazione della sessione) è nel backlog: oggi il webhook
è pronto ma non esiste un pulsante di upgrade, perché un pulsante che non fa
nulla è peggio di un pulsante assente.

---

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | Server di sviluppo |
| `npm run build` | Build di produzione |
| `npm run start` | Avvia la build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript in strict mode |
| `npm run test` | Test unitari e di componente (Vitest) |
| `npm run test:coverage` | Con report di copertura |
| `npm run test:e2e` | Flussi end-to-end (Playwright) |
| `npm run db:verify` | Applica le migrazioni a un DB usa-e-getta e verifica RLS |
| `npm run check` | lint + typecheck + test + build |

---

## Test

### Unitari e di componente — `npm run test`

66 test, nessuna dipendenza esterna:

- **punteggio delle idee**: media pesata, criteri invertiti (costo, tempo,
  rischio), pesi, copertura e confidenza, formula mostrata all'utente,
  quadranti della matrice;
- **provider AI mock**: output conforme agli schemi Zod, derivato dal testo
  dell'utente, con assunzioni e domande dichiarate, deterministico, e che
  fallisce rumorosamente su una funzione non supportata;
- **proposte e diff**: cosa conta come sovrascrittura, quali sezioni sono
  pre-approvate, robustezza su payload malformati;
- **DiffApproval** (Testing Library): mostra il valore attuale accanto alla
  proposta, marca le sostituzioni, lascia deselezionate le sezioni che
  sovrascrivono, supporta l'approvazione singola;
- **validazione**: schemi Zod condivisi, mappatura degli errori sui campi,
  `original_content` che non passa mai dallo schema di update;
- **rate limiting**, **limiti di piano**, **conversione TipTap ↔ Markdown**,
  **firma dei webhook Stripe**;
- **embed PostgREST**: legge le foreign key dalle migrazioni, trova le coppie
  di tabelle collegate due volte (`ideas`↔`projects`, `ideas`↔`inbox_items`,
  `canvas_edges`↔`canvas_nodes`, …) e fallisce se una query le incorpora senza
  indicare quale vincolo seguire — l'errore «more than one relationship was
  found» compare solo a runtime, quindi va intercettato qui.

### Database — `npm run db:verify`

13 aspettative SQL su un Postgres reale (vedi sopra). Questo è il test che
conta per la sicurezza: le policy RLS vengono eseguite, non solo lette.

### End-to-end — `npm run test:e2e`

Richiede un progetto Supabase configurato (i flussi coperti sono esattamente
quelli che toccano persistenza e permessi). Senza credenziali la suite si
**salta con un messaggio esplicito** invece di fallire per il motivo sbagliato.

```bash
npm run test:e2e:install    # una volta: scarica Chromium
npm run test:e2e
```

Copre: registrazione/logout/accesso, isolamento fra due account (anche per URL
diretto), cattura rapida, inbox → idea, proposta AI, **approvazione parziale**,
creazione progetto, autosave del documento con verifica dopo reload, creazione
nodo canvas, attività e cambio stato persistito, decisione registrata,
ricerca, esportazione JSON e Markdown, command palette, e su viewport mobile
la bottom navigation, la cattura e l'assenza di scorrimento orizzontale.

---

## Architettura

```
src/
├── app/                     Route (App Router)
│   ├── (auth)/              login, signup, recupero password
│   ├── (app)/               area privata: shell + tutte le sezioni
│   ├── api/                 search, export, stripe/webhook
│   ├── auth/callback/       scambio del codice OAuth/email
│   ├── onboarding/          quattro schermate, saltabile e riprendibile
│   └── setup/               schermata di configurazione mancante
├── components/
│   ├── ui/                  primitive (Radix + CVA), nessuna dipendenza di dominio
│   ├── common/              StatusBadge, EmptyState, ErrorBoundary, Skeleton…
│   ├── app-shell/           Sidebar, MobileNav, CommandPalette, QuickCapture
│   ├── ideas/ projects/ tasks/ inbox/ canvas/ editor/ ai/ settings/
├── lib/
│   ├── ai/                  provider astratto, mock, openai, prompt, schemi Zod
│   ├── domain/              punteggio, piani, costanti, proposte, TipTap
│   ├── supabase/            client browser / server / middleware / admin
│   └── validation/          schemi Zod condivisi form ↔ server action
├── server/
│   ├── actions/             mutazioni ("use server"), una per area
│   ├── queries/             letture tipizzate
│   └── session.ts           contesto di sessione, una volta per richiesta
└── types/database.ts        specchio TypeScript delle migrazioni
```

Il dettaglio — flusso Idea-to-Project, modello di autorizzazione a tre livelli,
strategia di versionamento dei documenti, sincronizzazione canvas ↔ entità — è
in [`docs/architecture.md`](docs/architecture.md).

---

## Decisioni principali

**Il testo originale è immutabile a livello di database.** Non è una
convenzione dell'interfaccia: un trigger su `ideas` rifiuta ogni `UPDATE` che
tocchi `original_content`. L'AI scrive solo in colonne derivate. È la promessa
del prodotto, quindi è imposta nel posto in cui non si può aggirare.

**Autorizzazione in tre punti indipendenti.** Middleware (redirect), server
action (ruolo verificato lato server), RLS (l'ultima parola). Nessuno dei tre
si fida degli altri. `npm run db:verify` dimostra che il terzo regge da solo.

**Le proposte AI sono righe, non effetti collaterali.** Una proposta vive in
`ai_proposals` con lo stato di partenza di ogni sezione. L'utente approva ciò
che vuole; l'applicazione registra `undo_payload` **prima** di scrivere, quindi
«Annulla» ripristina davvero invece di lasciare un'idea mezza trasformata.

**Il provider mock è un'implementazione, non uno stub.** Applica euristiche
reali al testo dell'utente, produce output validati dagli stessi schemi Zod e
non inventa dati: se il pubblico non è dichiarato, lo dice. Così l'app è
completa senza chiave API e i test hanno un oracolo stabile.

**Le versioni del documento sono istantanee, non battute.** L'autosave fa un
solo `UPDATE`; `snapshot_document()` crea una versione solo se il contenuto è
davvero cambiato **e** se è passato abbastanza tempo (o se l'utente lo chiede).
Il salvataggio porta con sé la revisione da cui è partito: se un'altra scheda
ha scritto nel frattempo, l'utente viene avvisato invece di vincere la corsa.

**Il canvas è collegato alle entità vere.** Un nodo con `entity_type` è una
vista dell'oggetto: rinominarlo rinomina l'idea. Un nodo libero si può
promuovere a idea, attività, decisione o rischio. Il grafo globale ha un filtro
«orfani» perché serve a trovare problemi, non a fare scenografia.

**I limiti di piano si applicano nel database.** `charge_ai_credits()` conta e
scrive nella stessa transazione, quindi richieste parallele non superano il
limite. Il ledger è append-only anche per l'utente (`REVOKE UPDATE, DELETE`).

**`simple` come dizionario full-text.** Le catture mescolano italiano e
inglese; lo stemming di una lingua sola peggiorerebbe l'altra. La ricerca
semantica con pgvector è progettata come **complemento**, non sostituto.

**Niente TanStack Query.** Server Components + server action + `router.refresh()`
coprono tutti i casi di questa fase senza una seconda cache da invalidare.
Resta un'aggiunta possibile se arriverà il realtime collaborativo.

---

## Cosa è completo

Tutto quanto segue è **funzionante e persistente**, non solo interfaccia.

**Fondazioni**

- Autenticazione Supabase (registrazione, accesso, logout, reset password,
  callback con redirect validato) e sessione refrescata dal middleware
- Workspace personale creato automaticamente al primo accesso (trigger SQL) e
  riparato in modo idempotente da `ensure_workspace()`
- Selettore di workspace, ruoli owner/admin/editor/viewer applicati da RLS
- 34 tabelle con enum, indici, foreign key, soft delete, trigger `updated_at`
- Shell responsive: sidebar comprimibile con memoria, bottom navigation mobile,
  command palette ⌘K, cattura rapida sempre a portata (FAB su mobile)
- Design system: token di brand, tema chiaro/scuro, Sora + Inter, focus
  visibili, `prefers-reduced-motion` rispettato

**Core**

- Inbox universale: cattura in un campo, ⌘+Invio, azioni rapide (idea,
  progetto, elaborato, archivia, elimina con undo reale), filtri per stato
- Idee: contenuto originale immutabile + otto campi derivati con autosave,
  stati, maturità, categoria, preferiti, viste card/lista/matrice, filtri
  nell'URL, valutazione trasparente con pesi modificabili e formula a vista
- Confronto di 2–5 idee con griglia, raccomandazione, compromessi e incertezze
- Progetti: 25+ campi, otto tab, stato e salute, prossimo passo modificabile
  inline, obiettivi, rischi, risorse, cronologia
- Editor TipTap: titoli, liste, checklist, citazioni, codice, tabelle,
  immagini, divisori, link sanificati, undo/redo, outline, modalità focus,
  autosave con indicatore, versioni e ripristino, export Markdown
- Attività: kanban con drag and drop **e** select accessibile da tastiera,
  viste Oggi/Prossime/Kanban/Lista/Completate, priorità, scadenze, milestone
- Ricerca full-text con filtri per tipo, evidenziazione e apertura rapida

**Differenziazione**

- **Idea-to-Project**: analisi → proposta strutturata → diff sezione per
  sezione con confidenza e motivazione → approvazione parziale → creazione di
  progetto, documento, sezioni, roadmap, attività, rischi e mappa → undo reale
- Canvas React Flow: 11 tipi di nodo, relazioni tipizzate ed etichettabili,
  modifica inline, auto-layout, minimappa, snap, ricerca, presentazione,
  export PNG, conversione nodo → entità, sincronizzazione bidirezionale
- Grafo globale con filtri operativi, incluso «orfani»
- Roadmap: timeline con drag per spostare le date, zoom settimana/mese/
  trimestre, vista lista, distinzione esplicita fra stima e dato confermato
- Decision log completo (contesto, alternative, motivazione, conseguenze)

**Continuità e commerciale**

- Dashboard che risponde alle tre domande, con «Continua da qui», suggerimento
  AI motivato, riepilogo settimanale
- Revisione settimanale guidata con proposta di riepilogo e tre focus
- Archivio con ripristino, preferiti
- Esportazione JSON (relazioni intatte), Markdown e CSV
- Piani, limiti applicati lato server, ledger dei crediti, pagina utilizzo
- Webhook Stripe verificato e idempotente
- Rate limiting su AI, ricerca ed esportazione

---

## Backlog

Funzioni **non** implementate. Nessuna di queste ha un pulsante finto
nell'interfaccia.

**Cattura**

- Nota vocale con trascrizione (l'enum `inbox_kind` prevede già `audio`)
- Upload di immagini e file (bucket, policy e tabella `attachments` sono
  pronti; manca l'interfaccia di caricamento e gli URL firmati)
- Recupero automatico di titolo e metadati da un URL incollato

**Editor**

- Comandi slash e drag and drop dei blocchi (oggi: toolbar completa e
  scorciatoie)
- Blocchi callout e toggle
- Menzioni interne `@` verso idee, progetti, attività e decisioni
- Azioni AI sulla selezione (sintetizza, chiarisci, espandi)

**AI**

- Chat contestuale su idea/progetto/selezione
- Suggerimento motivato di collegamenti fra entità
- Ricerca semantica con pgvector (lo schema è predisposto, l'estensione è
  commentata in `0001`)

**Dati**

- Importazione Markdown e CSV
- Esportazione PDF di progetto
- Eliminazione account automatizzata (oggi: procedura via email documentata
  in _Impostazioni → Dati_)

**Collaborazione**

- Invio effettivo degli inviti (tabella e policy pronte)
- Commenti, menzioni, assegnazione attività
- Presenza realtime nell'editor e nel canvas

**Commerciale**

- Stripe Checkout e portale clienti (il webhook è pronto)
- Pagina admin per piani, utenti, utilizzo e feedback
- Stati task configurabili per workspace (oggi: quattro stati fissi)

**Altro**

- Viste salvate: azione server pronta (`saveViewAction`), manca il selettore
- Personalizzazione dei moduli della dashboard: azione pronta
  (`updateDashboardModulesAction`), manca l'interfaccia
- Virtualizzazione delle liste molto lunghe (oggi: paginazione a cursore)
- Notifiche interne (tabella pronta)

---

## Note

- **Font**: `next/font/google` scarica Sora e Inter in fase di build. Una build
  in un ambiente senza accesso a `fonts.googleapis.com` fallisce: in quel caso
  self-hostali con `next/font/local`.
- **Vulnerabilità npm**: `npm audit` segnala advisory transitivi di `postcss` e
  `sharp` risolvibili solo passando a Next 16. Non toccano i percorsi usati da
  Mindraft; l'aggiornamento è una scelta consapevole da fare a parte.
- **Credenziali demo**: nessuna è inclusa. Registra un account e usa
  _Impostazioni → Spazio dimostrativo_.
#   m i n d r a f t  
 