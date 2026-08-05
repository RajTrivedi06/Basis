import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GlossaryTerm } from "@/components/glossary/GlossaryTerm";
import { GLOSSARY } from "@/components/glossary/terms";

/**
 * The definitions are final copy (design doc C21). These assertions pin the
 * exact strings so a well-meaning reword fails the suite instead of shipping.
 */
const C21 = {
  residual:
    "the share of price differences left over after accounting for everything sellers publicly disclose.",
  spot: "discounted capacity the provider can take back at any time.",
  decomposition:
    "splitting total price variation into named causes, modeled jointly from observed quotes.",
  icc: "how much of the leftover variation sticks to the same specific machines day after day.",
} as const;

describe("glossary definitions", () => {
  it("matches the C21 copy verbatim", () => {
    expect(GLOSSARY.residual.definition).toBe(C21.residual);
    expect(GLOSSARY.spot.definition).toBe(C21.spot);
    expect(GLOSSARY.decomposition.definition).toBe(C21.decomposition);
    expect(GLOSSARY.icc.definition).toBe(C21.icc);
  });
});

describe("GlossaryTerm", () => {
  it("is a button that starts collapsed and expands on click", async () => {
    const user = userEvent.setup();
    render(<GlossaryTerm term="residual" />);

    const trigger = screen.getByRole("button", { name: "Residual" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("note")).toHaveTextContent(C21.residual);
  });

  it("keeps the definition in the DOM while collapsed", () => {
    const { container } = render(<GlossaryTerm term="icc" />);

    // Rendered but hidden: the copy ships in the server HTML rather than
    // being conditionally mounted after hydration.
    const panel = container.querySelector(".gloss__panel");
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute("hidden");
    expect(panel?.textContent).toContain(C21.icc);
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<GlossaryTerm term="spot" />);

    const trigger = screen.getByRole("button", { name: "Spot" });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("lets callers inflect the trigger without touching the definition", async () => {
    const user = userEvent.setup();
    render(<GlossaryTerm term="decomposition">decomposed</GlossaryTerm>);

    const trigger = screen.getByRole("button", { name: "decomposed" });
    await user.click(trigger);

    expect(screen.getByRole("note")).toHaveTextContent(C21.decomposition);
  });
});
