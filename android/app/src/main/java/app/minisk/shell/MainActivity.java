package app.minisk.shell;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * App de uma tela só: abre o index.html que vai DENTRO do APK (pasta assets/www).
 * Usa um endereço https "de mentira" (appassets.androidplatform.net) para o
 * navegador interno liberar tudo: banco do navegador, módulos, service worker.
 */
public class MainActivity extends Activity {
    private static final String INICIO = "https://appassets.androidplatform.net/assets/www/index.html";
    private static final int ESCOLHER_ARQUIVO = 41;
    private WebView web;
    private ValueCallback<Uri[]> retornoArquivo;

    @Override
    protected void onCreate(Bundle salvo) {
        super.onCreate(salvo);
        try { getWindow().setStatusBarColor(getResources().getColor(R.color.tema, null)); } catch (Exception ignorado) { }

        final WebViewAssetLoader carregador = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                return carregador.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                // links de fora (sites) abrem no navegador do celular
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignorado) { }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> retorno, FileChooserParams p) {
                if (retornoArquivo != null) retornoArquivo.onReceiveValue(null);
                retornoArquivo = retorno;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                if (p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(Intent.createChooser(i, "Escolher arquivo"), ESCOLHER_ARQUIVO);
                } catch (Exception e) {
                    retornoArquivo = null;
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Ponte(), "AndroidBridge");
        setContentView(web);
        if (salvo != null) web.restoreState(salvo);
        else web.loadUrl(INICIO);
    }

    @Override
    protected void onActivityResult(int pedido, int resultado, Intent dados) {
        if (pedido == ESCOLHER_ARQUIVO && retornoArquivo != null) {
            Uri[] lista = null;
            if (resultado == RESULT_OK && dados != null) {
                if (dados.getClipData() != null) {
                    int n = dados.getClipData().getItemCount();
                    lista = new Uri[n];
                    for (int k = 0; k < n; k++) lista[k] = dados.getClipData().getItemAt(k).getUri();
                } else if (dados.getData() != null) {
                    lista = new Uri[]{ dados.getData() };
                }
            }
            retornoArquivo.onReceiveValue(lista);
            retornoArquivo = null;
            return;
        }
        super.onActivityResult(pedido, resultado, dados);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle saida) {
        super.onSaveInstanceState(saida);
        if (web != null) web.saveState(saida);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    /** Ponte JavaScript → Android: salva arquivos baixados na pasta Downloads. */
    class Ponte {
        @JavascriptInterface
        public String salvar(String nome, String base64, String tipo) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, nome);
                    cv.put(MediaStore.Downloads.MIME_TYPE, (tipo == null || tipo.isEmpty()) ? "application/octet-stream" : tipo);
                    Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (u == null) return "sem acesso a Downloads";
                    try (OutputStream os = getContentResolver().openOutputStream(u)) { os.write(bytes); }
                } else {
                    File pasta = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    try (FileOutputStream os = new FileOutputStream(new File(pasta, nome))) { os.write(bytes); }
                }
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Salvo em Downloads: " + nome, Toast.LENGTH_LONG).show());
                return "ok";
            } catch (Exception e) {
                return String.valueOf(e.getMessage());
            }
        }
    }
}
