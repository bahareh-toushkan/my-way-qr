// 세션 상태를 주기적으로 받아 오는 훅 (키오스크·휴대폰이 같은 상태를 본다)
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Actor, SessionState } from '../../shared/types';
import { api, ApiError } from './api';

export interface SessionHook {
  state: SessionState | null;
  gone: boolean;
  error: string | null;
  busy: boolean;
  send: (ref: string) => Promise<SessionState | null>;
  replace: (s: SessionState) => void;
}

export function useSession(id: string | null, actor: Actor, intervalMs = 1200): SessionHook {
  const [state, setState] = useState<SessionState | null>(null);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const versionRef = useRef(-1);

  const accept = useCallback((s: SessionState) => {
    if (s.version >= versionRef.current) {
      versionRef.current = s.version;
      setState(s);
    }
  }, []);

  const replace = useCallback((s: SessionState) => {
    versionRef.current = s.version;
    setState(s);
    setGone(false);
  }, []);

  useEffect(() => {
    if (!id) return;
    let stop = false;
    versionRef.current = -1;
    const tick = async () => {
      try {
        const { state: s } = await api.getSession(id);
        if (!stop) {
          accept(s);
          setError(null);
        }
      } catch (e) {
        if (stop) return;
        if (e instanceof ApiError && e.status === 404) setGone(true);
        else setError((e as Error).message);
      }
    };
    tick();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') tick();
    }, intervalMs);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [id, intervalMs, accept]);

  const send = useCallback(
    async (ref: string) => {
      if (!id) return null;
      setBusy(true);
      try {
        const r = await api.action(id, ref, actor);
        accept(r.state);
        setError(r.error ?? null);
        return r.state;
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) setGone(true);
        else setError((e as Error).message);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [id, actor, accept],
  );

  return { state, gone, error, busy, send, replace };
}
