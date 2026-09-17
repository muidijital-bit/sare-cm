import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export default async function RootPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/giris");
  }
  // Yalnızca süper admin olup hiçbir şirkete üye olmayan kullanıcı (örn. platform hesabı)
  // doğrudan platform paneline yönlenir — aksi halde boş bir "şirket seç" ekranında kalırdı.
  if (session.user.isSuperAdmin && session.memberships.length === 0) {
    redirect("/platform");
  }
  if (!session.activeCompanyId) {
    redirect("/app/sirket-sec");
  }
  redirect("/app");
}
