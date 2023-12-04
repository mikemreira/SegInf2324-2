package org.example;

import javax.net.ssl.*;
import java.io.*;
import java.security.KeyManagementException;
import java.security.KeyStore;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;

public class Main {
    public static void main(String[] args) throws IOException, NoSuchAlgorithmException, KeyStoreException, CertificateException, KeyManagementException {
        TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        KeyStore ks = KeyStore.getInstance("PKCS12");
        ks.load(new FileInputStream("./server/secure-server.pfx"), "changeit".toCharArray());
        tmf.init(ks);

        SSLContext sc = SSLContext.getInstance("TLS");
        sc.init(null, tmf.getTrustManagers(), null);
        SSLSocketFactory sslFactory = sc.getSocketFactory();

        // establish connection
        SSLSocket client = (SSLSocket) sslFactory.createSocket("www.secure-server.edu", 4433);
        client.startHandshake();

        PrintWriter out = new PrintWriter(
                new BufferedWriter(
                        new OutputStreamWriter(
                                client.getOutputStream())));

        out.println("GET / HTTP/1.0");
        out.println();
        out.flush();

        BufferedReader in = new BufferedReader(
                new InputStreamReader(
                        client.getInputStream()));

        String inputLine;
        while ((inputLine = in.readLine()) != null)
            System.out.println(inputLine);

        in.close();
        out.close();

        SSLSession session = client.getSession();

        // System.out.println("Cipher suite: " + session.getCipherSuite());
        // System.out.println("Protocol version: " + session.getProtocol());
        System.out.println(session.getPeerCertificates()[0]);
    }
}