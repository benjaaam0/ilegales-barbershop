// Página pública de Ilegales Barbershop: servicios, barberos en vivo, reservas y opiniones.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, doc, query, where, orderBy, onSnapshot, getDocs,
  writeBatch, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { SERVICIOS, HORAS, DIAS_RESERVA, DIAS_CERRADO, HORARIO, CONTACTO, FORMAS_PAGO, formatoPrecio, fechaISO } from './datos.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const $ = (sel) => document.querySelector(sel);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ESTADOS = {
  disponible: { texto: 'Disponible ahora', clase: 'estado-disponible' },
  ocupado: { texto: 'Atendiendo', clase: 'estado-ocupado' },
  ausente: { texto: 'No disponible hoy', clase: 'estado-ausente' }
};
const ESTRELLA = (n) => `<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="12 2.5 15 8.9 22 9.8 16.9 14.6 18.2 21.5 12 18.1 5.8 21.5 7.1 14.6 2 9.8 9 8.9"/></svg>`;
const ESTRELLA_VACIA = (n) => `<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2.5 15 8.9 22 9.8 16.9 14.6 18.2 21.5 12 18.1 5.8 21.5 7.1 14.6 2 9.8 9 8.9"/></svg>`;

$('#anio').textContent = new Date().getFullYear();

/* ---------- Servicios ---------- */
const destacado = SERVICIOS.find((s) => s.destacado) || SERVICIOS[0];
$('#servicio-destacado').innerHTML = `
  <div class="destacado">
    <div class="destacado-info">
      <span class="etiqueta">Servicio completo</span>
      <h3>${esc(destacado.nombre)}</h3>
      <p class="texto-suave texto-grande">${esc(destacado.descripcion)}</p>
      <div class="pastillas">${destacado.detalle.split('+').map((p) => `<span class="pastilla">${esc(p.trim())}</span>`).join('')}</div>
    </div>
    <div class="pila-16">
      <span class="destacado-precio">${formatoPrecio(destacado.precio)}</span>
      <a href="#reservar" class="btn btn-primario btn-grande" data-servicio="${destacado.id}">Reservar ${esc(destacado.nombre.toLowerCase())}</a>
    </div>
  </div>`;
$('#lista-servicios').innerHTML = SERVICIOS.filter((s) => s !== destacado).map((s) => `
  <div class="servicio">
    <div class="servicio-cab"><h4>${esc(s.nombre)}</h4><span class="precio">${formatoPrecio(s.precio)}</span></div>
    <p class="texto-suave">${esc(s.descripcion)}</p>
  </div>`).join('');

/* ---------- Horario y ubicación ---------- */
$('#tabla-horario').innerHTML = HORARIO.map((h) => `<div class="fila-horario"><span>${esc(h.dias)}</span><span>${esc(h.horas)}</span></div>`).join('');
$('#direccion').textContent = CONTACTO.direccion;
$('#comuna').textContent = CONTACTO.comuna;
if (CONTACTO.mapaEmbed) {
  $('#mapa').innerHTML = `<iframe src="${esc(CONTACTO.mapaEmbed)}" title="Mapa de Ilegales Barbershop" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
} else {
  $('#mapa').textContent = 'Mapa por agregar';
}

/* ---------- Estado de la reserva ---------- */
const R = { servicio: null, barbero: null, fecha: null, hora: null, pago: null, ocupadas: new Set() };
let barberos = [];

function diasDisponibles() {
  const dias = [];
  const hoy = new Date();
  for (let i = 0; i <= DIAS_RESERVA; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
    if (DIAS_CERRADO.includes(d.getDay())) continue;
    let etiqueta = d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
    if (i === 0) etiqueta = 'Hoy';
    else if (i === 1) etiqueta = 'Mañana';
    dias.push({ iso: fechaISO(d), etiqueta });
  }
  return dias;
}

function horaPasada(fecha, hora) {
  if (fecha !== fechaISO(new Date())) return false;
  const [h, m] = hora.split(':').map(Number);
  const ahora = new Date();
  return h * 60 + m <= ahora.getHours() * 60 + ahora.getMinutes();
}

function botonOpcion(tipo, valor, titulo, sub, elegido, deshabilitado = false, claseExtra = '') {
  return `<button type="button" class="opcion ${claseExtra}" data-tipo="${tipo}" data-valor="${esc(valor)}" aria-pressed="${elegido}" ${deshabilitado ? 'disabled' : ''}>
    <span>${esc(titulo)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
}

function pintarOpciones() {
  $('#op-servicios').innerHTML = SERVICIOS.map((s) =>
    botonOpcion('servicio', s.id, s.nombre, `${s.detalle} · ${formatoPrecio(s.precio)}`, R.servicio === s.id)).join('');

  const dias = diasDisponibles();
  if (!R.fecha || !dias.some((d) => d.iso === R.fecha)) R.fecha = dias[0]?.iso ?? null;
  $('#op-dias').innerHTML = dias.map((d) => botonOpcion('fecha', d.iso, d.etiqueta, '', R.fecha === d.iso)).join('');

  $('#op-horas').innerHTML = HORAS.map((h) => {
    const tomada = R.ocupadas.has(h) || horaPasada(R.fecha, h);
    if (tomada && R.hora === h) R.hora = null;
    return botonOpcion('hora', h, h, '', R.hora === h, tomada, 'opcion-hora');
  }).join('');

  $('#op-barberos').innerHTML = barberos.length
    ? barberos.map((b) => {
        const est = ESTADOS[b.estado] || ESTADOS.ausente;
        return botonOpcion('barbero', b.id, b.nombre, est.texto, R.barbero === b.id);
      }).join('')
    : '<p class="texto-suave">Cargando barberos…</p>';

  $('#op-pagos').innerHTML = FORMAS_PAGO.map((p) => botonOpcion('pago', p.id, p.nombre, p.detalle, R.pago === p.id)).join('');

  const serv = SERVICIOS.find((s) => s.id === R.servicio);
  const nota = $('#nota-pago');
  if (R.pago === 'online') {
    nota.hidden = false;
    nota.textContent = serv?.linkPago
      ? `Al confirmar te llevamos a Mercado Pago para pagar ${formatoPrecio(serv.precio)} de forma segura.`
      : 'El pago online todavía no está habilitado para este servicio. Puedes reservar igual y pagar en el local.';
  } else if (R.pago) {
    nota.hidden = false;
    nota.textContent = `Pagas en la barbería después de tu servicio. Total: ${formatoPrecio(serv?.precio)}.`;
  } else {
    nota.hidden = true;
  }
  $('#btn-reservar').textContent = R.pago === 'online' && serv?.linkPago ? 'Ir a pagar y confirmar' : 'Confirmar reserva';

  const barb = barberos.find((b) => b.id === R.barbero);
  const dia = dias.find((d) => d.iso === R.fecha);
  const partes = [serv?.nombre, barb?.nombre, dia && (dia.etiqueta + (R.hora ? ' a las ' + R.hora : '')), FORMAS_PAGO.find((p) => p.id === R.pago)?.nombre];
  const texto = partes.filter(Boolean).join(' · ');
  $('#resumen').textContent = texto || 'Completa los pasos para reservar.';
}

let cancelarOcupadas = null;
function escucharOcupadas() {
  if (cancelarOcupadas) cancelarOcupadas();
  R.ocupadas = new Set();
  if (!R.barbero || !R.fecha) { pintarOpciones(); return; }
  const q = query(collection(db, 'ocupados'), where('barberoId', '==', R.barbero), where('fecha', '==', R.fecha));
  cancelarOcupadas = onSnapshot(q, (snap) => {
    R.ocupadas = new Set(snap.docs.map((d) => d.data().hora));
    pintarOpciones();
  }, () => pintarOpciones());
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.opcion');
  if (btn && !btn.disabled) {
    const { tipo, valor } = btn.dataset;
    R[tipo] = valor;
    $('#res-error').hidden = true;
    if (tipo === 'fecha') R.hora = null;
    if (tipo === 'fecha' || tipo === 'barbero') escucharOcupadas();
    else pintarOpciones();
    return;
  }
  const link = e.target.closest('[data-servicio]');
  if (link) { R.servicio = link.dataset.servicio; pintarOpciones(); }
  const linkBarbero = e.target.closest('[data-barbero]');
  if (linkBarbero) { R.barbero = linkBarbero.dataset.barbero; escucharOcupadas(); }
});

/* ---------- Barberos en vivo ---------- */
onSnapshot(query(collection(db, 'barberos'), orderBy('orden')), (snap) => {
  barberos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  $('#lista-barberos').innerHTML = barberos.map((b) => {
    const est = ESTADOS[b.estado] || ESTADOS.ausente;
    const inicial = esc((b.nombre || '?').trim().charAt(0).toUpperCase());
    const foto = b.foto ? `<img src="${esc(b.foto)}" alt="">` : inicial;
    const accion = b.estado === 'disponible'
      ? `<a href="#reservar" class="btn btn-primario" data-barbero="${esc(b.id)}">Reservar con ${esc(b.nombre)}</a>`
      : `<a href="#reservar" class="no-disp" data-barbero="${esc(b.id)}">${b.estado === 'ocupado' ? 'Reservar para más tarde' : 'Reservar otro día'}</a>`;
    return `<div class="barbero">
      <div class="avatar" aria-hidden="true">${foto}</div>
      <h3>${esc(b.nombre)}</h3>
      <span class="estado ${est.clase}">${est.texto}</span>
      ${accion}
    </div>`;
  }).join('') || '<p class="texto-suave">Pronto verás aquí a nuestro equipo.</p>';
  pintarOpciones();
}, (err) => {
  console.error(err);
  $('#lista-barberos').innerHTML = '<p class="texto-suave">No pudimos cargar los barberos. Revisa la configuración de Firebase.</p>';
});

/* ---------- Enviar reserva ---------- */
$('#form-reserva').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = $('#res-nombre').value.trim();
  const telefono = $('#res-fono').value.trim();
  const faltan = [];
  if (!nombre) faltan.push('tu nombre');
  if (!R.servicio) faltan.push('el servicio');
  if (!R.hora) faltan.push('la hora');
  if (!R.barbero) faltan.push('el barbero');
  if (!R.pago) faltan.push('la forma de pago');
  const errorEl = $('#res-error');
  if (faltan.length) { errorEl.textContent = 'Te falta: ' + faltan.join(', ') + '.'; errorEl.hidden = false; return; }

  const serv = SERVICIOS.find((s) => s.id === R.servicio);
  const barb = barberos.find((b) => b.id === R.barbero);
  const boton = $('#btn-reservar');
  boton.disabled = true;
  try {
    const batch = writeBatch(db);
    const idOcupado = `${R.barbero}_${R.fecha}_${R.hora}`;
    batch.set(doc(db, 'ocupados', idOcupado), { barberoId: R.barbero, fecha: R.fecha, hora: R.hora });
    const refReserva = doc(collection(db, 'reservas'));
    batch.set(refReserva, {
      nombre, telefono,
      servicioId: serv.id, servicio: serv.nombre, precio: serv.precio || 0,
      barberoId: barb.id, barbero: barb.nombre,
      fecha: R.fecha, hora: R.hora,
      pago: R.pago,
      pagado: false,
      estado: 'pendiente',
      creada: serverTimestamp()
    });
    await batch.commit();

    const dia = diasDisponibles().find((d) => d.iso === R.fecha);
    const cuando = dia ? dia.etiqueta.toLowerCase() : R.fecha;
    const textoPago = R.pago === 'online' ? (serv.linkPago ? 'Te estamos llevando al pago.' : 'Puedes pagar en el local.') : (R.pago === 'debito' ? 'Pagas con débito en el local.' : 'Pagas en efectivo en el local.');
    $('#res-ok-texto').textContent = `${nombre}, te esperamos ${cuando} a las ${R.hora} con ${barb.nombre} para tu ${serv.nombre.toLowerCase()}. ${barb.nombre} ya recibió tu reserva. ${textoPago}`;
    $('#form-reserva').hidden = true;
    $('#res-ok').hidden = false;
    $('#res-ok').scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (R.pago === 'online' && serv.linkPago) {
      setTimeout(() => { window.location.href = serv.linkPago; }, 1500);
    }
  } catch (err) {
    console.error(err);
    errorEl.textContent = err.code === 'permission-denied'
      ? 'Esa hora se acaba de tomar. Elige otra, por favor.'
      : 'No pudimos guardar tu reserva. Inténtalo de nuevo en un momento.';
    errorEl.hidden = false;
  } finally {
    boton.disabled = false;
  }
});

$('#btn-otra').addEventListener('click', () => {
  Object.assign(R, { servicio: null, barbero: null, hora: null, pago: null });
  $('#form-reserva').reset();
  $('#res-ok').hidden = true;
  $('#form-reserva').hidden = false;
  escucharOcupadas();
});

/* ---------- Opiniones ---------- */
let estrellas = 0;
function pintarEstrellasInput() {
  $('#estrellas-input').innerHTML = [1, 2, 3, 4, 5].map((n) =>
    `<button type="button" class="estrella-btn ${n <= estrellas ? 'encendida' : ''}" role="radio" aria-checked="${n === estrellas}" aria-label="${n} ${n === 1 ? 'estrella' : 'estrellas'}" data-estrella="${n}">${n <= estrellas ? ESTRELLA(38) : ESTRELLA_VACIA(38)}</button>`).join('');
}
pintarEstrellasInput();
$('#estrellas-input').addEventListener('click', (e) => {
  const b = e.target.closest('[data-estrella]');
  if (!b) return;
  estrellas = Number(b.dataset.estrella);
  $('#op-error').hidden = true;
  pintarEstrellasInput();
});

$('#form-opinion').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = $('#op-nombre').value.trim();
  const comentario = $('#op-texto').value.trim();
  if (!estrellas || !nombre) { $('#op-error').textContent = 'Elige las estrellas y escribe tu nombre.'; $('#op-error').hidden = false; return; }
  try {
    await addDoc(collection(db, 'opiniones'), { nombre, estrellas, comentario, creada: serverTimestamp() });
    $('#op-gracias-texto').textContent = `${nombre}, calificaste la barbería con ${estrellas} ${estrellas === 1 ? 'estrella' : 'estrellas'}.`;
    $('#form-opinion').hidden = true;
    $('#op-gracias').hidden = false;
  } catch (err) {
    console.error(err);
    $('#op-error').textContent = 'No pudimos enviar tu opinión. Inténtalo de nuevo.';
    $('#op-error').hidden = false;
  }
});

onSnapshot(query(collection(db, 'opiniones'), orderBy('creada', 'desc')), (snap) => {
  const ops = snap.docs.map((d) => d.data()).filter((o) => o.creada);
  if (!ops.length) return;
  const prom = ops.reduce((a, o) => a + o.estrellas, 0) / ops.length;
  $('#promedio-num').textContent = prom.toFixed(1).replace('.', ',');
  const llenas = Math.round(prom);
  $('#promedio-estrellas').innerHTML = [1, 2, 3, 4, 5].map((n) => (n <= llenas ? ESTRELLA(26) : ESTRELLA_VACIA(26))).join('');
  $('#promedio-texto').textContent = `Basado en ${ops.length} ${ops.length === 1 ? 'opinión' : 'opiniones'} de clientes.`;
  $('#lista-opiniones').innerHTML = ops.slice(0, 5).map((o) => `
    <div class="opinion">
      <div class="opinion-cab"><span>${esc(o.nombre)}</span><span aria-label="${o.estrellas} de 5">${'★'.repeat(o.estrellas)}</span></div>
      ${o.comentario ? `<p>${esc(o.comentario)}</p>` : ''}
    </div>`).join('');
});
$('#promedio-estrellas').innerHTML = [1, 2, 3, 4, 5].map(() => ESTRELLA_VACIA(26)).join('');

pintarOpciones();
