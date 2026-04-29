import { create } from "zustand";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import type { User, TimeEntry, Project, FlexData, TeamMember, Shift } from "./types";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

// SecureStore only works on native — fall back to AsyncStorage on web
let SecureStore: {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

if (Platform.OS === "web") {
  SecureStore = {
    getItemAsync: (key) => AsyncStorage.getItem(key),
    setItemAsync: (key, value) => AsyncStorage.setItem(key, value),
    deleteItemAsync: (key) => AsyncStorage.removeItem(key),
  };
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SecureStore = require("expo-secure-store");
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  deviceId: string | null;
  biometrieEnabled: boolean;
  pushEnabled: boolean;
  isAuthenticated: boolean;

  setAuth: (
    user: User,
    accessToken: string,
    refreshToken: string
  ) => Promise<void>;
  refresh: () => Promise<boolean>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<boolean>;
  setBiometrie: (enabled: boolean) => Promise<void>;
  setDeviceId: (id: string) => Promise<void>;
  setPushEnabled: (enabled: boolean) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  deviceId: null,
  biometrieEnabled: false,
  pushEnabled: false,
  isAuthenticated: false,

  setAuth: async (user, accessToken, refreshToken) => {
    await SecureStore.setItemAsync("refreshToken", refreshToken);
    await SecureStore.setItemAsync("user", JSON.stringify(user));
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  refresh: async () => {
    const rt = get().refreshToken;
    if (!rt) return false;
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken: rt });
      await SecureStore.setItemAsync("refreshToken", data.refreshToken);
      set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch {
      return false;
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync("refreshToken");
    await SecureStore.deleteItemAsync("user");
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  loadStoredAuth: async () => {
    const rt = await SecureStore.getItemAsync("refreshToken");
    const userStr = await SecureStore.getItemAsync("user");
    const deviceId = await SecureStore.getItemAsync("deviceId");
    const bioEnabled = await SecureStore.getItemAsync("biometrieEnabled");
    const pushStored = await SecureStore.getItemAsync("pushEnabled");

    if (rt && userStr) {
      const user = JSON.parse(userStr);
      set({
        refreshToken: rt,
        user,
        deviceId,
        biometrieEnabled: bioEnabled === "true",
        pushEnabled: pushStored === "true",
      });
      try {
        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken: rt });
        await SecureStore.setItemAsync("refreshToken", data.refreshToken);
        set({ accessToken: data.accessToken, refreshToken: data.refreshToken, isAuthenticated: true });
        return true;
      } catch {
        return false;
      }
    }
    if (deviceId) set({ deviceId });
    return false;
  },

  setBiometrie: async (enabled) => {
    await SecureStore.setItemAsync(
      "biometrieEnabled",
      enabled ? "true" : "false"
    );
    set({ biometrieEnabled: enabled });
  },

  setDeviceId: async (id) => {
    await SecureStore.setItemAsync("deviceId", id);
    set({ deviceId: id });
  },

  setPushEnabled: async (enabled) => {
    await SecureStore.setItemAsync("pushEnabled", enabled ? "true" : "false");
    set({ pushEnabled: enabled });
  },
}));

interface TimeState {
  currentEntry: TimeEntry | null;
  weekEntries: TimeEntry[];
  projects: Project[];
  flexData: FlexData | null;
  isLoading: boolean;

  setCurrentEntry: (entry: TimeEntry | null) => void;
  setWeekEntries: (entries: TimeEntry[]) => void;
  setProjects: (projects: Project[]) => void;
  setFlexData: (data: FlexData) => void;
  setLoading: (loading: boolean) => void;
}

export const useTimeStore = create<TimeState>((set) => ({
  currentEntry: null,
  weekEntries: [],
  projects: [],
  flexData: null,
  isLoading: false,

  setCurrentEntry: (entry) => set({ currentEntry: entry }),
  setWeekEntries: (entries) => set({ weekEntries: entries }),
  setProjects: (projects) => set({ projects }),
  setFlexData: (data) => set({ flexData: data }),
  setLoading: (loading) => set({ isLoading: loading }),
}));

interface TeamState {
  members: TeamMember[];
  shifts: Shift[];
  setMembers: (members: TeamMember[]) => void;
  setShifts: (shifts: Shift[]) => void;
}

export const useTeamStore = create<TeamState>((set) => ({
  members: [],
  shifts: [],
  setMembers: (members) => set({ members }),
  setShifts: (shifts) => set({ shifts }),
}));
