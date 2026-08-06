import { MethodologyBulletin } from "./MethodologyBulletin";
import { bulletinFontVars } from "./bulletinFonts";

export default function MethodologyPage() {
  // The bulletin's five faces are attached here rather than in the root
  // layout, so no other route pays for them or inherits them.
  return (
    <div className={bulletinFontVars}>
      <MethodologyBulletin />
    </div>
  );
}
