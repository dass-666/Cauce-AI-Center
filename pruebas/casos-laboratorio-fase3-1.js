// Laboratorio de IA · fase 3.1: batería de respuestas SINTÉTICAS con los problemas habituales de un modelo, diagnóstico
// sin contenido, banco de comparación, y auditoría de persistencia y seguridad. Node y pruebas.html.
//
// TODAS las «respuestas del modelo» de aquí son SINTÉTICAS: las escribe la prueba a partir de la solicitud para provocar
// un problema concreto (JSON con explicación alrededor, cita parafraseada, respuesta cortada…). No son salidas de
// ninguna IA y no demuestran cómo responde Claude. Lo que se prueba es la distinción que hace el sistema:
//   · error de PRESENTACIÓN recuperable → se corrige la forma (y se declara) o se pide el texto otra vez;
//   · error SUSTANTIVO → se rechaza o lab-V lo marca; nunca se «arregla» una cita ni se inventa contenido.

import { prueba, igual, verdadero } from "./mini.js";
import { fichaDesdeEstado, comprobarExportacion } from "../app/laboratorio/motores.js";
import { nuevoTrabajo, validarTrabajo } from "../app/laboratorio/trabajo.js";
import { nuevoExpediente, avanzar, relojDesde, decidir } from "../app/laboratorio/coordinador.js";
import { crearAdaptadorManual, ADAPTADOR_SIN_MODELO } from "../app/laboratorio/adaptadores.js";
import { validarEjecucion } from "../app/laboratorio/contratos.js";
import { solicitudManual, continuarConRespuesta, importarRespuesta, extraerJSON, huellasImportadas, encargoEnEspera, ubicarErrorJSON, ETIQUETA_CORRECCION, CATEGORIAS_FALLO } from "../app/laboratorio/manual.js";
import { exportarExpediente, restaurarExpediente } from "../app/laboratorio/expediente.js";
import { diagnosticarExpediente, diagnosticoMarkdown, validarDiagnostico } from "../app/laboratorio/diagnostico.js";
import { medirExpediente, compararModelos, comparacionMarkdown, validarComparacion } from "../app/laboratorio/comparacion.js";
import { escenariosDemo } from "../app/laboratorio/escenarios-demo.js";
import { informeMarkdown } from "../app/laboratorio/informe.js";

const clon = (v) => JSON.parse(JSON.stringify(v));
const HUMANO = { tipo: "humano", identificador: "diego" };
const T0 = "2026-11-08T06:00:00Z";

export function registrarCasosLaboratorioFase31(leer) {
  const doc = async (m = "compago") => JSON.parse(await leer(`datos/demo/${m}.json`));
  /** Trabajo manual listo, esperando al Investigador. */
  const manual = async ({ id = "sint-1", es_demo = true, documento = null } = {}) => {
    const d = documento ?? await doc();
    const ficha = await fichaDesdeEstado(d, { leido_en: T0 });
    if (!ficha.ok) throw new Error(ficha.errores.join(" "));
    const t = nuevoTrabajo({ id: `${es_demo ? "demo-" : ""}lab-trb-${id}`, es_demo, titulo: "Consulta sintética", pregunta: "¿Qué problemas muestra la lectura?", origen: ficha.origen, solicitado_por: HUMANO, creado_en: T0, adaptador: { id: "manual-claude", modelo: null } });
    const x = nuevoExpediente(t, ficha), reloj = relojDesde(T0);
    await avanzar(x, { adaptador: crearAdaptadorManual(new Map()), reloj });
    return { x, reloj, ficha };
  };
  const linea = (ficha, re) => ficha.copia.texto.split("\n").find((l) => re.test(l));
  /** Respuesta SINTÉTICA correcta para el rol que espera (objeto, para alterarlo antes de serializar). */
  const base = async (x) => {
    const s = await solicitudManual(x), f = x.ficha.fuente.fuente_id, previa = [...x.ejecuciones.values()].at(-1)?.id;
    const r = { formato: "cauce.lab.respuesta-manual", version: "0.1", encargo_id: s.encargo_id, encargo_sha256: s.encargo_sha256, rol: s.rol, modelo_declarado: "respuesta sintética de prueba (no es un modelo)", preguntas: [], afirmaciones: [], hipotesis: [], objeciones: [], dudas: [], contradicciones: [], limitaciones: [], recomendaciones: [] };
    if (s.rol === "investigador") r.afirmaciones = [{ id: "a1", texto: "El Revisor está en error.", clase: "hecho_citado", citas: [{ fuente_id: f, extracto: linea(x.ficha, /«error»/), ubicacion: null }], se_basa_en: [] }];
    if (s.rol === "analista") { r.afirmaciones = [{ id: "n1", texto: "Puede retrasar la revisión.", clase: "inferencia", citas: [], se_basa_en: [`${previa}#a1`] }]; r.hipotesis = [{ id: "h1", enunciado: "Entrada mala.", se_refuta_si: "Otra entrada falla igual.", experimento: "Repetir con una entrada buena.", alternativa_a: null }]; r.recomendaciones = [{ id: "r1", texto: "Repetir la revisión con una entrada conocida.", se_basa_en: ["h1"] }]; }
    if (s.rol === "critico") r.objeciones = [{ id: "o1", a: `${previa}#n1`, tipo: "supuesto", texto: "Supone que el error persiste." }];
    return { r, s, f, previa };
  };
  const pegar = (x, reloj, texto, extra = {}) => continuarConRespuesta(x, texto, { declarado_por: "diego", modelo: "Modelo X (declarado en la prueba)", reloj, ahora: reloj(), ...extra });
  const completo = async (opc = {}) => { const m = await manual(opc); for (let i = 0; i < 3; i++) { const r = await pegar(m.x, m.reloj, JSON.stringify((await base(m.x)).r)); if (!r.ok) throw new Error(r.errores.join(" ")); } return m; };
  const ultimaImp = (x) => x.importaciones.at(-1);

  // ------------------------------------------------------------------ 1 · presentación recuperable (se corrige la forma y se declara)
  prueba("Lab 3.1 · sintético: JSON rodeado de explicación y de bloques Markdown se acepta; con varios bloques se elige el que trae el formato y queda registrado", async () => {
    const { x, reloj } = await manual();
    const { r } = await base(x);
    const texto = `Claro, aquí va mi análisis como Investigador.\n\nPrimero un ejemplo de la forma:\n\`\`\`json\n{"ejemplo": true}\n\`\`\`\n\nY la respuesta:\n\`\`\`json\n${JSON.stringify(r, null, 2)}\n\`\`\`\n\n¿Quieres que profundice en algo?`;
    const res = await pegar(x, reloj, texto);
    verdadero(res.ok, res.errores.join(" "));
    verdadero(res.correcciones.includes("bloque_elegido_entre_varios"));
    verdadero(res.avisos.some((a) => /texto fuera del JSON/.test(a)) && res.avisos.some((a) => /Correcciones de forma/.test(a)));
    const ej = [...x.ejecuciones.values()].at(-1);
    igual(ej.intercambio.correcciones, ["bloque_elegido_entre_varios"], "la corrección viaja en la ejecución (contrato 0.2, campo opcional)");
    verdadero(validarEjecucion(ej).ok, validarEjecucion(ej).errores.join(" "));
    igual(ultimaImp(x).correcciones, ["bloque_elegido_entre_varios"]);
    // una ejecución SIN el campo sigue validando (fase 3), y un valor inválido se rechaza
    const sin = clon(ej); delete sin.intercambio.correcciones; verdadero(validarEjecucion(sin).ok);
    const mal = clon(ej); mal.intercambio.correcciones = ["<script>"]; verdadero(!validarEjecucion(mal).ok);
    for (const c of Object.keys(ETIQUETA_CORRECCION)) verdadero(/^[a-z_]+$/.test(c));
  });

  prueba("Lab 3.1 · sintético: comas finales y comillas tipográficas (todas) se reparan y se declaran; una mezcla NO se repara y el error dice línea, columna y fragmento", async () => {
    const { x, reloj } = await manual();
    const { r, s } = await base(x);
    const conComa = JSON.stringify(r, null, 1).replace(/\n\]/g, ",\n]").replace(/\n\}$/, ",\n}");
    const a = await importarRespuesta(conComa, { encargo: encargoEnEspera(x), encargo_sha256: s.encargo_sha256, solicitud_sha256: s.solicitud_sha256, declarado_por: "diego" });
    verdadero(a.ok, a.errores.join(" ")); igual(a.correcciones, ["comas_finales_quitadas"]);
    const curvas = JSON.stringify(r).replace(/"/g, "“");
    const b = await importarRespuesta(curvas, { encargo: encargoEnEspera(x), encargo_sha256: s.encargo_sha256, solicitud_sha256: s.solicitud_sha256, declarado_por: "diego" });
    verdadero(b.ok, b.errores.join(" ")); igual(b.correcciones, ["comillas_tipograficas_convertidas"]);
    const mezcla = JSON.stringify(r).replace(/"preguntas"/, "“preguntas”");
    const c = await importarRespuesta(mezcla, { encargo: encargoEnEspera(x), encargo_sha256: s.encargo_sha256, solicitud_sha256: s.solicitud_sha256, declarado_por: "diego" });
    verdadero(!c.ok); igual(c.detalles[0].codigo, "json_invalido"); igual(c.detalles[0].categoria, "formato"); verdadero(c.detalles[0].recuperable);
    verdadero(/línea 1, columna \d+/.test(c.errores[0]), c.errores[0]);
    verdadero(/⟵AQUÍ⟶/.test(c.detalles[0].fragmento) && c.detalles[0].fragmento.length < 120, "fragmento corto alrededor del error");
    const u = ubicarErrorJSON("{\n \"a\": 1,\n \"b\" x }", new Error("Unexpected token x in JSON at position 16"));
    igual([u.linea, u.columna], [3, 6]);
    const antes = x.trabajo.estado, docs = x.documentos.length;
    const res = await pegar(x, reloj, mezcla);
    verdadero(!res.ok); igual([x.trabajo.estado, x.documentos.length], [antes, docs], "el trabajo no cambió");
    const imp = ultimaImp(x);
    igual(imp.fallos, [{ codigo: "json_invalido", categoria: "formato", recuperable: true }]);
    verdadero(!JSON.stringify(exportarExpediente(x)).includes("⟵AQUÍ⟶"), "el fragmento del texto NO se guarda en el expediente");
  });

  prueba("Lab 3.1 · sintético: el prefijo [Ln] de la solicitud y las comillas que envuelven un extracto se quitan y la cita se comprueba literal", async () => {
    const { x, reloj } = await manual();
    const { r } = await base(x);
    r.afirmaciones[0].citas[0].extracto = `"[L3] ${r.afirmaciones[0].citas[0].extracto}"`;
    r.afirmaciones[0].citas[0].ubicacion = 3;
    const res = await pegar(x, reloj, JSON.stringify(r));
    verdadero(res.ok, res.errores.join(" "));
    igual([...res.correcciones].sort(), ["comillas_envolventes_quitadas", "prefijo_linea_quitado", "ubicacion_convertida_a_texto"]);
    igual(res.verificacion.resultado, "apta_para_revision_humana");
    igual(res.verificacion.citas[0].coincidencia, "literal");
    igual([...x.ejecuciones.values()].at(-1).afirmaciones[0].citas[0].ubicacion, "3");
  });

  prueba("Lab 3.1 · sintético: rol con mayúsculas, listas en null y marcadores «…» de la plantilla se normalizan; una afirmación sin rellenar se rechaza", async () => {
    const { x, reloj } = await manual();
    const { r } = await base(x);
    const alterada = { ...r, rol: " Investigador ", hipotesis: null, objeciones: null, preguntas: ["…", "¿Desde cuándo falla?"], dudas: ["..."], limitaciones: ["<una limitación>"] };
    const res = await pegar(x, reloj, JSON.stringify(alterada));
    verdadero(res.ok, res.errores.join(" "));
    igual([...res.correcciones].sort(), ["lista_nula_vaciada", "plantilla_sin_rellenar_quitada", "rol_normalizado"]);
    const ej = [...x.ejecuciones.values()].at(-1);
    igual(ej.preguntas, ["¿Desde cuándo falla?"]); igual(ej.dudas, []); igual(ej.limitaciones, []); igual(ej.hipotesis, []);
    const { x: x2, reloj: r2 } = await manual({ id: "sint-1b" });
    const { r: b } = await base(x2);
    b.afirmaciones.push({ id: "a2", texto: "…", clase: "hecho_citado", citas: [], se_basa_en: [] });
    const res2 = await pegar(x2, r2, JSON.stringify(b));
    verdadero(!res2.ok); igual(res2.detalles[0].codigo, "plantilla_sin_rellenar"); igual(res2.detalles[0].categoria, "contrato");
    igual(x2.trabajo.estado, "pendiente");
  });

  // ------------------------------------------------------------------ 2 · sustantivo (NO se corrige: se rechaza o lab-V lo marca)
  prueba("Lab 3.1 · sintético: una cita parafraseada NO se repara: lab-V la marca (extracto_no_encontrado) y la afirmación queda sin cita utilizable", async () => {
    const { x, reloj } = await manual();
    const { r } = await base(x);
    r.afirmaciones[0].citas[0].extracto = "El agente Revisor se encuentra en estado de error según la ficha.";
    const res = await pegar(x, reloj, JSON.stringify(r));
    verdadero(res.ok, "se importa (la forma es válida)…"); igual(res.correcciones, []);
    igual(res.verificacion.resultado, "con_fallas");
    verdadero(res.verificacion.alertas.some((a) => a.codigo === "extracto_no_encontrado") && res.verificacion.alertas.some((a) => a.codigo === "hecho_sin_cita_utilizable"));
    const d = diagnosticarExpediente(x, { generado_en: reloj() });
    igual(d.categoria_principal, "evidencia"); igual(d.recuperable_sin_cambiar_significado, false);
    verdadero(d.pruebas_sugeridas.some((t) => /copia la línea entera/.test(t)));
  });

  prueba("Lab 3.1 · sintético: respuesta cortada a la mitad → json_truncado (formato, recuperable), el trabajo no cambia y el intento queda con su código", async () => {
    const { x, reloj } = await manual();
    const { r } = await base(x);
    const entero = JSON.stringify(r, null, 2);
    const res = await pegar(x, reloj, "```json\n" + entero.slice(0, Math.floor(entero.length * 0.6)));
    verdadero(!res.ok); igual(res.detalles[0].codigo, "json_truncado"); verdadero(res.truncada === true);
    igual(x.trabajo.estado, "pendiente"); igual(x.ejecuciones.size, 0);
    igual(ultimaImp(x).fallos[0], { codigo: "json_truncado", categoria: "formato", recuperable: true });
    const d = diagnosticarExpediente(x, { generado_en: reloj() });
    igual([d.rol_que_fallo, d.categoria_principal, d.recuperable_sin_cambiar_significado], ["investigador", "formato", true]);
    igual(d.roles[0].estado, "rechazos_sin_aceptar");
  });

  prueba("Lab 3.1 · sintético: hecho sin cita, inferencia sin base y fuente inexistente siguen marcados por lab-V (no se relajó el verificador)", async () => {
    const { x, reloj } = await manual();
    const { r, f } = await base(x);
    r.afirmaciones = [
      { id: "a1", texto: "El Revisor está en error.", clase: "hecho_citado", citas: [], se_basa_en: [] },
      { id: "a2", texto: "Hay tres agentes en error.", clase: "inferencia", citas: [], se_basa_en: [] },
      { id: "a3", texto: "El informe semanal lo confirma.", clase: "hecho_citado", citas: [{ fuente_id: "informe-semanal-inexistente", extracto: "Todas las importaciones de la semana se aplicaron sin errores.", ubicacion: null }], se_basa_en: [] },
    ];
    const res = await pegar(x, reloj, JSON.stringify(r));
    verdadero(res.ok);
    const codigos = new Set(res.verificacion.alertas.map((a) => a.codigo));
    for (const c of ["hecho_sin_cita", "inferencia_sin_base", "fuente_inexistente"]) verdadero(codigos.has(c), c);
    igual(f, x.ficha.fuente.fuente_id);
    const m = medirExpediente(x);
    igual(m.roles.investigador.afirmaciones_sin_respaldo >= 2, true); igual(m.roles.investigador.citas.fuente_inexistente, 1); igual(m.roles.investigador.cobertura_evidencia, 0);
  });

  prueba("Lab 3.1 · sintético: contradicciones entre roles (objeción del crítico + contradicción declarada) llegan al informe y al diagnóstico como asunto humano, nunca resueltas por código", async () => {
    const { x, reloj } = await manual();
    for (let i = 0; i < 2; i++) { const r = await pegar(x, reloj, JSON.stringify((await base(x)).r)); verdadero(r.ok, r.errores.join(" ")); }
    const { r, f } = await base(x);
    // Con una sola fuente el contrato no admite «contradicciones» (exige dos fuentes): la contradicción entre roles se
    // expresa como objeción del crítico a la inferencia del analista, y el sistema no la resuelve.
    const contra = { ...r, contradicciones: [{ fuentes: [f], texto: "La ficha dice «error» y el Analista infiere retraso." }] };
    const rech = await pegar(x, reloj, JSON.stringify(contra));
    verdadero(!rech.ok && /dos fuentes/.test(rech.errores.join(" ")), "una «contradicción» con una sola fuente no entra");
    r.objeciones.push({ id: "o2", a: `${[...x.ejecuciones.values()].at(-1).id}#h1`, tipo: "explicacion_rival", texto: "Pudo ser un corte de red." },
      { id: "o3", a: `${[...x.ejecuciones.values()].at(-1).id}#n1`, tipo: "evidencia", texto: "La ficha no trae ningún dato de retraso: la inferencia contradice la ausencia de evidencia." });
    const res = await pegar(x, reloj, JSON.stringify(r));
    verdadero(res.ok, res.errores.join(" "));
    igual(x.informe.objeciones.length, 3); igual(x.informe.contradicciones.length, 0);
    igual(x.informe.hallazgos.find((h) => h.id.endsWith("n1") || /retrasar/.test(h.texto))?.objeciones.length >= 2, true, "el hallazgo del analista lleva sus objeciones");
    const d = diagnosticarExpediente(x, { generado_en: reloj() });
    verdadero(d.requiere_revision_humana.some((t) => /3 objeción/.test(t)), d.requiere_revision_humana.join(" | "));
    verdadero(d.requiere_revision_humana.some((t) => /decisión final/.test(t)));
    verdadero(["requiere_revision", "requiere_evidencia"].includes(x.trabajo.estado));
  });

  prueba("Lab 3.1 · sintético: respuesta demasiado extensa → demasiado_larga (seguridad), sin analizar nada y sin tocar el trabajo", async () => {
    const { x, reloj } = await manual();
    const { r } = await base(x);
    r.limitaciones = Array.from({ length: 4000 }, (_, i) => `Limitación ${i} ${"x".repeat(70)}`);
    const res = await pegar(x, reloj, JSON.stringify(r));
    verdadero(!res.ok); igual(res.detalles[0].codigo, "demasiado_larga"); igual(res.detalles[0].categoria, "seguridad");
    igual(x.trabajo.estado, "pendiente"); igual(x.ejecuciones.size, 0);
    igual(CATEGORIAS_FALLO, ["formato", "contrato", "seguridad", "evidencia"]);
  });

  // ------------------------------------------------------------------ 3 · diagnóstico sin contenido
  prueba("Lab 3.1 · diagnóstico: resume rol, validación y categoría SIN incluir la pregunta, la ficha, extractos ni la solicitud; con todo en orden sugiere comparar", async () => {
    const { x, reloj } = await completo();
    const d = diagnosticarExpediente(x, { generado_en: reloj() });
    verdadero(validarDiagnostico(d).ok, validarDiagnostico(d).errores.join(" "));
    const texto = JSON.stringify(d) + diagnosticoMarkdown(d);
    for (const privado of [x.trabajo.pregunta, "Ficha de solo lectura", x.ficha.copia.texto.split("\n")[1], "El Revisor está en error", "Supone que el error persiste"]) verdadero(!texto.includes(privado), `no debe aparecer: ${privado.slice(0, 40)}`);
    igual([d.rol_que_fallo, d.categoria_principal, d.recuperable_sin_cambiar_significado], [null, null, null]);
    igual(d.roles.map((r) => r.estado), ["aceptado", "aceptado", "aceptado"]);
    verdadero(d.pruebas_sugeridas.some((t) => /comparar-modelos/.test(t)));
    verdadero(/huellas recortadas/.test(d.privacidad));
    verdadero(d.roles.every((r) => r.respuesta_sha256 === null || r.respuesta_sha256.length === 13));
    verdadero(/\| Investigador \| aceptado \|/.test(diagnosticoMarkdown(d)));
    const roto = clon(d); roto.roles[0].extracto = "x"; verdadero(!validarDiagnostico(roto).ok, "un diagnóstico con texto de citas no es válido");
  });

  // ------------------------------------------------------------------ 4 · banco de comparación
  prueba("Lab 3.1 · comparación: el guion DEMO no es un modelo (sin_datos); un trabajo manual produce una fila con criterios medidos y sin calificaciones inventadas", async () => {
    const demo = await escenariosDemo({ compago: await doc() });
    const vacia = compararModelos(demo.expedientes, { generado_en: T0 });
    verdadero(vacia.sin_datos); igual(vacia.modelos, []); verdadero(/Sin datos/.test(comparacionMarkdown(vacia)));
    verdadero(validarComparacion(vacia).ok);
    const { x, reloj } = await completo();
    const c = compararModelos([x, ...demo.expedientes], { generado_en: reloj() });
    igual(c.modelos.length, 1);
    const m = c.modelos[0];
    igual(m.modelo, "Modelo X (declarado en la prueba)"); igual([m.trabajos, m.roles_ejecutados, m.intentos, m.aceptados, m.validez_estructural], [1, 3, 3, 3, 1]);
    igual([m.citas, m.citas_literales, m.citas_utilizables, m.hechos, m.hechos_cubiertos, m.cobertura_evidencia], [1, 1, 1, 1, 1, 1]);
    igual([m.contradicciones_detectadas, m.afirmaciones_sin_respaldo, m.errores_seguridad, m.costo_mxn], [0, 0, 0, 0]);
    verdadero(Number.isInteger(m.tiempo_medio_segundos) && m.tiempo_medio_segundos >= 0, "tiempo del encargo a la importación");
    igual(c.trabajos[0].puntuacion_humana, null, "la puntuación humana no se inventa");
    verdadero(/\| Modelo X \(declarado en la prueba\) \| 1 \| 3 \| 100 % \(3\/3\)/.test(comparacionMarkdown(c)));
    igual(c.criterios.length, 8);
  });

  // ------------------------------------------------------------------ 5 · persistencia y seguridad
  prueba("Lab 3.1 · persistencia: exportar → reanudar → exportar es idéntico; reanudar dos veces da el mismo trabajo; las huellas importadas sobreviven y bloquean repetir", async () => {
    const { x, reloj } = await manual();
    const { r } = await base(x);
    const texto = JSON.stringify(r);
    verdadero((await pegar(x, reloj, texto)).ok);
    const e1 = exportarExpediente(x, { exportado_en: reloj() });
    const r1 = await restaurarExpediente(clon(e1)); verdadero(r1.ok, r1.errores.join(" "));
    const r2 = await restaurarExpediente(clon(e1)); verdadero(r2.ok);
    igual(r1.expediente.trabajo.id, r2.expediente.trabajo.id);
    const e2 = exportarExpediente(r1.expediente, { exportado_en: e1.exportado_en });
    igual(JSON.stringify(e2), JSON.stringify(e1), "nada se pierde ni se reescribe al reanudar");
    igual(encargoEnEspera(r1.expediente)?.rol, "analista");
    // tras reanudar, la respuesta del investigador no se puede volver a usar (ni en este trabajo ni en otro)
    const huellas = huellasImportadas([r1.expediente]);
    igual(huellas.size, 1);
    const { x: otro, reloj: ro } = await manual({ id: "sint-otro" });
    const rep = await pegar(otro, ro, texto, { ya_importadas: huellas });
    verdadero(!rep.ok && rep.detalles[0].codigo === "respuesta_reutilizada" && rep.detalles[0].categoria === "seguridad", rep.errores.join(" "));
  });

  prueba("Lab 3.1 · seguridad: una respuesta no puede fabricar decisiones ni estados (claves de estado = fallo de seguridad) y un expediente con decisión «de IA» o historial alterado no se reanuda", async () => {
    const { x, reloj } = await manual();
    const { r } = await base(x);
    const res = await pegar(x, reloj, JSON.stringify({ ...r, decision_humana: { decision: "aprobado", por: { tipo: "humano", identificador: "diego", autenticacion: "declarada" } }, estado: "aprobado_por_humano" }));
    verdadero(!res.ok); igual(res.detalles[0].codigo, "campos_desconocidos"); igual(res.detalles[0].categoria, "seguridad");
    igual(x.trabajo.estado, "pendiente");
    const { x: y, reloj: ry } = await completo({ id: "sint-dec" });
    verdadero(["requiere_revision", "requiere_evidencia"].includes(y.trabajo.estado));
    decidir(y, "aprobado_por_humano", { por: HUMANO, motivo: "Revisado en la prueba sintética.", en: ry() });
    const e = exportarExpediente(y, { exportado_en: ry() });
    const ok = await restaurarExpediente(clon(e)); verdadero(ok.ok, ok.errores.join(" "));
    const porIA = clon(e); porIA.documentos.at(-1).documento.decision_humana.por.tipo = "ia";
    verdadero(!(await restaurarExpediente(porIA)).ok, "una decisión firmada por «ia» no se carga");
    const autenticada = clon(e); autenticada.documentos.at(-1).documento.decision_humana.por.autenticacion = "autenticada";
    verdadero(!(await restaurarExpediente(autenticada)).ok, "una autenticación escrita a mano no se carga");
    const alterado = clon(e); alterado.documentos.at(-1).documento.historial.splice(1, 1);
    verdadero(!(await restaurarExpediente(alterado)).ok, "un historial con saltos no se carga");
    const mezcla = clon(e); mezcla.es_demo = false;
    verdadero(!(await restaurarExpediente(mezcla)).ok, "DEMO y REAL no se mezclan");
    verdadero(!validarTrabajo(porIA.documentos.at(-1).documento).ok);
  });

  prueba("Lab 3.1 · seguridad: una importación maliciosa no ejecuta código ni contamina prototipos; el texto se guarda como texto", async () => {
    const { x, reloj } = await manual();
    const { r } = await base(x);
    const texto = JSON.stringify(r).replace(/\{"id":"a1"/, '{"__proto__":{"contaminado":1},"constructor":{"prototype":{"contaminado":2}},"id":"a1"');
    const res = await pegar(x, reloj, texto);
    verdadero(!res.ok, "claves de prototipo son claves desconocidas para el contrato");
    igual(({}).contaminado, undefined); igual([].contaminado, undefined);
    const { x: y, reloj: ry } = await manual({ id: "sint-html" });
    const { r: b } = await base(y);
    b.dudas = ["<script>alert(1)</script>", "${7*7}", "javascript:alert(1)"];
    b.afirmaciones[0].texto = "El Revisor está en error. <img src=x onerror=alert(1)>";
    const ok = await pegar(y, ry, JSON.stringify(b));
    verdadero(ok.ok, ok.errores.join(" "));
    igual([...y.ejecuciones.values()].at(-1).dudas[0], "<script>alert(1)</script>", "se conserva tal cual, como dato");
    const exp = restaurarExpediente(clon(exportarExpediente(y, { exportado_en: ry() })));
    verdadero((await exp).ok);
    // el informe Markdown trata el texto como texto (no se interpreta en la vista: la vista usa nodos de texto)
    for (let i = 0; i < 2; i++) verdadero((await pegar(y, ry, JSON.stringify((await base(y)).r))).ok);
    verdadero(informeMarkdown(y.informe, y.trabajo).includes("<img src=x onerror=alert(1)>"));
  });

  prueba("Lab 3.1 · seguridad: las exportaciones no traen secretos ni fragmentos de texto rechazado; solo lo que hace falta para reanudar y auditar", async () => {
    const { x, reloj } = await manual();
    await pegar(x, reloj, "{ \"formato\": \"cauce.lab.respuesta-manual\", \"api_key\": \"sk-secreto-123\", \"version\": ", { modelo: "Claude", proveedor: "Anthropic" });
    verdadero((await pegar(x, reloj, JSON.stringify((await base(x)).r))).ok);
    const e = exportarExpediente(x, { exportado_en: reloj() });
    const texto = JSON.stringify(e);
    verdadero(!/sk-secreto-123/.test(texto), "el contenido de un intento rechazado no se guarda");
    verdadero(!/"(api_key|token|password|contrase|cookie|authorization)"/i.test(texto), "sin claves de credenciales");
    verdadero(!/solicitud_texto|"texto_fuera"|fragmento/.test(texto));
    igual(Object.keys(e).sort(), ["documentos", "es_demo", "exportado_en", "ficha", "formato", "importaciones", "trabajo_id", "version"]);
    for (const i of e.importaciones) { verdadero(i.errores.every((t) => t.length <= 400)); for (const f of i.fallos) igual(Object.keys(f).sort(), ["categoria", "codigo", "recuperable"]); }
    const d = diagnosticarExpediente(x, { generado_en: reloj() });
    verdadero(!/sk-secreto-123/.test(JSON.stringify(d)));
  });

  // ------------------------------------------------------------------ 6 · motores: qué puede consumir el Laboratorio
  prueba("Lab 3.1 · motores: comprobarExportacion dice qué campos útiles trae un documento y cuáles faltan, sin inventar exportadores", async () => {
    const c = comprobarExportacion(await doc());
    verdadero(c.ok); igual(c.motor, "compago");
    verdadero(c.campos_usados.some((f) => f.campo === "departamentos[].agentes[].evidencia.observado_en"));
    verdadero(c.campos_no_usados.some((f) => f.campo === "departamentos[].agentes[].error.mensaje" && f.presente === true), "el DEMO trae error.mensaje y la ficha aún no lo usa");
    verdadero(c.campos_faltantes.some((f) => /indicadores\[\]\.observado_en/.test(f.campo)), "falta la fecha de cada indicador");
    const malo = comprobarExportacion({ contrato: "otro" });
    verdadero(!malo.ok && malo.errores.length > 0);
    const tez = comprobarExportacion({ ...(await doc()), proyecto: { id: "tezcatlipoca", nombre: "Tezcatlipoca" } });
    verdadero(!tez.ok && /no tiene integración/.test(tez.errores[0]));
  });

  prueba("Lab 3.1 · el guion DEMO sigue igual: ADAPTADOR_SIN_MODELO no pasa por el análisis de respuestas (sin correcciones ni intercambio)", async () => {
    const r = await escenariosDemo({ compago: await doc() });
    const ej = [...r.expedientes[0].ejecuciones.values()][0];
    igual(ej.intercambio, null); igual(ej.autor.tipo, "guion_demo");
    igual(typeof ADAPTADOR_SIN_MODELO.ejecutar, "function");
    igual(extraerJSON("sin json").ok, false);
  });
}
