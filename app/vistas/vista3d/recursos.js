// Lleva la cuenta de geometrías, materiales y texturas para liberarlos de la tarjeta gráfica
// al cambiar de departamento o al salir de la vista 3D (si no, la memoria de video crece).

export class Recursos {
  constructor() {
    this.lista = new Set();
  }

  agregar(recurso) {
    this.lista.add(recurso);
    return recurso;
  }

  liberar() {
    for (const r of this.lista) r.dispose?.();
    const n = this.lista.size;
    this.lista.clear();
    return n;
  }
}
