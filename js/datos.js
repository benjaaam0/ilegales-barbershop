// Datos de la barbería que puedes editar sin tocar el resto del código.

// Servicios: todos incluyen corte.
// precio: número en pesos chilenos (0 = mostrar "Consultar").
// linkPago: link de pago de Mercado Pago para ese servicio (opcional, ver README).
export const SERVICIOS = [
  { id: 'kit', nombre: 'Kit completo', detalle: 'Corte + barba + cejas', descripcion: 'Corte, barba y cejas en una sola visita. El servicio más completo para salir impecable.', precio: 0, linkPago: '', destacado: true },
  { id: 'corte-barba', nombre: 'Corte + barba', detalle: 'Barba con toalla caliente', descripcion: 'Corte a tu gusto y barba perfilada con toalla caliente.', precio: 0, linkPago: '' },
  { id: 'corte-cejas', nombre: 'Corte + cejas', detalle: 'Con perfilado de cejas', descripcion: 'Corte de pelo con perfilado de cejas incluido.', precio: 0, linkPago: '' },
  { id: 'corte', nombre: 'Corte de pelo', detalle: 'Degradado a elección', descripcion: 'Corte clásico o moderno, con degradado a elección y terminación a navaja.', precio: 0, linkPago: '' }
];

// Horas en que se puede reservar (formato 24 h).
export const HORAS = ['10:00', '10:45', '11:30', '12:15', '13:00', '15:00', '15:45', '16:30', '17:15', '18:00', '18:45', '19:30'];

// Cuántos días hacia adelante se puede reservar (0 = solo hoy).
export const DIAS_RESERVA = 6;

// Días cerrados (0 = domingo, 1 = lunes, ... 6 = sábado).
export const DIAS_CERRADO = [0];

// Horario que se muestra en la página.
export const HORARIO = [
  { dias: 'Lunes a viernes', horas: '[POR COMPLETAR]' },
  { dias: 'Sábado', horas: '[POR COMPLETAR]' },
  { dias: 'Domingo', horas: 'Cerrado' }
];

export const CONTACTO = {
  direccion: '[DIRECCIÓN POR COMPLETAR]',
  comuna: '[COMUNA, CIUDAD]',
  instagram: 'ilegales_barbershop1',
  // Pega aquí el link "Insertar mapa" de Google Maps (el valor de src del iframe). Vacío = no se muestra mapa.
  mapaEmbed: ''
};

export const FORMAS_PAGO = [
  { id: 'online', nombre: 'Pagar ahora en la página', detalle: 'Débito o crédito online' },
  { id: 'debito', nombre: 'Débito en el local', detalle: 'Pagas con tarjeta al terminar' },
  { id: 'efectivo', nombre: 'Efectivo en el local', detalle: 'Pagas en efectivo al terminar' }
];

export function formatoPrecio(n) {
  if (!n) return 'Consultar';
  return '$' + n.toLocaleString('es-CL');
}

export function fechaISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
