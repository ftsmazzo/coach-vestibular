import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdf-parse v2 + pdfjs: não empacotar no bundle do servidor (evita "módulo indisponível" em prod)
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  // Provas UFU: PDF/texto colado pode passar de 10MB (middleware clona o body)
  experimental: {
    proxyClientMaxBodySize: "64mb",
    middlewareClientMaxBodySize: "64mb",
  },
};

export default nextConfig;
