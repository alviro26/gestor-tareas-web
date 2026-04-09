// ==========================================
// --- IMPORTACIONES Y CONFIGURACIÓN ---
// ==========================================
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const puerto = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- CONFIGURACIÓN DE POSTGRESQL (SEGURA Y EN LA NUBE) ---
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    // --- NUEVO: OBLIGAMOS A USAR CONEXIÓN ENCRIPTADA (SSL) ---
    ssl: {
        rejectUnauthorized: false
    }
});

// ==========================================
// --- INICIALIZACIÓN DE BASE DE DATOS ---
// ==========================================
pool.query('SELECT NOW()')
    .then(async () => {
        console.log("✅ ¡Conectado a la base de datos Neon en la nube!");
        
        // 1. Creamos las tablas si no existen
        await pool.query(`CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            usuario TEXT UNIQUE,
            password TEXT,
            rol TEXT
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS tareas (
            id SERIAL PRIMARY KEY,
            usuario TEXT,
            descripcion TEXT,
            fecharegistro TEXT,
            fechavencimiento TEXT,
            fechamodificacion TEXT, 
            fechatermino TEXT,      
            estado TEXT
        )`);

        // 2. Revisamos si la base de datos está vacía (Problema del huevo y la gallina)
        const { rows } = await pool.query('SELECT COUNT(*) FROM usuarios');
        if (parseInt(rows[0].count) === 0) {
            console.log("⚠️ Base de datos vacía. Creando Administrador Maestro...");
            
            // Hasheamos una contraseña temporal: "admin123"
            const hashedPassword = await bcrypt.hash('admin123', 10);
            
            await pool.query(
                `INSERT INTO usuarios (usuario, password, rol) VALUES ($1, $2, $3)`, 
                ['admin', hashedPassword, 'admin']
            );
            console.log("⭐ ¡Usuario 'admin' creado con la contraseña temporal 'admin123'!");
        }
    })
    .catch(err => console.error("❌ Error al inicializar Postgres:", err));


// ==========================================
// --- MIDDLEWARE DE SEGURIDAD (EL CADENERO) ---
// ==========================================
const verificarToken = (req, res, next) => {
    const cabeceraAutorizacion = req.headers['authorization'];
    
    if (!cabeceraAutorizacion) {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere token.' });
    }

    try {
        const tokenLimpio = cabeceraAutorizacion.split(' ')[1];
        const decodificado = jwt.verify(tokenLimpio, process.env.JWT_SECRET);
        
        // Guardamos los datos del usuario en la petición para usarlos después
        req.usuarioVerificado = decodificado; 
        next(); 
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido o expirado.' });
    }
};

// ==========================================
// --- RUTAS DE AUTENTICACIÓN ---
// ==========================================

app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Iniciar Sesión (Genera el Gafete/Token)
app.post('/api/login', async (req, res) => {
    const { usuario, password } = req.body;

    if (!usuario || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña obligatorios.' });
    }

    try {
        const { rows } = await pool.query('SELECT * FROM usuarios WHERE usuario = $1', [usuario]);
        const filaUsuario = rows[0];

        if (!filaUsuario) {
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        }

        const contrasenaValida = await bcrypt.compare(password, filaUsuario.password);

        if (contrasenaValida) {
            // Generamos el Token JWT
            const token = jwt.sign(
                { id: filaUsuario.id, nombre: filaUsuario.usuario, rol: filaUsuario.rol },
                process.env.JWT_SECRET,
                { expiresIn: '8h' }
            );

            res.status(200).json({
                mensaje: '¡Bienvenido!',
                token: token,
                usuario: { id: filaUsuario.id, nombre: filaUsuario.usuario, rol: filaUsuario.rol }
            });
        } else {
            res.status(401).json({ error: 'Credenciales incorrectas.' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error en el servidor.' });
    }
});

// ==========================================
// --- RUTAS DE TAREAS (PROTEGIDAS) ---
// ==========================================

// Obtener tareas del usuario
app.get('/api/tareas/:usuario', verificarToken, async (req, res) => {
    try {
        const sql = 'SELECT * FROM tareas WHERE usuario = $1';
        const { rows } = await pool.query(sql, [req.params.usuario]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al consultar tareas.' });
    }
});

// Crear nueva tarea
app.post('/api/tareas', verificarToken, async (req, res) => {
    // 1. Atrapamos horarecordatorio del frontend
    const { usuario, descripcion, fechaRegistro, fechaVencimiento, estado, horarecordatorio } = req.body;
    
    try {
        // 2. Agregamos la columna y el espacio $6 en la base de datos
        const sql = 'INSERT INTO tareas (usuario, descripcion, fechaRegistro, fechaVencimiento, estado, horarecordatorio) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id';
        
        // 3. Mandamos la variable escrita correctamente
        const result = await pool.query(sql, [usuario, descripcion, fechaRegistro, fechaVencimiento, estado, horarecordatorio]);
        
        res.status(201).json({ mensaje: 'Tarea registrada', id: result.rows[0].id });
    } catch (error) {
        console.error(error); // Agregamos esto para que si falla, la consola te diga por qué
        res.status(500).json({ error: 'Error al guardar tarea.' });
    }
});

// Actualizar estado (con fechas de modificación/término)
app.put('/api/tareas/:id', verificarToken, async (req, res) => {
    const { estado, fechaModificacion, fechaTermino } = req.body;
    try {
        const sql = 'UPDATE tareas SET estado = $1, fechaModificacion = $2, fechaTermino = $3 WHERE id = $4';
        await pool.query(sql, [estado, fechaModificacion, fechaTermino, req.params.id]);
        res.json({ mensaje: 'Estado actualizado.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar estado.' });
    }
});

// Editar descripción y vencimiento
app.put('/api/tareas/editar/:id', verificarToken, async (req, res) => {
    const { descripcion, fechaVencimiento, fechaModificacion } = req.body;
    try {
        const sql = 'UPDATE tareas SET descripcion = $1, fechaVencimiento = $2, fechaModificacion = $3 WHERE id = $4';
        await pool.query(sql, [descripcion, fechaVencimiento, fechaModificacion, req.params.id]);
        res.json({ mensaje: 'Tarea editada.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al editar tarea.' });
    }
});

// Eliminar tarea
app.delete('/api/tareas/:id', verificarToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM tareas WHERE id = $1', [req.params.id]);
        res.json({ mensaje: 'Tarea eliminada.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar tarea.' });
    }
});

// ==========================================
// --- RUTAS DE ADMINISTRADOR (SÚPER PROTEGIDAS) ---
// ==========================================

// Registrar nuevos usuarios (Solo Admin)
app.post('/api/admin/registro', verificarToken, async (req, res) => {
    // Verificamos el rol desde el token decodificado
    if (req.usuarioVerificado.rol !== 'admin') {
        return res.status(403).json({ error: 'Solo administradores pueden crear usuarios.' });
    }

    const { usuario, password, rol } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const rolAsignado = rol || 'usuario_estandar';
        const sql = 'INSERT INTO usuarios (usuario, password, rol) VALUES ($1, $2, $3) RETURNING id';
        const result = await pool.query(sql, [usuario, hashedPassword, rolAsignado]);
        res.status(201).json({ mensaje: 'Usuario creado con éxito', id: result.rows[0].id });
    } catch (error) {
        if (error.code === '23505') return res.status(400).json({ error: 'El usuario ya existe.' });
        res.status(500).json({ error: 'Error al registrar usuario.' });
    }
});

// Ver todos los usuarios
app.get('/api/admin/usuarios', verificarToken, async (req, res) => {
    if (req.usuarioVerificado.rol !== 'admin') return res.status(403).json({ error: 'No autorizado.' });
    try {
        const { rows } = await pool.query('SELECT id, usuario, rol FROM usuarios');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al consultar usuarios.' });
    }
});

// Ver todas las tareas de todos (Supervisión)
app.get('/api/admin/tareas', verificarToken, async (req, res) => {
    if (req.usuarioVerificado.rol !== 'admin') return res.status(403).json({ error: 'No autorizado.' });
    try {
        const { rows } = await pool.query('SELECT * FROM tareas');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al consultar todas las tareas.' });
    }
});

// Eliminar usuario
app.delete('/api/admin/usuarios/:id', verificarToken, async (req, res) => {
    if (req.usuarioVerificado.rol !== 'admin') return res.status(403).json({ error: 'No autorizado.' });
    try {
        await pool.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
        res.json({ mensaje: 'Usuario eliminado.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar usuario.' });
    }
});

// Encendemos el motor
app.listen(puerto, () => {
    console.log(`🚀 Servidor seguro corriendo en puerto ${puerto}`);
});