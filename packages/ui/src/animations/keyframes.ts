"use client";

import React from "react";

// ─── Keyframe strings ─────────────────────────────────────────────────────────

export const CIG_KEYFRAMES = `
  @keyframes cig-scan {
    0%   { top: 0%;   opacity: 0; }
    8%   { opacity: 1; }
    92%  { opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes cig-glow-pulse {
    0%, 100% { opacity: 0.35; }
    50%       { opacity: 0.8;  }
  }
  @keyframes cig-float {
    0%, 100% { transform: translateY(0px);  }
    50%       { transform: translateY(-8px); }
  }
  @keyframes cig-scroll-left {
    from { transform: translateX(0);    }
    to   { transform: translateX(-50%); }
  }
  @keyframes cig-scroll-right {
    from { transform: translateX(-50%); }
    to   { transform: translateX(0);    }
  }
  @keyframes cig-fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes cig-slide-up {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes cig-slide-right {
    from { opacity: 0; transform: translateX(-16px); }
    to   { opacity: 1; transform: translateX(0);     }
  }
`;

/**
 * Drop `<CIGKeyframes />` once in your root layout to make all
 * CIG keyframes available globally.
 */
export function CIGKeyframes() {
  return React.createElement("style", null, CIG_KEYFRAMES);
}
