// pacing.js - Control de tiempos y límites (3 a 7 días)
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

    validarAcceso: function(tandaObjetivo) {
        // Verificamos si estás en modo admin (efecto fantasma)
        const esAdmin = localStorage.getItem('sler_modo_admin') === 'true' || 
                        (typeof window !== 'undefined' && window.usuarioEsAdmin === true);

        const estado = this.obtenerEstado();
        const dias = estado.dias;

        // Regla 1: Plazo máximo global de 7 días
        if (dias > 7) {
            if (esAdmin) {
                console.warn("[EFECTO FANTASMA ADMIN] Se habria bloqueado por plazo de 7 días.");
                return { permitido: true }; // Te deja pasar simulando el aviso
            }
            return { 
                permitido: false, 
                mensaje: "Ha finalizado el plazo máximo de 7 días para completar el itinerario." 
            };
        }

        // Regla 2: Día 1 - Máximo 50% (Tandas 1 a 5 / Ejercicios 1 a 51)
        if (dias < 1 && tandaObjetivo > 5) {
            if (esAdmin) {
                alert("[MODO FANTASMA ADMIN] Simulación de bloqueo: Has alcanzado el límite diario (50%). La Tanda " + tandaObjetivo + " estaría bloqueada para un usuario común.");
                return { permitido: true }; // Te muestra el cartel pero te deja pasar
            }
            return { 
                permitido: false, 
                mensaje: "Has alcanzado el límite diario (50%). La Tanda " + tandaObjetivo + " estará disponible mañana." 
            };
        }

        // Regla 3: Tanda 10 reservada para el Día 3 en adelante (mínimo 48h transcurridas)
        if (tandaObjetivo === 10 && dias < 2) {
            if (esAdmin) {
                alert("[MODO FANTASMA ADMIN] Simulación de bloqueo: La tanda final requiere un mínimo de 3 días de asimilación acumulada.");
                return { permitido: true }; // Te muestra el cartel pero te deja pasar
            }
            return { 
                permitido: false, 
                mensaje: "La tanda final requiere un mínimo de 3 días de asimilación acumulada." 
            };
        }

        return { permitido: true };
    }
};
