"use client";

/**
 * Projedeki TÜM onay/uyarı diyalogları buradan geçer — tarayıcının çıplak
 * confirm()/alert()/prompt() yerine SweetAlert2 kullanılır (tutarlı görünüm + marka rengi).
 * Yalnızca "use client" bileşenlerinden çağrılır; SweetAlert2 DOM'a bağımlı olduğundan
 * sunucu bileşeninden import edilmemeli.
 */
import Swal from "sweetalert2";

const BRAND = "#152c69"; // brand-800
const DANGER = "#dc2626"; // red-600
const NEUTRAL = "#6b7280"; // gray-500

/** Silme/iptal gibi geri alınamaz işlemlerden önce — "Evet, sil" / "Vazgeç". */
export async function confirmDelete(message: string, title = "Emin misiniz?"): Promise<boolean> {
  const result = await Swal.fire({
    title,
    text: message,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Evet, sil",
    cancelButtonText: "Vazgeç",
    confirmButtonColor: DANGER,
    cancelButtonColor: NEUTRAL,
    reverseButtons: true,
  });
  return result.isConfirmed;
}

/** Yıkıcı olmayan ama onay gerektiren genel işlemler için. */
export async function confirmAction(message: string, title = "Emin misiniz?"): Promise<boolean> {
  const result = await Swal.fire({
    title,
    text: message,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Evet",
    cancelButtonText: "Vazgeç",
    confirmButtonColor: BRAND,
    cancelButtonColor: NEUTRAL,
    reverseButtons: true,
  });
  return result.isConfirmed;
}

export async function notifyError(message: string, title = "Hata"): Promise<void> {
  await Swal.fire({ title, text: message, icon: "error", confirmButtonColor: BRAND });
}

export async function notifyInfo(message: string, title = "Bilgi"): Promise<void> {
  await Swal.fire({ title, text: message, icon: "info", confirmButtonColor: BRAND });
}

const successToast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 2200,
  timerProgressBar: true,
});

export async function notifySuccess(message: string): Promise<void> {
  await successToast.fire({ icon: "success", title: message });
}
