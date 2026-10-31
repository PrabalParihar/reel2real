import { Suspense } from "react";
import { ExtractingScreen } from "@/src/ui/ExtractingScreen";

export default function Page() {
  return (
    <Suspense fallback={<main className="screen"><p>Opening Spark…</p></main>}>
      <ExtractingScreen />
    </Suspense>
  );
}
