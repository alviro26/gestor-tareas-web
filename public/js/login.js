const formulario = document.getElementById('formularioLogin');
const divMensaje = document.getElementById('mensaje');

formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const usuario = document.getElementById('usuario').value;
    const password = document.getElementById('password').value;

    try {
        const respuesta = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ usuario, password })
        });

        const datos = await respuesta.json();
        divMensaje.className = ''; 

       if (respuesta.ok) {
            // Si las credenciales son correctas
            divMensaje.textContent = datos.mensaje;
            divMensaje.classList.add('exito');
            
            // Guardamos los datos del usuario (id, nombre y ROL)
            localStorage.setItem('usuarioActual', JSON.stringify(datos.usuario));

            // --- NUEVO: GUARDAMOS EL GAFETE EN LA CAJA FUERTE DEL NAVEGADOR ---
            localStorage.setItem('token', datos.token);

            // Esperamos 1 segundo para mostrar el mensaje de éxito y luego redirigimos
            setTimeout(() => {
                // --- CAMBIO CLAVE: Redirección inteligente ---
                if (datos.usuario.rol === 'admin') {
                    // Si es administrador, va directo al panel de control
                    window.location.href = 'admin.html';
                } else {
                    // Si es usuario estándar, va a su dashboard de tareas
                    window.location.href = 'dashboard.html';
                }
            }, 1000); 
            
        } else {
            // Si la contraseña o el usuario están mal
            divMensaje.textContent = datos.error;
            divMensaje.classList.add('error');
        }

    } catch (error) {
        divMensaje.textContent = 'Error al conectar con el servidor.';
        divMensaje.classList.add('error');
        console.error('Error:', error);
    }
});