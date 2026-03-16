// TODO: Implement CIG SDK client with methods for all API endpoints
export interface CigClientOptions {
  baseUrl: string;
  apiKey?: string;
}

export class CigClient {
  constructor(private readonly options: CigClientOptions) {}
  // TODO: Add discovery, graph, chatbot, and agent methods
}
