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
      screen.getByText(/cannot confirm whether an address exists/i),
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
      screen.getByText(/format errors and missing message values must be corrected/i),
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

  it("flags a likely domain typo in Contacts and Review and allows the user to continue", async () => {
    const base = apiMock.getMockImplementation()!;
    apiMock.mockImplementation(async (name: string) => name === "profile" ? {
      profile: { name: "Sender", email: "sender@example.com", phone: "+91 1234567890" },
      gmail: { email: "sender@example.com", reconnectRequired: false },
    } : base(name));
    render(<Workspace session={session} />);

    await uploadCsv("Company Name,POC Name,Email ID,Designation\nAcme,Ada,mananshah1511@gmangil.com,Founder");

    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText(/possible email typo.*gmail.com/i)).toBeInTheDocument();
    expect(screen.queryByText(/flagged rows will still be skipped/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /continue anyway/i }));
    const reviewButton = await screen.findByRole("button", { name: /review emails/i });
    await waitFor(() => expect(reviewButton).toBeEnabled());
    fireEvent.click(reviewButton);

    expect(await screen.findByText(/possible email typo.*gmail.com/i)).toBeInTheDocument();
    expect(screen.getAllByText("Check address").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /send 1 email/i })).toBeEnabled();
    expect(apiMock).not.toHaveBeenCalledWith("batch-start", expect.anything());
  });

  it("shows a spelling issue on an accepted result without claiming a delivery failure", async () => {
    const batch = { id: "batch-1", status: "completed", created_at: "2026-10-12T19:56:00Z", total_count: 1, success_count: 1, failed_count: 0, needs_review_count: 0, skipped_count: 0, subject_template: "Test campaign" };
    const base = apiMock.getMockImplementation()!;
    apiMock.mockImplementation(async (name: string) => {
      if (name === "batches") return { batches: [batch] };
      if (name === "batch-status?id=batch-1") return { batch, recipients: [{ id: "recipient-1", email: "mananshah1511@gmangil.com", poc_name: "Ada", company_name: "Acme", source_row: 2, status: "sent", attempt_count: 1, gmail_message_id: "message-1", updated_at: batch.created_at }] };
      return base(name);
    });
    render(<Workspace session={session} />);

    fireEvent.click(await screen.findByRole("button", { name: /history/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^view$/i }));

    expect(await screen.findByText(/possible email typo.*gmail.com/i)).toBeInTheDocument();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText(/delivery is not confirmed/i)).toBeInTheDocument();
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
