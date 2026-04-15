import { withAuth } from "next-auth/middleware";

// Protects everything except /login, /track (public customer page), and auth API.
export default withAuth({
  pages: { signIn: "/login" }
});

export const config = {
  matcher: ["/((?!api/auth|login|track|_next/static|_next/image|favicon.ico).*)"]
};
