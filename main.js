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

function verificarAccesoPacing(numEj) {
    const esAdmin = localStorage.getItem('sler_modo_admin') === 'true' || localStorage.getItem('sler_usuario_premium') === 'true';
    if (esAdmin) return true;
    return true;
}

export async function cargarEjercicio(numEj) {
  const targetEj = parseInt(numEj);
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
    if (placeholder) placeholder.classList.add("hidden");
    ejecutarSlerLayout();
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
    tiempoTotalAcumuladoSegundos += segundosTranscurridosActual;
    localStorage.setItem("sler_tiempo_total", tiempoTotalAcumuladoSegundos);

    sonarCampanaFin();
    if (typeof window.registrarMarcaEnTabla === "function") window.registrarMarcaEnTabla(segundosTranscurridosActual);
    
    resetEstadoUI();

    if (ejercicioActivoNum < 88) {
      const siguienteEj = ejercicioActivoNum + 1;
      if (typeof window.seleccionarEjercicioGlobal === "function") {
        window.seleccionarEjercicioGlobal(siguienteEj);
      } else {
        cargarEjercicio(siguienteEj);
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
}

// Aplicación de la regla de caracteres (umbral estricto para evitar desbordamiento)
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
        const cantidadCaracteres = l.texto ? l.texto.length : 0;
        
        let fontSize = "44px";
        if (cantidadCaracteres > 22) {
          fontSize = "22px";
        } else if (cantidadCaracteres > 14) {
          fontSize = "30px";
        }

        return `
          <div class="linea-sler-wrapper" style="text-align: ${esPar ? 'right' : 'left'}; width: 100%; margin-bottom: 12px; overflow: hidden;">
            <span class="linea-texto-dinamico" style="display: inline-block; color: ${esPar ? '#1e40af' : '#0f172a'}; font-family: monospace; font-weight: bold; white-space: nowrap; font-size: ${fontSize};">
              ${l.texto}
            </span>
          </div>
        `;
      }).join("");
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
