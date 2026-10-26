import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// em desenvolvimento o Vite repassa /api para o backend
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": process.env.CMA_API ?? "http://127.0.0.1:8971" },
  },
});
