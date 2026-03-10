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
import LtiCallback from "@/pages/LtiCallback";

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/lti/callback", element: <LtiCallback /> },
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
