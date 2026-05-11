import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/media-metrics") {
    return NextResponse.next();
  }

  const password = process.env.DASHBOARD_PASSWORD;
  const user = process.env.DASHBOARD_USER || "admin";

  if (!password) {
    return NextResponse.json(
      { error: "Dashboard password is not configured." },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");

  if (auth?.startsWith("Basic ")) {
    const encoded = auth.slice("Basic ".length);
    const decoded = atob(encoded);
    const [providedUser, providedPassword] = decoded.split(":");

    if (providedUser === user && providedPassword === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Dashboard MMC"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
