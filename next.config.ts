import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Prints de gráfico chegam a alguns MB. O upload passa por Server Action
      // para a chave do Supabase não precisar ir ao navegador.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
