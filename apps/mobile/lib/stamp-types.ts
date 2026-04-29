import {
  Briefcase,
  Laptop,
  Landmark,
  Bus,
  Plane,
  GraduationCap,
  Heart,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

export interface StampType {
  key: string;
  label: string;
  color: string;
  icon: LucideIcon;
}

export const STAMP_TYPES: StampType[] = [
  { key: "WORK", label: "Kommen", color: "#3b82f6", icon: Briefcase },
  { key: "MOBILE_WORK", label: "Mobiles Arbeiten", color: "#8b5cf6", icon: Laptop },
  { key: "HOME_GAME", label: "Heimspiel", color: "#22c55e", icon: Landmark },
  { key: "AWAY_GAME", label: "Auswärtsspiel", color: "#f97316", icon: Bus },
  { key: "BUSINESS_TRIP", label: "Dienstreise", color: "#eab308", icon: Plane },
  { key: "TRAINING", label: "Fortbildung", color: "#06b6d4", icon: GraduationCap },
  { key: "VOLUNTEERING", label: "Corp. Volunteering", color: "#ec4899", icon: Heart },
];
