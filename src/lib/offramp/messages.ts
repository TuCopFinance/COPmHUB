/**
 * TuCOPRamp answers errors in English with a stable `code`. The form shows
 * its own Spanish copy for the codes a person can do something about.
 */
const MESSAGES: Record<string, string> = {
  invalid_credentials: "El código no es válido o ya venció. Pide uno nuevo.",
  invalid_token: "Tu sesión venció. Confirma tu correo de nuevo.",
  email_not_sent: "No pudimos enviar el correo. Intenta de nuevo en unos minutos.",
  rate_limited_email: "Pediste demasiados códigos. Intenta de nuevo en 15 minutos.",
  rate_limited_ip: "Demasiados intentos. Espera unos minutos e intenta de nuevo.",
  rate_limited_user: "Demasiados intentos. Espera unos minutos e intenta de nuevo.",
  consent_required: "Debes autorizar el tratamiento de tus datos para continuar.",
  invalid_name: "Escribe tu nombre completo, como aparece en tu documento.",
  invalid_document: "El número de documento no es válido para ese tipo de documento.",
  document_already_registered:
    "Ese documento ya está preinscrito con otro correo. Ingresa con ese correo.",
  kyc_not_approved: "Tu verificación de identidad aún no está aprobada.",
  kyc_name_missing: "Aún no tenemos tu nombre verificado. Intenta de nuevo en unos minutos.",
  invalid_key: "Escribe una llave Bre-B válida.",
  destination_rejected:
    "No pudimos validar esa llave Bre-B a tu nombre. Revisa que esté bien escrita y que la cuenta sea tuya: no se aceptan cuentas de terceros.",
  destination_validation_timeout:
    "El banco aún no responde por esa llave. Espera un minuto e intenta de nuevo.",
  already_verified: "Ya registraste tu llave Bre-B.",
  nothing_to_confirm: "No hay una llave por confirmar.",
};

export const GENERIC_ERROR = "Algo salió mal. Intenta de nuevo.";
export const SESSION_EXPIRED_CODE = "invalid_token";

export function offrampErrorMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || GENERIC_ERROR;
}

/** Identity documents TuCOPRamp accepts, in the order the form lists them. */
export const DOCUMENT_TYPES = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "PAS", label: "Pasaporte" },
  { value: "TI", label: "Tarjeta de identidad" },
  { value: "NUIP", label: "NUIP" },
] as const;
