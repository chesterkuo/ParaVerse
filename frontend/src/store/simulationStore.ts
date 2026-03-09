import { create } from "zustand";

interface SimEvent {
  event_type: string;
  content?: string;
  sim_timestamp: number;
  agent_id?: string;
  metadata?: Record<string, unknown>;
}

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
