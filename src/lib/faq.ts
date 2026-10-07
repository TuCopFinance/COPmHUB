export type FaqItem = {
  question: string;
  answer: string;
};

/** Shown on the home page only while the off-ramp is enabled. */
export const OFFRAMP_FAQ: FaqItem = {
  question: "¿Puedo retirar a pesos en mi cuenta bancaria?",
  answer:
    "Sí, con el off-ramp a llaves Bre-B que opera TuCOP. Verificas tu identidad una vez, registras una llave Bre-B a tu nombre y recibes una dirección de liquidación propia. Este hub solo aloja el formulario: no custodia fondos ni guarda tus datos. La comisión y el mínimo por envío se muestran al activar.",
};

export const HOME_FAQ: FaqItem[] = [
  {
    question: "¿Qué es DigitalCOP?",
    answer:
      "DigitalCOP es el hub de servicios de pesos digitales en Colombia. Reúne una billetera (TuCop), un marketplace para comprar pesos con tarjeta (Cards), conversión de dólares a pesos (COP By) y rendimiento (Neeru, un partner). No es un banco ni un depósito de valores.",
  },
  {
    question: "¿Qué son los pesos digitales que usa DigitalCOP?",
    answer:
      "Son pesos que se guardan y se mueven en una billetera digital compatible en tu celular. Esta página no afirma una paridad 1:1 con el peso en efectivo ni un respaldo bancario: esa información la publica cada emisor. No son efectivo ni un saldo en un banco tradicional. Detalles en la sección 'Qué son los pesos digitales'.",
  },
  {
    question: "¿Puedo invertir en pesos digitales?",
    answer:
      "Puedes explorar rendimiento en pesos digitales a través de Neeru, un producto partner. No es un CDT, no hay tasa fija publicada en este hub y el capital puede bajar. No es un consejo de inversión.",
  },
  {
    question: "¿Cómo cambio dólares a pesos en MiniPay?",
    answer:
      "COP By convierte dólares a pesos digitales dentro de MiniPay. El tipo de cambio y los límites se muestran en la app al convertir. DigitalCOP no opera el motor de cambio: enlazamos el producto.",
  },
  {
    question: "¿Esto es un carry trade del peso colombiano?",
    answer:
      "Puedes convertir dólares a pesos digitales y dejar el saldo en un producto de rendimiento. Se parece a un carry, pero incluye riesgo de tipo de cambio, riesgo técnico y riesgo del producto. No hay retorno garantizado.",
  },
  {
    question: "¿Los pesos digitales son legales en Colombia?",
    answer:
      "En Colombia los pesos digitales no son moneda de curso legal, pero su uso no está prohibido. Las reglas de reporte y de proveedores de servicios cambian. Esto no es asesoría legal ni tributaria: consulta un profesional y las normas vigentes de la DIAN y la Superintendencia Financiera.",
  },
  {
    question: "¿Necesito MiniPay o me sirve TuCop?",
    answer:
      "Puedes entrar por MiniPay o por TuCop. Cards entrega los pesos a la billetera que indiques al reclamar. COP By funciona dentro de MiniPay. Elige la puerta que ya uses.",
  },
  {
    question: "¿Qué fees hay?",
    answer:
      "En Cards, la plataforma cobra 1% sobre el monto más los costos de pago (e IVA cuando aplique). El total aparece en el checkout antes de pagar. COP By y Neeru muestran sus propias condiciones en sus sitios. Este hub no añade un fee extra por listar los servicios.",
  },
];
