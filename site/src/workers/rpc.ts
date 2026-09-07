export type WorkerResponse<T> =
  { id: number; ok: true; value: T } | { id: number; ok: false; error: string };

export function createWorkerClient<Request, Response>(
  createWorker: () => Worker,
): (request: Request) => Promise<Response> {
  let worker: Worker | undefined;
  let nextId = 0;
  const pending = new Map<
    number,
    { resolve: (value: Response) => void; reject: (error: Error) => void }
  >();

  function getWorker() {
    if (worker !== undefined) return worker;
    worker = createWorker();
    worker.addEventListener(
      "message",
      (event: MessageEvent<WorkerResponse<Response>>) => {
        const response = event.data;
        const promise = pending.get(response.id);
        if (promise === undefined) return;
        pending.delete(response.id);
        if (response.ok) promise.resolve(response.value);
        else promise.reject(new Error(response.error));
      },
    );
    worker.addEventListener("error", (event) => {
      const error = new Error(event.message || "The background worker failed");
      for (const promise of pending.values()) promise.reject(error);
      pending.clear();
      worker = undefined;
    });
    return worker;
  }

  return (request) =>
    new Promise<Response>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      getWorker().postMessage({ id, request });
    });
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
