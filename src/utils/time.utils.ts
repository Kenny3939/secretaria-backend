// src/utils/time.utils.ts

/**
 * Convierte texto como "hoy", "mañana" o "15/03" en una fecha ISO
 * para buscar en la base de datos.
 */
export function procesarFechaHora(fechaTexto: string, horaTexto: string): string {
  const ahora = new Date();
  const fecha = new Date();

  if (fechaTexto.includes('hoy')) {
    // Se mantiene la fecha de hoy
  } else if (fechaTexto.includes('mañan')) {
    fecha.setDate(ahora.getDate() + 1);
  } else {
    const partes = fechaTexto.split('/');
    if (partes.length >= 2) {
      // ✅ FIX: setMonth ANTES de setDate para evitar saltos de mes
      fecha.setMonth(parseInt(partes[1]) - 1);
      fecha.setDate(parseInt(partes[0]));
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
  const [h, m] = horaStr.split(':').map(Number);
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
function aHoraGuatemala(d: Date): Date {
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
  const fechaStr = new Date(fechaISO).toISOString().split("T")[0];

  for (const bloqueo of fechasBloqueadas) {
    if (fechaStr < bloqueo.start_date || fechaStr > bloqueo.end_date) continue;

    // Día completo bloqueado
    if (bloqueo.is_full_day) return true;

    // Rango de horas bloqueado
    if (bloqueo.start_time && bloqueo.end_time) {
      const bloqInicio = convertirHoraAMinutos(bloqueo.start_time.slice(0, 5));
      const bloqFin    = convertirHoraAMinutos(bloqueo.end_time.slice(0, 5));
      if (slotMinutos < bloqFin && slotFinMinutos > bloqInicio) return true;
    }
  }
  return false;
}

/**
 * Generador de horarios con control de capacidad real.
 * Respeta días/horas bloqueados desde el panel admin.
 */
export function generarHorariosDisponibles(
  fechaISO: string,
  duracionMinutos: number,
  horaInicioNegocio: string,
  horaFinNegocio: string,
  citasExistentes: any[],
  capacidadTotal: number = 1,
  fechasBloqueadas: any[] = []
): string[] {
  const horariosDisponibles: string[] = [];
  const fechaBase = new Date(fechaISO);

  const inicioMinutos = convertirHoraAMinutos(horaInicioNegocio);
  const finMinutos    = convertirHoraAMinutos(horaFinNegocio);
  const intervalo     = 30;

  const ahoraGT = aHoraGuatemala(new Date());

  for (let t = inicioMinutos; t + duracionMinutos <= finMinutos; t += intervalo) {

    const slotPropuesto = new Date(fechaBase);
    slotPropuesto.setHours(Math.floor(t / 60), t % 60, 0, 0);

    // Si es hoy, solo mostrar horas futuras (+15 min de gracia)
    if (slotPropuesto.toDateString() === ahoraGT.toDateString()) {
      if (slotPropuesto.getTime() < ahoraGT.getTime() + 15 * 60000) continue;
    }

    const finPropuestoMinutos = t + duracionMinutos;

    // ✅ Verificar días/horas bloqueados desde el panel admin
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