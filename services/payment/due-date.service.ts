/**
 * Serviço de Cálculo de Prazos de Vencimento Bancário em Dias Úteis
 * Homologado para Boleto Bancário D+1 (Continental E-Commerce).
 */

/**
 * Calcula a data de vencimento em dias úteis a partir de uma data de referência.
 *
 * Regras para 1 dia útil (D+1):
 * - Segunda a Quinta: Vencimento no dia útil imediatamente seguinte (+1 dia).
 * - Sexta-feira: Vencimento na Segunda-feira subsequente (+3 dias).
 * - Sábado: Vencimento na Terça-feira subsequente (+3 dias).
 * - Domingo: Vencimento na Terça-feira subsequente (+2 dias).
 *
 * @param businessDays Quantidade de dias úteis (padrão: 1)
 * @param fromDate Data base (padrão: agora)
 * @returns Objeto com Date e string formatada YYYY-MM-DD
 */
export function calculateBusinessDueDate(
  businessDays: number = 1,
  fromDate: Date = new Date()
): { dueDate: Date; dueDateString: string } {
  const result = new Date(fromDate);
  let daysAdded = 0;

  // Se a data de emissão for sábado ou domingo, avança para segunda primeiro
  const dayOfWeek = result.getDay(); // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 6) {
    result.setDate(result.getDate() + 2); // Sábado -> Segunda
  } else if (dayOfWeek === 0) {
    result.setDate(result.getDate() + 1); // Domingo -> Segunda
  }

  while (daysAdded < businessDays) {
    result.setDate(result.getDate() + 1);
    const currentDay = result.getDay();
    // 0 = Domingo, 6 = Sábado
    if (currentDay !== 0 && currentDay !== 6) {
      daysAdded++;
    }
  }

  const year = result.getFullYear();
  const month = String(result.getMonth() + 1).padStart(2, '0');
  const day = String(result.getDate()).padStart(2, '0');
  const dueDateString = `${year}-${month}-${day}`;

  return { dueDate: result, dueDateString };
}
