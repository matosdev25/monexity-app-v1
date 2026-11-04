"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import { getCurrentUserAppEntryPath } from "../../lib/memberships/app-access";
import { PRIVACY_VERSION, TERMS_VERSION } from "../../lib/legal/versions";
import {
  PENDING_SIGNUP_COOKIE,
  PENDING_SIGNUP_DELETE_OPTIONS,
  PENDING_SIGNUP_MAX_AGE_SECONDS,
  PENDING_SIGNUP_PATH,
  sealPendingSignup,
} from "../../lib/auth/pending-signup";

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
  const acceptedLegal = formData.get("acceptLegal") === "yes";

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

  if (!acceptedLegal) {
    fieldErrors.acceptLegal = "Debes aceptar los Términos de uso y la Política de privacidad.";
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

  // La contraseña solo viaja aquí, una vez, a Supabase Auth. Si la confirmación de
  // correo está desactivada, el cliente SSR guarda la sesión y el onboarding la usa.
  const supabase = await createClient();
  const acceptedAt = new Date().toISOString();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, username, phone: phoneToStore },
    },
  });

  if (signUpError) {
    if (signUpError.code === "user_already_exists" || signUpError.code === "email_exists") {
      return { success: false, fieldErrors: { email: "Ese correo ya está registrado." } };
    }
    if (signUpError.code === "over_email_send_rate_limit" || signUpError.status === 429) {
      return { success: false, formError: "Demasiados intentos. Espera unos minutos e intenta de nuevo." };
    }
    if (signUpError.code === "weak_password") {
      return { success: false, fieldErrors: { password: "Elige una contraseña más segura." } };
    }
    return { success: false, formError: "No se pudo crear la cuenta. Intenta de nuevo." };
  }

  const newUser = signUpData.user;
  // Con confirmación activa, un correo ya confirmado devuelve un usuario ofuscado
  // sin identidades: no es una cuenta nueva y no se toca su perfil.
  if (!newUser || (newUser.identities && newUser.identities.length === 0)) {
    return { success: false, fieldErrors: { email: "Ese correo ya está registrado." } };
  }

  const userId = newUser.id;

  const rollback = async (formError: string): Promise<SignUpState> => {
    await adminClient.auth.admin.deleteUser(userId).catch(() => undefined);
    if (signUpData.session) {
      await supabase.auth.signOut().catch(() => undefined);
    }
    return { success: false, formError };
  };

  const { error: profileError } = await adminClient.from("profiles").upsert(
    { id: userId, full_name: fullName, email, username, phone: phoneToStore },
    { onConflict: "id" }
  );
  if (profileError) {
    return rollback("No se pudo guardar el perfil. Intenta de nuevo.");
  }

  // Aceptación de Términos y Privacidad: user_id de Auth, fecha y versiones del servidor.
  const { error: legalError } = await adminClient.from("user_legal_acceptances").insert({
    user_id: userId,
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
    accepted_at: acceptedAt,
  });
  if (legalError) {
    return rollback("No se pudo registrar la aceptación de los términos. Intenta de nuevo.");
  }

  const cookieStore = await cookies();
  if (!signUpData.session) {
    // Sin sesión hasta confirmar el correo: solo el userId, cifrado y con expiración.
    const pendingPayload = sealPendingSignup({ userId });
    if (!pendingPayload) {
      return rollback("No se pudo iniciar el registro. Intenta de nuevo.");
    }
    cookieStore.set(PENDING_SIGNUP_COOKIE, pendingPayload, {
      path: PENDING_SIGNUP_PATH,
      httpOnly: true,
      sameSite: "lax",
      maxAge: PENDING_SIGNUP_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
  } else {
    cookieStore.delete(PENDING_SIGNUP_DELETE_OPTIONS);
  }

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
  cookieStore.delete(PENDING_SIGNUP_DELETE_OPTIONS);

  revalidatePath("/");
  redirect("/");
}
