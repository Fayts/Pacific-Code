import { redirect } from "next/navigation";

// Le proxy (middleware) redirige vers /login si aucune session n'existe.
export default function Home() {
  redirect("/dashboard");
}
