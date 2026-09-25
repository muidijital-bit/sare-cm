/**
 * Ürün markası — tek kaynak. Ürün adı/logo değişirse yalnızca burası (ve public/ dosyaları) değişir.
 * Uygulama içinde HERKES muiflow markasını görür; müşteri (kiracı) firmanın adı ayrıca gösterilir,
 * müşteri logosu menüde kullanılmaz (bkz. ürün kararı).
 */
export const BRAND = {
  name: "muiflow",
  /** Koyu (lacivert) zeminlerde kullanılan beyaz logo. */
  logoWhite: "/muiflow-logo-white.png",
  /** Açık zeminlerde kullanılacak siyah logo. */
  logoDark: "/muiflow-logo.png",
  /** Daraltılmış menü / küçük alanlar için "mu" amblemi (beyaz). */
  mark: "/muiflow-mark.png",
} as const;
