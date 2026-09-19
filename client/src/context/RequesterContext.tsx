import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type RequesterContextValue = {
  requesterId: number | null;
  requesterName: string | null;
  selectRequester: (id: number, name: string) => void;
  changeRequester: () => void;
};

// FR-01, FR-02, BR-03: the Development Requester is a Lab 2 testing identity,
// not an authenticated session. Persisted only for developer convenience.
const RequesterContext = createContext<RequesterContextValue | undefined>(undefined);
const STORAGE_KEY = "toktickit.devRequester";

export function RequesterProvider({ children }: { children: ReactNode }) {
  const [requesterId, setRequesterId] = useState<number | null>(null);
  const [requesterName, setRequesterName] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const { id, name } = JSON.parse(raw);
        setRequesterId(id);
        setRequesterName(name);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  function selectRequester(id: number, name: string) {
    setRequesterId(id);
    setRequesterName(name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, name }));
  }

  function changeRequester() {
    setRequesterId(null);
    setRequesterName(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <RequesterContext.Provider value={{ requesterId, requesterName, selectRequester, changeRequester }}>
      {children}
    </RequesterContext.Provider>
  );
}

export function useRequester() {
  const ctx = useContext(RequesterContext);
  if (!ctx) throw new Error("useRequester must be used within a RequesterProvider");
  return ctx;
}
