export interface User {
  id: string;
  email: string;
  name: string;
  employeeNumber?: string;
  department?: string;
  contractType?: string;
  twoFactorEnabled?: boolean;
  mustChangePassword?: boolean;
}

export interface PasswordPolicy {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
}

export interface DeviceInfo {
  id: string;
  deviceId: string;
  name: string | null;
  platform: string | null;
  lastIp: string | null;
  lastUsed: string;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  userId: string;
  clockIn: string;
  clockOut: string | null;
  type: string;
  projectId: string | null;
  project?: Project;
  breakMinutes?: number;
  note?: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  color: string | null;
  isActive: boolean;
}

export interface AppRequest {
  id: string;
  userId: string;
  type:
    | "VACATION"
    | "SICK"
    | "HOMEOFFICE"
    | "TIME_CORRECTION"
    | "OVERTIME_REDUCE"
    | "SPECIAL_LEAVE"
    | "CANCEL_VACATION";
  dateFrom: string;
  dateTo: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  note?: string;
  relatedRequestId?: string | null;
  createdAt: string;
  approvals?: RequestApproval[];
}

export interface RequestApproval {
  id: string;
  approverId: string;
  status: string;
  comment?: string;
  decidedAt: string;
  approver?: { name: string };
}

export type MemberPresence =
  | { status: "present"; stampType: string }
  | { status: "absent" }
  | { status: "offline" };

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  department?: string;
  presence?: MemberPresence;
}

export interface Shift {
  id: string;
  userId: string;
  date: string;
  user: { id: string; name: string };
  template: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    color: string | null;
  };
}

export interface FlexMonth {
  year: number;
  month: number;
  targetMins: number;
  actualMins: number;
  saldoMins: number;
  cumulativeMins: number;
}

export interface FlexData {
  userId: string;
  name: string;
  hoursPerDay: number;
  initialBalanceHours: number;
  months: FlexMonth[];
}

export interface OfflineStamp {
  id: string;
  type: "WORK" | "OUT";
  timestamp: string;
  projectId?: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
  sender?: { name: string } | null;
}
