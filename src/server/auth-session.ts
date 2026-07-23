import { createClient, type Session, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const ACCESS_TOKEN_COOKIE = "trip-planner-access-token";
const REFRESH_TOKEN_COOKIE = "trip-planner-refresh-token";
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30;

type TokenPair = {
  accessToken: string | null;
  refreshToken: string | null;
};

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export async function getAuthenticatedUser(
  tokens: TokenPair,
): Promise<{ user: User | null; session: Session | null }> {
  const client = createSupabaseAuthClient();

  if (tokens.accessToken) {
    const { data, error } = await client.auth.getUser(tokens.accessToken);
    if (!error && data.user) {
      return { user: data.user, session: null };
    }
  }

  if (tokens.refreshToken) {
    const { data, error } = await client.auth.refreshSession({
      refresh_token: tokens.refreshToken,
    });
    if (!error && data.user && data.session) {
      return { user: data.user, session: data.session };
    }
  }

  return { user: null, session: null };
}

export function parseCookieHeader(
  cookieHeader: string | null,
): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!cookieHeader) {
    return cookies;
  }

  for (const chunk of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = chunk.trim().split("=");
    if (!rawName || rawValue.length === 0) continue;
    const decodedValue = decodeCookieValue(rawValue.join("="));
    if (decodedValue === null) continue;
    cookies.set(rawName, decodedValue);
  }

  return cookies;
}

export function readAuthTokensFromCookieHeader(
  cookieHeader: string | null,
): TokenPair {
  const cookies = parseCookieHeader(cookieHeader);

  return {
    accessToken: cookies.get(ACCESS_TOKEN_COOKIE) ?? null,
    refreshToken: cookies.get(REFRESH_TOKEN_COOKIE) ?? null,
  };
}

function decodeCookieValue(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function readAuthTokensFromCookieStore(
  cookieStore: CookieReader,
): TokenPair {
  return {
    accessToken: cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null,
    refreshToken: cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null,
  };
}

export function setAuthCookies(
  response: NextResponse,
  session: Session,
): NextResponse {
  response.cookies.set(ACCESS_TOKEN_COOKIE, session.access_token, {
    httpOnly: true,
    maxAge: session.expires_in,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, session.refresh_token, {
    httpOnly: true,
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<Session> {
  const client = createSupabaseAuthClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw new Error("Invalid email or password.");
  }

  return data.session;
}

export async function updateUserProfile(
  userId: string,
  updates: { username: string; profileColor: string },
): Promise<{ username: string; profileColor: string }> {
  const client = createSupabaseAuthClient();
  const { data, error } = await client.auth.admin.updateUserById(userId, {
    user_metadata: {
      username: updates.username,
      profile_color: updates.profileColor,
    },
  });

  if (error || !data.user) {
    throw new Error("Failed to update profile.");
  }

  return {
    username: updates.username,
    profileColor: updates.profileColor,
  };
}

function createSupabaseAuthClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() ??
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "Supabase backend requires SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
