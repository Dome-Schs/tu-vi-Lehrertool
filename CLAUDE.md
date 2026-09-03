# Saidy – Lehrertool

React-PWA für Fachlehrkräfte (Sekundarstufe I). Single-file-Build via Vite + vite-plugin-singlefile.
Alle App-Logik in `saidy.jsx`. Deployment über Hetzner (Apache, manueller Upload von `dist/`).

## Vision (Leitstern)

> **Jedes Kind verdient, dass seine Geschichte, seine Stärken und seine Bedürfnisse nicht mit einem Lehrerwechsel verloren gehen. Saidy bewahrt dieses pädagogische Wissen, reduziert Verwaltungsaufwand und schafft Lehrkräften mehr Zeit für das, was wirklich zählt: die Arbeit mit den Kindern.**

Saidy ist **kein Notenprogramm**, sondern ein **pädagogisches Gedächtnis** — die digitale Schülerakte, die Wissen bündelt, Kontinuität schafft (auch bei Lehrerwechsel/Übergabe) und den Fokus auf die individuelle Förderung legt.

### Drei Leitprinzipien
1. **Wissen geht nie verloren** — egal ob Lehrerwechsel, Klassenwechsel, Vertretung.
2. **Alles hat Kontext** — nicht „Förderbedarf Lernen", sondern *welche Maßnahmen funktionieren*.
3. **Dokumentation wird automatisch zu Unterstützung** — aus vielen kleinen Einträgen entstehen Zeugnisbegründung, Elterngespräch, Förderplan, Übergabe.

### Filter-Frage für jedes neue Feature
> **Hilft diese Funktion einer Lehrkraft, ein Kind besser zu verstehen, fairer zu begleiten oder mehr Zeit für echte pädagogische Arbeit zu gewinnen?**

Wenn ja → gehört rein. Wenn nein → ist Beiwerk und gehört nicht in die Kern-Navigation.

Vor dem Bauen eines neuen Features den `vision`-Agent aufrufen (`/vision <Idee>`).
Er stuft ein (KERN / RAND / BEIWERK / VERSTOSS) und schlägt eine vision-nähere
Umsetzung vor.

## Projektübersicht

Lebende Übersicht (Infrastruktur, Agents, Features, Tasks):
https://claude.ai/code/artifact/1a678b08-f9f5-4556-bdba-a1beeaa82106

Nach Änderungen an `saidy.jsx` oder Agents: Artifact mit demselben Dateipfad neu publizieren (gleiche URL).

## Deployment

**GitHub wird NICHT für Dateiaustausch oder Deployment genutzt.**
Nach jeder Änderung: `npm run build` ausführen und `dist/index.html` direkt per `SendUserFile` an den Nutzer senden.
Der Nutzer lädt die Datei dann selbst auf Hetzner (Apache) hoch.
Niemals den Nutzer auf GitHub verweisen, niemals `git push` als Auslieferungsweg vorschlagen.

## Wichtige Regeln

### HELP_DATA immer mitpflegen
Wenn ein neues Feature eingebaut oder ein bestehender Workflow geändert wird,
**muss die `HELP_DATA`-Konstante in `saidy.jsx` aktualisiert werden** (direkt vor `export default function App()`).

- Neues Feature → neues Item in der passenden Kategorie hinzufügen
- Geänderter Workflow → bestehende Antwort (`a`) aktualisieren
- Gelöschtes Feature → Item entfernen

### Design-Vorgaben
- Farben: `--oliv: #4F5844`, `--creme: #F4F1E8`
- Tailwind v3, CSS-Klassen `akzent-text`, `akzent-rand`, `akzent-flaeche`, `akzent-ton`
- Bottom Sheets: `pb-[max(2rem,env(safe-area-inset-bottom))]` für iPhone Home-Indicator
- Supabase (EU, Frankfurt) für Auth und Datenspeicherung, lokale Berechnung

### Geplante Features
- **Google Calendar Live-Sync** — Apple Kalender → Google Calendar → Tu-vi. Architektur:
  (1) Google Cloud Console: Projekt + Calendar API + OAuth-Client-ID einrichten.
  (2) Supabase Edge Function: OAuth-Callback, Token-Speicherung (`google_calendar_tokens`-Tabelle), Kalender-Abfrage per Google Calendar REST API.
  (3) saidy.jsx: "Mit Google Kalender verbinden"-Button, Sync-Trigger, synced Events anzeigen.
  Voraussetzung: Nutzer muss manuell Google Cloud Console + Supabase Edge Function einrichten (Anleitung wird mitgeliefert).

### Daten
- `window.storage.get/set` für Persistenz (localStorage-Mock in `src/main.jsx`)
- Backup via `last_backup_at` in localStorage tracken
- DSGVO: Daten auf Supabase (EU, Frankfurt), verschlüsselt. AVV noch ausstehend.

### Datensicherheit — Supabase RLS & Verschlüsselung
- **Row-Level Security (RLS)** ist auf der `user_data`-Tabelle aktiviert.
  Erforderliche Policies (in Supabase SQL Editor):
  ```sql
  ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Nutzer liest eigene Daten" ON user_data FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Nutzer schreibt eigene Daten" ON user_data FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "Nutzer aktualisiert eigene Daten" ON user_data FOR UPDATE USING (auth.uid() = user_id);
  CREATE POLICY "Nutzer löscht eigene Daten" ON user_data FOR DELETE USING (auth.uid() = user_id);
  ```
  Die App erkennt fehlende RLS-Regeln automatisch (leeres UPDATE-/INSERT-Ergebnis → Fehlermeldung).
- **TODO: Ende-zu-Ende-Verschlüsselung** — Die Schülerdaten werden aktuell als Klartext-JSON
  in der `data`-Spalte gespeichert. Langfristig sollte eine clientseitige Verschlüsselung
  (Web Crypto API / AES-GCM) eingebaut werden, sodass Supabase nur verschlüsselte Blobs speichert.
  Herausforderung: Schlüssel darf nicht am Passwort hängen (sonst bricht "Passwort vergessen").
  Möglicher Ansatz: separater Data Encryption Key (DEK) + Recovery-Code bei Kontoerstellung.
