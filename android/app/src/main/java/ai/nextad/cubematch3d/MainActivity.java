package ai.nextad.cubematch3d;

import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getBridge().getWebView().addJavascriptInterface(new VibrateInterface(this), "AndroidVibrate");
    }

    static class VibrateInterface {
        private final Context ctx;
        VibrateInterface(Context ctx) { this.ctx = ctx; }

        @JavascriptInterface
        public void vibrate(String patternJson) {
            try {
                Vibrator v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null || !v.hasVibrator()) return;
                patternJson = patternJson.replaceAll("[\\[\\]\\s]", "");
                String[] parts = patternJson.split(",");
                long[] pattern = new long[parts.length];
                for (int i = 0; i < parts.length; i++) pattern[i] = Long.parseLong(parts[i].trim());
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createWaveform(pattern, -1));
                } else {
                    v.vibrate(pattern, -1);
                }
            } catch (Exception e) { /* ignore */ }
        }
    }
}
