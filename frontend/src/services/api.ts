/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// In production or Docker container, API is served from same origin via nginx proxy.
// Only when running standalone Vite dev server (:5173 or :3000) do we point to :8000.
export const API_BASE_URL = (() => {
  const envUrl = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL;
  if (envUrl !== undefined && envUrl !== '') return envUrl === '/' ? '' : envUrl;

  if (typeof window !== 'undefined') {
    // If running under Vite dev server, connect directly to backend on :8000
    if (window.location.port === '5173' || window.location.port === '3000') {
      return 'http://127.0.0.1:8000';
    }
    // In Docker (ports 80, 8080) or deployed (Render, custom domain), use same-origin nginx proxy
    return '';
  }
  return 'http://127.0.0.1:8000';
})();

export interface ScreenRequestPayload {
  agent_context: {
    agent_id: string;
    session_id: string;
    recent_tool_calls?: string[];
  };
  incoming_content: {
    source: 'user_input' | 'retrieved_document' | 'system';
    text: string;
  };
  proposed_tool_call: {
    tool_name: string;
    arguments?: Record<string, any>;
  };
}

export interface ScreenResponseData {
  risk_score: number;
  matched_signals: Array<{
    stage: string;
    signal: string;
    detail?: string;
    score?: number;
  }>;
  verdict: 'allow' | 'block' | 'require_approval';
  explanation: string;
  policy_check: {
    tool_name: string;
    allowed: boolean;
    reason: string;
  };
  decision_latency_ms?: number;
  request_id?: string;
  timestamp?: string;
}

export interface StatsResponse {
  total_screened: number;
  blocked: number;
  allowed: number;
  requires_approval: number;
  average_risk_score: number;
  block_rate: number;
}

export interface AuditEventItem {
  id: number;
  timestamp: string;
  agent_id: string;
  session_id: string;
  tool_name: string;
  incoming_source: string;
  risk_score: number;
  verdict: 'allow' | 'block' | 'require_approval';
  explanation: string;
  matched_signals: any[];
  policy_allowed: boolean;
  policy_reason: string;
  user_id?: string;
  user_email?: string;
  user_role?: string;
}

export interface ScenarioDefinition {
  scenario_id: number;
  title: string;
  description: string;
  incoming_source: string;
  proposed_tool_name: string;
}

// ── Auth & Headers ─────────────────────────────────────────────────────────────

export const getStoredToken = (): string | null => {
  return localStorage.getItem('sentinel_jwt_token') || localStorage.getItem('sentinel_token') || localStorage.getItem('sentinel_jwt');
};

export const setStoredToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('sentinel_jwt_token', token);
    localStorage.setItem('sentinel_token', token);
    localStorage.setItem('sentinel_jwt', token);
  } else {
    localStorage.removeItem('sentinel_jwt_token');
    localStorage.removeItem('sentinel_token');
    localStorage.removeItem('sentinel_jwt');
  }
};

const getHeaders = (token?: string | null): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const activeToken = token !== undefined ? token : getStoredToken();
  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
    headers['X-Sentinel-Token'] = activeToken;
  }
  return headers;
};

// ── Auth Helpers ──────────────────────────────────────────────────────────────

/** Create a temporary 30-minute guest session — no account required */
export async function loginAsGuest(): Promise<{ token: string; user: any }> {
  const response = await fetch(`${API_BASE_URL}/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Guest session creation failed');
  const data = await response.json();
  setStoredToken(data.token);
  return data;
}

/** Login with a specific demo role (admin/developer/intern/tech_lead) */
export async function loginWithDemoRole(role: string): Promise<{ token: string; user: any }> {
  const response = await fetch(`${API_BASE_URL}/auth/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) throw new Error(`Demo login failed for role: ${role}`);
  const data = await response.json();
  setStoredToken(data.token);
  return data;
}

// ── Core API Calls ─────────────────────────────────────────────────────────────

/** Screen payload through the 3-stage cascade */
export async function screenContent(
  payload: ScreenRequestPayload,
  token?: string | null
): Promise<ScreenResponseData> {
  const startTime = performance.now();
  const response = await fetch(`${API_BASE_URL}/screen`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || 'Screening request failed');
  }

  const data: ScreenResponseData = await response.json();
  data.decision_latency_ms = Math.round((performance.now() - startTime) * 10) / 10;
  return data;
}

/** Fetch live stats summary */
export async function fetchEventStats(token?: string | null): Promise<StatsResponse> {
  const response = await fetch(`${API_BASE_URL}/events/stats`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error('Failed to fetch event stats');
  return response.json();
}

/** Fetch historical audit events */
export async function fetchEventHistory(
  params: { limit?: number; offset?: number; verdict?: string } = {},
  token?: string | null
): Promise<{ events: AuditEventItem[]; total: number; limit: number; offset: number }> {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.offset) query.set('offset', params.offset.toString());
  if (params.verdict && params.verdict !== 'ALL') query.set('verdict', params.verdict.toLowerCase());

  const response = await fetch(`${API_BASE_URL}/events/history?${query.toString()}`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error('Failed to fetch event history');
  return response.json();
}

/** Seed demo data */
export async function seedDemoData(): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/demo/seed`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to seed demo data');
  return response.json();
}

/** Fetch attack scenarios */
export async function fetchScenarios(): Promise<{ scenarios: ScenarioDefinition[]; count: number }> {
  const response = await fetch(`${API_BASE_URL}/demo/scenarios`, {
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to fetch scenarios');
  return response.json();
}

export interface PendingApproval {
  id: number;
  timestamp: string;
  agent_id: string;
  tool_name: string;
  risk_score: number;
  explanation: string;
  matched_signals: any[];
  llm_reasoning?: string;
  attack_category?: string;
  user_email?: string;
  user_role?: string;
}

export async function fetchPendingApprovals(): Promise<{ pending: PendingApproval[]; count: number }> {
  const response = await fetch(`${API_BASE_URL}/approvals/pending`, { headers: getHeaders() });
  if (!response.ok) return { pending: [], count: 0 };
  return response.json();
}

export async function decideApproval(eventId: number, approved: boolean, reason = ''): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/approvals/${eventId}/decide`, {
    method: 'POST', headers: getHeaders(), body: JSON.stringify({ approved, reason }),
  });
  if (!response.ok) throw new Error('Failed to decide');
  return response.json();
}


/** Run single attack scenario */
export async function runAttackScenario(scenarioId: number): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/demo/run-scenario`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ scenario_id: scenarioId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to run scenario' }));
    throw new Error(err.detail || 'Failed to run scenario');
  }
  return response.json();
}

/** Start continuous simulation */
export async function startContinuousSimulation(): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/demo/continuous`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to start continuous simulation');
  return response.json();
}

/** Stop continuous simulation */
export async function stopContinuousSimulation(): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/demo/continuous/stop`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to stop continuous simulation');
  return response.json();
}

/** Fetch declarative policy */
export async function fetchPolicy(): Promise<{ policy_path: string; raw_yaml: string; parsed: any }> {
  const response = await fetch(`${API_BASE_URL}/policy`, {
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to fetch policy');
  return response.json();
}

/** Update declarative policy */
export async function updatePolicy(policyYaml: string, token?: string | null): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/policy`, {
    method: 'PUT',
    headers: getHeaders(token),
    body: JSON.stringify({ policy_yaml: policyYaml }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Policy update failed' }));
    throw new Error(err.detail || 'Policy update failed');
  }
  return response.json();
}

/** 1-Click Role Login */
export async function loginDemoRole(role: string): Promise<{ token: string; user: any }> {
  const response = await fetch(`${API_BASE_URL}/auth/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) throw new Error('Demo login failed');
  const data = await response.json();
  setStoredToken(data.token);
  return data;
}

/** Fetch Current User Profile */
export async function fetchCurrentUser(token?: string | null): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error('Failed to fetch user profile');
  return response.json();
}

/** Generate Agent Session Token */
export async function generateAgentToken(token?: string | null): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/tokens/agent`, {
    method: 'POST',
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error('Failed to generate agent token');
  return response.json();
}

/** List Agent Session Tokens */
export async function listAgentTokens(token?: string | null): Promise<{ tokens: any[]; total: number }> {
  const response = await fetch(`${API_BASE_URL}/tokens/agent`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error('Failed to list agent tokens');
  return response.json();
}

/** Revoke Agent Session Token */
export async function revokeAgentToken(jti: string, token?: string | null): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/tokens/agent/${jti}`, {
    method: 'DELETE',
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error('Failed to revoke agent token');
  return response.json();
}

/** Trigger Cold Storage Sync */
export async function syncColdStorage(): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/events/sync-cold`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to trigger cold sync');
  return response.json();
}

// ── User Management (Admin Only) ─────────────────────────────────────────────

export interface ManagedUserAccount {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: 'admin' | 'tech_lead' | 'developer' | 'intern';
  permissions: Record<string, boolean>;
  is_active: boolean;
  oauth_provider?: string;
  created_at?: string;
}

/** List all users */
export async function listUsers(token?: string | null): Promise<{ users: ManagedUserAccount[]; total: number }> {
  const response = await fetch(`${API_BASE_URL}/users`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error('Failed to list users');
  return response.json();
}

/** Invite new user */
export async function inviteUser(
  data: { email: string; name: string; role: string },
  token?: string | null
): Promise<{ message: string; user: ManagedUserAccount }> {
  const response = await fetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to invite user' }));
    throw new Error(err.detail || 'Failed to invite user');
  }
  return response.json();
}

/** Update user role */
export async function updateUserRole(
  userId: string,
  role: string,
  token?: string | null
): Promise<{ message: string; user: ManagedUserAccount }> {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/role`, {
    method: 'PATCH',
    headers: getHeaders(token),
    body: JSON.stringify({ role }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to update user role' }));
    throw new Error(err.detail || 'Failed to update user role');
  }
  return response.json();
}

/** Update individual tool permissions for a user */
export async function updateUserPermissions(
  userId: string,
  permissions: Record<string, boolean>,
  token?: string | null
): Promise<{ message: string; updated: Record<string, boolean>; user: ManagedUserAccount }> {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/permissions`, {
    method: 'PATCH',
    headers: getHeaders(token),
    body: JSON.stringify({ permissions }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Failed to update permissions' }));
    throw new Error(err.detail || 'Failed to update permissions');
  }
  return response.json();
}

/** Deactivate user account */
export async function deactivateUser(
  userId: string,
  token?: string | null
): Promise<{ message: string; id: string }> {
  const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
    method: 'DELETE',
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error('Failed to deactivate user');
  return response.json();
}

// ── Real-Time Stream Helper (WebSocket + SSE Fallback) ────────────────────────

export function subscribeToEventStream(
  onEvent: (event: any) => void,
  token?: string | null
): () => void {
  const activeToken = token !== undefined ? token : getStoredToken();
  const tokenParam = activeToken ? `?token=${encodeURIComponent(activeToken)}` : '';
  
  let ws: WebSocket | null = null;
  let es: EventSource | null = null;
  let isClosed = false;

  const connectWS = () => {
    if (isClosed) return;
    try {
      const base = API_BASE_URL || (typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'https:' : 'http:'}//${window.location.host}` : 'http://127.0.0.1:8000');
      const wsUrl = base.replace(/^http/, 'ws') + `/ws/events${tokenParam}`;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onEvent(data);
        } catch {}
      };

      ws.onerror = () => {
        if (!isClosed) fallbackSSE();
      };

      ws.onclose = () => {
        if (!isClosed) fallbackSSE();
      };
    } catch {
      fallbackSSE();
    }
  };

  const fallbackSSE = () => {
    if (isClosed || es) return;
    try {
      const sseUrl = `${API_BASE_URL}/events/stream${tokenParam}`;
      es = new EventSource(sseUrl);

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onEvent(data);
        } catch {}
      };

      es.onerror = () => {
        console.debug('SSE stream reconnecting...');
      };
    } catch {}
  };

  connectWS();

  return () => {
    isClosed = true;
    if (ws) ws.close();
    if (es) es.close();
  };
}

// ── Agent Registry & Leaderboard ─────────────────────────────────────────────

export interface AgentRegistryEntry {
  agent_id: string;
  total_calls: number;
  blocked_calls: number;
  block_rate: number;
  avg_risk_score: number;
  last_seen: string | null;
}

export async function fetchAgentRegistry(): Promise<{ agents: AgentRegistryEntry[]; total: number }> {
  const response = await fetch(`${API_BASE_URL}/agents/registry`, { headers: getHeaders() });
  if (!response.ok) return { agents: [], total: 0 };
  return response.json();
}

export async function fetchAgentLeaderboard(): Promise<{ leaderboard: AgentRegistryEntry[]; total: number }> {
  const response = await fetch(`${API_BASE_URL}/agents/leaderboard`, { headers: getHeaders() });
  if (!response.ok) return { leaderboard: [], total: 0 };
  return response.json();
}

