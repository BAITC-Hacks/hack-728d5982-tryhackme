import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
const maxBody = 26_000_000;
type Context = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, { params }: Context) {
  const { path } = await params;
  if (path.some((part) => !/^[a-z0-9_-]+$/i.test(part))) {
    return Response.json({ detail: "Некорректный путь запроса." }, { status: 400 });
  }
  // Validate browser origin before translating it; FastAPI still checks CSRF.
  const origin = request.headers.get("origin");
  // Next.js may construct nextUrl with an internal hostname (e.g. localhost).
  // Host is the browser-facing authority; do not trust X-Forwarded-Host here.
  const publicOrigin = `${request.nextUrl.protocol}//${request.headers.get("host")}`;
  if (request.method !== "GET" && origin && origin !== publicOrigin) {
    return Response.json({ detail: "Чужой источник запроса." }, { status: 403 });
  }
  if (Number(request.headers.get("content-length")) > maxBody) {
    return Response.json(
      { detail: "Отправьте файлы по отдельности: превышен размер." },
      { status: 413 },
    );
  }
  const backend = new URL(process.env.ASSISTANT_API_URL || "http://127.0.0.1:8765");
  const target = new URL(`/api/${path.join("/")}${request.nextUrl.search}`, backend);
  const headers = new Headers();
  for (const name of ["cookie", "x-csrf-token", "content-type"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (origin) headers.set("origin", backend.origin);
  try {
    const body = request.method === "GET" ? undefined : await request.arrayBuffer();
    if (body && body.byteLength > maxBody) {
      return Response.json({ detail: "Превышен общий размер вложений." }, { status: 413 });
    }
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(80_000),
      redirect: "manual",
    });
    const resultHeaders = new Headers({
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    for (const cookie of upstream.headers.getSetCookie()) {
      resultHeaders.append(
        "Set-Cookie",
        request.nextUrl.protocol === "https:" && !/;\s*secure/i.test(cookie)
          ? `${cookie}; Secure`
          : cookie,
      );
    }
    return new Response(upstream.body, { status: upstream.status, headers: resultHeaders });
  } catch {
    return Response.json(
      { detail: "Сервис временно недоступен. Повторите запрос или свяжитесь с менеджером." },
      { status: 502 },
    );
  }
}

export { proxy as GET, proxy as POST };
