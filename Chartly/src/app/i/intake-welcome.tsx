import type { ComponentProps } from "react";
import { IntakeWizard } from "./intake-wizard";

// The customer experience. Shared by /i/[token] and the contractor preview
// so they always match.
export function IntakeWelcome(props: ComponentProps<typeof IntakeWizard>) {
  return <IntakeWizard {...props} />;
}
