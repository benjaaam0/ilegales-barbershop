// App de los barberos: ver reservas (nombre, hora de llegada, servicio, pago) y cambiar su estado.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, collection, query, where, onSnapshot, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from '../js/firebase-config.js';
import { fechaISO } from '../js/datos.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setPersistence(auth, browserLocalPersistence);

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PAGOS = { online: 'Pago online', debito: 'Paga con débito', efectivo: 'Paga en efectivo' };
const ESTADOS = [
  { id: 'disponible', nombre: 'Disponible', ayuda: 'Puedo atender ahora', color: '#4ADE80' },
  { id: 'ocupado', nombre: 'Atendiendo', ayuda: 'Estoy con un cliente', color: '#FB923C' },
  { id: 'ausente', nombre: 'No disponible hoy', ayuda: 'No estoy trabajando hoy', color: '#8E8E99' }
];

let usuario = null;
let barbero = null;
let diaOffset = 0;
let reservas = [];
let nuevas = new Set();
let cancelar = [];

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ---------- Navegación ---------- */
function mostrar(vista) {
  ['login', 'reservas', 'estado'].forEach((v) => { $('#vista-' + v).hidden = v !== vista; });
  $('#pestanas').hidden = vista === 'login';
  $('#btn-salir').hidden = vista === 'login';
  document.querySelectorAll('#pestanas button').forEach((b) => {
    if (b.dataset.vista === vista) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}
$('#pestanas').addEventListener('click', (e) => { const b = e.target.closest('[data-vista]'); if (b) mostrar(b.dataset.vista); });

/* ---------- Sesión ---------- */
$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#login-error');
  err.hidden = true;
  try {
    await signInWithEmailAndPassword(auth, $('#correo').value.trim(), $('#clave').value);
  } catch (ex) {
    err.textContent = 'Correo o contraseña incorrectos.';
    err.hidden = false;
  }
});
$('#btn-salir').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (u) => {
  cancelar.forEach((fn) => fn());
  cancelar = [];
  usuario = u;
  if (!u) { mostrar('login'); return; }
  mostrar('reservas');
  cancelar.push(onSnapshot(doc(db, 'barberos', u.uid), (snap) => {
    barbero = snap.exists() ? snap.data() : null;
    const nombre = barbero?.nombre || 'barbero';
    $('#saludo').textContent = 'Hola, ' + nombre;
    $('#nombre-barbero').textContent = nombre;
    pintarEstado();
  }));
  escucharReservas();
  prepararNotificaciones();
});

/* ---------- Reservas ---------- */
function fechaActual() {
  const h = new Date();
  return fechaISO(new Date(h.getFullYear(), h.getMonth(), h.getDate() + diaOffset));
}

let cancelarReservas = null;
function escucharReservas() {
  if (cancelarReservas) cancelarReservas();
  let primera = true;
  const q = query(collection(db, 'reservas'), where('barberoId', '==', usuario.uid), where('fecha', '==', fechaActual()));
  cancelarReservas = onSnapshot(q, (snap) => {
    reservas = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.hora.localeCompare(b.hora));
    if (!primera) {
      snap.docChanges().filter((c) => c.type === 'added').forEach((c) => {
        const r = c.doc.data();
        nuevas.add(c.doc.id);
        avisar(r);
      });
    }
    primera = false;
    pintarReservas();
  }, (e) => {
    console.error(e);
    $('#lista-reservas').innerHTML = '<p class="vacio">No pudimos cargar tus reservas.</p>';
  });
  cancelar.push(() => cancelarReservas && cancelarReservas());
}

function pintarReservas() {
  const pend = reservas.filter((r) => r.estado !== 'atendido').length;
  $('#pendientes').textContent = pend === 1 ? '1 pendiente' : pend + ' pendientes';
  if (!reservas.length) {
    $('#lista-reservas').innerHTML = `<p class="vacio">No tienes reservas para ${diaOffset === 0 ? 'hoy' : 'mañana'}.</p>`;
    return;
  }
  $('#lista-reservas').innerHTML = reservas.map((r) => {
    const atendida = r.estado === 'atendido';
    const pagado = r.pagado || false;
    const pagoTxt = pagado ? 'Pagado' : (PAGOS[r.pago] || 'Pago por definir');
    const fono = r.telefono ? `<a class="cliente-fono" href="tel:${esc(r.telefono.replace(/\s/g, ''))}">${esc(r.telefono)}</a>` : '';
    return `<article class="reserva ${atendida ? 'atendida' : ''}">
      <div class="reserva-cab">
        <div class="llega"><small>${atendida ? 'Atendido' : 'Llega a las'}</small><strong>${esc(r.hora)}</strong></div>
        ${nuevas.has(r.id) && !atendida ? '<span class="nueva">Nueva</span>' : ''}
      </div>
      <div class="reserva-cuerpo">
        <div class="cliente">
          <span class="cliente-nombre">${esc(r.nombre)}</span>
          ${fono}
          <div class="pastillas">
            <span class="pastilla">${esc(r.servicio)}</span>
            <span class="pastilla ${pagado ? 'pastilla-pagado' : ''}">${esc(pagoTxt)}</span>
          </div>
        </div>
        <button type="button" class="btn-listo" data-id="${esc(r.id)}" data-atendida="${atendida}" aria-label="${atendida ? 'Deshacer' : 'Marcar a ' + esc(r.nombre) + ' como atendido'}">
          ${atendida ? 'Deshacer' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>Listo'}
        </button>
      </div>
    </article>`;
  }).join('');
}

$('#lista-reservas').addEventListener('click', async (e) => {
  const b = e.target.closest('.btn-listo');
  if (!b) return;
  b.disabled = true;
  const atendida = b.dataset.atendida === 'true';
  try {
    await updateDoc(doc(db, 'reservas', b.dataset.id), { estado: atendida ? 'pendiente' : 'atendido' });
  } catch (err) { console.error(err); b.disabled = false; }
});

document.querySelector('.dias').addEventListener('click', (e) => {
  const b = e.target.closest('.dia');
  if (!b) return;
  diaOffset = Number(b.dataset.dia);
  document.querySelectorAll('.dia').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  nuevas = new Set();
  escucharReservas();
});

/* ---------- Avisos ---------- */
function avisar(r) {
  const detalle = `${r.nombre} quiere ${r.servicio} a las ${r.hora}. ${PAGOS[r.pago] || ''}.`;
  $('#aviso-detalle').textContent = detalle;
  $('#aviso').hidden = false;
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  if ('Notification' in window && Notification.permission === 'granted') {
    const opciones = { body: detalle, icon: 'icons/icon-192.png', tag: 'reserva-' + r.hora };
    navigator.serviceWorker?.ready
      .then((reg) => reg.showNotification('Nueva reserva', opciones))
      .catch(() => new Notification('Nueva reserva', opciones));
  }
}
$('#cerrar-aviso').addEventListener('click', () => { $('#aviso').hidden = true; });

function prepararNotificaciones() {
  const btn = $('#btn-notif');
  if (!('Notification' in window) || Notification.permission !== 'default') { btn.hidden = true; return; }
  btn.hidden = false;
  btn.onclick = async () => { await Notification.requestPermission(); btn.hidden = true; };
}

/* ---------- Mi estado ---------- */
function pintarEstado() {
  const actual = barbero?.estado || 'ausente';
  $('#opciones-estado').innerHTML = ESTADOS.map((s) => `
    <button type="button" class="op-estado" data-estado="${s.id}" aria-pressed="${s.id === actual}">
      <span class="punto" style="background:${s.color}" aria-hidden="true"></span>
      <span class="txt"><b>${s.nombre}</b><small>${s.ayuda}</small></span>
      <svg class="check" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
    </button>`).join('');
}
$('#opciones-estado').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-estado]');
  if (!b || !usuario) return;
  try { await updateDoc(doc(db, 'barberos', usuario.uid), { estado: b.dataset.estado }); }
  catch (err) { console.error(err); alert('No se pudo cambiar tu estado.'); }
});
