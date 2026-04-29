"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";

interface ParsedRow {
  employeeNumber: string;
  balance: number;
  lineNumber: number;
}

interface ImportResult {
  applied: { employeeNumber: string; name: string; oldBalance: number; newBalance: number }[];
  unmatched: string[];
  errors: string[];
  summary: { processed: number; updated: number; unchanged: number; unmatched: number; invalid: number };
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function parseCsv(raw: string): { rows: ParsedRow[]; parseErrors: string[] } {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ParsedRow[] = [];
  const parseErrors: string[] = [];

  // Optional: detect and skip header row containing letters in both cols
  let startIdx = 0;
  if (lines.length > 0) {
    const first = lines[0].split(/[;,\t]/).map((s) => s.trim());
    if (first.length >= 2 && !/^\d+$/.test(first[0]) && isNaN(parseFloat(first[1].replace(",", ".")))) {
      startIdx = 1;
    }
  }

  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(/[;,\t]/).map((s) => s.trim());
    if (parts.length < 2) {
      parseErrors.push(`Zeile ${i + 1}: zu wenige Spalten`);
      continue;
    }
    const employeeNumber = parts[0];
    const balStr = parts[1].replace(",", ".");
    const balance = parseFloat(balStr);
    if (!employeeNumber) {
      parseErrors.push(`Zeile ${i + 1}: Mitarbeiternummer fehlt`);
      continue;
    }
    if (!Number.isFinite(balance)) {
      parseErrors.push(`Zeile ${i + 1}: "${parts[1]}" ist keine Zahl`);
      continue;
    }
    rows.push({ employeeNumber, balance, lineNumber: i + 1 });
  }

  return { rows, parseErrors };
}

export function BalanceImportDialog({ open, onClose }: Props) {
  const [raw, setRaw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const parsed = raw.trim() ? parseCsv(raw) : { rows: [], parseErrors: [] };
  const preview = parsed.rows.slice(0, 8);

  async function handleFile(file: File) {
    const text = await file.text();
    setRaw(text);
  }

  async function handleSubmit() {
    if (parsed.rows.length === 0) {
      toast.error("Keine gueltigen Zeilen zum Importieren");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/admin/users/import-balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: parsed.rows.map((r) => ({
          employeeNumber: r.employeeNumber,
          balance: r.balance,
        })),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Import fehlgeschlagen");
      return;
    }
    const data = (await res.json()) as ImportResult;
    setResult(data);
    if (data.summary.updated > 0) {
      toast.success(`${data.summary.updated} Salden aktualisiert`);
    }
  }

  function reset() {
    setRaw("");
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gleitzeit-Salden importieren</DialogTitle>
          <DialogDescription>
            CSV-Format: <code className="font-mono bg-muted px-1 rounded">Mitarbeiternummer;Saldo</code>.
            Saldo in Stunden (z.B. <code className="font-mono">12.5</code> oder <code className="font-mono">-8.25</code>).
            Kopf-Zeile wird automatisch erkannt.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                id="balance-file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <label
                htmlFor="balance-file"
                className="inline-flex items-center gap-2 cursor-pointer text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
              >
                <Upload className="h-3.5 w-3.5" /> CSV-Datei auswählen
              </label>
              <span className="text-xs text-muted-foreground">oder unten einfügen</span>
            </div>

            <Textarea
              rows={10}
              placeholder="1001;12.5&#10;1002;-8.25&#10;1003;0"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="font-mono text-sm"
            />

            {parsed.rows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {parsed.rows.length} Zeile{parsed.rows.length === 1 ? "" : "n"} erkannt
                  </span>
                  {parsed.parseErrors.length > 0 && (
                    <span className="text-destructive text-xs">
                      {parsed.parseErrors.length} Parse-Fehler
                    </span>
                  )}
                </div>
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs">
                      <tr>
                        <th className="text-left px-3 py-2">Zeile</th>
                        <th className="text-left px-3 py-2">Mitarbeiter-Nr.</th>
                        <th className="text-right px-3 py-2">Saldo (h)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r) => (
                        <tr key={r.lineNumber} className="border-t border-border">
                          <td className="px-3 py-1.5 text-xs text-muted-foreground">{r.lineNumber}</td>
                          <td className="px-3 py-1.5 font-mono">{r.employeeNumber}</td>
                          <td
                            className={`px-3 py-1.5 text-right font-mono ${
                              r.balance > 0 ? "text-success" : r.balance < 0 ? "text-destructive" : ""
                            }`}
                          >
                            {r.balance > 0 ? "+" : ""}
                            {r.balance.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.rows.length > preview.length && (
                    <p className="text-xs text-muted-foreground text-center py-2 bg-muted/20">
                      + {parsed.rows.length - preview.length} weitere Zeilen
                    </p>
                  )}
                </div>
                {parsed.parseErrors.length > 0 && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-1">
                    {parsed.parseErrors.slice(0, 5).map((e, i) => (
                      <p key={i} className="text-destructive">{e}</p>
                    ))}
                    {parsed.parseErrors.length > 5 && (
                      <p className="text-muted-foreground">
                        + {parsed.parseErrors.length - 5} weitere
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2.5">
              <strong>Tipp:</strong> Vor dem Import das Go-Live-Datum setzen, damit nur der
              übertragene Anfangssaldo zählt und nicht historische Daten aus unserem System.
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <StatCell label="Verarbeitet" value={result.summary.processed} />
              <StatCell label="Aktualisiert" value={result.summary.updated} tone="success" />
              <StatCell label="Unverändert" value={result.summary.unchanged} />
              <StatCell label="Nicht gefunden" value={result.summary.unmatched} tone="destructive" />
            </div>

            {result.applied.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-success" /> Aktualisiert
                </div>
                <div className="rounded-md border border-border max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {result.applied.map((r) => (
                        <tr key={r.employeeNumber} className="border-t border-border first:border-0">
                          <td className="px-3 py-1.5 font-mono text-xs">{r.employeeNumber}</td>
                          <td className="px-3 py-1.5">{r.name}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-xs text-muted-foreground">
                            {r.oldBalance.toFixed(2)}h
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-xs">→</td>
                          <td
                            className={`px-3 py-1.5 text-right font-mono ${
                              r.newBalance > 0 ? "text-success" : r.newBalance < 0 ? "text-destructive" : ""
                            }`}
                          >
                            {r.newBalance > 0 ? "+" : ""}
                            {r.newBalance.toFixed(2)}h
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.unmatched.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  Mitarbeiter nicht gefunden
                </div>
                <p className="text-xs font-mono text-muted-foreground">
                  {result.unmatched.join(", ")}
                </p>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 text-destructive" />
                  Validierungsfehler
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {result.errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {!result ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={submitting}>
                Abbrechen
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || parsed.rows.length === 0}
              >
                {submitting ? "Wird importiert..." : `${parsed.rows.length} Salden importieren`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={reset}>Weitere importieren</Button>
              <Button onClick={handleClose}>Fertig</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCell({ label, value, tone }: { label: string; value: number; tone?: "success" | "destructive" }) {
  return (
    <div className="rounded-md border border-border p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-2xl font-semibold font-mono ${
          tone === "success" ? "text-success" : tone === "destructive" && value > 0 ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
