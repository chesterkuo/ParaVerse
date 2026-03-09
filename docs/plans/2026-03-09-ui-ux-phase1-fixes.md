# Phase 1 UI/UX Critical Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the 10 most critical UI/UX issues identified in the frontend audit — focus rings, mobile sidebar, form labels, humanized IDs, brand colors, SVG icons, progress bar visibility, loading skeletons, responsive chat panel, and cursor-pointer on clickable elements.

**Architecture:** Each task is independent and touches 1-3 files. We install `lucide-react` once (Task 1) and then use it across subsequent tasks. All changes are Tailwind class updates or small JSX restructures — no backend changes.

**Tech Stack:** React 19, TailwindCSS v4, lucide-react, Zustand 5

---

### Task 1: Install lucide-react Icon Library

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install lucide-react**

Run:
```bash
cd /home/ubuntu/source/paraverse/frontend && bun add lucide-react
```

**Step 2: Verify installation**

Run:
```bash
cd /home/ubuntu/source/paraverse/frontend && bun run build 2>&1 | tail -5
```
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
cd /home/ubuntu/source/paraverse
git add frontend/package.json frontend/bun.lock
git commit -m "chore: add lucide-react icon library"
```

---

### Task 2: Add Global Focus Ring Styles

All interactive elements lack visible focus rings. Add a global utility via `globals.css` and update the `border rounded` pattern on inputs to include `focus:ring-2 focus:ring-violet/50 focus:outline-none`.

**Files:**
- Modify: `frontend/src/styles/globals.css`

**Step 1: Add base focus ring layer**

Add this after the `@theme` block in `frontend/src/styles/globals.css`:

```css
@layer base {
  input:focus,
  textarea:focus,
  select:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(108, 63, 197, 0.4);
    border-color: #6C3FC5;
  }
  button:focus-visible {
    outline: 2px solid #6C3FC5;
    outline-offset: 2px;
  }
  a:focus-visible {
    outline: 2px solid #6C3FC5;
    outline-offset: 2px;
  }
}
```

**Step 2: Remove `focus:outline-none` from Step5Interaction inputs**

In `frontend/src/pages/Step5Interaction.tsx`, find both `focus:outline-none focus:border-violet` occurrences and replace with `focus:border-violet` (the outline is now handled globally).

Line 127 — agent ID input:
```
Old: className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-violet"
New: className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
```

Line 174 — chat input:
```
Old: className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-violet disabled:opacity-50"
New: className="flex-1 px-3 py-2 border border-gray-300 rounded disabled:opacity-50"
```

**Step 3: Build and verify**

Run:
```bash
cd /home/ubuntu/source/paraverse/frontend && bun run build 2>&1 | tail -5
```
Expected: Build succeeds.

**Step 4: Commit**

```bash
cd /home/ubuntu/source/paraverse
git add frontend/src/styles/globals.css frontend/src/pages/Step5Interaction.tsx
git commit -m "fix(a11y): add global focus ring styles for inputs, buttons, links"
```

---

### Task 3: Mobile-Responsive Sidebar with Hamburger Toggle

The sidebar is a fixed 256px column with no mobile collapse. Add a hamburger button visible on small screens and overlay the sidebar on mobile.

**Files:**
- Modify: `frontend/src/components/layout/AppShell.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/store/uiStore.ts`

**Step 1: Update uiStore to add setSidebarOpen**

Replace the entire `frontend/src/store/uiStore.ts` with:

```tsx
import { create } from "zustand";

interface UiState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
}));
```

**Step 2: Update AppShell with hamburger button and mobile overlay**

Replace the entire `frontend/src/components/layout/AppShell.tsx` with:

```tsx
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "./Sidebar";
import { useUiStore } from "@/store/uiStore";
import { Menu } from "lucide-react";

export function AppShell() {
  const { isAuthenticated } = useAuth();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  if (!isAuthenticated) return <Navigate to="/login" />;

  return (
    <div className="flex h-screen bg-bg">
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-3 left-3 z-50 lg:hidden p-2 rounded-md bg-navy text-white cursor-pointer"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="fixed inset-y-0 left-0 z-40 w-64 lg:static lg:z-auto">
          <Sidebar />
        </aside>
      )}

      <main className="flex-1 overflow-auto p-6 pt-14 lg:pt-6">
        <Outlet />
      </main>
    </div>
  );
}
```

**Step 3: Update Sidebar — remove outer `<aside>` wrapper (now in AppShell) and make it fill height**

Replace the `<aside>` tag wrapper in `frontend/src/components/layout/Sidebar.tsx`:

```tsx
Old: <aside className="w-64 bg-navy text-white flex flex-col h-full">
New: <div className="w-64 bg-navy text-white flex flex-col h-full">
```

And the closing tag:
```tsx
Old: </aside>
New: </div>
```

**Step 4: Build and verify**

Run:
```bash
cd /home/ubuntu/source/paraverse/frontend && bun run build 2>&1 | tail -5
```
Expected: Build succeeds.

**Step 5: Commit**

```bash
cd /home/ubuntu/source/paraverse
git add frontend/src/store/uiStore.ts frontend/src/components/layout/AppShell.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(ui): add mobile-responsive sidebar with hamburger toggle"
```

---

### Task 4: Add Proper Form Labels to Login & Register

Inputs use `placeholder` only with no `<label>` elements. Add visually-hidden labels for accessibility and visible labels above each input.

**Files:**
- Modify: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/pages/Register.tsx`

**Step 1: Update Login.tsx**

Replace the form body (the `<form>` content) in `frontend/src/pages/Login.tsx` with:

```tsx
<form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-lg w-96 space-y-4">
  <h1 className="text-2xl font-bold text-navy">ParaVerse Login</h1>
  {error && <p className="text-red-500 text-sm">{error}</p>}
  <div>
    <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
    <input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
      className="w-full px-3 py-2 border rounded" required />
  </div>
  <div>
    <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
    <input id="login-password" type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)}
      className="w-full px-3 py-2 border rounded" required />
  </div>
  <button type="submit" className="w-full bg-navy text-white py-2 rounded hover:bg-navy/90 cursor-pointer">Login</button>
  <p className="text-sm text-center">
    No account? <Link to="/register" className="text-violet">Register</Link>
  </p>
</form>
```

**Step 2: Update Register.tsx**

Replace the form body in `frontend/src/pages/Register.tsx` with:

```tsx
<form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-lg w-96 space-y-4">
  <h1 className="text-2xl font-bold text-navy">Register</h1>
  {error && <p className="text-red-500 text-sm">{error}</p>}
  <div>
    <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
    <input id="reg-name" type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)}
      className="w-full px-3 py-2 border rounded" required />
  </div>
  <div>
    <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
    <input id="reg-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
      className="w-full px-3 py-2 border rounded" required />
  </div>
  <div>
    <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
    <input id="reg-password" type="password" placeholder="8+ characters" value={password} onChange={(e) => setPassword(e.target.value)}
      className="w-full px-3 py-2 border rounded" required minLength={8} />
  </div>
  <button type="submit" className="w-full bg-navy text-white py-2 rounded hover:bg-navy/90 cursor-pointer">Register</button>
  <p className="text-sm text-center">
    Have an account? <Link to="/login" className="text-violet">Login</Link>
  </p>
</form>
```

**Step 3: Build and verify**

Run:
```bash
cd /home/ubuntu/source/paraverse/frontend && bun run build 2>&1 | tail -5
```
Expected: Build succeeds.

**Step 4: Run E2E tests to verify login/register still work**

Run:
```bash
cd /home/ubuntu/source/paraverse/frontend && bunx playwright test e2e/critical-flow.spec.ts --reporter=list 2>&1 | tail -20
```

Note: The E2E tests use `input[placeholder="Email"]` selectors. Since we still have `placeholder` on inputs, selectors still match. If tests fail, check the new placeholder values match the selectors.

E2E selectors used:
- `input[placeholder="Name"]` → still works (placeholder="Full name" won't match!)

**IMPORTANT:** The E2E tests use `placeholder="Name"` but we changed it to `placeholder="Full name"`. Either:
- Keep `placeholder="Name"` in Register.tsx, OR
- Update the E2E test selector

Recommended: Keep `placeholder="Name"` to avoid E2E breakage:
```tsx
<input id="reg-name" type="text" placeholder="Name" ...
```

Similarly keep `placeholder="Email"` and `placeholder` values matching the E2E selectors exactly:
- Login: `placeholder="Email"`, `placeholder="Password"` (use these instead of changed values)
- Register: `placeholder="Name"`, `placeholder="Email"`, `placeholder="Password"` — but E2E uses `placeholder*="Password"` (contains), so `"Password (8+ chars)"` → actually works since `*=` is contains. Keep as-is OR simplify to `"Password"`.

Safest approach: Keep placeholders identical to what E2E expects:
- `placeholder="Email"` (both)
- `placeholder="Password"` (Login) or `placeholder="Password (8+ chars)"` (Register, E2E uses `*=`)
- `placeholder="Name"` (Register)

**Step 5: Commit**

```bash
cd /home/ubuntu/source/paraverse
git add frontend/src/pages/Login.tsx frontend/src/pages/Register.tsx
git commit -m "fix(a11y): add proper form labels to login and register pages"
```

---

### Task 5: Humanize Agent IDs and Event Type Labels

Agent UUIDs show as truncated hex (`Agent: a3f2e1b0`). Event types show raw snake_case (`agent_action`). Create a utility and apply it.

**Files:**
- Create: `frontend/src/utils/humanize.ts`
- Modify: `frontend/src/components/simulation/AgentFeed.tsx`
- Modify: `frontend/src/pages/Step5Interaction.tsx`

**Step 1: Create humanize utility**

Create `frontend/src/utils/humanize.ts`:

```ts
const AGENT_NAMES = [
  "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel",
  "India", "Juliet", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa",
  "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey", "Xray",
];

const agentNameMap = new Map<string, string>();
let nextIdx = 0;

export function humanizeAgentId(id: string): string {
  let name = agentNameMap.get(id);
  if (!name) {
    name = nextIdx < AGENT_NAMES.length
      ? `Agent ${AGENT_NAMES[nextIdx]}`
      : `Agent ${nextIdx + 1}`;
    agentNameMap.set(id, name);
    nextIdx++;
  }
  return name;
}

const EVENT_LABELS: Record<string, string> = {
  agent_action: "Action",
  grounded_var: "Variable Update",
  branch_update: "Branch Update",
  simulation_complete: "Complete",
  error: "Error",
  interview_response: "Response",
  status: "Status",
};

export function humanizeEventType(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType.replace(/_/g, " ");
}
```

**Step 2: Update AgentFeed.tsx**

In `frontend/src/components/simulation/AgentFeed.tsx`:

Add import at top:
```tsx
import { humanizeAgentId, humanizeEventType } from "@/utils/humanize";
```

Replace line 58-59 (the event_type badge text):
```
Old: {event.event_type}
New: {humanizeEventType(event.event_type)}
```

Replace line 62 (the agent ID display):
```
Old: Agent: {event.agent_id.slice(0, 8)}
New: {humanizeAgentId(event.agent_id)}
```

**Step 3: Update Step5Interaction.tsx**

In `frontend/src/pages/Step5Interaction.tsx`:

Add import at top:
```tsx
import { humanizeAgentId } from "@/utils/humanize";
```

Replace line 114 (agent selector button text):
```
Old: Agent {id.slice(0, 8)}
New: {humanizeAgentId(id)}
```

Replace line 155 (chat message agent label):
```
Old: Agent {msg.agentId.slice(0, 8)}
New: {humanizeAgentId(msg.agentId)}
```

**Step 4: Build and verify**

Run:
```bash
cd /home/ubuntu/source/paraverse/frontend && bun run build 2>&1 | tail -5
```
Expected: Build succeeds.

**Step 5: Commit**

```bash
cd /home/ubuntu/source/paraverse
git add frontend/src/utils/humanize.ts frontend/src/components/simulation/AgentFeed.tsx frontend/src/pages/Step5Interaction.tsx
git commit -m "feat(ui): humanize agent IDs and event type labels"
```

---

### Task 6: Fix ExportButton Brand Colors and Add Icons

Replace off-brand `bg-red-600` and `bg-blue-600` with brand colors and add lucide-react icons.

**Files:**
- Modify: `frontend/src/components/report/ExportButton.tsx`

**Step 1: Update ExportButton**

Replace the entire `frontend/src/components/report/ExportButton.tsx` with:

```tsx
import { FileDown } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

interface ExportButtonProps {
  simId: string;
}

export function ExportButton({ simId }: ExportButtonProps) {
  const handleExport = (format: "pdf" | "docx") => {
    const token = localStorage.getItem("access_token");
    const url = `${API_BASE}/simulations/${simId}/report/export?format=${format}&token=${encodeURIComponent(token ?? "")}`;
    window.open(url, "_blank");
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleExport("pdf")}
        className="flex items-center gap-1.5 px-4 py-2 bg-navy text-white rounded hover:bg-navy/90 text-sm font-medium cursor-pointer"
      >
        <FileDown size={16} />
        Export PDF
      </button>
      <button
        onClick={() => handleExport("docx")}
        className="flex items-center gap-1.5 px-4 py-2 bg-violet text-white rounded hover:bg-violet/90 text-sm font-medium cursor-pointer"
      >
        <FileDown size={16} />
        Export DOCX
      </button>
    </div>
  );
}
```

**Step 2: Build and verify**

Run:
```bash
cd /home/ubuntu/source/paraverse/frontend && bun run build 2>&1 | tail -5
```
Expected: Build succeeds.

**Step 3: Commit**

```bash
cd /home/ubuntu/source/paraverse
git add frontend/src/components/report/ExportButton.tsx
git commit -m "fix(ui): use brand colors and lucide icons in ExportButton"
```

---

### Task 7: Replace Emoji Icons with SVG in FileUpload

`FileUpload.tsx` uses emoji characters `📄` and `⬇` for the drag-drop area. Replace with lucide-react icons.

**Files:**
- Modify: `frontend/src/components/ui/FileUpload.tsx`

**Step 1: Update FileUpload**

Add import at top of `frontend/src/components/ui/FileUpload.tsx`:
```tsx
import { Upload, FileText } from "lucide-react";
```

Replace lines 73-76 (the emoji icon area):
```tsx
Old:
        <div className="text-3xl text-gray-300">
          {isDragging ? "\u2B07" : "\u{1F4C4}"}
        </div>

New:
        <div className="flex justify-center text-gray-300">
          {isDragging ? <Upload size={32} /> : <FileText size={32} />}
        </div>
```

**Step 2: Build and verify**

Run:
```bash
cd /home/ubuntu/source/paraverse/frontend && bun run build 2>&1 | tail -5
```
Expected: Build succeeds.

**Step 3: Commit**

```bash
cd /home/ubuntu/source/paraverse
git add frontend/src/components/ui/FileUpload.tsx
git commit -m "fix(ui): replace emoji icons with lucide SVGs in FileUpload"
```

---

### Task 8: Increase Progress Bar Height and Add Status Labels

Progress bars in `TaskProgress.tsx` and `SimulationStatus.tsx` use `h-2` which is hard to see. Increase to `h-3` and add a text status label to TaskProgress.

**Files:**
- Modify: `frontend/src/components/ui/TaskProgress.tsx`
- Modify: `frontend/src/components/simulation/SimulationStatus.tsx`

**Step 1: Update TaskProgress.tsx**

In `frontend/src/components/ui/TaskProgress.tsx`, make these changes:

Replace the progress bar height:
```
Old: <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
New: <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
```

Add a status label after the progress bar (after the closing `</div>` of the progress bar, before the `{isFailed && data.error &&` block):

```tsx
      <div className="text-xs text-gray-500">
        {isFailed ? "Failed" : isCompleted ? "Completed" : "In progress"}
      </div>
```

**Step 2: Update SimulationStatus.tsx**

In `frontend/src/components/simulation/SimulationStatus.tsx`, replace the grounded variables progress bar height:

```
Old: <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
New: <div className="w-24 h-3 bg-gray-200 rounded-full overflow-hidden">
```

Also humanize the raw stat/variable key names. Replace line 37:
```
Old: <div className="text-xs text-gray-400">{key}</div>
New: <div className="text-xs text-gray-400">{key.replace(/_/g, " ")}</div>
```

Replace line 54:
```
Old: <span className="text-sm text-gray-600">{key}</span>
New: <span className="text-sm text-gray-600">{key.replace(/_/g, " ")}</span>
```

**Step 3: Build and verify**

Run:
```bash
cd /home/ubuntu/source/paraverse/frontend && bun run build 2>&1 | tail -5
```
Expected: Build succeeds.

**Step 4: Commit**

```bash
cd /home/ubuntu/source/paraverse
git add frontend/src/components/ui/TaskProgress.tsx frontend/src/components/simulation/SimulationStatus.tsx
git commit -m "fix(ui): increase progress bar height, add status labels, humanize keys"
```

---

### Task 9: Add Loading Skeleton to Home Page

The Home page shows nothing while projects load. Add a skeleton placeholder.

**Files:**
- Modify: `frontend/src/pages/Home.tsx`

**Step 1: Add loading state**

In `frontend/src/pages/Home.tsx`, destructure `isLoading` from the query:

```
Old: const { data: projects } = useQuery({
New: const { data: projects, isLoading } = useQuery({
```

Add a skeleton grid before the actual project grid. Insert this right after the create project panel (`{showCreate && (...)}`) and before the project grid:

```tsx
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-4 rounded-lg shadow animate-pulse">
              <div className="h-5 w-32 bg-gray-200 rounded mb-3" />
              <div className="h-4 w-24 bg-gray-100 rounded mb-2" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      )}
```

Also add `cursor-pointer` to the project cards. On the project `<button>`, add `cursor-pointer` to its className:

```
Old: className="bg-white p-4 rounded-lg shadow hover:shadow-md text-left transition-shadow"
New: className="bg-white p-4 rounded-lg shadow hover:shadow-md text-left transition-shadow cursor-pointer"
```

**Step 2: Build and verify**

Run:
```bash
cd /home/ubuntu/source/paraverse/frontend && bun run build 2>&1 | tail -5
```
Expected: Build succeeds.

**Step 3: Commit**

```bash
cd /home/ubuntu/source/paraverse
git add frontend/src/pages/Home.tsx
git commit -m "feat(ui): add loading skeleton and cursor-pointer to Home page"
```

---

### Task 10: Make Chat Panel Responsive and Fix StepProgress Readability

The chat panel in Step5 uses `h-[500px]` fixed height. Make it responsive. Also fix the StepProgress step number visibility.

**Files:**
- Modify: `frontend/src/pages/Step5Interaction.tsx`
- Modify: `frontend/src/components/layout/StepProgress.tsx`

**Step 1: Fix chat panel height**

In `frontend/src/pages/Step5Interaction.tsx`, replace the chat panel fixed height:

```
Old: className="lg:col-span-3 flex flex-col bg-white rounded-lg border border-gray-200 h-[500px]"
New: className="lg:col-span-3 flex flex-col bg-white rounded-lg border border-gray-200 h-[calc(100vh-280px)] min-h-[300px]"
```

**Step 2: Fix StepProgress step number visibility**

In `frontend/src/components/layout/StepProgress.tsx`, the step number circle uses `bg-white/20` which is invisible on both white and violet backgrounds.

Replace the step number span:
```
Old:
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
            {step.num}
          </span>

New:
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold
            ${step.num === currentStep
              ? "bg-white/30 text-white"
              : step.num < currentStep
              ? "bg-violet/30 text-violet"
              : "bg-gray-300 text-gray-500"
            }`}>
            {step.num}
          </span>
```

Also remove `pointer-events-none` from future steps so users can navigate freely:

```
Old: : "bg-gray-200 text-gray-400 pointer-events-none"
New: : "bg-gray-200 text-gray-400"
```

**Step 3: Build and verify**

Run:
```bash
cd /home/ubuntu/source/paraverse/frontend && bun run build 2>&1 | tail -5
```
Expected: Build succeeds.

**Step 4: Run E2E tests**

Run:
```bash
cd /home/ubuntu/source/paraverse/frontend && bunx playwright test e2e/critical-flow.spec.ts --reporter=list 2>&1 | tail -20
```
Expected: All 4 tests pass.

**Step 5: Commit**

```bash
cd /home/ubuntu/source/paraverse
git add frontend/src/pages/Step5Interaction.tsx frontend/src/components/layout/StepProgress.tsx
git commit -m "fix(ui): responsive chat panel height, readable step numbers, allow step navigation"
```

---

### Task 11: Add cursor-pointer to All Clickable Elements

Scan remaining components and add `cursor-pointer` to buttons and clickable cards that lack it.

**Files:**
- Modify: `frontend/src/pages/Home.tsx` (scenario buttons in create panel)
- Modify: `frontend/src/components/layout/Sidebar.tsx` (logout/toggle buttons)

**Step 1: Add cursor-pointer to scenario selection buttons in Home.tsx**

In `frontend/src/pages/Home.tsx`, on the scenario `<button>`:

```
Old: className={`p-3 rounded border-2 text-left ${scenario === s ? "border-violet" : "border-gray-200"}`}>
New: className={`p-3 rounded border-2 text-left cursor-pointer hover:border-violet/50 transition-colors ${scenario === s ? "border-violet" : "border-gray-200"}`}>
```

On the Create button:
```
Old: className="bg-navy text-white px-4 py-2 rounded"
New: className="bg-navy text-white px-4 py-2 rounded cursor-pointer hover:bg-navy/90"
```

On the Cancel button:
```
Old: className="px-4 py-2 rounded border"
New: className="px-4 py-2 rounded border cursor-pointer hover:bg-gray-50"
```

**Step 2: Add cursor-pointer to Sidebar buttons**

In `frontend/src/components/layout/Sidebar.tsx`:

Toggle button:
```
Old: className="text-xs text-white/50 hover:text-white"
New: className="text-xs text-white/50 hover:text-white cursor-pointer"
```

Logout button:
```
Old: className="text-xs text-red-400 hover:text-red-300"
New: className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
```

**Step 3: Build and verify**

Run:
```bash
cd /home/ubuntu/source/paraverse/frontend && bun run build 2>&1 | tail -5
```
Expected: Build succeeds.

**Step 4: Commit**

```bash
cd /home/ubuntu/source/paraverse
git add frontend/src/pages/Home.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "fix(ui): add cursor-pointer and hover states to all clickable elements"
```

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Install lucide-react | package.json |
| 2 | Global focus rings | globals.css, Step5Interaction.tsx |
| 3 | Mobile sidebar + hamburger | AppShell.tsx, Sidebar.tsx, uiStore.ts |
| 4 | Form labels (a11y) | Login.tsx, Register.tsx |
| 5 | Humanize agent IDs & events | humanize.ts (new), AgentFeed.tsx, Step5Interaction.tsx |
| 6 | Brand colors + icons in ExportButton | ExportButton.tsx |
| 7 | SVG icons in FileUpload | FileUpload.tsx |
| 8 | Progress bar height + status labels | TaskProgress.tsx, SimulationStatus.tsx |
| 9 | Loading skeleton for Home | Home.tsx |
| 10 | Responsive chat + step numbers | Step5Interaction.tsx, StepProgress.tsx |
| 11 | cursor-pointer everywhere | Home.tsx, Sidebar.tsx |
