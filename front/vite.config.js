import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    // Polyfills Buffer, process, crypto… requis par bip39 en contexte browser
    nodePolyfills({ include: ["buffer", "crypto", "process"] }),
  ],
  server: {
    host: "0.0.0.0", // Permet d'accéder depuis l'extérieur (ex. serveur EC2)
    port: 5173,
    strictPort: true,
  },
});
