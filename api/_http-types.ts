export type HttpRequest = {
  method?: string;
  body?: unknown;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
};

export type HttpResponse = {
  setHeader(name: string, value: number | string | string[]): void;
  status(code: number): HttpResponse;
  json(payload: unknown): HttpResponse;
  send(payload: unknown): HttpResponse;
  end(payload?: unknown): void;
};
