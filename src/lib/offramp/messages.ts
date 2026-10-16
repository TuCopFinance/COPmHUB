/**
 * TuCOPRamp answers errors in English with a stable `code`. The form shows
 * its own Spanish copy for the codes a person can do something about.
 */
const MESSAGES: Record<string, string> = {
  // Sign-in
  invalid_body: "Revisa los datos e intenta de nuevo.",
  invalid_code: "El código no es válido o ya venció. Pide uno nuevo.",
  email_not_sent: "No pudimos enviar el correo. Intenta de nuevo en unos minutos.",
  party_session_required: "Tu sesión venció. Confirma tu correo de nuevo.",
  party_session_invalid: "Tu sesión venció. Confirma tu correo de nuevo.",
  party_required: "Primero completa tus datos.",
  party_not_linked: "Debes autorizar de nuevo el tratamiento de tus datos para continuar.",
  // Registration
  invalid_name: "Escribe tu nombre completo, como aparece en tu documento.",
  invalid_document: "El número de documento no es válido para ese tipo de documento.",
  document_already_registered:
    "Ese documento ya está registrado con otro correo. Ingresa con ese correo.",
  party_identity_not_proven:
    "Ese documento ya está registrado con otro correo. Ingresa con el correo que usaste antes o escríbenos.",
  invalid_consent: "Debes autorizar el tratamiento de tus datos para continuar.",
  redirect_url_not_allowed:
    "No pudimos iniciar la verificación desde este sitio. Escríbenos para revisarlo.",
  // Identity
  kyc_not_approved: "Tu verificación de identidad aún no está aprobada.",
  party_not_verified: "Tu verificación de identidad aún no está aprobada.",
  kyc_name_missing: "Aún no tenemos tu nombre verificado. Intenta de nuevo en unos minutos.",
  party_restricted: "Por ahora tu cuenta no puede usar este servicio. Escríbenos para revisarlo.",
  // Bre-B key
  invalid_bre_b_key: "Escribe una llave Bre-B válida.",
  destination_invalid: "El banco no reconoce esa llave Bre-B. Revisa que esté bien escrita.",
  destination_rejected:
    "No pudimos validar esa llave Bre-B a tu nombre. Revisa que esté bien escrita y que la cuenta sea tuya: no se aceptan cuentas de terceros.",
  destination_not_verified:
    "Tu llave Bre-B aún se está validando. Espera un momento e intenta de nuevo.",
  destination_not_found: "No encontramos esa llave Bre-B. Regístrala de nuevo.",
  destination_in_use:
    "Esa llave tiene una dirección de liquidación activa. Deshabilita la dirección antes de quitar la llave.",
  destination_limit_reached:
    "Llegaste al máximo de llaves Bre-B activas. Quita una para agregar otra.",
  // Wallet
  invalid_wallet_address: "Esa dirección de billetera no es válida.",
  invalid_return_address: "Esa dirección de billetera no es válida.",
  wallet_address_required: "Escribe la dirección de tu billetera en la red Celo.",
  return_address_required: "Escribe la dirección de tu billetera en la red Celo.",
  // Quote and payouts
  amount_below_minimum: "El monto es menor al mínimo por envío.",
  amount_not_settleable: "Escribe el monto en pesos enteros.",
  invalid_amount: "Escribe un monto válido en pesos.",
  rate_unavailable: "No pudimos consultar la tasa de cambio. Intenta de nuevo en unos minutos.",
  withdrawal_not_found: "No encontramos tu dirección de liquidación.",
  destination_not_first_party: "Esa llave no es tuya: solo puedes usar cuentas a tu nombre.",
  first_party_not_available: "Esta cuenta no puede registrar llaves propias. Escríbenos.",
  deposit_not_found: "No encontramos tu llave de compra.",
  idempotency_in_progress: "Tu solicitud anterior aún se está procesando. Espera un momento.",
  // Provider
  provider_rejected:
    "Nuestro proveedor no pudo crear tu dirección. Intenta de nuevo más tarde o escríbenos.",
  provider_unavailable: "Nuestro proveedor no responde. Intenta de nuevo en unos minutos.",
  ramp_unreachable: "No pudimos conectarnos. Intenta de nuevo en unos minutos.",
  product_not_enabled: "Este servicio no está disponible por ahora.",
};

const RATE_LIMITED = "Demasiados intentos. Espera unos minutos e intenta de nuevo.";

export const GENERIC_ERROR = "Algo salió mal. Intenta de nuevo.";

/** Codes that mean the person has to confirm their email again. */
export const SESSION_CODES = new Set(["party_session_required", "party_session_invalid"]);

export function offrampErrorMessage(code: string | undefined): string {
  if (code && code.startsWith("rate_limited")) return RATE_LIMITED;
  return (code && MESSAGES[code]) || GENERIC_ERROR;
}

/** Spanish names for the identity documents TuCOPRamp lists for Colombia. */
export const DOCUMENT_LABELS: Record<string, string> = {
  CC: "Cédula de ciudadanía",
  CE: "Cédula de extranjería",
  PAS: "Pasaporte",
  TI: "Tarjeta de identidad",
  NUIP: "NUIP",
};

/**
 * Bridge onboards adults only, so the tarjeta de identidad (under 18) is
 * never offered, even if the ramp still lists it.
 */
export function isOfferedDocument(code: string): boolean {
  return code.toUpperCase() !== "TI";
}

/** Used until GET /v1/document-types answers, or if it does not. */
export const DOCUMENT_TYPES = [
  { value: "CC", label: DOCUMENT_LABELS.CC },
  { value: "CE", label: DOCUMENT_LABELS.CE },
  { value: "PAS", label: DOCUMENT_LABELS.PAS },
  { value: "NUIP", label: DOCUMENT_LABELS.NUIP },
] as const;

/** Why the Bre-B directory refused a key. */
export const DESTINATION_REJECTION: Record<string, string> = {
  directory_no_match: "El directorio Bre-B no encontró esa llave.",
  holder_name_mismatch: "La cuenta de esa llave no está a tu nombre.",
  holder_document_mismatch: "La cuenta de esa llave no está a tu número de documento.",
  verification_timeout: "El banco no respondió a tiempo.",
};
