package ai.nextad.cubematch3d;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.webkit.JavascriptInterface;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.analytics.FirebaseAnalytics;

public class MainActivity extends BridgeActivity {

    private static final int REQ_NOTIFICATION = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        FirebaseAnalytics.getInstance(this);
        getBridge().getWebView().addJavascriptInterface(new VibrateInterface(this), "AndroidVibrate");
        requestNotificationPermission();
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        REQ_NOTIFICATION);
            }
        }
    }

    static class VibrateInterface {
        private final Context ctx;
        VibrateInterface(Context ctx) { this.ctx = ctx; }

        @JavascriptInterface
        public void vibrate(String patternJson) {
            try {
                patternJson = patternJson.replaceAll("[\\[\\]\\s]", "");
                String[] parts = patternJson.split(",");
                long[] pattern = new long[parts.length];
                for (int i = 0; i < parts.length; i++) pattern[i] = Long.parseLong(parts[i].trim());

                Vibrator v;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    VibratorManager vm = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                    if (vm == null) return;
                    v = vm.getDefaultVibrator();
                } else {
                    v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
                }
                if (v == null || !v.hasVibrator()) return;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createWaveform(pattern, -1));
                } else {
                    v.vibrate(pattern, -1);
                }
            } catch (Exception e) { /* ignore */ }
        }
    }
}
