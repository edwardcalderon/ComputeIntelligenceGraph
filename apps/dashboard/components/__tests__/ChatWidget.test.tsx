import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import { ChatWidget } from "../ChatWidget";
import {
  deleteChatSession,
  getChatSessionMessages,
  getChatSessions,
  getHealth,
  renameChatSession,
  sendChatMessage,
} from "../../lib/api";

const translate = (key: string) => key;

const mockedDeleteChatSession = jest.mocked(deleteChatSession);
const mockedGetChatSessionMessages = jest.mocked(getChatSessionMessages);
const mockedGetChatSessions = jest.mocked(getChatSessions);
const mockedGetHealth = jest.mocked(getHealth);
const mockedRenameChatSession = jest.mocked(renameChatSession);
const mockedSendChatMessage = jest.mocked(sendChatMessage);

jest.mock("../../lib/api", () => ({
  deleteChatSession: jest.fn(),
  getChatSessionMessages: jest.fn(),
  getChatSessions: jest.fn(),
  getHealth: jest.fn(),
  renameChatSession: jest.fn(),
  sendChatMessage: jest.fn(),
}));

jest.mock("@cig-technology/i18n/react", () => ({
  useTranslation: () => translate,
}));

describe("ChatWidget", () => {
  beforeEach(() => {
    mockedDeleteChatSession.mockReset();
    mockedGetChatSessionMessages.mockReset();
    mockedGetChatSessions.mockReset();
    mockedGetHealth.mockReset();
    mockedRenameChatSession.mockReset();
    mockedSendChatMessage.mockReset();
    sessionStorage.clear();
    jest.spyOn(window, "confirm").mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
    mockedGetChatSessions.mockResolvedValue({ items: [], total: 0 });

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

  it("loads saved sessions and deletes the active thread cleanly", async () => {
    const firstSession = {
      id: "chat-1",
      title: "Prod alerts",
      lastMessagePreview: "Two critical issues in us-east-1.",
      lastMessageAt: "2026-03-26T09:00:00.000Z",
      createdAt: "2026-03-26T09:00:00.000Z",
      updatedAt: "2026-03-26T09:00:00.000Z",
    };
    const secondSession = {
      id: "chat-2",
      title: "Revenue pulse",
      lastMessagePreview: "Sales are up 12% week over week.",
      lastMessageAt: "2026-03-26T10:00:00.000Z",
      createdAt: "2026-03-26T10:00:00.000Z",
      updatedAt: "2026-03-26T10:00:00.000Z",
    };

    mockedGetHealth.mockResolvedValue({
      status: "ok",
      version: "0.2.27",
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
    mockedGetChatSessions
      .mockResolvedValueOnce({ items: [firstSession, secondSession], total: 2 })
      .mockResolvedValueOnce({ items: [secondSession], total: 1 });
    mockedGetChatSessionMessages
      .mockResolvedValueOnce({
        session: firstSession,
        items: [
          {
            id: "msg-1",
            role: "assistant",
            content: "Saved answer",
            timestamp: "2026-03-26T09:00:00.000Z",
          },
        ],
        total: 1,
      })
      .mockResolvedValueOnce({
        session: secondSession,
        items: [
          {
            id: "msg-2",
            role: "assistant",
            content: "Second history",
            timestamp: "2026-03-26T10:00:00.000Z",
          },
        ],
        total: 1,
      });
    mockedDeleteChatSession.mockResolvedValue({ success: true });

    render(<ChatWidget />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "chat.openChat" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Saved answer")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "chat.deleteSession" }).length).toBeGreaterThan(0);
    });

    const prodAlertsDeleteButton = screen.getAllByRole("button", {
      name: "chat.deleteSession",
    })[0]!;

    await act(async () => {
      fireEvent.click(prodAlertsDeleteButton);
    });

    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("chat.deleteSession")).toBeInTheDocument();
      expect(within(dialog).getByText("Prod alerts")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "common.confirm" }));
    });

    await waitFor(() => {
      expect(mockedGetChatSessionMessages).toHaveBeenLastCalledWith("chat-2");
    });

    expect(mockedDeleteChatSession).toHaveBeenCalledWith("chat-1");
    expect(sessionStorage.getItem("cig-chat-active-session")).toBe("chat-2");
  });

  it("collapses the session rail into icon-only mode with hover tooltips", async () => {
    const firstSession = {
      id: "chat-1",
      title: "Prod alerts",
      lastMessagePreview: "Two critical issues in us-east-1.",
      lastMessageAt: "2026-03-26T09:00:00.000Z",
      createdAt: "2026-03-26T09:00:00.000Z",
      updatedAt: "2026-03-26T09:00:00.000Z",
    };
    const secondSession = {
      id: "chat-2",
      title: "Revenue pulse",
      lastMessagePreview: "Sales are up 12% week over week.",
      lastMessageAt: "2026-03-26T10:00:00.000Z",
      createdAt: "2026-03-26T10:00:00.000Z",
      updatedAt: "2026-03-26T10:00:00.000Z",
    };

    mockedGetHealth.mockResolvedValue({
      status: "ok",
      version: "0.2.41",
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
    mockedGetChatSessions.mockResolvedValue({
      items: [firstSession, secondSession],
      total: 2,
    });
    mockedGetChatSessionMessages.mockResolvedValue({
      session: firstSession,
      items: [
        {
          id: "msg-1",
          role: "assistant",
          content: "Saved answer",
          timestamp: "2026-03-26T09:00:00.000Z",
        },
      ],
      total: 1,
    });

    render(<ChatWidget />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "chat.openChat" }));
    });

    await waitFor(() => {
      expect(screen.getAllByText("Prod alerts").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Revenue pulse").length).toBeGreaterThan(0);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "chat.collapseSessions" }));
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Prod alerts • Two critical issues in us-east-1." }),
      ).toHaveTextContent("P");
      expect(
        screen.getByRole("button", { name: "Revenue pulse • Sales are up 12% week over week." }),
      ).toHaveTextContent("R");
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "chat.expandSessions" }));
    });

    await waitFor(() => {
      expect(screen.getAllByText("Prod alerts").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Revenue pulse").length).toBeGreaterThan(0);
    });
  });

  it("renames a saved session and keeps the updated title in the rail", async () => {
    const firstSession = {
      id: "chat-1",
      title: "Prod alerts",
      lastMessagePreview: "Two critical issues in us-east-1.",
      lastMessageAt: "2026-03-26T09:00:00.000Z",
      createdAt: "2026-03-26T09:00:00.000Z",
      updatedAt: "2026-03-26T09:00:00.000Z",
    };
    const renamedSession = {
      ...firstSession,
      title: "Production alerts",
      updatedAt: "2026-03-26T09:05:00.000Z",
    };

    mockedGetHealth.mockResolvedValue({
      status: "ok",
      version: "0.2.35",
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
    mockedGetChatSessions
      .mockResolvedValueOnce({ items: [firstSession], total: 1 })
      .mockResolvedValueOnce({ items: [renamedSession], total: 1 });
    mockedGetChatSessionMessages.mockResolvedValue({
      session: firstSession,
      items: [
        {
          id: "msg-1",
          role: "assistant",
          content: "Saved answer",
          timestamp: "2026-03-26T09:00:00.000Z",
        },
      ],
      total: 1,
    });
    mockedRenameChatSession.mockResolvedValue(renamedSession);

    render(<ChatWidget />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "chat.openChat" }));
    });

    await waitFor(() => {
      expect(screen.getAllByText("Prod alerts").length).toBeGreaterThan(0);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "chat.renameSession" }));
    });

    const renameInput = screen.getByRole("textbox", { name: "chat.renameSession" });
    fireEvent.change(renameInput, { target: { value: "Production alerts" } });

    await act(async () => {
      fireEvent.keyDown(renameInput, { key: "Enter" });
    });

    await waitFor(() => {
      expect(screen.getAllByText("Production alerts").length).toBeGreaterThan(0);
    });

    expect(mockedRenameChatSession).toHaveBeenCalledWith("chat-1", "Production alerts");
  });

  it("sends a first message from the draft flow and binds the returned session id", async () => {
    mockedGetHealth.mockResolvedValue({
      status: "ok",
      version: "0.2.27",
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
    mockedGetChatSessions
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockResolvedValueOnce({
        items: [
          {
            id: "chat-9",
            title: "Summarize alerts today",
            lastMessagePreview: "Two critical alerts need attention.",
            lastMessageAt: "2026-03-26T09:00:00.000Z",
            createdAt: "2026-03-26T09:00:00.000Z",
            updatedAt: "2026-03-26T09:00:00.000Z",
          },
        ],
        total: 1,
      });
    mockedSendChatMessage.mockResolvedValue({
      answer: "Two critical alerts need attention.",
      needsClarification: false,
      sessionId: "chat-9",
    });

    render(<ChatWidget />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "chat.openChat" }));
    });

    await waitFor(() => {
      expect(mockedGetChatSessions).toHaveBeenCalled();
      expect(screen.getByText("chat.emptyState")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("chat.placeholder"), {
      target: { value: "Summarize alerts today" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "chat.sendMessage" }));
    });

    await waitFor(() => {
      expect(screen.getAllByText("Two critical alerts need attention.").length).toBeGreaterThan(0);
    });

    expect(mockedSendChatMessage).toHaveBeenCalledWith("Summarize alerts today", undefined);
    expect(sessionStorage.getItem("cig-chat-active-session")).toBe("chat-9");
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
    mockedGetChatSessions.mockResolvedValue({ items: [], total: 0 });

    render(<ChatWidget />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "chat.openChat" }));
    });

    fireEvent.click(screen.getByRole("button", { name: "chat.tabExamples" }));
    fireEvent.click(screen.getAllByRole("button", { name: "chat.useTemplate" })[0]!);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("chat.placeholder")).toHaveValue("resumen alertas hoy");
    });

    expect(screen.queryByRole("button", { name: "chat.useTemplate" })).not.toBeInTheDocument();
  });

  it("falls back to draft-only chat when session history is unavailable", async () => {
    mockedGetHealth.mockResolvedValue({
      status: "ok",
      version: "0.2.33",
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
    mockedGetChatSessions.mockRejectedValue(
      new Error("API error 404: Route GET:/api/v1/chat/sessions not found")
    );

    render(<ChatWidget />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "chat.openChat" }));
    });

    await waitFor(() => {
      expect(screen.getByText("chat.emptyState")).toBeInTheDocument();
    });

    expect(screen.queryByText("chat.sessionsTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("API error 404: Route GET:/api/v1/chat/sessions not found")).not.toBeInTheDocument();
  });
});
