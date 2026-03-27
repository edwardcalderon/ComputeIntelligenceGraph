import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { ChatVoiceDialog } from "../ChatVoiceDialog";

class MockMediaRecorder {
  public mimeType = "audio/webm";
  public state: "inactive" | "recording" = "inactive";
  private readonly listeners = new Map<string, Array<(event?: any) => void>>();

  addEventListener(type: string, listener: (event?: any) => void) {
    const next = this.listeners.get(type) ?? [];
    next.push(listener);
    this.listeners.set(type, next);
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    const dataListeners = this.listeners.get("dataavailable") ?? [];
    const stopListeners = this.listeners.get("stop") ?? [];
    const blob = new Blob(["voice"], { type: this.mimeType });

    for (const listener of dataListeners) {
      listener({ data: blob });
    }

    for (const listener of stopListeners) {
      listener();
    }
  }
}

describe("ChatVoiceDialog", () => {
  const originalMediaRecorder = globalThis.MediaRecorder;
  const originalMediaDevices = navigator.mediaDevices;

  beforeEach(() => {
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      writable: true,
      value: MockMediaRecorder,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      writable: true,
      value: originalMediaRecorder,
    });

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    });
  });

  it("starts listening immediately on open and defaults to write-to-chat mode", async () => {
    const stopTrack = jest.fn();
    const getUserMedia = jest.fn().mockResolvedValue({
      getTracks: () => [{ stop: stopTrack }],
    });

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    render(
      <ChatVoiceDialog
        open
        onClose={() => {}}
        onTranscribe={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    });

    expect(screen.getByText("Write to chat")).toBeInTheDocument();
    expect(screen.getByText("Send instantly")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop and write" })).toBeInTheDocument();
    expect(screen.getByText("Listening now")).toBeInTheDocument();
  });

  it("shows a product error when transcription is not deployed on the API", async () => {
    const getUserMedia = jest.fn().mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }],
    });

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    const onTranscribe = jest
      .fn()
      .mockRejectedValue(new Error("404 Not Found: /api/v1/chat/transcriptions"));

    render(<ChatVoiceDialog open onClose={() => {}} onTranscribe={onTranscribe} />);

    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Stop and write" }));
    });

    await waitFor(() => {
      expect(onTranscribe).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.getByText(
        "Voice transcription is not available on this API instance yet. Deploy the latest API runtime to enable it.",
      ),
    ).toBeInTheDocument();
  });
});
