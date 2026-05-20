import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdf-parse v2 + pdfjs: não empacotar no bundle do servidor (evita "módulo indisponível" em prod)
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
