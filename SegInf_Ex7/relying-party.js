const express = require('express')
const cookieParser = require('cookie-parser');
const axios = require('axios');
const FormData = require('form-data');// more info at:
// https://github.com/auth0/node-jsonwebtoken
// https://jwt.io/#libraries
const jwt = require('jsonwebtoken');
const { newEnforcer } = require('casbin')

// já temos milestones criadas, fazer redirect para oauth no github, e obter as milestones, depois clicar numa milestone e criar como uma google task

const GITHUB_CLIENT_ID = "dd46b6c8d9ff8983b6ef"

const port = 3001

// system variables where Client credentials are stored
const CLIENT_ID = "213703955375-gpurfk3fhaenf1r572qg8prlfd7ptff9.apps.googleusercontent.com"
const CLIENT_SECRET = "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"
// callback URL configured during Client registration in OIDC provider
const CALLBACK = 'callback-demo2324'

const app = express()
app.use(cookieParser());

app.get('/', (req, resp) => {
    resp.send('<a href=/login>Use Google Account</a>')
})

const pdp = async function(s, o, a, res) {
    const enforcer = await newEnforcer('model.conf', 'policy.csv')
    let r = await enforcer.enforce(s, o, a);
    return {res: r, sub: s, obj: o, act: a}
}

// More information at:
//      https://developers.google.com/identity/protocols/OpenIDConnect

app.get('/login', (req, resp) => {
    resp.redirect(302,
        // authorization endpoint
        'https://accounts.google.com/o/oauth2/v2/auth?'
        
        // client id
        + 'client_id='+ CLIENT_ID +'&'
        
        // OpenID scope "openid email"
        + 'scope=openid%20email&'
        
        // parameter state is used to check if the user-agent requesting login is the same making the request to the callback URL
        // more info at https://www.rfc-editor.org/rfc/rfc6749#section-10.12
        + 'state=value-based-on-user-session&'
        
        // responde_type for "authorization code grant"
        + 'response_type=code&'
        
        // redirect uri used to register RP
        + 'redirect_uri=http://localhost:3001/'+CALLBACK)
})

app.get("/github", (req, res) => {
    /*const form = new FormData()
    form.append("client_id", GITHUB_CLIENT_ID)
    form.append("redirect_uri", "http://localhost:3001/callback-2324")
    form.append("scope", "user")
    form.append("state", "seginf")*/

    res.redirect(302, "https://github.com/login/oauth/authorize?"
                + "client_id=" + GITHUB_CLIENT_ID + "&"
                + "redirect_uri=" + "http://localhost:3001/callback-2324&"
                + "scope=user&"
                + "state=seginf")
})

app.get("/callback-2324", (req, res) => {
    const form = new FormData()
    form.append("client_id", GITHUB_CLIENT_ID)
    form.append("client_secret", "bfca2b8dae34535553070fa20c35da1bbf835d72")
    const searchParams = new URLSearchParams(window.location.search);

    form.append("code", searchParams.get("code"))
    form.append("redirect_uri", "http://localhost:3001")
    axios.post("https://github.com/login/oauth/access_token")
        .then(response => {
            res.cookie("Github_Token", response.data)
        })
})

app.get('/'+CALLBACK, (req, resp) => {
    //
    // TODO: check if 'state' is correct for this session
    //

    console.log('making request to token endpoint')
    // content-type: application/x-www-form-urlencoded (URL-Encoded Forms)
    const form = new FormData();
    form.append('code', req.query.code);
    form.append('client_id', CLIENT_ID);
    form.append('client_secret', CLIENT_SECRET);
    form.append('redirect_uri', 'http://localhost:3001/'+CALLBACK);
    form.append('grant_type', 'authorization_code');
    //console.log(form);

    axios.post(
        // token endpoint
        'https://www.googleapis.com/oauth2/v3/token', 
        // body parameters in form url encoded
        form,
        { headers: form.getHeaders() }
      )
      .then(function (response) {
        // AXIOS assumes by default that response type is JSON: https://github.com/axios/axios#request-config
        // Property response.data should have the JSON response according to schema described here: https://openid.net/specs/openid-connect-core-1_0.html#TokenResponse

        console.log(response.data)
        // decode id_token from base64 encoding
        // note: method decode does not verify signature
        var jwt_payload = jwt.decode(response.data.id_token)
        console.log(jwt_payload)

        // a simple cookie example
        resp.cookie("user_email", jwt_payload.email)
        // HTML response with the code and access token received from the authorization server
        resp.send(
            '<div> callback with code = <code>' + req.query.code + '</code></div><br>' +
            '<div> client app received access code = <code>' + response.data.access_token + '</code></div><br>' +
            '<div> id_token = <code>' + response.data.id_token + '</code></div><br>' +
            '<div> Hi <b>' + jwt_payload.email + '</b> </div><br>' +
            'Go back to <a href="/">Home screen</a>'
        );
      })
      .catch(function (error) {
        console.log(error)
        resp.send()
      });
})

app.get("/tasks", (req, res) => {
    console.log("Entered function")
    pdp("moreiram2009@gmail.com", "tasks", "read").then(decision => {
        console.log(decision)
        if (!decision.res) {
            res.send(
                '<div><b>Not Authorized 401</b></div>'
            )
        } else {
            res.send(
                '<div><b>Congrats you are authorized</b></div>'
            )
        }
    })
})

app.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }
    console.log(`server is listening on ${port}`)
})