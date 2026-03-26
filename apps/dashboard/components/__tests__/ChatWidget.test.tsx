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
        providerReachable: true,
        checkedAt: "2026-03-26T09:00:00.000Z",
        latencyMs: 42,
      },
    });

    render(<ChatWidget />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "chat.openChat" }));
    });
    await act(async () => {
      fireEvent.pointerEnter(screen.getByTestId("chat-status-pill"));
    });

    await waitFor(() => {
      expect(within(screen.getByTestId("chat-status-pill")).getByText("gpt-4o-mini")).toBeInTheDocument();
      expect(within(screen.getByTestId("chat-status-pill")).getByText("CONNECTED")).toBeInTheDocument();
    });

    expect(screen.queryByText("GPT-4")).not.toBeInTheDocument();
    expect(screen.queryByText("Pro")).not.toBeInTheDocument();
    expect(screen.getByTestId("chat-status-tooltip")).toHaveTextContent("OpenAI");
    expect(screen.getByTestId("chat-status-tooltip")).toHaveTextContent("OpenAI ready");
    expect(screen.getByTestId("chat-status-tooltip")).toHaveTextContent("Chat backend is reachable and ready.");
  });

  it("shows a degraded provider state when the chat endpoint is live but OpenAI is down", async () => {
    mockedGetHealth.mockResolvedValue({
      status: "ok",
      version: "0.2.20",
      timestamp: "2026-03-26T09:00:00.000Z",
      chat: {
        provider: "openai",
        model: "gpt-4o-mini",
        configured: true,
        reachable: true,
        providerReachable: false,
        checkedAt: "2026-03-26T09:00:00.000Z",
        latencyMs: 42,
      },
    });

    render(<ChatWidget />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "chat.openChat" }));
    });
    await act(async () => {
      fireEvent.pointerEnter(screen.getByTestId("chat-status-pill"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("chat-status-pill")).toHaveTextContent("CONNECTED");
    });

    expect(screen.getByTestId("chat-status-tooltip")).toHaveTextContent("OpenAI down");
    expect(screen.getByTestId("chat-status-tooltip")).toHaveTextContent(
      "Chat endpoint is live, but OpenAI is not reachable right now.",
    );
  });

  it("loads a template prompt into the composer and returns to chat", async () => {
    mockedGetHealth.mockResolvedValue({
      status: "ok",
      version: "0.2.20",
      timestamp: "2026-03-26T09:00:00.000Z",
      chat: {
        provider: "openai",
        model: "gpt-4o-mini",
        configured: true,
        reachable: true,
        providerReachable: true,
        checkedAt: "2026-03-26T09:00:00.000Z",
        latencyMs: 42,
      },
    });

    render(<ChatWidget />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "chat.openChat" }));
    });

    fireEvent.click(screen.getByRole("button", { name: "chat.tabExamples" }));
    fireEvent.click(screen.getAllByRole("button", { name: "chat.useTemplate" })[0]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("chat.placeholder")).toHaveValue("resumen alertas hoy");
    });

    expect(screen.queryByRole("button", { name: "chat.useTemplate" })).not.toBeInTheDocument();
  });
});
