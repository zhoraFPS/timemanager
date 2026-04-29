"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { REQUEST_TYPES, RequestType } from "@/lib/request-types";

interface CreatedRequest {
  id: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  note: string | null;
  createdAt: string;
}

interface RequestFormProps {
  onSuccess: (created?: CreatedRequest) => void;
}

export function RequestForm({ onSuccess }: RequestFormProps) {
  const [type, setType] = useState<RequestType>("VACATION");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, dateFrom, dateTo, note }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error ?? "Fehler beim Erstellen des Antrags");
        setLoading(false);
        return;
      }

      // Reset first so the form is immediately ready for another submit.
      setDateFrom("");
      setDateTo("");
      setNote("");
      setLoading(false);

      toast.success(
        type === "SICK"
          ? "Krankmeldung erfasst"
          : "Antrag eingereicht"
      );
      onSuccess(data.request);
    } catch {
      toast.error("Netzwerkfehler — bitte erneut versuchen");
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Neuer Antrag</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Antragstyp</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as RequestType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REQUEST_TYPES).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    {val.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Von</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Bis</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Anmerkung (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Weitere Informationen..."
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Wird eingereicht..." : "Antrag einreichen"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
