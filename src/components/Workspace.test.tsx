import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("lets valid email rows continue to message setup before sender fields are filled", async () => {
    render(<Workspace session={session} />);

    const fileInput = document.querySelector<HTMLInputElement>(
      'input[type="file"][accept=".csv,.xlsx"]',
    );
    expect(fileInput).not.toBeNull();
    const file = new File(
      [
        "Company Name,POC Name,Email ID,Designation\nAcme,Ada,ada@example.com,Founder",
      ],
      "contacts.csv",
      { type: "text/csv" },
    );
    Object.defineProperty(file, "text", {
      value: async () =>
        "Company Name,POC Name,Email ID,Designation\nAcme,Ada,ada@example.com,Founder",
    });
    fireEvent.change(fileInput!, { target: { files: [file] } });

    await screen.findByText("1 rows · 4 columns");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      await screen.findByRole("heading", { name: "Write your message" }),
    ).toBeInTheDocument();
  });
});
