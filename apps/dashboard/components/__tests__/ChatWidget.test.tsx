import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import { ChatWidget } from "../ChatWidget";
import { getHealth, sendChatMessage } from "../../lib/api";

const mockedGetHealth = jest.mocked(getHealth);
const mockedSendChatMessage = jest.mocked(sendChatMessage);

jest.mock("../../lib/api", () => ({
  getHealth: jest.fn(),
  sendChatMessage: jest.fn(),
}));

jest.mock("@cig-technology/i18n/react", () => ({
  useTranslation: () => (key: string) => key,
}));

describe("ChatWidget", () => {
  beforeEach(() => {
    mockedGetHealth.mockReset();
    mockedSendChatMessage.mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("shows the live model and connection status in the header pill", async () => {
    mockedGetHealth.mockResolvedValue({
      status: "ok",
      version: "0.2.15",
      timestamp: "2026-03-26T09:00:00.000Z",
      chat: {
        provider: "openai",
        model: "gpt-4o-mini",
        configured: true,
        reachable: true,
        checkedAt: "2026-03-26T09:00:00.000Z",
        latencyMs: 42,
      },
    });

    render(<ChatWidget />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "chat.openChat" }));
    });

    await waitFor(() => {
      expect(within(screen.getByTestId("chat-status-pill")).getByText("gpt-4o-mini")).toBeInTheDocument();
      expect(within(screen.getByTestId("chat-status-pill")).getByText("CONNECTED")).toBeInTheDocument();
    });

    expect(screen.queryByText("GPT-4")).not.toBeInTheDocument();
    expect(screen.queryByText("Pro")).not.toBeInTheDocument();
    expect(screen.getByTestId("chat-status-tooltip")).toHaveTextContent("OpenAI");
    expect(screen.getByTestId("chat-status-tooltip")).toHaveTextContent("Chat backend is reachable and ready.");
  });
});
