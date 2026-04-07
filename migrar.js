const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');

// 1. Configuración de PostgreSQL (Pon tus datos aquí)
const pgConfig = {
    user: 'postgres',
    host: 'localhost',
    database: 'sistema_tareas',
    password: 'agu374dai',
    port: 5432,
};

// 2. Conectamos a ambas bases de datos
const sqliteDb = new sqlite3.Database('./database.sqlite');
const pgClient = new Client(pgConfig);

async function migrarDatos() {
    try {
        await pgClient.connect();
        console.log("Conectado a PostgreSQL...");

        // --- MIGRAR USUARIOS ---
        console.log("Migrando usuarios...");
        const usuarios = await new Promise((resolve, reject) => {
            sqliteDb.all(`SELECT * FROM usuarios`, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        for (const user of usuarios) {
            // Insertamos conservando el ID original
            await pgClient.query(
                `INSERT INTO usuarios (id, usuario, password, rol) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
                [user.id, user.usuario, user.password, user.rol]
            );
        }
        console.log(`✅ ${usuarios.length} usuarios migrados.`);

        // Sincronizar el contador automático (SERIAL) de Postgres para usuarios
        await pgClient.query(`SELECT setval('usuarios_id_seq', (SELECT MAX(id) FROM usuarios))`);

        // --- MIGRAR TAREAS ---
        console.log("Migrando tareas...");
        const tareas = await new Promise((resolve, reject) => {
            sqliteDb.all(`SELECT * FROM tareas`, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        for (const tarea of tareas) {
            await pgClient.query(
                `INSERT INTO tareas (id, usuario, descripcion, fechaRegistro, fechaVencimiento, fechaModificacion, fechaTermino, estado) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
                [tarea.id, tarea.usuario, tarea.descripcion, tarea.fechaRegistro, tarea.fechaVencimiento, tarea.fechaModificacion, tarea.fechaTermino, tarea.estado]
            );
        }
        console.log(`✅ ${tareas.length} tareas migradas.`);

        // Sincronizar el contador automático (SERIAL) de Postgres para tareas
        await pgClient.query(`SELECT setval('tareas_id_seq', (SELECT MAX(id) FROM tareas))`);

        console.log("🚀 ¡Migración completada con éxito!");

    } catch (error) {
        console.error("Error durante la migración:", error);
    } finally {
        // 3. Cerramos ambas conexiones
        sqliteDb.close();
        await pgClient.end();
    }
}

// Ejecutamos la función
migrarDatos();