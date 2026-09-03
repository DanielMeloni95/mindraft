# Evidenze di verifica - 3 settembre 2026

## Perimetro

Documento agentico v1.1, ciclo crediti AI, qualità del repository, superficie commerciale Stripe e collaborazione.

## Risultati

| Comando | Esito | Evidenza |
| --- | --- | --- |
| `npm run typecheck` | PASS | Contratti TypeScript validi. |
| `npm run lint` | PASS | Nessun errore ESLint. |
| `npm test -- --maxWorkers=1` | PASS | 14 file, 95 test. |
| `npm run build` | PASS | Build Next.js completa senza accesso di rete; Inter e Sora locali. |
| `git diff --check` | PASS | Nessun errore whitespace. |
| `npm run db:verify` | NON ESEGUITO | Richiede autorizzazione esplicita: elimina e ricrea `mindraft_verify`. |

## Limiti

- Checkout e Customer Portal richiedono chiavi/prezzi Stripe reali e una configurazione Portal attiva.
- Webhook e test DB reali richiedono le migrazioni 0016-0018 applicate a un ambiente Supabase/Postgres.
- Il punto 7 (validazione esterna) è predisposto in `docs/external-validation-runbook.md`, ma resta aperto finché una persona reale non completa lo scenario e produce le evidenze previste.
- La normalizzazione storica di tutti i file non è stata forzata: `.gitattributes` governa i prossimi checkout senza produrre una modifica massiva non pertinente.

## Rollback

- Rimuovere le variabili Stripe disabilita i controlli commerciali senza simulare pagamenti.
- Le migrazioni sono additive. Prima di un rollback strutturale esportare `agentic_imports`, `ai_runs` e `usage_ledger`.
- I font locali possono essere rimossi ripristinando `next/font/google`, ma ciò reintroduce una dipendenza di build dalla rete.
