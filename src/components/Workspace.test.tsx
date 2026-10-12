import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));

vi.mock("../lib/api", () => ({
  api: apiMock,
  downloadBatchCsv: vi.fn(),
}));

import { Workspace } from "./Workspace";

const session = {
  access_token: "access-token",
  token_type: "bearer",
  user: { id: "user-1", email: "sender@example.com" },
} as Session;

describe("Workspace contact step", () => {
  afterEach(cleanup);

  beforeEach(() => {
    apiMock.mockImplementation(async (name: string) => {
      switch (name) {
        case "profile":
          return {
            profile: { name: "", email: "sender@example.com", phone: "" },
            gmail: null,
          };
        case "gmail-status":
          return {
            connection: {
              email: "sender@example.com",
              reconnectRequired: false,
            },
          };
        case "templates":
          return { templates: [] };
        case "attachments":
          return { attachments: [] };
        case "batches":
          return { batches: [] };
        default:
          throw new Error(`Unexpected API call: ${name}`);
      }
    });
  });

  it("lets formatted email rows continue before sender fields are filled", async () => {
    render(<Workspace session={session} />);

    await uploadCsv(
      "Company Name,POC Name,Email ID,Designation\nAcme,Ada,ada@example.com,Founder",
    );

    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(
      screen.getByText(/email format only; the app cannot confirm whether an address exists/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/valid email/i)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(screen.getByRole("region", { name: "Contact list" })).getByRole(
          "button",
          { name: /^continue$/i },
        ),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() =>
      expect(
        screen.getAllByRole("heading", { name: "Write your message" }).length,
      ).toBeGreaterThan(0),
    );
  });

  it("shows incomplete row reasons and offers an explicit continue override", async () => {
    render(<Workspace session={session} />);

    await uploadCsv(
      "Company Name,POC Name,Email ID,Designation\nAcme,,not-an-email,Founder",
    );

    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(
      screen.getByText(/Missing value for \[POC Name\]/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/one email address in the correct format/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/flagged rows will still be skipped until corrected/i),
    ).toBeInTheDocument();
    const override = screen.getByRole("button", { name: /continue anyway/i });
    expect(override).toBeEnabled();
    fireEvent.click(override);

    await waitFor(() =>
      expect(
        screen.getAllByRole("heading", { name: "Write your message" }).length,
      ).toBeGreaterThan(0),
    );
  });

  it("does not flag an address based on whether its domain or mailbox exists", async () => {
    render(<Workspace session={session} />);

    await uploadCsv(
      "Company Name,POC Name,Email ID,Designation\nAcme,Ada,nobody@does-not-exist.invalid,Founder",
    );

    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Contact list" })).getByRole(
        "button",
        { name: /^continue$/i },
      ),
    ).toBeEnabled();
  });
});

async function uploadCsv(contents: string) {
  const fileInput = document.querySelector<HTMLInputElement>(
    'input[type="file"][accept=".csv,.xlsx"]',
  );
  expect(fileInput).not.toBeNull();
  const file = new File([contents], "contacts.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", { value: async () => contents });
  fireEvent.change(fileInput!, { target: { files: [file] } });
  await screen.findByText(/rows · 4 columns/);
}
