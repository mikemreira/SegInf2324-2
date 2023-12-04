// Built-in HTTPS support
const https = require("https");
// Handling GET request (npm install express)
const express = require("express");
// Load of files from the local file system
var fs = require('fs'); 

const PORT = 4433;
const app = express();

// Get request for resource /
app.get("/", function (req, res) {
    console.log(
        req.socket.remoteAddress
        //+ ' ' + req.socket.getPeerCertificate().subject.CN
        + ' ' + req.method
        + ' ' + req.url);
    res.send("<html><body>Secure Hello World with node.js</body></html>");
});

// openssl pkcs12 -in Alice_1.pfx -out Alice_1.pem
// security import Alice_1.pem -k ~/Library/Keychains/login.keychain

// configure TLS handshake
const options = {
    key: fs.readFileSync('./secure-server-key.pem'),
    cert: fs.readFileSync('./secure-server.pem'),
    //ca: fs.readFileSync('./certificates-keys/trust-anchors/CA1.pem'),
    //requestCert: true,
    //rejectUnauthorized: true
};

// Create HTTPS server
https.createServer(options, app).listen(PORT, 
    function (req, res) {
        console.log("Server started at port " + PORT);
    }
);