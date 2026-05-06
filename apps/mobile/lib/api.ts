import axios from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";
import type {
  TimeEntry,
  AppRequest,
  TeamMember,
  Shift,
  FlexData,
  Project,
  User,
  PasswordPolicy,
  DeviceInfo,
} from "./types";

// If EXPO_PUBLIC_API_URL is set, use it. Otherwise derive the host from the
// Expo dev-server URL so the app works on any network without touching .env.
function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // hostUri looks like "192.168.x.x:8081" — strip the port and use 3000
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    let host = hostUri.split(":")[0];
    // Android emulator reports 127.0.0.1 but needs 10.0.2.2 to reach host
    if (Platform.OS === "android" && (host === "127.0.0.1" || host === "localhost")) {
      host = "10.0.2.2";
    }
    return `http://${host}:3001`;
  }
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3001";
  }
  return "http://localhost:3001";
}

const API_URL = resolveApiUrl();
// Debug: log resolved API URL on startup
console.log(`[API] Resolved URL: ${API_URL} (platform: ${Platform.OS})`);

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Lazy import to break circular dependency
function getAuthStore() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./store").useAuthStore;
}

// Attach access token
api.interceptors.request.use((config) => {
  const token = getAuthStore().getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — silent refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const store = getAuthStore();
      const refreshed = await store.getState().refresh();
      if (refreshed) {
        const newToken = store.getState().accessToken;
        originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${newToken}` };
        // Remove baseURL from url if axios prepended it to avoid double-prefix
        if (originalRequest.url?.startsWith(originalRequest.baseURL)) {
          originalRequest.url = originalRequest.url.slice(originalRequest.baseURL.length);
        }
        return api.request(originalRequest);
      }
      store.getState().logout();
    }
    return Promise.reject(error);
  }
);

// --- API Functions ---

export async function postStamp(
  type: string = "WORK",
  projectId?: string,
  timestamp?: string
): Promise<{ action: string; entry?: TimeEntry }> {
  const { data } = await api.post("/api/time-entries", {
    type,
    projectId,
    ...(timestamp ? { timestamp } : {}),
  });
  return data;
}

export async function getActiveEntry(): Promise<TimeEntry | null> {
  const { data } = await api.get("/api/time-entries/active");
  return data.entry || null;
}

export async function getWeekEntries(date: string): Promise<TimeEntry[]> {
  const { data } = await api.get(`/api/time-entries/week?date=${date}`);
  return data.entries;
}

export async function getRequests(): Promise<AppRequest[]> {
  const { data } = await api.get("/api/requests");
  return data.requests;
}

export async function createRequest(body: {
  type: string;
  dateFrom: string;
  dateTo: string;
  note?: string;
}): Promise<AppRequest> {
  const { data } = await api.post("/api/requests", body);
  return data.request;
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const { data } = await api.get("/api/team/members");
  return data.members;
}

export async function getCorrectionPolicy(): Promise<{
  directCorrectionDays: number;
  maxCorrectionDays: number;
}> {
  const { data } = await api.get("/api/time-entries/correction-policy");
  return data;
}

export async function directEditEntry(payload: {
  timeEntryId: string;
  newType?: string;
  newClockIn?: string;
  newClockOut?: string;
}): Promise<void> {
  await api.patch("/api/time-entries/direct-edit", payload);
}

export async function createMissingEntry(payload: {
  clockIn: string;
  clockOut?: string;
  type: string;
  reason?: string;
}): Promise<{ mode: "direct" | "request" }> {
  const { data } = await api.post("/api/time-entries/create-missing", payload);
  return data;
}

export async function createEditRequest(payload: {
  timeEntryId: string;
  newType?: string;
  newClockIn?: string;
  newClockOut?: string;
  reason: string;
}): Promise<void> {
  await api.post("/api/time-entries/edit-request", payload);
}

export async function getShifts(
  week: string
): Promise<{ weekStart: string; shifts: Shift[] }> {
  const { data } = await api.get(`/api/shifts?week=${week}`);
  return data;
}

export async function getFlextime(months: number = 12): Promise<FlexData> {
  const { data } = await api.get(`/api/reports/flextime?months=${months}`);
  return data;
}

export async function getProjects(): Promise<Project[]> {
  const { data } = await api.get("/api/admin/projects");
  return data;
}

export async function getProfile(): Promise<User> {
  const { data } = await api.get("/api/auth/me");
  return data;
}

export async function loginWithCredentials(
  employeeNumber: string,
  password: string,
  deviceId: string
) {
  const { data } = await api.post("/api/auth/mobile-login", {
    employeeNumber,
    password,
    deviceId,
  });
  return data as { accessToken: string; refreshToken: string; user: User };
}

export async function exchangeDeviceToken(token: string, deviceId: string) {
  const { data } = await api.post("/api/auth/device-exchange", {
    token,
    deviceId,
  });
  return data as { accessToken: string; refreshToken: string; user: User };
}

export async function refreshAccessToken(refreshToken: string) {
  const { data } = await api.post("/api/auth/refresh", { refreshToken });
  return data as { accessToken: string; refreshToken: string };
}

export async function registerPushToken(deviceId: string, pushToken: string, platform?: string) {
  await api.post("/api/auth/devices", { deviceId, pushToken, platform });
}

/** Withdraw a PENDING request — no approval needed, instant cancellation. */
export async function withdrawRequest(id: string) {
  await api.patch(`/api/requests/${id}/withdraw`);
}

/** Request cancellation of an APPROVED request — manager must approve. */
export async function cancelApprovedRequest(id: string, reason?: string) {
  const { data } = await api.post(`/api/requests/${id}/cancel`, { reason });
  return data;
}

export interface VacationBalance {
  year: number;
  totalDays: number;
  carryoverDays: number;
  totalAvailable: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  sickDays: number;
}

export async function getVacationBalance(year?: number): Promise<VacationBalance> {
  const url = year ? `/api/me/vacation?year=${year}` : "/api/me/vacation";
  const { data } = await api.get(url);
  return data as VacationBalance;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { data } = await api.get("/api/notifications/unread-count");
  return data.count ?? 0;
}

export async function getNotifications(limit = 30) {
  const { data } = await api.get(`/api/notifications?limit=${limit}`);
  return data.notifications as import("./types").AppNotification[];
}

export async function markNotificationRead(id: string) {
  await api.patch(`/api/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  // GET without preview=true triggers mark-as-read on the backend
  await api.get("/api/notifications?limit=1");
}

export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  const { data } = await api.get("/api/auth/password-policy");
  return data;
}

export async function changePassword(payload: {
  currentPassword?: string;
  newPassword: string;
}): Promise<void> {
  await api.post("/api/auth/change-password", payload);
}

export async function getMyDevices(): Promise<DeviceInfo[]> {
  const { data } = await api.get("/api/me/devices");
  return data.devices as DeviceInfo[];
}

export async function deleteMyDevice(id: string): Promise<void> {
  await api.delete("/api/me/devices", { data: { id } });
}
