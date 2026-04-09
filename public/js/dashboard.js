// --- 1. SEGURIDAD Y CARGA DE USUARIO ---
const usuarioGuardado = localStorage.getItem('usuarioActual');
const tokenGuardado = localStorage.getItem('token'); // <-- SACAMOS EL GAFETE

// Si no hay usuario o no hay gafete, lo mandamos a volar al login
if (!usuarioGuardado || !tokenGuardado) {
    window.location.href = "login.html";
}

const usuarioActual = JSON.parse(usuarioGuardado);
document.querySelector('.header span').innerHTML = `Bienvenido, <strong>${usuarioActual.nombre}</strong>`;

// --- 2. VARIABLES GLOBALES ---
let misTareas = [];
let filtroActivo = "Todas"; 
const contenedorTareas = document.getElementById('listaTareas');

// --- 3. FUNCIONES DE FECHAS ---
function calcularDiasRestantes(fechaVencimientoStr) {
    const fechaVence = new Date(fechaVencimientoStr);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); 

    // 2. Extraemos la fecha de la tarea con cuidado para evitar errores de zona horaria
    const partesFecha = tarea.fechavencimiento.split('-'); // Separa "2026-04-09"
    // Nota: En JS los meses empiezan en 0, por eso restamos 1 al mes
    const fechaVence = new Date(partesFecha[0], partesFecha[1] - 1, partesFecha[2]);
    fechaVence.setHours(0, 0, 0, 0); // También la dejamos en 00:00:00

    // 3. Ahora sí, hacemos la comparación exacta
    let estadoVisual = tarea.estado;

    if (estadoVisual !== 'Completada') {
        if (fechaVence < hoy) {
            // La tarea SÍ está desfasada (ya es 10 de abril o posterior)
            estadoVisual = 'Desfasada';
        } else if (fechaVence.getTime() === hoy.getTime()) {
            // La tarea VENCE HOY (puedes dejarla como 'Pendiente' o crear una alerta visual nueva)
            estadoVisual = 'Vence Hoy'; 
        }
    }
    
}

function formatearFecha(fechaStr) {
    if (!fechaStr) return "";
    const partes = fechaStr.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// --- 4. OBTENER TAREAS DESDE EL SERVIDOR ---
async function cargarTareas() {
    try {
        const respuesta = await fetch(`/api/tareas/${usuarioActual.nombre}`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${tokenGuardado}` // <-- MOSTRAMOS EL GAFETE
            }
        });
        if (respuesta.ok) {
            misTareas = await respuesta.json(); 
            renderizarTareas();
        } else {
            console.error("Error al cargar las tareas");
        }
    } catch (error) {
        console.error("Error de conexión:", error);
    }
}

// --- 5. CAMBIAR ESTADO (ACTUALIZADO CON FECHAS) ---
async function cambiarEstadoTarea(idTarea, nuevoEstado) {
    try {
        const ahora = new Date();
        const fechaFormateada = ahora.toLocaleString(); 

        const datosActualizados = {
            estado: nuevoEstado,
            fechaModificacion: fechaFormateada,
            fechaTermino: nuevoEstado === 'Completada' ? fechaFormateada : null 
        };

        const respuesta = await fetch(`/api/tareas/${idTarea}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenGuardado}` // <-- MOSTRAMOS EL GAFETE
            },
            body: JSON.stringify(datosActualizados)
        });

        if (respuesta.ok) {
            const tarea = misTareas.find(t => t.id === idTarea);
            if (tarea) {
                tarea.estado = nuevoEstado;
                tarea.fechamodificacion = datosActualizados.fechaModificacion;
                tarea.fechatermino = datosActualizados.fechaTermino;
                renderizarTareas(); 
            }
        }
    } catch (error) {
        console.error("Error al actualizar estado:", error);
    }
}

// --- NUEVO: FUNCION PARA ELIMINAR TAREA ---
async function eliminarTarea(idTarea) {
    const confirmar = confirm("¿Estás seguro de que deseas eliminar esta tarea permanentemente?");
    if (!confirmar) return; 

    try {
        const respuesta = await fetch(`/api/tareas/${idTarea}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${tokenGuardado}` // <-- MOSTRAMOS EL GAFETE
            }
        });

        if (respuesta.ok) {
            cargarTareas(); 
        } else {
            console.error("Error al intentar eliminar la tarea");
            alert("No se pudo eliminar la tarea.");
        }
    } catch (error) {
        console.error("Error de red:", error);
    }
}

// --- 6. DIBUJAR LAS TAREAS ---
function renderizarTareas() {
    contenedorTareas.innerHTML = "";

    misTareas.forEach(tarea => {
        const diasFaltantes = calcularDiasRestantes(tarea.fechavencimiento);
        if (diasFaltantes < 0 && tarea.estado !== "Completada" && tarea.estado !== "Cancelada") {
            tarea.estado = "Desfasada"; 
        }
        
        if (typeof fechaModalAbierto !== 'undefined' && fechaModalAbierto !== null) {
            abrirModalAgenda(fechaModalAbierto);
        }
        
        const contenedorCal = document.getElementById('contenedorCalendario');
        if (contenedorCal && contenedorCal.style.display === 'block') {
            generarCalendario();
        }
    });

    let tareasAFiltrar = [...misTareas];

    if (filtroActivo !== "Todas") {
        tareasAFiltrar = tareasAFiltrar.filter(tarea => tarea.estado === filtroActivo);
    }

    const textoBuscado = document.getElementById('buscadorTexto') ? document.getElementById('buscadorTexto').value.toLowerCase().trim() : "";
    if (textoBuscado !== "") {
        tareasAFiltrar = tareasAFiltrar.filter(tarea => 
            tarea.descripcion.toLowerCase().includes(textoBuscado)
        );
    }

    const orden = document.getElementById('ordenTareas') ? document.getElementById('ordenTareas').value : 'defecto';
    
    if (orden === 'proximas') {
        tareasAFiltrar.sort((a, b) => calcularDiasRestantes(a.fechavencimiento) - calcularDiasRestantes(b.fechavencimiento));
    } else if (orden === 'lejanas') {
        tareasAFiltrar.sort((a, b) => calcularDiasRestantes(b.fechavencimiento) - calcularDiasRestantes(a.fechavencimiento));
    }

    tareasAFiltrar.forEach(tarea => {
        const diasFaltantes = calcularDiasRestantes(tarea.fechavencimiento);
        
        let colorBorde = "#ffc107"; 
        let colorTextoDias = "inherit";
        let textoDias = `Quedan: ${diasFaltantes} días`;

        if (tarea.estado === "Desfasada") {
            colorBorde = "#dc3545"; colorTextoDias = "#dc3545"; textoDias = `Atrasada por ${Math.abs(diasFaltantes)} días`;
        } else if (tarea.estado === "En Proceso") {
            colorBorde = "#007bff"; 
        } else if (tarea.estado === "Completada") {
            colorBorde = "#28a745"; colorTextoDias = "#28a745"; textoDias = "¡Completada!";
        } else if (tarea.estado === "Cancelada") {
            colorBorde = "#6c757d"; colorTextoDias = "#6c757d"; textoDias = "Cancelada";
        } else if (diasFaltantes === 0 && tarea.estado === "Pendiente") {
             textoDias = "¡Vence HOY!"; colorBorde = "#fd7e14"; colorTextoDias = "#fd7e14";
        }

        const tarjetaHTML = `
            <div class="tarea-card" style="border-left-color: ${colorBorde};">
                <div>
                    <h4 class="tarea-titulo">${tarea.descripcion}</h4>
                    <small class="tarea-fecha">Registrada: ${formatearFecha(tarea.fecharegistro)} | Vence: ${formatearFecha(tarea.fechavencimiento)}</small>
                    <div style="margin-top: 10px;">
                        <label style="font-size: 0.8em; color: #555;">Cambiar estado:</label>
                        <select onchange="cambiarEstadoTarea(${tarea.id}, this.value)" style="padding: 3px; font-size: 0.8em; border-radius:3px;">
                            <option value="Pendiente" ${tarea.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="En Proceso" ${tarea.estado === 'En Proceso' ? 'selected' : ''}>En Proceso</option>
                            <option value="Completada" ${tarea.estado === 'Completada' ? 'selected' : ''}>Completada</option>
                            <option value="Cancelada" ${tarea.estado === 'Cancelada' ? 'selected' : ''}>Cancelada</option>
                        </select>
                        
                        <button onclick="abrirModalEditar(${tarea.id})" class="btn-amarillo btn-sm espaciado-izq">
                            Editar
                        </button>

                        <button onclick="eliminarTarea(${tarea.id})" class="btn-rojo btn-sm espaciado-izq">
                            Eliminar
                        </button>
                    </div>
                </div>
                <div class="texto-derecha">
                    <span class="estado-etiqueta" style="background-color: ${colorBorde}; color: white;">${tarea.estado}</span>
                    <p class="tarea-dias" style="color: ${colorTextoDias};"><strong>${textoDias}</strong></p>
                </div>
            </div>
        `;
        contenedorTareas.innerHTML += tarjetaHTML;
    });
}

// --- 7. REGISTRAR TAREA Y GUARDAR ---
document.getElementById('btnAgregar').addEventListener('click', async function() {
    const descripcion = document.getElementById('descTarea').value.trim();
    const fechaVencimiento = document.getElementById('fechaVencimiento').value;

    // Dentro de tu función de registrar tarea:
    const descripcion = document.getElementById('descTarea').value;
    const fechaVence = document.getElementById('fechaVencimiento').value;
    const recordatorioActivo = document.getElementById('activarRecordatorio').checked;
    let horaFinal = null;

    if (recordatorioActivo) {
        horaFinal = document.getElementById('horaRecordatorio').value;
    }
    // Ese 'horaFinal' es el que envías al servidor (será un string como "09:40" o null)

    if (descripcion === "" || fechaVencimiento === "") return alert("Faltan datos.");

    const hoy = new Date();
    
    const nuevaTarea = {
        usuario: usuarioActual.nombre, 
        descripcion: descripcion,
        fechaRegistro: hoy.toISOString().split('T')[0],
        fechaVencimiento: fechaVencimiento,
        estado: "Pendiente" 
    };

    try {
        const respuesta = await fetch('/api/tareas', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenGuardado}` // <-- MOSTRAMOS EL GAFETE
            },
            body: JSON.stringify(nuevaTarea)
        });

        if (respuesta.ok) {
            document.getElementById('descTarea').value = "";
            document.getElementById('fechaVencimiento').value = "";
            cargarTareas(); 
        }
    } catch (error) {
        console.error("Error al guardar la tarea:", error);
    }
});

// --- 8. BOTONES DE FILTRO ---
const diccionarioFiltros = {
    "Todas": "Todas", "Pendientes": "Pendiente", "En Proceso": "En Proceso", 
    "Completadas": "Completada", "Desfasadas": "Desfasada"
};

const botonesFiltro = document.querySelectorAll('.filtros button');
botonesFiltro.forEach(boton => {
    boton.addEventListener('click', function() {
        const textoBoton = this.innerText.trim();
        filtroActivo = diccionarioFiltros[textoBoton]; 
        document.querySelector('.header h2').innerText = `Mis Tareas - ${textoBoton}`;
        renderizarTareas();
    });
});

// --- 9. CERRAR SESIÓN ---
document.getElementById('btnCerrarSesion').addEventListener('click', function() {
    localStorage.removeItem('usuarioActual'); 
    localStorage.removeItem('token'); // <-- DESTRUIMOS EL GAFETE AL SALIR
    window.location.href = "login.html"; 
});

// --- EXTRA: EXPORTAR A EXCEL ---
document.getElementById('btnExportar').addEventListener('click', function() {
    if (misTareas.length === 0) {
        return alert("No hay tareas para exportar.");
    }

    const datosLimpios = misTareas.map(tarea => {
        return {
            "ID de Sistema": tarea.id,
            "Descripción de la Tarea": tarea.descripcion,
            "Estado Actual": tarea.estado,
            "Fecha de Registro": formatearFecha(tarea.fecharegistro),
            "Fecha de Vencimiento": formatearFecha(tarea.fechavencimiento)
        };
    });

    const hojaDeTrabajo = XLSX.utils.json_to_sheet(datosLimpios);
    const libroDeExcel = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libroDeExcel, hojaDeTrabajo, "Mis Pendientes");

    const fechaHoy = new Date().toISOString().split('T')[0];
    const nombreArchivo = `Reporte_Tareas_${usuarioActual.nombre}_${fechaHoy}.xlsx`;
    
    XLSX.writeFile(libroDeExcel, nombreArchivo);
});


// ==========================================
// --- NUEVO: CALENDARIO Y PANTALLA EMERGENTE ---
// ==========================================

function buscarPorDia() {
    const fecha = document.getElementById('filtroDia').value;
    if (!fecha) return alert("Por favor selecciona una fecha.");
    abrirModalAgenda(fecha); 
}

function generarCalendario() {
    const mesAnio = document.getElementById('filtroMes').value; 
    if (!mesAnio) return alert("Por favor selecciona un mes y año.");

    const [anio, mes] = mesAnio.split('-');
    const diasEnMes = new Date(anio, mes, 0).getDate();
    const primerDiaSemana = new Date(anio, mes - 1, 1).getDay(); 

    let html = `
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; text-align: center;">
            <div style="background: #2c3e50; color: white; padding: 5px; border-radius: 3px;">Dom</div>
            <div style="background: #2c3e50; color: white; padding: 5px; border-radius: 3px;">Lun</div>
            <div style="background: #2c3e50; color: white; padding: 5px; border-radius: 3px;">Mar</div>
            <div style="background: #2c3e50; color: white; padding: 5px; border-radius: 3px;">Mié</div>
            <div style="background: #2c3e50; color: white; padding: 5px; border-radius: 3px;">Jue</div>
            <div style="background: #2c3e50; color: white; padding: 5px; border-radius: 3px;">Vie</div>
            <div style="background: #2c3e50; color: white; padding: 5px; border-radius: 3px;">Sáb</div>
    `;

    for (let i = 0; i < primerDiaSemana; i++) {
        html += `<div style="padding: 10px; background: #f9f9f9; border: 1px solid #eee; border-radius: 4px;"></div>`;
    }

    for (let dia = 1; dia <= diasEnMes; dia++) {
        const diaFormateado = dia.toString().padStart(2, '0');
        const fechaCompleta = `${anio}-${mes}-${diaFormateado}`;
        
        const tareasDelDia = misTareas.filter(t => t.fechavencimiento === fechaCompleta && (t.estado === 'Pendiente' || t.estado === 'En Proceso'));
        
        let estiloFondo = "#fff";
        let cursor = "default";
        let eventoClic = "";
        let indicador = "";

        if (tareasDelDia.length > 0) {
            estiloFondo = "#fff3cd"; 
            cursor = "pointer";
            eventoClic = `onclick="abrirModalAgenda('${fechaCompleta}')"`;
            indicador = `<div style="background: #e74c3c; color: white; border-radius: 50%; width: 22px; height: 22px; margin: 5px auto 0; font-size: 0.8em; font-weight: bold; line-height: 22px;">${tareasDelDia.length}</div>`;
        }

        html += `
            <div ${eventoClic} style="padding: 10px; border: 1px solid #ddd; background: ${estiloFondo}; cursor: ${cursor}; border-radius: 4px; transition: 0.2s;">
                <strong style="color: #333;">${dia}</strong>
                ${indicador}
            </div>
        `;
    }

    html += `</div>`; 
    
    const contenedor = document.getElementById('contenedorCalendario');
    contenedor.innerHTML = html;
    contenedor.style.display = 'block';
}

let fechaModalAbierto = null;

function abrirModalAgenda(fecha) {
    fechaModalAbierto = fecha; 
    document.getElementById('tituloModal').innerText = `Tareas del ${formatearFecha(fecha)}`;
    
    const tareasDelDia = misTareas.filter(t => t.fechavencimiento === fecha);
    const contenedorContenido = document.getElementById('contenidoModal');
    contenedorContenido.innerHTML = "";

    if (tareasDelDia.length === 0) {
        contenedorContenido.innerHTML = `<p style="text-align: center; color: #666; margin-top: 20px;">No hay tareas para este día. ¡Día libre! 🎉</p>`;
    } else {
        tareasDelDia.forEach(tarea => {
            let colorBorde = '#ffc107'; 
            if (tarea.estado === 'En Proceso') colorBorde = '#007bff';
            if (tarea.estado === 'Completada') colorBorde = '#28a745';
            if (tarea.estado === 'Cancelada' || tarea.estado === 'Desfasada') colorBorde = '#dc3545';

            contenedorContenido.innerHTML += `
                <div style="border-left: 5px solid ${colorBorde}; background: #f8f9fa; padding: 15px; margin-bottom: 12px; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <h4 style="margin: 0 0 5px 0; color: #333;">${tarea.descripcion}</h4>
                    <p style="margin: 0 0 10px 0; font-size: 0.8em; color: #666;">Registrada el: ${formatearFecha(tarea.fecharegistro)}</p>
                    
                    <div style="display: flex; gap: 10px; align-items: center; border-top: 1px solid #eaeaea; padding-top: 10px;">
                        <select onchange="cambiarEstadoTarea(${tarea.id}, this.value)" style="padding: 4px; font-size: 0.85em; border-radius:3px; border: 1px solid #ccc;">
                            <option value="Pendiente" ${tarea.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="En Proceso" ${tarea.estado === 'En Proceso' ? 'selected' : ''}>En Proceso</option>
                            <option value="Completada" ${tarea.estado === 'Completada' ? 'selected' : ''}>Completada</option>
                            <option value="Cancelada" ${tarea.estado === 'Cancelada' ? 'selected' : ''}>Cancelada</option>
                        </select>
                        
                        <button onclick="eliminarTarea(${tarea.id})" class="btn-rojo btn-sm">
                            Eliminar
                        </button>
                    </div>
                </div>
            `;
        });
    }

    document.getElementById('modalAgenda').style.display = 'flex';
}

function cerrarModal() {
    fechaModalAbierto = null; 
    document.getElementById('modalAgenda').style.display = 'none';
}

cargarTareas();

document.getElementById('buscadorTexto').addEventListener('input', function() {
    renderizarTareas(); 
});

function abrirModalEditar(idTarea) {
    const tarea = misTareas.find(t => t.id === idTarea);
    if (!tarea) return;

    document.getElementById('editIdTarea').value = tarea.id;
    document.getElementById('editDescTarea').value = tarea.descripcion;
    document.getElementById('editFechaVencimiento').value = tarea.fechavencimiento;

    document.getElementById('modalEditar').style.display = 'flex';
}

function cerrarModalEditar() {
    document.getElementById('modalEditar').style.display = 'none';
}

async function guardarEdicionTarea() {
    const idTarea = document.getElementById('editIdTarea').value;
    const nuevaDesc = document.getElementById('editDescTarea').value.trim();
    const nuevaFecha = document.getElementById('editFechaVencimiento').value;

    if (!nuevaDesc || !nuevaFecha) {
        return alert("¡Ey! La descripción y la fecha no pueden estar vacías.");
    }

    const ahora = new Date();
    const fechaModificacion = ahora.toLocaleString();

    try {
        const respuesta = await fetch(`/api/tareas/editar/${idTarea}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenGuardado}` // <-- MOSTRAMOS EL GAFETE
            },
            body: JSON.stringify({ 
                descripcion: nuevaDesc, 
                fechaVencimiento: nuevaFecha, 
                fechaModificacion: fechaModificacion 
            })
        });

        if (respuesta.ok) {
            cerrarModalEditar(); 
            cargarTareas(); 
        } else {
            alert("Hubo un error al intentar guardar los cambios.");
        }
    } catch (error) {
        console.error("Error de red:", error);
    }
}

function toggleReloj() {
    const checkbox = document.getElementById('activarRecordatorio');
    const contenedor = document.getElementById('contenedorReloj');
    contenedor.style.display = checkbox.checked ? 'inline-block' : 'none';
}

function lanzarNotificacion(tarea) {
    const notif = new Notification("⏰ Tarea Pendiente", {
        body: tarea.descripcion,
        requireInteraction: true // Mantiene la notificación visible hasta que el usuario interactúe
    });

    notif.onclick = () => {
        // Al hacer clic, preguntamos si desea posponer
        const respuesta = confirm(`Tarea: ${tarea.descripcion}\n\n¿Deseas posponerla 10 minutos?`);
        
        if (respuesta) {
            // Calculamos 10 minutos más
            const ahora = new Date();
            ahora.setMinutes(ahora.getMinutes() + 10);
            
            const nuevaHora = ahora.getHours().toString().padStart(2, '0') + ":" + 
                              ahora.getMinutes().toString().padStart(2, '0');
            
            // Actualizamos la hora solo en la memoria para que vuelva a sonar
            tarea.horarecordatorio = nuevaHora;
            alert("Recordatorio pospuesto por 10 minutos.");
        }
    };
}