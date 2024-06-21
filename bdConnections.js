const { Pool } = require('pg');
const { generarCarpetaNuevoUsuarioAgregado } = require('./gestorArchivos');
const fs = require('fs');

const ca = fs.readFileSync('./certificados/ca.crt');

const pool = new Pool({
    user: 'myuser',
    host: '172.22.55.199',
    database: 'bd_tfm',
    password: 'mypassword',
    port: 5432,
    ssl: {
        rejectUnauthorized: true,
        ca: ca,
        host: 'Jorge_Marrero_Camiruaga'
    }
})

function crearUsuario(json, ip, res) {
    const sql = "INSERT INTO usuarios (nombre, tlf, prefix, passwd, ip) VALUES ($1, $2, $3, $4, $5) RETURNING *";
    const values = [json.nombre, json.tlf, json.prefix, json.passwd, ip];
    pool.query(sql, values, (error, result) => {
        if (error) {
            console.error('Error al ejecutar la consulta INSERT:', error);
            res.status(500).json({ error: 'Error al crear usuairo' })
            return;
        }
        res.status(200).json({ message: result.rows[0] })
        console.log('Fila insertada correctamente:');
    })
}

function iniciarSesion(json, res) {
    const sql = "SELECT * FROM usuarios WHERE (tlf = $1 AND prefix = $2 AND passwd = $3)";
    const values = [json.tlf, json.prefix, json.passwd];
    pool.query(sql, values, (error, result) => {
        if (error) {
            console.error('Error al ejecutar la consulta INSERT:', error);
            res.status(500).json({ error: 'Error al crear usuairo' })
            return;
        }
        if (JSON.stringify(result.rows) === JSON.stringify([])) {
            console.log("No existe ese usuario")
            res.status(401).json({ error: 'No se ha podido encontrar ese usuario con esa contraseña' })
            return
        }
        res.status(200).json({ message: JSON.stringify(result.rows[0]) })
        console.log("Usuario encontrado")
    })
}

function obtenerContactos(json, res) {
    const sql = `SELECT * FROM usuarios WHERE _id IN (
        SELECT contactos.usuario_2 FROM contactos JOIN usuarios
        ON contactos.usuario_1 = $1
    ) 
    OR _id IN (
        SELECT contactos.usuario_1 FROM contactos JOIN usuarios
        ON contactos.usuario_2 = $1
    )`;
    const values = [json._id];
    pool.query(sql, values, (error, result) => {
        if (error) {
            console.error('Error al ejecutar la consulta SELECT', error)
            res.status(500).json({ error: 'Error al buscar contactos' })
            return;
        }
        res.status(200).json({ message: JSON.stringify(result.rows) })
        console.log("Usuarios cargados")
    })
}

function buscarNuevoContacto(json, res) {
    const sql = `SELECT * 
                    FROM usuarios 
                    WHERE nombre LIKE $4 || '%' 
                    AND _id NOT IN (
                        SELECT contactos.usuario_2 
                        FROM contactos 
                        JOIN usuarios ON 
                        contactos.usuario_1 = usuarios._id 
                            WHERE usuarios.nombre = $1 AND usuarios.tlf = $2 AND usuarios.prefix = $3 ) 
                            AND NOT (nombre = $1 AND tlf = $2 and prefix = $3)    
                    AND _id NOT IN (
                        SELECT contactos.usuario_1
                        FROM contactos 
                        JOIN usuarios ON 
                        contactos.usuario_2 = usuarios._id 
                            WHERE usuarios.nombre = $1 AND usuarios.tlf = $2 AND usuarios.prefix = $3 ) 
                            AND NOT (nombre = $1 AND tlf = $2 and prefix = $3); `
    const values = [json.usuario.nombre, json.usuario.tlf, json.usuario.prefix, json.busqueda]
    pool.query(sql, values, (error, result) => {
        if (error) {
            console.error('Error al ejecutar la consulta SELECT', error)
            res.status(500).json({ error: 'Error al buscar contactos' })
            return;
        }
        res.status(200).json({ message: JSON.stringify(result.rows) })
        console.log("Usuarios cargados")
    })
}

function agregarContactoNuevo(json, res) {
    console.log("Entra")
    const agregarUsuarios = "INSERT INTO contactos (usuario_1, usuario_2) VALUES ($1, $2)"
    const ids = [json.usuario._id, json.contacto._id]

    pool.query(agregarUsuarios, ids, (error, result) => {
        if (error) {
            console.error('Error al ejecutar la consulta INSERT:', error);
            res.status(500).json({ error: 'Error al crear contacto' })
            return;
        }
        res.status(200).json({ message: 'Usuario agregado correctamente' })
        generarCarpetaNuevoUsuarioAgregado(ids)
        console.log("Agregado")
    })
}

function actualizarIpUsuario(usr, ip, res){
    const sql = 'UPDATE usuarios SET ip=$2 WHERE _id=$1'
    const values = [usr._id, ip]
    pool.query(sql, values, (error, result)=>{
        if (error) {
            console.error('Error al ejecutar la consulta INSERT:', error);
            res.status(500).json({ error: 'Error al crear usuairo' })
            return;
        }
        res.status(200).json({message: "Se ha actualizado la ip"})
    })
}

function obtenerIPUsuario(usr) {
    return new Promise((resolve, reject) => {
        const sql = "SELECT ip FROM usuarios WHERE _id = $1";
        const values = [usr];
        
        pool.query(sql, values, (error, result) => {
            if (error) {
                console.error('Error al obtener la IP del usuario:', error);
                reject(error);
                return;
            }
            const ip = result.rows[0].ip;
            resolve(ip);
        });
    });
}


module.exports = { crearUsuario, iniciarSesion, obtenerContactos, buscarNuevoContacto, agregarContactoNuevo, actualizarIpUsuario, obtenerIPUsuario};
