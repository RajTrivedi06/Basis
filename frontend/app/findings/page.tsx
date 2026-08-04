import { FindingsHero } from "@/components/FindingsHero";
import { FungibilityMatrix } from "@/components/FungibilityMatrix";
import { FileNotes } from "@/components/findings/FileNotes";

export default function FindingsPage() {
  return (
    <div className="page-wide fade-up dossier-page">
      <FindingsHero />
      <FungibilityMatrix />
      <FileNotes />
    </div>
  );
}
