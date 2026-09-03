# Validazione esterna Mindraft

## Obiettivo

Dimostrare con una persona esterna il percorso cattura -> idea -> proposta -> progetto -> documento agentico -> export/reimport, senza assistenza tecnica durante il percorso principale.

## Preparazione

1. Applicare tutte le migrazioni a un ambiente di staging isolato.
2. Configurare email Supabase, URL pubblico, Stripe test mode e almeno un provider AI oppure il mock dichiarato.
3. Invitare la persona come Editor dal pannello Collaborazione.
4. Creare un progetto di prova distinto dai dati personali.

## Scenario

1. La persona cattura una propria idea reale.
2. La trasforma in progetto approvando solo le sezioni desiderate.
3. Modifica almeno un obiettivo e completa un'attività.
4. Esporta il documento agentico, modifica una voce e lo reimporta.
5. Risolve almeno un conflitto intenzionale.
6. Lascia un commento e menziona un altro membro.
7. Esporta il risultato finale e invia feedback dalla pagina Impostazioni.

## Evidenze obbligatorie

- Identificativo anonimo della sessione e consenso alla raccolta.
- Timestamp di inizio/fine e risultato di ogni passaggio.
- Errori incontrati, workaround richiesti e passaggi abbandonati.
- Import plan con conteggi CREATE/UPDATE/CONFLICT/NO-OP.
- Feedback qualitativo, senza prompt o contenuti sensibili nei log tecnici.

## Gate di successo

- Un progetto reale completato dall'inizio alla fine.
- Nessuna perdita o fusione di entità omonime.
- Secondo import identico uguale a NO-OP.
- La persona comprende quando decide lei e quando propone l'agente.

Il gate non può essere marcato completato senza una persona reale e le evidenze sopra registrate.
