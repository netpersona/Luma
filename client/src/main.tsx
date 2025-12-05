import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "@/components/error-boundary";
import { AnnouncerProvider } from "@/components/accessible-announcer";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <AnnouncerProvider>
      <App />
    </AnnouncerProvider>
  </ErrorBoundary>
);
