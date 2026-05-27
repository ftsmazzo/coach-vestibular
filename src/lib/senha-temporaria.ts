/** Senha inicial legível para repasse manual (sem caracteres ambíguos 0/O, 1/l). */
export function gerarSenhaTemporaria(tamanho = 10): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < tamanho; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
