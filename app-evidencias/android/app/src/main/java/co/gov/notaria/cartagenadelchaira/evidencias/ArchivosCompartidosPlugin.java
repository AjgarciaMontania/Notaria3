package co.gov.notaria.cartagenadelchaira.evidencias;

import android.content.ClipData;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Recibe los PDF que otras aplicaciones (ClearScanner, Drive, WhatsApp…)
 * envían a esta app con el botón "Compartir" de Android.
 *
 * Por qué existe:
 * el selector de archivos normal deja elegir varios, pero cuando ClearScanner
 * actúa como origen dentro de ese selector solo permite uno a la vez. Con este
 * plugin el usuario hace lo contrario: selecciona todos los PDF dentro de
 * ClearScanner y los comparte hacia "Evidencias Notaría", que los recibe en
 * bloque.
 *
 * Qué hace: copia cada archivo recibido a la carpeta de caché de la app y
 * entrega a la interfaz la ruta local resultante. Se copia a propósito, porque
 * el permiso de lectura sobre el content:// original caduca en cuanto termina
 * el intent.
 */
@CapacitorPlugin(name = "ArchivosCompartidos")
public class ArchivosCompartidosPlugin extends Plugin {

    private final List<JSObject> pendientes = new ArrayList<>();

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        recibir(intent);
    }

    /** La interfaz llama a esto al arrancar, por si llegaron archivos antes de estar lista. */
    @PluginMethod
    public void obtenerPendientes(PluginCall call) {
        JSObject respuesta = envolver(pendientes);
        pendientes.clear();
        call.resolve(respuesta);
    }

    private void recibir(Intent intent) {
        if (intent == null) {
            return;
        }

        String accion = intent.getAction();
        boolean esUno = Intent.ACTION_SEND.equals(accion);
        boolean esVarios = Intent.ACTION_SEND_MULTIPLE.equals(accion);
        if (!esUno && !esVarios) {
            return;
        }

        List<Uri> origenes = new ArrayList<Uri>();

        if (esUno) {
            Uri unico = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (unico != null) {
                origenes.add(unico);
            }
        } else {
            ArrayList<Uri> lista = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (lista != null) {
                for (Uri uri : lista) {
                    if (uri != null) {
                        origenes.add(uri);
                    }
                }
            }
        }

        // Algunas apps no usan EXTRA_STREAM sino el ClipData del intent.
        if (origenes.isEmpty() && intent.getClipData() != null) {
            ClipData clip = intent.getClipData();
            for (int i = 0; i < clip.getItemCount(); i++) {
                Uri uri = clip.getItemAt(i).getUri();
                if (uri != null) {
                    origenes.add(uri);
                }
            }
        }

        if (origenes.isEmpty()) {
            return;
        }

        // Marcamos el intent como consumido: Android puede volver a entregarlo
        // (por ejemplo al girar la pantalla) y no queremos subir dos veces.
        intent.setAction(null);
        intent.removeExtra(Intent.EXTRA_STREAM);

        List<JSObject> copiados = new ArrayList<JSObject>();
        for (Uri uri : origenes) {
            JSObject copia = copiarACache(uri);
            if (copia != null) {
                copiados.add(copia);
            }
        }

        if (copiados.isEmpty()) {
            return;
        }

        pendientes.addAll(copiados);
        // retainUntilConsumed = true: si la interfaz todavía no cargó, el aviso
        // se guarda y se entrega en cuanto se registre el oyente.
        notifyListeners("archivosCompartidos", envolver(copiados), true);
    }

    private JSObject envolver(List<JSObject> lista) {
        JSArray archivos = new JSArray();
        for (JSObject item : lista) {
            archivos.put(item);
        }
        JSObject respuesta = new JSObject();
        respuesta.put("archivos", archivos);
        return respuesta;
    }

    private JSObject copiarACache(Uri uri) {
        InputStream entrada = null;
        OutputStream salida = null;
        File destino = null;
        try {
            String nombre = nombreDe(uri);

            File carpeta = new File(getContext().getCacheDir(), "compartidos");
            if (!carpeta.exists() && !carpeta.mkdirs()) {
                return null;
            }

            destino = new File(carpeta, System.currentTimeMillis() + "_" + nombre);

            entrada = getContext().getContentResolver().openInputStream(uri);
            if (entrada == null) {
                return null;
            }

            salida = new FileOutputStream(destino);
            byte[] bloque = new byte[8192];
            long total = 0;
            int leidos = entrada.read(bloque);
            while (leidos != -1) {
                salida.write(bloque, 0, leidos);
                total += leidos;
                leidos = entrada.read(bloque);
            }
            salida.flush();

            if (total == 0) {
                return null;
            }

            String tipo = getContext().getContentResolver().getType(uri);

            JSObject archivo = new JSObject();
            archivo.put("nombre", nombre);
            archivo.put("ruta", destino.getAbsolutePath());
            archivo.put("tamano", total);
            archivo.put("tipo", tipo != null ? tipo : "application/pdf");
            return archivo;
        } catch (Exception error) {
            return null;
        } finally {
            cerrar(entrada);
            cerrar(salida);
            if (destino != null && destino.exists() && destino.length() == 0) {
                destino.delete();
            }
        }
    }

    private void cerrar(java.io.Closeable recurso) {
        if (recurso != null) {
            try {
                recurso.close();
            } catch (Exception ignorado) {
                // Cerrar no debe tumbar la operación.
            }
        }
    }

    /** Nombre real del archivo compartido; si no se puede saber, uno genérico. */
    private String nombreDe(Uri uri) {
        String nombre = null;
        Cursor cursor = null;
        try {
            cursor = getContext().getContentResolver().query(uri, null, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int columna = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (columna >= 0) {
                    nombre = cursor.getString(columna);
                }
            }
        } catch (Exception ignorado) {
            nombre = null;
        } finally {
            if (cursor != null) {
                try {
                    cursor.close();
                } catch (Exception ignorado) {
                    // sin efecto
                }
            }
        }

        if (nombre == null || nombre.trim().length() == 0) {
            String ultimo = uri.getLastPathSegment();
            nombre = (ultimo != null && ultimo.trim().length() > 0) ? ultimo : "documento.pdf";
        }

        // Caracteres que no valen como nombre de archivo
        nombre = nombre.replaceAll("[\\\\/:*?\"<>|]", "_");

        if (!nombre.toLowerCase().endsWith(".pdf")) {
            nombre = nombre + ".pdf";
        }

        return nombre;
    }
}
