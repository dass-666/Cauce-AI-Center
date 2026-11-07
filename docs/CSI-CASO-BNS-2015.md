# Caso histórico CSI: fin del tipo mínimo del franco suizo (15 de enero de 2015)

> **Publicado con autorización del responsable del proyecto (7-nov-2026).** Expediente: `datos/csi/casos-publicados/expediente-bns-2015.json`. Las copias de las fuentes no se publican (son de terceros); solo sus huellas.
> **Naturaleza: HISTÓRICO · REAL RETROSPECTIVO.** Es un análisis hecho después de los hechos, no una predicción. Sus contrafactuales llevan esa etiqueta.
> Lo investigó una IA, que ya conocía el desenlace (riesgo de sesgo retrospectivo). Sigue pendiente de una revisión humana independiente.

## Para qué sirve

Es un caso de práctica del método CSI. Se trata de ver si un análisis con fuentes fechadas distingue bien:
- lo que se sabía de lo que se supo después;
- los hechos de las explicaciones que dio cada actor;
- las hipótesis con evidencia de las que no la tienen.

No evalúa si la decisión fue acertada.

## Alcance

El alcance se registró antes de agregar la primera fuente, y el historial del caso lo prueba.

- **Periodo:** del 6-sep-2011 al 8-ene-2016.
- **Incluye:**
  - comunicados y discursos del BNS y del BCE;
  - tipos de referencia oficiales EUR/CHF;
  - comunicados de afectados identificables;
  - medios, solo para cifras atribuidas a una institución.
- **Excluye:**
  - política interna suiza;
  - opiniones de analistas;
  - rumores;
  - datos intradía.

## Qué ocurrió (hechos con fuente)

- El 6-sep-2011 el BNS anunció que, «with immediate effect», no toleraría un tipo EUR/CHF por debajo de 1,20 francos y que estaba dispuesto a comprar divisas «in unlimited quantities» [F2, F1]. Lo justificó por «a massive overvaluation of our national currency» [F2].
- El 18-dic-2014 el BNS impuso un tipo de −0,25 % a los depósitos a la vista y **reafirmó** el mínimo. Se declaró dispuesto a comprar divisas «in unlimited quantities» [F3].
- El 15-ene-2015 el BNS dejó el mínimo y bajó ese tipo a −0,75 % [F4, F5].
- Tipo de referencia EUR/CHF a las 14:15 CET [F10, F11]:
  - 14-ene: 1,2010;
  - 15-ene: 1,0280;
  - variación (cálculo propio): ≈ −14,4 %.
- 16-ene-2015:
  - FXCM declaró una pérdida de 225 millones de dólares por la decisión del BNS. Esa cifra solo aparece en el comunicado conjunto [F7].
  - Leucadia acordó financiar a FXCM con 300 millones de dólares [F7]. Lo confirma la presentación de FXCM ante la SEC [F12].
- El 22-ene-2015 el BCE anunció compras de activos por 60 mil millones de euros al mes [F6].
- En abril de 2015 el BNS explicó que el mínimo «could only be enforced through permanent currency interventions of rapidly increasing magnitude» [F8].
- En enero de 2016 el BNS anticipó una pérdida de 23 mil millones de francos para 2015 (vía Swissinfo) [F9].

## Explicaciones posibles y su respaldo

| Hipótesis | Evidencia a favor | Situación |
|---|---|---|
| H-A · Fundamentales (políticas divergentes, euro débil, intervenciones insostenibles) | 3 declaraciones del BNS; 1 en contra (la reafirmación de diciembre) | La mejor respaldada, pero **solo por el propio BNS**, y una de sus pruebas es de abril (posterior) |
| H-B · Riesgo del balance | 1 fuente secundaria de 2016 | Débil y posterior |
| H-C · Aviso o arreglo previo con el BCE | ninguna | Sin evidencia |
| H-D · Alguien operó con información previa | ninguna | Sin evidencia; un movimiento de precio por sí solo no prueba manipulación |

## Qué se podía saber y cuándo

- **Antes del día 15:** solo el mínimo y su reafirmación de diciembre. Lo publicado no anticipaba el cambio (inferencia).
- **Después:** las razones detalladas de abril de 2015, el programa del BCE y las pérdidas de 2016. Sirven para describir lo que pasó, no lo que el BNS sabía al decidir.

## Qué queda como especulación

- Si las razones declaradas son las reales.
- El peso del balance en la decisión.
- Cualquier contacto previo con el BCE.
- Cualquier operación con información previa.
- El contrafactual de mantener el mínimo, que está etiquetado y no estima magnitudes.

## Referencias

Las 12 fuentes se consultaron el 7-nov-2026 y todas tienen huella. Cada huella corresponde a una copia byte a byte, privada y **no publicada**, porque es de terceros. La huella SHA-256 permite a cualquiera comprobar si su propia copia es idéntica a la usada.

| | Fuente | Clase | SHA-256 de la copia (7-nov-2026) |
|---|---|---|---|
| F1 | BCE, «Statement of the Governing Council of the ECB on the decision of the Swiss National Bank», 6-sep-2011. https://www.ecb.europa.eu/press/pr/date/2011/html/pr110906.en.html | primaria | `4488e4815901bc6d567bda2071709af708f6eefca5045ef63851d31ee3f89e0b` |
| F2 | BNS (Philipp Hildebrand), «Introduction of a minimum Swiss franc exchange rate against the euro», declaración breve, Zúrich, 6-sep-2011 (PDF). https://www.snb.ch/public/asset/en/www-snb-ch/publications/communication/speeches/2011/ref_20110906_pmh/publications0_en/ref_20110906_pmh.en.pdf · página de presentación: https://www.snb.ch/en/mmr/speeches/id/ref_20110906_pmh | primaria | `351b533d68bb705e8fd14963bcd0f30e4378584ec23006d4921c28de9891dd40` |
| F3 | Comunicado del BNS del 18-dic-2014, copia en Mondo Visione. https://mondovisione.com/media-and-resources/news/swiss-national-bank-introduces-negative-interest-rates-minimum-exchange-rate-rea-20141218/ | secundaria | `3953137dd2adf3d4049b9de34217bcf6ba69255041f598b85d887743dd572b06` |
| F4 | Comunicado del BNS del 15-ene-2015, copia en Mondo Visione. https://mondovisione.com/media-and-resources/news/swiss-national-bank-discontinues-minimum-exchange-rate-and-lowers-interest-rate-2015115/ | secundaria | `3b65959a2205e4e437f890f34fa7b430f1d7cfac6dd95be50d9addbe8b9495ab` |
| F5 | T. Jordan, «The rationale for discontinuing the minimum exchange rate and lowering interest rates», BIS (15/16-ene-2015). https://www.bis.org/review/r150116a.htm | primaria | `e0f872ae121ca22a92a899985fcffd8798c65e88f4604e78364eda33301c7020` |
| F6 | BCE, «ECB announces expanded asset purchase programme», 22-ene-2015. https://www.ecb.europa.eu/press/pr/date/2015/html/pr150122_1.en.html | primaria | `1ce0316cdcd0ef557750b02305d71a954bae195e06ca21a6a9fe2ea4a829d954` |
| F7 | Comunicado de Leucadia y FXCM del 16-ene-2015, copia en Mondo Visione. https://mondovisione.com/media-and-resources/news/leucadia-national-corporation-and-fxcm-announce-300-million-financing-to-permit-2015116/ | secundaria | `af2145d367e9935262aad412102bcc253c744e4ca79da96ff4fa7c969317033f` |
| F8 | T. Jordan, «SNB monetary policy after the discontinuation of the minimum exchange rate», 24-abr-2015. https://www.snb.ch/en/mmr/speeches/id/ref_20150424_tjn | primaria | `b1cf6ec080c24390e804ef9e1311e611f74f69f334f5bbce6c57d1c408de7c0d` |
| F9 | Swissinfo, «SNB reports CHF23 billion loss», 8-ene-2016. https://www.swissinfo.ch/eng/balance-sheet_snb-reports-chf23-billion-loss/41881084 | secundaria | `a53ef5c4ac9ec3ceb22468eb28b5414c31ed1efced00b54fd179cc5849a0e125` |
| F10 | Banca d'Italia, «Cambi di riferimento», 14-ene-2015. https://www.bancaditalia.it/compiti/operazioni-cambi/cambio/cambi_rif_20150114 | primaria | `04b3c178eb939ec601481556e93e7b103f11500ec697ca691afafddf6a618913` |
| F11 | Banca d'Italia, «Cambi di riferimento», 15-ene-2015. https://www.bancaditalia.it/compiti/operazioni-cambi/cambio/cambi_rif_20150115 | primaria | `4595629ff751ec119b019602d61f7debdda9734aa7ec918d0528b084bbdb790a` |
| F12 | FXCM Inc., anexo 99.1 del Form 8-K ante la SEC, 19-ene-2015. https://www.sec.gov/Archives/edgar/data/0001499912/000114420415002640/v398968_ex99-1.htm | primaria | `14b42ebfb7937b013aa7e1a69970b7dc1be8a798b1983538f0cd55f598f9b17e` |

Una página web puede cambiar o mostrar contenido dinámico, y entonces su huella cambia aunque el texto citado siga igual. La huella prueba qué copia se usó, no que el sitio no haya cambiado.

## Límites

- Tres comunicados se cotejaron contra la copia de Mondo Visione, no contra snb.ch.
- Las citas se cotejaron literalmente contra copias de 2026, no de 2015.
- La revisión del Abogado del Diablo (15 alertas) la hace código determinista, no una persona.
- No hay datos intradía ni deliberaciones internas.
