"use client";

import { createContext, useContext } from "react";

interface SessionData {
  permissions: string[];
  roleNames: string[];
}

const SessionContext = createContext<SessionData>({
  permissions: [],
  roleNames: [],
});

export function SessionProvider({
  permissions,
  roleNames,
  children,
}: SessionData & { children: React.ReactNode }) {
  return (
    <SessionContext.Provider value={{ permissions, roleNames }}>
      {children}
    </SessionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(SessionContext);
}
