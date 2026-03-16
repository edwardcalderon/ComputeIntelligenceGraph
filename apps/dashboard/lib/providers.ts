export const PROVIDER_COLORS: Record<string, string> = {
  aws: "#FF9900",
  gcp: "#4285F4",
  kubernetes: "#326CE5",
  docker: "#2496ED",
  default: "#6B7280",
};

export const PROVIDER_LABELS: Record<string, string> = {
  aws: "AWS",
  gcp: "GCP",
  kubernetes: "Kubernetes",
  docker: "Docker",
};

export function getProviderColor(provider: string): string {
  return PROVIDER_COLORS[provider.toLowerCase()] ?? PROVIDER_COLORS.default;
}

export function getProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider.toLowerCase()] ?? provider;
}
