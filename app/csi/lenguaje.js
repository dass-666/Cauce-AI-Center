// CSI fase 2 · detectores de lenguaje (deterministas, sin IA). Son una red de seguridad, no un juez: encuentran
// palabras que suelen delatar un salto indebido (estados psicológicos, intenciones privadas, coordinación secreta,
// estrategias financieras privadas). Un falso positivo se resuelve reescribiendo el texto como declaración atribuida.

const normal = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const busca = (lista) => (t) => { const n = normal(t); return lista.filter(([, re]) => re.test(n)).map(([k]) => k); };

/** Estados psicológicos atribuidos a alguien (bloque 3: no se atribuyen a líderes ni instituciones reales). */
export const buscarPsicologia = busca([
  ["miedo", /\b(miedo|temor|teme|temia|temian|temen|asustad[oa]s?)\b/],
  ["panico", /\bpanico\b/],
  ["nervios", /\b(nervios[oa]s?|ansios[oa]s?|ansiedad|angusti[a-z]*)\b/],
  ["ira", /\b(furi[ao]s?|furios[oa]s?|enfadad[oa]s?|rabia|odio|odia(ba|n)?|venganza|vengar(se)?)\b/],
  ["codicia", /\b(codicia|codicios[oa]s?|avaricia|ego|egolatr[a-z]*|vanidad)\b/],
  ["desesperacion", /\b(desesperad[oa]s?|desesperacion|obsesionad[oa]s?|obsesion)\b/],
  ["humillacion", /\b(humillad[oa]s?|humillacion|orgullo herido)\b/],
]);

/** Intenciones privadas o motivos ocultos (solo un documento del propio actor las sostiene). */
export const buscarIntencion = busca([
  ["en_secreto", /\b(en secreto|secretamente|a escondidas|ocultamente|de forma oculta)\b/],
  ["deliberadamente", /\b(deliberadamente|a proposito|adrede|intencionadamente)\b/],
  ["queria", /\b(queria|pretendia|buscaba|se proponia|planeo|planeaba|tramaba|su verdadera intencion|su objetivo real)\b/],
]);

/** Coordinación secreta o control total (bloque 3: una relación pública no prueba coordinación). */
export const buscarCoordinacion = busca([
  ["coordinacion_secreta", /\b(coordinacion|acuerdo|pacto) (secret[oa]|ocult[oa]|tacit[oa])\b/],
  ["conspiracion", /\b(conspir[a-z]*|complot|colusion|confabula[a-z]*)\b/],
  ["control_total", /\b(controla(n)? todo|mueve(n)? los hilos|titiritero|mano negra|poder en la sombra)\b/],
]);

/** Estrategias financieras privadas (bloque 8: no se envían a Nexus). */
export const buscarEstrategiaFinanciera = busca([
  // Solo la recomendación o la operación propia: describir que un banco central compró divisas NO es estrategia privada.
  ["orden", /\b(deberia(mos)?|conviene|recomiendo|vamos a|hay que|voy a|compremos|vendamos)\b.{0,20}\b(comprar|vender|ponerse corto|ponernos cortos|ponerse largo|apalancar(se|nos)?|cubrir(se|nos)?)\b/],
  ["parametros", /\b(stop[- ]?loss|take[- ]?profit|orden limite|precio de entrada|precio objetivo)\b/],
  ["cartera_personal", /\b(mi cartera|mi cuenta|mis posiciones|mi broker|mi portafolio|nuestra cartera|nuestras posiciones)\b/],
  ["apuesta", /\b(apostar|apuesta|momio|casa de apuestas)\b/],
]);

/** Une los detectores en un informe por texto. */
export function revisarLenguaje(t) {
  return { psicologia: buscarPsicologia(t), intencion: buscarIntencion(t), coordinacion: buscarCoordinacion(t), finanzas: buscarEstrategiaFinanciera(t) };
}
