// TODO: Define shared SDK types mirroring API response shapes
export interface ApiResponse<T> {
  data: T;
  error?: string;
}
