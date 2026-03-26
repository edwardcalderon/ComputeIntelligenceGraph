import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { ChatTemplatesTab } from "../ChatExamplesTab";

jest.mock("@cig-technology/i18n/react", () => ({
  useTranslation: () => (key: string) => key,
}));

jest.mock("@cig/ui", () => ({
  AlertCard: ({ title }: { title: string }) => <div data-testid="alert-card">{title}</div>,
  AlertStrip: () => <div data-testid="alert-strip" />,
  BarChartCard: ({ title }: { title: string }) => <div data-testid="bar-chart-card">{title}</div>,
  GaugeCard: ({ title }: { title: string }) => <div data-testid="gauge-card">{title}</div>,
  SparklineCard: ({ title }: { title: string }) => <div data-testid="sparkline-card">{title}</div>,
  TimelineCard: ({ title }: { title: string }) => <div data-testid="timeline-card">{title}</div>,
}));

describe("ChatTemplatesTab", () => {
  const requestAnimationFrameSpy = jest.spyOn(window, "requestAnimationFrame");
  const cancelAnimationFrameSpy = jest.spyOn(window, "cancelAnimationFrame");

  beforeEach(() => {
    requestAnimationFrameSpy.mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    cancelAnimationFrameSpy.mockImplementation(() => undefined);
  });

  afterEach(() => {
    requestAnimationFrameSpy.mockReset();
    cancelAnimationFrameSpy.mockReset();
  });

  it("shows mobile pagination dots and tracks the active template while scrolling", async () => {
    render(<ChatTemplatesTab onUseTemplate={jest.fn()} />);

    const carousel = screen.getByTestId("chat-templates-carousel");
    Object.defineProperty(carousel, "clientWidth", {
      configurable: true,
      value: 320,
    });
    Object.defineProperty(carousel, "scrollTo", {
      configurable: true,
      value: ({ left }: { left: number }) => {
        carousel.scrollLeft = left;
        carousel.dispatchEvent(new Event("scroll", { bubbles: true }));
      },
    });
    Object.defineProperty(carousel, "scrollBy", {
      configurable: true,
      value: ({ left }: { left: number }) => {
        carousel.scrollLeft += left;
        carousel.dispatchEvent(new Event("scroll", { bubbles: true }));
      },
    });

    const cards = carousel.querySelectorAll("article");
    cards.forEach((card, index) => {
      Object.defineProperty(card, "offsetLeft", {
        configurable: true,
        value: index * 320,
      });
      Object.defineProperty(card, "offsetWidth", {
        configurable: true,
        value: 320,
      });
    });

    const dots = screen.getAllByRole("button", { name: /go to template/i });
    expect(dots).toHaveLength(5);
    expect(dots[0]).toHaveAttribute("aria-current", "true");

    Object.defineProperty(carousel, "scrollLeft", {
      configurable: true,
      value: 320,
      writable: true,
    });

    await act(async () => {
      fireEvent.scroll(carousel);
    });

    await waitFor(() => {
      expect(dots[1]).toHaveAttribute("aria-current", "true");
    });

    fireEvent.click(dots[2]);

    await waitFor(() => {
      expect(dots[2]).toHaveAttribute("aria-current", "true");
    });
  });
});
