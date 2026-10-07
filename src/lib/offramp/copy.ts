import { OFFRAMP_PATH } from "./config";

/** Token-agnostic on purpose: the headline never names a token or network. */
export const OFFRAMP_COPY = {
  tag: "Off-ramp",
  title: "Off-ramp a llaves Bre-B en Colombia",
  body: "Verifica tu identidad una sola vez, registra tu llave Bre-B y recibe tu dirección para retirar a pesos directo a tu cuenta.",
  cta: "Activar mi off-ramp",
  href: OFFRAMP_PATH,
} as const;
