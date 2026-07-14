# Impresion directa del POS

## Por que el navegador muestra un dialogo

La impresion web estandar usa `window.print()`. Por seguridad, Chrome, Edge y
Firefox muestran el dialogo de impresion y no permiten que una pagina elija una
impresora del sistema.

NEXA prepara el ticket en un documento aislado. Los lanzadores incluidos revisan
la impresora predeterminada al iniciar el POS:

- Si existe, habilitan la impresion directa hacia esa impresora.
- Si no existe, mantienen la impresion normal y el navegador muestra el dialogo.

No se escoge "la primera impresora" de una lista: el orden puede cambiar al
conectar una impresora PDF, de red o USB.

## Configuracion en Windows

1. Instalar la impresora termica y hacer una pagina de prueba desde Windows.
2. Para impresion directa, abrir la impresora termica y elegir
   `Establecer como predeterminada`.
3. Iniciar Chrome pasando la URL desplegada al lanzador:

```text
scripts\iniciar-pos-impresion-directa.cmd https://URL-DE-NEXA/pos
```

El lanzador encuentra Chrome automaticamente y usa un perfil exclusivo. La
primera vez hay que iniciar sesion en NEXA dentro de esa ventana.

### Firefox en Windows

Firefox usa otro perfil exclusivo para no modificar la configuracion personal
del usuario:

```text
scripts\iniciar-pos-firefox.cmd https://URL-DE-NEXA/pos
```

Con impresora predeterminada, el perfil habilita la impresion silenciosa y fija
esa impresora. Sin predeterminada, deshabilita la impresion silenciosa para que
Firefox muestre el dialogo.

## Configuracion en Linux

1. Verificar que CUPS imprime una pagina de prueba.
2. Abrir NEXA con Chrome o Chromium mediante el lanzador:

```bash
scripts/iniciar-pos-impresion-directa.sh https://URL-DE-NEXA/pos
```

Para Firefox:

```bash
scripts/iniciar-pos-firefox.sh https://URL-DE-NEXA/pos
```

Ambos lanzadores consultan la impresora predeterminada de CUPS antes de abrir el
navegador.

## Verificacion operativa

1. Imprimir primero una venta de prueba.
2. Confirmar papel de 80 mm, escala 100 %, margenes predeterminados y sin
   encabezados ni pies agregados por el controlador.
3. Probar tambien `Arqueo`, `Reporte por producto` y `Cerrar e imprimir`.
4. Si se cambia la impresora predeterminada mientras NEXA esta abierto, cerrar el
   navegador y ejecutar nuevamente el lanzador para volver a detectarla.

Este mecanismo no requiere instalar dependencias en NEXA. Los perfiles de los
lanzadores deben usarse solo para NEXA, especialmente el de Firefox, porque la
impresion silenciosa se configura a nivel del perfil. Si en el futuro se necesita
escoger varias impresoras (cocina, caja y etiquetas), hara falta un puente local
de impresion o una aplicacion de escritorio.
