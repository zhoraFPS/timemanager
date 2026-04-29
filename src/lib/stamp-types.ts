export const STAMP_IN_TYPES = {
  WORK:          { label: "Kommen",             color: "bg-blue-600",   textColor: "text-blue-400" },
  MOBILE_WORK:   { label: "Mobiles Arbeiten",    color: "bg-purple-600", textColor: "text-purple-400" },
  HOME_GAME:     { label: "Heimspiel",           color: "bg-green-600",  textColor: "text-green-400" },
  AWAY_GAME:     { label: "Auswärtsspiel",       color: "bg-orange-600", textColor: "text-orange-400" },
  BUSINESS_TRIP: { label: "Dienstreise",         color: "bg-yellow-600", textColor: "text-yellow-400" },
  TRAINING:      { label: "Fortbildung",         color: "bg-cyan-600",   textColor: "text-cyan-400" },
  VOLUNTEERING:  { label: "Corp. Volunteering",  color: "bg-pink-600",   textColor: "text-pink-400" },
} as const;

export type StampInType = keyof typeof STAMP_IN_TYPES;

export const STAMP_OUT_TYPE = "LEAVE";

export const ALL_STAMP_TYPES = [...Object.keys(STAMP_IN_TYPES), STAMP_OUT_TYPE] as const;
