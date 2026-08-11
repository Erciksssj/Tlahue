-- =====================================================================
-- Sistema de Gestion de Solicitudes de Difusion - COMSOC Tlahuelilpan
-- Esquema de base de datos (PostgreSQL) - conforme al modelo de datos
-- definido en la Fase 3, Subfase 3.7
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- Tabla: direccion
-- ---------------------------------------------------------------------
CREATE TABLE direccion (
    id_direccion      SERIAL PRIMARY KEY,
    nombre            VARCHAR(100) NOT NULL,
    correo_contacto   VARCHAR(150) NOT NULL,
    telefono_contacto VARCHAR(15)
);

-- ---------------------------------------------------------------------
-- Tabla: usuario
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
    id_usuario       SERIAL PRIMARY KEY,
    nombre           VARCHAR(100) NOT NULL,
    correo           VARCHAR(150) NOT NULL UNIQUE,
    contrasena_hash  TEXT NOT NULL,
    rol              VARCHAR(20) NOT NULL CHECK (rol IN ('Administrador','Solicitante')),
    id_direccion     INTEGER REFERENCES direccion(id_direccion)
);

-- ---------------------------------------------------------------------
-- Tabla: solicitud
-- ---------------------------------------------------------------------
CREATE TABLE solicitud (
    id_solicitud        SERIAL PRIMARY KEY,
    folio                VARCHAR(20) NOT NULL UNIQUE,
    nombre_evento        VARCHAR(150) NOT NULL,
    fecha_evento         DATE NOT NULL,
    hora_evento          TIME NOT NULL,
    lugar                VARCHAR(150) NOT NULL,
    texto_sugerido       TEXT NOT NULL,
    estatus              VARCHAR(20) NOT NULL DEFAULT 'Recibida'
                          CHECK (estatus IN ('Recibida','En diseno','Publicada','Rechazada')),
    fecha_creacion       TIMESTAMP NOT NULL DEFAULT now(),
    id_direccion         INTEGER NOT NULL REFERENCES direccion(id_direccion),
    id_usuario_registro  INTEGER REFERENCES usuario(id_usuario)
);

-- ---------------------------------------------------------------------
-- Tabla: adjunto
-- ---------------------------------------------------------------------
CREATE TABLE adjunto (
    id_adjunto    SERIAL PRIMARY KEY,
    url_archivo   TEXT NOT NULL,
    tipo          VARCHAR(10) NOT NULL CHECK (tipo IN ('imagen','pdf')),
    id_solicitud  INTEGER NOT NULL REFERENCES solicitud(id_solicitud) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- Tabla: historial_estatus
-- ---------------------------------------------------------------------
CREATE TABLE historial_estatus (
    id_historial      SERIAL PRIMARY KEY,
    estatus_anterior  VARCHAR(20),
    estatus_nuevo     VARCHAR(20) NOT NULL,
    comentario        TEXT,
    fecha_cambio      TIMESTAMP NOT NULL DEFAULT now(),
    id_solicitud      INTEGER NOT NULL REFERENCES solicitud(id_solicitud) ON DELETE CASCADE,
    id_usuario        INTEGER REFERENCES usuario(id_usuario)
);

CREATE INDEX idx_solicitud_estatus ON solicitud(estatus);
CREATE INDEX idx_solicitud_direccion ON solicitud(id_direccion);
CREATE INDEX idx_historial_solicitud ON historial_estatus(id_solicitud);

-- ---------------------------------------------------------------------
-- Funcion / Trigger: genera folio automatico COMSOC-YYYY-NNN (RF03)
-- ---------------------------------------------------------------------
CREATE SEQUENCE folio_seq_anual;

CREATE OR REPLACE FUNCTION fn_generar_folio()
RETURNS TRIGGER AS $$
DECLARE
    anio INT := EXTRACT(YEAR FROM now());
    consecutivo INT;
BEGIN
    IF NEW.folio IS NULL THEN
        SELECT COUNT(*) + 1 INTO consecutivo
        FROM solicitud
        WHERE folio LIKE 'COMSOC-' || anio || '-%';

        NEW.folio := 'COMSOC-' || anio || '-' || LPAD(consecutivo::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generar_folio
BEFORE INSERT ON solicitud
FOR EACH ROW
EXECUTE FUNCTION fn_generar_folio();

-- ---------------------------------------------------------------------
-- Trigger: registrar automaticamente el historial en cada cambio de
-- estatus (soporta RF06/RF07 y la trazabilidad exigida en la Fase 3)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_registrar_historial()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO historial_estatus(estatus_anterior, estatus_nuevo, comentario, id_solicitud, id_usuario)
        VALUES (NULL, NEW.estatus, 'Solicitud registrada por la dirección solicitante.', NEW.id_solicitud, NEW.id_usuario_registro);
    ELSIF TG_OP = 'UPDATE' AND OLD.estatus IS DISTINCT FROM NEW.estatus THEN
        INSERT INTO historial_estatus(estatus_anterior, estatus_nuevo, id_solicitud)
        VALUES (OLD.estatus, NEW.estatus, NEW.id_solicitud);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_historial_insert
AFTER INSERT ON solicitud
FOR EACH ROW EXECUTE FUNCTION fn_registrar_historial();

CREATE TRIGGER trg_historial_update
AFTER UPDATE ON solicitud
FOR EACH ROW EXECUTE FUNCTION fn_registrar_historial();

-- ---------------------------------------------------------------------
-- Procedimiento almacenado: reporte mensual (RF10 / HU-06)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_reporte_mensual(p_anio INT, p_mes INT)
RETURNS TABLE (
    total_solicitudes BIGINT,
    recibidas BIGINT,
    en_diseno BIGINT,
    publicadas BIGINT,
    rechazadas BIGINT,
    tiempo_promedio_horas NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE estatus='Recibida')::BIGINT,
        COUNT(*) FILTER (WHERE estatus='En diseno')::BIGINT,
        COUNT(*) FILTER (WHERE estatus='Publicada')::BIGINT,
        COUNT(*) FILTER (WHERE estatus='Rechazada')::BIGINT,
        ROUND(AVG(EXTRACT(EPOCH FROM (h.fecha_cambio - s.fecha_creacion))/3600.0) FILTER (WHERE s.estatus='Publicada'), 2)
    FROM solicitud s
    LEFT JOIN historial_estatus h ON h.id_solicitud = s.id_solicitud AND h.estatus_nuevo = 'Publicada'
    WHERE EXTRACT(YEAR FROM s.fecha_creacion) = p_anio
      AND EXTRACT(MONTH FROM s.fecha_creacion) = p_mes;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Datos semilla minimos (direcciones municipales, RF01)
-- ---------------------------------------------------------------------
INSERT INTO direccion (nombre, correo_contacto, telefono_contacto) VALUES
 ('Dirección de Desarrollo Económico', 'desarrollo.economico@tlahuelilpan.gob.mx', '7731000001'),
 ('Dirección de Salud Municipal', 'salud@tlahuelilpan.gob.mx', '7731000002'),
 ('Dirección de Deportes', 'deportes@tlahuelilpan.gob.mx', '7731000003'),
 ('Dirección de Obras Públicas', 'obras.publicas@tlahuelilpan.gob.mx', '7731000004');

INSERT INTO usuario (nombre, correo, contrasena_hash, rol, id_direccion) VALUES
 ('Encargado Comunicación Social', 'comsoc@tlahuelilpan.gob.mx', crypt('admin2026', gen_salt('bf')), 'Administrador', NULL),
 ('Laura Hernández', 'laura.hernandez@tlahuelilpan.gob.mx', crypt('solicitante2026', gen_salt('bf')), 'Solicitante', 1);

-- ---------------------------------------------------------------------
-- Migracion (Sprint 4): se agregan datos de contacto por solicitud,
-- ya que el contacto puede variar entre solicitudes de una misma
-- direccion (ajuste identificado durante la integracion, RF01)
-- ---------------------------------------------------------------------
ALTER TABLE solicitud ADD COLUMN IF NOT EXISTS contacto_nombre VARCHAR(100);
ALTER TABLE solicitud ADD COLUMN IF NOT EXISTS contacto_correo VARCHAR(150);

-- ---------------------------------------------------------------------
-- Permisos para el rol de aplicacion (comsoc_app)
-- ---------------------------------------------------------------------
-- Este script normalmente se ejecuta con el usuario "postgres" (u otro
-- superusuario), lo que deja las tablas, secuencias y funciones como
-- propiedad de ese usuario. GRANT ALL PRIVILEGES ON DATABASE (usado al
-- crear la base) solo otorga permisos a nivel de base de datos (CONNECT,
-- CREATE, TEMP) y NO incluye permisos de SELECT/INSERT/UPDATE/DELETE
-- sobre las tablas ya creadas. Sin estos GRANT explicitos, el backend
-- (que se conecta como comsoc_app) falla con:
--   error: permiso denegado a la tabla solicitud   (codigo 42501)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO comsoc_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO comsoc_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO comsoc_app;

-- Para que las tablas/objetos creados en el futuro (por ejemplo, con
-- nuevas migraciones) tambien queden accesibles automaticamente:
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO comsoc_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO comsoc_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO comsoc_app;
