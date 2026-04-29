"use client";
import { useState, useRef } from "react";
import Papa from "papaparse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, CheckCircle2, AlertCircle } from "lucide-react";

interface Props { onSuccess: () => void; }
interface CsvRow {
  employeeNumber: string; firstName: string; lastName: string;
  email?: string; department?: string; contractType?: string;
  hoursPerWeek?: string; vacationDays?: string; startDate?: string;
}

const TEMPLATE = `employeeNumber,firstName,lastName,email,department,contractType,hoursPerWeek,vacationDays,startDate
1001,Max,Mustermann,max@firma.de,Büro,FULLTIME,40,28,2024-01-01
1002,Jana,Kluge,,Stadion,PARTTIME,20,14,2024-03-15`;

export function CsvImport({ onSuccess }: Props) {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<CsvRow>(file, { header: true, skipEmptyLines: true, complete: res => setRows(res.data) });
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mitarbeiter-vorlage.csv";
    a.click();
  }

  async function handleImport() {
    setLoading(true);
    const res = await fetch("/api/admin/users/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
    if (data.created > 0) onSuccess();
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">CSV-Import</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />Vorlage
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />CSV auswählen
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </div>
        {rows.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{rows.length} Mitarbeiter erkannt</p>
            <div className="max-h-40 overflow-y-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left p-2">Nr.</th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Abteilung</th>
                    <th className="text-left p-2">Vertrag</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="p-2 font-mono">{r.employeeNumber}</td>
                      <td className="p-2">{r.firstName} {r.lastName}</td>
                      <td className="p-2">{r.department ?? "—"}</td>
                      <td className="p-2">{r.contractType ?? "FULLTIME"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button onClick={handleImport} disabled={loading} className="w-full">
              {loading ? "Importiere..." : `${rows.length} Mitarbeiter importieren`}
            </Button>
          </div>
        )}
        {result && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Badge className="bg-success text-white">
                <CheckCircle2 className="h-3 w-3 mr-1" />{result.created} angelegt
              </Badge>
              {result.skipped > 0 && <Badge variant="secondary">{result.skipped} übersprungen</Badge>}
            </div>
            {result.errors.map((e, i) => (
              <div key={i} className="flex items-start gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />{e}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
