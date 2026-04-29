export const REQUEST_TYPES = {
  VACATION: { label: "Urlaub", color: "bg-blue-500" },
  SICK: { label: "Krankmeldung", color: "bg-red-500" },
  HOMEOFFICE: { label: "Homeoffice", color: "bg-purple-500" },
  TIME_CORRECTION: { label: "Zeitkorrektur", color: "bg-yellow-500" },
  OVERTIME_REDUCE: { label: "Überstundenabbau", color: "bg-orange-500" },
  SPECIAL_LEAVE: { label: "Sonderurlaub", color: "bg-pink-500" },
} as const;

export type RequestType = keyof typeof REQUEST_TYPES;

export const STATUS_LABELS = {
  PENDING: { label: "Ausstehend", variant: "secondary" as const },
  APPROVED: { label: "Genehmigt", variant: "default" as const },
  REJECTED: { label: "Abgelehnt", variant: "destructive" as const },
  CANCELLED: { label: "Storniert", variant: "outline" as const },
};
