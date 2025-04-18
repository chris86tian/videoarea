import type {
  Authenticator,
  AuthenticatorConfig,
} from "remix-auth";
import { Authenticator as RemixAuthenticator } from "remix-auth";
import { createCookieSessionStorage } from "@remix-run/node";
import { SupabaseStrategy } from "remix-auth-supabase";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "./db.server";
import type { User } from "@prisma/client";

// This is the type of the user object that will be stored in the session
export type AuthUser = User;

// This is the session storage that will be used by the authenticator
export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "_session", // use any name you want here
    sameSite: "lax", // this helps with CSRF
    path: "/", // the cookie is available on all paths
    httpOnly: true, // only server-side JavaScript can access the cookie
    secrets: [process.env.SESSION_SECRET || "s3cret"], // replace this with your own secret
    secure: process.env.NODE_ENV === "production", // enable this in production
  },
});

// You can also use the Authenticator without a custom type
export const authenticator: Authenticator<AuthUser> = new RemixAuthenticator<AuthUser>(sessionStorage);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

authenticator.use(
  new SupabaseStrategy(
    {
      supabaseClient: supabase,
      sessionStorage,
      sessionKey: "supabaseSession", // if you want to use a different name for the session key in the cookie
      sessionErrorKey: "supabaseSessionError", // if you want to use a different name for the error key in the cookie
    },
    async ({ req, supabaseClient }) => {
      const form = await req.formData();
      const email = form.get("email");
      const password = form.get("password");

      if (!email || typeof email !== "string") {
        throw new Error("Email is required");
      }
      if (!password || typeof password !== "string") {
        throw new Error("Password is required");
      }

      // Sign in with email and password
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        throw new Error(error?.message || "Invalid credentials");
      }

      // Sync Supabase user with Prisma user
      let user = await prisma.user.findUnique({
        where: { id: data.user.id },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.name,
            image: data.user.user_metadata?.avatar_url,
            emailVerified: data.user.email_confirmed_at ? new Date(data.user.email_confirmed_at) : null,
            role: data.user.user_metadata?.role || "user", // Assuming role is stored in user_metadata
          },
        });
      } else {
         // Optional: Update user data if it changed in Supabase
         await prisma.user.update({
            where: { id: user.id },
            data: {
              name: data.user.user_metadata?.name,
              image: data.user.user_metadata?.avatar_url,
              emailVerified: data.user.email_confirmed_at ? new Date(data.user.email_confirmed_at) : null,
              role: data.user.user_metadata?.role || user.role,
            },
         });
      }


      // Return the Prisma user object
      return user;
    }
  ),
  "supabase" // this is the name of the strategy
);

// Helper function to get the authenticated user
export async function requireUser(request: Request): Promise<AuthUser> {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login", // Redirect to login if not authenticated
  });
  return user;
}

// Helper function to get the authenticated user without redirecting
export async function getUser(request: Request): Promise<AuthUser | null> {
  const user = await authenticator.isAuthenticated(request);
  return user;
}

// Helper function to check if the user is an admin
export async function requireAdmin(request: Request): Promise<AuthUser> {
  const user = await requireUser(request);
  if (user.role !== "admin") {
    throw new Response("Unauthorized", { status: 401 }); // Or redirect to a different page
  }
  return user;
}
