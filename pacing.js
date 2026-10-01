// pacing.js - Control de tiempos, límites y secuencia pedagógica por sesión
import { db } from "./main.js";

export const PacingControl = {
    obtenerEstado: function() {
        let inicio = localStorage.getItem('sler_pacing_inicio');
        if (!inicio) {
            inicio = Date.now();
            localStorage.setItem('sler_pacing_inicio', inicio);
        }
        
        const msegTranscurridos = Date.now() - parseInt(inicio);
        const diasTranscurridos = msegTranscurridos / (1000 * 60 * 60 * 24);
        
        return {
            inicio: parseInt(inicio),
            dias: diasTranscurridos
        };
    },

    obtenerProgresoSesion: function() {
        let progreso = sessionStorage.getItem('sler_progreso_sesion');
        if (!progreso) {
            const estadoInicial = { ejercicioMaximo: 1 };
            sessionStorage.setItem('sler_progreso_sesion', JSON.stringify(estadoInicial));
            return estadoInicial;
        }
        return JSON.parse(progreso);
    },

    actualizarProgresoSesion: function(numEj) {
        let progreso = this.obtenerProgresoSesion();
        if (numEj > progreso.ejercicioMaximo) {
            progreso.ejercicioMaximo = numEj;
            sessionStorage.setItem('sler_progreso_sesion', JSON.stringify(progreso));
        }
    },

    validarAcceso: function(tandaObjetivo, numEjercicioObjetivo = 1) {
        const esAdmin = localStorage.getItem('sler_modo_admin') === 'true' || 
                        (typeof window !== 'undefined' && window.usuarioEsAdmin === true) ||
                        (typeof window !== 'undefined' && window.usuarioPremium === true);

        // Regla 0: Secuencia obligatoria estricta para usuario no admin (vía sessionStorage)
        if (!esAdmin && numEjercicioObjetivo > 1) {
            const progreso = this.obtenerProgresoSesion();
            if (numEjercicioObjetivo > progreso.ejercicioMaximo + 1) {
                return { 
                    permitido: false, 
                    mensaje: "Acceso denegado. Debes completar los ejercicios anteriores de forma estrictamente secuencial." 
                };
            }
        }

        const estado = this.obtenerEstado();
        const dias = estado.dias;

        // Regla 1: Plazo máximo global de 7 días
        if (dias > 7) {
            if (esAdmin) {
                alert("[EFECTO FANTASMA] Simulación: Fin de plazo de 7 días (Admin con pase libre).");
                return { permitido: true };
            }
            return { 
                permitido: false, 
                mensaje: "Ha finalizado el plazo máximo de 7 días para completar el itinerario." 
            };
        }

        // Regla 2: Día 1 - Máximo 50% (Tandas 1 a 5 / Ejercicios 1 a 51)
        if (dias < 1 && tandaObjetivo > 5) {
            if (esAdmin) {
                alert("[EFECTO FANTASMA] Simulación: Límite diario del 50% alcanzado (Tanda " + tandaObjetivo + "). Acceso concedido por rol admin.");
                return { permitido: true };
            }
            return { 
                permitido: false, 
                mensaje: "Has alcanzado el límite diario (50%). La Tanda " + tandaObjetivo + " estará disponible mañana." 
            };
        }

        // Regla 3: Tanda 10 reservada para el Día 3 en adelante (mínimo 48h transcurridas)
        if (tandaObjetivo === 10 && dias < 2) {
            if (esAdmin) {
                alert("[EFECTO FANTASMA] Simulación: Tanda 10 requiere 3 días. Acceso concedido por rol admin.");
                return { permitido: true };
            }
            return { 
                permitido: false, 
                mensaje: "La tanda final requiere un mínimo de 3 días de asimilación acumulada." 
            };
        }

        return { permitido: true };
    }
};
