"use client";

import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import type { AppData } from "./types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const cloudEnabled = !!(URL && KEY);

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!cloudEnabled) return null;
  client ??= createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

export async function getSession(): Promise<Session | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function signUp(email: string, password: string) {
  const sb = supabase();
  if (!sb) return { error: "Accounts are not set up on this copy. Your data stays on this device." };
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) return { error: error.message };
  if (!data.session) return { notice: "Check your email to confirm, then sign in." };
  return {};
}

export async function signIn(email: string, password: string) {
  const sb = supabase();
  if (!sb) return { error: "Accounts are not set up on this copy. Your data stays on this device." };
  const { error } = await sb.auth.signInWithPassword({ email, password });
  return error ? { error: error.message } : {};
}

export async function signInGoogle() {
  const sb = supabase();
  if (!sb) return { error: "Accounts are not set up on this copy. Your data stays on this device." };
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  return error ? { error: error.message } : {};
}

export async function signOut() {
  await supabase()?.auth.signOut();
}

export async function pull(): Promise<{ data: AppData; updatedAt: number } | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb.from("snapshots").select("data, updated_at").maybeSingle();
  if (error || !data) return null;
  return { data: data.data as AppData, updatedAt: new Date(data.updated_at).getTime() };
}

export async function push(userId: string, d: AppData) {
  const sb = supabase();
  if (!sb) return false;
  const { error } = await sb.from("snapshots").upsert({ user_id: userId, data: d, updated_at: new Date(d.updatedAt || Date.now()).toISOString() });
  return !error;
}
