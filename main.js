// main.js - Lógica central del módulo de entrenamiento SLER con bypass administrativo total
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { PacingControl } from "./pacing.js";

const firebaseConfig = {
  apiKey: "AIzaSyA1VUXm-OtZE30X4Ugv06VYUKY7RcneKDg",
  authDomain: "sler-chat-lab.firebaseapp.com",
  databaseURL: "https://sler-chat-lab-default-rtdb.firebaseio.com",
  projectId: "sler-chat-lab",
  storageBucket: "sler-chat-lab.firebasestorage.app",
  messagingSenderId: "594954603335",
  appId: "1:594954603335:web:02f0183659d8c752521a62",
  measurementId: "G-X4Z6HLBF2H"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

let ejercicioActivoNum = 1;
let datosEjercicioActual = null;
let estado = "start";
let tiempoInicioMs = 0;
let cronometro = null;
let globalPID = 0;

let tiempoTotalAcumuladoSegundos = parseInt(localStorage.getItem("sler_tiempo_total") || "0");

function obtenerTandaPorEjercicio(numEj) {
    if (numEj <= 11) return 1;
    if (numEj <= 21) return 2;
    if (numEj <= 31) return 3;
    if (numEj <= 41) return 4;
    if (numEj <= 51) return 5;
    if (numEj <= 61) return 6;
    if (numEj <= 71) return 7;
    if (numEj <= 81) return 8;
    if (numEj <= 87) return 9;
    return 10;
}

function verificarAccesoPacing(numEj) {
    const tanda = obtenerTandaPorEjercicio(numEj);
    
    const esAdmin = localStorage.getItem('sler_modo_admin') === 'true' || 
                    localStorage.getItem('sler_usuario_premium') === 'true' ||
                    (typeof window !== 'undefined' && window.usuarioEsAdmin === true) ||
                    (typeof window !== 'undefined' && window.usuarioPremium === true);

    if (esAdmin) {
        return true;
    }

    if (numEj > 21) {
        const progreso = PacingControl.obtenerProgresoSesion();
        if (progreso.ejercicioMaximo < 21) {
            if (typeof window.mostrarPantallaPromocionGeneral === "function") {
                window.mostrarPantallaPromocionGeneral();
            }
            return false;
        }
    }

    const validacion = PacingControl.validarAcceso(tanda, numEj);
    if (!validacion.permitido) {
        alert(validacion.mensaje);
        return false;
    }
    return true;
}

export async function cargarEjercicio(numEj) {
  const targetEj = parseInt(numEj);

  if (!verificarAccesoPacing(targetEj)) {
    if (typeof window.seleccionarEjercicioGlobal === "function") {
      window.seleccionarEjercicioGlobal(ejercicioActivoNum);
    }
    return;
  }

  ejercicioActivoNum = targetEj;
  globalPID++;
  resetEstadoUI();
  actualizarEncabezadoUI(`Cargando Ej. ${ejercicioActivoNum}...`);

  try {
    const docRef = doc(db, "ejercicios", `ej_${ejercicioActivoNum}`);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      datosEjercicioActual = docSnap.data();
      prepararVistaEjercicio();
    } else {
      actualizarEncabezadoUI(`Ej. ${ejercicioActivoNum} (No encontrado)`);
    }
  } catch (error) {
    console.error("Error al obtener ejercicio:", error);
    actualizarEncabezadoUI("Error de conexión");
  }
}

function prepararVistaEjercicio() {
  const display = document.getElementById("display-sler");
  const render = document.getElementById("render");
  const placeholder = document.getElementById("placeholder");
  const selectEj = document.getElementById("select-ejercicio-global");

  if (selectEj) selectEj.value = ejercicioActivoNum;
  actualizarEncabezadoUI(`NIVEL ${datosEjercicioActual?.nivel || (ejercicioActivoNum === 88 ? "5 (TOP)" : 1)} / EJERCICIO ${ejercicioActivoNum}`);

  if (datosEjercicioActual && datosEjercicioActual.tipo_flujo === "taquistoscopio") {
    if (render) render.classList.add("hidden");
    if (placeholder) placeholder.classList.add("hidden");
    if (display) {
      display.classList.remove("hidden");
      display.style.color = "#0f172a";
      display.innerText = `EJ. ${ejercicioActivoNum}`;
    }
  } else {
    if (display) display.classList.add("hidden");
    if (render) render.classList.add("hidden");
    if (placeholder) {
      placeholder.classList.remove("hidden");
      placeholder.innerText = `EJ. ${ejercicioActivoNum} LISTO`;
    }
  }
}

export async function manejarDisparo() {
  const btn = document.getElementById("btn");
  const esAdmin = localStorage.getItem('sler_modo_admin') === 'true';

  if (estado === "start") {
    estado = "stop";
    if (btn) {
      btn.innerText = "DETENER";
      btn.className = "bg-red-500 hover:bg-red-600 text-white font-black text-2xl py-3 px-16 rounded-lg shadow-xl uppercase tracking-wider transition transform active:scale-95 border-2 border-red-300";
    }
    iniciarCronometro();

    if (datosEjercicioActual) {
      if (datosEjercicioActual.tipo_flujo === "taquistoscopio") {
        await ejecutarTaquistoscopio();
      } else {
        ejecutarSlerLayout();
      }
    }
  } else {
    const segundosTranscurridosActual = Math.floor((Date.now() - tiempoInicioMs) / 1000);
    
    if (segundosTranscurridosActual < 3 && !esAdmin) {
      alert("Demasiado rápido. Debes permanecer al menos 3 segundos procesando el estímulo visual antes de finalizar el ejercicio.");
      return;
    }

    tiempoTotalAcumuladoSegundos += segundosTranscurridosActual;
    localStorage.setItem("sler_tiempo_total", tiempoTotalAcumuladoSegundos);

    sonarCampanaFin();
    if (typeof window.registrarMarcaEnTabla === "function") window.registrarMarcaEnTabla(segundosTranscurridosActual);
    
    PacingControl.actualizarProgresoSesion(ejercicioActivoNum + 1);

    resetEstadoUI();

    LanzarNotificacionTanda(ejercicioActivoNum);

    if (ejercicioActivoNum < 88) {
      const siguienteEj = ejercicioActivoNum + 1;
      if (verificarAccesoPacing(siguienteEj)) {
        if (typeof window.seleccionarEjercicioGlobal === "function") {
          window.seleccionarEjercicioGlobal(siguienteEj);
        } else {
          cargarEjercicio(siguienteEj);
        }
      }
    } else {
      if (typeof window.mostrarPantallaFinal === "function") window.mostrarPantallaFinal();
    }
  }
}

function sonarCampanaFin() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.8);
}

function LanzarNotificacionTanda(numEj) {
  const tandasDeFestejo = [11, 21, 31, 41, 51, 52, 71, 87, 88];
  if (tandasDeFestejo.includes(numEj)) tocarFanfarriaFestejo();

  setTimeout(() => {
    switch (numEj) {
      case 11: alert("¡Primera tanda completada!\n\nHas superado la fase introductoria silábica."); break;
      case 21: alert("¡Nivel 1 Superado!\n\nEntrando al Nivel 2: Barrido dinámico."); break;
      case 51: alert("¡Felicitaciones!\n\nHas completado el Nivel Elemental."); break;
      case 52: alert("¡Aquí empieza lo bueno!\n\nEntras a la lectura bidireccional real."); break;
      case 88: alert("¡Entrenamiento Completado!\n\nHas alcanzado el máximo rendimiento del programa SLER."); break;
    }
  }, 300);
}

function tocarFanfarriaFestejo() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const notas = [
    { freq: 523.25, dur: 0.15 }, { freq: 523.25, dur: 0.10 },
    { freq: 659.25, dur: 0.10 }, { freq: 783.99, dur: 0.40 }
  ];
  let tiempoInicio = ctx.currentTime;
  notas.forEach(n => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(n.freq, tiempoInicio);
    gain.gain.setValueAtTime(0.3, tiempoInicio);
    gain.gain.exponentialRampToValueAtTime(0.001, tiempoInicio + n.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(tiempoInicio);
    osc.stop(tiempoInicio + n.dur);
    tiempoInicio += n.dur + 0.02;
  });
}

async function ejecutarTaquistoscopio() {
  if (!datosEjercicioActual) return;
  const display = document.getElementById("display-sler");
  let currentPID = globalPID;
  let vel = datosEjercicioActual.velocidad_ms || 2200;

  if (Array.isArray(datosEjercicioActual.s)) {
    for (let silaba of datosEjercicioActual.s) {
      if (currentPID !== globalPID || estado === "start") return;
      display.innerText = silaba.toUpperCase();
      await new Promise((r) => setTimeout(r, vel));
    }
  }

  if (currentPID === globalPID && estado !== "start") {
    const palabraFinal = (datosEjercicioActual.f || datosEjercicioActual.p || "").toUpperCase();
    const lineas = palabraFinal.split("\n");
    const htmlLineas = lineas.map((linea, index) => {
      const esPar = index % 2 === 1;
      return `<div style="color: ${esPar ? "#dc2626" : "#1e40af"};">${linea}</div>`;
    }).join("");
    display.innerHTML = htmlLineas;
  }
}

function ejecutarSlerLayout() {
  const render = document.getElementById("render");
  const placeholder = document.getElementById("placeholder");
  if (placeholder) placeholder.classList.add("hidden");
  
  if (render) {
    render.scrollTop = 0;
    render.classList.remove("hidden");
    
    if (datosEjercicioActual && datosEjercicioActual.lineas && Array.isArray(datosEjercicioActual.lineas)) {
      render.innerHTML = datosEjercicioActual.lineas.map((l) => {
        const esPar = l.tipo === "C";
        return `
          <div class="linea-sler-wrapper" style="text-align: ${esPar ? 'right' : 'left'}; width: 100%; margin-bottom: 12px; overflow: hidden;">
            <span class="linea-texto-dinamico" style="display: inline-block; color: ${esPar ? '#1e40af' : '#0f172a'}; font-family: monospace; font-weight: bold; white-space: nowrap; font-size: 24px;">
              ${l.texto}
            </span>
          </div>
        `;
      }).join("");

      // Damos un pequeño respiro de 50ms para que el DOM de Tailwind y el Flexbox dibujen el ancho real
      setTimeout(() => {
        // Obtenemos el ancho real del contenedor padre (la caja blanca)
        const contenedorAncho = render.parentElement.clientWidth > 50 ? render.parentElement.clientWidth - 60 : 600;
        const wrappers = render.querySelectorAll('.linea-sler-wrapper');
        
        wrappers.forEach(wrapper => {
          const span = wrapper.querySelector('.linea-texto-dinamico');
          if (!span) return;

          let fontSize = 28; // Tamaño inicial controlado
          span.style.fontSize = `${fontSize}px`;

          // Bucle estricto de reducción hasta que el ancho del texto sea menor o igual al contenedor
          while (span.scrollWidth > contenedorAncho && fontSize > 12) {
            fontSize -= 1;
            span.style.fontSize = `${fontSize}px`;
          }
        });
      }, 50);
    }
  }
}
function iniciarCronometro() {
  tiempoInicioMs = Date.now();
  const reloj = document.getElementById("reloj");
  if (reloj) reloj.innerText = "00:00:01";
  if (cronometro) clearInterval(cronometro);

  cronometro = setInterval(() => {
    const segundosTranscurridos = Math.floor((Date.now() - tiempoInicioMs) / 1000);
    let s = segundosTranscurridos % 60;
    let m = Math.floor(segundosTranscurridos / 60);
    if (reloj) reloj.innerText = `00:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, 200);
}

function resetEstadoUI() {
  if (cronometro) clearInterval(cronometro);
  cronometro = null;
  tiempoInicioMs = 0;
  estado = "start";
  const reloj = document.getElementById("reloj");
  const btn = document.getElementById("btn");
  if (reloj) reloj.innerText = "00:00:00";
  if (btn) {
    btn.innerText = "START";
    btn.className = "bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-2xl py-3 px-16 rounded-lg shadow-xl uppercase tracking-wider transition transform active:scale-95 border-2 border-emerald-300";
  }
}

function actualizarEncabezadoUI(texto) {
  const label = document.getElementById("label-nivel");
  if (label) label.innerText = texto;
}

window.obtenerTiempoTotalFormateado = function() {
    let totalSegs = parseInt(localStorage.getItem("sler_tiempo_total") || "0");
    let h = Math.floor(totalSegs / 3600);
    let m = Math.floor((totalSegs % 3600) / 60);
    let s = totalSegs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};
