# Cerrar el acceso a Firebase — guía paso a paso

Hasta ahora las reglas de Firebase estaban abiertas: cualquiera que conociera la
configuración del proyecto podía leer, subir o borrar documentos sin pasar por
la página ni por la clave. Esta guía cierra eso.

**Qué cambia para el personal:** ya no se entra con la clave `notaria2026`.
Cada persona entra con su propio correo y contraseña, en la web y en la APK.

**Qué NO cambia:** la calculadora de Liquidación sigue siendo pública. Nadie
necesita cuenta para usarla.

---

## ⚠️ El orden importa

Si publicas las reglas antes de desplegar el código nuevo, la página y la APK
dejan de funcionar hasta que actualices. Sigue los pasos en este orden:

1. Habilitar el acceso por correo en Firebase
2. Crear las cuentas del personal
3. Desplegar la web y repartir la APK nueva
4. **Al final**, publicar las reglas

---

## Paso 1 — Habilitar el acceso por correo y contraseña

1. Entra a [console.firebase.google.com](https://console.firebase.google.com)
   y abre el proyecto **notaria-liquidacion**
2. Menú izquierdo → **Compilación** → **Authentication**
3. Botón **Comenzar** (si es la primera vez)
4. Pestaña **Sign-in method** → **Correo electrónico/contraseña**
5. Activa el primer interruptor (**Habilitar**). El segundo, *Vínculo del correo
   electrónico*, déjalo apagado
6. **Guardar**

---

## Paso 2 — Crear las cuentas

En **Authentication** → pestaña **Users** → botón **Agregar usuario**.

Crea una cuenta por persona. Sugerencia de correos:

| Persona            | Correo                              |
| ------------------ | ----------------------------------- |
| Notario            | `notario@notaria.local`             |
| Secretaria         | `secretaria@notaria.local`          |
| Auxiliar           | `auxiliar@notaria.local`            |

> No hace falta que los correos existan de verdad ni que reciban mensajes:
> Firebase los usa solo como nombre de usuario. Ahora bien, si algún día quieres
> que la persona pueda recuperar su contraseña sola, entonces sí debe ser un
> correo real al que tenga acceso.

Para cada una, escribe el correo y una contraseña de **mínimo 6 caracteres**.
Anótalas y entrégalas en persona, no por WhatsApp.

---

## Paso 3 — Desplegar el código nuevo

```bash
git add .
git commit -m "Acceso con cuenta por persona y reglas de Firebase cerradas"
git push
```

Esto hace dos cosas a la vez:

- **La web** se redespliega sola en unos 2 minutos
- **La APK** se recompila en Actions → descarga el artifact e **instálala en
  todos los celulares** que la usen. Es la versión **1.4**

Comprueba que la web y la APK piden ya correo y contraseña, y que puedes entrar
con una de las cuentas que creaste. En este punto las reglas siguen abiertas, así
que si algo falla no has roto nada todavía.

---

## Paso 4 — Publicar las reglas

Solo cuando el paso 3 funcione en la web **y** en los celulares.

### Firestore

1. Consola → **Firestore Database** → pestaña **Reglas**
2. Borra todo lo que haya y pega el contenido de
   [`firebase/firestore.rules`](firebase/firestore.rules)
3. **Publicar**

### Storage

1. Consola → **Storage** → pestaña **Reglas**
2. Borra todo y pega el contenido de
   [`firebase/storage.rules`](firebase/storage.rules)
3. **Publicar**

Los cambios tardan menos de un minuto en aplicarse.

---

## Paso 5 — Comprobar que quedó cerrado

1. Abre la web en una **ventana de incógnito**
2. La pestaña **Liquidación** debe funcionar completa, incluida la tasa de mora
   vigente. Si la tasa no aparece, algo salió mal en las reglas de Firestore
3. Entra a **Evidencias**: debe pedir correo y contraseña, y sin iniciar sesión
   no debe verse ninguna carpeta
4. Inicia sesión y comprueba que puedes ver, subir y borrar
5. En la APK: cierra sesión, vuelve a entrar, sube un PDF de prueba y bórralo

---

## Lo que esto protege y lo que no

**Queda protegido.** Sin una cuenta válida ya no se puede listar las carpetas,
ver qué documentos existen, subir, modificar ni borrar nada. Ni desde la página,
ni desde la APK, ni conectándose a Firebase por fuera con la configuración del
proyecto.

**Queda un hueco que debes conocer.** Cada archivo de Storage tiene una dirección
de descarga con un código incrustado (`?token=…`). Esa dirección funciona para
cualquiera que la tenga, aunque no haya iniciado sesión — así está diseñado
Firebase. Como la lista de archivos ahora está cerrada, nadie puede *conseguir*
esas direcciones sin una cuenta; pero si una se copia y se comparte por fuera,
ese documento concreto sigue siendo accesible con ese enlace.

Cerrar también eso es posible: implica dejar de guardar la dirección de descarga
y pedirle el archivo a Firebase con la sesión activa cada vez. Es un cambio de
mayor calado que afecta a cómo se ven y se descargan los documentos. Si te
interesa, pídelo y lo planteamos aparte.

---

## Tareas de mantenimiento

**Dar de alta a alguien:** Authentication → Users → Agregar usuario.
No hay que tocar el código ni volver a compilar la APK.

**Dar de baja a alguien:** Authentication → Users → los tres puntos junto a su
correo → **Inhabilitar cuenta** (reversible) o **Eliminar cuenta** (definitivo).
El acceso se le corta de inmediato, sin afectar a nadie más.

**Cambiar una contraseña:** los tres puntos → **Restablecer contraseña**.

**Si alguien olvida su contraseña:** puedes cambiársela desde ahí mismo, o —si su
correo es real— usar el envío de restablecimiento.
