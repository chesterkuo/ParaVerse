# ParaVerse MVP Plan — Week 5–6

> Continuation (Tasks 20–25)

---

## Week 5: WebSocket + Frontend Skeleton

### Task 20: WebSocket endpoints for real-time events

**Files:**
- Create: `backend/src/routes/interaction.ts`
- Modify: `backend/src/index.ts` — mount WebSocket routes

**Step 1: Implement WebSocket route**

```typescript
// backend/src/routes/interaction.ts
import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import type { ServerWebSocket } from "bun";
import { getSimulationService } from "../services/simulationService";
import { verifyAccessToken } from "../services/authService";
import { query } from "../db/client";
import { logger } from "../utils/logger";

const { upgradeWebSocket, websocket } = createBunWebSocket();

const interaction = new Hono();

// WS /ws/simulations/:id — real-time simulation events
interaction.get(
  "/simulations/:id",
  upgradeWebSocket((c) => {
    const simId = c.req.param("id");

    return {
      onOpen(evt, ws) {
        logger.info({ simId }, "WebSocket connected for simulation");

        const simService = getSimulationService();
        const runner = simService.getRunner(simId);

        if (runner) {
          runner.onEvent((event) => {
            try {
              (ws as any).send(JSON.stringify(event));
            } catch {
              // Client disconnected
            }
          });
        }
      },

      onMessage(evt, ws) {
        // Client can send commands (e.g., interview requests)
        try {
          const cmd = JSON.parse(String(evt.data));
          const simService = getSimulationService();
          const runner = simService.getRunner(simId);
          if (runner && cmd.type) {
            runner.sendCommand(cmd);
          }
        } catch (err) {
          (ws as any).send(JSON.stringify({ type: "error", message: "Invalid command" }));
        }
      },

      onClose() {
        logger.info({ simId }, "WebSocket disconnected");
      },
    };
  })
);

// WS /ws/interactions/:id — deep conversation with agents
interaction.get(
  "/interactions/:id",
  upgradeWebSocket((c) => {
    const sessionId = c.req.param("id");

    return {
      onOpen(evt, ws) {
        logger.info({ sessionId }, "Interaction session opened");
      },

      onMessage(evt, ws) {
        try {
          const msg = JSON.parse(String(evt.data));

          // Store message in interaction session
          query(
            `UPDATE interaction_sessions
             SET messages = array_append(messages, $2::jsonb)
             WHERE id = $1`,
            [sessionId, JSON.stringify({ role: "user", content: msg.content, timestamp: new Date().toISOString() })]
          );

          // If targeting a specific agent in a running simulation
          if (msg.simulation_id && msg.agent_id) {
            const simService = getSimulationService();
            const runner = simService.getRunner(msg.simulation_id);
            if (runner) {
              runner.sendCommand({
                type: "interview_agent",
                agent_id: msg.agent_id,
                prompt: msg.content,
              });

              runner.onEvent((event) => {
                if ((event as any).type === "interview_response" && (event as any).agent_id === msg.agent_id) {
                  (ws as any).send(JSON.stringify(event));

                  // Store response
                  query(
                    `UPDATE interaction_sessions
                     SET messages = array_append(messages, $2::jsonb)
                     WHERE id = $1`,
                    [sessionId, JSON.stringify({ role: "agent", content: (event as any).response, timestamp: new Date().toISOString() })]
                  );
                }
              });
            }
          }
        } catch (err) {
          (ws as any).send(JSON.stringify({ type: "error", message: "Invalid message format" }));
        }
      },

      onClose() {
        logger.info({ sessionId }, "Interaction session closed");
      },
    };
  })
);

export { interaction, websocket };
```

**Step 2: Update index.ts for WebSocket support**

```typescript
// backend/src/index.ts (final version)
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { errorHandler } from "./middleware/errorHandler";
import { auth } from "./routes/auth";
import { projects } from "./routes/projects";
import { graph } from "./routes/graph";
import { simulation } from "./routes/simulation";
import { report } from "./routes/report";
import { tasks } from "./routes/tasks";
import { interaction, websocket } from "./routes/interaction";

const app = new Hono();

app.use("*", errorHandler);
app.use("*", cors());
app.use("*", honoLogger());

app.get("/health", (c) => c.json({ status: "ok" }));

// REST API
const api = new Hono();
api.route("/auth", auth);
api.route("/projects", projects);
api.route("/projects", graph);
api.route("/simulations", simulation);
api.route("/simulations", report);
api.route("/tasks", tasks);
app.route("/api/v1", api);

// WebSocket
app.route("/ws", interaction);

const port = parseInt(process.env.PORT || "5001");
console.log(`ParaVerse API running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
  websocket,
};
```

**Step 3: Commit**

```bash
git add backend/src/routes/interaction.ts backend/src/index.ts
git commit -m "feat: add WebSocket endpoints for simulation events and agent interaction"
```

---

### Task 21: Initialize React frontend project

**Files:**
- Create: `frontend/` (via Vite scaffolding)
- Modify: `frontend/package.json`
- Modify: `frontend/tsconfig.json`
- Modify: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.ts`

**Step 1: Scaffold with Vite**

```bash
cd /home/ubuntu/source/paraverse
bun create vite frontend --template react-ts
cd frontend
```

**Step 2: Install dependencies**

```bash
cd frontend
bun add react-router-dom@7 @tanstack/react-query zustand d3 recharts axios
bun add -d @types/d3 tailwindcss @tailwindcss/vite
```

**Step 3: Configure Vite with proxy and TailwindCSS**

```typescript
// frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@shared": resolve(__dirname, "../shared"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:5001",
      "/ws": {
        target: "ws://localhost:5001",
        ws: true,
      },
    },
  },
});
```

**Step 4: Configure TailwindCSS v4 globals**

```css
/* frontend/src/styles/globals.css */
@import "tailwindcss";

@theme {
  --color-navy: #0F2847;
  --color-violet: #6C3FC5;
  --color-oasis: #F59E0B;
  --color-concordia: #00C4B4;
  --color-bg: #FAFAF9;
}
```

**Step 5: Update tsconfig.json with path aliases**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src", "../shared"]
}
```

**Step 6: Verify dev server starts**

```bash
cd frontend && bun run dev
```

Expected: Vite dev server on http://localhost:3000

**Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: initialize React 18 + Vite + TailwindCSS v4 frontend"
```

---

### Task 22: Frontend API client, stores, and hooks

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/api/projects.ts`
- Create: `frontend/src/api/simulation.ts`
- Create: `frontend/src/api/report.ts`
- Create: `frontend/src/store/projectStore.ts`
- Create: `frontend/src/store/simulationStore.ts`
- Create: `frontend/src/store/uiStore.ts`
- Create: `frontend/src/hooks/useAuth.ts`
- Create: `frontend/src/hooks/useWebSocket.ts`
- Create: `frontend/src/hooks/useSimulation.ts`
- Create: `frontend/src/hooks/useReport.ts`
- Create: `frontend/src/hooks/useCheckpoint.ts`
- Create: `frontend/src/utils/engineLabel.ts`
- Create: `frontend/src/utils/formatters.ts`

**Step 1: Create Axios client with JWT interceptor**

```typescript
// frontend/src/api/client.ts
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE}/auth/refresh`, { refresh_token: refreshToken });
          localStorage.setItem("access_token", res.data.data.access_token);
          localStorage.setItem("refresh_token", res.data.data.refresh_token);
          error.config.headers.Authorization = `Bearer ${res.data.data.access_token}`;
          return api(error.config);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
      } else {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
```

**Step 2: Create API modules**

```typescript
// frontend/src/api/auth.ts
import { api } from "./client";

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  refresh: (refresh_token: string) =>
    api.post("/auth/refresh", { refresh_token }),
};
```

```typescript
// frontend/src/api/projects.ts
import { api } from "./client";

export const projectsApi = {
  list: (cursor?: string) => api.get("/projects", { params: { cursor } }),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (data: { name: string; scenario_type: string }) => api.post("/projects", data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  uploadDocument: (projectId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/projects/${projectId}/documents`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  buildGraph: (projectId: string) => api.post(`/projects/${projectId}/graph/build`),
  getGraph: (projectId: string) => api.get(`/projects/${projectId}/graph`),
  searchGraph: (projectId: string, query: string) =>
    api.post(`/projects/${projectId}/graph/search`, { query }),
};
```

```typescript
// frontend/src/api/simulation.ts
import { api } from "./client";

export const simulationApi = {
  create: (data: { project_id: string; agent_count: number; tick_count: number; seed_context: string; platform?: string; branches?: any[] }) =>
    api.post("/simulations", data),
  start: (id: string) => api.post(`/simulations/${id}/start`),
  getStatus: (id: string) => api.get(`/simulations/${id}/status`),
  getEvents: (id: string, limit?: number, offset?: number) =>
    api.get(`/simulations/${id}/events`, { params: { limit, offset } }),
  interview: (id: string, agentId: string, prompt: string) =>
    api.post(`/simulations/${id}/interview`, { agent_id: agentId, prompt }),
  fork: (id: string, label: string, description: string, overrideVars: Record<string, unknown>) =>
    api.post(`/simulations/${id}/fork`, { label, description, override_vars: overrideVars }),
  checkpoint: (id: string, path: string) =>
    api.post(`/simulations/${id}/checkpoint`, { path }),
  manualAction: (id: string, actorId: string, actionText: string) =>
    api.post(`/simulations/${id}/manual-action`, { actor_id: actorId, action_text: actionText }),
  getTaskStatus: (taskId: string) => api.get(`/tasks/${taskId}/status`),
};
```

```typescript
// frontend/src/api/report.ts
import { api } from "./client";

export const reportApi = {
  generate: (simulationId: string) => api.post(`/simulations/${simulationId}/report`),
  get: (simulationId: string) => api.get(`/simulations/${simulationId}/report`),
};
```

**Step 3: Create Zustand stores**

```typescript
// frontend/src/store/projectStore.ts
import { create } from "zustand";

interface ProjectState {
  currentProjectId: string | null;
  stepIndex: number;
  setCurrentProject: (id: string | null) => void;
  setStep: (step: number) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProjectId: null,
  stepIndex: 1,
  setCurrentProject: (id) => set({ currentProjectId: id }),
  setStep: (step) => set({ stepIndex: step }),
}));
```

```typescript
// frontend/src/store/simulationStore.ts
import { create } from "zustand";
import type { SimEvent } from "@shared/types/simulation";

interface SimulationState {
  simId: string | null;
  engine: "oasis" | "concordia" | null;
  status: string;
  events: SimEvent[];
  groundedVars: Record<string, number>;
  setSimulation: (id: string, engine: "oasis" | "concordia") => void;
  setStatus: (status: string) => void;
  addEvent: (event: SimEvent) => void;
  setGroundedVars: (vars: Record<string, number>) => void;
  reset: () => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  simId: null,
  engine: null,
  status: "pending",
  events: [],
  groundedVars: {},
  setSimulation: (id, engine) => set({ simId: id, engine, status: "pending", events: [] }),
  setStatus: (status) => set({ status }),
  addEvent: (event) => set((s) => ({ events: [...s.events.slice(-200), event] })),
  setGroundedVars: (vars) => set({ groundedVars: vars }),
  reset: () => set({ simId: null, engine: null, status: "pending", events: [], groundedVars: {} }),
}));
```

```typescript
// frontend/src/store/uiStore.ts
import { create } from "zustand";

interface UiState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
```

**Step 4: Create hooks**

```typescript
// frontend/src/hooks/useAuth.ts
import { useState, useCallback } from "react";
import { authApi } from "@/api/auth";

export function useAuth() {
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return { id: payload.sub, email: payload.email, name: payload.name || "" };
    } catch {
      return null;
    }
  });

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    localStorage.setItem("access_token", res.data.data.access_token);
    localStorage.setItem("refresh_token", res.data.data.refresh_token);
    setUser(res.data.data.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await authApi.register({ email, password, name });
    localStorage.setItem("access_token", res.data.data.access_token);
    localStorage.setItem("refresh_token", res.data.data.refresh_token);
    setUser(res.data.data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  }, []);

  return { user, login, register, logout, isAuthenticated: !!user };
}
```

```typescript
// frontend/src/hooks/useWebSocket.ts
import { useEffect, useRef, useState, useCallback } from "react";
import type { SimEvent } from "@shared/types/simulation";

const WS_BASE = import.meta.env.VITE_WS_BASE_URL || `ws://${window.location.host}`;

export function useWebSocket(path: string) {
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const ws = new WebSocket(`${WS_BASE}${path}`);

    ws.onopen = () => setConnected(true);

    ws.onmessage = (msg) => {
      try {
        const event: SimEvent = JSON.parse(msg.data);
        setEvents((prev) => [...prev.slice(-200), event]);
      } catch { /* ignore invalid */ }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimeout.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();

    wsRef.current = ws;
  }, [path]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: unknown) => {
    wsRef.current?.send(JSON.stringify(data));
  }, []);

  return { events, connected, send };
}
```

```typescript
// frontend/src/hooks/useSimulation.ts
import { useQuery } from "@tanstack/react-query";
import { simulationApi } from "@/api/simulation";

export function useSimulationStatus(simId: string | null) {
  return useQuery({
    queryKey: ["simulation", simId],
    queryFn: () => simulationApi.getStatus(simId!).then((r) => r.data.data),
    enabled: !!simId,
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 2000 : false,
  });
}

export function useTaskStatus(taskId: string | null) {
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: () => simulationApi.getTaskStatus(taskId!).then((r) => r.data.data),
    enabled: !!taskId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "running" ? 2000 : false;
    },
  });
}
```

```typescript
// frontend/src/hooks/useReport.ts
import { useQuery, useMutation } from "@tanstack/react-query";
import { reportApi } from "@/api/report";

export function useReport(simulationId: string | null) {
  return useQuery({
    queryKey: ["report", simulationId],
    queryFn: () => reportApi.get(simulationId!).then((r) => r.data.data),
    enabled: !!simulationId,
  });
}

export function useGenerateReport() {
  return useMutation({
    mutationFn: (simulationId: string) => reportApi.generate(simulationId),
  });
}
```

```typescript
// frontend/src/hooks/useCheckpoint.ts
import { useMutation } from "@tanstack/react-query";
import { simulationApi } from "@/api/simulation";

export function useCheckpoint(simId: string | null) {
  const save = useMutation({
    mutationFn: (path: string) => simulationApi.checkpoint(simId!, path),
  });

  const load = useMutation({
    mutationFn: (path: string) => simulationApi.checkpoint(simId!, path),
  });

  return { save, load };
}
```

**Step 5: Create utils**

```typescript
// frontend/src/utils/engineLabel.ts
import type { EngineType, ScenarioType } from "@shared/types/project";
import { ENGINE_MAP } from "@shared/types/project";

export const ENGINE_COLORS: Record<EngineType, string> = {
  oasis: "#F59E0B",
  concordia: "#00C4B4",
};

export const ENGINE_LABELS: Record<EngineType, string> = {
  oasis: "OASIS",
  concordia: "Concordia",
};

export function getEngineForScenario(scenario: ScenarioType): EngineType {
  return ENGINE_MAP[scenario];
}

export const SCENARIO_LABELS: Record<ScenarioType, string> = {
  fin_sentiment: "FinSentiment",
  content_lab: "ContentLab",
  crisis_pr: "CrisisSimulator",
  policy_lab: "PolicyLab",
  war_game: "WarGame",
  train_lab: "TrainLab",
};
```

```typescript
// frontend/src/utils/formatters.ts
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export function formatNumber(n: number): string {
  return n.toLocaleString("zh-TW");
}
```

**Step 6: Commit**

```bash
git add frontend/src/api/ frontend/src/store/ frontend/src/hooks/ frontend/src/utils/
git commit -m "feat: add frontend API client, Zustand stores, and React hooks"
```

---

### Task 23: Frontend layout and routing

**Files:**
- Create: `frontend/src/router/index.tsx`
- Create: `frontend/src/components/layout/AppShell.tsx`
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/components/layout/StepProgress.tsx`
- Create: `frontend/src/components/ui/EngineTag.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

**Step 1: Create router**

```tsx
// frontend/src/router/index.tsx
import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Step1Graph from "@/pages/Step1Graph";
import Step2Setup from "@/pages/Step2Setup";
import Step3Simulation from "@/pages/Step3Simulation";
import Step4Report from "@/pages/Step4Report";
import Step5Interaction from "@/pages/Step5Interaction";
import TrainLab from "@/pages/TrainLab";

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      {
        path: "projects/:projectId",
        children: [
          { path: "step/1", element: <Step1Graph /> },
          { path: "step/2", element: <Step2Setup /> },
          { path: "step/3", element: <Step3Simulation /> },
          { path: "step/4", element: <Step4Report /> },
          { path: "step/5", element: <Step5Interaction /> },
          { path: "trainlab", element: <TrainLab /> },
        ],
      },
    ],
  },
]);
```

**Step 2: Create layout components**

```tsx
// frontend/src/components/layout/AppShell.tsx
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "./Sidebar";
import { useUiStore } from "@/store/uiStore";

export function AppShell() {
  const { isAuthenticated } = useAuth();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);

  if (!isAuthenticated) return <Navigate to="/login" />;

  return (
    <div className="flex h-screen bg-bg">
      {sidebarOpen && <Sidebar />}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

```tsx
// frontend/src/components/layout/Sidebar.tsx
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "@/api/projects";
import { useAuth } from "@/hooks/useAuth";
import { useUiStore } from "@/store/uiStore";

export function Sidebar() {
  const { logout } = useAuth();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const { data } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list().then((r) => r.data.data),
  });

  return (
    <aside className="w-64 bg-navy text-white flex flex-col h-full">
      <div className="p-4 border-b border-white/10">
        <Link to="/" className="text-xl font-bold text-violet">ParaVerse</Link>
      </div>
      <nav className="flex-1 overflow-auto p-4 space-y-2">
        {data?.map((project: any) => (
          <Link
            key={project.id}
            to={`/projects/${project.id}/step/1`}
            className="block px-3 py-2 rounded hover:bg-white/10 text-sm truncate"
          >
            {project.name}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10 space-y-2">
        <button onClick={toggleSidebar} className="text-xs text-white/50 hover:text-white">
          Toggle Sidebar
        </button>
        <button onClick={logout} className="text-xs text-red-400 hover:text-red-300">
          Logout
        </button>
      </div>
    </aside>
  );
}
```

```tsx
// frontend/src/components/layout/StepProgress.tsx
import { useParams, Link } from "react-router-dom";

const STEPS = [
  { num: 1, label: "Knowledge Graph" },
  { num: 2, label: "Environment Setup" },
  { num: 3, label: "Simulation" },
  { num: 4, label: "Report" },
  { num: 5, label: "Interaction" },
];

export function StepProgress({ currentStep }: { currentStep: number }) {
  const { projectId } = useParams();

  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((step) => (
        <Link
          key={step.num}
          to={`/projects/${projectId}/step/${step.num}`}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
            ${step.num === currentStep
              ? "bg-violet text-white"
              : step.num < currentStep
              ? "bg-violet/20 text-violet"
              : "bg-gray-200 text-gray-400 pointer-events-none"
            }`}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
            {step.num}
          </span>
          {step.label}
        </Link>
      ))}
    </div>
  );
}
```

```tsx
// frontend/src/components/ui/EngineTag.tsx
import { ENGINE_COLORS, ENGINE_LABELS, type EngineType } from "@/utils/engineLabel";

export function EngineTag({ type }: { type: EngineType }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold text-white"
      style={{ backgroundColor: ENGINE_COLORS[type] }}
    >
      {ENGINE_LABELS[type]}
    </span>
  );
}
```

**Step 3: Update App.tsx and main.tsx**

```tsx
// frontend/src/App.tsx
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

```tsx
// frontend/src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Step 4: Create placeholder pages (Login, Register, Home, Steps, TrainLab)**

Create minimal placeholder pages for each route so the app compiles. Each page is a simple functional component with the page title.

```tsx
// frontend/src/pages/Login.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-lg w-96 space-y-4">
        <h1 className="text-2xl font-bold text-navy">ParaVerse Login</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded" required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded" required />
        <button type="submit" className="w-full bg-navy text-white py-2 rounded hover:bg-navy/90">Login</button>
        <p className="text-sm text-center">
          No account? <Link to="/register" className="text-violet">Register</Link>
        </p>
      </form>
    </div>
  );
}
```

```tsx
// frontend/src/pages/Register.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(email, password, name);
      navigate("/");
    } catch {
      setError("Registration failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-lg w-96 space-y-4">
        <h1 className="text-2xl font-bold text-navy">Register</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border rounded" required />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded" required />
        <input type="password" placeholder="Password (8+ chars)" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded" required minLength={8} />
        <button type="submit" className="w-full bg-navy text-white py-2 rounded hover:bg-navy/90">Register</button>
        <p className="text-sm text-center">
          Have an account? <Link to="/login" className="text-violet">Login</Link>
        </p>
      </form>
    </div>
  );
}
```

```tsx
// frontend/src/pages/Home.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { projectsApi } from "@/api/projects";
import { EngineTag } from "@/components/ui/EngineTag";
import { getEngineForScenario, SCENARIO_LABELS } from "@/utils/engineLabel";
import { formatDate } from "@/utils/formatters";
import type { ScenarioType } from "@shared/types/project";

const SCENARIOS: ScenarioType[] = ["fin_sentiment", "content_lab", "crisis_pr", "policy_lab", "war_game", "train_lab"];

export default function Home() {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [scenario, setScenario] = useState<ScenarioType>("fin_sentiment");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: () => projectsApi.create({ name, scenario_type: scenario }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate(`/projects/${res.data.data.id}/step/1`);
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy">Projects</h1>
        <button onClick={() => setShowCreate(true)} className="bg-violet text-white px-4 py-2 rounded hover:bg-violet/90">
          New Project
        </button>
      </div>

      {showCreate && (
        <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
          <input type="text" placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded" />
          <div className="grid grid-cols-3 gap-3">
            {SCENARIOS.map((s) => (
              <button key={s} onClick={() => setScenario(s)}
                className={`p-3 rounded border-2 text-left ${scenario === s ? "border-violet" : "border-gray-200"}`}>
                <div className="font-medium text-sm">{SCENARIO_LABELS[s]}</div>
                <EngineTag type={getEngineForScenario(s)} />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate()} className="bg-navy text-white px-4 py-2 rounded">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded border">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects?.map((p: any) => (
          <button key={p.id} onClick={() => navigate(`/projects/${p.id}/step/1`)}
            className="bg-white p-4 rounded-lg shadow hover:shadow-md text-left transition-shadow">
            <h3 className="font-semibold text-navy">{p.name}</h3>
            <div className="flex items-center gap-2 mt-2">
              <EngineTag type={getEngineForScenario(p.scenario_type)} />
              <span className="text-xs text-gray-500">{SCENARIO_LABELS[p.scenario_type]}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">{formatDate(p.created_at)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
```

Create minimal placeholder pages for Steps 1-5 and TrainLab. Each follows the same pattern:

```tsx
// frontend/src/pages/Step1Graph.tsx
import { StepProgress } from "@/components/layout/StepProgress";
export default function Step1Graph() {
  return (<div><StepProgress currentStep={1} /><h2 className="text-xl font-bold text-navy">Step 1: Knowledge Graph</h2><p className="text-gray-500 mt-2">Upload seed documents and build the knowledge graph.</p></div>);
}
```

```tsx
// frontend/src/pages/Step2Setup.tsx
import { StepProgress } from "@/components/layout/StepProgress";
export default function Step2Setup() {
  return (<div><StepProgress currentStep={2} /><h2 className="text-xl font-bold text-navy">Step 2: Environment Setup</h2><p className="text-gray-500 mt-2">Configure agents and simulation parameters.</p></div>);
}
```

```tsx
// frontend/src/pages/Step3Simulation.tsx
import { StepProgress } from "@/components/layout/StepProgress";
export default function Step3Simulation() {
  return (<div><StepProgress currentStep={3} /><h2 className="text-xl font-bold text-navy">Step 3: Simulation</h2><p className="text-gray-500 mt-2">Run and monitor the simulation in real-time.</p></div>);
}
```

```tsx
// frontend/src/pages/Step4Report.tsx
import { StepProgress } from "@/components/layout/StepProgress";
export default function Step4Report() {
  return (<div><StepProgress currentStep={4} /><h2 className="text-xl font-bold text-navy">Step 4: Report</h2><p className="text-gray-500 mt-2">View the generated analysis report.</p></div>);
}
```

```tsx
// frontend/src/pages/Step5Interaction.tsx
import { StepProgress } from "@/components/layout/StepProgress";
export default function Step5Interaction() {
  return (<div><StepProgress currentStep={5} /><h2 className="text-xl font-bold text-navy">Step 5: Deep Interaction</h2><p className="text-gray-500 mt-2">Chat with agents and explore insights.</p></div>);
}
```

```tsx
// frontend/src/pages/TrainLab.tsx
export default function TrainLab() {
  return (<div><h2 className="text-xl font-bold text-navy">TrainLab</h2><p className="text-gray-500 mt-2">Interactive training simulation with manual actions.</p></div>);
}
```

**Step 5: Verify frontend compiles**

```bash
cd frontend && bun run build
```

Expected: Build succeeds

**Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: add frontend layout, routing, pages, and core UI components"
```

---

## Week 6: Concordia Integration + Frontend Components

### Task 24: Frontend simulation components (AgentFeed, ScenarioBranch, SimulationStatus)

**Files:**
- Create: `frontend/src/components/simulation/AgentFeed.tsx`
- Create: `frontend/src/components/simulation/SimulationStatus.tsx`
- Create: `frontend/src/components/simulation/EventTimeline.tsx`
- Create: `frontend/src/components/simulation/ScenarioBranch.tsx`
- Create: `frontend/src/components/ui/TaskProgress.tsx`
- Create: `frontend/src/components/ui/FileUpload.tsx`
- Create: `frontend/src/components/ui/ScenarioCard.tsx`

**Step 1: Implement components**

```tsx
// frontend/src/components/simulation/AgentFeed.tsx
import type { SimEvent } from "@shared/types/simulation";

export function AgentFeed({ events }: { events: SimEvent[] }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 max-h-96 overflow-auto">
      <h3 className="font-semibold text-navy mb-3">Agent Feed</h3>
      <div className="space-y-2">
        {events.map((event, i) => (
          <div key={i} className="border-l-2 border-oasis pl-3 py-1">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Tick {event.sim_timestamp}</span>
              <span className="font-mono">{event.event_type}</span>
            </div>
            {event.content && (
              <p className="text-sm mt-1 text-gray-700 line-clamp-2">{event.content}</p>
            )}
          </div>
        ))}
        {events.length === 0 && <p className="text-gray-400 text-sm">Waiting for events...</p>}
      </div>
    </div>
  );
}
```

```tsx
// frontend/src/components/simulation/SimulationStatus.tsx
export function SimulationStatus({ status, stats, groundedVars }: {
  status: string;
  stats: Record<string, unknown>;
  groundedVars: Record<string, number>;
}) {
  const statusColor = {
    pending: "bg-gray-200 text-gray-700",
    running: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  }[status] || "bg-gray-200";

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-navy">Status</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>{status}</span>
      </div>
      {stats && (
        <div className="grid grid-cols-3 gap-3 text-center">
          {Object.entries(stats).map(([key, val]) => (
            <div key={key}>
              <div className="text-lg font-bold text-navy">{String(val)}</div>
              <div className="text-xs text-gray-500">{key.replace(/_/g, " ")}</div>
            </div>
          ))}
        </div>
      )}
      {Object.keys(groundedVars).length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <h4 className="text-xs font-medium text-gray-500 mb-2">Grounded Variables</h4>
          {Object.entries(groundedVars).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span>{k.replace(/_/g, " ")}</span>
              <span className="font-mono font-medium">{v.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

```tsx
// frontend/src/components/simulation/ScenarioBranch.tsx
interface Branch {
  label: string;
  description: string;
  reputationScore: number;
  emotionTrend: { tick: number; value: number }[];
}

export function ScenarioBranch({ branches }: { branches: Branch[] }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {branches.map((branch) => (
        <div key={branch.label} className="bg-white rounded-lg shadow p-4 border-t-4 border-concordia">
          <div className="flex items-center justify-between mb-2">
            <span className="text-lg font-bold text-navy">Strategy {branch.label}</span>
            <span className="text-2xl font-bold text-concordia">{branch.reputationScore.toFixed(0)}</span>
          </div>
          <p className="text-sm text-gray-600 mb-3">{branch.description}</p>
          <div className="h-20 flex items-end gap-0.5">
            {branch.emotionTrend.map((d, i) => (
              <div key={i} className="flex-1 bg-concordia/30 rounded-t"
                style={{ height: `${Math.max(5, d.value)}%` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

```tsx
// frontend/src/components/simulation/EventTimeline.tsx
import type { SimEvent } from "@shared/types/simulation";

export function EventTimeline({ events }: { events: SimEvent[] }) {
  const grouped = events.reduce((acc, e) => {
    const tick = e.sim_timestamp || 0;
    if (!acc[tick]) acc[tick] = [];
    acc[tick].push(e);
    return acc;
  }, {} as Record<number, SimEvent[]>);

  return (
    <div className="bg-white rounded-lg shadow p-4 max-h-64 overflow-auto">
      <h3 className="font-semibold text-navy mb-3">Timeline</h3>
      {Object.entries(grouped).map(([tick, tickEvents]) => (
        <div key={tick} className="mb-3">
          <div className="text-xs font-medium text-gray-500 mb-1">Tick {tick} ({tickEvents.length} events)</div>
          <div className="flex flex-wrap gap-1">
            {tickEvents.slice(0, 5).map((e, i) => (
              <span key={i} className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs">
                {e.event_type}
              </span>
            ))}
            {tickEvents.length > 5 && (
              <span className="text-xs text-gray-400">+{tickEvents.length - 5} more</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

```tsx
// frontend/src/components/ui/TaskProgress.tsx
import { useTaskStatus } from "@/hooks/useSimulation";

export function TaskProgress({ taskId, onComplete }: { taskId: string; onComplete?: () => void }) {
  const { data: task } = useTaskStatus(taskId);

  if (!task) return null;

  if (task.status === "completed" && onComplete) {
    onComplete();
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{task.type.replace(/_/g, " ")}</span>
        <span className="font-medium">{task.progress}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-violet rounded-full h-2 transition-all duration-300"
          style={{ width: `${task.progress}%` }}
        />
      </div>
      {task.status === "failed" && (
        <p className="text-red-500 text-xs mt-2">{task.error}</p>
      )}
    </div>
  );
}
```

```tsx
// frontend/src/components/ui/FileUpload.tsx
import { useCallback, useState } from "react";

export function FileUpload({ onUpload }: { onUpload: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  }, [onUpload]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
        ${dragging ? "border-violet bg-violet/5" : "border-gray-300 hover:border-gray-400"}`}
    >
      <p className="text-gray-500">Drag and drop files here, or click to select</p>
      <input
        type="file"
        accept=".pdf,.txt,.md"
        onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
        className="hidden"
        id="file-upload"
      />
      <label htmlFor="file-upload" className="mt-2 inline-block text-violet cursor-pointer text-sm">
        Browse files
      </label>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: add simulation components (AgentFeed, ScenarioBranch, TaskProgress, FileUpload)"
```

---

### Task 25: Wire up Step pages with real functionality

**Files:**
- Modify: `frontend/src/pages/Step1Graph.tsx` — file upload + graph visualization
- Modify: `frontend/src/pages/Step2Setup.tsx` — agent config + simulation creation
- Modify: `frontend/src/pages/Step3Simulation.tsx` — WebSocket events + engine-conditional rendering
- Modify: `frontend/src/pages/Step4Report.tsx` — report generation + display
- Modify: `frontend/src/pages/Step5Interaction.tsx` — chat panel

**Step 1: Implement Step1Graph with file upload and graph**

```tsx
// frontend/src/pages/Step1Graph.tsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { StepProgress } from "@/components/layout/StepProgress";
import { FileUpload } from "@/components/ui/FileUpload";
import { TaskProgress } from "@/components/ui/TaskProgress";
import { projectsApi } from "@/api/projects";

export default function Step1Graph() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [uploadTaskId, setUploadTaskId] = useState<string | null>(null);
  const [buildTaskId, setBuildTaskId] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => projectsApi.uploadDocument(projectId!, file),
    onSuccess: (res) => setUploadTaskId(res.data.data.task_id),
  });

  const buildMutation = useMutation({
    mutationFn: () => projectsApi.buildGraph(projectId!),
    onSuccess: (res) => setBuildTaskId(res.data.data.task_id),
  });

  return (
    <div>
      <StepProgress currentStep={1} />
      <h2 className="text-xl font-bold text-navy mb-4">Step 1: Knowledge Graph</h2>

      <FileUpload onUpload={(file) => uploadMutation.mutate(file)} />

      {uploadTaskId && (
        <div className="mt-4">
          <TaskProgress taskId={uploadTaskId} onComplete={() => {}} />
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button onClick={() => buildMutation.mutate()}
          className="bg-violet text-white px-4 py-2 rounded hover:bg-violet/90">
          Build Graph
        </button>
        <button onClick={() => navigate(`/projects/${projectId}/step/2`)}
          className="bg-navy text-white px-4 py-2 rounded hover:bg-navy/90">
          Next Step
        </button>
      </div>

      {buildTaskId && (
        <div className="mt-4">
          <TaskProgress taskId={buildTaskId} />
        </div>
      )}
    </div>
  );
}
```

**Step 2: Implement Step2Setup**

```tsx
// frontend/src/pages/Step2Setup.tsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StepProgress } from "@/components/layout/StepProgress";
import { EngineTag } from "@/components/ui/EngineTag";
import { projectsApi } from "@/api/projects";
import { simulationApi } from "@/api/simulation";
import { getEngineForScenario } from "@/utils/engineLabel";
import { useSimulationStore } from "@/store/simulationStore";
import type { ScenarioType } from "@shared/types/project";

export default function Step2Setup() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const setSimulation = useSimulationStore((s) => s.setSimulation);
  const [agentCount, setAgentCount] = useState(50);
  const [tickCount, setTickCount] = useState(50);
  const [seedContext, setSeedContext] = useState("");
  const [platform, setPlatform] = useState<"twitter" | "reddit">("twitter");

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId!).then((r) => r.data.data),
  });

  const engine = project ? getEngineForScenario(project.scenario_type as ScenarioType) : null;

  const createMutation = useMutation({
    mutationFn: () =>
      simulationApi.create({
        project_id: projectId!,
        agent_count: agentCount,
        tick_count: tickCount,
        seed_context: seedContext,
        platform: engine === "oasis" ? platform : undefined,
      }),
    onSuccess: (res) => {
      setSimulation(res.data.data.id, engine!);
      navigate(`/projects/${projectId}/step/3`);
    },
  });

  return (
    <div>
      <StepProgress currentStep={2} />
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-bold text-navy">Step 2: Environment Setup</h2>
        {engine && <EngineTag type={engine} />}
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4 max-w-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Agent Count</label>
          <input type="number" min={5} max={1000} value={agentCount}
            onChange={(e) => setAgentCount(Number(e.target.value))}
            className="w-full px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tick Count</label>
          <input type="number" min={5} max={500} value={tickCount}
            onChange={(e) => setTickCount(Number(e.target.value))}
            className="w-full px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Seed Context</label>
          <textarea rows={4} value={seedContext} onChange={(e) => setSeedContext(e.target.value)}
            placeholder="Paste the initial scenario description, news article, or crisis statement..."
            className="w-full px-3 py-2 border rounded" />
        </div>
        {engine === "oasis" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as any)}
              className="w-full px-3 py-2 border rounded">
              <option value="twitter">Twitter-like</option>
              <option value="reddit">Reddit-like</option>
            </select>
          </div>
        )}
        <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
          className="bg-navy text-white px-6 py-2 rounded hover:bg-navy/90 disabled:opacity-50">
          {createMutation.isPending ? "Creating..." : "Create & Start Simulation"}
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Implement Step3Simulation with WebSocket**

```tsx
// frontend/src/pages/Step3Simulation.tsx
import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { StepProgress } from "@/components/layout/StepProgress";
import { AgentFeed } from "@/components/simulation/AgentFeed";
import { SimulationStatus } from "@/components/simulation/SimulationStatus";
import { EventTimeline } from "@/components/simulation/EventTimeline";
import { useSimulationStore } from "@/store/simulationStore";
import { useSimulationStatus } from "@/hooks/useSimulation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { simulationApi } from "@/api/simulation";

export default function Step3Simulation() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { simId, engine } = useSimulationStore();
  const { data: status } = useSimulationStatus(simId);
  const { events } = useWebSocket(simId ? `/ws/simulations/${simId}` : "");

  const startMutation = useMutation({
    mutationFn: () => simulationApi.start(simId!),
  });

  useEffect(() => {
    if (simId && status?.status === "pending") {
      startMutation.mutate();
    }
  }, [simId]);

  return (
    <div>
      <StepProgress currentStep={3} />
      <h2 className="text-xl font-bold text-navy mb-4">Step 3: Simulation</h2>

      {!simId ? (
        <p className="text-gray-500">No simulation configured. Go to Step 2 first.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <SimulationStatus
              status={status?.status || "pending"}
              stats={status?.stats || {}}
              groundedVars={status?.grounded_vars || {}}
            />
          </div>
          <div className="col-span-2">
            {engine === "oasis" ? (
              <AgentFeed events={events} />
            ) : (
              <AgentFeed events={events} />
            )}
          </div>
          <div className="col-span-3">
            <EventTimeline events={events} />
          </div>
          {status?.status === "completed" && (
            <div className="col-span-3">
              <button onClick={() => navigate(`/projects/${projectId}/step/4`)}
                className="bg-violet text-white px-6 py-2 rounded hover:bg-violet/90">
                Generate Report
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Implement Step4Report**

```tsx
// frontend/src/pages/Step4Report.tsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { StepProgress } from "@/components/layout/StepProgress";
import { TaskProgress } from "@/components/ui/TaskProgress";
import { useSimulationStore } from "@/store/simulationStore";
import { useReport, useGenerateReport } from "@/hooks/useReport";

export default function Step4Report() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const simId = useSimulationStore((s) => s.simId);
  const [taskId, setTaskId] = useState<string | null>(null);

  const { data: report, refetch } = useReport(simId);
  const generateMutation = useGenerateReport();

  const handleGenerate = () => {
    if (!simId) return;
    generateMutation.mutate(simId, {
      onSuccess: (res) => setTaskId(res.data.data.task_id),
    });
  };

  return (
    <div>
      <StepProgress currentStep={4} />
      <h2 className="text-xl font-bold text-navy mb-4">Step 4: Report</h2>

      {!report?.sections?.length && !taskId && (
        <button onClick={handleGenerate} className="bg-violet text-white px-6 py-2 rounded hover:bg-violet/90">
          Generate Report
        </button>
      )}

      {taskId && <div className="mt-4"><TaskProgress taskId={taskId} onComplete={() => refetch()} /></div>}

      {report?.sections?.map((section: any) => (
        <div key={section.id} className="bg-white rounded-lg shadow p-6 mt-4">
          <h3 className="text-lg font-semibold text-navy mb-2">{section.title}</h3>
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
            {section.content}
          </div>
        </div>
      ))}

      {report?.sections?.length > 0 && (
        <button onClick={() => navigate(`/projects/${projectId}/step/5`)}
          className="mt-4 bg-navy text-white px-6 py-2 rounded hover:bg-navy/90">
          Deep Interaction
        </button>
      )}
    </div>
  );
}
```

**Step 5: Implement Step5Interaction**

```tsx
// frontend/src/pages/Step5Interaction.tsx
import { useState } from "react";
import { StepProgress } from "@/components/layout/StepProgress";
import { useSimulationStore } from "@/store/simulationStore";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function Step5Interaction() {
  const simId = useSimulationStore((s) => s.simId);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const { events, send } = useWebSocket(simId ? `/ws/interactions/${simId}` : "");

  const handleSend = () => {
    if (!input.trim() || !simId) return;
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    send({ simulation_id: simId, content: input });
    setInput("");
  };

  // Listen for interview responses
  const latestResponse = events.find((e: any) => e.type === "interview_response");

  return (
    <div>
      <StepProgress currentStep={5} />
      <h2 className="text-xl font-bold text-navy mb-4">Step 5: Deep Interaction</h2>

      <div className="bg-white rounded-lg shadow p-4 max-h-96 overflow-auto mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 ${msg.role === "user" ? "text-right" : ""}`}>
            <span className={`inline-block px-3 py-2 rounded-lg text-sm ${
              msg.role === "user" ? "bg-violet text-white" : "bg-gray-100 text-gray-700"
            }`}>
              {msg.content}
            </span>
          </div>
        ))}
        {latestResponse && (
          <div className="mb-3">
            <span className="inline-block px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-700">
              {(latestResponse as any).response}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask an agent a question..."
          className="flex-1 px-3 py-2 border rounded" />
        <button onClick={handleSend} className="bg-navy text-white px-4 py-2 rounded">Send</button>
      </div>
    </div>
  );
}
```

**Step 6: Verify frontend builds**

```bash
cd frontend && bun run build
```

Expected: PASS

**Step 7: Commit**

```bash
git add frontend/src/pages/
git commit -m "feat: implement all 5 step pages with real API integration and WebSocket"
```
