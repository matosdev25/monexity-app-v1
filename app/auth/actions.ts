"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import { getCurrentUserAppEntryPath } from "../../lib/memberships/app-access";

import type { ForgotPasswordState, SignUpState, SignInState } from "./types";

const FULL_NAME_REGEX = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;
const USERNAME_REGEX = /^[a-z0-9._]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PANAMA_PHONE_REGEX = /^6\d{3}-\d{4}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,72}$/;

function normalizeText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function normalizePanamaPhoneForDB(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!/^6\d{7}$/.test(digits)) return null;
  return `+507 ${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://www.monexity-app.com"
  ).replace(/\/+$/, "");
}

export async function signUp(
  prevState: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  void prevState;

  const adminClient = createAdminClient();

  const fullName = normalizeText(formData.get("fullName"));
  const username = normalizeText(formData.get("username")).toLowerCase();
  const email = normalizeText(formData.get("email")).toLowerCase();
  const phone = normalizeText(formData.get("phone"));
  const password = normalizeText(formData.get("password"));

  const fieldErrors: SignUpState["fieldErrors"] = {};

  if (!fullName || fullName.length < 3 || fullName.length > 120) {
    fieldErrors.fullName = "El nombre debe tener entre 3 y 120 caracteres.";
  } else if (!FULL_NAME_REGEX.test(fullName)) {
    fieldErrors.fullName = "El nombre solo puede contener letras y espacios.";
  }

  if (!username || username.length < 3 || username.length > 20) {
    fieldErrors.username = "El nombre de usuario debe tener entre 3 y 20 caracteres.";
  } else if (!USERNAME_REGEX.test(username)) {
    fieldErrors.username = "Solo puede tener letras, números, punto y guion bajo.";
  }

  if (!email || email.length > 120) {
    fieldErrors.email = "Debes ingresar un correo válido.";
  } else if (!EMAIL_REGEX.test(email)) {
    fieldErrors.email = "El correo electrónico no es válido.";
  }

  const normalizedPhone = normalizePanamaPhoneForDB(phone);
  if (!phone) {
    fieldErrors.phone = "Debes ingresar tu número de teléfono.";
  } else if (!PANAMA_PHONE_REGEX.test(phone) || !normalizedPhone) {
    fieldErrors.phone = "Ingresa un número válido de Panamá, ejemplo: 6123-4567.";
  }

  if (!password || password.length < 8 || password.length > 72) {
    fieldErrors.password = "La contraseña debe tener entre 8 y 72 caracteres.";
  } else if (!PASSWORD_REGEX.test(password)) {
    fieldErrors.password = "Debe incluir una mayúscula, una minúscula y un número.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  const phoneToStore = normalizedPhone as string;

  const { data: existingUsername, error: usernameError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("username", username)
    .limit(1)
    .maybeSingle();

  if (usernameError) {
    return { success: false, formError: "No se pudo validar el nombre de usuario." };
  }

  if (existingUsername) {
    return { success: false, fieldErrors: { username: "Ese nombre de usuario ya está en uso." } };
  }

  const { data: existingEmail } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .limit(1)
    .maybeSingle();

  if (existingEmail) {
    return { success: false, fieldErrors: { email: "Ese correo ya está registrado." } };
  }

  // Guardar datos en cookie — la creación real del usuario ocurre durante el onboarding
  const pendingPayload = Buffer.from(
    JSON.stringify({ fn: fullName, un: username, em: email, ph: phoneToStore, pw: password })
  ).toString("base64");

  const cookieStore = await cookies();
  cookieStore.set("pending_signup", pendingPayload, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 30,
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/onboarding");
}

export async function signIn(
  prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  void prevState;

  const supabase = await createClient();
  const adminClient = createAdminClient();

  const identifier = normalizeText(formData.get("identifier")).toLowerCase();
  const password = normalizeText(formData.get("password"));

  const fieldErrors: SignInState["fieldErrors"] = {};

  if (!identifier) fieldErrors.identifier = "Debes ingresar tu correo o nombre de usuario.";
  if (!password) fieldErrors.password = "Debes ingresar tu contraseña.";

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  let emailToUse = identifier;
  const looksLikeEmail = EMAIL_REGEX.test(identifier);

  if (!looksLikeEmail) {
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("email")
      .eq("username", identifier)
      .limit(1)
      .maybeSingle();

    if (profileError) return { success: false, formError: "No se pudo validar el usuario." };
    if (!profile?.email) return { success: false, formError: "Credenciales incorrectas." };

    emailToUse = String(profile.email).toLowerCase();
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email: emailToUse, password });

  if (error) return { success: false, formError: "Credenciales incorrectas." };

  revalidatePath("/dashboard");
  return {
    success: true,
    redirectTo: await getCurrentUserAppEntryPath(
      data.user ? { id: data.user.id, email: data.user.email } : undefined
    ),
  };
}

export async function requestPasswordReset(
  prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  void prevState;

  const supabase = await createClient();
  const email = normalizeText(formData.get("email")).toLowerCase();

  const fieldErrors: ForgotPasswordState["fieldErrors"] = {};

  if (!email || email.length > 120) {
    fieldErrors.email = "Debes ingresar un correo válido.";
  } else if (!EMAIL_REGEX.test(email)) {
    fieldErrors.email = "El correo electrónico no es válido.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAppUrl()}/auth/update-password`,
  });

  return { success: true, fieldErrors: {} };
}

export async function signOut() {
  const supabase = await createClient();
  const cookieStore = await cookies();

  try {
    await supabase.auth.signOut();
  } catch {
    // Si la sesión ya expiró, igual limpiamos cookies propias y salimos.
  }

  cookieStore.delete("active_company_id");
  cookieStore.delete("pending_signup");

  revalidatePath("/");
  redirect("/");
}
