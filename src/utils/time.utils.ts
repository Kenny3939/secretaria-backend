// src/utils/time.utils.ts

/**
 * Convierte texto como "hoy", "mañana" o "15/03" en una fecha ISO.
 * Corrige el año si el mes ya pasó (ej: escribir "15/03" en diciembre apunta al año siguiente).
 */
export function procesarFechaHora(fechaTexto: string, horaTexto: string): string {
  const ahora = new Date();
  const ahoraGT = aHoraGuatemala(ahora);
  const fecha = new Date(ahoraGT);

  if (fechaTexto.includes('hoy')) {
    // Se mantiene la fecha de hoy
  } else if (fechaTexto.includes('mañan')) {
    fecha.setDate(ahoraGT.getDate() + 1);
  } else {
    const partes = fechaTexto.split('/');
    if (partes.length >= 2) {
      const dia = parseInt(partes[0]);
      const mes = parseInt(partes[1]) - 1; // 0-indexed

      // ✅ FIX: setMonth ANTES de setDate para evitar saltos de mes
      fecha.setMonth(mes);
      fecha.setDate(dia);

      // ✅ FIX: si la fecha ya pasó este año, apuntar al año siguiente
      if (fecha < ahoraGT) {
        fecha.setFullYear(fecha.getFullYear() + 1);
      }
    }
  }

  const [horas, minutos] = horaTexto.split(':').map(Number);
  fecha.setHours(horas, minutos, 0, 0);
  return fecha.toISOString();
}

/**
 * Convierte "08:30" a minutos totales desde el inicio del día (510 min)
 */
export function convertirHoraAMinutos(horaStr: string): number {
  if (!horaStr) return 0;
  const clean = horaStr.slice(0, 5); // acepta "08:30:00" o "08:30"
  const [h, m] = clean.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Convierte minutos totales (510) de vuelta a "08:30"
 */
export function minutosAHora(totalMinutos: number): string {
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Helper: convierte cualquier Date a su equivalente en zona Guatemala
 */
export function aHoraGuatemala(d: Date): Date {
  return new Date(d.toLocaleString("en-US", { timeZone: "America/Guatemala" }));
}

/**
 * Verifica si un slot cae dentro de un bloqueo de fecha/hora definido en el panel admin.
 */
export function verificarSlotBloqueado(
  slotMinutos: number,
  slotFinMinutos: number,
  fechaISO: string,
  fechasBloqueadas: any[]
): boolean {
  // Usar Guatemala para evitar “corrimientos” de fecha por zona horaria
  const fechaStr = aHoraGuatemala(new Date(fechaISO)).toISOString().split("T")[0];

  for (const bloqueo of fechasBloqueadas) {
    if (fechaStr < bloqueo.start_date || fechaStr > bloqueo.end_date) continue;

    // Día completo bloqueado
    if (bloqueo.is_full_day) return true;

    // Rango de horas bloqueado
    if (bloqueo.start_time && bloqueo.end_time) {
      const bloqInicio = convertirHoraAMinutos(bloqueo.start_time);
      const bloqFin    = convertirHoraAMinutos(bloqueo.end_time);
      if (slotMinutos < bloqFin && slotFinMinutos > bloqInicio) return true;
    }
  }
  return false;
}

/**
 * Generador de horarios con control de capacidad real.
 * - Respeta días/horas bloqueados desde el panel admin
 * - Usa buffer_minutes para el intervalo entre slots
 * - Zona horaria Guatemala consistente en todo el cálculo
 */
export function generarHorariosDisponibles(
  fechaISO: string,
  duracionMinutos: number,
  horaInicioNegocio: string,
  horaFinNegocio: string,
  citasExistentes: any[],
  capacidadTotal: number = 1,
  fechasBloqueadas: any[] = [],
  bufferMinutos: number = 0
): string[] {
  const horariosDisponibles: string[] = [];

  // ✅ FIX: usar Guatemala consistentemente para la fecha base
  const ahoraGT   = aHoraGuatemala(new Date());
  const fechaBaseGT = aHoraGuatemala(new Date(fechaISO));

  const inicioMinutos = convertirHoraAMinutos(horaInicioNegocio);
  const finMinutos    = convertirHoraAMinutos(horaFinNegocio);

  // ✅ FIX: intervalo = duracion + buffer (no fijo en 30)
  const intervalo = duracionMinutos + bufferMinutos;

  for (let t = inicioMinutos; t + duracionMinutos <= finMinutos; t += intervalo) {

    // Comparación real con Date en hora Guatemala (evita fórmulas aproximadas por mes/año)
    const esHoy = fechaBaseGT.toDateString() === ahoraGT.toDateString();
    if (esHoy) {
      const slot = new Date(fechaBaseGT);
      slot.setHours(Math.floor(t / 60), t % 60, 0, 0);
      const ahoraConGracia = new Date(ahoraGT.getTime() + 15 * 60 * 1000);
      if (slot.getTime() < ahoraConGracia.getTime()) continue;
    }

    const finPropuestoMinutos = t + duracionMinutos;

    // Verificar días/horas bloqueados desde el panel admin
    if (verificarSlotBloqueado(t, finPropuestoMinutos, fechaISO, fechasBloqueadas)) continue;

    // Contar citas solapadas usando hora Guatemala
    const citasSolapadas = citasExistentes.filter(cita => {
      const inicioGT = aHoraGuatemala(new Date(cita.start_datetime));
      const finGT    = aHoraGuatemala(new Date(cita.end_datetime));
      const ci = inicioGT.getHours() * 60 + inicioGT.getMinutes();
      const cf = finGT.getHours()    * 60 + finGT.getMinutes();
      return t < cf && finPropuestoMinutos > ci;
    });

    if (citasSolapadas.length < capacidadTotal) {
      horariosDisponibles.push(minutosAHora(t));
    }
  }

  return horariosDisponibles;
}