import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // Permet d'accéder depuis l'extérieur (ex. serveur EC2)
    port: 5173,
    strictPort: true,
  },
});
