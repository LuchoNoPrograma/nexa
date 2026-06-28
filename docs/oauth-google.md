# Iniciar sesión con Google (OAuth)

NEXA usa OAuth 2.0 (Authorization Code + PKCE) para "Continuar con Google".
No depende de Supabase Auth ni de ningún SDK de identidad de terceros: solo se
apoya en `arctic` (el protocolo) y reutiliza la sesión propia de NEXA (tabla
`sesion` + cookie `nexa_session_token`). Por eso es portable: funciona igual en
Vercel y en un VPS sin cambiar código.

---

## 1. Crear las credenciales en Google Cloud Console

1. Entra a <https://console.cloud.google.com/> y crea (o elige) un proyecto.
2. **APIs y servicios → Pantalla de consentimiento de OAuth**
   - Tipo de usuario: **Externo**.
   - Completa nombre de la app, correo de soporte y correo del desarrollador.
   - En "Usuarios de prueba" agrega los correos con los que vas a probar
     mientras la app esté en modo *Testing* (si no, Google bloquea el acceso).
3. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**
   - Tipo de aplicación: **Aplicación web**.
   - **URI de redireccionamiento autorizados** (agrega los que apliquen):
     - Desarrollo: `http://localhost:3000/api/auth/oauth/google/callback`
     - Producción: `https://TU_DOMINIO/api/auth/oauth/google/callback`
   - Guarda. Google te da un **Client ID** y un **Client Secret**.

> ⚠️ El redirect URI debe coincidir **carácter por carácter** con el que usa la
> app. NEXA lo construye como `<origin>/api/auth/oauth/google/callback`, donde
> `<origin>` se deriva del request (o de `NEXA_PUBLIC_URL` si está definido).

---

## 2. Configurar las variables de entorno

Copia los valores en tu `.env` (local) y en el panel de tu hosting (Vercel /
VPS):

```bash
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxx

# Opcional. Fuerza el dominio del callback cuando un proxy oculta el host real
# (típico en un VPS detrás de Nginx). Si se deja vacío, se deriva del request.
# NEXA_PUBLIC_URL=https://TU_DOMINIO
```

No hace falta tocar `nuxt.config.ts`: el servidor lee estas variables
directamente desde `process.env`, igual que el resto del proyecto.

---

## 3. Probar

1. `npm run dev` (corre migraciones y levanta Nuxt).
2. Abre `/login` y pulsa **Google**.
3. Autoriza con una cuenta que esté en "Usuarios de prueba".
4. Deberías volver autenticado a `/pos/inicio`.

Si algo falla, el callback **nunca rompe**: te devuelve a `/login` con un aviso:

| URL de retorno          | Significado                                  |
| ----------------------- | -------------------------------------------- |
| `/login?oauth=cancelado`| Cancelaste el consentimiento en Google.      |
| `/login?oauth=error`    | `state` inválido, code expirado o fallo de red.|

---

## 4. Despliegue / mover a un VPS

OAuth viaja con el código. Al cambiar de hosting solo necesitas:

1. Registrar el nuevo redirect URI en Google Cloud Console
   (`https://NUEVO_DOMINIO/api/auth/oauth/google/callback`).
2. Copiar `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` al nuevo entorno.
3. Si hay un proxy inverso (Nginx) que cambia el host, definir `NEXA_PUBLIC_URL`.

Cuando salgas de *Testing*, **publica** la app en la pantalla de consentimiento
para que cualquier usuario (no solo los de prueba) pueda entrar.

---

## 5. Cómo se comporta — casos de uso

Resolución de identidad en el callback (`server/utils/oauth.ts → resolveGoogleUser`),
en este orden:

| # | Situación                                                                 | Qué hace NEXA |
| - | ------------------------------------------------------------------------- | ------------- |
| 1 | **Usuario nuevo** entra con Google por primera vez                        | Crea `usuario` (con su correo + avatar) y su **tienda demo**, igual que el registro normal. |
| 2 | **Usuario de Google ya registrado** vuelve a entrar                       | Lo reconoce por `(google, sub)` y solo abre sesión. No duplica nada. |
| 3 | Ya existe un usuario **con ese mismo correo verificado** (p. ej. un admin con correo) | **Vincula** Google a esa cuenta (guarda `oauth_sub`). A partir de ahí puede entrar con contraseña **o** con Google. No se duplica. |
| 4 | Cuenta **solo-Google** intenta hacer **login por correo + contraseña**    | No tiene contraseña local → mensaje claro: *"Esta cuenta usa Continuar con Google"*. No revienta. |
| 5 | El correo de Google **no está verificado** y choca con un correo ya usado | No vincula (por seguridad); crea la cuenta identificada por `sub`, sin correo, para no colisionar con el `unique(email)`. |
| 6 | **Doble clic / dos pestañas** disparan dos altas a la vez                 | El índice único `(oauth_provider, oauth_sub)` rechaza la segunda; NEXA detecta el choque y devuelve la cuenta ya creada. |
| 7 | Usuario cancela en la pantalla de Google                                  | Vuelve a `/login?oauth=cancelado`. No se crea nada. |

### Limitación conocida (aceptada para el MVP)

El registro normal de NEXA crea usuarios **por celular, con `email = null`**. Por
eso, si una persona se registró por celular y **luego** entra con Google, no hay
forma de vincular automáticamente las dos cuentas (la cuenta de celular no tiene
correo con el cual emparejar) → quedan **dos cuentas separadas**, cada una con su
tienda. La vinculación automática (caso #3) solo ocurre cuando la cuenta previa
**sí** tiene correo. Una pantalla de "vincular cuenta" desde ajustes resolvería
esto más adelante; no es necesario para el MVP.

---

## 6. Modelo de datos

Migración `database/local/006_oauth_google.sql`:

- `usuario.oauth_provider` (`'google'`) y `usuario.oauth_sub` (id estable que da
  Google; no cambia aunque el usuario cambie de correo).
- `usuario.password_hash` pasa a ser **nullable** (las cuentas OAuth no tienen
  contraseña local).
- Índice único parcial `usuario_oauth_idx (oauth_provider, oauth_sub)`: impide
  vincular dos cuentas NEXA al mismo Google.
- Check `usuario_metodo_auth_chk`: toda cuenta debe poder autenticarse de alguna
  forma — contraseña local **o** un proveedor OAuth.

---

## 7. Archivos relevantes

| Archivo | Rol |
| ------- | --- |
| `server/api/auth/oauth/google/start.get.ts`    | Genera `state` + PKCE y redirige a Google. |
| `server/api/auth/oauth/google/callback.get.ts` | Valida, intercambia el `code`, lee el perfil y abre sesión. |
| `server/utils/oauth.ts`                        | Cliente de Google, resolución/alta de usuario y emisión de sesión. |
| `database/local/006_oauth_google.sql`          | Migración del modelo de datos. |
| `app/pages/login.vue`                          | Botón "Continuar con Google" y avisos de retorno. |

### Nota de seguridad

Las cookies del flujo (`google_oauth_state`, `google_oauth_verifier`) y la cookie
de sesión emitida en el callback usan `SameSite=Lax` (no `Strict`): el navegador
regresa de Google con una navegación *cross-site* y, con `Strict`, las cookies no
se enviarían y el usuario quedaría "deslogueado hasta refrescar". El resto de la
app (login/registro por contraseña) sigue usando `Strict`.
