const fs = require('fs');
const path = require('path')

function generarCarpetaNuevoUsuarioAgregado(usr) {
    nombreArchivo = path.join(__dirname, `./uploads/${usr[0]}_${usr[1]}`)
    nombreAlterno = path.join(__dirname, `./uploads/${usr[1]}_${usr[0]}`)
    if (!fs.existsSync(nombreArchivo) && !fs.existsSync(nombreAlterno)) {
        fs.mkdir(nombreArchivo, (err) => {
            if (err) {
                console.log(err)
            } else {
                console.log("Creado")
            }
        })
    }
}

function obtenerNombreDocumentos(usr, res) {
    const usr_1 = usr.usuario._id;
    const usr_2 = usr.contacto._id;
    const nombreArchivo = path.join(__dirname, `./uploads/${usr_1}_${usr_2}`);
    const nombreAlterno = path.join(__dirname, `./uploads/${usr_2}_${usr_1}`);
    const archivosComp = { archivosCompartidos: [] };

    function leerArchivos(nombreDirectorio) {
        return new Promise((resolve, reject) => {
            fs.readdir(nombreDirectorio, (error, archivos) => {
                if (error) {
                    reject(error);
                    return;
                }

                archivos.forEach(archivo => {
                    const nombre = path.basename(archivo, path.extname(archivo));
                    const ext = path.extname(archivo);
                    archivosComp.archivosCompartidos.push({ nombre, ext });
                });

                resolve();
            });
        });
    }

    let archivosEncontrados = false;

    leerArchivos(nombreArchivo)
        .then(() => {
            archivosEncontrados = true;
            res.json(archivosComp);
        })
        .catch(() => {
            return leerArchivos(nombreAlterno);
        })
        .then(() => {
            if (!archivosEncontrados) {
                archivosEncontrados = true;
                res.json(archivosComp);
            }
        })
        .catch(() => {
            if (!archivosEncontrados) {
                console.log("No se encontraron las carpetas");
                res.status(404).json({ error: 'No se encontraron las carpetas' });
            }
        });
}

function enviarArchivo(usr, nombreArchivo, res) {
    const usr_1 = usr.usuario._id;
    const usr_2 = usr.contacto._id;
    const nombreDirectorio = path.join(__dirname, `./uploads/${usr_1}_${usr_2}`);
    const nombreAlterno = path.join(__dirname, `./uploads/${usr_2}_${usr_1}`);
    const archivo = null

    function enviarArchivo(nombreDirectorio, nombreArchivo) {
        return new Promise((resolve, rejects) => {
            fs.readFile(`${nombreDirectorio}/${nombreArchivo}`, (error, archivo) => {
                if (error) {
                    rejects(error);
                    return
                }
                res.sendFile(`${nombreDirectorio}/${nombreArchivo}`)
            })
            resolve();
        });
    }

    let archivosEncontrados = false;

    enviarArchivo(nombreDirectorio, nombreArchivo)
        .then(() => {
            archivosEncontrados = true;
            res.json(archivosComp);
        })
        .catch(() => {
            return enviarArchivo(nombreAlterno, nombreArchivo);
        })
        .then(() => {
            if (!archivosEncontrados) {
                archivosEncontrados = true;
                res.json(archivosComp);
            }
        })
        .catch(() => {
            if (!archivosEncontrados) {
                console.log("No se encontraron el archivo");
                res.status(404).json({ error: 'No se encontraron el archivo' });
            }
        });
}




module.exports = { generarCarpetaNuevoUsuarioAgregado, obtenerNombreDocumentos, enviarArchivo }