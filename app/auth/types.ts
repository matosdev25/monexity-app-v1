export type SignUpState = {
  success: boolean;
  formError?: string;
  fieldErrors?: {
    fullName?: string;
    username?: string;
    email?: string;
    phone?: string;
    password?: string;
  };
};

export type SignInState = {
  success: boolean;
  redirectTo?: string;
  formError?: string;
  fieldErrors?: {
    identifier?: string;
    password?: string;
  };
};

export type ForgotPasswordState = {
  success: boolean;
  formError?: string;
  fieldErrors?: {
    email?: string;
  };
};
