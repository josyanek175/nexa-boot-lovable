/**
 * Utilitários simples para normalização de números de telefone.
 * Sem dependências de servidor — pode ser usado em client e server.
 */

/**
 * Remove todos os caracteres não numéricos.
 */
export function onlyDigits(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

/**
 * Remove o 9º dígito de números móveis brasileiros.
 * Formato esperado: 55 + DDD (2) + 9 + 8 dígitos = 13 dígitos
 * Retorna 12 dígitos (sem o 9 extra) para melhor compatibilidade com WhatsApp.
 * Mantém inalterados: números fixos, internacionais ou já normalizados.
 */
export function normalizePhone(input: string): string {
  const digits = onlyDigits(input);
  if (digits.length === 13 && digits.startsWith("55") && digits[4] === "9") {
    return digits.slice(0, 4) + digits.slice(5);
  }
  return digits;
}
