import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DiffApproval, defaultSelection } from "@/components/ai/diff-approval";
import type { ProposalSection } from "@/lib/domain/proposals";

const SECTIONS: ProposalSection[] = [
  {
    key: "problem",
    label: "Problema",
    current: "",
    proposed: "Selezionare costa più che eseguire.",
    kind: "project_section",
    confidence: "high",
    rationale: "Frase presa dal tuo testo.",
  },
  {
    key: "solution",
    label: "Soluzione",
    current: "La mia soluzione scritta a mano",
    proposed: "Punteggio trasparente e matrice.",
    kind: "project_section",
    confidence: "low",
    rationale: "Derivata dai punti elencati.",
  },
];

function Harness() {
  const [selected, setSelected] = React.useState<Set<string>>(() =>
    defaultSelection(SECTIONS),
  );

  return (
    <>
      <p data-testid="selection">{[...selected].sort().join(",")}</p>
      <DiffApproval
        sections={SECTIONS}
        selected={selected}
        onToggle={(key, next) =>
          setSelected((current) => {
            const copy = new Set(current);
            if (next) copy.add(key);
            else copy.delete(key);
            return copy;
          })
        }
      />
    </>
  );
}

describe("DiffApproval", () => {
  it("shows the current value next to the proposal", () => {
    render(<Harness />);

    expect(screen.getByText("La mia soluzione scritta a mano")).toBeInTheDocument();
    expect(screen.getByText("Punteggio trasparente e matrice.")).toBeInTheDocument();
  });

  it("flags sections that would replace the user's own text", () => {
    render(<Harness />);
    expect(screen.getByText("sostituisce il tuo testo")).toBeInTheDocument();
  });

  it("leaves overwriting sections unticked by default", () => {
    render(<Harness />);
    expect(screen.getByTestId("selection")).toHaveTextContent("problem");
    expect(screen.getByTestId("selection")).not.toHaveTextContent("solution");
  });

  it("supports approving a single section", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText(/Soluzione/i, { selector: "button" }));
    expect(screen.getByTestId("selection")).toHaveTextContent("problem,solution");

    await user.click(screen.getByLabelText(/Problema/i, { selector: "button" }));
    expect(screen.getByTestId("selection")).toHaveTextContent("solution");
  });

  it("states the confidence of every proposal", () => {
    render(<Harness />);
    expect(screen.getByText("Alta confidenza")).toBeInTheDocument();
    expect(screen.getByText("Bassa confidenza")).toBeInTheDocument();
  });

  it("explains why each section was proposed", () => {
    render(<Harness />);
    expect(screen.getByText("Frase presa dal tuo testo.")).toBeInTheDocument();
  });
});
