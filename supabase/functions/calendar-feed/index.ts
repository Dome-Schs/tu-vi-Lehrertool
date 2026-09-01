import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoToIcs(date: string, time?: string): string {
  const d = date.replace(/-/g, "");
  if (time) return `${d}T${time.replace(":", "")}00`;
  return d;
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function rruleFromRecurrence(rec: string): string | null {
  switch (rec) {
    case "weekly": return "RRULE:FREQ=WEEKLY";
    case "biweekly": return "RRULE:FREQ=WEEKLY;INTERVAL=2";
    case "monthly": return "RRULE:FREQ=MONTHLY";
    default: return null;
  }
}

function addDaysIso(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token || token.length < 16) {
    return new Response("Fehlender oder ungültiger Token.", {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: rows, error } = await supabase
    .from("user_data")
    .select("data")
    .limit(100);

  if (error) {
    return new Response("Datenbankfehler.", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const row = (rows || []).find(
    (r: any) => r.data?.calendarToken === token
  );

  if (!row) {
    return new Response("Kalender nicht gefunden.", {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const appData = row.data;
  const events: string[] = [];

  (appData.events || []).forEach((e: any) => {
    if (!e.date || e.done) return;
    if (e.type === "ferien" || e.type === "frei") return;

    const lines: string[] = ["BEGIN:VEVENT"];
    lines.push(`UID:${e.id}@tu-vi`);

    if (e.time) {
      lines.push(`DTSTART:${isoToIcs(e.date, e.time)}`);
      const [h, m] = e.time.split(":").map(Number);
      const endH = h + 1;
      lines.push(`DTEND:${isoToIcs(e.date, `${pad(endH)}:${pad(m)}`)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${isoToIcs(e.date)}`);
      if (e.endDate) {
        lines.push(`DTEND;VALUE=DATE:${isoToIcs(addDaysIso(e.endDate, 1))}`);
      } else {
        lines.push(`DTEND;VALUE=DATE:${isoToIcs(addDaysIso(e.date, 1))}`);
      }
    }

    lines.push(`SUMMARY:${escapeIcs(e.title || "Termin")}`);

    const rrule = e.recurrence ? rruleFromRecurrence(e.recurrence) : null;
    if (rrule) lines.push(rrule);

    lines.push("END:VEVENT");
    events.push(lines.join("\r\n"));
  });

  const classes = appData.classes || [];
  (appData.faecher || []).forEach((f: any) => {
    if (!f.nextTestDate || f.deletedAt) return;
    const cls = classes.find((c: any) => c.id === f.classId);
    const title = `${cls?.name || ""} ${f.subject}: ${f.nextTestTitle || "Klassenarbeit"}`.trim();

    const lines: string[] = ["BEGIN:VEVENT"];
    lines.push(`UID:ka-${f.id}@tu-vi`);
    lines.push(`DTSTART;VALUE=DATE:${isoToIcs(f.nextTestDate)}`);
    lines.push(`DTEND;VALUE=DATE:${isoToIcs(addDaysIso(f.nextTestDate, 1))}`);
    lines.push(`SUMMARY:${escapeIcs(title)}`);
    lines.push("END:VEVENT");
    events.push(lines.join("\r\n"));
  });

  (appData.tasks || []).forEach((t: any) => {
    if (!t.dueDate || t.done) return;
    const lines: string[] = ["BEGIN:VEVENT"];
    lines.push(`UID:task-${t.id}@tu-vi`);
    lines.push(`DTSTART;VALUE=DATE:${isoToIcs(t.dueDate)}`);
    lines.push(`DTEND;VALUE=DATE:${isoToIcs(addDaysIso(t.dueDate, 1))}`);
    lines.push(`SUMMARY:${escapeIcs(t.title || "Aufgabe")}`);
    lines.push("END:VEVENT");
    events.push(lines.join("\r\n"));
  });

  const cal = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tu-vi//Lehrertool//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Tu-vi Kalender",
    "X-WR-TIMEZONE:Europe/Berlin",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(cal, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-cache, max-age=0",
    },
  });
});
