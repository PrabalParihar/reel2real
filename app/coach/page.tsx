import { Suspense } from "react";
import { CoachScreen } from "@/src/ui/CoachScreen";

export default function Page() {
  return (
    <Suspense fallback={<main className="screen"><p>Opening the coach…</p></main>}>
      <CoachScreen />
    </Suspense>
  );
}
