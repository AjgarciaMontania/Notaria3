package co.gov.notaria.cartagenadelchaira.evidencias;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Debe registrarse ANTES de super.onCreate: ahí es donde Capacitor
        // construye el puente y toma la lista de plugins.
        registerPlugin(ArchivosCompartidosPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
