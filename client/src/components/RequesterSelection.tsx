import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useRequester } from "../context/RequesterContext";
import { Button } from "./ui/Button";

type Requester = { id: number; name: string; email: string };
type Status = "loading" | "empty" | "error" | "ready";

// ui-spec.md §8, api-spec.md GET /api/requesters. BR-03/BR-04.
export function RequesterSelection({ onContinue }: { onContinue: () => void }) {
  const { selectRequester } = useRequester();
  const [status, setStatus] = useState<Status>("loading");
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    api
      .getRequesters()
      .then((res) => {
        if (cancelled) return;
        const list: Requester[] = res.data;
        setRequesters(list);
        setStatus(list.length === 0 ? "empty" : "ready");
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleContinue() {
    const requester = requesters.find((r) => r.id === selectedId);
    if (!requester) return;
    selectRequester(requester.id, requester.name);
    onContinue();
  }

  return (
    <div className="card" style={{ maxWidth: 480, margin: "64px auto" }}>
      <h1>Select Development Requester</h1>
      <p>
        Choose a development requester to simulate the current requester context for Lab 2. This is
        for testing only and is not a login screen.
      </p>

      {status === "loading" && <p role="status">Loading active requesters…</p>}

      {status === "error" && (
        <div className="callout callout-error" role="alert">
          Unable to load requesters right now. Please try again shortly.
        </div>
      )}

      {status === "empty" && (
        <div className="callout callout-error" role="alert">
          No active development requesters exist. Please contact your instructor or TA.
        </div>
      )}

      {status === "ready" && (
        <>
          <div className="field">
            <label htmlFor="requester-select">
              Development Requester<span className="required">*</span>
            </label>
            <select
              id="requester-select"
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(Number(e.target.value))}
            >
              {requesters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="callout">Only active development requesters are shown.</div>
          <div className="callout" style={{ marginTop: 12 }}>
            Authentication coming in Lab 3: this selection will be replaced with secure login.
          </div>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <Button variant="primary" onClick={handleContinue}>
              Continue
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
