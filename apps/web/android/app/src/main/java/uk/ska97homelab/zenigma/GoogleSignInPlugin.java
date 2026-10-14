package uk.ska97homelab.zenigma;

import android.os.CancellationSignal;

import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/**
 * Google sign-in for the Android app. The WebView cannot run Google's web sign-in, so this asks Android's own account
 * picker (Credential Manager) for a Google ID token. The token is issued for the server's web client id, so the API checks
 * it exactly as it checks a token from the web app.
 */
@CapacitorPlugin(name = "GoogleSignIn")
public class GoogleSignInPlugin extends Plugin {

    @PluginMethod
    public void signIn(PluginCall call) {
        final String serverClientId = call.getString("serverClientId", "");
        if (serverClientId == null || serverClientId.isEmpty()) {
            call.reject("Google sign-in is not set up on the server.", "NOT_CONFIGURED");
            return;
        }

        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(serverClientId).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        CredentialManager manager = CredentialManager.create(getActivity());

        manager.getCredentialAsync(
            getActivity(),
            request,
            new CancellationSignal(),
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse result) {
                    Credential credential = result.getCredential();
                    if (credential instanceof CustomCredential
                        && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                        try {
                            GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(((CustomCredential) credential).getData());
                            JSObject out = new JSObject();
                            out.put("idToken", google.getIdToken());
                            out.put("email", google.getId());
                            out.put("name", google.getDisplayName());
                            call.resolve(out);
                        } catch (Exception e) {
                            call.reject("Could not read the Google account.", "FAILED");
                        }
                    } else {
                        call.reject("Unexpected sign-in result.", "FAILED");
                    }
                }

                @Override
                public void onError(GetCredentialException e) {
                    if (e instanceof GetCredentialCancellationException) {
                        call.reject("Cancelled.", "CANCELLED");
                    } else if (e instanceof NoCredentialException) {
                        call.reject("No Google account is available on this phone.", "NO_ACCOUNT");
                    } else {
                        // Usually the Android OAuth client (package name and SHA-1) does not match this build.
                        call.reject(e.getMessage() == null ? "Google sign-in failed." : e.getMessage(), "FAILED");
                    }
                }
            }
        );
    }
}
