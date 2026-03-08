# ParaVerse MVP Plan — Week 7–8

> Continuation (Tasks 26–30)

---

## Week 7: CrisisSimulator + Report Visualization

### Task 26: Report visualization components (charts)

**Files:**
- Create: `frontend/src/components/report/ReportViewer.tsx`
- Create: `frontend/src/components/report/EmotionChart.tsx`
- Create: `frontend/src/components/report/ScenarioDist.tsx`
- Create: `frontend/src/components/report/ExportButton.tsx`

**Step 1: Implement EmotionChart**

```tsx
// frontend/src/components/report/EmotionChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface DataPoint {
  tick: number;
  positive: number;
  neutral: number;
  negative: number;
}

export function EmotionChart({ data }: { data: DataPoint[] }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-navy mb-3">Sentiment Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="tick" label={{ value: "Tick", position: "bottom" }} />
          <YAxis label={{ value: "%", angle: -90, position: "insideLeft" }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="positive" stroke="#22c55e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="neutral" stroke="#94a3b8" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="negative" stroke="#ef4444" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Step 2: Implement ScenarioDist**

```tsx
// frontend/src/components/report/ScenarioDist.tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ScenarioData {
  scenario: string;
  probability: number;
  impact: number;
}

export function ScenarioDist({ data }: { data: ScenarioData[] }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-navy mb-3">Scenario Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="scenario" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="probability" fill="#6C3FC5" name="Probability %" />
          <Bar dataKey="impact" fill="#00C4B4" name="Impact Score" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Step 3: Implement ReportViewer**

```tsx
// frontend/src/components/report/ReportViewer.tsx
interface Section {
  id: string;
  title: string;
  content: string;
  section_order: number;
}

export function ReportViewer({ sections }: { sections: Section[] }) {
  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.id} className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-navy border-b pb-2 mb-3">{section.title}</h3>
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
            {section.content}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 4: Implement ExportButton (placeholder for PDF export)**

```tsx
// frontend/src/components/report/ExportButton.tsx
export function ExportButton({ simulationId }: { simulationId: string }) {
  const handleExport = async (format: "pdf" | "docx") => {
    // TODO: Implement server-side export
    const url = `/api/v1/simulations/${simulationId}/report/export?format=${format}`;
    window.open(url, "_blank");
  };

  return (
    <div className="flex gap-2">
      <button onClick={() => handleExport("pdf")}
        className="px-4 py-2 border border-navy text-navy rounded hover:bg-navy hover:text-white transition-colors text-sm">
        Export PDF
      </button>
      <button onClick={() => handleExport("docx")}
        className="px-4 py-2 border border-navy text-navy rounded hover:bg-navy hover:text-white transition-colors text-sm">
        Export DOCX
      </button>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add frontend/src/components/report/
git commit -m "feat: add report visualization components (charts, export)"
```

---

### Task 27: Knowledge Graph D3 visualization

**Files:**
- Create: `frontend/src/components/graph/KnowledgeGraph.tsx`
- Create: `frontend/src/components/graph/GraphControls.tsx`

**Step 1: Implement D3 force-directed graph**

```tsx
// frontend/src/components/graph/KnowledgeGraph.tsx
import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface Node {
  id: string;
  name: string;
  type: string;
}

interface Edge {
  source_node_id: string;
  target_node_id: string;
  relation_type: string;
  weight: number;
}

const TYPE_COLORS: Record<string, string> = {
  person: "#6C3FC5",
  org: "#F59E0B",
  event: "#EF4444",
  concept: "#00C4B4",
  location: "#3B82F6",
};

export function KnowledgeGraph({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = 500;

    const g = svg.append("g");

    // Zoom
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on("zoom", (event) => g.attr("transform", event.transform))
    );

    const links = edges.map((e) => ({
      source: e.source_node_id,
      target: e.target_node_id,
      type: e.relation_type,
    }));

    const simulation = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1);

    const node = g.append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 8)
      .attr("fill", (d) => TYPE_COLORS[d.type] || "#999")
      .call(d3.drag<SVGCircleElement, Node>()
        .on("start", (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (event, d: any) => { d.fx = event.x; d.fy = event.y; })
        .on("end", (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
      );

    const labels = g.append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) => d.name)
      .attr("font-size", 10)
      .attr("dx", 12)
      .attr("dy", 4)
      .attr("fill", "#374151");

    simulation.on("tick", () => {
      link.attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
      labels.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
    });

    return () => { simulation.stop(); };
  }, [nodes, edges]);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-navy mb-3">Knowledge Graph</h3>
      <svg ref={svgRef} width="100%" height={500} className="border rounded" />
    </div>
  );
}
```

```tsx
// frontend/src/components/graph/GraphControls.tsx
const TYPE_COLORS: Record<string, string> = {
  person: "#6C3FC5",
  org: "#F59E0B",
  event: "#EF4444",
  concept: "#00C4B4",
  location: "#3B82F6",
};

export function GraphControls() {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-2">Legend</h4>
      <div className="flex flex-wrap gap-3">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-600 capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/graph/
git commit -m "feat: add D3 force-directed knowledge graph visualization"
```

---

## Week 8: End-to-End Integration + E2E Tests

### Task 28: Interaction components (ChatPanel, AgentSelector)

**Files:**
- Create: `frontend/src/components/interaction/ChatPanel.tsx`
- Create: `frontend/src/components/interaction/AgentSelector.tsx`
- Create: `frontend/src/components/simulation/ManualActionPanel.tsx`

**Step 1: Implement ChatPanel**

```tsx
// frontend/src/components/interaction/ChatPanel.tsx
import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "agent" | "system";
  content: string;
  agentName?: string;
  timestamp?: string;
}

export function ChatPanel({ messages, onSend }: {
  messages: Message[];
  onSend: (content: string) => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input);
    setInput("");
  };

  return (
    <div className="bg-white rounded-lg shadow flex flex-col h-[500px]">
      <div className="p-3 border-b">
        <h3 className="font-semibold text-navy">Agent Chat</h3>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
              msg.role === "user"
                ? "bg-violet text-white"
                : msg.role === "system"
                ? "bg-gray-100 text-gray-500 text-xs"
                : "bg-gray-100 text-gray-700"
            }`}>
              {msg.agentName && <div className="text-xs font-medium mb-1">{msg.agentName}</div>}
              <p className="text-sm">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-3 border-t flex gap-2">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..." className="flex-1 px-3 py-2 border rounded text-sm" />
        <button type="submit" className="bg-navy text-white px-4 py-2 rounded text-sm">Send</button>
      </form>
    </div>
  );
}
```

```tsx
// frontend/src/components/interaction/AgentSelector.tsx
interface Agent {
  id: string;
  name: string;
  demographics: { group?: string; role?: string };
}

export function AgentSelector({ agents, selectedId, onSelect }: {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-navy mb-3">Select Agent</h3>
      <div className="space-y-1 max-h-64 overflow-auto">
        {agents.map((agent) => (
          <button key={agent.id} onClick={() => onSelect(agent.id)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              selectedId === agent.id ? "bg-violet/10 text-violet" : "hover:bg-gray-50"
            }`}>
            <div className="font-medium">{agent.name}</div>
            <div className="text-xs text-gray-500">{agent.demographics.role || agent.demographics.group}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

```tsx
// frontend/src/components/simulation/ManualActionPanel.tsx
import { useState } from "react";

export function ManualActionPanel({ onAction, onSave, onLoad }: {
  onAction: (text: string) => void;
  onSave: () => void;
  onLoad: () => void;
}) {
  const [actionText, setActionText] = useState("");

  const handleSubmit = () => {
    if (!actionText.trim()) return;
    onAction(actionText);
    setActionText("");
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 border-t-4 border-concordia">
      <h3 className="font-semibold text-navy mb-3">Manual Action (TrainLab)</h3>
      <textarea rows={3} value={actionText} onChange={(e) => setActionText(e.target.value)}
        placeholder="Enter your decision as natural language..."
        className="w-full px-3 py-2 border rounded mb-3 text-sm" />
      <div className="flex gap-2">
        <button onClick={handleSubmit} className="bg-concordia text-white px-4 py-2 rounded text-sm">
          Submit Action
        </button>
        <button onClick={onSave} className="border border-gray-300 px-3 py-2 rounded text-sm">
          Save Checkpoint
        </button>
        <button onClick={onLoad} className="border border-gray-300 px-3 py-2 rounded text-sm">
          Load Checkpoint
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/interaction/ frontend/src/components/simulation/ManualActionPanel.tsx
git commit -m "feat: add ChatPanel, AgentSelector, and ManualActionPanel components"
```

---

### Task 29: Update Step1Graph with D3 graph + Update Step4Report with charts

**Files:**
- Modify: `frontend/src/pages/Step1Graph.tsx`
- Modify: `frontend/src/pages/Step4Report.tsx`

**Step 1: Update Step1Graph to show KnowledgeGraph**

```tsx
// frontend/src/pages/Step1Graph.tsx (updated)
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { StepProgress } from "@/components/layout/StepProgress";
import { FileUpload } from "@/components/ui/FileUpload";
import { TaskProgress } from "@/components/ui/TaskProgress";
import { KnowledgeGraph } from "@/components/graph/KnowledgeGraph";
import { GraphControls } from "@/components/graph/GraphControls";
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

  const { data: graphData, refetch: refetchGraph } = useQuery({
    queryKey: ["graph", projectId],
    queryFn: () => projectsApi.getGraph(projectId!).then((r) => r.data.data),
    enabled: !!projectId,
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
          <TaskProgress taskId={buildTaskId} onComplete={() => refetchGraph()} />
        </div>
      )}

      {graphData?.nodes?.length > 0 && (
        <div className="mt-6 space-y-4">
          <GraphControls />
          <KnowledgeGraph nodes={graphData.nodes} edges={graphData.edges} />
        </div>
      )}
    </div>
  );
}
```

**Step 2: Update Step4Report with charts**

```tsx
// frontend/src/pages/Step4Report.tsx (updated)
import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { StepProgress } from "@/components/layout/StepProgress";
import { TaskProgress } from "@/components/ui/TaskProgress";
import { ReportViewer } from "@/components/report/ReportViewer";
import { EmotionChart } from "@/components/report/EmotionChart";
import { ExportButton } from "@/components/report/ExportButton";
import { useSimulationStore } from "@/store/simulationStore";
import { useReport, useGenerateReport } from "@/hooks/useReport";

export default function Step4Report() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { simId, engine } = useSimulationStore();
  const [taskId, setTaskId] = useState<string | null>(null);

  const { data: report, refetch } = useReport(simId);
  const generateMutation = useGenerateReport();

  const handleGenerate = () => {
    if (!simId) return;
    generateMutation.mutate(simId, {
      onSuccess: (res) => setTaskId(res.data.data.task_id),
    });
  };

  // Mock emotion data from events (in real impl, this comes from report data)
  const emotionData = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      tick: i + 1,
      positive: 30 + Math.random() * 20,
      neutral: 25 + Math.random() * 15,
      negative: 20 + Math.random() * 25,
    }));
  }, []);

  return (
    <div>
      <StepProgress currentStep={4} />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-navy">Step 4: Report</h2>
        {simId && report?.sections?.length > 0 && <ExportButton simulationId={simId} />}
      </div>

      {!report?.sections?.length && !taskId && (
        <button onClick={handleGenerate} disabled={!simId}
          className="bg-violet text-white px-6 py-2 rounded hover:bg-violet/90 disabled:opacity-50">
          Generate Report
        </button>
      )}

      {taskId && <div className="mt-4"><TaskProgress taskId={taskId} onComplete={() => refetch()} /></div>}

      {report?.sections?.length > 0 && (
        <div className="mt-4 space-y-6">
          <EmotionChart data={emotionData} />
          <ReportViewer sections={report.sections} />
          <button onClick={() => navigate(`/projects/${projectId}/step/5`)}
            className="bg-navy text-white px-6 py-2 rounded hover:bg-navy/90">
            Deep Interaction
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add frontend/src/pages/Step1Graph.tsx frontend/src/pages/Step4Report.tsx
git commit -m "feat: integrate D3 knowledge graph and Recharts into step pages"
```

---

### Task 30: E2E tests with Playwright

**Files:**
- Create: `frontend/e2e/critical-flow.spec.ts`
- Create: `frontend/playwright.config.ts`

**Step 1: Install Playwright**

```bash
cd frontend
bun add -d @playwright/test
bunx playwright install chromium
```

**Step 2: Create Playwright config**

```typescript
// frontend/playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run dev",
    port: 3000,
    reuseExistingServer: true,
  },
});
```

**Step 3: Write E2E test for critical flow**

```typescript
// frontend/e2e/critical-flow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("ParaVerse Critical Flow", () => {
  const testUser = {
    email: `e2e-${Date.now()}@test.com`,
    password: "testpassword123",
    name: "E2E Test User",
  };

  test("register new user", async ({ page }) => {
    await page.goto("/register");
    await page.fill('input[placeholder="Name"]', testUser.name);
    await page.fill('input[placeholder="Email"]', testUser.email);
    await page.fill('input[placeholder*="Password"]', testUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");
    await expect(page.locator("text=Projects")).toBeVisible();
  });

  test("login existing user", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[placeholder="Email"]', testUser.email);
    await page.fill('input[placeholder="Password"]', testUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");
  });

  test("create project and navigate steps", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('input[placeholder="Email"]', testUser.email);
    await page.fill('input[placeholder="Password"]', testUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");

    // Create project
    await page.click("text=New Project");
    await page.fill('input[placeholder="Project name"]', "E2E Test Project");
    await page.click("text=FinSentiment");
    await page.click("text=Create");

    // Should navigate to Step 1
    await expect(page.locator("text=Step 1: Knowledge Graph")).toBeVisible();

    // Navigate to Step 2
    await page.click("text=Next Step");
    await expect(page.locator("text=Step 2: Environment Setup")).toBeVisible();

    // Verify engine tag is shown
    await expect(page.locator("text=OASIS")).toBeVisible();
  });

  test("project appears in sidebar", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[placeholder="Email"]', testUser.email);
    await page.fill('input[placeholder="Password"]', testUser.password);
    await page.click('button[type="submit"]');

    await expect(page.locator("text=E2E Test Project")).toBeVisible();
  });
});
```

**Step 4: Run E2E tests** (requires both backend and frontend running)

```bash
cd frontend && bunx playwright test
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add frontend/e2e/ frontend/playwright.config.ts
git commit -m "feat: add Playwright E2E tests for critical user flow"
```

---

## Final: Docker + CLAUDE.md

### Task 31: Backend Dockerfile and docker-compose update

**Files:**
- Create: `backend/Dockerfile.bun`
- Create: `frontend/Dockerfile.react`
- Modify: `docker-compose.yml` — add backend + frontend services

**Step 1: Create backend Dockerfile**

```dockerfile
# backend/Dockerfile.bun
FROM oven/bun:1.3-alpine

WORKDIR /app

# Install Python for simulation engines
RUN apk add --no-cache python3 py3-pip

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
COPY ../shared /shared

# Set up Python venvs
RUN cd simulations/oasis && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt || true
RUN cd simulations/concordia && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt || true

# Run migrations then start server
CMD ["sh", "-c", "bun run src/db/migrate.ts && bun run src/index.ts"]

EXPOSE 5001
```

**Step 2: Create frontend Dockerfile**

```dockerfile
# frontend/Dockerfile.react
FROM oven/bun:1.3-alpine AS build

WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
COPY ../shared /shared
RUN bun run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
```

**Step 3: Create nginx.conf for frontend**

```nginx
# frontend/nginx.conf
server {
    listen 3000;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:5001;
    }

    location /ws {
        proxy_pass http://backend:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Step 4: Update docker-compose.yml**

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_DB: paraverse
      POSTGRES_USER: paraverse
      POSTGRES_PASSWORD: ${DB_PASSWORD:-paraverse_dev}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U paraverse"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile.bun
    environment:
      DATABASE_URL: postgresql://paraverse:${DB_PASSWORD:-paraverse_dev}@postgres:5432/paraverse
      REDIS_URL: redis://redis:6379
      LLM_API_KEY: ${LLM_API_KEY}
      LLM_BASE_URL: ${LLM_BASE_URL:-https://generativelanguage.googleapis.com/v1beta/openai/}
      LLM_MODEL_GENERAL: ${LLM_MODEL_GENERAL:-gemini-2.5-flash}
      LLM_MODEL_BOOST: ${LLM_MODEL_BOOST:-gemini-2.5-flash}
      JWT_SECRET: ${JWT_SECRET:-dev-secret-change-in-production-32chars!}
      PORT: "5001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "5001:5001"

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile.react
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  pgdata:
```

**Step 5: Commit**

```bash
git add backend/Dockerfile.bun frontend/Dockerfile.react frontend/nginx.conf docker-compose.yml
git commit -m "feat: add Docker configuration for full-stack deployment"
```

---

### Task 32: CLAUDE.md project configuration

**Files:**
- Create: `CLAUDE.md`

**Step 1: Create CLAUDE.md**

```markdown
# ParaVerse — Project Configuration

## Project Overview
B2B multi-agent simulation platform with dual engines (OASIS + Concordia).

## Tech Stack
- Backend: Bun + Hono + TypeScript
- Frontend: React 18 + Vite + TailwindCSS v4
- Database: PostgreSQL 17 + pgvector
- Cache: Redis 7
- Simulation: Python 3.12 (OASIS, Concordia)
- LLM: OpenAI SDK → Gemini 2.5 Flash

## Commands
- Backend dev: `cd backend && bun run src/index.ts`
- Backend test: `cd backend && bun test`
- Frontend dev: `cd frontend && bun run dev`
- Frontend build: `cd frontend && bun run build`
- E2E test: `cd frontend && bunx playwright test`
- DB migrate: `cd backend && bun run src/db/migrate.ts`
- Docker up: `docker compose up -d`

## Conventions
- All code in English (comments, variables, commits)
- Design docs / user-facing content in Chinese
- Raw SQL with pg client (no ORM)
- Shared types in `shared/types/`
- TDD: write failing test → implement → verify
- API response format: `{ success, data, error, meta }`
- Async tasks return `task_id`, polled via `/tasks/:id/status`
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "feat: add CLAUDE.md project configuration"
```
