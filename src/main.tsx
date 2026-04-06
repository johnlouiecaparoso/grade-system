
  import { createRoot } from "react-dom/client";
  import { registerSW } from "virtual:pwa-register";
  import App from "./app/App.tsx";
  import { AuthProvider } from "./app/contexts/AuthContext.tsx";
  import "./styles/index.css";

  registerSW({ immediate: true });

  createRoot(document.getElementById("root")!).render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
  