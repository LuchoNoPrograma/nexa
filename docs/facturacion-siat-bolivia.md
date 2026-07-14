# Facturación electrónica en Bolivia (SIAT / SIN)

Investigación y diseño del módulo de facturación de NEXA. Fecha: julio 2026.

## Cómo funciona el SIAT

El SIN valida facturas a través del **SIAT** (Sistema Integrado de Administración
Tributaria). Las facturas se envían como **XML firmado/estructurado vía servicios
SOAP** con autenticación por header `apikey` (token delegado que entrega el SIN).

- Documentación oficial: https://siatinfo.impuestos.gob.bo
- Anexo técnico (servicios): https://siatanexo.impuestos.gob.bo
- Piloto: `https://pilotosiatservicios.impuestos.gob.bo/v2/<Servicio>?wsdl`
- Producción: `https://siatservicios.impuestos.gob.bo/v2/<Servicio>?wsdl`

### Modalidades

| Modalidad | Código | Firma |
|---|---|---|
| Facturación **Electrónica** en Línea | 1 | XML firmado con certificado digital (ADSIB o entidad autorizada) |
| Facturación **Computarizada** en Línea | 2 | Sin firma digital; credenciales del sistema (la que implementa NEXA primero) |
| Portal Web en Línea | — | Manual desde el portal del SIN (sin integración) |

### Códigos clave

1. **CUIS** — código único de inicio de sistemas. Uno por punto de venta,
   vigencia ~1 año. Servicio `FacturacionCodigos/cuis`.
2. **CUFD** — código único de facturación diaria. Se renueva cada 24 h por punto
   de venta; incluye un `codigoControl` que forma parte del CUF. Servicio
   `FacturacionCodigos/cufd`.
3. **CUF** — código único de factura, lo genera **nuestro sistema**:
   `NIT(13) + fecha yyyyMMddHHmmssSSS(17) + sucursal(4) + modalidad(1) +
   tipoEmision(1) + tipoFactura(1) + docSector(2) + nroFactura(10) + puntoVenta(4)`
   → dígito módulo 11 → todo a base 16 → se anexa el `codigoControl` del CUFD.
   Implementado en `shared/utils/facturacion.ts` (`generarCuf`).
4. **CAFC** — código para contingencias (emisión fuera de línea). Pendiente.

### Servicios SOAP principales

| Servicio | Operaciones |
|---|---|
| `FacturacionCodigos` | `cuis`, `cufd`, `verificarNit` |
| `FacturacionSincronizacion` | catálogos: actividades, leyendas, productos SIN, métodos de pago, unidades, motivos de anulación, tipos de documento, fecha/hora |
| `ServicioFacturacionCompraVenta` | `recepcionFactura`, `anulacionFactura`, `reversionAnulacionFactura`, `verificacionEstadoFactura`, paquetes (contingencia) |
| `FacturacionOperaciones` | eventos significativos, registro/cierre de puntos de venta |

El XML de la factura viaja **comprimido con gzip, en base64, con hash SHA-256**
(`empaquetarFactura` en `server/utils/siat.ts`). Códigos de estado relevantes:
`908` recibida/validada, `904` observada, `905` anulación confirmada, `902` rechazada.

### Requisitos administrativos (no son de código)

1. NIT activo y actividad económica registrada.
2. Registrar/autorizar el **sistema de facturación** en el SIAT (portal del SIN)
   → entrega `codigoSistema` y el **token delegado** (apikey).
3. Pasar las **pruebas piloto** en ambiente 2 (emisión, anulación, contingencia,
   paquetes) antes de que habiliten producción.
4. Para modalidad electrónica (1): certificado digital de ADSIB (~firma XMLDSig).
   NEXA arranca con modalidad computarizada (2), que no lo requiere.

## Proyectos open source de referencia

- [Nicky-nn/isi_odoo](https://github.com/Nicky-nn/isi_odoo) — Python/Odoo, el más
  activo (2025); relacionado al ecosistema ISIPASS.
- [sinticbolivia](https://github.com/sinticbolivia) — org con varios repos:
  `MonoInvoicesApiClient` (PHP), `xmlsigner` (firma XML para SIAT), módulo Odoo.
- [yamaka/FELBO](https://github.com/yamaka/FELBO) — PHP, implementación completa SIAT.
- [kplian/sis_siat_old](https://github.com/kplian/sis_siat_old) — PHP, integración antigua.
- [p-kos/sincontrolcode](https://github.com/p-kos/sincontrolcode) — JS, código de
  control del régimen anterior (pre-SIAT, solo referencia histórica).

**Alternativa comercial** (API REST que hace de puente con el SIAT, útil si no
queremos homologar sistema propio): [CUCU](https://docs.cucu.bo) e ISIPASS.

## Lo implementado en NEXA

- **BD** `database/local/008_facturacion_siat.sql`: `facturacion_config` (NIT,
  modalidad, ambiente, codigoSistema, token, CUIS), `facturacion_cufd`,
  `factura` + `factura_item`, `facturacion_catalogo` (paramétricas sincronizadas).
- **Dominio puro** `shared/utils/facturacion.ts`: constantes SIAT, módulo 11,
  `generarCuf`, formatos de fecha (hora Bolivia UTC-4).
- **Cliente SOAP** `server/utils/siat.ts`: envelopes a mano (sin dependencias),
  CUIS/CUFD, sincronización de catálogos, recepción/anulación/verificación de
  facturas, generador del XML `facturaComputarizadaCompraVenta`.
- **Endpoints** `server/api/pos/facturacion/`: `config` (GET/PUT), `cuis` (POST),
  `cufd` (POST), `sincronizar` (POST), `emitir` (POST, desde una venta del POS),
  `anular` (POST), `index` (GET, listado).

## Pendientes

- UI en el POS (configuración + botón "facturar" en la venta + listado).
- Firma XMLDSig para modalidad electrónica (1).
- Contingencias: eventos significativos, CAFC, paquetes de facturas.
- Mapeo de productos al catálogo oficial SIN (`codigoProductoSin` por producto;
  hoy se usa el genérico `99100`) y actividad económica por ítem.
- Representación gráfica (PDF/rollo) con QR de verificación
  (`https://siat.impuestos.gob.bo/consulta/QR?nit=..&cuf=..&numero=..&t=2`).
