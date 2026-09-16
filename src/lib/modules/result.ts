/**
 * Tüm modül servis katmanlarının (customers, gelecekte quotes/orders/payments/expenses)
 * ortak dönüş tipi. Route handler bunu tek bir yerden (serviceResultToResponse) HTTP
 * yanıtına çevirir — her route kendi hata haritalamasını yeniden icat etmez.
 */
export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

export function forbidden(message = "Bu işlem için yetkiniz yok."): ServiceResult<never> {
  return { ok: false, status: 403, message };
}

export function notFound(message = "Kayıt bulunamadı."): ServiceResult<never> {
  return { ok: false, status: 404, message };
}

export function conflict(message: string): ServiceResult<never> {
  return { ok: false, status: 409, message };
}
