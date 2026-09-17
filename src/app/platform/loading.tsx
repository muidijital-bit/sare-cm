export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-brand-200">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-700 border-t-white" />
        Yükleniyor…
      </div>
    </div>
  );
}
