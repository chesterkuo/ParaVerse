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
