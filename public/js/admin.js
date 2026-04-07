// --- 1. SEGURIDAD: VERIFICAR ROL DE ADMINISTRADOR ---
const usuarioGuardado = localStorage.getItem('usuarioActual');
const tokenGuardado = localStorage.getItem('token'); // <-- SACAMOS EL GAFETE

// Si no hay usuario o no hay gafete, lo mandamos al login
if (!usuarioGuardado || !tokenGuardado) {
    window.location.href = "login.html";
}

const usuarioActual = JSON.parse(usuarioGuardado);
// Si intenta entrar alguien que no es admin, lo rebotamos a su dashboard normal
if (usuarioActual.rol !== 'admin') {
    alert("Acceso denegado. No tienes permisos de administrador.");
    window.location.href = "dashboard.html";
}

// --- 2. CARGAR USUARIOS ---
async function cargarUsuarios() {
    try {
        const respuesta = await fetch('/api/admin/usuarios', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tokenGuardado}` // <-- MOSTRAMOS EL GAFETE
            }
        });
        const usuarios = await respuesta.json();
        
        const tbody = document.getElementById('tablaUsuarios');
        tbody.innerHTML = ""; 
        
        usuarios.forEach(user => {
            // Evitamos que el admin se elimine a sí mismo
            const botonEliminar = user.usuario === usuarioActual.nombre 
                ? `<span style="color: grey; font-size: 0.8em;">(Tú)</span>` 
                : `<button class="btn-rojo btn-sm" onclick="eliminarUsuario(${user.id}, '${user.usuario}')">Eliminar</button>`;

            tbody.innerHTML += `
                <tr>
                    <td>${user.id}</td>
                    <td><strong>${user.usuario}</strong></td>
                    <td>${user.rol}</td>
                    <td>${botonEliminar}</td>
                </tr>
            `;
        });
    } catch (error) { console.error("Error al cargar usuarios:", error); }
}

// --- 3. ELIMINAR USUARIOS ---
async function eliminarUsuario(id, nombre) {
    if(!confirm(`¿Estás SEGURO de eliminar permanentemente al usuario "${nombre}" y dejar sus tareas huérfanas?`)) return;
    
    try {
        const respuesta = await fetch(`/api/admin/usuarios/${id}`, { 
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${tokenGuardado}` // <-- MOSTRAMOS EL GAFETE
            }
        });
        if(respuesta.ok) cargarUsuarios(); 
    } catch (error) { console.error("Error al eliminar:", error); }
}

// --- 4. CARGAR TODAS LAS TAREAS DEL SISTEMA ---
async function cargarTodasLasTareas() {
    try {
        const respuesta = await fetch('/api/admin/tareas', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tokenGuardado}` // <-- MOSTRAMOS EL GAFETE
            }
        });
        const tareas = await respuesta.json();
        
        const tbody = document.getElementById('tablaTareas');
        tbody.innerHTML = ""; 
        
        tareas.forEach(tarea => {
            let color = "#ffc107"; 
            if(tarea.estado === 'En Proceso') color = "#007bff";
            if(tarea.estado === 'Completada') color = "#28a745";
            if(tarea.estado === 'Cancelada' || tarea.estado === 'Desfasada') color = "#dc3545";

            // Fechas en minúsculas por regla de PostgreSQL
            const modificado = tarea.fechamodificacion || "<em>Sin modificar</em>";
            const termino = tarea.fechatermino || "<em>No terminada</em>";
            const vencimiento = tarea.fechavencimiento || "<em>Sin fecha</em>";

            tbody.innerHTML += `
                <tr>
                    <td>${tarea.id}</td>
                    <td><strong>${tarea.usuario}</strong></td>
                    <td>${tarea.descripcion}</td>
                    <td><span class="estado-etiqueta" style="background-color: ${color};">${tarea.estado}</span></td>
                    <td>${vencimiento}</td>
                    <td><small>${modificado}</small></td>
                    <td><strong><small>${termino}</small></strong></td>
                </tr>
            `;
        });
    } catch (error) { console.error("Error al cargar tareas:", error); }
}

// --- 5. CERRAR SESIÓN ---
document.getElementById('btnCerrarSesion').addEventListener('click', function() {
    localStorage.removeItem('usuarioActual'); 
    localStorage.removeItem('token'); // <-- DESTRUIMOS EL GAFETE AL SALIR
    window.location.href = "login.html"; 
});

// --- 6. CREAR USUARIO DESDE EL PANEL ADMIN ---
document.getElementById('btnCrearUsuario').addEventListener('click', async () => {
    const usuario = document.getElementById('nuevoUsuario').value.trim();
    const password = document.getElementById('nuevoPassword').value;
    const rol = document.getElementById('nuevoRol').value;

    if (!usuario || !password) {
        return alert("Por favor, ingresa un nombre de usuario y una contraseña.");
    }

    try {
        // Apuntamos a la nueva ruta segura del servidor
        const respuesta = await fetch('/api/admin/registro', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenGuardado}` // <-- MOSTRAMOS EL GAFETE
            },
            body: JSON.stringify({ usuario, password, rol })
        });

        const datos = await respuesta.json();

        if (respuesta.ok) {
            document.getElementById('nuevoUsuario').value = "";
            document.getElementById('nuevoPassword').value = "";
            
            cargarUsuarios(); 
            alert("¡Usuario creado exitosamente!");
        } else {
            alert("Error: " + datos.error);
        }
    } catch (error) {
        console.error("Error al crear usuario:", error);
        alert("Error de conexión con el servidor.");
    }
});

// --- INICIALIZAR PANEL ---
cargarUsuarios();
cargarTodasLasTareas();